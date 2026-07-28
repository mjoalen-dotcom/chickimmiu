# CKMU 上線開賣 — 修復工單（Launch Readiness Punch-List）

- **稽核日期**：2026-07-27
- **稽核對象**：pre.chickimmiu.com（封測站，新 Payload/Next.js 站）
- **方法**：4 面向平行原始碼稽核 + prod REST/HTML 實測
- **總判定**：🔴 **尚不可上線開賣**。內容/資料/法遵頁/SEO/後台管理已接近成品，但**「收顧客的錢」整條路徑每一段都有致命問題**。

> 分派方式：每張工單自帶檔案:行號、根因、修法、驗收條件，可獨立開 PR。優先做 **LB-01 ~ LB-07（P0）**；LB-08 起可平行或上線後收尾。

---

## 0. 摘要表

| ID | 嚴重度 | 類別 | 一句話 | 類型 | 狀態 |
|---|---|---|---|---|---|
| LB-01 | 🔴 P0 | 金流 | 線上金流零串接 + prod 一個付款方式都沒開 | 程式+設定 | ✅ 2026-07-27 現金版：防呆+預設修正 `a049848`；enabledMethods 由 enable-cash-launch.ts 開 cash_cod/meetup（線上金流串接仍未做，見 §4） |
| LB-02 | 🔴 P0 | 金流 | 選變體 → NT$0 結帳 | 程式(+資料) | ✅ 2026-07-27 `4383555`，prod 購物車實測 3480 非 0 |
| LB-03 | 🔴 P0 | 庫存 | 超賣無防護 + 下單/處理雙重扣庫存 | 程式 | ✅ 2026-07-27 `4383555`（閘門在關預購後才實際生效） |
| LB-04 | 🔴 P0 | 庫存 | 1395 件商品 stock 全 0，只靠全站預購 | 資料+決策 | ⏳ 待拍板（現況=全站預購接單，可先賣） |
| LB-05 | 🔴 P0 | 通知 | 下單當下不發確認信，且文案謊稱「已收到付款」 | 程式 | ✅ 2026-07-27 `a049848` create 即寄 + statusLine 動態文案 |
| LB-06 | 🔴 P0 | 訂單 | 60 分鐘自動取消誤殺貨到付款訂單 | 程式/設定 | ✅ 2026-07-27 `a049848` 排除現金單（註：outage crontab 本來就沒排 auto-cancel，此為回歸保險） |
| LB-07 | 🔴 P0 | 法遵 | 首頁假網紅 + 假讚數 live（不實廣告曝險） | 程式/資料 | ✅ 2026-07-27 `a049848` DEMO_UGC 全移除，空集合不渲染 |
| LB-08 | 🟠 P1 | 設定 | PAYLOAD_SECRET / DATABASE_URI 靜默 dev fallback | 設定(+程式) | ✅ 2026-07-27 晚 `ee6472c` production 缺任一即 throw fail-fast；prod build 通過（= env 齊全實證） |
| LB-09 | 🟠 P1 | 內容 | 7 個導覽主題系列全空 | 資料 | ✅ 2026-07-27 七系列綁真商品 197 tags（來源=Shopline tags/分類/舊站分類爬回比對；scripts/oneoff/seed-collection-tags-20260727.py；demo 商品 id1-9 的暫時 tags 已移除） |
| LB-10 | 🟠 P1 | SEO | 封測站 robots 仍 allow:/ | 程式/設定 | ✅ 2026-07-27 robots.ts 依 NEXT_PUBLIC_SITE_URL host（pre./staging. 前綴）或 DISABLE_INDEXING=1 全站 Disallow；prod env 已確認設 pre. |
| LB-11 | 🟠 P1 | 上線 | www 仍是舊 Shopline，需域名切換計畫 | 營運 | — |
| LB-12 | 🟠 P1 | 物流 | ShippingMethods 後台無效（運費寫死前端） | 程式 | ✅ 2026-07-27 結帳改讀 /api/shipping-methods（isActive+sortOrder；carrier→tab 類型 derive；API 掛掉 fallback 硬編碼）；prod 後台既有 8 筆設定直接生效 |
| LB-13 | 🟠 P1 | 轉換 | 結帳強制填生日+性別、店家新單通知信箱空 | 設定 | ✅ 2026-07-27 晚 `scripts/oneoff/launch-settings-20260727.ts`：生日/性別必填=false + adminAlertEmails=service@chickimmiu.com + sendAdminNewOrderAlert=true（prod API 驗證生效） |
| LB-14 | 🟡 P2 | 收尾 | 客服資訊不一致 / 退款不回補 / 訪客結帳名實不符等 | 雜項 | 1 天 |

---

## 1. P0 — 收錢層（開賣的絕對前提）

### LB-01 🔴 線上金流零串接，且 prod 後台一個付款方式都沒開
**根因**
- `Orders.ts:313-327` `paymentMethod` enum 有 `paypal/ecpay/newebpay/linepay/cash_cod/cash_meetup`，但**全 repo 沒有任何金流閘道串接程式碼**——無導向、無付款擷取、無 callback/webhook 回填 paid。
- `checkout/page.tsx:722` 建單直接 `POST /api/orders`（Payload 預設 REST），建完（`:800+`）就進 Pixel 追蹤 → 跳成功頁，**線上付款方式選了等於沒收錢**。
- prod 實測 `/api/payment-settings` → `{"enabledMethods":[]}`；結帳過濾邏輯 `checkout/page.tsx:457` 是「不在 enabledMethods 就隱藏」→ **目前顧客結帳頁零付款選項**。
- 唯一 code-work 的是現金：`cash_cod`（貨到付款）、`cash_meetup`（面交），設計上 unpaid → admin 手動標 paid。

**修法（依路徑）**
- **路徑 A（現金先開賣，不寫金流）**：
  1. 後台 GlobalSettings → 付款 → `enabledMethods` 勾入 `cash_cod`、`cash_meetup`（設定，非程式）。
  2. **補防呆**：`checkout/page.tsx handleSubmit`（`:577`）在 `setIsProcessing(true)` 前加 `if (availablePayments.length === 0 || !availablePayments.some(p=>p.id===selectedPayment)) { setSubmitError('目前無可用付款方式，請聯繫客服'); return }`，避免建出死的 unpaid `ecpay` 訂單。
  3. 把結帳預設 `selectedPayment`（`:254`）從 `'ecpay'` 改為第一個可用方式，或初始不預選。
- **路徑 B（線上刷卡）**：見 §4 ECPay 串接工單。

**驗收**
- 結帳頁至少顯示一個可選付款方式；選不到有效付款時**擋住送出**並提示。
- 建單後 `paymentMethod` 正確；現金單 `paymentStatus:unpaid` 且進入後台待處理。

---

### LB-02 🔴 選變體 → NT$0 結帳
**根因**
- `ProductDetailClient.tsx:337` `currentPrice = selectedVariant?.priceOverride ?? salePrice ?? price`。prod **每個變體 `priceOverride=0`**（不是 null），`0 ?? …` 回傳 0 → 選色/尺寸價格掉成 0。
- 0 帶入購物車 `salePrice:0`（`:386`），`cartStore.ts:124,242` 以 `salePrice ?? price` 計價 → **0 元結帳** + 顯示 100% off 徽章。
- `ProductQuickView.tsx:64` 同一 bug。時尚商品幾乎都需選變體才可購（`canAddToCart`，`:346`），列表頁與未選變體 PDP 價格正確，**極易漏測**。

**修法**
- 三處改為「>0 才採用 override」（比照 `feedBuilder.ts:175` 已正確做法）：
  `const price = (v?.priceOverride && v.priceOverride > 0) ? v.priceOverride : (salePrice ?? basePrice)`
- 併資料清理：prod 變體 `priceOverride: 0 → null`（一次性腳本），根治。

**驗收**
- 任選變體，PDP 價格 = 該變體實售價（非 0）；加入購物車 `unitPrice` 正確；結帳 `total` 正確；無 100% off 假徽章。

---

### LB-03 🔴 超賣無防護 + 雙重扣庫存
**根因**
- 扣庫存在 **afterChange**（`Orders.ts:676-739`，訂單已 commit 之後）且用 `Math.max(0, stock-qty)`（`:702,:715`）——**不足只歸零、從不拒單**。並發下單兩人搶同一件都成功。`src/lib/inventory/server.ts:40,56` 同 floor pattern。
- 觸發條件 `operation==='create' || (status'processing' && prev'pending')`（`:682`）。訂單預設 `pending`，checkout 送 `pending`，之後正常推進 pending→processing 會**再扣一次** → 庫存以 2× 失真。

**修法**
- （a）**去重扣**：把扣減限制成「只在 create」或「只在 pending→processing」其一，不可兩者都扣。
- （b）**加下單前可用量檢查**：於 `Orders.ts` beforeChange/beforeValidate，對每個 item 檢查 `qty <= 可用庫存`（除非該商品 `allowPreOrder`），不足則 throw → 建單被拒回明確錯誤。

**驗收**
- 下單只扣一次；pending→processing 不再扣。
- 庫存不足且非預購 → 建單被拒、回可讀錯誤、前端顯示「庫存不足」。
- 並發下單不超賣（可用交易/樂觀鎖或唯一性驗證）。

---

### LB-04 🔴 1395 件商品庫存全 0
**根因**：prod 全部商品與變體 `stock:0`、`totalSold:0`，目前只因全站 `allowPreOrder:true` 才賣得出去；一旦關預購，整個目錄不可售。
**修法（需決策）**
- 決定預購政策：若「現貨為主」→ 匯入真實庫存（stocktake/import），並把非現貨商品才開 `allowPreOrder`。
- 若「全預購接單」→ 明確保留 allowPreOrder，但需搭配 LB-05 文案講清出貨時程。
**驗收**：預購政策拍板；若非全預購，主要在售商品有真實庫存數。

---

### LB-05 🔴 下單不發確認信 + 文案謊稱已付款
**根因**：確認信唯一呼叫點 `Orders.ts:1097` 在 `status'processing' && prev'pending'` 內（`:1088`）。checkout 寫 `pending` → 顧客下單後一片安靜，要等店員手動推進才收到信；且該信文案「已收到付款並開始處理」（`orderConfirmation.ts:158`、`renderFromTemplate.ts:176`）對未付款 COD **是假訊息**。
**修法**
- 在 `Orders.ts` afterChange 的 `operation==='create'` 分支發「訂單已成立」信（best-effort、不 block）。
- 文案改為依 `paymentStatus` 動態：unpaid COD → 「訂單已成立，將於配送時收款」；paid → 「已收到付款」。避免與既有 processing 信重複（擇一，或 create 發「成立」、paid 才發「已收款」）。
**驗收**：下單後顧客立即收到訂單成立信；COD 信不宣稱已付款。

---

### LB-06 🔴 自動取消誤殺貨到付款訂單
**根因**：`orderAutoCancel.ts:12-65` 取消所有 `unpaid && pending && createdAt<now-N`；COD 本質就是 unpaid+pending。預設 `autoCancelUnpaidMinutes=60`（`OrderSettings.ts:75-84`），cron `POST /api/cron/auto-cancel-orders`（GitHub Actions 排程）。→ 隔夜 COD 單無確認信、1 小時後被取消、顧客收到「取消通知」。
**修法**：`runAutoCancelUnpaid` 查詢排除 `paymentMethod in (cash_cod, cash_meetup)`（**首選**，程式）；或現金launch先設 `autoCancelUnpaidMinutes=0`（設定，暫緩）。並確認 GitHub Actions 排程 + `CRON_SECRET` 在 prod 存在。
**驗收**：現金單不被自動取消；僅線上金流逾時未付款才取消。

---

### LB-07 🔴 首頁假網紅 + 假讚數 live
**根因**：`UGCGallery.tsx:30-103` 內建 `DEMO_UGC`——6 個虛構 IG 創作者（Mia Style `@mia_style_tw`、KK Fashion…）+ 捏造按讚/留言數（342/218/…）。首頁 `page.tsx:551-556` 在 `ugc-posts` 空時 fallback 顯示，且連到真實可購商品。**公平交易法不實廣告曝險**（prod 已實測會渲染 6 個假作者名與讚數）。
**修法**：擇一——（a）seed 真實 `ugc-posts`；（b）collection 空時**不 fallback 到 DEMO**，直接隱藏該區；（c）後台 `ugcSection.visible=false`。移除或改真前不得上線。
**驗收**：prod 首頁不出現任何虛構創作者/讚數。

---

## 2. P1 — 上線設定 / 營運

### LB-08 🟠 env 靜默 dev fallback
`payload.config.ts:526` `PAYLOAD_SECRET → ''`（空密鑰＝不安全 token 簽章）；`:532` `DATABASE_URI → file:./data/chickimmiu.db`（未設會靜默跑空本地 DB）。
**修法**：確認 prod 兩者已設；建議 `if (NODE_ENV==='production' && (!PAYLOAD_SECRET||!DATABASE_URI)) throw` 讓缺失時啟動即報錯。**驗收**：prod 確認已設；缺失時 fail-fast。

### LB-09 🟠 7 個導覽主題系列全空
`Navbar.tsx:40-48` 的 7 個下拉（金老佛爺 Live / 主播同款 / 婚禮洋裝 / 現貨速到…）點進去皆 `collections/[slug]/page.tsx:111` 空狀態「敬請期待」。
**修法**：為這些 collection 綁定商品（後台/腳本），或把空的系列從導覽移除。**驗收**：導覽每個系列有商品，或已移除。

### LB-10 🟠 封測站被索引風險
`robots.ts` 回 `allow:'/'`；`NEXT_PUBLIC_SITE_URL` 預設 prod 域名。**修法**：封測 host `Disallow:/`（host-based 或 env 旗標），並明確設 `NEXT_PUBLIC_SITE_URL`。**驗收**：pre. 站 robots 阻擋索引；canonical/OG/sitemap 指向正確 host。

### LB-11 🟠 域名切換
`www.chickimmiu.com` 目前仍是舊 SHOPLINE 店（openresty+CloudFront、`/api/products` 302）；新站僅 pre.；apex `chickimmiu.com` 連不上。**修法**：規劃 www 從 Shopline 切到新站（DNS/proxy）+ 回滾方案 + apex 修復。**驗收**：切換 runbook 就緒。

### LB-12 🟠 ShippingMethods 後台無效
結帳運費/物流寫死在 `checkout/page.tsx:125-236`（`SHIPPING_OPTIONS`）；`ShippingMethods` collection **完全沒被結帳讀取**——店家後台改運費無效。**修法**：改為結帳讀 `/api/shipping-methods` 資料驅動；或明確標示該 collection 未使用並自後台隱藏。**驗收**：後台改運費會反映到結帳，或已明確標示不使用。

### LB-13 🟠 轉換摩擦 + 店家收不到新單
prod `/api/checkout-settings` 顯示 `birthdayRequired:true, genderRequired:true`——結帳強制填生日+性別。`OrderSettings.notifications.adminAlertEmails` 預設空（`OrderSettings.ts:132-139`）→ 店家收不到新單通知。**修法**：後台把生日/性別必填關掉；`adminAlertEmails` 填入收件人。**驗收**：結帳不強制生日/性別；下單後店家信箱收到新單通知。

---

## 2.5 全站檢查發現（2026-07-27 稽核後補）

- **✅ 已修：商品 aliasSlugs 轉址死碼** — `redirect()` 是 throw 實作，被 PDP 的 try/catch 吞掉，Shopline 舊網址轉址從未生效。已抽 `findAliasTarget()` + `permanentRedirect(308)` 移出 try（`63c149e`）。注意：prod 目前查無帶 aliasSlugs 的商品資料，路徑尚無真實資料可驗，程式已就緒。
- **⚠️ 已知限制：全站 soft-404（狀態碼 200、內容是 404 頁）** — root `(frontend)/loading.tsx` 讓 force-dynamic 頁在任何 page 邏輯前就 flush 200 殼；Next 15.5 streaming metadata 下連 generateMetadata 的 notFound() 也攔不到狀態碼（Googlebot/Twitterbot UA 實測皆 200）。已在五路由 metadata 加 notFound()（部分 crawler 路徑有效 + 未來框架行為變更即生效）。**完整修法需重估 root loading.tsx**（綁 B5 開機信標，勿貿然拔）。實害評估：內容正確（Google soft-404 偵測會排除）、sitemap 只列真實網址；正式上線後在 GSC 觀察即可。
- **✅ 檢查通過**：全站 smoke 44/45（唯一 fail 即上述狀態碼）；pm2 錯誤 log 乾淨；首頁瀏覽器目檢（商品卡/區塊正常、假 UGC 歸零）。

## 3. P2 — 收尾（可上線後）
- **客服資訊不一致**：時間 09:30 vs 10:00（`faq/page.tsx:83`）；地址少「信義區/京華大樓」；兩組 LINE 連結（`lin.ee/AYWzgKW` vs `page.line.me/nqo0262k`）確認是否同一 OA。
- **`/contact` 無 email**：`GlobalSettings.ts:172` `businessInfo.email` 未 seed → 聯絡頁與 Organization JSON-LD 無 email；seed 為 `service@chickimmiu.com`（與隱私/退換頁一致）。
- **訪客結帳名實不符**：`CheckoutSettings.checkoutAsGuest:true` 但程式強制登入（`checkout/page.tsx:593-599`，Orders.customer 必填）。二擇一：真做訪客結帳，或關掉該設定文案。
- **退款不完整**：退款只改 status，**不回補庫存、不撤回收藏卡**（restock/card-revoke 只綁 `cancelled`，`Orders.ts:1043,1241`）；退款信文案講信用卡退款時程（`renderFromTemplate.ts:276`）對現金不適用。
- **`autoCompleteAfterDelivery`** 設定無對應 cron（`OrderSettings.ts:86-98`）＝ no-op，移除或補實作。
- **SEO 標題重複**：`退款政策 | CHIC KIM & MIU｜CHIC KIM & MIU`（`seoTitle` 已含品牌，template 又補一次）。
- **`.env.example` 補漏**：`ECPAY_INVOICE_MERCHANT_ID/HASH_KEY/HASH_IV`（`ecpayInvoiceEngine.ts:85-87`）、`LINE_CHANNEL_ACCESS_TOKEN/SECRET`（Messaging）未列。
- **變體 colorCode 全 null** → PDP 色票無色塊可渲染。

---

## 4. 路徑 B 專屬：ECPay 線上金流串接（若選完整上線）
> 需你先提供憑證：綠界 **MerchantID / HashKey / HashIV**（測試站可先用綠界測試值）。env：`ECPAY_MERCHANT_ID / ECPAY_HASH_KEY / ECPAY_HASH_IV`。

> **✅ 2026-07-27 程式面已全部串完**（`src/lib/payment/ecpay.ts` + `/api/payment/ecpay/{create,callback,result}` + checkout 二段式導向）。現況：
> - prod `.env` 的 `ECPAY_ENV=sandbox` 且憑證留空 → 自動用綠界公開測試商店 2000132，**後台把 `ecpay` 勾進 enabledMethods 即可全程測刷卡**（測試卡 4311-9522-2222-2222，安全碼 222）。
> - 拿到正式憑證後：填 `ECPAY_MERCHANT_ID/HASH_KEY/HASH_IV`、改 `ECPAY_ENV=production`、`pm2 restart chickimmiu-nextjs` 即切正式。production 憑證缺值時 create API 回 503，不會誤用測試商店收單。
> - `ChoosePayment` 預設 Credit（同步刷卡）；ATM/超商代碼屬非同步取號，會被 60 分鐘自動取消誤殺，開 ALL 前先調整取消時窗（env `ECPAY_CHOOSE_PAYMENT` 可覆蓋）。
> - callback 冪等（paid→paid 不重觸發）；已付款信/點數/銷量/佣金走既有 unpaid→paid hooks（`Orders.ts:749`）。原始回傳記在 pm2 log（`[ecpay] callback raw`）。
> - ~~電子發票（第 5 點）與超商電子地圖（第 6 點）仍未做~~ → 兩項均已完成（見第 5、6 點 2026-07-28 補記）。
>
> **✅ 2026-07-27 晚 E2E 驗收完成（訂單 CKMU20260727002）**：登入 → 加購物車 → 結帳選 ecpay → 綠界 sandbox 測試卡 4311-9522-2222-2222 → 3D 驗證（頁面顯示 OTP=1234）→ callback 回填 paid（TradeNo `2607272249180591`）→ 導回成功頁。點數 +1680 + 升等 bronze 贈點 +100、mint 卡 +1、訂單確認信 + **付款完成信**（新增 `payment_received` 事件，`445afa8`）+ 綠界通知信全數實收；callback 重送實測 `1|OK` 且不重複入點。發票自動開立失敗屬預期（`ECPAY_INVOICE_*` 未設）。
> - **⚠️ sandbox 商店已換 3002607**（官方現行測試店，3D 頁直接顯示 OTP）：舊公開店 2000132 在新版 pay-stage VerifySMS 簡訊流程走不完（固定碼 1234 被拒、錯 3 次交易作廢，實測 4 個 tradeNo 陣亡）。fallback 憑證已改進 `ecpay.ts`。
> - **正式切換（靚秀既有綠界帳號）**：登入綠界廠商後台 → 系統開發管理 → 系統介接設定，抄 MerchantID/HashKey/HashIV 三值填 prod `.env` 的 `ECPAY_MERCHANT_ID/ECPAY_HASH_KEY/ECPAY_HASH_IV` + `ECPAY_ENV=production` + `pm2 restart chickimmiu-nextjs --update-env` 即正式收單，無須重新申請。
> - 測試遺留：訂單 CKMU20260727001（unpaid，已手動取消）、CKMU20260727002（paid，驗收證據，商品 4833 totalSold +1）；測試會員 id=12 `mjoalen+ecpaytest@gmail.com`。

**新開發範圍（純新增，約 1–2 週）**
1. **建單改二段式**：現有 `POST /api/orders` 建 `unpaid/pending` 後，對線上金流方式**不跳成功頁**，改導向自建 `POST /api/payment/ecpay/create` → 產生 ECPay 表單（含 `CheckMacValue`、`MerchantTradeNo`=訂單號、`ReturnURL`、`OrderResultURL`、`ClientBackURL`）→ 302/auto-submit 到綠界付款頁。
2. **付款結果回填**：`POST /api/payment/ecpay/callback`（server-to-server `ReturnURL`）驗 `CheckMacValue` + `RtnCode==1` → 訂單 `paymentStatus:paid` → 觸發已付款信 + 點數/銷量/佣金（既有邏輯已 gate 在 paid，`Orders.ts:749`）→ 回應綠界 `1|OK`。
3. **顧客導回**：`OrderResultURL`/`ClientBackURL` → 導回 `checkout/success/[orderId]`。
4. **對帳/冪等**：callback 需冪等（同一訂單重送不重複加點）；保留原始回傳存 log。
5. **（可選）電子發票**：`ecpayInvoiceEngine.ts` 已有骨架，補 `ECPAY_INVOICE_*` 憑證後於 paid 時開立。
   > **✅ 2026-07-28 傳輸層已改寫為新版 B2CInvoice JSON+AES 並 stage E2E PASS**（舊版 CheckMacValue+form-urlencoded 被 stage 拒收 HTTP 500 `TransCode:128`）。
   > - 新格式：POST JSON `{MerchantID, RqHeader:{Timestamp}, Data}`，Data = base64(AES-128-CBC/PKCS7(URL-encode(JSON), HashKey, HashIV))；回應 `TransCode=1` 才解密 Data 取 `RtnCode`。Issue/GetIssue/Invalid/Allowance 四支全改；查詢/作廢/折讓必帶 InvoiceDate（取日期部分）。
   > - **E2E 證據（stage 2000132）**：Issue → `RtnCode:1 開立發票成功`，發票 **LA20052028**（2026-07-28 08:21:08、RandomNumber 4393、RelateNumber CKE2EMS3WU5PT）；GetIssue → `查詢成功`（IIS_Upload_Status=1、載具 CarrierType=1 綠界會員載具）；Invalid → `作廢發票成功`。腳本：`scripts/oneoff/e2e-ecpay-invoice-20260728.ts`（`pnpm payload run` 可重跑）。
   > - **設定模式改比照金流**：`ECPAY_INVOICE_ENV=sandbox|production`（未設看 NODE_ENV）；sandbox 缺值 fallback 官方測試憑證 2000132；**production 缺 `ECPAY_INVOICE_MERCHANT_ID/HASH_KEY/HASH_IV` 任一值 → 一律略過開立**（不打 API、不建 failed 紀錄、retry cron 不空轉），log 一行可查。
   > - 正式啟用：綠界廠商後台抄電子發票介接三值（與金流 ECPAY_* 不同組）→ 填 prod `.env` + `ECPAY_INVOICE_ENV=production` + `pm2 restart chickimmiu-nextjs --update-env`。
   > - ~~已知限制（既有行為，非本次引入）：`autoIssueInvoiceForOrder` 以 `order.total` 開發票，若訂單含運費/折抵使品項小計 ≠ 總額，綠界會以金額不符拒開（會留 failed 紀錄 + retry），正式啟用前如有運費需補品項調整列。~~
   > **✅ 2026-07-28 品項合計對帳已修（`ce334a1`）**：autoIssue 逐列展開「運費」「貨到付款手續費」，折價券/會員折扣/購物金等剩餘差額補一列負數「折扣折抵」；`issueInvoice` 內新增 `reconcileInvoiceItems` 最終防呆——任何呼叫端（含 retry 舊 failed 紀錄）品項合計 ≠ SalesAmount 一律自動補調整列，金額不符拒開不再可能。total ≤ 0 全額折抵訂單直接略過不開票。**Stage E2E PASS**：運費正列 LA20054485（SalesAmount 980）、負數折抵列 LA20054486（SalesAmount 900），開立+查詢均 RtnCode=1。
   > - ⚠️ 啟用順序注意：prod 目前金流 `ECPAY_ENV=sandbox`。發票切 production 前金流應同步（或先）切 production，否則會對 sandbox 測試訂單開出真發票。兩組憑證（系統介接設定、電子發票介接）同一次登入綠界後台一起抄。
6. **超商取貨物流**：目前 CVS 門市是顧客手打（`checkout/page.tsx:1128`），如要真物流需另接 ECPay 電子地圖/物流 API（`orderSelfService.ts:6-9` 註解提到但未發號）。
   > **✅ 2026-07-28 電子地圖選店已上線（`8d656c8`）**：結帳頁「從地圖選擇門市」→ `POST /api/logistics/ecpay/map` 產表單（`src/lib/logistics/ecpayLogisticsMap.ts`，物流 CheckMacValue 用 **MD5**）auto-submit 到 `/Express/map` → 綠界以顧客瀏覽器 POST 門市（CVSStoreID/Name/Address）回 `/api/logistics/ecpay/map/reply` → 303 導回 `/checkout?cvs=…` 回填。來回是整頁跳轉，表單以 sessionStorage 草稿保全（一次性、2h TTL）；跨超商切換自動清舊門市。
   > - **sandbox E2E PASS**：map 參數（stage C2C 2000933 + 我方 CheckMacValue）綠界 HTTP 200 接受並轉入 7-11 地圖 bootstrap；reply→回填→下單，訂單 CKMU20260728001 `shippingMethod.convenienceStore` = 測試門市/131386/南港三重路 正確落庫（本機 DB，非 prod）。
   > - env：`ECPAY_LOGISTICS_MERCHANT_ID/HASH_KEY/HASH_IV`（物流模組與金流**不同組**憑證，綠界後台需開通物流）+ `ECPAY_LOGISTICS_ENV`（未設沿用 ECPAY_ENV）+ `ECPAY_LOGISTICS_CVS_TYPE`（預設 C2C 店到店；B2C 大宗寄倉需另簽約且無 OK）。sandbox 缺值 fallback 物流文件測試店（C2C 2000933/B2C 2000132）；**production 缺值 → map API 回 503，前端顯示「請直接輸入門市資訊」，手打 fallback 不受影響**。
   > - 尚未做：物流「託運單建立」（B2C/C2C 出貨 API 發號）、出貨後門市配達追蹤——地圖選店只解決結帳端門市正確性。

**驗收**：測試站完成一筆刷卡 → 付款 → callback 回填 paid → 顧客導回成功頁 → 後台顯示已付款 + 已寄已付款信 + 點數入帳；重送 callback 不重複加點。

---

## 5. 上線前「非程式」設定檢查清單（後台/環境，不需寫 code）
- [x] GlobalSettings → 付款 → `enabledMethods` = cash_cod / cash_meetup / **ecpay**（2026-07-27 晚）
- [x] OrderSettings → `adminAlertEmails` = service@chickimmiu.com（2026-07-27 晚）
- [ ] OrderSettings → `autoCancelUnpaidMinutes` 對現金版設 0（或等 LB-06 程式排除）
- [x] CheckoutSettings → 關閉生日/性別必填（2026-07-27 晚）
- [ ] GlobalSettings → `businessInfo.email` = `service@chickimmiu.com`
- [x] prod env 確認：`PAYLOAD_SECRET`、`DATABASE_URI` 由 LB-08 fail-fast + build 通過實證；其餘依既有專案記錄已驗
- [ ] 封測站 robots `Disallow:/`（LB-10）
- [ ] 首頁 UGC 區：seed 真實內容或隱藏（LB-07）
- [ ] 7 個導覽系列綁商品或移除（LB-09）
- [ ] 域名切換 runbook（LB-11）

---

## 附錄：已驗證「就緒/正常」的部分（不需動）
- 商品**資料模型完整**（價格/售價/成本/變體 color×size/SKU/GTIN/庫存/低庫存/預購/限購/稅別）；**1395 件真實 Shopline 遷移商品**，真價格、R2 圖片（`imageMigration.status:done`）。
- 三個歷史地雷**確認在 write-path 修好**：richText HTML 中毒（`lib/richtext/htmlToLexical.ts` + `Products.ts:192-194` 守門）、Lexical upload node（import 腳本 `value:mediaDoc.id`）、`/products` server-side 真分頁（`products/page.tsx`，depth:1 + select 白名單）。
- **無顧客端 500 風險**：SSR 頁皆 `if(DATABASE_URI){try…catch}` 降級；LINE/Resend/R2 呼叫皆 guard。
- **法遵三大件齊全紮實**：服務條款/隱私權/退換貨（消保法 7 天、統編 24540533、靚秀國際有限公司、台北地院管轄）。
- 公司/統編/銀行（中國信託 822）/電話（02-2718-9488）/工作室地址/LINE 等信任資訊齊全。
- **SEO/ops 齊**：robots.ts、sitemap.ts（DB-guarded）、favicon（CMS+靜態 fallback）、18 個路由 generateMetadata、JSON-LD、llms.txt。
- **後台訂單管理可用**：檢視/處理/出貨/**批次出貨**（uniform+mapping 模式）/CSV 匯出/退款。
- 導覽與 footer **無死連結**；受保護頁 `/pages/ckmu-on-show` 完整（`CelebrityFeatures`=3）。
- Email 模板系統 fallback 穩固；RESEND 依專案記錄已於 prod 驗證真寄。

---

## 建議排程
1. **先做 P0 LB-02 / LB-03**（純程式災難：NT$0、庫存）——不論走哪條路徑都要。
2. **現金版開賣（路徑 A）**：+ LB-01(設定+防呆)、LB-05、LB-06、LB-07、LB-04(決策)、§5 清單 → **2–4 天可實際收單**。
3. **疊上線上刷卡（路徑 B）**：§4 ECPay 串接（需憑證）→ **額外 1–2 週**。
4. P1/P2 與域名切換（LB-11）並行收尾。
