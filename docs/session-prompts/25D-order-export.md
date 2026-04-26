# Session 25D — 訂單 CSV / Excel 匯出

> **Parent plan**：`docs/session-prompts/25-master-inventory-fulfillment-parallel-plan.md`
> **Worktree**：`../ckmu-order-export` on branch `feat/order-export`
> **起點 SHA**：main 最新（≥ `009845b`）
> **平行性**：與 25A / 25B / 25C / 25E 完全平行；最小工程量，可一晚搞完

## 目標

讓 admin 可以從 `/admin/collections/orders` 一鍵下載當前篩選結果的 CSV / Excel，給：
- 會計月底對帳
- 物流商批次匯入
- 報稅 / 發票統一發票批次
- Excel pivot 自己玩

**為什麼 1 晚搞完**：[`createExportEndpoint`](src/endpoints/importExport.ts:25) 已存在且通用，[Products.ts](src/collections/Products.ts) 已示範用法。本組只是把 fieldMappings 列出 + 接上 endpoints 陣列。

## Non-goals

- 訂單匯入（**不做**：訂單應由前台/admin 手建，不該從 CSV 灌；變動歷史不可重建）
- 報表 PDF / 對帳單（25E dashboard 處理彙總；明細靠這個 CSV）
- 自訂欄位 / 客製化匯出範本（v1 給固定一套；admin 嫌欄位多手動隱藏）
- 篩選器升級（用 Payload list view 既有 query string，跟 export 共用 where）

## 檔案變更清單

### 修改

#### 1. `src/collections/Orders.ts`

加 fieldMappings 定義（檔頂或 import 自 helper）：

```ts
const orderFieldMappings: FieldMapping[] = [
  // 識別
  { key: 'orderNumber', label: '訂單編號' },
  { key: 'createdAt', label: '建立時間' },
  // 顧客
  { key: 'user.email', label: '顧客 Email' },
  { key: 'user.name', label: '顧客姓名' },
  { key: 'shippingAddress.recipient', label: '收件人' },
  { key: 'shippingAddress.phone', label: '收件電話' },
  { key: 'shippingAddress.address', label: '收件地址' },
  // 金額
  { key: 'subtotal', label: '商品小計' },
  { key: 'shippingFee', label: '運費' },
  { key: 'codFee', label: 'COD 手續費' },
  { key: 'discountAmount', label: '優惠折抵' },
  { key: 'taxAmount', label: '稅額' },
  { key: 'total', label: '訂單總額' },
  // 付款
  { key: 'paymentMethod', label: '付款方式' },
  { key: 'paymentStatus', label: '付款狀態' },
  { key: 'paymentTransactionId', label: '金流交易編號' },
  // 物流
  { key: 'shippingMethod.code', label: '配送方式' },
  { key: 'carrier', label: '物流商' },
  { key: 'trackingNumber', label: '託運單號' },
  // 狀態
  { key: 'status', label: '訂單狀態' },
  // 優惠
  { key: 'couponCode', label: '優惠碼' },
  // 備註
  { key: 'customerNote', label: '顧客備註' },
  { key: 'adminNote', label: '管理備註' },
  // line items 不適合扁平 → v2 另開 line-items 匯出
]
```

加到 collection 的 endpoints：

```ts
endpoints: [
  // ...既有的
  createExportEndpoint('orders', orderFieldMappings),
  // 注意：不加 createImportEndpoint
],
```

加 admin component（Products 已有 ImportExportPanel pattern，照搬一個 OrderExportButton）：

```ts
admin: {
  components: {
    beforeListTable: [
      // ...既有的
      { path: '@/components/admin/OrderExportButton' },
    ],
  },
}
```

#### 2. `src/components/admin/OrderExportButton.tsx`

簡單 button：
```tsx
'use client'
export default function OrderExportButton() {
  return (
    <div className="flex gap-2 my-3">
      <a href="/api/orders/export?format=csv" download className="btn">下載 CSV</a>
      <a href="/api/orders/export?format=xlsx" download className="btn">下載 Excel</a>
    </div>
  )
}
```

進階版（v2）：讀當前 list URL 的 query string，append 到 export URL，讓篩選結果也能匯出。**v1 只匯出全部**（`createExportEndpoint` 內 `pagination: false`），先驗最小可用。

### Optional 加碼（同 PR 一併做）

#### 3. `src/lib/orders/lineItemsExportHelper.ts`（v2 候選）

做「逐 line-item 匯出」（一張 5 件商品的訂單變 5 行 CSV），方便 pivot 算商品銷量。**v1 不做**，只列在文件提醒未來想接這條時的入口。

## 測試計畫

### 本地

1. `pnpm tsc --noEmit` 0 err
2. `pnpm dev` →
   - 後台 `/admin/collections/orders` 列表上方應出現「下載 CSV / 下載 Excel」按鈕
   - 點 CSV → 下載一個 .csv，用 Excel 開應正常顯示中文（importExport.ts 內已加 UTF-8 BOM 防亂碼，**驗一下確實有**）
   - 點 Excel → 下載 .xlsx，Excel 開正常
   - 欄位順序與 fieldMappings 一致；user.email / shippingAddress.recipient 等 dot-notation 應抓到對應值
3. 沒登入 admin 直接打 `/api/orders/export` → 應 403

### Prod Smoke Test

- admin 後台真下載一份匯出 → Excel 開無亂碼、收件人/電話/地址有值
- 試 csv 與 xlsx 兩種

## 已知設計取捨

1. **不做 import**：訂單沒有 idempotent key、優惠抵扣、庫存扣減，這些都不可重來。匯入會搞壞 audit。
2. **dot-notation 限制**：[`importExport.ts`](src/endpoints/importExport.ts) 是否支援 `user.email`？需檢查 helper code；不支援的話本組要小修加 `lodash.get` style 取值。
3. **list view filter 不傳給 export（v1）**：admin 抱怨可在 v2 加 `?where=` query string。
4. **line items 平鋪**：訂單有 N 個商品時 CSV 怎麼放？v1 直接不放 line items，留給 v2 或另一個 endpoint。

## 預先檢查（動工前 5 分鐘）

打開 [`src/endpoints/importExport.ts`](src/endpoints/importExport.ts)，確認：
- [ ] 是否支援 dot-notation key（找 `key.split('.')` 或 `lodash.get`）；不支援 → 本組加
- [ ] CSV 是否有 UTF-8 BOM（Excel 開中文不亂碼）
- [ ] xlsx 用的 `ExcelJS` 是否設定 column widths（沒設 admin 開要拉到死）

## Merge + Deploy Checklist

- [ ] PR 標題：`feat(orders): CSV/Excel export endpoint + admin button`
- [ ] tsc/build 綠
- [ ] CSV/XLSX 本地下載驗過
- [ ] Squash merge
- [ ] prod deploy
- [ ] 真匯一筆 prod 訂單下來檢查
- [ ] `docs/session-prompts/25D-post-order-export.md`（簡短 3 行）
- [ ] 更新 MEMORY「25D Order Export DONE — commit `<sha>`」

## Context-exhausted handoff 模板

（這組不太可能 context-exhausted，1-200 行 code 之內）

```markdown
## Session N+1 handoff（25D 未完）
已完成：
- [x] orderFieldMappings + endpoints 加上
- [ ] OrderExportButton.tsx 元件
- [ ] dot-notation 支援檢查
WIP commit: <sha>
下 session 先：dev 跑開 admin 試下載；CSV 中文亂碼則加 BOM。
```
