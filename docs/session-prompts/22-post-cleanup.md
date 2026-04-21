# 接下去的提示詞（Session post-cleanup，2026-04-21）

## Context

承接 [21-post-returns-ux.md](./21-post-returns-ux.md)「已知但未處理」。短 session 做三件雜事收尾：

### 已完成（2026-04-21 sad-leavitt session）

1. **policy_pages_settings migration 驗證** — 不用改 code。`20260422_200000_fix_policy_returns_notice_title.ts` 早在 PR [#83](https://github.com/mjoalen-dotcom/chickimmiu/pull/83) (`04f3352`) 就 deploy 執行。prod DB 有該欄位（default `'退換貨須知'`）、`payload_migrations` 有該筆、`/api/globals/policy-pages-settings` → 200。原 handoff 寫的當下 prod 尚未跑到，後續 deploy 自動補上。
2. **`.claude/worktrees/returns-ux/` 清理** — `rm -rf` 一次成功，file lock 已釋放。
3. **Handoff doc 更新** — 本 session PR [#89](https://github.com/mjoalen-dotcom/chickimmiu/pull/89)（docs-only，不需 deploy），`3261088` on `claude/sad-leavitt-1d2e99` rebase 過最新 main（`bc2aabe`）。

### 清理也做完了（使用者授權後）

1. **prod DB `payload_migrations` 去重** — 4 筆 dup row（batch=11 下 style_submissions/game_rooms/votes/wishes 的 id 19-22）刪除完成。Backup `data/chickimmiu.db.pre-dedupe-20260421-085336`。Table 現 26 row / 26 distinct name。Prod smoke 3/3 endpoints 200。
2. **3 個 merged remote branch 已刪** — `feat/returns-ux`（PR #85）/ `docs/handoff-post-returns-ux`（PR #86）/ `feat/checkout-meetup-and-hct`（PR #18）。

---

## 建議下一步（挑一）

### A. 實測一輪退換貨 happy path（最推薦，接 PR #85）
- 登入封測帳號，找一張 shipped/delivered 訂單
- 申請退貨 → admin 進後台核准 → 確認 3 封信都有（會員申請信、admin 新單信、核准信）
- 同樣流程驗 exchanges
- 若 email 沒發，檢查 `NODE_ENV=production` + SMTP 設定 + OrderSettings.notifications 都打開

### B. P4-3 orders 退換貨列表 / filter
- admin list 可以看到「這張訂單有申請過退貨嗎」
- Orders.ts 加 virtual field 或 `beforeRead` 去 find 對應 returns/exchanges
- customer 端 `/account/orders` 每張訂單旁若有申請過 → 顯示「已申請退貨」小徽章

### C. 客服 refund 自動化
- Returns.ts status → 'refunded' 時若 refundMethod='credit' → 自動寫 WalletTransactions（儲值金入帳）
- 或 refundMethod='original' 時若 paymentMethod=ecpay → 呼叫 ECPay 退款 API（有 ECPay invoice engine 可參考）

### D. 其他 Shopline-gap backlog
- 19D Promo trio 上線後的 AB：CouponStacking 邏輯（`applyPromotion` 目前每種 promo 彼此獨立計算，order 層沒總折扣上限）
- 稅率多幣別（19B 只 TWD）
- Checkout v2（19C 已經接，但 OrderNotifications 可以再細分觸發）

---

## Commit / deploy 規範重申

- 每個工作單元完成都要：
  1. commit + push + PR + merge（gh pr merge --squash --delete-branch）
  2. `ssh root@5.223.85.14 /root/deploy-ckmu.sh`（含 migrate + build + restart + health check）
  3. 寫接下去的提示詞（本文這種）
- prod migrate 卡 Payload "dev mode dirty" prompt：`yes y | pnpm payload migrate` 或直接跑 deploy-ckmu.sh（已 auto-accept，見 PR #82）
- 新 admin component 要跑 `pnpm generate:importmap` 再 commit
- 開始工作前 **必先** `git log --oneline -10 origin/main` + 檢查 parallel worktree list，避免被別 session 搶先做
- destructive ops（prod DB mutation、`git push --delete`、`rm -rf` prod 路徑）要在訊息裡明確授權，別在 generic task list 裡面 hide 進去

## 現況摘要（2026-04-21 session 結束）

- **Branch**：`claude/sad-leavitt-1d2e99` at `3261088`（rebased on `bc2aabe`）
- **PR 開著**：[#89](https://github.com/mjoalen-dotcom/chickimmiu/pull/89)（docs-only，待 merge）
- **Prod HEAD**：`bc2aabe` + PR #89 尚未 merge
- **Working tree**：clean
- **Worktree list** (10 個)：sad-leavitt + 其他並行 session 的 ckmu-auth-hardening / ckmu-branding / ckmu-treasure-schema / beautiful-kowalevski / p4-1-email / p4-missing-pages / silly-hamilton / sleepy-banach — 都不是本 session 建的
