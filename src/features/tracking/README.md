# Tracking 廣告追蹤模組

此資料夾為階段 6 開發範圍。

## 責任範圍
- **Google Tag Manager** 容器載入
- **Meta Pixel** 事件推送
- **Meta Conversion API (CAPI)**：Server-side 事件（避免 iOS ATT 掉資料）
- **GA4** 電商事件（view_item / add_to_cart / purchase）
- **Google Ads** Enhanced Conversions
- **Cookie Consent Banner**（符合 GDPR / 台灣個資法）
- 所有追蹤 ID 與事件開關可在後台調整

## 相關 Payload Globals（階段 6 會建立）
- `tracking-settings`：
  - `gtmId`、`metaPixelId`、`ga4Id`、`googleAdsId`
  - `capiAccessToken`（加密存放）
  - 各事件開關（purchase、add_to_cart...）
- `consent-settings`：同意書文案、按鈕文字、Cookie 類別

## Server-side 事件
- 使用 Next.js Route Handler `/api/track/meta-capi`
- 訂單完成後呼叫 Payload hooks 觸發 CAPI 推送
