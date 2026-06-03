# CHIC KIM & MIU — 全站功能稽核 × 完整功能清單 × 分階段路線圖

> 日期：2026-06-03　·　稽核方式：6 個平行子代理逐檔讀程式碼（非僅看 collection 存在與否，而是追「後台→API→前台→實際送出/付款/發獎」是否真的接通）
> 範圍：66 collections + 24 globals + 前台頁面 + API routes + cron + 整合（ECPay / Meta / R2 / Email）

---

## 一、總結論（先看這段）

### 核心發現：**「Schema 齊全，執行層大量 stub」**
後台與資料模型非常完整（樣樣有欄位、有管理介面），但很多功能的「真正會動的那段程式」是空的、假回傳成功、或函式寫好卻沒人呼叫。collection 數量 ≠ 功能完成度。

### 🔴 最嚴重（P0，攸關電商存亡）
1. **線上金流 ECPay 根本沒接通** — 結帳頁按「確認付款」只是 `POST /api/orders` 建單（unpaid）後直接跳成功頁，不管選 ecpay/paypal/newebpay/linepay 都一樣。**沒有導去綠界、沒有 ReturnURL、沒有 NotifyURL webhook**。等於「線上付款」實際上只是「送出訂單」，所有付款都要 admin 後台手動標記已付。`checkout/page.tsx:704-736`
2. **電子發票資訊被丟棄** — 結帳頁收集了載具/統編/捐贈，但 `orderPayload` 完全沒帶這些欄位；`autoIssueInvoiceForOrder` 硬寫成個人二聯式。`ecpayInvoiceEngine.ts:607`
3. **超商取貨實際無法運作** — 「從地圖選擇門市」按鈕 `onClick` 是空的，沒接 ECPay 電子地圖；且取貨訂單從不呼叫 ECPay 物流建單 API，超商不會收到出貨指令。`checkout/page.tsx:1136-1143`
4. **退款不觸發實際金流逆轉** — Refunds 只寫 DB，`original_payment` 原路退款沒呼叫任何 API；且 Refunds 無對外 API、無 email hook。`Refunds.ts`

### 🟠 行銷／CRM「跑起來但什麼都沒送出」（P1）
5. **channelDispatcher 的 LINE / SMS / Push / 站內彈窗全是 stub**，而且**假回傳 `success: true`** → 自動化旅程、生日、節慶「成功」執行但實際沒送任何訊息。`channelDispatcher.ts:255-475`
6. **推薦引擎 `PRODUCT_POOL = []`** → 所有推薦區塊（PDP 加購、購物車交叉銷售、結帳最後一推、離站挽留、感謝頁）全部空白；`RecommendationSettings` 沒人讀。`recommendationEngine.ts`
7. **自動化旅程 `wait` / `condition_check` / `add_tag` / `assign_coupon` 都是 `console.log`** → 旅程的時序與分支設計形同虛設。`automationEngine.ts:269-313`
8. **A/B 測試成效永遠 0** — `trackABTestEvent` 從未被呼叫，opened/clicked/converted 無數據，自動選勝無從運作。`campaignEngine.ts`
9. **Affiliates 佣金不會自動算** — Orders 記了 commissionRate/amount，但沒有 hook 在付款時累加 `totalEarnings`；無前台合作夥伴 dashboard。
10. **點數兌換前台沒有 redeem API** — PointsRedemptions 只能後台管理，前台「立即兌換」是死的。
11. **推薦人獎勵不發放**（customerRegister 留「另案」）；**防濫用 IP/裝置完全沒做**；**黑名單/停權不擋結帳**。

### 🟡 前台「死按鈕 / 假資料」（P1–P2）
12. 評價提交是死按鈕（無 onClick/fetch，照片上傳也沒 input）；首頁電子報訂閱死按鈕；wishlist 只存 localStorage（換裝置就沒）；`/account/segments`、`/account/analytics` 顯示 **DEMO 假資料**；`blog/[slug]` 查無文章時顯示**假文章**而非 404。
13. **預購在前台失效** — PDP `canAddToCart` 完全不看 `allowPreOrder`，stock=0 一律 disable，預購旗標形同虛設。
14. **blog/[slug] 沒做 `decodeURIComponent`** — 中文 slug 在 prod 會 query miss（與 MEMORY 記錄的 Next.js 15 bug 同型，此頁未修）。

### 🟡 排程缺口（函式寫好但沒 cron 觸發）
15. 生日 5 階段排程、排行榜 top3 bonus、社交遊戲房間結算（settleStyleRoom）、wish 過期退點、發票失敗重試、商品排程上下架、星座運勢預熱——**程式都寫好了，但 `cron.yml` 沒排**。

### 🟡 社交遊戲「半成品」
16. 7 款社交遊戲（PK / 接龍 / 週賽 / 共創 / 盲盒 / 女王投票 / 團體房）投稿+投票通了，但**房間結算/發勝者點數留待「後續 PR」**；圖片上傳要手動填 Media ID（封測簡化）。

### ⬜ 對比 Sysfeather「整塊缺」的模組
17. **進銷存**（多倉 / 進貨單 / 盤點 / 庫存異動 log / 缺貨訂單查詢）— 目前庫存只有單一整數 per variant。
18. **POS 門市**（門市結帳 / 店員 / 打卡 / 門市倉儲）— 完全沒有。
19. **直播購物**（FB/IG 直播留言關鍵字自動成單）— 完全沒有。
20. **會員手機 SMS OTP 驗證** — `phoneVerificationRequired` 有欄位但完全沒實作。

### ✅ 真正完整、且領先 Sysfeather 的部分
訂單狀態機/稅額計算/自動取消/自助取消改址、商品 CRUD/變體矩陣/SKU/自動計價、會員等級/信用分數/FIFO 點數到期/分群引擎、Coupon 引擎/贈品/加購、Meta Catalog 推送/CAPI/feed XML/UTM 歸因/行為追蹤、**遊戲化核心**（簽到/轉盤/刮刮樂/電影抽獎/穿搭挑戰/卡牌比大小/MBTI64/收藏卡牌經濟 craft-transfer-burn/大獎池）、Page Builder（15 blocks）、SEO（sitemap/robots/llms.txt/JSON-LD）、安全標頭/CSP/admin BasicAuth、8 封交易信。

---

## 二、完整功能清單（依後台 8 大群組）

狀態：`✅完整` / `🟡部分` / `🔴僅骨架stub` / `❌缺`

### ① 訂單與物流 / 金流 / 發票 / 稅
| 功能 | 狀態 | 程式碼位置 | 說明 |
|---|---|---|---|
| 訂單 schema / 6 狀態機 | ✅ | `Orders.ts` | pending→processing→shipped→delivered/cancelled/refunded |
| 訂單編號自動產生 | ✅ | `Orders.ts:474`, `lib/commerce/orderNumbering.ts` | 讀 OrderSettings.numbering |
| 稅額自動計算 | ✅ | `Orders.ts:504`, `lib/commerce/calculateTax.ts` | 含稅/外加、逐 line item、運費稅、四捨五入 |
| TaxSettings 接前端 | ✅ | `checkout/page.tsx:305` | |
| 自動取消未付款 cron | ✅ | `api/cron/auto-cancel-orders` | |
| 顧客自助取消 / 改地址（30min）| ✅ | `api/account/orders/[id]/cancel,edit-address` | IDOR guard，超商取貨限制 |
| 下單扣庫存 / 取消回補 | ✅ | `Orders.ts:654` | 但扣減失敗只 console.error 靜默吞（會超賣） |
| 訂單各狀態 email | ✅ | `Orders.ts:916`, `lib/email/*` | |
| admin 批次出貨 | ✅ | `OrderBulkShipPanel.tsx` | |
| 物流追蹤號→載具 URL | ✅ | `lib/shipping/trackingUrl.ts` | 8 家物流商 |
| 結帳付款方式 UI + 篩選 | ✅ | `checkout/page.tsx:51-471` | COD 上限/物流相容過濾 |
| 電子發票結帳 UI（4 類型）| ✅ | `checkout/page.tsx:1416` | UI 完整 |
| **ECPay 實際付款 redirect/callback** | 🔴 | `checkout/page.tsx:704-736` | 只建單跳成功頁，無綠界、無 Return/Notify URL |
| **CVS 超商電子地圖選門市** | 🔴 | `checkout/page.tsx:1136` | onClick 空，只能手動打字 |
| **付款後 paymentStatus 自動更新** | 🔴 | 無 webhook route | 線上付款全靠 admin 手動標記 |
| **發票資訊由結帳頁傳入訂單** | 🔴 | `checkout/page.tsx:624-700` | 收集了但丟棄 |
| ECPay 發票 issue/void/allowance API | ✅ | `lib/invoice/ecpayInvoiceEngine.ts` | 函式完整 |
| 發票自動開立（付款 hook）| 🟡 | `ecpayInvoiceEngine.ts:607` | invoiceType 硬寫 b2c_personal |
| 發票失敗重試 | 🟡 | `ecpayInvoiceEngine.ts:722` | 函式存在但無 cron 呼叫（孤立）|
| Returns / Exchanges 自助申請 | ✅ | `account/returns`, `api/returns`, `api/exchanges` | IDOR guard + photo + email |
| Refunds 退款流程 | 🟡 | `Refunds.ts` | schema 完整但無 afterChange / 無 API / 無金流逆轉 |
| ECPay 原路退款 | 🔴 | `Refunds.ts:88` | 只記 DB |
| 退貨後庫存回補 | ✅ | `Returns.ts:119` | |
| 付款後消費累積/升等 | ✅ | `Orders.ts:703` | |
| 顧客發票查詢頁 | ✅ | `account/invoices` | |

### ② 商品管理 / 庫存 / 定價
| 功能 | 狀態 | 程式碼位置 | 說明 |
|---|---|---|---|
| 商品 CRUD 4-Tab 後台 | ✅ | `Products.ts` | |
| 商品狀態 draft/published/archived | ✅ | `Products.ts:443` | access 層過濾 |
| slug + aliasSlugs 301 | ✅ | `products/[slug]/page.tsx:167` | 含 decodeURIComponent |
| SEO + JSON-LD | ✅ | `Products.ts:1483`, `page.tsx:68` | priceValidUntil 寫死 30 天 |
| 多層分類樹（拖曳）| ✅ | `Categories.ts`, `CategoryTreeView.tsx` | productCount 自動 bump |
| 尺寸表（跨商品復用）| ✅ | `SizeCharts.ts` | PDP popup |
| 變體矩陣（色×尺寸）| ✅ | `Products.ts:1165` | per-variant stock/price/cost/gtin |
| SKU 生成 + 唯一驗證 | ✅ | `Products.ts:298` | |
| 低庫存警示 | ✅ | `Products.ts:317` | 但只有 flag，無通知 |
| 單人限購 | ✅ | `Products.ts:1069`, `cartStore.ts:92` | |
| 自動計價公式 | ✅ | `lib/pricing/computeSuggestedPrice.ts`, `PricingFormulaSettings.ts` | |
| 毛利洞察 widget | 🟡 | `ProductMarginInsight.tsx:31` | 讀錯欄位（sourcing.costTWD 而非 cost），手填 cost 永遠顯示「—」|
| **預購 allowPreOrder** | 🟡 | `Products.ts:1329`；PDP **不讀** | PDP stock=0 一律 disable，預購失效；preOrderNote 不顯示 |
| 半隱藏商品 | ❌ | — | 只有全顯/全隱 |
| 商品評價 提交→審核→顯示 | 🟡 | `ProductReviews.ts`；PDP 顯示✅ | **/account/reviews 提交是死按鈕**（無 fetch），照片上傳無 input |
| 限時排程上下架 | 🟡 | `applyProductSchedules.ts` | endpoint 完整但 cron.yml 沒排 |
| Shopline XLSX / Sinsang / 供應商圖 匯入 | ✅ | `shoplineXlsxImport.ts`, `SinsangImporter`, `importFromSupplier.ts` | |
| totalSold 累計 | 🟡 | `Products.ts:522` | 註解說自動更新，實際 Orders hook 沒加，需手填 |
| **多倉庫存** | ❌ | — | 單一整數 per variant |
| **採購單 / 進貨單** | ❌ | — | sourcing group 只記靜態來源 |
| **庫存盤點** | ❌ | — | |
| **智慧補貨 / 追貨** | ❌ | — | |
| **缺貨訂單查詢** | ❌ | — | |
| **庫存異動 log** | ❌ | — | 查帳困難 |

### ③ 會員 / CRM / 客服 / 認證
| 功能 | 狀態 | 程式碼位置 | 說明 |
|---|---|---|---|
| Email/密碼 登入 | ✅ | `login/page.tsx` | 暴力破解鎖 10 次/10 分 |
| 忘記/重設密碼、Email 驗證 | ✅ | `forgot-password`,`reset-password`,`verify-email` | SMTP 另案，token 走 console fallback |
| 自助註冊（含 terms/referral）| ✅ | `customerRegister.ts` | |
| OAuth Google/FB/LINE/Apple | 🟡 | `auth.ts`, `api/auth/[...nextauth]`, `api/auth/bridge` | 需各自 env 才動作；cookie bridge 完整 |
| **SMS/手機 OTP 驗證** | ❌ | — | `phoneVerificationRequired` 欄位在但未實作 |
| /account 主頁/orders/addresses/settings | ✅ | `account/*` | 真實資料 |
| /account/points（FIFO 到期）| ✅ | `account/points/page.tsx:68` | 演算法完整 |
| **點數兌換 redeem** | 🔴 | `PointsClient.tsx` | 前台無 redeem API，死按鈕 |
| /account/referrals | ✅ | `account/referrals` | |
| **推薦人獎勵發放** | 🔴 | `customerRegister.ts:27` | 「另案」未做 |
| **推薦防濫用 IP/裝置** | 🔴 | `ReferralSettings.ts` | 設定齊全，register 端零實作 |
| /account/subscription | 🟡 | `account/subscription` | 只展示，**無購買動作** |
| /account/wishlist | ✅ | `account/wishlist`、`WishlistItems.ts`、`api/account/wishlist`、`WishlistSync.tsx` | **Phase 2 B**：DB 持久化（row-per-item）；登入時 localStorage→DB 合併、跨裝置、登出清本機 |
| /account/segments、/analytics | 🟡 | `account/segments,analytics` | **DEMO 假資料** fetch 失敗 fallback |
| 會員等級 + 年度重算 cron | ✅ | `MembershipTiers.ts`, `api/cron/annual-tier-reset` | gender-aware |
| 購物金 shoppingCredit | 🟡 | `Users.ts:562` | 有欄位，**無交易帳本** |
| 儲值金 storedValueBalance | 🔴 | `Users.ts:583` | 「退現流程尚未開通」|
| 信用分數 | ✅ | `CreditScoreHistory.ts` | 雙路徑 hook |
| **黑名單擋結帳** | 🔴 | `Users.ts:742` | 有欄位，**checkout 不讀，不擋下單** |
| 會員分群引擎 + cron | ✅ | `lib/crm/segmentationEngine.ts`, `api/cron/segments` | RFM 加權完整 |
| CRM 客服 schema（Phase 1A）| ✅ | `Conversations/Messages/MessageTags/ConversationActivities` | |
| 客服 inbox UI（後台）| 🟡 | Payload 預設 list | 無客製 inbox |
| 客服 前台 web chat | ❌ | — | 無 widget |
| AI 客服 | 🟡 | `api/crm/ai-chat` | **關鍵字比對非 LLM**，且寫舊 v0 collection |
| 客服通知 SSE bell | 🔴 | `Users.ts:1267` | 「Phase 1D」未做 |
| SLA / autoAssign / CSAT | 🔴 | `CustomerServiceSettings.ts` | 多項標 Phase 1B+/6/8 未接 |

### ④ 行銷推廣 / 廣告 / 自動化
| 功能 | 狀態 | 程式碼位置 | 說明 |
|---|---|---|---|
| channelDispatcher Email/EDM | ✅ | `channelDispatcher.ts:290,493` | 真送（Resend）|
| **channelDispatcher LINE** | 🔴 | `channelDispatcher.ts:255` | TODO，假回傳 success |
| **channelDispatcher SMS** | 🔴 | `channelDispatcher.ts:377` | TODO，假回傳 success |
| **channelDispatcher Push** | 🔴 | `channelDispatcher.ts:426` | TODO |
| **channelDispatcher 站內彈窗** | 🔴 | `channelDispatcher.ts:459` | 不寫 DB |
| 自動化旅程 觸發+狀態機 | 🟡 | `automationEngine.ts` | 邏輯在，但發送走 stub 通道 |
| **旅程 wait/condition/add_tag/assign_coupon** | 🔴 | `automationEngine.ts:269-313` | 全 console.log |
| 旅程掃描 cron | ✅ | `api/cron/automations` | 已排 10 分鐘 |
| Coupon 驗證引擎 | ✅ | `api/cart/apply-coupon` | 完整 |
| Coupon 核銷 + usageCount | ✅ | `Orders.ts:611`, `CouponRedemptions.ts` | |
| Coupon 疊加/互斥規則 | ❌ | `apply-coupon` | 無疊加邏輯 |
| 贈品 GiftRules / 加購 AddOnProducts | ✅ | `api/cart/gifts,add-ons` | |
| Bundles PDP | 🟡 | bundle slug PDP | 推薦池空，bundle 推薦不顯示 |
| A/B 測試引擎 | ✅ | `lib/marketing/abTestEngine.ts` | hash 分流/Z-test/選勝 |
| **A/B 成效追蹤接入** | 🟡 | `campaignEngine.ts` | trackABTestEvent 從未呼叫，數字恆 0 |
| 節慶引擎 | 🟡 | `festivalEngine.ts:1700` | 只建 draft，不自動 launch |
| 生日引擎 5 階段 | 🟡 | `birthdayEngine.ts:440` | runDailyBirthdayScheduler **無 cron** |
| Meta Catalog 推送 / feed XML / CAPI | ✅ | `lib/ads/catalogBatchPusher.ts`, `feedBuilder.ts`, `tracking.ts:655` | 真接 Meta |
| **AdAudiences DPA 再行銷** | 🔴 | `AdAudiences.ts:11` | schema only，PR-E2 同步未做 |
| 行為追蹤（前+後端）| ✅ | `lib/behaviorTracking.ts`, `api/behavior/track` | |
| **推薦引擎前台** | 🔴 | `recommendationEngine.ts` | `PRODUCT_POOL=[]`，全空白 |
| White-hat SEO/週內容/競品價/日報 | ✅🟡 | `lib/marketing/whiteHatAutomation.ts` | 競品價評分✅、GSC 需 token、影音僅文字腳本 |
| White-hat cron | ✅ | `api/cron/whitehat-marketing` | 已排 |
| UTM 歸因 | ✅ | `tracking.ts:249`, `api/utm/track` | first/last touch |
| festival-templates collection | ❌ | `api/marketing/festivals:93` | collection 未在 config 定義，create 會失敗 |

### ⑤ 互動體驗 / 遊戲化
| 功能 | 狀態 | 程式碼位置 | 說明 |
|---|---|---|---|
| 每日簽到 | ✅ | `DailyCheckinGame.tsx`, `api/games` | streak/bonus/入帳/持久化 |
| 幸運轉盤 | ✅ | `SpinWheelGame.tsx`, `lib/games/gameEngine.ts` | drawPrize/扣點/限制 |
| 刮刮樂 | ✅ | `ScratchCardGame.tsx` | win-rate 公示數字未接 GameSettings |
| 電影抽獎 | ✅ | `MovieLotteryGame.tsx` | 中獎進寶物箱 |
| 璀璨穿搭挑戰 | ✅ | `fashionChallengeEngine.ts` | item 用 emoji 非真商品圖 |
| 卡牌比大小 | ✅ | `cardBattleEngine.ts`, `api/games/card-battle` | 房間流程完整 |
| MBTI64 穿搭測驗 | ✅ | `mbtiQuizEngine.ts`, `api/games/mbti/play` | 推薦商品 |
| SocialGameShell 共用殼 | ✅ | `SocialGameShell.tsx` | **圖片上傳要填 Media ID**（封測簡化）|
| 穿搭 PK / 接龍 / 週賽 / 共創 / 盲盒 / 女王投票 / 團體房 | 🟡 | `components/games/*` + `socialGameActions.ts:843` | 投稿+投票通，**房間結算 settleStyleRoom 留後續 PR**，發勝者點數無法運作 |
| 收藏卡牌 mint/craft/transfer/burn | ✅ | `lib/collectible/mintCardsForPaidOrder.ts`, `api/cards/*` | 經濟完整 + 審計 log |
| 大獎池 | ✅ | `PrizePools.ts` | weight+tierBoost |
| 排行榜 | 🟡 | `GameLeaderboard.ts`, `api/games/leaderboard` | 寫入✅，**top3 bonus 發放無 cron** |
| GameSettings（17 tab）| ✅ | `GameSettings.ts` | terms/compliance/leaderboard |
| 遊戲規範同意書 | ✅ | `GameTermsGate.tsx` | |
| 每日星座運勢 | 🟡 | `lib/horoscope/*`, `api/horoscope/today` | lazy 生成，**無預熱 cron**，預設走 seed 模板 |
| 寶物箱 consume | ✅ | `api/user-rewards/consume` | |
| **Affiliates 分潤** | 🔴 | `Affiliates.ts` | schema 完整，**佣金不自動算、無前台 dashboard、無入夥流程** |
| UGC 社群內容 | 🟡 | `UGCGallery.tsx`, `api/v1/ugc` | DB 空時 fallback 假資料，**無 IG/FB 自動匯入、無前台投稿** |
| Concierge VIP 管家 | 🟡 | `account/concierge`, `conciergeEngine.ts` | 流程完整，**AI 建議無 LLM 呼叫**，通知 email 未接 |

### ⑥ 內容與頁面 / ⑦ 系統與安全 / 基礎建設
| 功能 | 狀態 | 程式碼位置 | 說明 |
|---|---|---|---|
| Page Builder 15 blocks + 前台渲染 | ✅ | `Pages.ts`, `page-blocks/PageBlocks.tsx` | 無遺漏 renderer |
| 頁面模板系統（5 模板）| ✅ | `lib/pageTemplates.ts`, `api/admin/pages/from-template` | |
| Blog 列表 | ✅ | `blog/page.tsx` | |
| **Blog 詳情** | 🟡 | `blog/[slug]/page.tsx:88` | **查無顯示假文章**（非 notFound）；**無 decodeURIComponent**（中文 slug prod miss）|
| Blog AI 草稿（Groq）| ✅ | `lib/blog/aiDraft.ts`, `BlogAIDraftView.tsx` | |
| Blog 分類 | 🟡 | `BlogPosts.ts:176` | 固定 5 個 select，無法後台新增 |
| Podcast 列表/詳情 | ✅ | `podcast/*` | 缺 RSS feed 路由（無法上架 Apple/Spotify）|
| 首頁 CMS 驅動 | ✅ | `page.tsx`, `HomepageSettings.ts` | |
| 首頁電子報訂閱 | ✅ | `NewsletterForm.tsx`、`NewsletterSubscribers.ts`、`api/newsletter/{subscribe,unsubscribe}` | **Phase 2 B**：接 API，upsert + 冪等 + 退訂 token；admin 名單在 ④ 行銷推廣 |
| 導覽/公告/頁尾 CMS | ✅ | `NavigationSettings.ts`, `layout.tsx:369` | |
| 關於/FAQ/政策×4 CMS | ✅ | `About/FAQ/PolicyPagesSettings` | 豐富 fallback |
| SiteThemes 外觀主題 | 🟡 | `SiteThemes.ts`, `ThemeStyles.tsx` | 字型選項部分**假的（選了不載入）**；無 mobile 工具列/popup 廣告/IG feed/全站倒數 |
| Countdown block | 🔴 | `PageBlocks.tsx:820` | **永遠顯示 00**（RSC 無 client 倒數）|
| Media / R2 | ✅ | `Media.ts`, `payload.config.ts:170` | 4 resize + 白名單 + folders |
| SEO sitemap/robots/llms.txt/JSON-LD | ✅ | `app/sitemap.ts`,`robots.ts`,`llms.txt`,`seo/JsonLd.tsx` | 7 AI bot 設定 |
| i18n next-intl（5 語系字典）| 🟡 | `src/i18n/` | **字典在但前台幾乎沒套用**，首頁/PDP/checkout 全 hardcoded 中文；無 URL prefix/hreflang |
| Currency Switcher | 🟡 | `LanguageCurrencySwitcher.tsx`, `formatPrice.ts` | PDP 套了，**首頁商品格 hardcoded NT$** |
| Currency 後台管理 | ✅ | `Currencies.ts` | 5 幣別 |
| Admin BasicAuth middleware | ✅ | `middleware.ts` | timing-safe |
| CSP/HSTS/安全標頭 | ✅ | `next.config.mjs:66` | **connect-src 缺 connect.facebook.net** |
| LoginAttempts | ✅ | `LoginAttempts.ts` | 只記成功登入 |
| Email adapter + 8 封交易信 | ✅ | `payload.config.ts:139`, `lib/email/*` | verify email 中文模板缺 |
| GTM + Pixel + GA4 | ✅ | `GTMScript.tsx` | Consent Mode v2 |

---

## 三、程式碼完整性問題（依嚴重度排序的「待新增/修復」總表）

### P0 — 攸關電商能否真正交易（必須最先做）
- [ ] **ECPay 金流閉環**：checkout 按鈕 → 綠界 AioCheckOut redirect；新增 `/api/payment/ecpay/return`（前景）+ `/api/payment/ecpay/notify`（背景 webhook）→ 收款成功 PATCH `paymentStatus=paid`（會自動觸發發票/點數/升等 hooks）
- [ ] **發票偏好欄位**：Orders schema 補 invoiceType/carrierType/carrierNumber/loveCode/buyerUBN/buyerCompanyName；checkout orderPayload 帶入；autoIssue 讀取而非硬寫
- [ ] **超商取貨**：「選門市」接 ECPay 電子地圖；出貨時呼叫 ECPay 物流建單 API
- [ ] **退款**：補 `/api/refunds` + afterChange（email+信用分數）+ original_payment 呼叫 ECPay 退款 API
- [ ] **庫存扣減失敗**：不該 console.error 靜默吞，需 throw 擋單防超賣
- [ ] **黑名單/停權擋結帳**：checkout/cart 讀 isBlacklisted/isSuspended 回 403
- [ ] **發票重試 cron**：`/api/cron/retry-invoices` + cron.yml

### P1 — 行銷/CRM/分潤「真的會動」+ 前台死按鈕
- [ ] channelDispatcher 接真通道：LINE Messaging API、SMS gateway（三竹/Twilio）、站內彈窗 collection
- [ ] 點數兌換前台 `POST /api/account/points/redeem`
- [ ] 推薦人獎勵發放（付款後依 ReferralSettings 發購物金）+ 防濫用 IP/裝置
- [ ] 推薦引擎 PRODUCT_POOL 改動態查 products + 接 RecommendationSettings 權重
- [ ] 自動化旅程 wait（持久化排程）/condition/add_tag（Users 補 tags）/assign_coupon 補實作
- [ ] A/B trackABTestEvent 接入（sent；open/click 需 pixel/redirect）
- [ ] Affiliates 佣金自動累加 hook + 前台合作夥伴 dashboard
- [ ] 缺的 cron：生日排程、排行榜 top3 bonus+重置、社交遊戲房間結算、wish 過期退點、星座預熱、商品排程上下架
- [ ] 評價提交流程（已購商品下拉 + POST + 照片上傳）；PDP 撰寫評價帶 redirect
- [x] ✅ 首頁電子報訂閱 API（NewsletterSubscribers + subscribe/unsubscribe）；wishlist DB 持久化（WishlistItems + 登入合併同步）— **Phase 2 B 完成**
- [ ] /account/segments、/analytics 移除 demo fallback
- [ ] 預購 PDP 讀 allowPreOrder + 顯示 preOrderNote
- [ ] blog/[slug] decodeURIComponent + notFound

### P2 — 體驗補完 / 體質
- [ ] i18n 前台實際套用 + URL prefix + hreflang；首頁商品格改 `<Price>`
- [ ] Countdown block client 化；SiteThemes 字型實載或移除假選項
- [ ] AI 客服升級真 LLM + 寫新 Conversations；客服 inbox 客製 + 前台 web chat + SSE
- [ ] 購物金交易帳本 collection；儲值金退現流程
- [ ] 訂閱方案購買流程（接金流）
- [ ] Concierge AI 初步回覆（Groq/Claude）+ 通知
- [ ] 社交遊戲圖片改 file picker；刮刮樂機率接 GameSettings；StylePK 1v1 配對
- [ ] 毛利洞察讀 cost 欄位 bug 修正；totalSold 付款自動累加
- [ ] Coupon 疊加/互斥規則；festival-templates collection 定義
- [ ] CSP 補 connect.facebook.net；Podcast RSS feed + JSON-LD；blog 分類獨立 collection
- [ ] SMS OTP 會員驗證（Phase 1 接了 SMS gateway 後順帶）
- [ ] AdAudiences PR-E2 同步引擎

### P3 — 對齊 Sysfeather 的「整塊新模組」
- [ ] **進銷存**：InventoryTransactions（異動 log）+ PurchaseOrders（進貨單）+ StockTakes（盤點）+ 缺貨訂單查詢 +（多倉視需求）
- [ ] **直播購物**：FB/IG 直播留言關鍵字自動成單
- [ ] **POS 門市**：門市/店員/結帳/打卡/門市倉儲（僅在有實體店規劃時）

---

## 四、分階段執行路線圖

> 原則：先讓「買得成 + 收得到錢 + 開得出發票」（Phase 0），再讓「會員/行銷真的會動」（Phase 1），再清「死按鈕/假資料」（Phase 2），最後補「對齊 Sysfeather 的大模組」（Phase 3）。每個 Phase 拆多個 PR，逐一驗證。

| Phase | 主題 | 為何這個順序 | 依賴 |
|---|---|---|---|
| **Phase 0** | 金流結帳閉環（ECPay 付款/發票/超商/退款/防超賣/黑名單擋單）| 沒這個，封測站只是展示品 | 需 ECPay MerchantID/HashKey/HashIV（測試或正式）|
| **Phase 1** | CRM/行銷執行層接線（通道/兌換/分潤/推薦/旅程/缺 cron）| 後台都建好了，差「真的送出/發獎」這一哩 | LINE OA token、SMS 供應商 |
| **Phase 2** | 前台死按鈕/假資料清掃 + 體驗補完 | 封測使用者直接看得到的破口 | 無外部依賴，可立刻做 |
| **Phase 3** | 進銷存 / 直播 / POS（對齊 Sysfeather）| 全新大模組，投資大 | 看營運需求排序 |

### 待補的外部憑證/設定（執行 Phase 0/1 前需備齊）
- ECPay：MerchantID、HashKey、HashIV（測試環境 stage 即可先做）；發票商店代號
- LINE Messaging API：Channel access token（行銷推播用，與登入的 LINE Login 是不同 channel）
- SMS gateway：供應商帳號（三竹簡訊 / Twilio）

---

*本文件由全站程式碼稽核產生，作為後續分階段施工的依據。每完成一個 Phase 應回填勾選並更新狀態。*
