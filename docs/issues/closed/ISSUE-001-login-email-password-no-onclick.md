# ISSUE-001 — `/login` Email/Password 登入按鈕無 onClick handler

**Severity**: ~~P0 Blocker~~ → **RESOLVED in commit `bd1f5c0`** (feat(phase5.6-auth): wire email/pw login + register + forgot/reset)
**Detected**: 2026-04-18 QA
**Resolved**: 2026-04-18
**Area**: Auth / Customer Login

## 症狀

客戶在 `/login` 頁面輸入 email + password → 點「登入」按鈕 → 沒有任何反應。

## 根本原因

檔案 [src/app/(frontend)/login/page.tsx:75-93](src/app/(frontend)/login/page.tsx:75) 的 email/password form：

```tsx
{/* Email / Password（後續階段完善） */}
<div className="space-y-4">
  <input type="email" placeholder="Email" ... />
  <input type="password" placeholder="密碼" ... />
  <button type="button" ...>
    登入
  </button>
</div>
```

- `<button type="button">` 無 `onClick`
- `<input>` 無 `value` / `onChange` 綁定
- 原始碼註解明確寫「後續階段完善」

## 複現步驟

1. 瀏覽 https://pre.chickimmiu.com/login
2. 輸入任意 email + password
3. 點「登入」
4. 觀察：頁面不變、無錯誤、無 network call

## 期望行為

- 點按鈕呼叫 Payload `/api/users/login` endpoint（或者 NextAuth credentials provider）
- 成功 → redirect 到 `callbackUrl` 或 `/account`
- 失敗 → 顯示錯誤訊息（帳密錯誤 / 伺服器錯誤）

## 建議修法

兩條路：

1. **Payload 原生** — 用 `fetch('/api/users/login', {method:'POST', body: JSON.stringify({email,password})})`。Payload 會下 cookie。最貼近現有 `/api/auth/me` / `payload.auth()` 架構（`/account/points` / `/account/referrals` 都是這條）。
2. **NextAuth** — 接 ISSUE-002 的 `/api/auth/[...nextauth]/route.ts` 用 CredentialsProvider。但 NextAuth session 與 Payload `payload.auth({ headers })` 不自動互通，會多一層 glue。

**建議走路 1**，跟 `/account/points` / `/account/referrals` 的 auth 取得方式一致。

## 相關

- ISSUE-002（OAuth 按鈕也壞，因 next-auth 未接）
- ISSUE-003（忘記密碼流程）
- 建議把這三個 issue 合併一個 PR 一起解
