# Session 25A — 庫存異動歷史 + 進貨單

> **Parent plan**：`docs/session-prompts/25-master-inventory-fulfillment-parallel-plan.md`
> **Worktree**：`../ckmu-stock-movements` on branch `feat/stock-movements`
> **起點 SHA**：main 最新（`git fetch && git pull` 確認 ≥ `009845b`）
> **平行性**：與 25B + 25D + 25E 完全平行；**25C 等本組 merged**

## 目標

把 Products.stock 從「直接覆寫的數字」升級成「異動 ledger 推算的派生數字」。每一筆 +/- 都記一列 StockMovement；所有現有 hook（Orders 扣庫存、Returns 退貨回流）都改走 `applyMovement()` service。同時補進貨單流程（PurchaseOrder + 收貨入庫 → 寫 movements）。

**為什麼最先**：25C 盤點單必須寫 StockMovements；25B 出貨工作流不直接改 stock 但會在「批次出貨」時觸發既有的 status→shipped hook，未來 hook 改走 service 也要先有 service。

## Non-goals（本組不做）

- 多倉位（單倉 SKU 一個 stock 數字）
- 供應商 collection（PurchaseOrder.supplier 用 text 欄位先撐）
- 採購建議自動算量
- 商品進銷存報表（25E 做總量，明細留給 v2）

## 檔案變更清單

### 新增

#### 1. `src/collections/StockMovements.ts` — slug `stock-movements`

底層 ledger，所有 stock 變化的 single source of truth。**append-only**（admin 也禁止刪改，只能新增 reverse 抵銷）。

**欄位**：
- `product` (relationship → products, required)
- `variantSku` (text, optional) — null 代表整體 stock；有值代表 variants[].stock
- `delta` (number, required) — 正數加、負數減，可正可負
- `type` (select, required) — 異動原因：
  - `purchase`（採購進貨）
  - `sale`（賣出）
  - `return`（退貨回流）
  - `exchange`（換貨換出）
  - `adjustment`（盤點調整 / 25C 用）
  - `manual`（後台手動修正）
  - `damage`（損耗）
  - `transfer_out` / `transfer_in`（保留給未來多倉位）
- `refType` (select, optional) — `order` | `return` | `exchange` | `purchase_order` | `stock_take`
- `refId` (text, optional) — 對應 doc id（不用 relationship 因為 polymorphic）
- `note` (textarea, optional)
- `operator` (relationship → users, admin.readOnly) — 由 `req.user` 自動填
- `balanceAfter` (number, admin.readOnly) — hook 自動寫，異動後該 SKU 的累計庫存

**Access**：
- `read`：admins
- `create`：admins（手動修正用，業務 hook 走 `payload.create()` overrideAccess）
- `update` / `delete`：**全擋**（append-only，不可改不可刪）

**Hooks**：
- `beforeChange (operation: 'create')`：
  - 若 `req.user`，把 user.id 寫到 `operator`
  - 算 `balanceAfter`：`(latestMovementForSameSku.balanceAfter ?? currentStock) + delta`

**admin**：
- `useAsTitle: 'id'`
- `defaultColumns: ['createdAt', 'product', 'variantSku', 'type', 'delta', 'balanceAfter', 'operator', 'refType']`
- `group: '商品管理'`
- `description: '所有庫存進出明細（append-only ledger，禁止編輯/刪除）'`
- `listSearchableFields: ['variantSku', 'note', 'refId']`

#### 2. `src/collections/PurchaseOrders.ts` — slug `purchase-orders`

進貨單 / 採購單。後台填單 → 收貨入庫 → 自動寫 `StockMovements (type='purchase')`。

**欄位**：
- `poNumber` (text, unique, required) — 預設 hook 自動產生 `PO-YYYYMMDD-NNN`
- `supplier` (text, required) — 先用 text，未來抽 Suppliers collection
- `status` (select, required, default `draft`)：
  - `draft`（草稿，可編輯）
  - `ordered`（已下單給供應商，等到貨）
  - `partial_received`（部分到貨）
  - `received`（全部到貨，自動寫 movements）
  - `cancelled`
- `expectedAt` (date)
- `receivedAt` (date, admin.readOnly) — `status='received'` 時 hook 自動填
- `items` (array, required)：
  - `product` (relationship → products, required)
  - `variantSku` (text, optional) — 對應 variants[].sku
  - `qtyOrdered` (number, required, min 1)
  - `qtyReceived` (number, default 0, min 0)
  - `costPrice` (number, optional) — 進貨成本，先記不上首頁
- `subtotalCost` (number, admin.readOnly) — hook 算 `Σ qtyReceived * costPrice`
- `note` (textarea)
- `attachments` (relationship → media, hasMany, optional) — 進貨單 PDF/收據照
- `createdBy` (relationship → users, admin.readOnly) — req.user 自動

**Access**：admins only 全部

**Hooks**：
- `beforeChange (create)`：
  - poNumber 留空時自動產 `PO-${YYYYMMDD}-${串號}`（`payload.find` count today 的 +1）
  - 寫 createdBy = req.user.id
- `beforeChange (update)`：
  - 若 `status` 從非 `received` → `received`：
    - 對每個 `items[]` 跑 `applyMovement({ product, variantSku, delta: qtyReceived, type: 'purchase', refType: 'purchase_order', refId: doc.id, note: 'PO ${poNumber} 收貨入庫', operator: req.user.id })`
    - `data.receivedAt = new Date()`
  - 若 `status` 從 `received` → 任何（**禁止**，throw `APIError('已收貨入庫的進貨單不可改狀態')`）

**admin**：
- `useAsTitle: 'poNumber'`
- `defaultColumns: ['poNumber', 'supplier', 'status', 'expectedAt', 'receivedAt', 'subtotalCost']`
- `group: '商品管理'`
- `description: '採購進貨單；status=received 時自動寫入庫存異動'`

### 修改

#### 3. `src/lib/inventory/movements.ts` — 新建 service module

```ts
// 統一所有業務 hook 寫 movement 的入口
import type { Payload, PayloadRequest } from 'payload'

export type ApplyMovementInput = {
  productId: string | number
  variantSku?: string | null
  delta: number
  type: 'purchase' | 'sale' | 'return' | 'exchange' | 'adjustment' | 'manual' | 'damage'
  refType?: 'order' | 'return' | 'exchange' | 'purchase_order' | 'stock_take'
  refId?: string
  note?: string
  operatorId?: string | number
}

export async function applyMovement(payload: Payload, input: ApplyMovementInput, req?: PayloadRequest) {
  // 1. 寫 stock-movements（balanceAfter 由該 collection 的 hook 算）
  // 2. 用 payload.update 同步 products.stock 或 variants[i].stock（避免 stale）
  // 3. 在 transaction context 跑（用 req?.transactionID）
}

// 反查某 SKU 當前庫存（從 movements 推算 vs products.stock 取大／取小都不對；
// 規約：products.stock 是 cache，movements 是 truth；rebuild 時讀 movements）
export async function rebuildStock(payload: Payload, productId: string | number) {
  // dev/admin 工具：從 movements 重算 products.stock；offline reconcile
}
```

實作要點：
- 用 `payload.create({ collection: 'stock-movements', overrideAccess: true, data: {...}, req })`
- 同步 update Products：先 find 該 product，若 variantSku 給了則改 `variants[i].stock`，否則改頂層 `stock`；丟回 update
- transaction 用 `req?.transactionID` 串起

#### 4. `src/collections/Orders.ts` — 改現有 beforeChange 庫存扣減

目前 [Orders.ts:144-174](src/collections/Orders.ts) 自己寫 stock 計算 + atomic 扣減。改成：

```ts
// 在 status pending → processing 或 create with status processing 時扣
// 對每個 line item 跑 applyMovement(payload, { ..., type: 'sale', refType: 'order', refId: doc.id })
```

**保留**現有的庫存不足 throw 邏輯（applyMovement 內部負庫存就 throw）。

#### 5. `src/collections/Returns.ts` — 新增 afterChange 庫存回流

當 Return.status → `received`（退貨已收貨入倉）：
```ts
// 對每個退貨 item：applyMovement(payload, { ..., type: 'return', refType: 'return', refId: doc.id, delta: +qty })
```

#### 6. `src/collections/Exchanges.ts` — 新增 afterChange 庫存交換

當 Exchange.status → `received`（舊品收回）+ `shipped`（新品出貨）：
- 收回：`applyMovement(..., type: 'return', delta: +qty)`
- 出貨：`applyMovement(..., type: 'exchange', delta: -qty)`

#### 7. `src/payload.config.ts`

加 import + 註冊 StockMovements + PurchaseOrders。

### Migration

#### 8. `src/migrations/20260428_000000_add_stock_movements_and_pos.ts`

PRAGMA pattern（參考 `20260418_220000_add_login_attempts.ts`）：

- 建 `stock_movements` 表（所有欄位）
- 建 `stock_movements_rels`（product / operator）
- 建 `purchase_orders` 表
- 建 `purchase_orders_items`（array sub-table，Payload v3 conventions）
- 建 `purchase_orders_items_rels`（product）
- 建 `purchase_orders_rels`（attachments / createdBy）
- `payload_locked_documents_rels` 加 `stock_movements_id INTEGER`, `purchase_orders_id INTEGER`（memory `feedback_prod_schema_sync_on_new_collections.md`）

## 測試計畫

### 本地

1. `pnpm tsc --noEmit` 0 err
2. `pnpm payload migrate` 成功
3. `pnpm dev` →
   - `/admin/collections/stock-movements` 可開啟，list 為空
   - `/admin/collections/purchase-orders` → 新建一張 PO `PO-20260428-001`，supplier `測試廠商`，items 加一個 SKU、qty 10、cost 200 → 存檔（status=draft）
   - 改 status=ordered → 存檔，**stock 不變**
   - 改 qtyReceived=10、status=received → 存檔
   - 該商品 stock 應 +10；`/admin/collections/stock-movements` 應出現一筆 type=purchase delta=+10 balanceAfter=正確
4. 後台建一張 Order with line item qty=2，狀態 pending→processing → stock -2，stock-movements 有一筆 sale -2
5. 退貨：建 Return，items qty=1，status=received → stock +1，movements 有一筆 return +1
6. 嘗試直接編輯 stock-movements 一筆紀錄 → access 應拒；嘗試刪 → 應拒

### Prod Smoke Test

- `curl https://pre.chickimmiu.com/api/stock-movements?limit=5 -H 'cookie:...'` 應 200（admin auth）
- `/admin/collections/purchase-orders/create` 開得起來
- 用真商品建一張 PO（小量 +1）走完 received 流程 → 確認 stock + movement 都對

## 已知設計取捨

1. **append-only ledger 不准刪**：Shopline 標準做法。要修錯就新增反向 movement 抵銷（`type=manual`, delta=-X, note='抵銷 #ID'）。簡化 audit。
2. **products.stock 仍是欄位（不純粹 derived）**：保留 cache 性能（前台 PDP / 列表都讀這欄）；rebuild 工具可以從 movements 重算。
3. **單一倉位**：所有 movement 都歸同一個無名倉。未來加 `warehouseId` 欄位 + 預設值 'main' 即可擴。
4. **PurchaseOrder 的 status 流不可逆**：避免「已入庫又改回 ordered」造成 movement 對不上。要取消 received 的 PO 只能新建一張反向 PO。
5. **transaction 邊界**：Orders.beforeChange 已在 Payload 提供的 req.transactionID 內；applyMovement 接同一 req 即可。

## Merge + Deploy Checklist

- [ ] PR 標題：`feat(inventory): stock movements ledger + purchase orders`
- [ ] tsc/build 綠
- [ ] migration `pnpm payload migrate` 本地通
- [ ] 5 條本地測試全 PASS
- [ ] Squash merge 到 main
- [ ] `ssh root@5.223.85.14 /root/deploy-ckmu.sh`
- [ ] Prod smoke test 3 條 PASS
- [ ] `docs/session-prompts/25A-post-stock-movements.md` 寫 5 行總結
- [ ] 更新 `MEMORY.md`「25A Stock Movements + PO DONE — commit `<sha>`」
- [ ] **解封 25C**（master plan 表格勾起來）

## Context-exhausted handoff 模板

```markdown
## Session N+1 handoff（25A 未完）

已完成：
- [x] StockMovements.ts schema
- [x] PurchaseOrders.ts schema
- [x] Migration written
- [ ] inventory/movements.ts service（差）
- [ ] Orders.ts hook 改寫（差，**最危險，保守做**）
- [ ] Returns.ts / Exchanges.ts hook（差）
- [ ] payload.config.ts 註冊（差）

WIP commit: <sha> on feat/stock-movements
下 session 先：跑 migration 本地，建一個 PO 確認新 collections 正常，再動 Orders.ts hook（最危險區，先讀現有 144-174 邏輯做完整 mirror 再切換）。
```
