# App 專屬活動：發獎與資料遷移 — 網站端回覆（2026-09-01）

> 對應文件：Google Doc「App 專屬活動：發獎與資料遷移」（2026-08-25，
> doc id `19e6vCFiAWu8RSRH3SGlj-dl-gBoWA3dx`）
> 已全部實作並部署 pre。程式：`c05aab0`→`2858896`。

三項活動的資料結構、後台設定與端點都已就緒，**可以開始串接**。以下依你們文件的
章節順序回覆，最後附完整端點清單與錯誤碼表。

---

## 一、共通規則 — 全部照辦

| # | 規則 | 落點 |
|---|---|---|
| 1 | 金金幣→點數、經驗積分不再發放 | 後台設定裡**只有點數欄位**，沒有金幣/積分欄位 |
| 2 | 獎勵數值後台可調 + 端點供 App 讀取 | `GET /api/app/activities/settings`（不需登入） |
| 3 | 發獎由後端驗證，App 不得指定數量 | 所有領獎端點只收「領哪個里程碑／哪篇文章」，點數一律取自後台設定 |
| 4 | 加點與異動紀錄同一交易、只加一次 | 統一走 `lib/app-activities/award.ts`，一個 DB 交易內完成 |
| 5 | 錯誤碼可辨識 | 固定形狀 `{ success:false, code, error }`，`code` 表在文末 |
| 6 | 既有資料不轉移 | 未搬任何舊資料；新紀錄建在 Payload，新圖片進 media |

關於 #4 補充一個實作細節：`points-transactions` 有個 hook 會在 REST 寫入時同步
`customers.points`，但走 local API 時會跳過。我們的發獎走 local API，所以餘額由發獎
流程自己更新 —— 兩邊只會有一邊生效，不會重複加值。這點已用測試釘住。

---

## 二、活動一：愛旅遊 閱讀獎勵

- 設定：`travelRead.isActive`、`travelRead.pointsPerArticle`
- 資料表：`travel-read-rewards`（user / articleId / articleTitle / pointsAwarded / claimedAt）
- **`user + articleId` 複合唯一索引**已建，即「同篇只能領一次」的冪等保證；建立紀錄與
  加值在同一交易內，不會出現「已記錄、但點數未加」
- `articleId` 只存字串、不與 Payload 文章關聯（照你們的說明）

端點：

| 用途 | 端點 |
|---|---|
| 查是否已領 | `GET /api/app/travel/read-status?articleId=xxx` |
| 領取 | `POST /api/app/travel/read-claim` `{ articleId, articleTitle? }` |

`read-status` 會一併回 `isActive` 與 `pointsPerArticle`，進文章頁一次就能決定要不要
顯示獎勵提示、以及提示上要寫幾點。

---

## 三、活動二：團購 好物分享

資料表四張：`group-buy-shares`、`group-buy-share-comments`、`group-buy-order-claims`
（訂單去重）、`content-reports`（檢舉）。刻意另開，沒有沿用 product-reviews（理由同你們文件）。

你們列的規則我逐條實作，其中幾條容易踩雷的，說明我怎麼做的：

- **發獎時機是審核通過時**，不是送出時。送出只建 `pending`。
- **同會員同文章只有第一篇發獎**：查該會員在該文章是否已有任一筆 `rewarded`（含已刪除的），
  沒有做成唯一約束 —— 照你們提醒的，那會連第二篇的發文本身都擋掉。
- **編輯退回 pending 再通過不重複發獎**（`rewarded` 已為真）。
- **精選加碼的冪等用 `featuredAt`，不是 `isFeatured`** —— 後台取消精選再標記時，
  `featuredAt` 已有值就只補回 `isFeatured: true`，不重發。`featuredAt` 一經寫入不覆蓋。
- **離開 approved 自動把 `isFeatured` 設回 false**（不佔精選版位），`featuredAt` 保留。
- **訂單去重**跨帳號生效；他人用過就擋，本人重用自己的可以發文（是否發獎回到上一條判斷）；
  刪除或退件都不釋放。
- **可編輯期限**一律「建立時間 + 設定時數」，與審核進度無關；逾期不可編輯。
- **編輯只能改內容與照片**；文章、訂單編號、購買日期不可改。
- **留言最多兩層**：傳入的 `parentCommentId` 若本身是一則回覆，後端會解析回它的頂層留言再存。
- **`commentCount` 只計 published**，隱藏留言即時不計入。
- 圖片上傳**收窄為 jpeg / png / webp**（media 本身允許影片與 PDF，這裡不收）。

端點：

| 用途 | 端點 |
|---|---|
| 可分享文章清單 | `GET /api/app/group-buy/articles?page&limit`（limit 上限 200，舊文章都在） |
| 圖片上傳 | `POST /api/app/group-buy/upload`（multipart，欄位名 `file`）→ `{ mediaId, url }` |
| 建立分享 | `POST /api/app/group-buy/shares` `{ articleId, orderNumber, purchaseDate, content, photoIds[] }` |
| 讀取清單 | `GET /api/app/group-buy/shares?status&isFeatured&user&article&page&limit` |
| 讀取單篇 | `GET /api/app/group-buy/shares/{id}` |
| 編輯 | `PATCH /api/app/group-buy/shares/{id}` `{ content?, photoIds? }` |
| 刪除 | `DELETE /api/app/group-buy/shares/{id}`（軟刪除） |
| 讀留言 | `GET /api/app/group-buy/comments?reviewId&page&limit`（createdAt 由舊到新） |
| 建立留言 | `POST /api/app/group-buy/comments` `{ reviewId, content, parentCommentId? }` |
| 檢舉 | `POST /api/app/reports` `{ targetType, targetId, reason, reasonDetail? }` |

清單預設排序即你們要的「精選優先，其次 createdAt 由新到舊」，可見性規則
（他人只看得到 approved、作者可額外看到自己的 pending / rejected、deleted 無人可見）
統一在後端強制，所有查詢介面一致。

作者資訊照你們指定：**顯示名稱取 `nickname`，未設定時回遮罩姓名，絕不回 `name`**；
頭像取 `avatar`。`orderNumber` 不回傳前台。

---

## 四、活動三：散步趣

- 設定：`stepChallenge.isActive`、`dailyMilestones[]`、`weeklyMilestone`
- 資料表：`step-daily-records`（`user + date` 唯一）、`step-weekly-records`（`user + weekId` 唯一）
- 週累計**不另存欄位**，領獎時從當週每日紀錄即時加總

驗證規則都照做了：

- `date` 只接受今日（Asia/Taipei 00:00 換日），其餘**靜默忽略**（回目前採計值，不報錯）
- 同日步數**只允許遞增**，較小的值靜默忽略
- **不設單日上限**
- 活動關閉時**步數上傳照常接收**，只有兩個領獎端點會擋
- **週次由後端算**，App 不傳 `weekId`

端點：

| 用途 | 端點 |
|---|---|
| 讀取狀態 | `GET /api/app/steps/status`（今日步數、已領里程碑、本週累計、本週是否已領） |
| 上傳步數 | `POST /api/app/steps/upload` `{ date, steps }` → 回**伺服器採計後**的步數 |
| 領每日 | `POST /api/app/steps/claim-daily` `{ date, milestone }` |
| 領每週 | `POST /api/app/steps/claim-weekly`（無參數） |
| 步數歷史 | `GET /api/app/steps/history?page&limit` |

步數不足時回應會帶 `steps` 與 `required`；里程碑不存在會把目前的 `milestones` 一起回，
方便你們直接更新畫面。

---

## 五、點數異動紀錄

`points-transactions` 的 `source` 已新增五個值，沒有併進 `kim_blog_read` 或 `review`：

`travel_article_read`、`step_activity`、`step_activity_weekly`、`product_review`、
`product_review_featured`

**「小金庫」要的端點已經存在**：`GET /api/app/points/transactions?page&limit`
（只回本人、預設 createdAt 由新到舊、含分頁 meta）。這支是先前那份 App 遷移需求做的，
不限本文件三項活動，遷移後小金庫不會是空的。

---

## 錯誤碼表（`code` 欄位）

| code | 意思 |
|---|---|
| `UNAUTHORIZED` | 未登入 |
| `BAD_REQUEST` | 參數格式錯誤 |
| `ACTIVITY_INACTIVE` | 活動已關閉 |
| `ALREADY_CLAIMED` | 已領過（文章 / 里程碑 / 每週） |
| `NOT_FOUND` | 找不到目標 |
| `MILESTONE_NOT_FOUND` | 里程碑不存在（回應含目前 `milestones`） |
| `STEPS_NOT_ENOUGH` | 步數未達標（回應含 `steps` / `required`） |
| `DATE_NOT_TODAY` | 只能領當日（回應含 `today`） |
| `CONTENT_TOO_SHORT` | 內容太短（回應含 `minContentLength`） |
| `CONTENT_TOO_LONG` | 留言超過 300 字（回應含 `maxLength`） |
| `BANNED_WORD` | 命中關鍵字過濾 |
| `PHOTO_REQUIRED` / `TOO_MANY_PHOTOS` | 照片張數不符（後者含 `maxImages`） |
| `INVALID_MEDIA` | 照片不是本站 media |
| `INVALID_ARTICLE` | 文章不存在或不符合三個可分享條件 |
| `INVALID_ORDER_NUMBER` | 訂單編號正規化後長度不在 4–40 |
| `ORDER_NUMBER_TAKEN` | 該文章的這張訂單編號已被他人使用 |
| `FUTURE_PURCHASE_DATE` | 購買日期是未來 |
| `EDIT_WINDOW_CLOSED` | 超過可編輯期限（回應含 `editableUntil`） |
| `ALREADY_REPORTED` | 已檢舉過（App 據此切「已檢舉」UI） |
| `INTERNAL_ERROR` | 伺服器錯誤 |

---

## 驗證

`scripts/verify-app-activities.ts`（可重跑，自動清理），在 pre 的正式 PostgreSQL 上
24 項斷言全過，涵蓋的是規則而不只是 happy path：冪等（同篇只能領一次 / 里程碑不重領 /
精選不重發 / 檢舉不重複）、精選以 `featuredAt` 判定且取消再標記不重發、同會員同文章
只有第一篇發獎、退回重審不重發、離開 approved 自動取消精選、訂單去重跨帳號、
`commentCount` 只計 published、發點與帳本同一交易且只加一次。

另以真 HTTP + 會員 token 對所有端點做過 smoke，錯誤碼都如上表回應。

---

## 兩件請你們知道的事

1. **有分享或訂單去重紀錄的團購文章無法被硬刪除**（外鍵保護，避免分享變孤兒）。
   要下架請改文章狀態或 visibility —— 這也符合你們文件裡「文章可能改標題或下架，
   所以存 `articleTitle` 快照」的設計。
2. **儲存與流量估算**：你們提到愛旅遊文章的圖片也會改上傳到 Payload media（由另一端負責），
   我們已把這件事列入 media 的容量規劃，不會只按這三項活動估。

有任何欄位形狀或行為對不上，把 App 的 request/response 一起丟給我，我直接對。
