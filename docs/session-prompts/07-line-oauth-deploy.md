# Session handoff — LINE OAuth Unblock B (deploy bridge fix)

> 上一 session（2026-04-18）完成了 feat/line-oauth 的程式碼 + prod env 開通（Unblock A）。本 session 負責把 bridge fix 真的 deploy 到 prod 並 e2e 驗證。

## 已經完成（請勿重做）

- [x] `feat/line-oauth` branch 建立，commit **`98c877a`** push 到 origin
  - 修 `src/auth.ts` signIn callback — OAuth 成功後同時下 Payload `payload-token` cookie，解掉 `/account/**` 對 OAuth 使用者 redirect 回 `/login` 的已知 bug
  - Google / Facebook / LINE / Apple 四家同時受惠
  - 用 Payload 公開 API：`getFieldsToSign` + `jwtSign`
  - 新增 `docs/LINE_LOGIN_SETUP.md` 完整設定手冊
- [x] `tsc --noEmit` 0 err、本機 port 3007 驗證 CSRF + `POST /api/auth/signin/line` → 302 到 `access.line.me` 含 PKCE + scope `openid profile email`
- [x] Prod `.env` 已加：
  ```
  AUTH_LINE_CHANNEL_ID=1594635781
  AUTH_LINE_CHANNEL_SECRET=2c1cf4ec9f7a937987b0aa36cdb5c763
  ```
- [x] `pm2 restart chickimmiu-nextjs --update-env` 已跑
- [x] Prod `GET /api/auth/providers` 已回 LINE、`POST /api/auth/signin/line` 已 302 到 LINE authorize URL（callback = `https://pre.chickimmiu.com/api/auth/callback/line`）

## 本 session 要做

### 1. 合併 PR 到 main

PR 頁面：https://github.com/mjoalen-dotcom/chickimmiu/pull/new/feat/line-oauth

（`gh` CLI 在這台 Windows 沒裝，改由使用者在 GitHub 網頁點 Merge。）

Merge 後 origin/main 的 tip 應該是 `98c877a` 之後再加 merge commit。

### 2. Deploy 到 prod

```bash
ssh ckmu-prod
cd /var/www/chickimmiu
git pull origin main
pnpm install --frozen-lockfile
pnpm build
pm2 restart chickimmiu-nextjs --update-env
pm2 logs chickimmiu-nextjs --lines 30 --nostream
```

確認 pm2 uptime 穩定、沒 `ELIFECYCLE`、沒 `Payload init error`。Prod 跑 Next.js 15.5.15 + SQLite (`file:./data/chickimmiu.db`)。

### 3. LINE Developers Console 白名單（使用者的動作）

必須登記 callback URL：

```
https://pre.chickimmiu.com/api/auth/callback/line
```

到 https://developers.line.biz → Channel ID 1594635781 → LINE Login tab → **Callback URL**。

**舊 Ally 平台那 3 條路徑不要登記**（本站沒對應路由）。

### 4. 真實 LINE 登入 e2e 測試

使用者在瀏覽器：

1. 開 https://pre.chickimmiu.com/login
2. 點「使用 LINE 登入」
3. 用 LINE 帳號授權
4. 應自動跳回 `/account`
5. DevTools → Application → Cookies → 該 domain 應同時看到：
   - `authjs.session-token`（NextAuth）或 `__Secure-authjs.session-token`
   - `payload-token`（Payload，HttpOnly、SameSite=Lax）← **這是 bridge fix 的關鍵**
6. 進 `/account/points` → 應直接看到會員點數頁，**不會** redirect 回 `/login`
7. 進 `/account/orders`、`/account/addresses`、`/account/settings` 同理
8. Payload admin `/admin` → Users collection → 找新登入的 LINE 使用者，確認 `socialLogins.lineId` 欄位有值

使用者測試時，本 session 應 `ssh ckmu-prod "pm2 logs chickimmiu-nextjs --lines 50 --nostream"` 即時觀察 server 端有無 `[NextAuth] signIn callback error:` log。

### 5. 驗證失敗時的處理

- **點 LINE 按鈕 → `/login?error=Configuration`**：`AUTH_URL` 跟 prod 實際 host 對不上，或 `.env` 沒重載（忘記 `--update-env`）。檢查 `grep AUTH_URL /var/www/chickimmiu/.env`。
- **LINE 授權頁顯示「redirect_uri_mismatch」**：Developers Console callback URL 沒登記或拼錯。
- **LINE 授權成功後回本站顯示「找不到頁面」/ 500**：本 session bridge fix 裡 `setPayloadSessionCookie()` 可能炸。pm2 error log 會有 `[NextAuth] signIn callback error: ...`。bridge fn catch 住不 throw、`return true` 仍允許 NextAuth session，所以 /account 至少會進，但可能沒 Payload cookie → 會再 redirect 回 /login。
- **登入成功但 /account 仍 redirect**：`payload-token` cookie 沒被 set。檢查 response headers 的 `Set-Cookie`，以及 `payload.secret`、`users.config.auth.tokenExpiration` 是否都有值。

### 6. Rollback plan

如果 bridge fix 在 prod 炸：

```bash
ssh ckmu-prod
cd /var/www/chickimmiu
git reset --hard c9fbfee   # 上 session deploy 時的 commit
pnpm install --frozen-lockfile
pnpm build
pm2 restart chickimmiu-nextjs --update-env
```

LINE 登入會退回「只能登入，進不了 /account」的狀態，但不會 worse。

## Prod 其他狀態（本 session 不處理，但知情）

- `/products` 使用者回報「壞掉」。實際 SSR 正常（200 + 155KB + product cards），但頁面有 `BootBeaconCleanup` 的 client fallback「頁面載入失敗」字串（inline `<script>` template）。如果使用者真實瀏覽器會觸發 fallback，代表 client-side chunk load / hydration 錯，屬 B5 bug 延伸（見 memory `B5 beacon trigger mechanism`）。需 DevTools 截圖才能追。
- pm2 歷史 9 次 restart（今天幾波 deploy 造成），目前 online。
- `AUTH_LINE_CHANNEL_SECRET` 在本 repo session log + 使用者聊天紀錄裡出現過，使用者務實派不輪換，留意即可。

## 參考

- Bridge fix 機制：`src/auth.ts` `setPayloadSessionCookie()`
- 設定手冊：`docs/LINE_LOGIN_SETUP.md`
- SSH alias：`ssh ckmu-prod`（5.223.85.14）
- Prod 部署路徑：`/var/www/chickimmiu`
