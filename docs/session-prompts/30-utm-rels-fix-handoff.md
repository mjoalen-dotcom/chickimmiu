# Session 30 — UTM rels schema gap 修復 + mbti-style 開關

**Date**: 2026-05-05
**Status**: 診斷完成 / 備份完成 / 等 user 同意後動 prod
**Worktree**: `.claude/worktrees/eloquent-wiles-9818e3` (branch `claude/eloquent-wiles-9818e3`)
**Prod HEAD**: `28bfd62` (latest main)
**Prod DB backup**: `/var/www/chickimmiu/data/chickimmiu.db.pre-utm-rels-fix-20260505-160125`

---

## 1. 使用者回報

> https://pre.chickimmiu.com/games/mbti-style 頁面錯誤
> https://pre.chickimmiu.com/admin/globals/game-settings 裡面沒內容

## 2. 表象 vs 真因

| 表象 | 真因 |
|---|---|
| `/games/mbti-style` 顯示「404 找不到此頁面」 | `getGameSettings('mbti-style')` 內 `findGlobal({slug:'game-settings'})` SQL 炸 → 走 `notFound()` |
| `/admin/globals/game-settings` 表單空白（只剩 header） | 同一 SQL crash → SSR throw → 整個 admin form HTML 沒產出 |

**真兇**：`SQLITE_ERROR: no such column: product_view_events_id` 在 `payload_locked_documents_rels` table。

## 3. 因果鏈

1. PR-B (#158, `00e6777`) 加了 2 個 collection：`ProductViewEvents` + `UTMCampaigns`
2. `src/migrations/20260429_180000_add_utm_attribution.ts` 建了 `product_view_events` table 但**沒加** `payload_locked_documents_rels.product_view_events_id` + `utm_campaigns_id` 欄位
3. Payload 在 admin / `findGlobal` 等動作會 join `payload_locked_documents_rels` 抓「正在被誰編輯」的 lock 狀態，SELECT 列出**所有** collection 的 `<slug>_id` 欄位
4. SQL 找不到 `product_view_events_id` → throw → admin form 整個 SSR fail → 空白
5. 前台 `/games/[slug]` 走同一個 `findGlobal` → 也 throw → return null → notFound() → 404

memory 早警告過此 pattern：[`feedback_prod_schema_sync_on_new_collections.md`](../../memory/feedback_prod_schema_sync_on_new_collections.md)

## 4. 證據

```
prod log:
  ⨯ Error: ... no such column: product_view_events_id
  query: select ... "product_view_events_id" ... "utm_campaigns_id" ... from payload_locked_documents_rels
  page.js:114:199470 (admin global page)

DB schema diff vs query expected columns:
  缺：product_view_events_id, utm_campaigns_id
  其他 56 個 _id 欄位都 OK
```

## 5. 修法計畫（等使用者同意後動）

### Step 1 — Prod hot-fix（救 fire，不需 redeploy code）

```bash
ssh root@5.223.85.14 'sqlite3 /var/www/chickimmiu/data/chickimmiu.db <<EOF
ALTER TABLE payload_locked_documents_rels ADD COLUMN product_view_events_id INTEGER REFERENCES product_view_events(id) ON DELETE CASCADE;
ALTER TABLE payload_locked_documents_rels ADD COLUMN utm_campaigns_id INTEGER REFERENCES utm_campaigns(id) ON DELETE CASCADE;
CREATE INDEX payload_locked_documents_rels_product_view_events_id_idx ON payload_locked_documents_rels (product_view_events_id);
CREATE INDEX payload_locked_documents_rels_utm_campaigns_id_idx ON payload_locked_documents_rels (utm_campaigns_id);
EOF'
```

### Step 2 — 順便打開 mbti-style 開關（admin form 修好後 user 也能進 UI 改）

```bash
ssh root@5.223.85.14 'sqlite3 /var/www/chickimmiu/data/chickimmiu.db "UPDATE game_settings SET game_list_mbti_style_enabled = 1;"'
```

### Step 3 — 驗證

- `curl -I https://pre.chickimmiu.com/games/mbti-style` → 200
- chrome admin global page 看到完整表單
- `pm2 logs --err` 不再噴 product_view_events_id

### Step 4 — 寫補丁 migration commit 進 main（防 fresh deploy）

新檔 `src/migrations/20260505_160000_add_utm_lock_rels.ts`：
- `payload_locked_documents_rels` add columns（PRAGMA 冪等：先檢查 column 存不存在）
- 兩個 index（IF NOT EXISTS）
- 開 PR、merge、prod re-deploy 不需做（hot-fix 已生效，migration 跑時會發現欄位已存在跳過）

## 6. 沒動的事 / 風險

- ❌ 還沒動 prod DB（等 user OK）
- ⚠️ Stack hidden：log 也有「Element type is invalid: ... got: undefined」digest `3059950254` — 可能是 admin 在 SQL crash 後 React renderRoot 的 fallback 報的二次錯，不一定獨立 bug。先修 SQL 再觀察
- ⚠️ Mempage 上「PayloadComponent not found in importMap」是 stale build log（`28bfd62` 已 regen importMap），不是 active issue
- ⚠️ Build 14:26 之前 pm2 crash 240 次（log 顯示「Could not find production build」）— 已被 user 自己 14:26 的 deploy 解掉，不需處理

## 7. 給 user 的問句（等待回覆）

「要不要我直接 SSH 動 prod？」
