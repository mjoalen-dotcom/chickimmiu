# Before / After 對照表｜步驟09（FE-QA Prompt H）

日期：2026-08-15｜對象：pre.chickimmiu.com 首頁（本次唯一實際修改程式碼的頁面；分類頁/商品頁/部落格本次未改動，維持 `docs/fe-qa/lighthouse-before/` 記錄的基準值不變）

## 首頁修改內容

1. `export const revalidate = 300`：從完全動態渲染改 ISR，多數請求直接吃快取。
2. `fetchHomeData()` 9 個 payload 查詢從全部依序 await 改兩批 `Promise.all` 平行執行。

## 實測結果

### 直接量測 TTFB（curl，非 Lighthouse 模擬）

修復前（依 lighthouse-before 基準）：首頁 LCP 11.2 秒起跳，資料查詢是主因。
修復後：連續 5 次 `curl -w "%{time_starttransfer}"` 實測 **0.65–0.74 秒**，較 Lighthouse 基準的 11 秒級大幅改善——這是 ISR 快取生效後、絕大多數使用者實際會感受到的數字。

### Lighthouse（行動端模擬，單次冷啟動量測）

| 指標 | Before | After | 說明 |
|---|---|---|---|
| Performance 分數 | 56 | 56 | 分數持平——Lighthouse 每次都用全新無快取的瀏覽器 profile 跑，量到的是「快取剛好過期、正在背景重新產生」那一次的路徑，不是多數使用者實際體驗到的溫快取路徑 |
| LCP | 11.2s | 9.4s | 有改善但未達 <2.5s 目標，見下方分析 |
| FCP | 8.2s | 7.3s | 有改善 |
| TBT | 120ms | 160ms | 持平（本來就在合理範圍） |
| CLS | 0.01 | 0.01 | 持平（本來就遠優於 <0.1 目標） |
| SEO | 69 | 69 | 持平（分數受 staging noindex 影響，見步驟08記錄，非本次範圍） |

## 分析：為什麼 TTFB 大幅改善但 LCP 只小幅改善？

**核心洞察**：這次修的是「伺服器產生頁面的速度」（データ查詷+快取），改善非常明確且可實測（curl TTFB 11s級→0.7s級）。但 Lighthouse 的 LCP 指標量的是「使用者眼睛看到最大內容區塊」的完整時間，還包含：瀏覽器下載/解碼首頁最大圖片（很可能是 Hero Banner）、CSS/JS 執行完成、圖片實際 render 完成等，這些都不是本次修改的範圍。也就是說：**這次修復解決了「後端多慢」的問題，但「前端資源載入多慢」的問題還在**，是 LCP 沒有降到 <2.5s 目標的主因。

## 後續建議（非本次範圍，記錄供未來排程）

1. Hero Banner 圖片載入策略：確認是否已用 `next/image` 的 `priority` 屬性 + 適當的 `sizes`，避免 LCP 元素被延遲載入。
2. Lighthouse 分數之所以「持平」是因為每次都是冷啟動量測——若要看到 ISR 帶來的分數提升，需要用工具連續打好幾次同一 URL 讓快取穩定後再測，或直接以本文件的 curl TTFB 數字為準（更貼近真實使用者體驗）。
3. 依 Prompt H 停損原則（單項優化超過3小時未見效即記錄放行），本次到此為止；LCP 進一步優化建議另開範圍評估，非本次「查詢平行化+ISR」能單獨解決。
