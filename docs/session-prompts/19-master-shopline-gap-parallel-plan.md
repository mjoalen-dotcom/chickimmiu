# Session 19 — Shopline Gap 平行分組計畫（Master）

> **起點 SHA**：`38bd277`（main / prod 同步）
> **產出日**：2026-04-20
> **背景**：上 session 用 Claude in Chrome 掃過 Shopline 後台 14 主選單，比對本站 40 collections / 15 globals，列出 P0-P4 缺口。此文件把 P0 + P1 拆成 4 組**可平行**的工作單元，各組獨立 worktree / 獨立 PR / 獨立 prod deploy。

## 分組概觀

| 組別 | 範圍 | 主要新檔 | 可平行？ | 預計 PR 數 | 文件 |
|---|---|---|---|---|---|
| **19A** | Coupons 優惠券（P0-1）| `Coupons.ts`, `CouponRedemptions.ts` | ✅ 可先跑 | 1 | `19A-coupons.md` |
| **19B** | 稅金 + 發票整合（P0-2）| `TaxSettings` global | ✅ 可平行 19A/19C | 1 | `19B-tax.md` |
| **19C** | 結帳設定 + 訂單設定（P0-3 + P0-4）| `CheckoutSettings` + `OrderSettings` global | ✅ 可平行 19A/19B | 1 | `19C-checkout-order-settings.md` |
| **19D** | 促銷三件套（P1）：加購品 / 贈品 / 組合商品 | `AddOnProducts`, `GiftRules`, `Bundles` | ⚠️ **等 19A merged** 再開（共用 Orders.ts + cart） | 1 | `19D-promo-trio.md` |

## 衝突矩陣（審過才分組）

| | 19A Coupons | 19B Tax | 19C Checkout | 19D Promo |
|---|---|---|---|---|
| `Orders.ts` | 加 `discountAmount`, `couponCode`, `couponId` | 加 `taxAmount`, `taxRate`, `subtotalExcludingTax` | **不動** | 加 `lineItems.bundleRef`, `lineItems.isGift`, `lineItems.isAddOn` |
| `Products.ts` | 不動 | 加 `taxCategory` select | 不動 | 加 `bundledItems`, `addOnCandidates` relationships |
| `cartStore.ts` + cart API | 加 `apply-coupon` route | 不動 | 不動 | 加 add-on auto-insert + gift auto-insert + bundle expansion |
| `checkout/page.tsx` | 加優惠碼 input | 顯示稅額 breakdown | 改讀 CheckoutSettings | 加購品 upsell UI |
| `GlobalSettings.ts` | 不動 | 不動 | **拆欄位到新 global** | 不動 |
| `payload.config.ts` | 加 import x2 | 加 import x1 | 加 import x2 | 加 import x3 |
| migrations | `20260421_000000_*` | `20260421_100000_*` | `20260421_200000_*` | `20260422_000000_*` |

**可平行組**：19A + 19B + 19C（三條同時跑 OK，`payload.config.ts` 合併 merge 時最後一條 rebase 處理 trivial conflict）。
**必須等**：19D 必須等 **19A merged** 才開，因為 cart 邏輯 + Orders.lineItems 兩組都大改。

## 每組執行流程（硬性 P0，禁止省略）

所有組別都**必須**完成以下流程才算收工（memory `feedback_session_handoff_and_deploy.md`）：

1. **本地開發**
   - 從 `main` 最新 commit 建 worktree：`git worktree add ../ckmu-<group> -b feat/<group-branch>`
   - 改檔 → `pnpm tsc --noEmit` 0 err → `pnpm build` 綠
   - 寫 migration 用 PRAGMA 冪等 pattern（參考 `src/migrations/20260418_220000_add_login_attempts.ts`）
   - 本地跑 `pnpm dev` + 瀏覽器手動驗證至少 1 個 happy path

2. **Merge to main**
   - Commit → push → 開 PR 到 `main`
   - 若其他組已先 merge 造成 conflict：`git rebase main` 解掉再 push
   - Squash merge（專案慣例）

3. **Prod deploy**（使用者授權 SSH 跑，memory `feedback_prod_delegated.md`）
   - `ssh root@5.223.85.14 /root/deploy-ckmu.sh`
   - Script 會自動跑 `git pull` → `pnpm install` → `pnpm payload migrate` → `pnpm build` → `pm2 restart`
   - 觀察 script exit code；任何 non-200 abort 要先解決再收工

4. **線上測試**
   - 在 `pre.chickimmiu.com` 跑各組 Smoke Test Checklist（見各組文件）
   - 若有 bug：**同 session** 修掉再走步驟 2-3
   - 不要留半成品

5. **收尾**
   - 寫「19X-post-<group>-handoff.md」簡短記錄（跑了什麼 / 有沒有坑）
   - 更新 `docs/ROADMAP.md` 對應項目勾起來
   - 更新 `MEMORY.md` 加一行「19X <group> DONE — commit `<sha>`」

## 換 session 規則

若單一 conversation context 用到 ~70% 還沒做完：

1. 把目前 WIP 的所有檔案 commit（即使沒全好也標 `wip:` prefix），push 到 branch
2. 在 PR description 寫「context-exhausted；下 session 從 commit `<sha>` 接」
3. 更新該組的 `19X-<group>.md` 在最下方加 "Session N+1 handoff" section，寫清楚：
   - 已完成哪些檔
   - 剩下哪些檔還沒改
   - 有遇到什麼坑 / 已試過哪些失敗路
   - 下 session 應該先做什麼（最小可 merge 單位）

## 不做的事（scope control）

- **P2 庫存 WMS（進貨/盤點/調撥/供應商）** — 等封測結束後另案。封測量小不需要。
- **P3 報表 / Analytics Dashboard** — 先用 Payload 內建 list view 夠用；等資料量大再做。
- **P4 RBAC / 商品關鍵字 / 一頁商店 / 自訂表單** — 非 MVP。
- **SHOPLINE Live / 貼文銷售 / 社群導購機器人 / Amazon / Smart OMO** — Shopline 專屬功能，不複製。

## 起手式（每組 session 開頭必跑）

```bash
# 1. 同步 main
git fetch origin && git checkout main && git pull

# 2. 建 worktree（改 <group> / <branch>）
git worktree add ../ckmu-<group> -b feat/<branch> main

cd ../ckmu-<group>

# 3. 確認起點 SHA
git log --oneline -1  # 應該是 38bd277 或更新

# 4. 讀該組文件
cat docs/session-prompts/19X-<group>.md
```
