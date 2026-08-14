# DB-PG-001｜SQLite → PostgreSQL 16 遷移工作單

版本 v1.0｜2026-08-14｜時間盒 2–3 天｜branch `db-pg/001`｜前置：BP-002 修復已合併

## 0. 決策紀錄

2026-08-14 Alan 拍板：**PG 遷移排在 www 切換之前**。理由：(1) www 仍在 Shopline，pre 是唯一受影響環境——現在遷移零生產風險，切換後再遷 = 停機＋訂單風險＋成本翻倍；(2) ERP 已定案 PostgreSQL 16（CKMU-ERP-ARCH-002），商城同引擎 = 一套備份／監控／運維，未來 ERP↔商城打通免跨引擎；(3) SQLite 單寫者鎖在團購瞬時下單＋APP 併發下是實際瓶頸。

## 1. 範圍

- 遷移對象：Payload 全部 collections 資料（products 1,395／media 21,962／categories 135／orders／users／pages 等，以 Prompt A 審計清單為準）
- **不動**：R2 上的實體媒體檔（僅 DB 列移轉）[推斷，Phase 0 確認 media 儲存策略]、前端程式、nginx
- 目標環境：同機 Hetzner CPX22（Ubuntu），PG 16 via apt，本機 socket 連線

## 2. 驗收標準（DoD）

1. 全表 count 對帳：SQLite vs PG 每張表筆數一致，輸出對帳表
2. ID 保留：既有數字 ID 原樣遷移，全部 sequence `setval` 至 max(id)+1
3. 關聯抽查：隨機 20 筆 products 的 category／variants／images 關聯與遷移前一致
4. 功能回歸：前台四頁型渲染 ✅、後台 CRUD ✅、購物車＋ECPay sandbox 結帳全流程 ✅
5. 備份上線：每夜 `pg_dump | gzip` → rclone 至 R2，保留 14 天，**完成 1 次還原演練**
6. 回滾可用：SQLite 檔冷凍封存，`DATABASE_URI` 一鍵切回，實測回滾 1 次
7. 產出 `docs/db/PG-MIGRATION-RUNBOOK.md`（含還原 SOP、連線資訊位置、調參紀錄）

## 3. 工作分解

- **Phase 0（0.5d）盤點**：adapter 版本、SQLite 檔大小、全表清單與筆數、JSON／enum／richtext 欄位型別盤點、媒體儲存策略確認、CPX22 記憶體現況
- **Phase 1（1d）建置＋搬資料**：裝 PG16 → 換 `@payloadcms/db-postgres` → Payload migration 建 schema → 資料搬移腳本 → 對帳
- **Phase 2（0.5d）切換驗證**：pre 切 PG、PM2 重啟、全功能回歸、效能快照 before/after
- **Phase 3（0.5d）運維化**：備份 cron＋還原演練、PG 調參、回滾演練、runbook 定稿

## 4. Claude Code 提示詞

### Prompt P1｜Phase 0：盤點（read-only）

```
角色：資料庫遷移工程師。只讀盤點，不修改。先讀 AI-INBOX.md / AI-CONTEXT.md。
1. 確認 @payloadcms/db-sqlite 與 payload 版本、drizzle 版本、SQLite 檔路徑與大小。
2. 列全表：表名｜筆數｜含 JSON/enum/richtext/array 欄位者標記（這些是
   SQLite(text) → PG(jsonb/enum) 的型別轉換風險點）。
3. 確認 media 實體檔位置（R2 adapter？本機 uploads？）——決定媒體是否只搬 DB 列。
4. free -h 與現有服務記憶體佔用，評估 PG16 進駐後餘裕；若 < 800MB 餘裕，
   在報告置頂建議升級 CPX32。
5. 輸出 docs/db/PG-PHASE0-AUDIT.md，停下等我確認。
```

### Prompt P2｜Phase 1：建置與資料搬移

```
branch db-pg/001。依 PG-PHASE0-AUDIT.md 執行：
1. apt 安裝 PostgreSQL 16，建 db `ckmu` 與專用帳號，僅 local socket，
   pg_hba 禁遠端。密碼放 .env，同步更新 .env.example（佔位符）。
2. 套件換 @payloadcms/db-postgres，DATABASE_URI 走環境變數雙軌
   （sqlite 舊值保留註解，可一鍵切回）。
3. 以 Payload migration 在 PG 建全新 schema（不用 pgloader 硬轉 schema，
   確保與 drizzle 定義完全一致）。
4. 寫資料搬移腳本 scripts/migrate-sqlite-to-pg.ts：
   - 依 FK 依賴排序搬表（或 session_replication_role=replica 暫停約束）
   - 保留原 ID；JSON/richtext 欄位正確 parse 後入 jsonb；boolean 0/1 → true/false
   - 每表結束立即 count 對帳，不一致即中止並報表名
   - 全部完成後：每個 serial sequence setval 至 max(id)+1
   - 隨機 20 筆 products 深度比對（含 relations）輸出 diff 報告
5. 腳本先在本機／副本演練一次成功後，才給我 pre 執行指令，我執行。
禁止：動 R2 檔案、動前端程式、動 nginx。
```

### Prompt P3｜Phase 2＋3：切換、運維、回滾

```
branch db-pg/001。
1. 停 PM2 → 最後一次增量搬移（停機窗口內新增資料）→ 切 DATABASE_URI → 起 PM2。
   預估停機分鐘數先報給我，選離峰執行。
2. 回歸清單逐項執行：四頁型渲染／後台登入與 products CRUD／購物車／
   ECPay sandbox 下單完整流程，逐項截圖或紀錄。
3. 效能快照：首頁與分類頁 TTFB、/api/products?limit=12 響應時間，
   與 SQLite 期對照。
4. PG 調參（4GB 機）：shared_buffers=512MB、work_mem=16MB、
   max_connections=40，記錄於 runbook。
5. 備份：每夜 03:30 pg_dump | gzip → rclone 至 R2 bucket，保留 14 天；
   立即執行 1 次「dump → 還原到臨時 db → 抽查」演練並記錄。
6. 回滾演練 1 次：切回 SQLite 確認可起，再切回 PG。SQLite 檔改名
   .frozen-YYYYMMDD 唯讀封存。
7. 定稿 docs/db/PG-MIGRATION-RUNBOOK.md，交接標準：沒參與過的工程師
   照文件能獨立完成還原。
```

## 5. 風險

| 風險 | 對策 |
|---|---|
| 4GB RAM 三服務同機（PG＋Next＋PM2） | Phase 0 先量測；調參保守；監控一週，吃緊即升 CPX32（月費小錢，不提前優化） |
| JSON／enum 型別轉換錯漏 | Phase 1 腳本逐表對帳＋20 筆深度 diff；發現不一致即中止 |
| 停機窗口出現新訂單 | 停機前最後增量搬移；離峰執行；窗口目標 < 15 分鐘 |
| 與 BP-002 衝突 | 前置條件：BP-002 已合併才開工（本工作單依賴鏈已鎖定） |
| 遷移後隱性 bug 晚爆 | SQLite 冷凍檔保留 30 天；備份還原演練確保雙保險 |

*v1.0 完*
