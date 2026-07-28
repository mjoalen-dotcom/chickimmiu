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
- 宅配（TCAT/HOME）託運單、B2C 大宗寄倉（需另簽約）
- 逆物流（退貨門市代碼 ReturnStoreID）
- 物流狀態碼 → 訂單狀態自動流轉（現在只記錄不動狀態）
