# ISSUE-007 — `/account/addresses` 硬寫 3 筆假地址 + 新增/編輯/刪除只改 useState 不寫 DB

**Severity**: P1 High
**Detected**: 2026-04-18 QA
**Area**: Addresses / Data wiring + Persistence

## 症狀

- 永遠顯示 3 筆假地址（王小美．住家 / 公司 / 7-ELEVEN 取貨）
- 新增地址 → 只更新 local useState，F5 重整就消失
- 編輯 / 刪除 / 設為預設 → 同樣只改 local state
- 結帳時無法真正使用這些地址

## 根本原因

檔案 [src/app/(frontend)/account/addresses/page.tsx:26-66](src/app/(frontend)/account/addresses/page.tsx:26)：

```tsx
const INITIAL_ADDRESSES: Address[] = [
  { id: '1', label: '住家', recipientName: '王小美', ... },
  { id: '2', label: '公司', ... },
  { id: '3', label: '7-ELEVEN 取貨', ... },
]

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>(INITIAL_ADDRESSES)
  // ...
  const handleSubmit = () => {
    if (editingId) {
      setAddresses((prev) => prev.map((a) => (a.id === editingId ? { ...a, ...form } : a)))
    } else {
      setAddresses((prev) => [...prev, { ...form, id: Date.now().toString(), isDefault: prev.length === 0 }])
    }
    // 完全沒有 fetch / POST / PATCH
  }
```

## 期望行為

- 地址儲存在 Users collection 的 `addresses` array field（或獨立 `user-addresses` collection）
- 新增 → POST `/api/users/{id}` 更新 addresses 欄位
- 編輯 → 同上
- 刪除 → 同上
- 設為預設 → 標記 `isDefault: true`，其他 `false`

## 建議修法

### Step 1 — 確認 Users collection 有 addresses 欄位
`src/collections/Users.ts` 找 `name: 'addresses'` 的 array field 是否存在。若不存在要先加欄位 + migration。

### Step 2 — 改寫頁面
Server component 拉初始 addresses → client `AddressesClient.tsx` 容納 form + API 呼叫：

```tsx
// page.tsx
export default async function AddressesPage() {
  const { user: sessionUser } = await payload.auth({ headers: await nextHeaders() })
  if (!sessionUser) redirect('/login?redirect=/account/addresses')
  const user = await payload.findByID({ collection: 'users', id: sessionUser.id, depth: 0 })
  return <AddressesClient userId={user.id} initialAddresses={user.addresses || []} />
}

// AddressesClient.tsx
async function handleSubmit() {
  const next = editingId ? addresses.map(...) : [...addresses, newAddr]
  const res = await fetch(`/api/users/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ addresses: next }),
  })
  if (res.ok) { setAddresses(next); /* reset form */ }
}
```

### 超商取貨整合
現 demo 有 7-11 欄位（`storeName` / `storeId` / `storeCarrier`）但不會真的接綠界 / 藍新取貨 API。封測期先把這塊砍掉或顯示「即將推出」。

## ⚠️ 依賴

- ISSUE-004 auth gate
- Users collection addresses 欄位（需先確認存在）
- 結帳頁的地址選擇器若也讀同一資料源，一併更新

## 測試驗收條件

- [ ] 新註冊會員 → 地址清單為空
- [ ] 新增一筆地址 → F5 重整仍在
- [ ] 編輯 / 刪除 → F5 仍生效
- [ ] 設為預設 → 其他變 false
- [ ] 結帳頁能讀到這些地址

## 估計規模

- 動 1 頁 + 可能加 Users.ts 1 個欄位 + 1 migration
- ~250 行，中大型
