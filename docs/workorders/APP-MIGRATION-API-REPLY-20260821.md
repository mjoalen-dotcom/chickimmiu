# App 遷移需求 — 後端回覆（2026-08-21）

> 對應文件：Google Doc「App 遷移需求」（2026-08-20，doc id `15cqeD0PT3Q-tq5TbzKKpWLyYBUxo0NNY`）
> 實作分支：`line-bc-migration`（customers 已從 users 拆分的架構；部署節奏另行公告）
> 所有新端點皆同時支援 `Authorization: JWT <token>` 與 `Bearer <token>`。

---

## A. 新增端點（全部完成）

### A-1 排行榜 — `GET /api/app/leaderboard?period=all&limit=10` ✅

- 需登入（401 未登入）。`limit` 1–50，預設 10；`period` 目前僅支援 `all`（傳其他值回 400）。
- 回應：

```json
{"success":true,"data":{"period":"all","items":[
  {"rank":1,"name":"王*明","tier":"曦漾仙子","badge":"🦋","points":1200,"gamesPlayed":8}]}}
```

- 與網站 /games 同一資料來源（共用 `lib/games/leaderboardData.ts`）：`game-leaderboard`
  collection（all_time）優先；該表無資料時 fallback 以會員目前點數餘額（`customers.points`）
  排序。**姓名由伺服器遮罩、不含 userId。**
- **排序依據解答**：你們觀察到「第 1 名 totalPoints 380 < 第 2 名 900」的那份是
  `/api/games/leaderboard`（mini-game-records 的遊戲累計積分），與網站顯示的是兩份資料。
  網站（與本端點）目前實際生效的是 fallback 路徑 = **會員現有點數餘額排序**，並非 totalWins。
  `game-leaderboard` 表由 admin/cron 維護，目前為空。
- 網站的今日/本週/本月按鈕確認只是前端狀態，同一份資料 — App 只做 `all` 即可。

### A-2 點數異動紀錄 — `GET /api/app/points/transactions?page=1&limit=20` ✅

- 需登入；只回本人資料（伺服器端鎖 `user = 自己`，不吃 where 參數）。`limit` 上限 50。
- 回應項目：`{id, date:"YYYY-MM-DD", desc, points, type:"earn"|"spend", balance, source, createdAt}`
  ，`meta:{page,totalPages,totalDocs,limit}`。
- 涵蓋所有來源（遊戲、兌換扣點、註冊禮、消費回饋、管理員調整…）— 資料源即網站
  點數中心「紀錄」分頁讀的 `points-transactions` 帳本。

### A-3 社群登入換 Payload JWT — `POST /api/v1/auth/social` ✅（既有端點，本次補 LINE）

這支端點先前已存在（Google / Apple），你們盤點時未發現 — 路徑是 `/api/v1/auth/social`
而非 `/api/users/social-login`。本次補上 **LINE**，三個 provider 全支援：

```json
POST /api/v1/auth/social
{ "provider": "google" | "apple" | "line",
  "idToken": "<App 原生 SDK 取得>",
  "nonce": "<發起授權時的 nonce 原文，建議必帶>",
  "name": "<Apple 首次登入的全名，可選>" }
```

- 回應與 `POST /api/v1/auth/login` 同格式：`{success, data:{token, expiresIn, isNewUser, user:{...}}}`。
  token 即 Payload JWT，直接沿用既有 session 流程（`Authorization: JWT <token>`）。
- 驗證方式：Google/Apple 走 JWKS 本地驗簽；LINE 走官方
  `https://api.line.me/oauth2/v2.1/verify`（LINE id_token 是 HS256/ES256，官方端點代驗）。
- **帳號建立/連結規則與網站 NextAuth callback 是同一份程式**（`lib/auth/socialIdentity.ts`）：
  socialId-first → 已驗證 email 匹配 → 建新會員；LINE 無 email 時用
  `line_<sub>@noemail.invalid` placeholder，之後 `POST /api/users/bind-email` 補綁 —
  App 與網頁登入保證對到同一個會員。
- aud 白名單：Google（web + iOS + Android client id）、Apple（Services ID + App bundle id）、
  LINE（web channel id；App 若用獨立 LINE Login channel，請把 channel id 給我們設進
  `AUTH_LINE_NATIVE_CHANNEL_ID`）。
- provider 未設憑證/未啟用回 403 `PROVIDER_DISABLED`；驗證失敗回 401 `INVALID_ID_TOKEN`。

---

## B. 資料契約（B-1/B-2/B-5/B-6 已修；B-3/B-4 附解答與待拍板項）

### B-1 /api/games 改讀後台設定 ✅

確認屬實：引擎原本完全不讀 `game-settings` 的遊戲參數（只有電影票抽獎有讀）。已修：

1. **簽到**：`day1to6Points` / `day7BonusPoints` / `streakBonusMultiplier` 全部生效，並在
   `GET /api/games` 的 `configs.daily_checkin` 帶出這三個欄位。規則 = 7 天循環：
   循環第 1–6 天發 `day1to6Points`；每滿 7 天（第 7、14、21…天）發 `day7BonusPoints`；
   連續超過 7 天起各日點數 × `streakBonusMultiplier`（捨去小數）。
2. **「5 還是 10」解答**：以後台為準（部署後即發後台值；目前後台設 5，要發 10 請把
   後台改 10 — 這是營運參數，不再是程式寫死）。
3. **轉盤/刮刮樂**：`freePerTier`、`pointsCostPerPlay`、`dailyLimit` 生效；獎池優先序 =
   `PrizePools` collection（有庫存/排程/權重全功能）＞ `game-settings.{spinWheel,scratchCard}.prizes`
   ＞ 程式內建預設。`GET /api/games` 的 `configs.*.prizeTable` 與實際抽獎同一來源。
   另 `configs.*` 新增 `freePerTier` 供 App 顯示各等級次數。
   （注意：settings prizes 的 `movie_ticket` / `free_shipping` 型別引擎不支援，會跳過並
   log 警告 — 這兩類請用 PrizePools 設。）

### B-2 獎品唯一識別 ✅

- `configs.*.prizeTable[]` 每項帶 `id`（PrizePool doc id 或後台 prizes array row id；
  內建預設表為 `null`）。
- `POST /api/games` 中獎回應的 `prize` 物件帶同一個 `id`（fallback 表為 `null`，
  維持你們現行「名稱優先、type+amount 備援」即可）。

### B-3 同組設定散落三處 — 部分收斂，權威來源建議如下（待 Alan 拍板後全面收斂）

- **遊戲免費次數 / 每日上限 / 加購點數**：權威 = `game-settings`（本次已接通，實際生效）。
  `loyalty-settings.gameConfig.DailyPlays` 與 `membership-tiers.lotteryChances` 建議降級為
  顯示用/廢棄欄位 — 本次未動它們（怕別處引用），App 顯示請一律改讀
  `GET /api/games` 的 `configs.*.freePerTier`。
- **點數倍率**：訂單發點實際讀的是 `loyalty-settings.tierMultipliers`（`{tier}Multiplier`），
  不是 `membership-tiers.pointsMultiplier` — 鑽石 2.5 vs 3 的分歧中，**生效的是 2.5**。
  兩處統一需要 Alan 決定保留哪份。
- `/games` 頁「等級越高福利越多」表格是前端寫死 — 已知，待前台改讀真實設定（另案）。

### B-4 消費欄位與升降級 — 解答（程式行為查證結果）

- **totalSpent 是舊欄位**：訂單付款 hook 同時累加 `totalSpent` 與 `lifetimeSpend`（並行維護），
  但**全站讀取（等級、/account 顯示）以 `lifetimeSpend` 為準**。App 目前的做法
  （等級比對 lifetimeSpend、年度維持比對 annualSpend）正確，維持即可。
- **升級有在執行，但只在「訂單付款完成」當下觸發**（只升不降）；降級由
  `/api/cron/annual-tier-reset` 年度重算。**admin 手動改消費金額不會觸發重算** —
  這就是 id 7（lifetimeSpend 100,000、等級空）的成因：值是手動改的，沒有訂單經過 hook。
- **id 8（3,680 = 銅牌）的成因**：升級引擎目前用程式內建門檻
  （bronze lifetime 3,000 / annual 1,500…），**不是** `membership-tiers.minSpent`（5,000）。
  3,680 ≥ 3,000 所以升銅 — 引擎自洽，但與後台/前台顯示的門檻不一致。
  修正方向（改讀 membership-tiers + 手動改值後補重算）已列入待 Alan 拍板項，
  因為會實際改變會員升級門檻。
- **annualSpentThreshold（年度維持門檻）**：規則存在且年度 cron 會執行降級，
  前台確實沒有揭露 — 已回報營運補前台文案（App 先維持只列在對照表的做法）。

### B-5 每日遊戲點數上限 ✅

`GET /api/games` 新增：

```json
"dailyPointsCap": { "limit": 500, "earnedToday": 120, "remaining": 380 }
```

口徑：`points-transactions` 中 `source=game` 的正數進帳、Asia/Taipei 日界 — 伺服器權威，
App 不必自行加總。

### B-6 兌換商品 badge ✅

`GET /api/v1/points` 每個項目新增 `badge` 欄位（可為 null），與網站 `/account/points`
同一套規則（即將售完 / 熱門 / 驚喜 / 愛心 / 專屬 / VIP；門檻讀
`point-redemption-settings.scarcity`）。前端只負責上色。

---

## C. 產品決策（需 Alan 拍板）

1. **同 Email 是否同一會員**：現況（網頁與 App 同一份程式）= **是，但僅限 provider
   已驗證的 email**（Google 認 `email_verified=true`、Apple 認 `email_verified`、
   LINE 回傳即已驗證、Facebook 一律不採信）。未驗證 email 不做匹配、走 placeholder
   建新帳號 — 已防冒用接管。若要改為「一律不自動連結」需 Alan 拍板。
2. **排行榜顯示名稱**：現況 = 遮罩真名（後端遮罩）。若要可辨識暱稱，需在 customers
   加公開暱稱欄位（schema + migration + 全站顯示點），待 Alan 立項。

---

## D. 資安發現（全部修補）

| 項 | 修補 |
|---|---|
| D-1 | `memberTier`、`referralCode`、`referredBy` 欄位 update 鎖 admin-only（customers 與 users 兩表都鎖）；`adminPermissions` group update 鎖 admin-only。系統流程（升等/產碼/註冊綁定）走 local API 不受影響。`email` 維持可改（bind-email 依賴），已知項。 |
| D-2 | `coupons` collection read 收斂 admin-only — 會員不再能列出他人券號。結帳驗券走 server 端（不受影響）；App 維持用 `GET /api/user-rewards?depth=0`。 |
| D-3 | `GET /api/games/leaderboard` 與 `GET /api/games` 的 leaderboard 姓名一律伺服器遮罩、移除 userId。`game-leaderboard` collection REST read 也收斂 admin-only。 |
| D-4 | `user-rewards.user` 欄位鎖 `maxDepth: 0` — 任何 depth 參數下都只回會員 id，不再內嵌完整 user 物件。 |

---

## E. App 現用端點

遊戲/點數/兌換/寶物箱等業務端點路徑與回應形狀全部不變；本次只有**新增**欄位
（`configs.*` 加 `id`/`freePerTier`/簽到三欄位、`dailyPointsCap`、`/api/v1/points` 加
`badge`、user 物件加 `nickname`）。

⚠️ **確定事項（部署同批生效）**：顧客帳號已從 users 拆成獨立的 customers collection。
部署後 `/api/users/*` 只服務後台人員，App 的會員認證端點請改為：

| 原（E 表） | 改為 | 備註 |
|---|---|---|
| POST /api/users/login | **POST /api/customers/login**（或建議 POST /api/v1/auth/login） | 回應格式相同 |
| /api/users/register、/forgot-password、/logout | /api/customers/同名 | 格式相同 |
| GET /api/users/me | GET /api/customers/me（或 GET /api/v1/me） | |
| POST /api/users/refresh-token | POST /api/customers/refresh-token | |
| PATCH /api/users/{id} | PATCH /api/customers/{id} | 白名單欄位可加 `nickname` |
| POST /api/users/bind-email | POST /api/customers/bind-email | |

既有 token 於部署當下全數失效（session 不搬），所有會員（網頁+App）需重新登入。
切換日會提前通知。

## C-2 補充（已實作）

`customers.nickname`（公開暱稱，上限 20 字，本人可自行 PATCH）已上線同批：
排行榜有暱稱顯示暱稱原文、未設定仍顯示遮罩姓名；`/api/v1/auth/login`、`/api/v1/auth/social`、
`/api/v1/me` 的 user 物件均新增 `nickname` 欄位（null = 未設定）。

---

## 部署前營運確認（給 Alan）

1. `game-settings` 後台值部署後**即生效**，請先核對：簽到 5 點（要 10 改 10）、
   轉盤 freePerTier（後台預設一般會員 0 次 vs 現行程式 1 次）、刮刮樂 dailyLimit
   （後台 5 vs 現行 8）、穿搭挑戰 dailyLimit（後台 5 vs 現行 10）。
2. 簽到第 7 天大獎改為「每滿 7 天循環發放」+ 超過 7 天倍率 — 與後台欄位語意及前台
   7 格循環 UI 對齊，屬行為變更。
