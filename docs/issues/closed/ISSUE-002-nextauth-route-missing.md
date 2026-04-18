# ISSUE-002 — Email/Password 登入路徑沒接（NextAuth 有設但不涵蓋 credentials）

> **修正紀錄 (2026-04-18)**：原 QA 報告判斷「next-auth 完全沒接」是 glob path 錯誤造成的誤判。實際上 NextAuth v5 在 `src/auth.ts` + `src/app/(frontend)/api/auth/[...nextauth]/route.ts` 有完整設定。真正的問題是 `src/auth.ts` **只設了 OAuth 4 家 provider（Google/Facebook/LINE/Apple），沒有 CredentialsProvider**，所以 email/password 走不通 NextAuth。此 issue 已於 **PR #1 (commit `bd1f5c0`)** 透過「email/pw 走 Payload REST 直接 login」的方式解決，**不動 NextAuth**。

**Severity**: ~~P0 Blocker~~ → **RESOLVED in commit `bd1f5c0`**
**Detected**: 2026-04-18 QA
**Resolved**: 2026-04-18
**Resolved**: 2026-04-18（auth 三連體 PR）
**Area**: Auth / Login

## 原始症狀

- `/login` 和 `/register` 的 4 顆 OAuth 按鈕呼叫 `signIn('google'|'facebook'|'line'|'apple')`
- `/login` 和 `/register` 的 email/password 按鈕沒有 handler（ISSUE-001）

## 真實狀況（修正後理解）

### NextAuth 其實是**有**接的
- `src/auth.ts` 128 行完整設定 — 4 個 OAuth provider + signIn callback（建 Payload user）+ session callback
- `src/app/(frontend)/api/auth/[...nextauth]/route.ts` 匯出 `handlers` 正確
- `src/components/layout/Providers.tsx` 有 `<SessionProvider>` wrap
- `package.json` 有 `next-auth@5.0.0-beta.25`

### OAuth 按鈕的行為
- `src/auth.ts` L21 起條件式啟用 — 只有 `AUTH_GOOGLE_ID` + `AUTH_GOOGLE_SECRET` 等環境變數都設好時才會把對應 provider push 到 `providers[]`
- 若 prod 沒設這些 env，按按鈕會被 NextAuth 的 `pages.signIn: '/login'` 導回本頁，URL 加 `?error=...`
- 按鈕**不壞**，只是**可能沒憑證**可用 — 這是運維 / 部署 env 問題，不是程式碼問題

### Email/Password 沒接
- `src/auth.ts` 的 providers 陣列**沒有** CredentialsProvider
- 前端 `/login` email/pw 按鈕在原始碼註解寫「後續階段完善」，根本沒 onClick（ISSUE-001 範圍）

## PR #1 採用的解法

**不動 NextAuth，email/pw 直接走 Payload REST**：

- `/login` email/pw：`fetch('/api/users/login', { body: {email, password} })` — Payload 內建，設 `payload-token` HttpOnly cookie
- `/register`：新增 custom endpoint `POST /api/users/register`（`src/endpoints/customerRegister.ts`），因為 Users collection `access.create = isAdmin` 擋公開註冊
- `/forgot-password` + `/reset-password`：走 Payload 內建 `/api/users/forgot-password` + `/api/users/reset-password`
- OAuth 按鈕：原樣保留，env 有設就動、沒設就原狀

## ⚠️ 遺留設計缺陷（非本 PR 處理）

Payload cookie session（email/pw 使用者）和 NextAuth session（OAuth 使用者）是**兩套不共用**。結果：
- 用 email/pw 登入的使用者進 `/account/points` 可以（該頁用 `payload.auth()` 讀 Payload cookie）
- 用 Google 登入的使用者進 `/account/points` 會被判定未登入 → redirect `/login`

要治本需在 NextAuth `signIn` callback 呼叫 `req.payload.login()` 下 Payload cookie，但這牽涉 NextAuth server-side cookie API，工作量大。**封測期先不處理** — OAuth 使用者目前能做的：OAuth 登入 → 主站可用（navbar 顯示 session.user） → 但會員中心進不去。這個限制要跟 beta tester 溝通。

## 相關

- ISSUE-001（email/pw 按鈕無 onClick）— PR #1 一起解
- ISSUE-003（忘記密碼）— PR #1 一起解
