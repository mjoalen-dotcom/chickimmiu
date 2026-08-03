# 金老佛爺 × CHIC KIM & MIU — APP 開發技術手冊

> 對象：App 程式人員（iOS / Android）
> 版本：v1.0 · 2026-08-03
> 姊妹文件：[APP_INTEGRATION_HANDBOOK.md](APP_INTEGRATION_HANDBOOK.md)（伺服器/架構背景）· [api/v1.md](api/v1.md)(逐條 API 規格)· [OAUTH_GOOGLE_APPLE_SETUP.md](OAUTH_GOOGLE_APPLE_SETUP.md)（憑證申請）

---

## 1. 產品概觀：一個 App、兩個品牌面、一套會員

這個 App 同時承載兩個品牌：

| 品牌面 | 內容 | 資料來源 |
|---|---|---|
| **金老佛爺（Kim Lafayette）** | 部落格文章、穿搭內容、看文章賺點數 | CKMU 後端的 `blog-posts`（經 feed API） |
| **CHIC KIM & MIU（CKMU）** | 商城：商品、購物車、結帳、訂單、點數商城、遊戲、會員 | CKMU 後端全套 API |

**只有一個後端、一份會員資料庫**（`https://pre.chickimmiu.com`，上線後 `https://www.chickimmiu.com`）。
會員在網頁註冊、在 App 登入、在金老佛爺部落格看文章 —— 全部是同一個帳號、同一份點數。
App 端**不需要**對接 kimlafayette.com 的任何伺服器；金老佛爺的內容也從 CKMU 後端拿。

```
┌─────────────── App（你要做的）───────────────┐
│  ┌─────────────────┐  ┌────────────────────┐ │
│  │ 金老佛爺 內容面    │  │ CKMU 商城面         │ │
│  │ 文章列表/內文     │  │ 商品/購物車/結帳     │ │
│  │ 看文章賺點數      │  │ 訂單/點數/遊戲/會員   │ │
│  └────────┬────────┘  └─────────┬──────────┘ │
└───────────┼─────────────────────┼────────────┘
            │  全部走同一個 API base │
            ▼                     ▼
   https://pre.chickimmiu.com/api/**   ← Bearer token 認證
            │
            ▼
     SQLite（唯一真相：users / orders / points / blog-posts …）
```

---

## 2. 環境與通則

### Base URL

| 環境 | Base | 說明 |
|---|---|---|
| 封測（現行） | `https://pre.chickimmiu.com` | 目前唯一環境，資料是真的 |
| 正式（切換後） | `https://www.chickimmiu.com` | 上線時切換，兩網域會並行一段時間 |

- **Base URL 必須做成可設定**（remote config 或至少 build flavor），不要寫死。
- `/api/**` 永遠不會 301 轉址；App 收到 3xx 表示打錯路徑，不要自動跟隨。
- 全部走 HTTPS，無 certificate pinning 要求（可自行加，注意 Let's Encrypt 90 天輪替）。

### 認證通則

拿到 token 後，所有需要會員身分的 API 都帶：

```
Authorization: Bearer <token>
```

- Token 效期 **7 天**（登入回應的 `expiresIn`，單位秒）。過期 → 401 → 重新登入。
- **沒有 refresh token**。社群登入的 App 可在 401 時靜默重跑一次 SDK 換新 token（使用者無感）；email 登入則要求重新輸入密碼。
- 不需要 cookie jar、不需要 CSRF token（Bearer 不吃 CSRF）。
- Token 是 JWT，但**不要在 App 端解析它做業務判斷**，一律以 API 回傳的資料為準。

### 統一錯誤格式

```json
{ "success": false, "error": "<人類可讀訊息（中文，可直接顯示）>", "code": "<機器碼>" }
```

| code | HTTP | 處理建議 |
|---|---|---|
| `BAD_REQUEST` | 400 | 參數缺漏，開發期修掉 |
| `UNAUTHORIZED` | 401 | token 過期/無效 → 走重新登入流程 |
| `INVALID_ID_TOKEN` | 401 | 社群登入 id_token 驗不過（見 §3.3 排錯表） |
| `FORBIDDEN` | 403 | 權限不足；遊戲 API 會帶 `requiresTermsAcceptance: true` → 彈規範同意 |
| `PROVIDER_DISABLED` | 403 | 該社群登入未啟用（後台開關/憑證未設） |
| `NOT_FOUND` | 404 | 資源不存在 |
| `INTERNAL_ERROR` | 500 | 顯示通用錯誤 + 重試按鈕 |

> 部分較早的 endpoint（如 `/api/payment/ecpay/create`）只回 `{ "error": "..." }` 沒有 `success` 欄位，
> 錯誤處理請以 **HTTP status ≥ 400** 為準，`error` 欄位有就顯示。

### 分頁通則（v1 系列）

```json
{ "success": true, "data": [...], "meta": { "page": 1, "totalPages": 8, "totalDocs": 152, "hasNextPage": true, "hasPrevPage": false } }
```

### 圖片 URL

- 金老佛爺 feed API 回的圖是**絕對 URL**，直接載。
- 商品等其它 API 的 media 物件，`url` 可能是相對路徑（`/api/media/file/...`）——**相對路徑一律補上 base URL**。
- 圖檔在 Cloudflare R2，支援標準 HTTP caching；App 端請開 image cache。

---

## 3. 認證與會員

### 3.1 登入方式總表

| 方式 | Endpoint | 平台 | 狀態 |
|---|---|---|---|
| Email + 密碼 | `POST /api/v1/auth/login` | 全部 | ✅ 可用 |
| Google 原生 | `POST /api/v1/auth/social` | iOS / Android | ✅ 程式就緒，⬜ 等憑證 |
| Apple 原生 | `POST /api/v1/auth/social` | iOS（**必做**，App Store 規定） | ✅ 程式就緒，⬜ 等憑證 |
| LINE | — | — | ❌ App 原生尚未支援（見 §9 待辦；勿用 WebView cookie 硬接） |
| 註冊（email） | `POST /api/users/register` | 全部 | ✅ 可用（成功後再打 login 拿 token） |

> **Apple 審核紅線**：App 只要提供任何第三方登入（Google），就**必須**同時提供 Sign in with Apple，否則會被拒審。

### 3.2 Google / Apple 原生登入流程

```
App                                後端 /api/v1/auth/social            Google / Apple
 │ 1. 產生隨機 nonce（存著）              │                                  │
 │ 2. 系統 SDK 發起登入（帶 nonce）───────┼─────────────────────────────────►│
 │◄──────────── id_token ──────────────┼──────────────────────────────────┤
 │ 3. POST { provider, idToken,        │                                  │
 │          nonce, name } ────────────►│ 4. JWKS 驗簽 + iss/aud/exp/nonce  │
 │                                     │ 5. socialId-first 找/建會員        │
 │◄─── { token, expiresIn,             │ 6. 簽發 Bearer token              │
 │       isNewUser, user } ────────────┤                                  │
 │ 7. 存 token（Keychain/Keystore）     │                                  │
```

**Request**：

```jsonc
POST /api/v1/auth/social
{
  "provider": "google",          // 或 "apple"
  "idToken":  "<SDK 拿到的 id_token>",
  "nonce":    "<步驟 1 的 nonce 原文>",   // 可選但強烈建議（防重放）
  "name":     "王小明"                   // Apple 首次登入務必帶（見下）
}
```

**Response 200**：

```jsonc
{
  "success": true,
  "data": {
    "token": "<JWT>",
    "expiresIn": 604800,
    "isNewUser": true,           // true → 跑新手引導/首購禮
    "user": { "id": 1234, "email": "...", "name": "...", "points": 0,
              "shoppingCredit": 0, "memberTier": {...}, "gameTermsAcceptance": null }
  }
}
```

**平台實作要點**：

| 平台 | 要點 |
|---|---|
| iOS Google | Google Sign-In SDK；後端已登記你的 **iOS Client ID** 才會過（`aud` 檢查） |
| Android Google | Credential Manager（Sign in with Google）；後端要登記 **Android/Web Client ID**（依 SDK 拿到的 id_token `aud` 為準，實測哪一個就登記哪一個） |
| iOS Apple | `ASAuthorizationAppleIDProvider`；`nonce` 端上送 **SHA256**、POST 給我們 **原文**（後端兩種都比對）；後端要登記 **App Bundle ID** |

**⚠️ Apple 的 email 與全名只有「使用者第一次授權」才會給。**
首次登入務必把 `fullName` 組成字串放進 `name` 欄位一起 POST，錯過就永遠拿不到（會員名字會變成 email 前綴）。
使用者選「隱藏我的電子郵件」時會拿到 `xxx@privaterelay.appleid.com` —— 這是正常會員，照常處理。

### 3.3 `INVALID_ID_TOKEN` 排錯表

| 情境 | 原因 |
|---|---|
| 剛接就 401 | 你的 iOS/Android client id 還沒登記到後台「社群登入設定」的 App 欄位 |
| Google 過、Apple 不過 | Bundle ID 沒登記，或 nonce 傳成 SHA256 後的值（要傳原文） |
| 偶發 401 | id_token 過期（SDK 拿到後放太久才送）— 拿到就立刻交換，不要囤 |
| 模擬器過、實機不過 | 實機簽名（SHA-1/Team）跟 console 登記的不符 |

### 3.4 會員資料

- **開機/回前景**：`GET /api/v1/me` 一次拿 user + wallet（points/shoppingCredit/storedValueBalance）+ 寶物箱摘要 + 遊戲規範狀態。**不要低於 5 秒打一次**。
- 會員等級在 `user.memberTier`（`frontName` 是前台顯示名，男女會員顯示名不同，直接顯示它，不要自己 map）。
- `gameTerms.requiresAcceptance = true` → 進遊戲前必須彈規範 modal，`POST /api/games/accept-terms`。
- 登出：刪本地 token 即可；要伺服器端撤銷再打 Payload 的 `POST /api/users/logout`。

---

## 4. 金老佛爺內容面

### 4.1 文章列表 + 內文 — `GET /api/kim-blog/feed`

**免登入**。一次回全部已發佈文章（`publishedAt` 新→舊），有 **ETag**：

```
GET /api/kim-blog/feed
If-None-Match: "<上次的 etag>"     → 304 就用本地快取
Cache-Control: public, max-age=60, stale-while-revalidate=300
```

**Response**：

```jsonc
{
  "version": 1,
  "scope": "public",
  "generatedAt": "2026-08-01T12:00:00.000Z",   // 內容版本指紋，變了才需要重新渲染
  "posts": [
    {
      "id": "payload-123",
      "slug": "seoul-fashion-week-2026",        // ← 看文章賺點數要用這個
      "title": "首爾時裝週直擊",
      "excerpt": "…",
      "excerptCta": { "enabled": true, "label": "立即購買", "url": "https://…" } , // 或 null
      "visibility": "public",                   // public / unlisted / password
      "seo": { ... },
      "category": "穿搭",
      "tags": ["首爾", "OOTD"],
      "publishedAt": "…",
      "viewCount": 1234,
      "featuredImage": "https://…",             // 絕對 URL
      "imageCount": 6,
      "html": "<p>…</p>",                       // 文章內文（已序列化的 HTML）
      "images": [{ "src": "https://…", ... }]
    }
  ]
}
```

**App 端實作建議**：

- 內文是 **HTML 字串** → 用 WebView 或 HTML renderer 顯示（圖已是絕對 URL）。整包 JSON 可能到數 MB，**快取 + ETag 是必須**，列表頁只解 `title/excerpt/featuredImage`。
- `visibility` 處理：`public` 正常顯示；`unlisted` 不進列表（有 slug 才開）；`password` 這版 App 先不支援（feed 公開 scope 拿不到密碼 hash，直接不顯示）。
- `excerptCta` 有值時，在文章卡片/內文顯示購買按鈕，`url` 多半導去 CKMU 商品頁 → 攔截成 App 內商品頁（見 §8 deep link）。
- 追蹤瀏覽：`POST /api/kim-blog/analytics/track`（body 帶 slug；公開、免登入、fire-and-forget）。

### 4.2 看文章賺點數（read-reward）

**規則（後台/env 可調，以下是現行值）**：

| 規則 | 值 |
|---|---|
| 每篇文章 | +5 點（× 會員等級/訂閱倍率，無條件捨去、最少 1 點） |
| 每人每篇 | 終身一次 |
| 每人每日 | 3 篇（**台北時區**換日） |
| 最短停留 | 20 秒（App 端計時，未滿不要送） |

**⚠️ App 端目前「不能」直接呼叫 `/api/sso/points/read-reward`** —— 那是 blog.kimlafayette.com 靜態站 PHP 端的 **server-to-server** 介面，要帶 `client_secret`，而 **secret 絕不可打包進 App**（反編譯就洩漏）。

**現況與計畫**：
- App 版 Bearer 認證的 read-reward endpoint（`POST /api/v1/points/read-reward`，帶 `slug` + `dwell_seconds`）已列開發待辦（§9），後端一天內可加。
- **在那之前**：App 先把「停留計時 + slug」本地實作好，UI 預留「+5 點」回饋動畫位；endpoint 上線後只補一個 API call。
- Response 合約會沿用現行 server 端版本：`{ awarded: 5, points: 580, reason: null }`；不給分時 `awarded: 0` + `reason: "already_rewarded" | "daily_limit" | "dwell_too_short"`（HTTP 都是 200，不要當錯誤跳 toast，靜默處理即可）。

### 4.3 不要做的事

- ❌ 不要 WebView 載入 `blog.kimlafayette.com` 當內容面 —— 那邊的會員 session（PHP `kim_member_session`）跟 App 的 Bearer token 是兩套，點數會對不上，體驗也差。內容一律走 feed API 原生渲染。
- ❌ 不要爬 `www.kimlafayette.com` 的 HTML。

---

## 5. CKMU 商城面

### 5.1 商品

| 功能 | Endpoint | 認證 |
|---|---|---|
| 商品列表 | `GET /api/v1/products?page=&limit=&category=&tag=new|hot&sort=&search=&minPrice=&maxPrice=` | 免 |
| 商品詳情 | `GET /api/products/<id>`（Payload REST，含 variants/尺寸表關聯） | 免 |
| AI 推薦 | `GET /api/v1/recommendations?type=trending|similar|also_bought|personalized|body_match&productId=&userId=&limit=4` | 免（personalized 給 userId） |
| UGC 牆 | `GET /api/v1/ugc?page=&limit=&platform=&location=` | 免 |

- `limit` 上限 100（products）/ 50（ugc）。
- 商品 `status: active` 才會出現在列表；詳情頁拿到 404 = 已下架，顯示「商品已下架」。
- 價格欄位以 API 回傳為準（`price` / `originalPrice`），**不要在 App 端自己算折扣**——加購/滿贈/組合價規則都在後端。

### 5.2 購物車

**購物車是 App 本地狀態**（網頁端也是 client-side store），後端沒有 cart collection。
結帳前用這些 API 校驗：

| 功能 | Endpoint |
|---|---|
| 套用優惠券 | `POST /api/cart/apply-coupon`（body: code + 車內容） |
| 滿額贈查詢 | `POST /api/cart/gifts` |
| 加購品查詢 | `POST /api/cart/add-ons` |
| 結帳設定（運費/門檻/付款方式開關） | `GET /api/checkout-settings` |

> 這幾條在網頁端走 cookie，也接受 Bearer。實測時若遇到 401，回報後端補 Bearer 分支——合約不變。

### 5.3 結帳（二段式）+ 綠界付款

```
1. POST /api/orders               ← 建 pending/unpaid 訂單（Payload REST，Bearer）
   body: items[] / 收件資訊 / paymentMethod: "ecpay" / shippingMethod / …
   → 拿 orderNumber

2. POST /api/payment/ecpay/create ← body: { "orderNumber": "..." }
   → { "action": "<綠界結帳 URL>", "params": { MerchantID, MerchantTradeNo, CheckMacValue, ... }, "sandbox": false }

3. App 開 WebView：把 params 組成 <form method="POST" action="{action}"> 自動 submit
   → 使用者在綠界頁面完成刷卡/ATM/超商代碼

4. 綠界 server-to-server 回帳給後端（App 不用管 callback）
   WebView 監聽導回 /checkout/success* → 關 WebView → GET /api/orders/<id> 確認 paymentStatus
```

**要點**：
- 付款頁**必須 WebView**（綠界 hosted page），不要嘗試自己收卡號（PCI 紅線）。
- 成功判定以 **重新查訂單的 `paymentStatus === 'paid'`** 為準，不要只信 WebView 導回 URL。
- ATM/超商代碼是「非同步付款」：使用者拿到繳費代碼、訂單維持 pending —— UI 要有「待付款」狀態＋繳費資訊顯示。
- 未付款訂單**10 分鐘級距自動取消**（後端排程），App 訂單列表要能反映 cancelled。
- 訂單查詢：`GET /api/orders?where[user][equals]=<userId>`（只查得到自己的）；取消：`POST /api/account/orders/<id>/cancel`。
- 超商取貨的門市地圖選擇：封測網頁走綠界電子地圖（跨域 form POST），App 先做宅配 + 既有門市手填，門市地圖整合列 §9 待辦。

### 5.4 點數商城 / 寶物箱 / 遊戲

| 功能 | Endpoint | 說明 |
|---|---|---|
| 可兌換清單 | `GET /api/v1/points` | 免登入可瀏覽 |
| 兌換 | `POST /api/v1/points` | Bearer；type 含實體/優惠券/購物金/抽獎/盲盒… 兌換結果進寶物箱 |
| 寶物箱 | `GET /api/user-rewards?where[user][equals]=<id>` | 優惠券/獎品；`requiresPhysicalShipping: true` 的實體獎會自動附掛下一筆訂單 |
| 電子券核銷 | `POST /api/user-rewards/consume` | body: `{ rewardId }` |
| 遊戲總覽 | `GET /api/games` | 簽到/轉盤/刮刮樂/電影抽獎/穿搭挑戰 狀態 |
| 玩 | `POST /api/games` | `{action:"checkin"}` / `{action:"play",gameType:"spin_wheel"|...}`；規格見 [api/v1.md](api/v1.md) §6 |
| 同意遊戲規範 | `POST /api/games/accept-terms` | 403 + `requiresTermsAcceptance` 時先走這條 |

點數異動歷史可用 `GET /api/points-transactions?where[user][equals]=<id>&sort=-createdAt`（只看得到自己的）。
**點數餘額永遠以 `/api/v1/me` 的 `wallet.points` 為準**，App 不要自己加減後顯示。

### 5.5 訂閱會員（綠界定期定額）

- 方案列表 `GET /api/subscription-plans`；訂閱/解約流程目前**先導 WebView 到網頁 `/subscription`**（首期綁卡是綠界頁面，本來就要 WebView）。
- 訂閱權益（點數倍率 1.5x、購物金、結帳折扣）後端自動生效，App 不用另外處理——`memberTier` 與 `/api/v1/me` 會反映。

---

## 6. 點數經濟總覽（兩品牌共用）

| 來源 | 點數 | 在 App 的位置 |
|---|---|---|
| 消費回饋 | 依後台規則（× 等級/訂閱倍率） | 付款完成後自動入點 |
| **金老佛爺看文章** | +5/篇、日限 3 篇（× 同一套倍率） | 內容面（§4.2） |
| 每日簽到 / 遊戲 | 各遊戲規則 | 遊戲面 |
| 兌換消費 | 扣點 | 點數商城 |

同一套倍率規則（會員等級 + 訂閱）由後端統一計算 —— **App 永遠只顯示後端回傳的數字**。

---

## 7. 通知與即時性

- **Push（FCM/APNs）尚未建置**（§9 待辦）。先用「回前景刷新 `/api/v1/me` + 訂單列表」策略。
- 訂單狀態變化（出貨/取消）目前靠 Email + LINE 通知（後端既有），App 內先做拉取式更新。

---

## 8. Deep Link

建議 scheme + Universal/App Links 都上：

| 連結 | 導向 |
|---|---|
| `chickimmiu://products/<id>` | 商品頁 |
| `chickimmiu://orders/<id>` | 訂單詳情 |
| `chickimmiu://games` / `chickimmiu://games/scratch-card` | 遊戲 |
| `chickimmiu://account/treasure` | 寶物箱 |
| `chickimmiu://blog/<slug>` | 金老佛爺文章 |

Universal Links 網域：`www.chickimmiu.com`（上線後）。
金老佛爺 feed 的 `excerptCta.url` 若指向 `chickimmiu.com/products/...`，App 內攔截轉原生商品頁。

---

## 9. 現況紅綠燈 + 待辦（後端側）

| 項目 | 狀態 | App 端因應 |
|---|---|---|
| Email 登入/註冊、me、商品、遊戲、點數商城、寶物箱 | 🟢 可立即串 | — |
| 金老佛爺 feed + 文章 | 🟢 可立即串 | — |
| Google/Apple 原生登入 | 🟡 程式就緒，**等憑證申請 + App client id 登記** | 先接 SDK，401 屬預期 |
| App 版看文章賺點數 endpoint | 🔴 待開發（Bearer 版，合約見 §4.2） | 先做計時 + UI 預留 |
| 綠界付款 | 🟡 沙盒可測；正式商店 3018203 尚無真實交易 | WebView 流程照 §5.3 |
| 超商取貨門市地圖 | 🔴 App 整合待定 | 先宅配 |
| LINE 原生登入 | 🔴 未支援 | 不做，勿 hack |
| Push (FCM/APNs) | 🔴 未建置 | 拉取式更新 |
| Rate limit | 無（自律：me ≥5s、遊戲按鈕等 response） | 之後上 429 |

> 🔴 項目每一條後端都已有明確方案，App 端按表預留即可，不要自己繞路實作。

---

## 10. 上架前驗收清單

- [ ] Base URL 可切換（pre ↔ www）
- [ ] Apple 登入在（有 Google 登入時）已提供，且首次登入有送 `fullName`
- [ ] token 過期（401）→ 靜默重登或導登入頁，不閃退
- [ ] 綠界 WebView：成功以訂單 `paymentStatus` 為準；ATM/超商代碼有「待付款」UI
- [ ] 金老佛爺 feed 有 ETag 快取；`visibility != public` 文章不外洩
- [ ] 點數/餘額全部顯示後端數字，無本地運算
- [ ] 遊戲 403 `requiresTermsAcceptance` 有規範同意流程
- [ ] 深色模式下品牌色對比 ≥ 3:1（設計規範：所有 UI 邊線需明度對比，勿只靠色相）

## 11. 快速自測

```bash
# 金老佛爺文章 feed（免登入）
curl -s https://pre.chickimmiu.com/api/kim-blog/feed | head -c 600

# 商品列表
curl -s "https://pre.chickimmiu.com/api/v1/products?limit=2&tag=hot"

# email 登入 → me
TOKEN=$(curl -s -X POST https://pre.chickimmiu.com/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"<測試帳號>","password":"<密碼>"}' | jq -r .data.token)
curl -s https://pre.chickimmiu.com/api/v1/me -H "Authorization: Bearer $TOKEN"

# 社群登入（憑證登記後）
curl -s -X POST https://pre.chickimmiu.com/api/v1/auth/social \
  -H 'Content-Type: application/json' \
  -d '{"provider":"google","idToken":"<SDK id_token>","nonce":"<原文>"}'
```

---

*文件維護：改 API 合約時同步更新本手冊與 [api/v1.md](api/v1.md)；問題回報請附 endpoint、request body（去敏）、response 與時間戳。*
