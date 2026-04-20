# ISSUE-004 — `/account/**` layout 層沒有 auth gate，未登入者可直接看見 sidebar + 所有子頁骨架

**Severity**: P0 Blocker
**Detected**: 2026-04-18 QA
**Area**: Auth / Access Control

## 症狀

未登入的訪客直接瀏覽：
- https://pre.chickimmiu.com/account
- https://pre.chickimmiu.com/account/orders
- https://pre.chickimmiu.com/account/addresses
- https://pre.chickimmiu.com/account/settings
- https://pre.chickimmiu.com/account/wishlist

全部 200，看得到完整 sidebar（12 個連結）+ 子頁內容（含 demo 資料）。

## 根本原因

檔案 [src/app/(frontend)/account/layout.tsx](src/app/(frontend)/account/layout.tsx) — 全檔**沒有 auth 檢查**：

```tsx
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-cream-50 min-h-screen">
      <div className="container py-8 md:py-12">
        <h1 className="text-2xl font-serif mb-8">我的帳戶</h1>
        {/* sidebar + children */}
      </div>
    </div>
  )
}
```

沒有 `payload.auth()`、沒有 `redirect()`、沒有 cookies check。

**只有** `/account/points` + `/account/referrals` + `/account/subscription`（那三個 SSR 頁）自己做 gate：

```tsx
const { user: sessionUser } = await payload.auth({ headers: headersList })
if (!sessionUser) redirect('/login?redirect=/account/points')
```

其他 5 個頁（`/account`、`/orders`、`/wishlist`、`/addresses`、`/settings`）都是 `'use client'` 而且沒做 gate。

## 風險

- 未登入者看到硬寫 demo 資料 → 以為登入過 / 資料錯亂
- 訊息設計誤導（sidebar 「登出」按鈕對未登入人沒意義）
- SEO 風險：雖 metadata.robots = noindex，但頁面可公開存取

## 建議修法

**把 gate 放 layout.tsx，一次治本。** Layout 變 async server component：

```tsx
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user } = await payload.auth({ headers: headersList })
  if (!user) redirect('/login?redirect=/account')

  // ... 既有 render
}
```

然後可以把 `/account/points` 等 3 個頁重複寫的 gate 刪掉（DRY）。

⚠️ Layout 變 async 後，sidebar 若要顯示 user name / avatar，要從 layout props 傳下去或用 context，但現在 sidebar 沒顯示這些，改動面很小。

## 相關

- ISSUE-005 / 006 / 007 / 008 — 這些 demo 頁一旦 gate 住，使用者就不會看到假資料，嚴重度降一級
- ISSUE-001 / 002 — 登入流修好後，redirect 機制才有意義

## 測試驗收條件

- [ ] 未登入瀏覽 `/account` → 自動導 `/login?redirect=/account`
- [ ] 登入後的 12 條 sidebar 路徑均可正常存取
- [ ] `payload.auth()` cookie 失效（sign out / 過期）→ 自動導回 `/login`
