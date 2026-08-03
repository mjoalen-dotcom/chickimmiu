# CHIC KIM & MIU — APP 串接技術手冊

> 交付對象：手機 App 開發團隊（iOS / Android）
> 版本：2026-08-03 · 對應 commit：見 `git log` · 維護者：CKMU 技術端
> 相關文件：[API v1 規格](api/v1.md)、[社群登入申請指南](OAUTH_GOOGLE_APPLE_SETUP.md)、[上線稽核工單](LAUNCH_READINESS_2026-07-27.md)

---

## 0. 一頁看懂

| 項目 | 現況 |
|---|---|
| **後端主機** | Hetzner Cloud CPX22（新加坡）· `5.223.85.14` · Ubuntu + nginx + pm2 |
| **正式網域** | `https://pre.chickimmiu.com`（封測中）→ 上線後切 `https://www.chickimmiu.com` |
| **應用程式** | Next.js 15.5 (App Router) + React 19 + Payload CMS 3.83（同一個 Node 程序同時是網站、後台、API） |
| **資料庫** | **SQLite**（libSQL driver）· 單檔 · 76 個 collection · 所有站台共用這一份 |
| **檔案儲存** | Cloudflare R2（商品圖 / 媒體） |
| **App 認證** | `Authorization: Bearer <JWT>`，7 天效期 |
| **App 社群登入** | `POST /api/v1/auth/social`（Google / Apple 原生 id_token 交換）— 2026-08-03 新增 |
| **API base** | `https://pre.chickimmiu.com/api` |

**App 團隊只需要記住三件事**：
1. 所有 API 都在同一個網域底下，前綴 `/api`。
2. 拿 token 的方式有三種（email 密碼 / Google / Apple），拿到之後全部一樣帶 `Authorization: Bearer`。
3. 會員資料只有一份 —— App 註冊的人，在購物網站與金老佛爺官網都是同一個帳號、同一份點數。

---

## 1. 系統全景：三個站台，一份資料庫

```
                     ┌──────────────────────────────────────────┐
                     │  Hetzner CPX22 (SIN) · 5.223.85.14       │
                     │  nginx → pm2 → Next.js 15 + Payload 3    │
                     │                                          │
   購物網站 ─────────►│  chickimmiu.com                          │
   (本體 · SSR)       │   ├─ 前台（SSR / RSC）                    │
                     │   ├─ /admin  Payload 後台                 │
                     │   └─ /api/** 全部 API                     │
                     │                                          │
   手機 App ─────────►│  /api/v1/**   Bearer token              │
   (iOS / Android)    │                                          │
                     │                                          │
   金老佛爺官網 ──────►│  /api/sso/**  OAuth2 + PKCE             │
   blog.kimlafayette  │                                          │
   (cPanel 靜態站)     │            ▼                             │
                     │      ┌────────────────┐                  │
                     │      │  SQLite 單一檔  │ ← 唯一真相來源     │
                     │      │  users / orders │                  │
                     │      │  points / ...   │                  │
                     │      └────────────────┘                  │
                     └──────────────────────────────────────────┘
```

### 三個站台各自的角色

| 站台 | 位置 | 與資料庫的關係 |
|---|---|---|
| **CHIC KIM & MIU 購物網站** | 同一台主機，Next.js 直連 | 直接讀寫（Payload local API），是資料庫的宿主 |
| **金老佛爺官網 / 部落格** | cPanel 靜態站（`blog.kimlafayette.com`） | **不碰資料庫**。走 `/api/sso/*` 標準 OAuth2 授權碼 + PKCE 換 token，再呼叫 `/api/sso/points/*` 記點 |
| **手機 App** | App Store / Play Store | **不碰資料庫**。走 `/api/v1/*` Bearer token |

**設計原則**：資料庫只有購物網站本體能直接存取，其它客戶端一律經過 HTTP API + token。
這樣三邊的會員、點數、訂單永遠是同一份，也不需要做資料同步。

### 會員身分的唯一性

同一個人不論從哪裡進來，都會對到 `users` 表的同一列：

```
匹配順序（socialId-first，三個客戶端共用同一份程式碼）
  1. socialLogins.{googleId|appleId|lineId|facebookId} == provider 回傳的 sub
  2. email == provider 回傳的（且已驗證的）email
  3. 都沒有 → 建新會員
```

程式碼在 [`src/lib/auth/socialIdentity.ts`](../src/lib/auth/socialIdentity.ts)，
網頁的 NextAuth callback 與 App 的 `/api/v1/auth/social` 都呼叫它 —— **不要另外實作一份**，
否則同一個人用手機登入會多開一個帳號，點數與訂單就會分家。

> 為什麼 socialId 優先於 email：使用者可能在 LINE/Apple 端換過 email，或根本沒 email
> （台灣 LINE 用戶大量如此、Apple「隱藏我的電子郵件」也是）。沒有 email 的帳號會拿到
> `{provider}_{sub}@noemail.invalid` 的 placeholder 信箱，之後可在設定頁補綁真信箱。

---

## 2. 伺服器與基礎設施

| 項目 | 內容 |
|---|---|
| 供應商 / 規格 | Hetzner Cloud **CPX22**（3 vCPU / 8GB RAM / 80GB SSD），機房新加坡 |
| IP | `5.223.85.14` |
| OS / Runtime | Ubuntu · Node.js · pnpm · pm2（process 名 `chickimmiu-nextjs`，fork mode） |
| 反向代理 | nginx（TLS 終結、`X-Forwarded-Proto` 由 nginx 設定） |
| 應用程式根目錄 | `/var/www/chickimmiu` |
| 記憶體防護 | 2GB swap + pm2 `max_memory_restart 1500M` |
| 備份 | 每日 SQLite 備份 + Cloudflare R2 異地保存 |
| 排程 | crontab（訂單自動取消、發票重試、Apple secret 月簽、部落格同步等） |
| 部署 | `ssh root@5.223.85.14 /root/deploy-ckmu.sh` → 拉 code → `pnpm install` → `payload migrate` → `next build` → `pm2 restart` → 健康檢查 |

**部署絕不 `rm -rf .next`** —— Next.js 產出 content-hash chunk，新舊可共存；砍掉會有 1–2 分鐘全站 404 的空窗。
細節見 [`scripts/deploy-prod.sh`](../scripts/deploy-prod.sh) 檔頭註解。

### 網域切換注意事項（影響 App）

目前封測網域是 `pre.chickimmiu.com`，上線後切 `www.chickimmiu.com`。
**App 端請把 API base URL 做成可遠端設定（或至少是 build config），不要硬編碼**，
並且切換期間兩個網域會同時可用。切換 runbook：[LAUNCH_LB11_WWW_CUTOVER_RUNBOOK.md](LAUNCH_LB11_WWW_CUTOVER_RUNBOOK.md)。

> ⚠️ `/api/**` 路徑在切換時**不做 301 轉址**（會打斷金流 callback 與 OAuth callback）。
> App 若收到 3xx 代表打錯路徑，不要自動跟隨。

---

## 3. 程式

### 技術棧

| 層 | 技術 |
|---|---|
| Framework | Next.js **15.5.15**（App Router、RSC、Server Actions） |
| UI | React **19** |
| CMS / ORM / Admin | Payload CMS **3.83**（`/admin` 後台、collection REST API、access control 全由它產生） |
| DB driver | `@payloadcms/db-sqlite`（底層 Drizzle + libSQL） |
| 網頁社群登入 | NextAuth v5（`5.0.0-beta.25`），lazy init |
| 語言 | TypeScript（`npx tsc --noEmit` 必須全綠才能合併） |

### Repo 結構（App 團隊會用到的部分）

```
src/
├─ app/
│  ├─ api/v1/**            ← App 專用 API（本文件第 5 節）
│  ├─ api/sso/**           ← 金老佛爺官網用的 OAuth2 server
│  └─ (frontend)/api/**    ← 網站自己用的 API（cookie 認證，App 通常不用）
├─ collections/            ← 76 個資料表定義（= schema 的真相來源）
├─ globals/                ← 後台全域設定（含社群登入憑證）
├─ lib/auth/
│  ├─ socialIdentity.ts    ← 社群身分 → 會員 的唯一入口
│  ├─ verifyIdToken.ts     ← App id_token 驗簽（Google/Apple JWKS）
│  ├─ issuePayloadToken.ts ← 免密碼簽發 Bearer token
│  └─ socialCredentials.ts ← 憑證解析（後台優先 → .env fallback）
├─ migrations/             ← 資料庫 migration（手寫，見第 4 節）
└─ payload.config.ts       ← 全站組態入口
```

### 開發與驗證慣例（給要送 PR 的人）

- Schema 改動一律**手寫 migration**，不要用 `payload migrate:create`（自動產生的會誤刪欄位）
- 加了 `admin.components.*` 必須跑 `pnpm payload generate:importmap` 並 commit，否則後台靜默不掛載
- 本地驗證用 **prod build**（`pnpm build && pnpm start`），dev server 對某些 mount 會炸
- 合併前：`npx tsc --noEmit` + `pnpm build` + 相關 `node --test`

---

## 4. 資料庫

### 引擎與位置

- **SQLite 單一檔案**（不是 Postgres）。路徑由 `DATABASE_URI` 指定，prod 在 `/var/www/chickimmiu/data/` 底下。
- 選 SQLite 的理由：單機部署、讀多寫少、備份 = 複製一個檔、無額外 DB 程序耗記憶體。
- **並發限制**：SQLite 單寫者。目前流量無虞；若未來 App 帶來大量並發寫入（例如秒殺），
  需評估換 Postgres —— Payload 換 adapter 即可，但要重跑 migration。

### Schema 概觀（76 collections）

| 領域 | 主要 collection |
|---|---|
| 會員 | `users`、`membership-tiers`、`login-attempts`、`user-subscriptions` |
| 錢包 / 忠誠 | `points-transactions`、`wallet-transactions`、`user-rewards`、`coupons`、`coupon-redemptions`、`points-redemptions` |
| 商品 | `products`、`categories`、`size-charts`、`bundles`、`add-on-products`、`gift-rules`、`product-reviews` |
| 訂單 | `orders`、`invoices`、`returns`、`refunds`、`exchanges`、`shipping-methods` |
| 庫存 | `inventory-transactions`、`purchase-orders`、`stock-takes` |
| 內容 | `pages`、`blog-posts`、`blog-categories`、`media`、`podcasts` |
| 遊戲 / 互動 | `mini-game-records`、`game-leaderboard`、`prize-pools`、`collectible-cards`、`style-submissions` |
| 行銷 / CRM | `marketing-campaigns`、`automation-journeys`、`member-segments`、`behavior-events`、`ab-tests` |
| 客服 | `conversations`、`messages`、`customer-service-tickets` |

> collection 定義本身就是規格書：`src/collections/<Name>.ts`。欄位標籤都是中文，可直接對照後台。

### 會員資料模型（App 最常碰的）

`users` 的重點欄位：

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | number | 會員主鍵 |
| `email` | string | 唯一、小寫。無 email 的社群帳號是 `..._...@noemail.invalid` |
| `name` / `phone` / `gender` / `birthday` | — | 基本資料 |
| `role` | `customer` \| `admin` … | App 使用者一律 `customer` |
| `points` | number | 點數餘額 |
| `shoppingCredit` | number | 購物金 |
| `storedValueBalance` | number | 儲值金 |
| `memberTier` | relation | 會員等級（含 `frontName` 前台顯示名） |
| `socialLogins.googleId / facebookId / lineId / appleId` | string | 社群綁定 |
| `lineUid` | string | LINE 官方帳號推播用 |
| `referralCode` | string | 推薦碼 |
| `gameTermsAcceptance` | group | 遊戲規範簽署狀態 |
| `_verified` | boolean | OAuth 建立的帳號一律 `true` |
| `sessions[]` | array | Payload session 記錄；**每一顆有效 token 都對應這裡一筆 `sid`** |

### Migration 規範

- 檔名 `YYYYMMDD_HHMMSS_描述.ts`，放 `src/migrations/`，並在 `src/migrations/index.ts` 註冊
- SQLite 不支援 `ADD COLUMN IF NOT EXISTS` → 一律用 `PRAGMA table_info` 判斷後再加，保持**冪等**
- 部署腳本會在 `pm2 restart` **之前**跑 `pnpm payload migrate`

---

## 5. App 認證：完整流程

### 5.1 三種取得 token 的方式

| 方式 | Endpoint | 使用場景 |
|---|---|---|
| Email + 密碼 | `POST /api/v1/auth/login` | 既有會員 |
| **Google 原生登入** | `POST /api/v1/auth/social` | iOS / Android |
| **Apple 原生登入** | `POST /api/v1/auth/social` | **iOS 必備**（App Store 審核要求：只要提供第三方登入就必須提供 Sign in with Apple） |

三者回傳格式一致，拿到 `token` 之後所有 API 都帶：

```
Authorization: Bearer <token>
```

Token 效期預設 **7 天**（回應的 `expiresIn` 是秒數）。過期 → API 回 401 → 重新登入。
Bearer token 不吃 CSRF、不需要 cookie，因此 App 端不用處理 cookie jar。

### 5.2 Google / Apple 原生登入 — `POST /api/v1/auth/social`

**為什麼不用網頁那條**：網頁走 OAuth 授權碼 + 瀏覽器轉址 + cookie；原生 App 應該用系統 SDK
（`GoogleSignIn` / `ASAuthorizationAppleIDProvider`）拿到 `id_token` 再交換，體驗好、
也符合 Apple 對 iOS App 的要求。

**流程**：

```
App                                     後端                         Google / Apple
 │                                        │                               │
 ├─ 1. 產生 nonce（隨機字串，自己留著）      │                               │
 ├─ 2. 用系統 SDK 發起登入（帶 nonce） ─────┼──────────────────────────────►│
 │◄────────────── id_token ───────────────┼───────────────────────────────┤
 ├─ 3. POST /api/v1/auth/social ─────────►│                               │
 │    { provider, idToken, nonce, name }  ├─ 驗簽（抓 provider JWKS 公鑰）──►│
 │                                        ├─ 驗 iss / aud / exp / nonce    │
 │                                        ├─ socialId-first 找/建會員       │
 │◄──── { token, expiresIn, user, ────────┤─ 簽 Payload Bearer token       │
 │        isNewUser }                     │                               │
```

**Request**：

```jsonc
POST /api/v1/auth/social
Content-Type: application/json

{
  "provider": "google",        // 或 "apple"
  "idToken":  "eyJhbGciOi...", // SDK 拿到的 id_token
  "nonce":    "隨機字串原文",     // 可選但強烈建議（防重放）
  "name":     "王小明"          // 可選；Apple 首次登入才拿得到全名，務必帶上
}
```

**Response 200**（與 `/api/v1/auth/login` 同格式，多一個 `isNewUser`）：

```jsonc
{
  "success": true,
  "data": {
    "token": "<JWT>",
    "expiresIn": 604800,
    "isNewUser": true,          // true → App 可跑新手引導 / 首購禮
    "user": {
      "id": 1234,
      "email": "someone@gmail.com",
      "name": "王小明",
      "points": 0,
      "shoppingCredit": 0,
      "memberTier": { "id": 1, "slug": "bronze", "frontName": "..." },
      "gameTermsAcceptance": null
    }
  }
}
```

**Errors**：

| HTTP | code | 意義 |
|---|---|---|
| 400 | `BAD_REQUEST` | `provider` 不是 google/apple，或缺 `idToken` |
| 401 | `INVALID_ID_TOKEN` | 驗簽失敗 / issuer 錯 / **audience 沒登記** / 過期 / nonce 不符 |
| 403 | `PROVIDER_DISABLED` | 後台把該 provider 關閉，或憑證還沒設定 |
| 500 | `INTERNAL_ERROR` | 伺服器錯誤 |

**後端做的驗證**（[`verifyIdToken.ts`](../src/lib/auth/verifyIdToken.ts)，已有 9 項單元測試）：
RS256 簽章對 provider JWKS 公鑰 → issuer → audience 白名單 → exp/iat（±120 秒容差）→ nonce
（Apple 慣例送 SHA256 雜湊、Google 送原文，兩種都接受）。
`alg=none`、竄改 payload、換 kid、別家 App 的 token 全部擋下。

### 5.3 App 端實作重點（踩雷清單）

| 事項 | 說明 |
|---|---|
| **audience 要先登記** | 原生 SDK 拿到的 id_token，`aud` 是 **iOS/Android 各自的 client id**，跟網頁那組不同。後台「社群登入設定」要填 `Google iOS Client ID` / `Google Android Client ID` / `Apple App Bundle ID`，否則一律 401 |
| **Apple 的 email 和名字只給一次** | 首次授權才回傳。**首次登入務必把 `fullName` 一起 POST 上來**，否則會員名字只會是 email 前綴，之後 Apple 再也不給 |
| **Apple 隱藏信箱** | 使用者可選「隱藏我的電子郵件」→ 會拿到 `@privaterelay.appleid.com`。這是正常會員，寄信照樣送得到（Apple 轉發） |
| **nonce** | 每次登入產生新的隨機字串，Apple 端送 SHA256、Google 端送原文，交換時把**原文**給我們 |
| **email 未驗證不採信** | `email_verified=false` 的 email 不會拿來對既有會員（防冒用），該帳號走 placeholder 路徑 |
| **不要自己解析 id_token 決定身分** | 一律以後端回傳的 `user.id` 為準 |
| **登出** | App 端刪掉本地 token 即可。若要伺服器端撤銷，用 Payload 的 `POST /api/users/logout` |

### 5.4 憑證申請狀態（❗尚待完成）

程式端已 100% 就緒，**目前缺的是 Google / Apple 開發者後台的憑證**：

| Provider | 網頁憑證 | App 憑證 | 狀態 |
|---|---|---|---|
| Google | Client ID + Secret（Web 類型） | iOS Client ID、Android Client ID | ⬜ 待申請 |
| Apple | Services ID + Team ID + Key ID + .p8 | App Bundle ID | ⬜ 待申請 |
| LINE | 已設定（.env） | — | ✅ 上線中 |
| Facebook | 待申請 | — | ⬜ |

申請步驟逐步教學：[OAUTH_GOOGLE_APPLE_SETUP.md](OAUTH_GOOGLE_APPLE_SETUP.md)
填入位置：後台 **⑦ 系統與安全 → 網站全域設定 → 社群登入設定**（貼上儲存後約 15 秒生效，免重啟）

---

## 6. App API 清單

完整規格見 [docs/api/v1.md](api/v1.md)。摘要：

| 功能 | Method / Path | 認證 |
|---|---|---|
| Email 登入 | `POST /api/v1/auth/login` | — |
| **社群登入（Google/Apple）** | `POST /api/v1/auth/social` | — |
| 註冊 | `POST /api/users/register` | — |
| 會員綜合資訊（開機用） | `GET /api/v1/me` | Bearer |
| 點數 | `GET /api/v1/points` | Bearer |
| 商品列表 / 推薦 | `GET /api/v1/products`、`GET /api/v1/recommendations` | 部分公開 |
| UGC 貼文 | `GET/POST /api/v1/ugc` | Bearer |
| 遊戲狀態 / 遊玩 / 簽署規範 | `GET /api/games`、`POST /api/games`、`POST /api/games/accept-terms` | Bearer |
| 寶物箱 | `GET /api/user-rewards?where[user][equals]=<id>`、`POST /api/user-rewards/consume` | Bearer |
| 商品 / 訂單（Payload 內建 REST） | `GET /api/products`、`GET /api/orders?where[user][equals]=<id>` | Bearer |
| 結帳 | `/api/checkout` | Bearer |

**錯誤格式統一**：

```json
{ "success": false, "error": "<人類可讀訊息>", "code": "<機器碼>" }
```

`BAD_REQUEST` / `UNAUTHORIZED` / `FORBIDDEN` / `NOT_FOUND` / `INTERNAL_ERROR`
（社群登入另有 `INVALID_ID_TOKEN` / `PROVIDER_DISABLED`）

**Rate limit**：目前未強制。App 端請自律：`/api/v1/me` 不要低於 5 秒一次；抽獎按鈕在 response 回來前 disable。
未來加上後會回 429。

**Deep link**：`chickimmiu://games`、`chickimmiu://account/treasure`、`chickimmiu://orders/<id>`
（需 App 端實作 URL scheme + Universal Link / App Link）

---

## 7. 第三方服務

| 類別 | 服務 | 備註 |
|---|---|---|
| 金流 | **綠界 ECPay**（信用卡 / ATM / 超商）、PayPal、LINE Pay、藍新 | ECPay 為主 |
| 定期定額 | 綠界定期定額（訂閱會員） | 已上線 |
| 物流 | 綠界物流（超商取貨 C2C / 宅配） | ⚠️ 正式憑證尚未設定 |
| 電子發票 | 綠界電子發票 | 已上線 |
| 寄信 | **Resend**（`no-reply@chickimmiu.com`） | 9 種事件模板 |
| 訊息 | LINE Messaging API | ⚠️ token 尚待設定 |
| 檔案 | Cloudflare R2 | 商品圖 / 媒體 |
| 追蹤 | GTM / GA4 / Meta Pixel + CAPI | ⚠️ 尚未填入 ID |

> ⚠️ 標記者為上線前待辦，詳見 [LAUNCH_READINESS_2026-07-27.md](LAUNCH_READINESS_2026-07-27.md) §6。

---

## 8. 環境變數與憑證管理

兩層架構：**後台設定優先，`.env` fallback**。

- **後台（推薦）**：`/admin` → ⑦ 系統與安全 → 網站全域設定。貼上即生效（15 秒快取），免 SSH 免重啟。
  Secret 類欄位有 field-level access control，只有管理員讀得到，匿名 API 不會外洩。
- **`.env`**：`/var/www/chickimmiu/.env`。範本見 repo 的 `.env.example`。改動需 `pm2 restart`。

App 相關的 key：

```bash
# 網頁 OAuth（NextAuth）
AUTH_GOOGLE_ID= / AUTH_GOOGLE_SECRET=
AUTH_APPLE_ID=  / AUTH_APPLE_SECRET=
AUTH_LINE_CHANNEL_ID= / AUTH_LINE_CHANNEL_SECRET=

# App 原生登入的 audience（後台留空時才用這裡）
AUTH_GOOGLE_IOS_ID=
AUTH_GOOGLE_ANDROID_ID=
AUTH_APPLE_APP_BUNDLE_ID=
```

> Apple 的 client secret 是用 .p8 簽的 JWT、**Apple 規定最長 180 天**。
> 後台貼四欄的話系統會 runtime 自動簽 170 天並在到期前 7 天自動換新，完全免維護。

---

## 9. 已知限制與待辦

| 項目 | 影響 App | 狀態 |
|---|---|---|
| Google / Apple 憑證尚未申請 | **社群登入不可用**（回 403 `PROVIDER_DISABLED`） | ⬜ 等帳號端申請 |
| 綠界物流正式憑證未設定 | 超商取貨 / 宅配下單會失敗 | ⬜ |
| GTM / GA4 / Meta Pixel 未填 | 無成效追蹤 | ⬜ |
| LINE Messaging token 未設定 | 無 LINE 推播 | ⬜ |
| 未實作 refresh token | Token 7 天到期需重新登入（社群登入可靜默重跑 SDK，體感無感） | 視 App 需求再議 |
| 未實作 server-side rate limit | 需靠 App 自律 | 排程中 |
| 無 push notification 服務 | 需另接 FCM / APNs | 未開工 |
| CORS 未開放外部 origin | 原生 App 不受影響；若做 WebView/PWA 需在 `payload.config.ts` 加 `cors` | — |
| SQLite 單寫者 | 高並發寫入（秒殺）需評估換 Postgres | 觀察中 |

---

## 附錄：快速自測指令

```bash
# 1. 服務活著嗎
curl -s -o /dev/null -w '%{http_code}\n' https://pre.chickimmiu.com/

# 2. 網頁端有哪些社群 provider 已啟用（憑證設好才會出現）
curl -s https://pre.chickimmiu.com/api/auth/providers

# 3. Email 登入拿 token
curl -s -X POST https://pre.chickimmiu.com/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"..."}'

# 4. 帶 token 拿會員資訊
curl -s https://pre.chickimmiu.com/api/v1/me -H "Authorization: Bearer <token>"

# 5. 社群登入（憑證設好後才會過）
curl -s -X POST https://pre.chickimmiu.com/api/v1/auth/social \
  -H 'Content-Type: application/json' \
  -d '{"provider":"google","idToken":"<SDK 拿到的 id_token>","nonce":"<原文>"}'
```
