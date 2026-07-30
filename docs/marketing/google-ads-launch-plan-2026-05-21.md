# CHIC KIM & MIU Google Ads 啟動與 ROAS 優化計畫

日期：2026-05-21  
網站：`https://www.chickimmiu.com/`  
目標：先排除會吃掉廣告費的漏斗問題，再用可量測的 Google Ads 架構提高銷售與投資報酬率。

## 目前診斷結論

### 可以投放的基礎

- `www.chickimmiu.com` 首頁、商品列表、商品頁、sitemap 都可正常回應 200。
- 站上已偵測到 Google Tag / GTM / GA4 / Google Ads / Meta Pixel 痕跡：
  - `GTM-WVT3LHZ`
  - `G-JGREF02LLP`
  - `AW-738811284`
- sitemap 目前約有：
  - 總 URL：1749
  - 商品頁：1290
  - 一般頁：303
  - 分類頁：98
  - 部落格：50
- 首頁主張明確：韓國質感女裝、職場與正式場合穿搭。
- 高意圖入口已存在：正式/婚禮洋裝、現貨專區、洋裝分類、新品/熱銷商品。

### 先不要直接大額投放的風險

1. `https://www.chickimmiu.com/feeds/google.xml` 目前回傳的是 SHOPLINE 首頁 HTML，不是 Google Merchant Center 可用的 XML 商品 feed。  
   代表若要跑 Shopping / Performance Max，應優先使用 SHOPLINE 的 Google / Merchant Center 串接，或另外提供可抓取的正式商品 feed。

2. 部分商品頁 SEO / 結構化資料偏弱。抽查商品：
   `https://www.chickimmiu.com/products/gianna-graceful-cute-collar-a-line-dress-優雅小翻領a字洋裝`
   顯示：
   - `description` 為空白
   - `brand` 為空白
   - `availability` 為 `PreOrder`
   - 價格有輸出 `2980 TWD`
   這會影響自然搜尋、Merchant Center 商品品質，以及廣告落地頁信任感。

3. sitemap 有幾個看起來像未整理頁面或低品質頁面：
   - `/pages/標題`
   - `/pages/圖片`
   - `/pages/商店介紹`
   - 多個老活動頁與泛用頁仍在 sitemap 內
   這些不一定會直接讓 Ads 失敗，但會讓 Google 對網站品質與商品資料一致性打折。

4. 首波不建議把所有預算打首頁。  
   首頁適合品牌認知，但轉換型廣告應優先送到：
   - 婚禮 / 正式洋裝
   - 現貨快出
   - 新品與熱銷
   - 單品頁中圖片完整、價格清楚、可出貨狀態明確的商品

5. PageSpeed Insights API 本次回 429，尚未取得正式速度分數。  
   但廣告正式上線前仍要補一次手機版 Lighthouse / PageSpeed，避免手機載入慢造成 CPC 浪費。

## 2026-05-21 後台實查更新

### Google Ads

- 帳戶：`CHIC KIM & MIU 804-402-1580`
- 主要 Purchase 轉換動作存在：
  - 轉換動作名稱：`www.chickimmiu.com`
  - 來源：網站
  - 動作最佳化：主要
  - 計算方式：每次
  - 點閱後轉換回溯期：30 天
  - 已納入帳戶層級目標：是
  - 近 30 天所有轉換：49
  - 近 30 天所有轉換價值：NT$138,764
  - 追蹤狀態：`需要處理`
- 已暫停 3 個與目前銷售 / ROAS 目標不一致的舊影片活動：
  - `【金老佛爺廚房】台灣在地食材蹦出台韓新火花！...`：NT$500/天，結束，轉換 0，轉換價值 0
  - `這樣拍超級兇 你沒看過的金老佛爺 SO N...`：NT$800/天，結束，轉換 0，轉換價值 0
  - `影片 考慮度 - 2023-09-19`：總預算 NT$22,000，結束，轉換 0，轉換價值 0
- 重新整理後可見舊影片活動狀態皆為 `已暫停`。
- 判斷：目前 Google Ads 帳戶不是「完全沒轉換追蹤」，而是 Purchase 有數據但診斷狀態不乾淨；已先停止與網站銷售不一致的舊影片花費。

### Merchant Center

- 帳戶：`CHIC KIM & MIU 122621691`
- 修正前商品總數：1,228
- `Needs attention > Prioritized fixes` 顯示：所有優先修正已解決。
- 修正前仍有 44 個商品有商品資料問題：
  - Missing product price：40 products / 3.3%
  - Image too small：2 products / below 1%
  - Missing value [availability]：2 products / below 1%
  - Setup and policy issues：1
- 商品來源只有 `Found by Google / Online store / chickimmiu.com`，沒有手動 primary feed。
- 抽查問題商品含壞掉或低品質頁，例如 `https://www.chickimmiu.com/en/products/sweetswimsuit-1` 會導回首頁，且價格缺失。
- 已將 `Not showing on Google` 的 44 個商品批次封存，避免它們進入 Shopping / YouTube / Maps 等商品展示面。
- 修正後重新整理確認：
  - `Not showing on Google 44` 指標消失
  - 商品總量由 `1.23K` 降為 `1.18K`
- 判斷：首波可用 Merchant 商品銷售測試，但仍建議只放圖片、價格、庫存、描述品質較好的商品群。

### 正式站事件實測

測試頁：`https://www.chickimmiu.com/products/dream-silk-ribbon-dress-拼接絲緞蝴蝶結洋裝`

- 商品頁有載入：
  - `GTM-WVT3LHZ`
  - `G-JGREF02LLP`
  - `AW-738811284`
  - SHOPLINE / Google channel 相關 tag
- 商品頁有送 Google Ads dynamic remarketing 類事件：
  - `product`
  - `view_item`
  - 商品金額 `2680`
  - 幣別 `TWD`
- 點擊「現在預購」後有送：
  - `add_to_cart`
  - value `2680`
  - currency `TWD`
- 進入 `/cart` 後有送：
  - `cart`
  - `ecomm_pagetype=cart`
  - `ecomm_totalvalue=2680`
- 進入 `/checkout` 後目前看到的是：
  - `other`
  - `ecomm_pagetype=other`
  - 沒看到標準 `begin_checkout`
- SHOPLINE 追蹤設定實查：
  - `Google 代碼管理工具`：`GTM-WVT3LHZ`
  - `Google 再行銷`：`shopline`
  - `Google 再行銷`：`738811284`
  - `Google Ads` 完成下單：`738811284 / iGCWCNLMzaABEJS7peAC`
  - `Meta 像素（新）`：`210263407374946`
  - `Google Analytics 4`：`G-JGREF02LLP`
- SHOPLINE GA4 追蹤工具的「新增其他事件」欄位為 disabled，無法直接在 SHOPLINE 後台補 `begin_checkout`。
- GTM 已完成標籤清理與補漏：
  - Version 4：刪除 6 個暫停且被 Google 標為惡意軟體風險的舊 Rosetta / FB CAPI / GA tags
  - Version 5：刪除 2 個孤兒 FB triggers
  - Version 6：刪除 8 個孤兒 FB variables，保留內建變數
  - Version 7：新增 `CKMU - GA4 begin_checkout - checkout page`
    - 類型：Custom HTML
    - 觸發條件：`Checkout page - Page Path contains /checkout`
    - 條件：`Page Path 包含 /checkout`
    - 事件：送 GA4 `begin_checkout` 到 `G-JGREF02LLP`
- 前台 `/checkout` 驗證：
  - `/checkout` 仍會保留 SHOPLINE 原生 `other / ecomm_pagetype=other`
  - GTM Version 7 的 custom checkout script 已插入頁面
  - GA4 / Tag Assistant 端需等待刷新後確認 `begin_checkout` 入帳
- 判斷：
  - 商品瀏覽、加購、購物車事件可用。
  - `begin_checkout` 已用乾淨、單一用途的 GTM tag 補上，不把它設為 Purchase，也不新增重複 purchase。
  - 同頁可見 `AW-738811284` 與 `AW-17551839180`，後續仍需到 Google Ads / SHOPLINE Google channel 對帳，避免轉換資料分散或重複。

### SHOPLINE 後台總覽

- 2026-05-21 中午檢查時，今日成交總額：NT$0
- 今日成交訂單總量：0
- 總工作階段數：46，較昨天 -6%
- 判斷：目前較像「流量不足 + 商品資料/投放結構需整理」，不是單純結帳頁壞掉。首波應小額、聚焦高意圖商品，不建議直接放大預算。

## 本次已完成處理摘要

1. 標籤清乾淨：
   - GTM 從含舊 Rosetta / FB CAPI / GA 暫停問題代碼，整理到只有 1 個乾淨 checkout 觀察事件。
   - 移除孤兒 trigger / variable，降低惡意軟體與重複事件風險。

2. 暫停不符合銷售目標的舊廣告：
   - 舊影片活動已改為暫停，避免非銷售導向素材繼續干擾 ROAS。

3. 修正 Merchant 商品池：
   - 44 個不顯示、資料缺漏或壞頁商品已封存。
   - 商品池從 1.23K 精簡到 1.18K。

4. 修正 checkout 漏斗觀察：
   - 以 GTM Version 7 補上 `/checkout` 的 GA4 `begin_checkout` 觀察訊號。
   - Purchase 不重複新增，仍沿用 SHOPLINE 原生 Google Ads 完成下單追蹤。

## 可直接建立的關鍵字與影片廣告架構

### 素材來源

- 官網：
  - `https://www.chickimmiu.com/pages/wedding-formal-dress`
  - `https://www.chickimmiu.com/pages/instockckmu`
  - `https://www.chickimmiu.com/categories/new-arrival`
  - `https://www.chickimmiu.com/products`
- Facebook：
  - `https://www.facebook.com/chic.kmu/`
  - 粉絲頁目前約 5.8 萬追蹤者
  - 品牌介紹：`時尚是讓生命更美的一種崇尚~!`
  - 可用內容角度：短版機能 T、白裙海島感、韓劇穿搭、購物節優惠、官方 IG 導流
- 可用商品素材：
  - 婚禮 / 正式洋裝：高奢風珍珠釦 H 字洋裝、都會襯衫領拼接洋裝、精緻造型翻領腰帶洋裝、Queenie 高雅珍珠披肩洋裝、Ophelia 優雅蝴蝶結收腰洋裝、Hazel 氣質垂墜無袖長洋裝
  - 現貨快出：現貨上衣 NT$750 起、現貨洋裝 NT$2,480 起、現貨褲款、現貨配件
  - 新品 / 小香風：Novia 細褶套裝、小香風百褶長褲、小香風百褶裙、小香風細肩帶長洋裝、法式繫帶百褶小香衫

### Google Search Campaign: `TW_Search_Formal_Dress_ROAS_202605`

狀態建議：先建立為 paused，確認預算後啟用。

Ad group 1：婚禮 / 喜宴洋裝

- `婚禮 洋裝`
- `喜宴 洋裝`
- `婚禮賓客洋裝`
- `正式洋裝`
- `正式場合洋裝`
- `婚禮穿搭 女`
- `宴會洋裝`

落地頁：`https://www.chickimmiu.com/pages/wedding-formal-dress`

廣告標題：

- `婚禮正式洋裝`
- `優雅不失禮的喜宴穿搭`
- `CHIC KIM & MIU 官方`
- `珍珠・雪紡・收腰洋裝`
- `滿 NT$2000 免運`

描述：

- `婚禮、喜宴、正式場合都能穿的韓系優雅洋裝。可用 LINE 詢問尺寸與現貨。`
- `高奢珍珠釦、收腰 A 字、雪紡絲帶等正式場合款式，官網安心下單。`

Ad group 2：職場 / 小香風穿搭

- `職場穿搭 女`
- `上班洋裝`
- `小香風套裝`
- `西裝褲 女`
- `正式上班穿搭`
- `韓系職場穿搭`
- `氣質女裝`

落地頁：`https://www.chickimmiu.com/categories/new-arrival`

廣告標題：

- `韓系職場穿搭`
- `小香風套裝新品`
- `修身西裝褲・氣質上衣`
- `新品正式上架`

描述：

- `從上班到聚會都能穿，細褶套裝、小香風單品與修身褲款一次看。`
- `新品持續上架，適合職場、約會、聚餐的質感韓系女裝。`

Ad group 3：現貨快出

- `現貨洋裝`
- `現貨女裝`
- `快速出貨女裝`
- `現貨上衣`
- `現貨穿搭`
- `約會洋裝現貨`

落地頁：`https://www.chickimmiu.com/pages/instockckmu`

廣告標題：

- `現貨女裝快出`
- `現貨洋裝與上衣`
- `急用穿搭先看這裡`
- `官方現貨專區`

描述：

- `急著出門、聚會、拍照或約會，先看現貨專區。上衣、洋裝、褲款可快速下單。`
- `現貨商品集中整理，尺寸不確定可先 LINE 詢問。滿 NT$2000 免運。`

### 否定關鍵字

- 免費
- 二手
- 批發
- 淘寶
- 蝦皮
- SHEIN
- 下載
- 素材
- 圖片
- 打版
- 課程
- 工作
- 職缺
- 評價詐騙
- 食譜
- 廚房

### Meta / Instagram Traffic + Conversion Campaign

Campaign：`TW_Meta_Sales_Retargeting_CKMU_202605`

Ad set 1：暖受眾再行銷

- 官網訪客 30 天
- 商品頁訪客 14 天
- 加入購物車 7 天
- Facebook / Instagram 互動 365 天
- 排除近 14 天已購買者

素材角度：

- `尺寸不確定？LINE 給身高體重幫你抓版`
- `婚禮、上班、聚會，一件洋裝解決正式感`
- `現貨快出，急用穿搭先看這區`

Ad set 2：類似受眾 / 興趣拓展

- 類似購買者 / 類似加購者
- 興趣：韓國服飾、婚禮穿搭、職場穿搭、洋裝、精品女裝、Instagram fashion
- 年齡：25-44 歲女性為主，先台灣

### 影片 / Reels 廣告腳本

影片 1：婚禮正式洋裝，15 秒

- 0-2 秒：畫面直接出正式洋裝全身穿搭；字幕 `喜宴 / 婚禮不知道穿什麼？`
- 3-6 秒：切 3 套洋裝細節：珍珠釦、收腰、雪紡；字幕 `不搶新娘風采，也不失禮`
- 7-10 秒：模特轉身或走動；字幕 `修身、顯比例、拍照好看`
- 11-15 秒：商品牆 / 官網頁；字幕 `CHIC KIM & MIU 婚禮正式洋裝系列`
- CTA：`看正式洋裝`

影片 2：現貨快出，10-12 秒

- 0-2 秒：字幕 `這週就要穿？`
- 3-7 秒：現貨上衣、洋裝、褲款快速切換；字幕 `現貨專區先看`
- 8-12 秒：LINE / 滿額免運提示；字幕 `尺寸不確定，LINE 問我們`
- CTA：`看現貨`

影片 3：小香風新品，15 秒

- 0-3 秒：小香風套裝上身；字幕 `上班也能有正式感`
- 4-8 秒：細褶、外套、褲裙、長褲切換；字幕 `套裝 / 單穿都好搭`
- 9-12 秒：近拍布料與輪廓；字幕 `氣質不費力`
- 13-15 秒：新品頁；字幕 `新品上架`
- CTA：`看新品`

### 第一波預算建議

還沒確認每日預算前，不建議直接啟用花費。建議啟用順序：

1. Google Brand Search：NT$100-200 / 天，防守品牌字。
2. Google High-intent Search：NT$500-800 / 天，只投婚禮正式洋裝 + 現貨快出。
3. Meta / IG 再行銷：NT$300-500 / 天，追回官網與社群暖受眾。
4. PMax / Shopping：等 Merchant 商品狀態穩定 24-48 小時後，再用 NT$500-1,000 / 天小額測試。

首波先不開泛流量影片觀看活動；影片素材應放在 Meta Reels / Instagram placements 或 Google Demand Gen，以轉換與再行銷為目標。

## 2026-05-21 實際投放建立進度

### Google Ads Search 草稿

- 帳戶：`CHIC KIM & MIU 804-402-1580`
- 已建立到發布前檢查頁：
  - Campaign ID：`281498848756757`
  - Draft ID：`10196054031`
  - 名稱：`TW_Search_ROAS_Formal_InStock_Brand_20260521`
  - 類型：Search
  - 目標：Sales / Purchase
  - 出價：Maximize conversions，不設定 target CPA
  - AI Max：關閉
  - 廣告聯播網：只保留 Google Search；已關閉 Search Partners 與 Display Network
  - 地區：台灣
  - 語言：英文 + 繁體中文（台灣）
  - 歐盟政治廣告：否
  - 預算：每日 `NT$600`
  - 落地頁：`https://www.chickimmiu.com/pages/wedding-formal-dress`
  - 關鍵字：12 個，僅 phrase / exact，比對婚禮、喜宴、正式洋裝等高意圖字
  - 廣告：1 則 responsive search ad，正式洋裝 / 喜宴賓客穿搭文案
- 最後狀態：
  - Google 顯示「您的廣告活動已經可以發布了」
  - 發布時被「確認身分」安全檢查擋住；按確認後只回到「再試一次」
  - 需帳戶本人完成 Google 身分確認後，才能發布或繼續儲存最後變更

### Meta / Instagram 檢查

- 已切到正確 Meta 廣告帳戶：
  - Business portfolio：`CKMU`
  - Ad account：`靚秀國際有限公司 (441158936893428)`
- Pixel / dataset 可用：
  - Pixel ID：`210263407374946`
  - 名稱：`靚秀國際有限公司的像素`
  - 整合：`轉換 API + Meta 像素`
  - 網站：`www.chickimmiu.com`
- 事件狀態：
  - `瀏覽內容`、`PageView`、`加到購物車`、`開始結帳` 都為使用中，最近約 50 分鐘內仍有資料
  - `購買` 使用中，近 28 天 128 次，上次接收約 3 天前
  - Meta 建議改善：傳送有效幣別代碼，以提高 ROAS 計算準確度
- 既有活動觀察：
  - `新客轉換` 曾以 `NT$241` 花費帶來 3 次購買，每次購買約 `NT$80`
  - 但目前廣告組合已暫停，且帳戶內有 `18` 個未發布草稿
- 判斷：
  - Meta 具備再行銷與轉換投放基礎
  - 先不要直接發布既有草稿或重開高預算舊活動；建議在清完草稿/確認素材後，用 `NT$300/天` 建立暖受眾再行銷

## 投放前必做檢查

### 1. 轉換追蹤

在 Google Ads 建立主要轉換：

| 轉換 | 用途 | 是否放入 Conversions |
| --- | --- | --- |
| Purchase / 完成訂單 | 出價優化主目標 | 是 |
| Begin checkout | 漏斗觀察 | 否，先設 secondary |
| Add to cart | 漏斗觀察與再行銷 | 否，先設 secondary |
| LINE 點擊 / Message shop | 輔助線索 | 否，先設 secondary |

SHOPLINE 後台建議：

1. `Channels > Google > Data tracking`
2. 設定 Google Ads client-side conversion tracking
3. 對應事件：`A customer completes placing an order` -> Google Ads `Purchase`
4. 填入 Conversion ID 與 Conversion Label
5. 若帳戶支援，開啟 server-side conversion tracking
6. 確認 GCLID 能傳到訂單或轉換事件

### 2. Remarketing / Dynamic Remarketing

SHOPLINE 後台建議：

1. `Channels > Google > Data tracking`
2. Google remarketing 填入 Conversion ID
3. Remarketing type 選 `Dynamic remarketing`
4. 確認 Merchant Center feed 已啟用且商品通過審核

必要受眾：

- 所有訪客 30 天
- 商品頁瀏覽但未加購 14 天
- 加入購物車未購買 7 天
- 開始結帳未購買 7 天
- 過去購買客戶 180 天
- 高價商品瀏覽者 30 天

### 3. Merchant Center 商品資料

優先修這些欄位：

| 欄位 | 要求 |
| --- | --- |
| title | 中文可讀，包含品類、場合、版型，例如「正式場合 A 字洋裝」 |
| description | 不可空白，至少 80-160 字，說明材質、場合、版型、出貨狀態 |
| brand | 統一填 `CHIC KIM & MIU` |
| image | 主圖清楚，不用拼貼/過多文字 |
| price | 必須與落地頁一致 |
| availability | 必須與落地頁、結帳可買狀態一致 |
| product_type | 用自家分類，例如 `女裝 > 洋裝 > 婚禮正式洋裝` |
| google_product_category | 建議服飾類固定填對應 Google 類別 |
| custom_label_0 | `bestseller` / `new` / `in_stock` / `formal_dress` / `high_margin` |

首批只上架 80-150 個品質最好的商品，不要全站 1290 個商品一次全開。  
理由：先讓演算法學到「會成交的商品長什麼樣」，不要讓舊品、空描述、預購不明、低毛利商品稀釋學習。

## 首波 Google Ads 架構

### Campaign 1: Brand Search 防守

目的：守住品牌字與主理人相關搜尋，避免被競品或平台截流。

設定：

- 類型：Search
- 地區：台灣為主
- 語言：中文、英文
- 出價：Maximize conversions，初期可設低日預算
- 預算：總預算 10-15%

關鍵字：

- `chickimmiu`
- `chic kim miu`
- `金老佛爺 衣服`
- `kim lafayette 洋裝`
- `ckmu 洋裝`

廣告文案方向：

- 標題：`CHIC KIM & MIU 官方網站`
- 標題：`韓國質感女裝・正式場合穿搭`
- 標題：`滿 NT$2000 免運`
- 描述：`婚禮、上班、聚會都能穿的韓系優雅女裝。尺寸不確定可用 LINE 詢問。`

### Campaign 2: High-intent Search 場合需求

目的：抓已經有購買意圖的人。

設定：

- 類型：Search
- 出價：前 2 週 Maximize conversions；有足夠訂單後改 Maximize conversion value 或 tROAS
- 預算：總預算 20-25%

Ad groups：

1. 婚禮洋裝
   - `婚禮 洋裝`
   - `婚禮 賓客 洋裝`
   - `喜宴 洋裝`
   - `正式 洋裝`
   - `婚禮穿搭 女`

2. 上班正式穿搭
   - `上班 洋裝`
   - `職場 穿搭 女`
   - `正式 上班穿搭`
   - `西裝褲 女`
   - `小香風 套裝`

3. 現貨快速出貨
   - `現貨 洋裝`
   - `現貨 女裝`
   - `快速出貨 洋裝`
   - `約會 洋裝 現貨`

落地頁：

- 婚禮正式洋裝：`https://www.chickimmiu.com/pages/婚禮正式洋裝系列-wedding-guest-formal-dress`
- 洋裝分類：`https://www.chickimmiu.com/categories/dress`
- 現貨：`https://www.chickimmiu.com/pages/instockckmu`

### Campaign 3: Shopping / Performance Max 商品銷售

目的：用商品 feed 直接跑銷售。

前提：

- Merchant Center 通過審核
- 商品 feed 價格、庫存、圖片、描述一致
- Purchase conversion 有回傳金額

設定：

- 類型：Performance Max with Merchant Center feed
- 初期出價：Maximize conversion value，不急著開很高 tROAS
- 預算：總預算 45-55%
- Asset groups：
  - Formal / Wedding Dress
  - In Stock Fast Delivery
  - Office / Workwear
  - Best Sellers

初期商品只放：

- 有庫存或可明確預購日期
- 商品描述完整
- 主圖漂亮
- 毛利足夠
- 客服較少售後疑慮的款式

### Campaign 4: Remarketing 再行銷

目的：追回看過、加購、結帳未完成的人。

設定：

- 類型：Demand Gen 或 Display Remarketing；若素材不足，先用 PMax 內部受眾訊號
- 預算：總預算 10-15%
- 素材：商品圖、穿搭情境圖、LINE 詢問尺寸、滿額免運、現貨快出

受眾與訊息：

| 受眾 | 廣告訊息 |
| --- | --- |
| 商品瀏覽未加購 | `還在找正式場合洋裝？這幾款最不容易失手` |
| 加購未結帳 | `尺寸或現貨不確定？LINE 回覆身高體重幫你抓版` |
| 結帳未完成 | `滿 NT$2000 免運，付款與出貨資訊可先確認` |
| 舊客 | `本週新品 / 現貨快出，老客優先看` |

## 預算與 ROAS 控制

若月預算先用小額測試，建議：

| 階段 | 期間 | 日預算 | 目標 |
| --- | --- | ---: | --- |
| 測量校正 | Day 1-3 | NT$500-800 | 確認 purchase 金額、GCLID、UTM 都有回傳 |
| 初始學習 | Day 4-14 | NT$1,000-2,000 | 累積轉換與查詢字詞資料 |
| 放量測試 | Day 15-30 | NT$2,000-4,000 | 把預算集中到 ROAS 最高商品與搜尋字 |

ROAS 判斷方式：

- 先用毛利倒推，不只看營收。
- 假設商品平均毛利率 45%，物流/金流/客服成本抓 10%，可承受廣告成本約 25-30%。
- 因此首波保守目標 ROAS 可先抓 `350%-400%`。
- 如果新品需要養受眾，可容忍短期 `250%-300%`，但必須看加購、結帳、LINE 詢問是否有上升。

調整規則：

- 連續 3 天有花費但沒有 add_to_cart：停該 ad group 或換落地頁。
- 有 add_to_cart 但無 checkout：檢查商品首屏、尺寸、庫存、運費提示。
- 有 checkout 但無 purchase：檢查付款、運費、登入/欄位、結帳錯誤。
- ROAS 達標且每日花費吃滿：每 3-4 天提高 15-20% 預算。
- ROAS 未達標但 CVR 正常：先篩商品與搜尋字，不要只降預算。

## UTM 命名

Search：

`utm_source=google&utm_medium=cpc&utm_campaign=tw_search_formal_dress_202605&utm_term={keyword}&utm_content={creative}`

Performance Max：

`utm_source=google&utm_medium=pmax&utm_campaign=tw_pmax_product_sales_202605&utm_content={assetgroupid}`

Remarketing：

`utm_source=google&utm_medium=remarketing&utm_campaign=tw_remarketing_cart_202605&utm_content={creative}`

## 第一週每日檢查表

| 時間 | 要看什麼 | 判斷 |
| --- | --- | --- |
| 上線當天 | Google Tag Assistant / Ads 診斷 | purchase 是否觸發，金額是否正確 |
| Day 1 | SHOPLINE 訂單 UTM | 是否能看到 google / cpc / campaign |
| Day 2 | Merchant Center 商品狀態 | disapproved / limited products |
| Day 3 | 搜尋字詞 | 是否有無關字、競品字、低意圖字 |
| Day 4-7 | 漏斗 | view_item -> add_to_cart -> checkout -> purchase |

## 需要帳戶中確認的資料

- Google Ads 帳戶 ID
- Google Merchant Center 是否已建立並驗證網域
- SHOPLINE Google channel 是否已連 Google 帳號
- Purchase conversion ID / label
- 是否已啟用 server-side conversion tracking
- 最近 7 天與 30 天 SHOPLINE 漏斗數字：
  - 訪客
  - 加入購物車
  - 開始結帳
  - 完成訂單
  - 營收
  - 平均客單價
- 商品平均毛利率與最低可接受 ROAS

## 參考來源

- Google Ads conversion tracking: https://support.google.com/google-ads/answer/1722054
- Google Performance Max retail best practices: https://support.google.com/google-ads/answer/11546049
- Google target ROAS bidding: https://support.google.com/google-ads/answer/6268637
- Google Merchant Center product data specification: https://support.google.com/merchants/answer/7052112
- SHOPLINE Google Ads conversion tracking: https://help.shopline.com/hc/en-001/articles/900004854046-Setting-Up-Google-Ads-Conversion-Tracking-for-Your-Store
- SHOPLINE Google Ads remarketing: https://help.shopline.com/hc/en-001/articles/900004854166-Setting-Up-Google-Ads-Remarketing-in-SHOPLINE
- SHOPLINE UTM parameters: https://support.shoplineapp.com/hc/en-us/articles/360018762751-Urchin-Tracking-Module-UTM-Parameters
