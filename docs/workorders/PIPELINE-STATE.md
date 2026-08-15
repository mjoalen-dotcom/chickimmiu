# PIPELINE-STATE.md｜切換管線狀態機（唯一真相源）

> /next 每次執行後更新本檔並 commit。狀態：⚪未開始 🔵進行中 ✅完成 🔴失敗 ⏸暫停 ⏳等待外部 🟡部分完成（機器驗證項未100%達標，已部署但需Alan裁示是否算過關）
> 最後更新：2026-08-15｜目前步驟：05（進行中）｜停滯天數：0

| # | 步驟 | 依據 | 閘型 | 機器驗證項 | 狀態 | 完成日 | 產出 |
|---|---|---|---|---|---|---|---|
| 00 | 管線初始化（工作單入版控、CLAUDE.md、本檔） | AUTOPILOT §7 | 手動一次 | git log 含 init commit | ✅ | 2026-08-15 | commit 93616be |
| 01 | Phase S：cost 欄位權限修補＋部署 | ADMIN-UI Prompt S | AUTO | `curl -s ".../api/products?limit=1" \| grep -c '"cost"'` = 0 | ✅ | 2026-08-15 | hetzner/main commit 9156ab4 + 52205f1（deployed to pre） |
| 02 | 全站審計（read-only） | ADMIN-UI Prompt A | AUTO | AUDIT-20260814.md 與 API-STRUCTURE.md 產出；⚠️旗標（users共用／admin未轉向）寫入回報 | ✅ | 2026-08-15 | docs/admin-ui/AUDIT-20260814.md、docs/api/API-STRUCTURE.md |
| 03 | 後台結構層（分組／欄位／中文化／tabs） | Prompt B | AUTO | Alan 已拍板：7組可接受（核心標準＝清楚直覺，非硬性≤6）；部落格群組內部規劃已核實務實合理 | ✅ | 2026-08-15 | hetzner/main commit b739f4b（deployed to pre）；分組8→7＋10個collection欄位補齊＋global-settings 2個漏網憑證欄位修補；products tabs維持既有4-tab（未依規格改6-tab，Alan未要求，留待未來評估） |
| 04 | 營運 Dashboard | Prompt C | AUTO | 4 指標卡渲染截圖 | 🟡 部分完成 | 2026-08-15 | hetzner/main commit 87092ab（deployed to pre）；既有Dashboard已遠超4卡要求(8張KPI卡+3個分析tab)，僅補快速入口「待出貨清單」「媒體庫」2項；**無法截圖**——無admin登入憑證，不代填密碼，改以程式碼審閱+build/deploy成功+API層驗證確認 |
| 05 | Branding＋i18n | Prompt D | INPUT（logo SVG＋色票 hex；預設＝文字 logo、不動色系） | favicon ≠ payload 預設 | 🟡 | | 本機 tsc 通過，待 pre 驗收 |
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
| 2026-08-15 | — | 系統性稽核發現：CRMSettings／InvoiceSettings／MarketingAutomationSettings／AdsCatalogSettings 4 個 globals 的 access.read=()=>true 對內部憑證欄位（LINE token/secret、ECPay HashKey/HashIV、行銷管道 API Key）無 field-level 保護，與本次修補的 Products.cost 同類。已查證 DB 現況全數未填值（無即時外洩），但屬同類結構性缺口。GlobalSettings 的 OAuth 憑證已有 isAdminFieldLevel 保護，無需動。 | Alan：授權修補 |
| 2026-08-15 | — | 上述 4 個 globals 已修補（commit `52205f1`，比照 GlobalSettings 既有 isAdminFieldLevel 模式）並部署 pre，curl 驗證 8 個憑證欄位皆已從公開回應消失、端點仍正常回應非敏感欄位。同時修正先前誤判：line-bc-migration 並非「領先 hetzner/main 33 commit」，而是本地checkout落後 hetzner/main 33 commit（皆為已部署內容）；已用 rebase 同步（不含任何內容變更），管線工作單同步 push 至 hetzner。 | 已完成 |
| 2026-08-15 | 02 | 全站唯讀審計完成（78 collections + 25 globals 逐檔實讀，Workflow 平行11個agent執行）。⚠️旗標回報：(1) `/admin` 200-not-redirect 已實測確認**非資安問題**——Payload 3 在該路由直接 SSR 登入表單（非傳統redirect），未登入無任何後台資料外洩；(2) customers/admin **確認共用** users collection（僅 role 欄位區分），role 欄位寫入已鎖 admin-only 故無立即可利用的提權路徑，架構隔離維持原排程步驟16處理；(3) **新發現**：`global-settings` 內 `tracking.metaCapiToken`、`sinsangMarket.accessToken` 2 欄位與步驟01同類缺口（無field-level保護），DB現況皆空值無即時外洩，**待 Alan 授權是否併入修補**；(4) `products.variants.costOverride` 與頂層cost同類但Prompt S未列入範圍，記錄於API-STRUCTURE.md供APP契約層(步驟16-17)設計DTO時注意；(5) collections分組現況8組，超過DoD「≤6組」目標，待步驟03處理或放寬目標。全程唯讀，未修改任何程式檔案。 | Claude（AUTO 執行內） |
| 2026-08-15 | 03 | 分組整併執行判斷：刪除「⑦系統與安全」（4成員拆散併入既有4組），8→7組。**「Ⓚ兩站部落格」評估後刻意不合併**——KimBlogNavGroup.tsx 的 DOM 注入連結（分類篩選/相簿/AI工具/前台連結）若併入⑥內容與頁面，會被推到合併後大群組最底部，跟部落格文章/分類原生連結視覺斷開，對每天用這些工具的部落格編輯團隊是實質動線劣化，故未達成≤6組的字面DoD。Products.ts 既有4-tab結構（基本與價格/媒體與變體/穿搭與SEO/廣告與進階）未依Prompt B規格重新命名為6-tab+內部資料專屬tab——已解決原始「無tabs無法編輯」的核心問題，重新拆分屬風險較高的深度改動，本次未執行。10個collection補齊useAsTitle/defaultColumns/listSearchableFields缺口。**待Alan裁示**：7組是否可接受、Products tabs是否要照規格重做。 | Claude（AUTO 執行內，需裁示） |
| 2026-08-15 | 03 | 🔴 部署事故（已排除，正式站無感）：`git add src/payload.config.ts`（整檔暫存）誤把本機另一份未提交的 ops-copilot WIP 殘留（OpsActions collection import+註冊、opsCopilot admin view 註冊）一併帶入 commit 372e777，該WIP實際檔案從未commit，導致 prod migrate 直接 `ERR_MODULE_NOT_FOUND` 炸掉（deploy exit 3）。**失敗發生在 migrate 步驟（step 3/7），未到 pm2 restart（step 5/7），正式站全程由前一版本繼續服務，無使用者可見中斷**。已用 `git diff` 逐行核對揪出殘留、新commit `4ce11ab` 移除、重新 build+push+deploy，第二次部署 exit 0 全綠。教訓：往後對「同時被自己改動+被其他未提交WIP改動」的檔案，`git add <file>` 前必須先 `git diff <file>` 核對整份 diff，不能假設「我只改了我想改的部分」。 | Claude（AUTO 執行內，已排除） |
| 2026-08-15 | 03 | Alan 拍板：(A) Ⓚ兩站部落格獨立群組維持不動（已請Claude確認KimBlogNavGroup.tsx內部規劃務實合理——分類篩選連結的site值('store'/'kim')與collection定義一致、defaultColumns已含site欄位供快速辨識，非冗餘設計）；(B) 7組可接受，核心標準是「清楚明確直覺容易使用」不是硬性數字；(C) global-settings 2個漏網憑證欄位（metaCapiToken/sinsangMarket.accessToken）授權修補。步驟03正式轉✅。Products.ts tabs 規格重做未被要求，維持現狀。 | Alan |
| 2026-08-15 | — | global-settings 2個漏網憑證欄位已修補（commit `b739f4b`，比照既有isAdminFieldLevel模式）並部署pre，curl驗證2欄位皆已從公開回應消失、gtmId等非敏感欄位仍正常回應。sinsangMarket.accessToken 原「加密儲存」誤導性描述已一併修正為「僅管理員可見」。 | 已完成 |
| 2026-08-15 | 04 | 現況盤點：`src/components/admin/Dashboard.tsx`（802行）已存在且遠超工單原始「4張KPI卡」假設——現有8張卡（今日營收/訂單/待處理/新會員/客服訊息/退換貨/客單價/低庫存）+ 月度總覽/日曆查詢/業績比較 3個分頁，屬工單寫定後另一session已建置完成，本次只補齊快速操作區缺的「待出貨清單」（`?where[status][equals]=processing`）與「媒體庫」入口。「本週新增會員」（Prompt C字面用詞）判斷已由既有「今日新會員」+「本月新會員 vs 上月」雙粒度比較涵蓋，週粒度非必要新增，未做。**機器驗證項「4指標卡渲染截圖」無法達成**——無admin登入憑證且不代填密碼（同步驟02遇到的限制），改以：程式碼審閱確認card/連結存在、本地build通過、deploy health check通過、public API層驗證(currencies/global-settings等)佐證。 | Claude（AUTO 執行內，截圖項待Alan協助或接受替代驗證） |

## 停滯與異常（站會讀取區）

- 目前紅燈：無
- 等待 Alan 事項：步驟04「截圖」驗證項因無登入憑證無法達成，若要真正的視覺確認需 Alan 自行登入 pre.chickimmiu.com/admin 看一眼（不急，不阻塞下一步）；否則可直接說「下一步」進入步驟05（Branding＋i18n，需提供 logo SVG＋色票 hex，或說「下一步」採用預設＝文字 logo、不動色系）
