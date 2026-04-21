# 接下去的提示詞（Session post-P4-2）

## Context

PR #85 (feat/returns-ux) 已 merge + deploy。current prod commit `ef57978`。

### 已完成（2026-04-21）
- **會員端**
  - `/account/orders/[id]` shipped/delivered 顯示「申請退貨」「申請換貨」按鈕
  - `/account/returns/new?orderId=…` + `/account/exchanges/new?orderId=…` 申請表單
  - `/account/returns/[id]` + `/account/exchanges/[id]` 進度 timeline
  - `/account/returns` 原 demo data → 接真實資料（tabs 共用 returns / exchanges）
- **API**（auth + IDOR + order status + item validation）
  - `POST /api/returns`
  - `POST /api/exchanges`
- **Admin**
  - Returns / Exchanges list 「核准 / 拒絕」cell button（UI field + `quickApproval`）
  - 拒絕 prompt 收 adminNote，會進通知信
- **Email**（fire-and-forget，沿 `_shared.ts`）
  - `sendReturnRequestedEmail` (kind=return|exchange)
  - `sendReturnDecisionEmail` (approved/rejected/finalized)
  - `sendAdminReturnAlert` (用 OrderSettings.adminAlertEmails)
  - `afterChange` hook 接在 Returns.ts / Exchanges.ts

### Prod 驗證
- `/account/{returns,returns/new,exchanges/new,orders/1}` → 200
- `POST /api/{returns,exchanges}` no auth → 401
- `/admin/collections/{returns,exchanges}` → 200

### 已知但未處理
~~1. **policy_pages_settings.account_returns_notice_title 缺欄位**~~ — **已解（2026-04-21 sad-leavitt session）**：migration `20260422_200000_fix_policy_returns_notice_title.ts` 早在 PR #83 就 deploy 並執行，prod DB 已有該欄位（default `'退換貨須知'`），`/api/globals/policy-pages-settings` 回 200。本筆記寫的當下 prod 尚未跑到該 migration，後續自動補上。
~~2. **Worktree 目錄沒清掉**~~ — **已解（同 session）**：`rm -rf` 掉 `.claude/worktrees/returns-ux/`，file lock 已釋放。remote branch `feat/returns-ux` 清理被 hook 擋，需手動 `git push origin --delete`。

## 建議下一步（挑一）

### A. 實測一輪退換貨 happy path（推薦）
- 登入封測帳號，找一張 shipped/delivered 訂單
- 申請退貨 → admin 進後台核准 → 確認 3 封信都有（會員申請信、admin 新單信、核准信）
- 同樣流程驗 exchanges
- 若 email 沒發，檢查 `process.env.NODE_ENV=production` + SMTP 設定 + OrderSettings.notifications 都打開

### B. 補 policy_pages_settings migration（無關本 PR 但 prod log 在噴錯）
- 在 `src/migrations/` 新增 `<ts>_add_policy_account_returns_notice.ts`
- PRAGMA 冪等模式（先 SELECT `sqlite_master` 確認欄位不存在再 ALTER TABLE ADD COLUMN）
- 同時需要補 `policy_pages_settings_account_returns_notice_items` 子表
- deploy 後 `yes y | pnpm payload migrate`

### C. P4-3 orders 退換貨列表 / filter
- admin list 可以看到「這張訂單有申請過退貨嗎」
- Orders.ts 加 virtual field 或 `beforeRead` 去 find 對應 returns/exchanges
- customer 端 `/account/orders` 每張訂單旁若有申請過 → 顯示「已申請退貨」小徽章

### D. 客服 refund 自動化
- Returns.ts status → 'refunded' 時若 refundMethod='credit' → 自動寫 WalletTransactions（儲值金入帳）
- 或 refundMethod='original' 時若 paymentMethod=ecpay → 呼叫 ECPay 退款 API（有 ECPay invoice engine 可參考）

## Commit / deploy 規範重申

- 每個工作單元完成都要：
  1. commit + push + PR + merge
  2. `ssh root@5.223.85.14 /root/deploy-ckmu.sh`（含 migrate + build + restart + health check）
  3. 給接下去的提示詞
- prod migrate 卡 Payload "dev mode dirty" prompt：用 `yes y | pnpm payload migrate`
- 新 admin component 要跑 `pnpm generate:importmap` 再 commit
