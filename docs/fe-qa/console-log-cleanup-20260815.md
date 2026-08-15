# console.log / debugger / TODO 全站巡檢（FE-QA-001 Prompt I 項目3）

範圍：`src/app/(frontend)`、`src/components`（會送到瀏覽器執行的前台程式碼）。`src/lib/*`（CRM／行銷／發票等 server-only 商業邏輯引擎）的 console.log 屬於正常 pm2 log 級操作紀錄，非 FE-QA 範疇，未列入清理。

## 已清除

| 檔案 | 內容 | 處置 |
|---|---|---|
| `src/components/gamification/DailyCheckIn.tsx` | 每次簽到點擊都印出 `[DailyCheckIn] Day N reward...`，狀態早已寫入 localStorage，log 無實際用途 | 直接刪除 |
| `src/app/(frontend)/partner/earnings/page.tsx` | 「匯出 CSV」按鈕僅 `console.log`，無實際匯出邏輯 | 改為 TODO 註解（見下方保留說明） |
| `src/app/(frontend)/partner/withdraw/page.tsx` | 「送出提款」按鈕僅 `console.log`，無實際送出邏輯 | 改為 TODO 註解（見下方保留說明） |

## 刻意保留（非噪音，具操作意義）

| 檔案 | 內容 | 為何保留 |
|---|---|---|
| `src/app/(frontend)/products/[slug]/page.tsx:60,63` | `console.log('[PDP] miss', ...)` / `console.error('[PDP] payload.find threw:', ...)` | Server-side 執行（不進瀏覽器 console），是商品 slug 找不到時的 ops 診斷，過去曾靠這類 log 抓到 sitemap／slug decode 相關的正式 bug，貿然刪除會少一條排錯線索 |
| `src/app/(frontend)/api/cron/automations/route.ts:140` | `// 觸發旅程需要另外的「即將過期」邏輯，留 TODO。` | 標記真實未完成的功能缺口，非除錯殘留 |

## 附帶發現（超出本項範圍，僅回報不處理）

`/partner/*`（總覽／推廣連結／佣金明細／申請提款）整組是**UI 原型**：佣金、餘額、提款紀錄、銀行帳戶皆為寫死的假資料（`EARNINGS`／`BALANCE`／`HISTORY` 常數，含 2024 年份、假訂單編號、假銀行資訊），沒有登入驗證、沒有接任何後端。已確認：
- `robots.ts` 已將 `/partner/` 排除於索引外（不會被搜尋引擎收錄）
- 全站無任何導覽／頁面連結指向 `/partner/*`（僅可直接輸入網址進入）

風險偏低（未曝光、無真實金額異動），但若之後要正式推出「合作夥伴推廣計畫」，這整組頁面需要重新串接真實資料與登入閘，屬於獨立功能開發範疇，非本次前台收口步驟該做的事，故僅記錄不動工。
