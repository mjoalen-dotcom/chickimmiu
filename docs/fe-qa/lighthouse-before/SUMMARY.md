# Lighthouse Before 基準｜步驟08（FE-QA Prompt G Phase 0）

日期：2026-08-15｜對象：pre.chickimmiu.com（部署前，即本次步驟08 Phase 1 修復生效前的狀態）｜行動端模擬，simulate throttling

| 頁型 | Performance | SEO | Best Practices | Accessibility | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|
| 首頁 `/` | 56 | 69 | 92 | 91 | 11.2s | 0.01 | 120ms |
| 分類頁 `/category/formal-dresses` | 55 | **54** | 92 | 90 | 18.6s | 0.01 | 190ms |
| 商品頁 `/products/beck-pleated-cropped-pants-black` | 57 | 69 | 92 | 89 | 8.6s | 0.01 | 130ms |
| 部落格 `/blog/confidence-is-the-silhouette` | 55 | 69 | 92 | 94 | 9.8s | 0.01 | 160ms |

完整報告見同目錄 `{home,category,product,blog}.report.{json,html}`。

## 觀察

1. **Performance 全數在 55-57**，遠低於工單目標 ≥90，主要拖累是 **LCP 全部超過 8 秒**（分類頁甚至 18.6 秒），是步驟09（前台效能）要處理的主戰場。CLS/TBT 本身數值尚可（CLS 0.01 遠優於 <0.1 目標；TBT 120-190ms 尚可）。
2. **分類頁 SEO 分數明顯偏低（54 vs 其他頁 69）**——這份基準是在本次 Phase 1 修復「部署前」擷取，分數低的主因正是本次要修的兩個 bug（title 双重品牌後綴、meta description 全空，Lighthouse SEO 稽核會扣分）。**這是 Phase 1 修復的直接驗證依據**：部署後應可看到分類頁 SEO 分數明顯回升，屆時可另抓一次驗證但不算在本次「before」基準內。
3. **SEO 分數全數 <90**（含首頁 69）：staging 站因步驟07剛加上的 `noindex` header/meta，Lighthouse 的「頁面可被索引」稽核項會判定失敗並扣分——**這是刻意的、預期內的**，staging 不該被索引，等正式切換 www 時這個 noindex 會移除，屆時 SEO 分數會自然回升，不代表現在需要修。
4. 本次僅建立基準（Phase 0），**未執行任何效能優化**（ISR、script 載入策略等留給步驟09 Prompt H）。
