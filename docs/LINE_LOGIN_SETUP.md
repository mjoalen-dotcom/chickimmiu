# LINE Login 設定指南

NextAuth v5 + Payload 雙 session bridge 版本。`src/auth.ts` 已實作：OAuth 成功後同時下 Payload `payload-token` cookie，OAuth 使用者也能進 `/account/**`。

## 1. LINE Developers Console 設定

到 https://developers.line.biz → 選一個 Provider（或新建）→ 建立 **LINE Login** channel（不是 Messaging API，不是 LINE Pay）。

### Channel 基本資訊要勾的

- Region: Taiwan（或你主要市場）
- App type: Web app
- Email address permission: 建議勾。勾了才能要求 email scope，我們的 NextAuth signIn callback 靠 email 查 / 建 Payload user

### Callback URL 白名單（LINE Login tab → Callback URL）

登記下列所有會用到的 URL，一行一個：

```
http://localhost:3000/api/auth/callback/line
https://pre.chickimmiu.com/api/auth/callback/line
https://www.chickimmiu.com/api/auth/callback/line
```

> 每個環境的 callback URL 都是 `{AUTH_URL}/api/auth/callback/line`，其中 `AUTH_URL` 對應該環境的 `.env`。
> 
> ⚠️ **不要** 登記舊 Ally / Shopline 平台用過的路徑（例如 `/oauth/line/callback`、`/users/auth/line/setup`、`/oauth/line/quick_sign_up_callback`）。那些是 Ally SaaS 自己定義的，我們的 Next.js 不會有對應路由，登記也沒用。

### Scope（OpenID Connect）

Login channel 預設有 `profile`；若要拿 email，加開 `email` scope（在 LINE Login settings）。

## 2. 環境變數

### 本機 `.env`

```env
AUTH_SECRET=<openssl rand -base64 32 生成>
AUTH_URL=http://localhost:3000
AUTH_LINE_CHANNEL_ID=<LINE Developers Console → Basic settings → Channel ID>
AUTH_LINE_CHANNEL_SECRET=<LINE Developers Console → Basic settings → Channel secret>
```

### Prod `pre.chickimmiu.com` server `.env`

```env
AUTH_SECRET=<和本機不同的值；prod 獨立生成>
AUTH_URL=https://pre.chickimmiu.com
AUTH_LINE_CHANNEL_ID=<同上，可和本機共用同一個 Channel>
AUTH_LINE_CHANNEL_SECRET=<同上>
```

設完 `.env` 後：

```bash
pm2 restart chickimmiu-nextjs
```

正式 `www.chickimmiu.com` 上線時，把 `AUTH_URL` 改成 `https://www.chickimmiu.com` 重啟即可。

## 3. 本機測試步驟

1. `pnpm install && pnpm dev`
2. 開 http://localhost:3000/login
3. 點「使用 LINE 登入」→ 跳轉到 LINE 認證頁
4. 用 LINE 帳號授權 → 應自動導回 `/account`（redirect 取自 URL `?redirect` 參數，預設 `/account`）
5. 導回後應直接看到 `/account` 首頁（不會再被踢回 `/login`）
6. 進 `/account/points` / `/account/orders` 等頁面，確認不會 redirect 回 `/login`

驗證已設兩種 cookie：DevTools → Application → Cookies → `http://localhost:3000` 應同時看到

- `authjs.session-token`（NextAuth）
- `payload-token`（Payload，`HttpOnly`、`SameSite=Lax`）

Payload admin 後台（`/admin` → Users collection）應看到新建或被更新的帳號，`socialLogins.lineId` 欄位有值。

## 4. 已知邊界行為

- **同 email 先 email/pw 註冊、後 LINE 登入**：Payload user 會被找到並 append `socialLogins.lineId`，不會建重複帳號。之後兩種方式都能登入，進入同一個 user 紀錄。
- **LINE 帳號沒公開 email**：我們 signIn callback 會回 `false`（`if (!user.email) return false`），LINE 登入會失敗。要求使用者去 LINE 設定 email，或日後改成允許無 email 的社群帳號（需要另外的身份合併 UI）。
- **隨機密碼**：社群使用者建立時 Payload user 帶隨機密碼（他們用不到）。如果日後想切成 email/pw 登入，走 `/forgot-password` 重設即可。

## 5. 封測 rollout 建議

1. 先只登記 `http://localhost:3000/api/auth/callback/line`，本機跑通一次
2. 再登記 `https://pre.chickimmiu.com/...`，更新 prod `.env` + 重啟 pm2
3. 自己帳號在 pre 實測一遍完整 LINE 流程
4. 再放給封測用戶

## 6. 安全備註

- LINE Channel Secret 等同於 password。只該出現在 server `.env` 以及 password manager，不應進 git repo、Slack、chat log。
- 若 secret 進過 chat log / 截圖 / 外部 tool，考慮去 LINE Developers Console → Basic settings → Channel secret → **Issue**（輪換）。舊 secret 立刻失效。
