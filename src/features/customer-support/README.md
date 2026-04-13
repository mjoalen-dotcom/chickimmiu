# Customer Support 客服模組

此資料夾為階段 4-5 開發範圍。

## 責任範圍
- 右下角浮動客服按鈕（FAB）
- **LINE Official Account Widget** 整合
- **Meta Messenger Customer Chat Plugin** 整合
- 客服設定（LINE_OA_ID、FB_PAGE_ID）全部可從後台調整
- 離線自動回覆文字
- 常見問題 FAQ

## 相關 Payload Globals（階段 4 會建立）
- `support-settings`：
  - `line.enabled`、`line.oaId`
  - `messenger.enabled`、`messenger.pageId`、`messenger.themeColor`
  - `fabPosition`、`greetingText`
