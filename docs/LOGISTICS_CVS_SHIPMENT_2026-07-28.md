# 超商物流：CSP 修復 + C2C 託運單發號（2026-07-28）

## A. CSP form-action 修復（P0 — 地圖選店對真實顧客是壞的）

真人瀏覽器實測（chrome-mcp-bridge 控真 Chrome）發現：結帳頁「從地圖選擇門市」
按鈕卡在「地圖開啟中…」永遠不跳轉。

- 根因：`next.config.mjs` CSP `form-action` 只放行 `payment(-stage).ecpay.com.tw`，
  瀏覽器對 `logistics-stage.ecpay.com.tw/Express/map` 的 form POST **靜默擋掉**
  （`securitypolicyviolation` 事件實錄：`violatedDirective=form-action`）。
- 前一輪結論「Claude pane 擋跨域 form POST」是誤判——真 Chrome 一樣擋，
  正式環境的真實顧客同樣中招。**8d656c8 的地圖功能上線後從沒真的能用過。**
- 修法：`form-action` 加 `https://logistics.ecpay.com.tw https://logistics-stage.ecpay.com.tw`。
  （託運單標籤列印也是瀏覽器 form POST 到同網域，一併吃到。）

教訓：跨域 form POST 類功能，E2E 至少要有一次「真瀏覽器點按鈕」，
curl + 同源模擬蓋不到 CSP。

## B. C2C 託運單發號（/Express/Create）

出貨時對超商取貨訂單發號，配合顧客地圖選店存下的
`shippingMethod.convenienceStore.storeId`。

### 檔案
- `src/lib/logistics/ecpayExpress.ts` — Create 參數組建（MD5 CheckMacValue 沿用
  ecpayLogisticsMap）、`ResCode|detail` 回應解析、四超商標籤列印端點、
  狀態通知驗章。MerchantTradeNo=`CKL{orderId}T{base36ts}`（與金流 CK 前綴區隔）。
- `POST /api/admin/orders/cvs-ship` — 批次發號（admin only）。門檻：超商 carrier、
  storeId 必填、金額 1~19999、未發過號、寄件人設定齊。成功→回寫
  `ecpayLogisticsId / cvsPaymentNo(=trackingNumber) / cvsValidationNo`、
  標 shipped（觸發既有出貨通知信 hook）。取貨付款判定：`paymentMethod` 以
  `cash` 開頭且未付款 → `IsCollection=Y` + `CollectionAmount=total`。
- `POST /api/admin/orders/cvs-ship/print` — 回列印表單參數；前端開新視窗
  form POST 綠界列印頁（7-11 要驗證碼，全家/萊爾富/OK 只要寄貨編號）。
- `POST /api/logistics/ecpay/status` — Create 的 ServerReplyURL。驗 MD5 →
  寫 `shippingMethod.logisticsStatus`（`代碼|訊息|時間`）；全家等後配號的
  子類型會在通知裡補 `CVSPaymentNo` → 一併補寫追蹤碼。驗章失敗回 `0|…`。
- `OrderBulkShipPanel` 第三個 tab「超商發號（綠界 C2C 託運單）」：貼訂單編號 →
  發號 → 結果列出寄貨編號/驗證碼 + 逐筆「列印託運單」。cvs 模式不自動 reload。
- Orders `shippingMethod` 新 4 欄 + OrderSettings 新 `cvsShipping` group
  （寄件人名稱/手機）→ migration `20260728_150000_add_cvs_shipment_fields`。

### 上線前 user 必做
1. 後台「訂單設定 → 超商託運寄件人」：填真寄件人名稱 + 手機（09 開頭 10 碼）。
   sandbox E2E 期間填的是測試值，**正式出貨前務必改掉**。
2. 綠界廠商後台開通「物流模組」（憑證與金流不同組），抄三值進 prod `.env`：
   `ECPAY_LOGISTICS_MERCHANT_ID / _HASH_KEY / _HASH_IV` + `ECPAY_LOGISTICS_ENV=production`
   → `pm2 restart chickimmiu-nextjs`。憑證未填時 production 下 map 回 503、
   發號回 503，前台 fallback 手動輸入門市，不會炸。

### 尚未做（下次）
- ~~宅配（TCAT/HOME）託運單~~、B2C 大宗寄倉（需另簽約）
- ~~逆物流（退貨門市代碼 ReturnStoreID）~~
- ~~物流狀態碼 → 訂單狀態自動流轉（現在只記錄不動狀態）~~
- ↑ 三項 2026-07-29 已完成，見下節 C。

## C. 宅配託運 + 狀態自動流轉 + 逆物流（2026-07-29）

規格全對綠界官方文件（物流整合API 7380 系列 + 官方貨態碼 xlsx
developers.ecpay.com.tw/logistics_status/）。

### C-1 宅配（HOME）託運單發號 + 列印
- 綠界 HOME 只支援 **黑貓 TCAT + 中華郵政 POST**。**新竹物流（hct）
  綠界不支援**——維持人工填單號（統一託運/CSV 模式）。嘉里大榮同。
- `buildHomeCreateParams`（ecpayExpress.ts）：寄/收件人地址+郵遞區號必填、
  姓名 4~10 字元（中文計 2）、TCAT 帶溫層/規格/配達時段 + 可代收
  （上限 2 萬）、POST 必填重量不可代收。追蹤碼 = 回應的 `BookingNote`。
- `POST /api/admin/orders/home-ship` — 批次發號（門檻照 cvs-ship，
  另擋：無郵遞區號、地址 <6 字、cash_cod+post、代收 >2 萬）。
  寄件人讀 OrderSettings 新 `homeShipping` group（名稱/手機/郵遞區號/
  地址/溫層/規格/預設重量）。
- `POST /api/admin/orders/home-ship/print` — `/helper/printTradeDocument`
  表單參數（可多單合併列印）；前端開新視窗 form POST（CSP 已放行）。
- OrderBulkShipPanel 新 tab「宅配發號（綠界黑貓/郵政）」。

### C-2 物流貨態 → 訂單狀態自動流轉
- `src/lib/logistics/logisticsStatusMap.ts`：官方 xlsx 整表對照，只挑
  里程碑碼。UNIMARTC2C 2067 / FAMIC2C 3022 / HILIFEC2C 2067+3022 =
  買家取貨；TCAT 3003 = 配完；退回完成 = 2072/2070/2069（7-11）、
  3019/3023/3031（全家）、5008/3125（TCAT）等。
- status callback（/api/logistics/ecpay/status）驗章後：
  貨態一律寫 `logisticsStatus`；退貨類同步寫 `returnLogisticsStatus`；
  里程碑流轉：取貨/配完 → `delivered`（觸發送達信 hook）、退回完成 →
  新訂單狀態 **`returned`（已退回）**。冪等 + 不倒退（nextOrderStatus）。
- 總開關：OrderSettings.statusFlow.`autoStatusFromLogistics`（預設開）。
- 訂單狀態 select 新增 `returned`；前台帳戶頁 + admin cell 都有 label。

### C-3 逆物流（退貨）
- **超商 C2C 沒有逆物流 API**（綠界只有 B2C 有）。C2C 退貨機制 =
  買家未取自動退回寄件門市；**7-ELEVEN C2C 可在發號時帶
  `ReturnStoreID` 指定退貨門市**（其他超商帶了也退原寄件門市）——
  OrderSettings.cvsShipping 新欄「7-ELEVEN 退貨門市代號」，cvs-ship
  發號自動帶上。
- 宅配退貨：`POST /api/admin/orders/return-ship` → `/Express/ReturnHome`
  （僅 TCAT）：黑貓去顧客地址收退貨、送回商家（homeShipping 那組）。
  成功只回 `1|OK` 無新單號——標 `returnLogisticsId=RH@時間`，
  後續貨態由逆物流狀態通知打回同一支 status callback（靠原
  AllPayLogisticsID 對單）寫進 `returnLogisticsStatus`。
  Panel 新 tab「宅配退貨（黑貓收退件）」。

### C-4 OK 超商下架
- 綠界官方貨態碼表異動歷程載明 **OK 超商 C2C 已於 2026/7/1 終止服務**
  → `CVS_SUBTYPE` 移除 `ok: OKMARTC2C` + 列印端點移除。prod
  shipping-methods 本來就沒有 OK 選項，前台無感。

### Migration
`20260729_090000_add_home_shipping_return_logistics`：orders 2 欄
（return_logistics_id/status）+ order_settings 9 欄（cvs 退貨門市、
home_shipping_* 7、status_flow_auto_status_from_logistics）。

### 上線前 user 必做（2026-07-29 盤點）
1. **（未完成！）** prod `.env` 實際上沒有任何 `ECPAY_LOGISTICS_*`
   （全機 grep 過，唯一出現在 .env.example）。地圖/發號現在都在
   sandbox fallback（MerchantID 2000933）。要重做：抄三值 + ENV=production
   + `pm2 restart chickimmiu-nextjs`。
2. 後台「訂單設定 → 超商託運寄件人」手機仍是 `0912345678`（測試佔位）。
3. 新增：「訂單設定 → 宅配託運寄件人」四欄（名稱/手機/郵遞區號/地址）
   填齊才能宅配發號；7-11 退貨門市代號選填。
