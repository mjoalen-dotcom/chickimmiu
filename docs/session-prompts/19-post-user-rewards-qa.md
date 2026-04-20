# Session 19 — post UserRewards QA 接續提示

> **上 session (2026-04-20/21, ecstatic-benz-c4da72 worktree) 一行總結**：`user-rewards` 寶物箱完整 E2E 測試 — 32/32 PASS；產出可重跑測試腳本 + 測試報告 md；無 commit 無 PR，本 worktree 留 2 個 untracked artifact + 1 個待決定的 config 改動。

## 目前 SHA
- local main / origin/main / prod：**38bd277**（`ops(deploy): atomic-ish prod deploy script` — Session 18 後沒再變）
- Open PR 清單：**空**（`gh pr list --state open` 回 0 筆）
- 本 worktree branch：`claude/ecstatic-benz-c4da72`（從 main 切出，沒 commit）

## 上 session 做了什麼

### 測試 user-rewards collection + 所有 hooks + REST + access control

**Phase 1 — smoke test（curl HTTP）**：6 個 consume API case 全 PASS
- happy path（unused→consumed, 200）/ 冪等（already consumed, 409）/ shipped 保護（409）/ expired 保護（409）/ 404 / 401

**Phase 2 — scenario suite（`node --experimental-strip-types`）**：9 scenario / 32 assertion 全 PASS
- T1 遊戲 win → UserRewards auto-create（coupon/badge 建、points/lose 不建）
- T2 訂單 create 時實體獎項 auto-attach 進 `orders.gifts[]` → order shipped 後 reward→shipped
- T3 訂單 cancel → pending_attach 回 unused，已 shipped 不動
- T4 owner access：B 看不到 A 的 reward，B 不能 consume A 的券（403）
- T5 `coupon_code` UNIQUE partial index：重複 reject，多筆 NULL OK
- T6 expiry 邊界：`+60s` unused / `-100ms` expired（lazy）
- T7 summary filter：只算 unused+pending，其他排除
- T8 lazy expire 不寫 DB：admin 改 expiresAt 到未來 → 回 unused
- T9 腳本冪等：重跑不爆

### 產出檔案
- `scripts/test-user-rewards-scenarios.ts` — 可重跑 REST 測試腳本
- `docs/tests/user-rewards-test-report-2026-04-21.md` — 測試報告（32 PASS 明細）

## 本 worktree 目前狀態（**未 commit**）

```
 M src/payload.config.ts          ← 加了 `db.push: false`（見下 Decision point）
?? docs/tests/                    ← 新測試報告
?? scripts/test-user-rewards-scenarios.ts   ← 新測試腳本
```

另外 **worktree 的 `data/chickimmiu.db` 是隔離副本**（從 `../../../data/chickimmiu.db` 複製+migrate），不影響主 DB。若清 worktree 要記得 `rm -rf data/`。

## Decision point — `db.push: false` 要不要進 main？

### 為什麼加
`pnpm dev` 或 `pnpm payload run` 遇到 schema 差異時會互動問 `Is X table created or renamed?`，這個 prompt **在非 TTY stdin 裡永遠卡死**，且 `push` 模式會 **block DB writes**（我看到 POST /api/users/login 卡 30 秒才 200，實際資料沒進 DB）。加 `push: false` 後 dev server 只依 migrations，不動 schema，所有 write 立刻通。

### 為什麼猶豫
1. 其他 dev 可能倚賴 push 模式快速改 collection 看結果（少一步 `pnpm payload migrate`）
2. 團隊 convention 未知（memory 沒寫）
3. 等於 production-like 行為：一律靠 migration，不隱式 schema 漂移

### 建議
**a)** 留著進 main（PR 標「fix(dev): disable schema push to prevent stalls」+ docs 說明要跑 `pnpm payload migrate` 後才能跑 dev）
**b)** 只在本 worktree 留著，用完 revert
**c)** 改成 env-gated（`push: process.env.PAYLOAD_ENABLE_PUSH === 'true'` — 預設 false，個別 dev 要用再開）

我傾向 **(c)**（最小 blast radius），但先讓使用者決定。

## 下 session 候選（按 P0→P4，沿用 Session 18 未完清單）

問使用者先挑哪個（memory `feedback_scope_control.md`）。

### P0 — UserRewards follow-up（本 session 衍生）
- 決定 `db.push: false` 走 a/b/c 哪條
- 決定 `scripts/test-user-rewards-scenarios.ts` + 測試報告是否 commit（獨立 PR 乾淨無 risk）
- 決定主 DB 要不要跑本 session 驗過的 3 支新 migration（`20260419_210000_add_user_rewards` / `20260419_230000_add_orders_gifts` / `20260420_100000_add_style_submissions`+更多）。**主 DB 目前沒跑**，所以主 worktree 的 dev server 在這些 collection 上會爆；prod 更沒跑

### P0 — 封測 Blocker（沿用 Session 18）
- `/account/**` layout 層 auth gate — prod 測 `/account/orders` 無 cookie 是否 redirect（PR #1 可能已修）
- `/account/orders`, `/account/addresses`, `/account/settings` 接通真實資料（ISSUE-006/007/008）
- Header 登入狀態（PR #14 應已解，session 10 回報可能沒解）— 先 prod 重驗

### P1 — 未驗證
- **PR #53 寶物頁 authenticated view 實測** — 本 session 在 dev 用 SSR HTML 證實 render 正常，但 **dev mode client hydration 因 B5 webpack chunk mismatch 會顯示 error boundary**；prod 因 content-hash 自動 heal。建議下 session 在 prod 實測一次或用 Claude in Chrome 登入查看
- PR #56 admin UX 實跑一次 `/admin/collections/points-redemptions`

### P2 — 尾巴
- Meta Pixel CSP gap（`next.config.mjs` 無 `connect.facebook.net`）
- Remote branch cleanup（Session 17 handoff 9 條）
- R2 token rotation
- Windows 殘留 `C:/Users/mjoal/ally-site/ckmu-meetup/`
- `feat/commerce-core` (f513daa) / `feat/auth-hardening-v2` (2b49015) / `feat/cms-missing-pages` (e7fc8e6) 三個 未 open 的 branch

### P3 — Phase 2 未完
- Email 驗證信流程
- OAuth cookie 橋接擴到 Google/Facebook

### P4 — 使用者決定
- Apple Sign-In（等 Dev Program）

## 重要 reminders

- **開工前必跑** `git log --oneline -10` + `preview_list` + `gh pr list --state open`
- **本 session 繞過 `pnpm payload run` 卡死 bug**：用 `node --experimental-strip-types <file.ts>` 直跑；script 用 HTTP REST 對 running dev server 打，不走 payload local API（local API 也卡在 init）
- **Dev admin login**：`admin@chickimmiu.com` 我沒試出密碼；現場改用 `/api/users/register` 建 demo user + 直接 SQL `UPDATE users SET role='admin'` 繞（僅限本 worktree 隔離副本）
- **Prod deploy SOP**：`ssh root@5.223.85.14`, `/root/deploy-ckmu.sh`（per memory `reference_prod_deploy_script`）
- **gh CLI**：`/c/Program Files/GitHub CLI/gh.exe`
- **Payload admin combobox**：用 REST fetch，不戳 react-select UI（memory `feedback_payload_admin_verify_via_rest`）
- **Multi-need 訊息先選項題**（memory `feedback_scope_control`）

## 如何重跑本 session 的測試

```bash
# 1. 確認 dev server 在 :3001 跑（dev server 會用 src/payload.config.ts，需 `push: false`）
pnpm dev -p 3001

# 2. 另起 shell 跑 test
ADMIN_EMAIL='demo@test.local' ADMIN_PW='Demo12345!' \
  node --experimental-strip-types scripts/test-user-rewards-scenarios.ts
# 成功最後一行：ALL PASS ✅
```

如換 worktree，需要：
1. `cp ../../../.env .`（worktree 沒 .env）
2. `pnpm install --prefer-offline`
3. `mkdir data && cp ../../../data/chickimmiu.db data/chickimmiu.db`（隔離副本）
4. `echo y | pnpm payload migrate`
5. `curl -X POST http://localhost:3001/api/users/register -d '{"email":"demo@test.local","password":"Demo12345!","name":"Demo","acceptTerms":true}' -H 'Content-Type: application/json'`
6. SQL: `UPDATE users SET role='admin' WHERE email='demo@test.local'`
7. 跑測試

## 外部狀態

- local main = origin/main = prod = `38bd277`
- 本 worktree `ecstatic-benz-c4da72`：`payload.config.ts` 改動待決策、2 個新 artifact 待 commit
- `data/chickimmiu.db` worktree 副本：可刪
- 測試期間產生的 user id 7/8/9 (`demo@test.local` / `test-ur-alpha@example.com` / `test-ur-bravo@example.com`) 只存在 worktree 副本 DB，主 DB 沒事
