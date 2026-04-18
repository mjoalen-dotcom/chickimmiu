# ISSUE-008 — `/account/settings` 顯示硬寫「王小美 / xiaomei@example.com / 0912-345-678 / 1995-06-15」

**Severity**: P1 High
**Detected**: 2026-04-18 QA
**Area**: Account / Settings / Data wiring

## 症狀

「帳號設定」頁面所有欄位預填假資料，修改後按儲存沒事發生（同 ISSUE-007 只改 useState）。社交帳號綁定卡也是假的（顯示 Google / LINE 已連，Facebook 未連）。

## 根本原因

檔案 [src/app/(frontend)/account/settings/page.tsx:7-18](src/app/(frontend)/account/settings/page.tsx:7)：

```tsx
export default function SettingsPage() {
  const [form, setForm] = useState({
    name: '王小美',
    email: 'xiaomei@example.com',
    phone: '0912-345-678',
    birthday: '1995-06-15',
  })
  const socialAccounts = [
    { provider: 'Google', connected: true, label: 'xiaomei@gmail.com' },
    { provider: 'Facebook', connected: false, label: '' },
    { provider: 'LINE', connected: true, label: '王小美' },
  ]
```

`'use client'`，無 fetch、無 PATCH、無 session。

## 期望行為

- 預填 = 當前登入會員的 `users` collection 資料
- 儲存 = PATCH `/api/users/{id}`
- 生日欄位要連到 `users.birthday` 啟動生日自動化（BirthdayCampaigns collection 存在）
- 社交帳號綁定：若走 ISSUE-002 路徑 B 則整塊刪掉；若走路徑 A 則讀 `users.accounts` 或 NextAuth accounts table

## 建議修法

跟 ISSUE-005 / 006 / 007 同 pattern：async server component → 拿 user → client 子元件做表單互動 → PATCH `/api/users/{id}`。

```tsx
// page.tsx
export default async function SettingsPage() {
  const { user: sessionUser } = await payload.auth({ headers: await nextHeaders() })
  if (!sessionUser) redirect('/login?redirect=/account/settings')
  const user = await payload.findByID({ collection: 'users', id: sessionUser.id, depth: 0 })
  return <SettingsClient user={user} />
}
```

**注意**：Payload `users` collection 的 email 通常是 auth-protected，**不能自由 PATCH**。修 email 要走 payload `/api/users/{id}` 並以管理員身份，或做另一條「改 email 要重新驗證」flow。封測期建議 email 欄位 disabled（目前畫面已 disabled，但 value 仍是假的）。

## 社交帳號區塊

看 ISSUE-002 最終走哪條：
- 路徑 A（保留 OAuth）→ 要實作真的連結/斷開
- 路徑 B（拔 OAuth）→ 整塊社交帳號卡片刪掉

## ⚠️ 依賴

- ISSUE-002 結論（影響社交區塊走向）
- ISSUE-004 gate

## 測試驗收條件

- [ ] 預填 = 實際會員資料
- [ ] 儲存按鈕能 PATCH 成功
- [ ] F5 重整資料仍在
- [ ] email 欄位 disabled 且顯示真實 email
