# PIPELINE-STATE.md｜切換管線狀態機（唯一真相源）

> /next 每次執行後更新本檔並 commit。狀態：⚪未開始 🔵進行中 ✅完成 🔴失敗 ⏸暫停 ⏳等待外部
> 最後更新：2026-08-15｜目前步驟：02｜停滯天數：0

| # | 步驟 | 依據 | 閘型 | 機器驗證項 | 狀態 | 完成日 | 產出 |
|---|---|---|---|---|---|---|---|
| 00 | 管線初始化（工作單入版控、CLAUDE.md、本檔） | AUTOPILOT §7 | 手動一次 | git log 含 init commit | ✅ | 2026-08-15 | commit 93616be |
| 01 | Phase S：cost 欄位權限修補＋部署 | ADMIN-UI Prompt S | AUTO | `curl -s ".../api/products?limit=1" \| grep -c '"cost"'` = 0 | ✅ | 2026-08-15 | hetzner/main commit 9156ab4（deployed to pre） |
| 02 | 全站審計（read-only） | ADMIN-UI Prompt A | AUTO | AUDIT-20260814.md 與 API-STRUCTURE.md 產出；⚠️旗標（users共用／admin未轉向）寫入回報 | ⚪ | | |
| 03 | 後台結構層（分組／欄位／中文化／tabs） | Prompt B | AUTO | 側邊欄分組≤6 截圖；products tabs 生效 | ⚪ | | |
| 04 | 營運 Dashboard | Prompt C | AUTO | 4 指標卡渲染截圖 | ⚪ | | |
| 05 | Branding＋i18n | Prompt D | INPUT（logo SVG＋色票 hex；預設＝文字 logo、不動色系） | favicon ≠ payload 預設 | ⚪ | | |
| 06 | 角色權限 admin／operator | Prompt E | AUTO | 權限矩陣入 ADMIN-STRUCTURE.md；帳號清單回報 | ⚪ | | |
| 07 | Staging 防護（noindex header） | Prompt F | AUTO | 首頁 header 含 X-Robots-Tag: noindex | ⚪ | | |
| 08 | 前台基準＋SEO 修復 | FE-QA Prompt G | AUTO | 分類 description 覆蓋 100%；title 双後綴消失；lighthouse-before/ 存在 | ⚪ | | |
| 09 | 前台效能（ISR／script） | Prompt H | AUTO | before/after 對照表；首頁 TTFB 與商品頁差距 <1.5× | ⚪ | | |
| 10 | 前台收口（/diag /games、404） | Prompt I | AUTO | /diag 與 /games 回 404 或需權限 | ⚪ | | |
| 11 | BP-002 合併檢查點 | 外包 | ⏳WAIT | pre 上購物車＋OAuth 全流程通過 | ⚪ | | |
| 12 | PG 盤點 | DB-PG Prompt P1 | AUTO（RAM 餘裕<800MB → 升級 CPX32 呈報 INPUT） | PG-PHASE0-AUDIT.md 產出 | ⚪ | | |
| 13 | PG 建置＋搬移演練 | Prompt P2 | AUTO | 演練環境全表 count 對帳通過＋20 筆深度 diff 無差異 | ⚪ | | |
| 14 | PG 切換（pre） | Prompt P3 前半 | AUTO（切換前強制最終備份） | 回歸清單逐項✅；正式環境 count 對帳通過 | ⚪ | | |
| 15 | PG 運維化（備份／還原／回滾演練） | Prompt P3 後半 | AUTO | 還原演練紀錄＋回滾演練紀錄＋runbook 定稿 | ⚪ | | |
| 16 | 顧客認證（customers 分離＋JWT） | APP-API Prompt Q1 | AUTO（若需既有顧客資料遷移 → 方案呈報 INPUT） | 測試綠；隔離滲透 3 項全 403 | ⚪ | | |
| 17 | v1 業務端點 | Prompt Q2 | AUTO | 全端點測試綠；/v1/products 單筆 <2KB | ⚪ | | |
| 18 | 加固＋API 文件 | Prompt Q3 | AUTO | rate limit 實測；openapi-v1.yaml＋Postman 產出 | ⚪ | | |
| 19 | 契約凍結 | APP-API §5–6 | INPUT（預設：D1 webview／D2 RN+Expo／D3 登入車／D4 無推播；「下一步」＝接受全案並簽核） | §6 凍結表填入日期 | ⚪ | | |
| 20 | 全站回歸（技術閘門 1–6） | CUTOVER-000 §4 | AUTO | 六項逐項✅表 | ⚪ | | |
| 21 | 切換包準備（301 對照＋noindex 解除腳本） | CUTOVER-000 §4 第7–8 | AUTO | 301 對照表產出；解除腳本備妥（只準備不執行） | ⚪ | | |
| 22 | 🔒 正式金流實付＋退款測試 | 閘門 4 | IRON | 1 筆實付與退款憑證存檔 | ⚪ | | |
| 23 | 🔒 營運試跑（operator 帳號＋訂單週期） | 閘門 9–10 | IRON | 營運同仁完成 1 個完整訂單週期紀錄 | ⚪ | | |
| 24 | 🔒 DNS 切換 www＋noindex 解除 | 閘門 11 | IRON（指令「確認切換www」＋GoDaddy 手動） | www 解析至新站；正式域**無** noindex；Shopline 保留回切 ≥14 天 | ⚪ | | |

## 決策紀錄區（/next 自動追記）

| 日期 | 步驟 | 決策/事件 | 拍板 |
|---|---|---|---|
| 2026-08-14 | — | PG 遷移排於 www 切換前；管線採 AUTOPILOT-001 全自動模式 | Alan |
| 2026-08-15 | 01 | 部署基準修正：本地 `line-bc-migration` 已領先 `hetzner/main` 33 個未推送 commit（App API v1／Google-Apple 原生登入／部落格 AI 工作室等），若整支部署會遠超 Phase S 範圍。改為從 `hetzner/main`（實際部署基準）另開 branch 只帶入本次 2 檔修補，部署後 fast-forward `hetzner/main` 到該 commit（`9156ab4`）。`line-bc-migration` 33 個未推送 commit 本次未動，維持原樣待後續處理。 | Claude（AUTO 執行內） |
| 2026-08-15 | — | 系統性稽核發現：CRMSettings／InvoiceSettings／MarketingAutomationSettings／AdsCatalogSettings 4 個 globals 的 access.read=()=>true 對內部憑證欄位（LINE token/secret、ECPay HashKey/HashIV、行銷管道 API Key）無 field-level 保護，與本次修補的 Products.cost 同類。已查證 DB 現況全數未填值（無即時外洩），但屬同類結構性缺口。GlobalSettings 的 OAuth 憑證已有 isAdminFieldLevel 保護，無需動。待 Alan 確認是否併入本次 hotfix 一併修補。 | 待 Alan 確認 |

## 停滯與異常（站會讀取區）

- 目前紅燈：無
- 等待 Alan 事項：是否授權追加修補 4 個 globals 的憑證欄位權限（見上方決策紀錄，非本次步驟 01 授權範圍，暫緩）
