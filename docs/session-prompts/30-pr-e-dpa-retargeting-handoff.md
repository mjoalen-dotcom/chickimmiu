# 30 — PR-E：DPA Retargeting Custom Audience（下一個 session）

**Status:** PR-D Catalog batch push 已 merged，PR-E 待開
**Prereq:** PR-A 商品 feed + PR-B UTM 歸因 + PR-C Pixel/CAPI 雙線 + PR-D Catalog batch push（**全已上 prod**）

---

## 0. PR-E 目標

PR-A → PR-D 把 chickimmiu 商品「上架到 Meta Catalog」+「即時對帳」的事都做完了。
PR-E 是把這個 catalog 真的拿來「動態廣告 / 再行銷」用 — 把 Pixel + UTM 累積的瀏覽/加購/結帳行為，餵給 Meta 自動產生 **Custom Audience**，讓你的 ads 系統可以用「過去 14 天看過裙子但沒買的人」這種行為定義投放。

最終要做出 4 個基本受眾：

| 受眾名 | 包含 | 排除 | 用途 |
|---|---|---|---|
| Viewers (no purchase) | 14 天內 ViewContent | 14 天內 Purchase | 廣到中的轉換 |
| Cart abandoners | 14 天內 AddToCart | 14 天內 Purchase | 高意圖再行銷 |
| Past purchasers (LTV) | 90 天內 Purchase | — | Lookalike 種子 |
| Specific product viewers | 14 天內 ViewContent of `content_id=X` | — | 商品級 retargeting |

---

## 1. 三個層次（不要一次塞滿）

### Layer 1 — Schema + admin UI（最 essential）
新 collection `AdAudiences`：
```
- name (text)
- description (textarea)
- type (select: viewers / cart_abandoners / purchasers / product_specific)
- timeWindowDays (number, default 14)
- filterProductIds (relationship[products], optional — for product_specific)
- excludePurchasersDays (number, default 14, 0=disable)
- metaAudienceId (text, read-only — Meta 回傳)
- lastSyncAt (date, read-only)
- syncStatus (select: idle / pending / synced / error)
- syncError (textarea, read-only)
```

admin UI：列表 + 編輯 + 「強制同步」按鈕（fires server action）。

### Layer 2 — Sync engine
`src/lib/ads/audienceSync.ts`：
- Read `AdAudiences` collection
- Build query against `ProductViewEvents`（PR-B 加的） + `Orders`（attribution）
- Hash user emails (SHA-256 lowercase, same pattern as PR-C)
- POST to `/{ad_account_id}/customaudiences` (CREATE) or
  `/{audience_id}/users` (ADD users)
- Endpoint: `https://graph.facebook.com/v25.0/act_441158936893428/customaudiences`
- Token: 同 PR-C 的 `META_CAPI_ACCESS_TOKEN`（scope `ads_management` 已含）
- Field: `customer_file_source: USER_PROVIDED_ONLY`, `subtype: CUSTOM`
- Schema for users: `[["EMAIL_SHA256"]]`
- Update logic: maintain `metaAudienceId` after first CREATE, subsequent
  syncs use ADD/REMOVE users not full re-create

### Layer 3 — Cron / scheduled sync
- 每 6 小時 / 12 小時自動 sync 所有 `enabled=true` 的 audience
- 用現有 cron infrastructure（PR #11/06 cron-runner）
- 失敗 retry 3 次後寫 syncError

---

## 2. 建議 PR 切法

**PR-E1**: Layer 1 schema + admin UI（不打 Meta API，純後台）
- 1 collection + 1 migration + admin views
- ~3 hr
- Mergeable independently，先 review 資料模型

**PR-E2**: Layer 2 sync engine + manual trigger button
- audienceSync.ts + server action + admin "強制同步" button
- ~4 hr
- 真的呼叫 Meta API，要 `ads_management` scope（已有）

**PR-E3**: Layer 3 cron auto-sync
- 接 cron runner
- ~2 hr
- 可以最後做

---

## 3. 開始 PR-E1 的 prompt

```
基於 main HEAD 開新 worktree `feat/ad-audiences-schema`。讀
docs/session-prompts/30-pr-e-dpa-retargeting-handoff.md 跟著 Layer 1 spec
做 PR-E1：

1. 新 AdAudiences collection (slug: ad-audiences)，groups 進「④ 行銷推廣」
2. 4 個 audience type 選項
3. 後台 list view 顯示 type / lastSyncAt / syncStatus colored badge
4. migration 用 PRAGMA + sqlite_master 冪等 pattern (參考
   src/migrations/20260429_120000_add_ads_catalog.ts)
5. tsc 0 new errors / pnpm build clean
6. PR 加進 importMap regen 步驟（避免 PR-B importMap miss 重演）
7. 不打 Meta API（純 schema PR）

完成後 deploy + 寫一條 PR-E2 handoff 給再下一個 session。
```

---

## 4. Token 已就緒（不用再申請）

- `META_CAPI_ACCESS_TOKEN` (env on prod) — 跨 BM 持有 ads_management scope
- `act_441158936893428` (Ad Account ID) — 已寫 prod DB
  `ads_catalog_settings.meta_ad_account_id`
- 直接用就好，不用 mint 新的

---

## 5. 為什麼 PR-E 要拆三層 / 別一次做完

- **資料對齊**：PR-B 的 `ProductViewEvents` 累積得夠（建議 30 天）audience 才有意義 — 現在 PR-B merge 才 1 天
- **API 風險**：custom audience API 比 catalog batch 嚴格（PII handling、user 同意、Meta 政策審核），破口可能比 PR-C 大
- **封測流量小**：100 個 viewers 不夠 Meta 跑 lookalike（最低 100，最佳 1000+），所以 audience 上線後可能要等流量
- **PR-D 已經夠用一陣子**：catalog 即時更新 + Pixel 雙線 已經是大部分 dynamic ads 的基礎，audience 沒接也能用 catalog ads 跑

建議：等 PR-D 上線實際投了 1-2 週的 ads，再決定要不要做 PR-E。或先做 PR-E1 schema 後台先建好（不打 API），慢慢累積資料。

---

## 6. PR-E 完工驗證 checklist

- [ ] AdAudiences collection 4 種 type 都能建
- [ ] 強制同步 button → Meta `/customaudiences` POST 200，回 audience_id 寫回 DB
- [ ] Meta Ads Manager → 受眾 → 看到剛建的 4 個 audience
- [ ] 重新觸發同步 → ADD users not 重 CREATE（看 sync log 行為）
- [ ] DELETE collection row → Meta audience 是否一起刪？(設計決策：建議 NOT 自動刪，手動 archive)
- [ ] cron 跑完 syncStatus 變 'synced'，syncError 空
- [ ] Lookalike audience 用「Past purchasers」當種子能成功建立

---

## 7. 風險點

- **GDPR / 個資**：custom audience uploads 需要 user consent。chickimmiu 目前已有 `marketingAccepted` checkbox（checkout 時收）— sync engine 必須過濾掉沒 opted-in 的 users
- **Meta 受眾政策**：audience size 太小（< 100）Meta 不會 deliver；需要在 admin UI 顯示 estimated size 警告
- **Rate limit**：custom audience API 1000 calls/hour，sync 100 audience x 1000 user 各 batch 200 = OK，但 cron 太密會觸頂
- **PII data leak**：肯定要 hash email 才送 Meta（PR-C 已有 sha256Lower 可複用）
