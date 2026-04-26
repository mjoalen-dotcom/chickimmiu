# Session 25 — 庫存履約缺口（P0+P1）平行分組計畫（Master）

> **起點 SHA**：`009845b`（main / `feat(themes): SiteThemes` PR #119）
> **產出日**：2026-04-27
> **背景**：Session 19 master 把「庫存 WMS / 報表 / RBAC」標 P2-P4「封測量小不需要」排除。封測一週後 user 重新權衡——把 **庫存 WMS + 履約工作流 + 基本報表** 拉回 P0+P1。對照 Shopline 14 主選單，本 session 列出 6 項（合併重疊後 5 組）。
> **與 Session 19 的關係**：19A coupons / 19B tax / 19C checkout settings / 19D promo trio 已 DONE。本批是 19 之後封測營運壓力暴露的真實缺口。

## 為什麼是這 5 組

對照 Shopline 後台主選單的功能 vs 本站 53 collections / 18 globals：

| Shopline 功能 | 本站現況 | 缺口 | 進本批？ |
|---|---|---|---|
| 商品管理 | ✅ Products + variants + Shopline XLSX 匯入 | （SKU 條碼/批次標籤等小工，封測夠用） | ❌ |
| 庫存異動歷史 | ❌ 直接覆寫 stock 數字 | **無法追蹤誰何時為何加減**，月底對不上帳 | ✅ 25A |
| 進貨單 / 採購 | ❌ | 補貨進來只能手改 stock，無單據 | ✅ 25A |
| 盤點單 | ❌ | 月底盤盈盤虧無系統紀錄 | ✅ 25C |
| 訂單管理 | ✅ Orders + carrier + trackingNumber + shipped email | 缺批次出貨/託運單 PDF/客戶追蹤 UI | ✅ 25B |
| 訂單 CSV/Excel 匯出 | ❌ | 會計月底/物流匯入要逐筆 copy | ✅ 25D |
| 顧客管理 | ✅ Users + Tier + Segment | — | ❌ |
| 行銷活動 | ✅ Coupons + AddOn + Gift + Bundle | — | ❌ |
| 內容管理 | ✅ Pages + BlogPosts | — | ❌ |
| 報表/分析 | ❌ Payload list view 看流水沒有彙總 | 不知今天賣多少、哪款熱、哪款低庫存 | ✅ 25E |
| 金流 | 🟡 ECPay PR #4 | （另案，PR-23） | ❌ |
| 物流 | ✅ ShippingMethods 8 條 + carrier 欄位 | 履約工作流缺（在 25B） | partial |
| 發票 | ✅ Invoices + InvoiceSettings | — | ❌ |
| 客服 | ✅ CustomerServiceTickets | — | ❌ |
| 多倉位 / 供應商 / RBAC | ❌ | P2/P3 規模做大才需要 | ❌ |

## 分組概觀

| 組別 | 範圍 | 主要新檔 | 可平行？ | 預計 PR 數 | 文件 |
|---|---|---|---|---|---|
| **25A** | 庫存異動 + 進貨單 | `StockMovements.ts`, `PurchaseOrders.ts` | ✅ 先跑（地基） | 1 | `25A-stock-movements.md` |
| **25B** | 批次出貨 + 物流追蹤 UI | `BulkShipAction.tsx` admin component, `/account/orders/[id]` 加 tracking 區 | ✅ 與 25A 平行（不動 stock） | 1 | `25B-fulfillment.md` |
| **25C** | 盤點單 | `StockTakes.ts` | ⚠️ **等 25A merged**（必須寫 StockMovements） | 1 | `25C-stock-takes.md` |
| **25D** | 訂單 CSV/XLSX 匯出 | Orders.ts 加 fieldMappings + endpoint | ✅ 完全獨立可平行 | 1 | `25D-order-export.md` |
| **25E** | 營運 Dashboard | `src/components/admin/Dashboard/*.tsx` + `/api/admin/dashboard-stats` | ✅ 完全獨立可平行 | 1 | `25E-dashboard.md` |

## 衝突矩陣

| | 25A | 25B | 25C | 25D | 25E |
|---|---|---|---|---|---|
| `Products.ts` | hooks 改 `stock` 改寫法（透過 service） | 不動 | 不動 | 不動 | 不動 |
| `Orders.ts` | beforeChange 扣庫存改走 service（**現有 logic 留著當 fallback**） | beforeChange 加 statusHistory 微改 | 不動 | 加 fieldMappings + endpoints | 不動 |
| `Returns.ts` | afterChange 加庫存回流 movement | 不動 | 不動 | 不動 | 不動 |
| `payload.config.ts` | +2 collection import | 不動 | +1 collection import | 不動 | 不動（admin.components 走 absolute path） |
| migrations | `20260428_000000_*` | 不動（已有欄位） | `20260429_000000_*` | 不動 | 不動 |
| admin/Dashboard | 不動 | 不動 | 不動 | 不動 | 改 `payload.config.ts` admin.components.beforeDashboard |

**可平行**：25A + 25B + 25D + 25E 四條同時跑 OK（`payload.config.ts` 25A 與 25E 都動，最後一條 trivial rebase）。
**必須等**：25C 等 25A merged 後再開（StockMovements 表必須先存在）。

## 推薦排程

如果你只能一次推一條：**25D → 25B → 25A → 25E → 25C**
- 25D 最快、純加工，5 分鐘讓會計開心
- 25B 解封測現實痛點（一張一張改 status）
- 25A 是地基但最大工程
- 25E 純讀，做完當作品展示用
- 25C 等 25A，最後做

如果你能開 4 worktree 平行：**第一波 25A + 25B + 25D + 25E 同時開**，依完成度逐個 merge；最後做 25C。

## 每組執行流程（沿用 Session 19 master，硬性 P0）

1. **本地開發**
   - `git fetch origin && git checkout main && git pull`（確認 ≥ `009845b`）
   - `git worktree add ../ckmu-<group> -b feat/<branch> main`
   - 改檔 → `pnpm tsc --noEmit` 0 err → `pnpm build` 綠
   - Migration 用 PRAGMA pattern（參考 [`20260418_220000_add_login_attempts.ts`](src/migrations/20260418_220000_add_login_attempts.ts)）
   - 本地 `pnpm dev` 跑 ≥ 1 條 happy path

2. **Merge to main**
   - Commit → push → 開 PR
   - Conflict：`git rebase main` 解掉
   - Squash merge

3. **Prod deploy**（user 授權 SSH，memory `feedback_prod_delegated.md`）
   - `ssh root@5.223.85.14 /root/deploy-ckmu.sh`
   - 自動跑 `git pull` + `pnpm install` + `pnpm payload migrate` + `pnpm build` + `pm2 restart`
   - 任何 non-200 abort 要先解才收工

4. **線上測試**
   - 跑各組 Smoke Test Checklist
   - bug 同 session 修，不留半成品

5. **收尾**
   - 寫 `25X-post-<group>-handoff.md`
   - 更新 `MEMORY.md`「25X DONE — commit `<sha>`」
   - 更新本檔表格勾起來

## Non-goals（本批不做，留 P2+）

- **多倉位 / 倉與倉調撥**（線上倉只有一個，沒實體店）
- **供應商管理 / 採購建議自動算量**（封測量太小，憑經驗手動下單）
- **POS / 門市同步**（沒實體店）
- **RBAC 細粒度權限**（admin 只有 1-2 人）
- **進階分析 / BI**（25E dashboard 只做 4 個 KPI 卡 + 2 張表，BI 等規模做大）
- **退貨時重組箱包/退原料拆解**（退貨進倉統一回原 SKU stock）

## 起手式（每組 session 開頭必跑）

```bash
# 1. 同步 main
git fetch origin && git checkout main && git pull

# 2. 確認起點
git log --oneline -1   # ≥ 009845b

# 3. 建 worktree
git worktree add ../ckmu-<group> -b feat/<branch> main
cd ../ckmu-<group>

# 4. 讀該組文件
cat docs/session-prompts/25<X>-<group>.md
```

## Session 19 與 25 的差異

19 是「補 Shopline 已上市的 P0 缺口（coupons/tax/promo）」——**面對顧客**的缺口。
25 是「補 Shopline 已上市的後台營運缺口（stock/fulfillment/report）」——**面對自己團隊**的缺口。

兩批合計後，本站才算把 Shopline P0+P1 真正全覆蓋。
