# ISSUE-005 — `/account` 主頁所有會員資料全硬寫（永遠顯示 0 點數 / 優雅初遇者 / NT$0）

**Severity**: P1 High
**Detected**: 2026-04-18 QA
**Area**: Account / Data wiring

## 症狀

登入後的會員總覽頁，四張數據卡（會員點數 / 購物金 / 累計消費 / 會員折扣）永遠顯示 0。會員等級卡永遠寫「優雅初遇者」+「再消費 NT$ 3,000 即可升級為曦漾仙子」無論實際等級。

## 根本原因

檔案 [src/app/(frontend)/account/page.tsx](src/app/(frontend)/account/page.tsx)：

- `'use client'` + 無 `useSession` / 無 fetch
- L15 "優雅初遇者" — 寫死
- L17 "再消費 NT$ 3,000..." — 寫死
- L27 "累計消費 NT$ 0" — 寫死
- L28 "曦漾仙子 NT$ 3,000" — 寫死
- L37-43 4 張 card `value: '0' / 'NT$ 0' / '0%'` — 全寫死
- L91 "目前還沒有訂單" — 寫死

**整個頁面是 Figma mock 直譯到 React，零資料綁定。**

## 期望行為

讀 `users` collection（depth:1 for memberTier）+ `points-transactions`（sum）+ `orders`（sum spending, last 3 orders），渲染真值。

## 建議修法

改為 async server component 模式，跟 `/account/points` 同 pattern：

```tsx
export default async function AccountPage() {
  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user: sessionUser } = await payload.auth({ headers: headersList })
  if (!sessionUser) redirect('/login?redirect=/account')

  const [user, tiers, recentOrders, pointsAgg] = await Promise.all([
    payload.findByID({ collection: 'users', id: sessionUser.id, depth: 1 }),
    payload.find({ collection: 'membership-tiers', sort: 'level', depth: 0 }),
    payload.find({ collection: 'orders', where: { user: { equals: sessionUser.id } }, limit: 3, sort: '-createdAt' }),
    /* aggregate points balance */
  ])

  // render with real data
}
```

然後把「卡片陣列」的 value 換成從 `user` 取。

## ⚠️ 依賴

- ISSUE-004（gate）修好後，`sessionUser` 有保證
- `users.points` / `shoppingCredit` / `storedValueBalance` 欄位確認已 seed / 有值

## 測試驗收條件

- [ ] 登入兩個不同會員看到各自真實點數 / 會員等級
- [ ] 最近訂單 section 顯示該會員實際訂單（或正確 empty state）
- [ ] SSR 無 hydration 錯誤

## 估計規模

- 動 1 個檔（`/account/page.tsx`），~120 行，中等工作量
- 不動 `<CreditScoreCard>` 子元件（它已經是 client component 自己 fetch）
