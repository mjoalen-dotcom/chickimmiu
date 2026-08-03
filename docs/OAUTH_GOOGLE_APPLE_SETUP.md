# Google / Apple / Facebook 登入串接指南（2026-07-29；2026-08-03 補 App 原生登入）

> **手機 App 也要用社群登入？** 除了下面網頁那組憑證，Google 要多建 iOS / Android
> 類型的 OAuth client id、Apple 要多登記 App 的 Bundle ID —— 填在後台同一頁
> 「社群登入設定」的三個 App 欄位。App 端串接規格見
> [APP_INTEGRATION_HANDBOOK.md](APP_INTEGRATION_HANDBOOK.md) §5。

## 現況：程式端 100% 就緒，缺的只有憑證

- [src/auth.ts](../src/auth.ts) 早已註冊 Google / Facebook / LINE / Apple 四個 provider（env 憑證齊全才啟用）
- 登入/註冊頁按鈕、`/api/auth/bridge` Payload session 橋接、socialLogins 綁定/placeholder email 全鏈共用，LINE 已實測通過
- **`/login` 沒看到按鈕就是因為憑證還沒設**：按鈕顯示 = env 憑證 AND 後台開關，缺一即隱藏
  （點了必失敗的按鈕不渲染，見 [socialProviders.ts](../src/lib/auth/socialProviders.ts)）
- 後台開關:**網站全域設定 → 社群登入**（Google/Facebook 預設開、**Apple 預設關**）
- prod `.env`（`/var/www/chickimmiu/.env`）現況：`AUTH_GOOGLE_*`、`AUTH_FACEBOOK_*` 空、`AUTH_APPLE_*` 未設

## 憑證設定方式（擇一）

### 方式 A：後台貼上（推薦，Shopline 式，2026-07-29 起支援）

**後台 → ⑦ 系統與安全 → 網站全域設定 → 社群登入設定**，把各家憑證直接貼進對應欄位，
儲存後約 **15 秒自動生效，免重啟免 SSH**。Secret 類欄位僅管理員可見（field-level access）。

- Google：Client ID + Client Secret 兩欄
- Facebook：App ID + App Secret 兩欄
- Apple：Services ID + Team ID + Key ID + .p8 私鑰全文 四欄 ——
  **client secret（180 天效期的 JWT）由系統 runtime 自動簽發並自動換新，完全免維護**
- LINE：現行走 .env，留空即可；填了會優先於 .env

後台欄位留空 → fallback 到伺服器 .env 憑證；兩邊都空 → 該按鈕自動隱藏。
「按鈕顯示」與「provider 註冊」用同一份判斷（`socialCredentials.ts`），不會出現點了必失敗的按鈕。

### 方式 B：SSH 腳本寫 .env（備援）

```bash
ssh root@5.223.85.14 /var/www/chickimmiu/scripts/setup-social-oauth-prod.sh google <CLIENT_ID> <CLIENT_SECRET>
ssh root@5.223.85.14 /var/www/chickimmiu/scripts/setup-social-oauth-prod.sh facebook <APP_ID> <APP_SECRET>
ssh root@5.223.85.14 /var/www/chickimmiu/scripts/setup-social-oauth-prod.sh apple <SERVICES_ID> <TEAM_ID> <KEY_ID> <p8檔路徑>
```

腳本會先對官方端點驗證憑證、驗過才寫 .env、寫完自動重啟 + 驗收（apple 模式另裝月簽 cron）。

> Apple 的 .p8 檔要先 `scp` 上 prod（腳本會收進 `/var/www/chickimmiu/secrets/` 並 chmod 600）。

---

## Callback URL 白名單（兩家後台都要登記）

| Provider | Redirect / Return URL |
|---|---|
| Google | `https://pre.chickimmiu.com/api/auth/callback/google` |
| Google（LB-11 切換後） | `https://www.chickimmiu.com/api/auth/callback/google` |
| Apple | `https://pre.chickimmiu.com/api/auth/callback/apple` |
| Apple（LB-11 切換後） | `https://www.chickimmiu.com/api/auth/callback/apple` |
| Facebook | `https://pre.chickimmiu.com/api/auth/callback/facebook` |
| Facebook（LB-11 切換後） | `https://www.chickimmiu.com/api/auth/callback/facebook` |

**現在就把 www 那組一起登記**（兩家都允許多筆），LB-11 www 切換時只要改 prod `AUTH_URL=https://www.chickimmiu.com`，OAuth 不會斷。
（LB-11 runbook 另有規定 `/api/` 不可 301 轉址——OAuth callback 也吃這條。）

---

## Google（約 15 分鐘，免費）

1. https://console.cloud.google.com → 選/建專案（建議名稱 `chickimmiu-web`）
2. **API 和服務 → OAuth 同意畫面**（首次必做）：
   - User Type：**外部（External）**
   - 應用程式名稱：`CHIC KIM & MIU`；支援 email、開發人員 email：填自己的
   - 應用程式首頁：`https://www.chickimmiu.com`；隱私權政策：`https://www.chickimmiu.com/privacy`
   - 範圍（Scopes）：加 `email`、`profile`、`openid` 三個非敏感範圍即可
   - 發布狀態按「**發布應用程式**」轉正式（只用非敏感 scope 不需 Google 審查；
     留在「測試中」的話只有測試名單能登入，且 7 天要重新授權）
3. **憑證 → 建立憑證 → OAuth 用戶端 ID**：
   - 類型：**網頁應用程式**
   - 已授權的重新導向 URI：貼上表格那 **兩條 google callback**（pre + www）
   - 已授權的 JavaScript 來源：`https://pre.chickimmiu.com`、`https://www.chickimmiu.com`
4. 抄下 **Client ID**（`xxxx.apps.googleusercontent.com`）與 **Client Secret**（`GOCSPX-…`）
5. 後台「社群登入設定」貼 Client ID/Secret（方式 A）→ 真瀏覽器 `/login` 走一輪驗收

## Facebook（免費，約 20 分鐘；你已有 BM/開發者帳號經驗）

1. https://developers.facebook.com → 我的應用程式 → **建立應用程式**：
   - 用例：**驗證使用者並向他們索取資料（Facebook 登入）**
   - 類型：商業（Business）→ 可掛到既有 Business Manager（FENGZHESHOW 那個）
   - 名稱建議：`CHIC KIM & MIU`
2. 左側 **Facebook 登入 → 設定**：
   - 「有效的 OAuth 重新導向 URI」：貼上表格那 **兩條 facebook callback**（pre + www）
   - 用戶端 OAuth 登入、網頁 OAuth 登入：開；強制 HTTPS：開（預設）
3. **應用程式設定 → 基本資料**：
   - 應用程式網域：`chickimmiu.com`
   - 隱私政策網址：`https://www.chickimmiu.com/privacy`
   - 資料刪除說明：選「資料刪除說明網址」，可先填隱私政策頁
   - 抄下 **應用程式編號（App ID）** 與 **應用程式密鑰（App Secret，按「顯示」）**
4. 頂部把 App 從「開發中」切成 **上線（Live）**——不切的話只有 app 角色（你自己）能登入。
   `email`、`public_profile` 這兩個權限是自動核准（Automatic Advanced Access），不用送審。
5. 後台「社群登入設定」貼 App ID/Secret（方式 A）→ 真瀏覽器 `/login` 驗收

## Apple（已有 App/開發者會籍 → 免額外付費，約 20 分鐘）

我們已有 iOS App = 已有 Apple Developer 會籍與 App ID，只要在**同一個帳號**下補
Services ID + 金鑰即可（新 App ID 那步跳過，用既有的當 Primary App ID；
若既有 App ID 沒勾 Sign in with Apple capability，先去 Identifiers 把它勾上）。

1. ~~建 App ID~~（已有，跳過；確認 Capabilities 有勾 **Sign in with Apple**）
2. **Identifiers → ＋ → Services IDs**：
   - Identifier：`com.chickimmiu.web` ← **這個就是 AUTH_APPLE_ID**
   - 勾 Sign in with Apple → Configure：
     - Primary App ID：選上面的 `com.chickimmiu.app`
     - Domains：`pre.chickimmiu.com`、`www.chickimmiu.com`
     - Return URLs：貼上表格那 **兩條 apple callback**
3. **Keys → ＋**：名稱 `chickimmiu-signin`，勾 Sign in with Apple（Primary App ID 選既有 App ID）
   → **下載 .p8（只給下載一次，保管好）**，抄下 **Key ID**（10 碼）
4. **Membership** 頁抄下 **Team ID**（10 碼）
5. 後台「社群登入設定」貼四欄：Services ID / Team ID / Key ID / .p8 全文（方式 A）
6. **同頁把「啟用 Apple 登入」開關打開**（預設關，不開按鈕不會出現）
7. 真瀏覽器 `/login` 走一輪驗收

### Apple secret 過期問題（方式 A 已自動解）

Apple 的 client secret 是用 .p8 簽的 JWT，**Apple 規定最長 180 天**。
- **方式 A（後台）**：系統 runtime 自動簽 170 天效期、剩 7 天內自動換新 —— 免維護
- 方式 B（.env）：setup 腳本裝 `[ckmu-apple-secret]` crontab 月簽；
  出事查 `crontab -l | grep apple` 跟 `/var/log/ckmu-apple-secret.log`，手動重簽 `setup-social-oauth-prod.sh apple-renew`

---

## 驗收清單（每個 provider 各跑一次）

1. `curl -s https://pre.chickimmiu.com/api/auth/providers` 有該 provider（腳本已自動驗）
2. 真瀏覽器（不要用 MCP pane，hydration 假象）開 `/login` → 按鈕有出現
3. 走完 OAuth → 回站 → `/account` 有登入（NextAuth session + bridge 補 Payload cookie）
4. 後台 Users 查該會員：`socialLogins.googleId` / `appleId` 有寫入
5. Apple 加驗：選「隱藏我的 email」註冊 → 應建出 `@privaterelay.appleid.com` email 的會員，
   再登入一次應對回同一個會員（socialId-first 匹配）

## 疑難排解

- 按鈕沒出現：env 憑證缺 → provider 根本沒註冊；或後台開關關著（Apple 預設關）
- `redirect_uri_mismatch`（Google）/ `invalid_client`（Apple）：callback URL 沒登記或 Services ID 抄錯
- Apple 登入在 Safari 以外正常、Safari 掛：檢查 cookie SameSite —— Apple callback 是
  cross-site form_post，Auth.js v5 會自動處理，但自訂 cookie 設定時要留意
- OAuth 成功但回站沒登入：bridge 問題，看 `/login?error=` 帶回的代碼（LoginClient 會翻中文）
