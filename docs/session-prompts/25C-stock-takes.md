# Session 25C — 盤點單

> **Parent plan**：`docs/session-prompts/25-master-inventory-fulfillment-parallel-plan.md`
> **Worktree**：`../ckmu-stock-takes` on branch `feat/stock-takes`
> **起點 SHA**：必須**等 25A merged**（StockMovements 表存在）
> **平行性**：與 25B / 25D / 25E 平行可，與 25A **序列**

## 目標

月底 / 季底盤點：admin 對全部商品（或某 category）拉一張盤點單 → 系統列出每個 SKU 系統存量 → admin 填實際數 → 確認後產生「盤盈盤虧」差額，自動寫成 `StockMovements (type='adjustment')` 並更新 Products.stock 對齊實際。

**為什麼要做**：賣久了 stock 會漂移（顧客現場退貨改入退貨倉、配貨少裝、老鼠咬毀…），需要週期性對齊。沒這個系統，要不就全憑 admin 直接改 stock 數字（無 audit trail），要不就停業半天手動處理。

## 前置依賴

- ✅ 25A merged（`stock-movements` collection、`applyMovement()` service 都已存在）

## Non-goals

- 條碼掃槍 / 手持盤點機介面（封測量小用 admin web）
- 多人並發盤點 lock（同一張盤點單同時兩個 admin 改的競態，現實少見，UI 警告即可）
- 部分盤點 → 多次提交（一張單一次提交，要再盤就開新單）

## 檔案變更清單

### 新增

#### 1. `src/collections/StockTakes.ts` — slug `stock-takes`

**欄位**：
- `takeNumber` (text, unique) — 自動產生 `ST-YYYYMMDD-NNN`
- `name` (text, required) — admin 自填，如「2026-04 月底盤點」
- `status` (select, required, default `draft`)：
  - `draft`（草稿，可編輯 items）
  - `confirmed`（已確認，鎖定編輯，自動寫 movements；**不可逆**）
  - `cancelled`（取消，不寫 movements）
- `scopeType` (select, required, default `all`)：
  - `all`（全站）
  - `category`（單一 category）
  - `manual`（手動指定 SKU 清單）
- `scopeCategory` (relationship → categories, optional, condition: scopeType='category')
- `items` (array, required)：
  - `product` (relationship → products, required)
  - `variantSku` (text, optional)
  - `systemQty` (number, admin.readOnly) — snapshot 當前 stock
  - `actualQty` (number, required, min 0) — admin 填實際盤點數
  - `delta` (number, admin.readOnly) — `actualQty - systemQty`，hook 算
  - `reason` (text, optional) — 如「破損」「贈送」「失竊」
- `confirmedAt` (date, admin.readOnly)
- `confirmedBy` (relationship → users, admin.readOnly)
- `note` (textarea)
- `createdBy` (relationship → users, admin.readOnly)

**Hooks**：
- `beforeChange (create)`：
  - takeNumber 自動產
  - createdBy = req.user.id
  - 若 `scopeType='all'` 或 `category`、items 為空 → 自動 populate items：
    - find products（all 或 by category），對每個 SKU snapshot systemQty 進 items
    - 注意 variants：每個 variant 一行
- `beforeChange (update)`：
  - 對每筆 item 算 `delta = actualQty - systemQty`
  - 若 `status` 從 `draft` → `confirmed`：
    - 對每個 `delta !== 0` 的 item 跑 `applyMovement(payload, { product, variantSku, delta, type: 'adjustment', refType: 'stock_take', refId: doc.id, note: 'ST ${takeNumber}: ${reason ?? ''}', operatorId: req.user.id })`
    - `data.confirmedAt = new Date()`、`data.confirmedBy = req.user.id`
  - 若 `status` 從 `confirmed` → 任何 → throw（不可逆，要錯需新建反向盤點單）
  - 若 `status` 從 `confirmed` 試圖改 items → throw

**Access**：admins only

**admin**：
- `useAsTitle: 'name'`
- `defaultColumns: ['takeNumber', 'name', 'status', 'scopeType', 'createdAt', 'confirmedAt', 'createdBy']`
- `group: '商品管理'`
- `description: '週期性盤點，confirmed 後自動寫入庫存異動（不可逆）'`

#### 2. `src/components/admin/StockTakeWizard.tsx` — 建單體驗增強

掛 `admin.components.beforeListTable`（StockTakes collection）。

提供 wizard：
- Step 1：選 scopeType + 名稱 → 點「建立草稿並 populate」
- Step 2：列出 items 表（virtualized 因為可能 500+ SKU）：每行顯示 product name / variant / systemQty / 一個 input for actualQty（預設 = systemQty） / delta 即時算 / reason input
- 「確認盤點」按鈕 → 顯示 summary（盤盈 N 件、盤虧 M 件、不變 X 件）→ 二次確認 → confirm

或最簡：直接靠 Payload 預設 form（admin 點「新建」→ 自動 populate items → 一格一格填 actualQty）。**第一版用 Payload 預設**，wizard 列為 v2。

### Migration

#### 3. `src/migrations/20260429_000000_add_stock_takes.ts`

PRAGMA pattern：
- `stock_takes` 表
- `stock_takes_items` 子表（array 慣例）
- `stock_takes_items_rels`（product）
- `stock_takes_rels`（scopeCategory / confirmedBy / createdBy）
- `payload_locked_documents_rels` 加 `stock_takes_id INTEGER`

### `src/payload.config.ts`

加 import + 註冊 StockTakes。

## 測試計畫

### 本地

1. `pnpm tsc --noEmit` 0 err
2. `pnpm payload migrate` 通
3. `pnpm dev` →
   - 先建一張 PO（25A）入庫 5 件 SKU `TEST-001`，stock = 5
   - 後台 `/admin/collections/stock-takes/create` → name=「測試盤點」、scopeType=manual → 加一個 item product=TEST 商品 / variantSku=TEST-001 / systemQty 自動填 5 / actualQty=3 / reason=「破損」 → 存檔 status=draft
   - 改 status=confirmed → 存檔
   - 預期：
     - StockTake.confirmedAt 有值
     - 該 SKU stock = 3
     - StockMovements 出現一筆 type='adjustment' delta=-2 refType='stock_take' refId=該 take id note 含 takeNumber + reason
4. 試圖把 confirmed 的 take 改回 draft → 應 throw
5. 試圖刪除 confirmed take 的 items → 應擋

### Prod Smoke Test

- 對 1-3 個真 SKU 走完盤點流程
- 確認 `/admin/collections/stock-movements` 對應 adjustment 紀錄
- 確認 PDP 的 stock 數字反映

## 已知設計取捨

1. **不可逆設計**：盤點 confirmed 後就是 source of truth；要修錯只能新建一張反向盤點單。比 Shopline 的 reopen 簡單但 audit 更乾淨。
2. **populate items 第一版用同步**：scopeType=all 對 500 SKU 的 store 可能 timeout；超過 200 SKU 的話切成 background job。先寫同步版，封測量還小。
3. **variants 一行一筆**：盤點是 per-SKU，所以 variants 一定要展開，不是 per-product。
4. **不做 partial received**：一張盤點單一次完成；現場盤一半要中斷？存 draft 隔天接著。

## Merge + Deploy Checklist

- [ ] PR 標題：`feat(inventory): stock takes with append-only adjustments`
- [ ] tsc/build 綠
- [ ] migration 通
- [ ] 5 條本地測試全 PASS
- [ ] Squash merge
- [ ] prod deploy
- [ ] `docs/session-prompts/25C-post-stock-takes.md`
- [ ] 更新 MEMORY「25C Stock Takes DONE — commit `<sha>`」

## Context-exhausted handoff 模板

```markdown
## Session N+1 handoff（25C 未完）

已完成：
- [x] StockTakes.ts schema + populate hook
- [x] Migration written
- [ ] confirm hook 寫 movements（差，**最關鍵**，跟 25A 的 applyMovement 對接）
- [ ] payload.config.ts（差）

WIP commit: <sha> on feat/stock-takes
下 session 先：本地建一張 draft → 確認 populate items 對；接做 confirm hook；對 25A 的 applyMovement signature 必須 match。
```
