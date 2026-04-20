# ISSUE-006 — `/account/orders` 硬寫 3 筆 DEMO_ORDERS 假訂單

**Severity**: P1 High
**Detected**: 2026-04-18 QA
**Area**: Orders / Data wiring

## 症狀

登入後的「我的訂單」頁永遠顯示 3 筆假訂單（CKM-20241201-A1B2 / CKM-20241215-C3D4 / CKM-20241220-E5F6），無論會員實際訂單為何。

## 根本原因

檔案 [src/app/(frontend)/account/orders/page.tsx:8-43](src/app/(frontend)/account/orders/page.tsx:8)：

```tsx
// Demo data — in production, fetch from Payload API
const DEMO_ORDERS = [
  { id: '1', orderNumber: 'CKM-20241201-A1B2', ... },
  { id: '2', orderNumber: 'CKM-20241215-C3D4', ... },
  { id: '3', orderNumber: 'CKM-20241220-E5F6', ... },
]
```

註解已明確表示是 demo。

## 期望行為

讀 `orders` collection where `user = current user`，SSR 或 client fetch。

## 建議修法

### 路徑 A（推薦）：改為 async server component

類比 `/account/points` pattern：

```tsx
export default async function OrdersPage() {
  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user: sessionUser } = await payload.auth({ headers: headersList })
  if (!sessionUser) redirect('/login?redirect=/account/orders')

  const result = await payload.find({
    collection: 'orders',
    where: { user: { equals: sessionUser.id } },
    sort: '-createdAt',
    limit: 50,
    depth: 2,   // depth 2 拉商品 + 變體
  })

  return <OrdersClient orders={result.docs} />
}
```

拆出 `OrdersClient.tsx` 容納 `expandedId` 狀態。

### 路徑 B：client-side fetch `/api/orders?user=me`

較弱；SSR-first 對 SEO / 首屏較好，但此頁 noindex 所以沒差。主要是 DRY 到 `/account/points` 同模式。

## ⚠️ 依賴

- `orders` collection 的 `user` relationship 欄位存在（SITE_MAP 確認有 `orders` collection）
- `orders` 的 `access.read` 規則是 `isAdminOrSelf`（需驗證）

## 測試驗收條件

- [ ] 新註冊會員 → /account/orders 顯示空狀態（非 3 筆假訂單）
- [ ] 有訂單的會員 → 顯示該會員實際訂單
- [ ] 展開 detail 顯示真實 `items` + `total` + `status`
- [ ] 「查看詳情」link 到 `/account/orders/{id}` 可 work（若該 route 存在）

## 估計規模

動 1 檔 + 拆 1 個 client 子檔，~180 行，中等工作量。
