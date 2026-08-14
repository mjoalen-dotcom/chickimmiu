# FE-QA-001｜前台網頁品質工作單

版本 v1.0｜2026-08-14｜時間盒 2 天｜branch `fe-qa/001`｜可與 ADMIN-UI-001 並行

## 1. 實測結果（2026-08-14 外部掃描：首頁／商品頁／分類頁）

### 判定：**B+ 水準，屬打磨收尾，非重建。** 基本盤超出一般自建電商。

**強項（保持，勿動）：**

| 項目 | 實測 |
|---|---|
| 結構化資料 | 商品頁含 **Product + Offer + Brand + BreadcrumbList** JSON-LD；首頁 Organization/WebSite/SearchAction——多數正式電商都沒做到 |
| 圖片 | alt 覆蓋 **100%**（三頁 0 缺漏）、next/image + lazy loading 廣泛使用、webp 格式、hero 61KB 合理 |
| SEO 基礎 | canonical ✅、og:image ✅、h1 唯一 ✅、lang=zh-Hant-TW ✅、sitemap.xml 存在（241KB） |
| 商品頁 title | 「Beck 寬腰帶百褶九分褲（黑）｜CHIC KIM & MIU」格式專業 |

**問題（依優先序）：**

| # | 級別 | 問題 | 實測證據 |
|---|---|---|---|
| F1 | P1 | **分類頁 meta description 全空** | formal-dresses 頁 desc = 0 字；135 個分類頁 [推斷全部，需驗證] |
| F2 | P1 | **分類頁 title 双重品牌後綴 bug** | 「婚禮/正式場合洋裝系列 \| CHIC KIM & MIU｜CHIC KIM & MIU」 |
| F3 | P1 | **首頁 TTFB 過慢**：1.91s，是商品頁（0.78s）2.4 倍 → 首頁 SSR 查詢重、無快取 [推斷] | 同一測點對照 |
| F4 | P1 | **/diag 與 /games 公開連結於首頁** | /diag 回 200（84KB）；上線前必須移除或加權限 |
| F5 | P2 | 外部 script 19–22 支／頁，行動端 TBT 風險 | 需 Lighthouse 定量 |
| F6 | P2 | staging robots meta 為 index,follow | 已列 ADMIN-UI-001 Prompt F，此處不重工 |
| F7 | P3 | 行動端實機體驗、404／error 頁、載入態 | 外部無法驗證 [未經驗證]，Phase 3 補 |

## 2. 驗收標準（DoD）

1. Lighthouse 行動端（本機 CI）：**LCP < 2.5s、CLS < 0.1、SEO ≥ 90、Best Practices ≥ 90**，四頁型各留存報告（首頁／分類／商品／部落格）
2. 135 個分類頁 description 覆蓋 100%，title 双後綴修復
3. 首頁 TTFB（伺服器端渲染時間）降至與商品頁同級（差距 < 1.5 倍）
4. /diag、/games 自正式 build 移除或加權限閘
5. before/after Lighthouse 分數對照表存 `docs/fe-qa/`

## 3. 工作分解

- **Phase 0（0.5d）**：本機 Lighthouse CI 基準——四頁型跑分留存，確立 F5 是否成立
- **Phase 1（0.5d）**：SEO 修復——F1 批量生成分類 description、F2 title bug、sitemap 抽驗
- **Phase 2（0.5d）**：效能——首頁 ISR／快取、script 審查
- **Phase 3（0.5d）**：收口——F4 移除、404／error 頁、行動端人工巡檢（可安排 Chrome 巡站協作）

## 4. Claude Code 提示詞

### Prompt G｜Phase 0＋1：基準與 SEO 修復

```
branch fe-qa/001。先讀 AI-INBOX.md / AI-CONTEXT.md。
Phase 0：
1. 本機以 production build 跑 Lighthouse（行動端模擬）：/ 、/category/formal-dresses、
   /products/beck-pleated-cropped-pants-black、/blog 任一篇。
   分數與 LCP/CLS/TBT 存 docs/fe-qa/lighthouse-before/。
Phase 1：
2. 修分類頁 title 双後綴 bug：generateMetadata 內品牌後綴重複拼接，
   目標格式「{分類名}｜CHIC KIM & MIU」。
3. 分類 description 覆蓋：優先讀 CMS categories.description 欄位；空值時
   fallback 模板「精選{分類名}，CHIC KIM & MIU 韓系質感女裝，{商品數} 款
   嚴選單品」。同時輸出 135 個分類的現況清單（有值／空值）給我，
   空值者我後續在後台補人工文案，模板先頂上。
4. 抽驗 sitemap.xml：URL 數、是否含已下架商品、lastmod 是否真實。
禁改：付款、購物車、auth 相關檔案（BP-002 領域）。
```

### Prompt H｜Phase 2：效能

```
branch fe-qa/001。依 lighthouse-before 數據執行：
1. 首頁 TTFB 診斷：列出首頁 server component 的全部資料查詢與耗時，
   對重查詢加 ISR（revalidate 300–600s）或 unstable_cache；
   首頁屬行銷內容，不需即時。
2. 分類頁／商品頁評估 ISR 適用性（庫存顯示需較新，revalidate 60s 或
   保持動態，給我 trade-off 建議）。
3. Script 審查：列出全部第三方 script（GA/GTM/FB pixel 等）載入策略，
   改 next/script strategy=afterInteractive 或 lazyOnload。
4. 完成後重跑 Lighthouse 存 lighthouse-after/，輸出 before/after 對照表。
停損：單項優化超過 3 小時未見效即記錄放行，不鑽牛角尖。
```

### Prompt I｜Phase 3：收口

```
branch fe-qa/001。
1. /diag 與 /games：確認用途後，自 production build 移除路由，或加
   環境變數閘（NEXT_PUBLIC_ENV !== 'production' 才註冊）。首頁移除其連結。
2. 檢查 404 頁與 error.tsx：品牌化、含返回首頁與熱門分類連結。
3. 全站 grep console.log / debugger / TODO 註解，清理後列表回報。
4. 輸出行動端人工巡檢清單（10 項內：導覽、篩選、加購、結帳入口、
   圖片輪播），供 Alan 或 Chrome 協作巡檢。
```

## 5. 風險

| 風險 | 對策 |
|---|---|
| ISR 導致庫存／價格顯示過期 | 分類商品卡 revalidate ≤60s；商品頁庫存改 client fetch 或短 revalidate；Prompt H 要求先給 trade-off |
| 與 ADMIN-UI-001 同倉並行衝突 | 檔案域不重疊（前台 app routes vs admin config）；仍分 branch，各自 PR |
| Lighthouse 本機分數與真實裝置落差 | 以相對改善為準；切換後以 Search Console 核實 |
| /diag /games 為團隊在用工具 | 移除前先確認用途，改權限閘而非刪除 |

*v1.0 完*
