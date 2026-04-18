# OAuth ↔ Payload session sync — 未完成，留下 session

> 狀態：**partial**。Task E 未接通，但已加 fail-loud fallback。

## 問題
專案有兩套 session cookie：

| 機制 | Cookie | 建立時機 | 消費者 |
|---|---|---|---|
| Payload v3 | `payload-token` | email/pw 登入 (`/api/users/login`) + register endpoint | `payload.auth({ headers })` in server components |
| NextAuth v5 | `next-auth.session-token` | OAuth callback（Google/Facebook/LINE/Apple）| `auth()` in server components |

`/account/**` layout auth gate 走 Payload：
```ts
const { user } = await payload.auth({ headers: headersList })
if (!user) redirect('/login?redirect=/account')
```

→ OAuth 登入的使用者**永遠**沒有 `payload-token` cookie → 每次進 /account 被踢回 /login。

## 本 PR 做的（fail-loud fallback）
- `src/auth.ts` signIn callback：Payload user 仍照樣 create / update（保留資料一致性），但 callback 回傳 string URL `/login?oauth=unfinished` 而非 `true` → NextAuth 不建立 session，使用者明確被帶回 /login 並看到提示
- `src/app/(frontend)/login/page.tsx`：讀 `?oauth=unfinished` → 顯示「社群登入尚未完整接通，請先用 email/密碼」橫幅

結果：OAuth 使用者不會卡在無限循環；他們被引導去 email/pw 流。

## 下一步要做的（給下個 session）
兩條路，推薦 **A**：

### A. 在 OAuth success 後下 Payload cookie（推薦）
1. 把 `signIn` callback 改回 `return true`
2. 在 Users collection 加 `socialLogins.*Id` 欄位（若尚未），保留 provider → providerAccountId 映射（已有）
3. 改 `src/app/(frontend)/api/auth/[...nextauth]/route.ts`：
   - 包一層 wrapper：NextAuth 回傳 Response 後，在 success case 內
   - call `payload.login({ collection: 'users', data: { email, password: <固定 placeholder 或 hash 後 email> }, req })` 取 token
   - 或更乾淨：用 `payload.generateAuthToken` / 直接 issue JWT (Payload v3 支援)
   - 把 token 寫進 `Set-Cookie: payload-token=...; Path=/; HttpOnly; SameSite=Lax`
4. 保留 NextAuth cookie（社群帳號綁定等資訊仍在）但實際授權走 Payload

風險：OAuth user 的 Payload password 是隨機字串（`social_<uuid>`），他們不能用 email/pw 登入。這是 by design — 要給他們 email/pw login 需額外「設定密碼」流程。

### B. 讓 auth gate 同時認 NextAuth 或 Payload（次選）
1. `/account/**` layout 改成：
```ts
const payloadUser = await payload.auth({ headers }).then(r => r.user)
const naSession = await auth() // from src/auth.ts
if (!payloadUser && !naSession?.user) redirect('/login?redirect=/account')
const user = payloadUser || (naSession?.user ? await syncNextAuthToPayload(naSession.user) : null)
```
缺點：兩套 session 並存，`payload.auth` 內部呼叫的地方（server actions / endpoints）都要個別改，維護負擔大。

## 驗收條件（下 session 做完要 tick）
- [ ] OAuth 登入後，`document.cookie` 含 `payload-token=...`
- [ ] 進 `/account` 不被 redirect（NextAuth user 能通過 Payload auth gate）
- [ ] Payload admin 能看到 OAuth user row
- [ ] Logout 同時清掉兩個 cookie
- [ ] 撤掉本 PR 加的 `?oauth=unfinished` 橫幅 + signIn 回 `true`

## 當前 env 狀態
`.env` 內 `AUTH_GOOGLE_ID` / `AUTH_FACEBOOK_ID` / `AUTH_LINE_CHANNEL_ID` / `AUTH_APPLE_ID` 都空 → OAuth providers 全 disabled → 本路徑目前實際不會被觸發。Fail-loud fallback 是對未來啟用任一 provider 時的保護。
