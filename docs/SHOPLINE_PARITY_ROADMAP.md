# CHIC KIM & MIU — Shopline Parity 全面補完路線圖

> 目標：功能 ≥ Shopline（Shopline 有的要有）+ 我們自建的差異化，把未完成開發補完；卡住的（缺外部憑證）整理出來之後處理。
> 起點：`main @ 620af6b`（已部署 prod）。本文件 = 執行清單 + 卡關清單，邊做邊回填。
> 基準稽核：`docs/FEATURE_AUDIT_2026-06-03.md`。

狀態圖例：`✅完成上線` / `🔨本輪施工` / `⛔卡外部憑證` / `🏗️大模組待排` / `⬜待辦`

---

## A. ⛔ 卡關清單（缺外部憑證 / 第三方帳號，之後處理）

這些**程式可先寫好（env-gated，缺憑證自動 no-op），但無法測試 / 無法真正上線**，須等使用者備齊憑證。

| 項目 | 卡在什麼 | 需要使用者提供 | 程式狀態 |
|---|---|---|---|
| **ECPay 線上金流閉環**（P0 最嚴重）| 綠界商店憑證 | MerchantID / HashKey / HashIV（測試 stage 即可先做）| 🔨 本輪寫 env-gated 程式碼，待憑證啟用 + 測試 |
| **ECPay 電子發票自動開立** | 同上 + 發票商店代號 | 發票 MerchantID / HashKey / HashIV | 引擎已存在（`ecpayInvoiceEngine.ts`），待金流通 + 憑證 |
| **超商取貨電子地圖 + 物流建單** | 綠界物流憑證 | 物流 MerchantID/HashKey/HashIV + 廠商代號 | 🔨 寫 env-gated，待憑證 |
| **LINE 行銷推播**（channelDispatcher LINE）| LINE OA channel token | Messaging API channel access token（與登入用 LINE Login 不同 channel）| 🔨 寫 env-gated，待 token |
| **SMS 簡訊**（channelDispatcher SMS + 會員手機 OTP 驗證）| 簡訊供應商帳號 | 三竹 / Twilio 帳密 | 🔨 寫 env-gated，待帳號 |
| **Google Ads offline conversion / Customer Match** | dev token 審核 | Google Ads dev token（MCC 申請中）| 待審核（見 memory）|

| **✅ App cron 已復活（2026-06-08）** | 原本 GitHub Actions 停權 → 所有 cron 沒跑（已 dead 數週）| — | 已裝 prod crontab fallback：`/root/run-ckmu-crons.sh` + **11 條** `[ckmu-outage-cron]` crontab（含 2026-06-09 新增 5 條：apply-product-schedules/expire-wishes/settle-style-rooms/leaderboard-settle/preheat-horoscopes）。**GitHub 恢復後要刪這些 crontab 行避免雙跑**。生日/卡牌/排行榜/結算 cron 端點皆已建並實測 200。|

> 原則：以上一律 **env 有值才啟用，缺值 no-op 不擋現有流程**（沿用 Meta CAPI token 的 pattern）。

---

## ★ 本輪施工進度（2026-06-08，已部署 prod）

**已完成上線（main 8247d35 + 後續）**：
- ✅ 推薦引擎接真實商品（serverRecommend + /api/recommendations，5 元件改 fetch）— 線上驗過回真商品
- ✅ totalSold 付款自動累加（Orders hook）
- ✅ **進銷存模組**：InventoryTransactions（流水）+ PurchaseOrders（進貨單收貨自動入庫）+ StockTakes（盤點自動校正）+ Orders 寫 sale_out 流水 — 端到端驗過
- ✅ Affiliates 佣金付款自動累加（Orders paid hook → affiliate totalEarnings/pendingAmount，冪等）
- ✅ 推薦首購獎勵發放（Orders paid hook，首筆訂單 → 推薦人+被推薦人購物金，寫錢包帳本）
- ✅ 生日排程 + 卡牌房間過期 cron 端點（/api/cron/birthday + /expire-card-battles，接既有函式，已進 prod crontab）
- ✅ App cron 全部復活並確認自動觸發（prod crontab `*/10` automations 實測有自己跑）

**重新稽核發現「已被平行 session 補完」（audit 已過時）**：festival-templates collection 已存在、點數兌換 redeem 已接 `/api/v1/points`、CSP connect.facebook.net 已在 script-src。

**剩餘真正未做（無外部依賴，可續做）**：AI 客服升級真 LLM（Groq，目前關鍵字比對）+ 前台 web chat、推薦人註冊獎勵發放、Coupon 疊加/互斥、blog 分類獨立 collection、Podcast RSS、i18n 前台全面套用、社交遊戲房間結算 settleStyleRoom + 排行榜 top3 bonus（需先解 cron 排程器）。

---

## ★★ 第二輪施工（2026-06-09，全部已部署 prod，main 8c75632）

**5 批全上線**（8 commits 89b142d..8c75632；3 次部署：B1-3 / B4 / B5）。每批乾淨 temp DB 驗證，結帳另做 preview 瀏覽器實測。**「無外部依賴」清單已全部清空。**

- ✅ **Batch 1 — 5 個缺漏 cron**（25/25 PASS）：`settleStyleRoom`+`settleExpiredRooms`（房間依得票結算發獎/排名/標 winner）、`expireOpenWishes`（許願過期退 bountyPoints）、`settleDueLeaderboards`（每日/週/月 top3 發 GameSettings bonus，跨期自動偵測+冪等）、星座運勢預熱（抽共用 generateAndCacheHoroscope）、`applyProductSchedules` cron wrapper。MiniGameRecords 加 `leaderboard_*_bonus` 3 gameType。**5 條已註冊進 prod crontab `[ckmu-outage-cron]` + 實測 200**（preheat 生 48 筆）。
- ✅ **Batch 2 — 推薦註冊獎勵**（14/14）：ReferralSettings.{referrerSignupReward/refereeSignupReward} 接通（先前只有 schema）。`grantRegistrationReferralReward`（冪等旗標 + email 驗證 gating + adjustWallet 雙方購物金）由 customerRegister + Users.afterLogin 兩處呼叫。**migration grandfather 既有 11 會員 → 不回溯發獎**。
- ✅ **Batch 3 — CRM 自動化旅程執行器**（15/15）：add/remove_tag（users.tags）、assign_coupon→UserRewards、condition_check（JSON DSL + 旅程提早結束）、**持久化 wait**（automation_logs.resumeAt + /api/cron/automations resumeDueJourneys 續跑）。順手修 triggerJourney 的 String(id) relationship bug。send_line/email/sms 仍 stub（卡憑證）。
- ✅ **Batch 4 — Podcast RSS（12/12）+ Blog 分類（8/8）**：`/feeds/podcast.xml`（RSS2.0+iTunes，channel metadata 取 GlobalSettings，零 migration）+ PodcastEpisode/Series JSON-LD；BlogCategories collection（保留 BlogPosts.category select，seed 5）+ **修好前台分類過濾 bug**（頁籤拿值比標籤永遠 0 match）。⚠️ podcast 上架前要放 ≥1400 方形封面到 ogImage。
- ✅ **Batch 5 — Coupon 疊加/互斥**（11/11 + preview 結帳實測全過）：Coupons.{stackable, exclusiveGroup}；apply-coupon 驗證候選 vs 已套用（非疊加拒/同群組拒）；checkout 單券→多券（加總/封頂/任一免運/各別移除）；Orders.appliedCoupons（json 快照）+ redemption hook 每券一筆 → 各券 usageCount 正確。excludeSaleItems 留待後續（需 checkout 傳特價旗標）。

**未動（需 user 拍板，別在 live 站 auto-pilot）**：AI 客服真 LLM(Groq)+前台 web chat（會直接對客人講話）、i18n 前台全面套用、POS 門市、直播購物。

**⚠️ GitHub Actions 恢復後**：刪 prod crontab 11 條 `[ckmu-outage-cron]`（含本輪新增 5 條）避免雙跑：`crontab -l | grep -v '[ckmu-outage-cron]' | crontab -`。

---

## B. 🔨 本輪可做（無外部依賴）— 補完未完成開發

### B1. 前台死按鈕 / 假資料 / 接線（P1–P2）
- 🔨 推薦引擎 `recommendationEngine.ts` `PRODUCT_POOL=[]` → 改查真實 products（解鎖 PDP 加購 / 購物車交叉 / 結帳加購 / 感謝頁 / 離站挽留 5 區塊）
- 🔨 `totalSold` 付款後自動累加（Orders afterChange）— powers 熱銷排序 / 推薦 trending / 毛利
- 🔨 點數兌換前台 redeem（PointsClient 死按鈕 → 接 redemptionEngine）
- ⬜ 推薦人獎勵發放（付款 / 註冊後依 ReferralSettings 發購物金）+ 防濫用 IP/裝置
- ⬜ Affiliates 佣金付款自動累加 hook + 前台 /partner dashboard 接線（頁面已存在）
- ⬜ A/B `trackABTestEvent` 接入（sent / open / click）

### B2. 缺的 cron（函式寫好但沒排程觸發，P1）
新增 cron API route + `.github/workflows/cron.yml` 排程：
- 🔨 商品限時上下架 `applyProductSchedules`
- ⬜ wish 過期退點（社交遊戲 StyleWishes）
- ⬜ 星座運勢預熱 `DailyHoroscopes`
- ⬜ 生日 5 階段排程 `runDailyBirthdayScheduler`
- ⬜ 排行榜 top3 bonus 發放 + 重置
- ⬜ 社交遊戲房間結算 `settleStyleRoom`（發勝者點數）
- ⬜ 發票失敗重試（金流通了才有意義）

### B3. CRM / 行銷執行層（P1）
- ⬜ 自動化旅程 `wait`（持久化排程）/ `condition_check` / `add_tag`（Users 補 tags）/ `assign_coupon` 補實作（目前 console.log）
- ⬜ AI 客服升級真 LLM（Groq 已用於 blog AI）+ 寫新 Conversations collection（目前關鍵字比對 + 寫舊 v0 表）
- ⬜ 前台客服 web chat widget + SSE 通知
- ⬜ Concierge VIP 管家 AI 初步回覆（Groq）+ 通知 email

### B4. 商品 / 內容補完（P2）
- 🔨 festival-templates collection 定義（`api/marketing/festivals` create 會失敗）
- ⬜ Coupon 疊加 / 互斥規則
- ⬜ blog 分類獨立 collection（目前固定 5 select）
- ⬜ Podcast RSS feed 路由（上架 Apple/Spotify）+ JSON-LD
- ⬜ 社交遊戲圖片改 file picker（目前貼 Media ID）；刮刮樂機率接 GameSettings；StylePK 1v1 配對
- ⬜ i18n 前台實際套用（字典已有，前台 hardcoded 中文）+ URL prefix + hreflang

---

## C. 🏗️ 對齊 Shopline 的大模組（新建，分批排）

- 🔨 **進銷存**：`InventoryTransactions`（庫存異動 log）+ `PurchaseOrders`（進貨單）+ `StockTakes`（盤點）+ 低庫存通知 + 缺貨訂單查詢 +（多倉視需求）
- 🏗️ **POS 門市**：門市 / 店員 / 結帳 / 打卡 / 門市倉儲（僅在有實體店規劃時）
- 🏗️ **直播購物**：FB/IG 直播留言關鍵字自動成單

---

## D. ✅ 已完成上線（main 620af6b）
Batch1+2+A（blog decode / 預購 PDP / 假資料清除 / 評價提交 / 倒數計時 / 幣別價格）、白帽行銷自動化、B 組（電子報訂閱 + wishlist DB）、C 組（購物金/儲值金錢包帳本 + 退現）、CSP connect.facebook.net（script-src 已含）。

---

## 施工原則
1. 每批：實作 → tsc 0 → 乾淨 temp DB 驗證（dev DB schema drift，見 FEATURE_AUDIT memory）→ commit → merge main → 安全部署（SKIP_GIT_RESET）。
2. 觸及 schema 的（新 collection / 欄位）一定附冪等 migration。
3. 缺憑證的功能寫 env-gated，缺值 no-op，並在本文件 A 區登記。
