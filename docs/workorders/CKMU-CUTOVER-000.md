# CKMU-CUTOVER-000｜www 切換總體計畫（主控文件）

版本 v1.0｜2026-08-14｜發起 Alan Miaou｜本文件為唯一進度真相源，每日站會對照更新

## 1. 目標

pre.chickimmiu.com 完成「後台專業化＋前台打磨＋PostgreSQL 遷移＋APP API v1」四項工程並通過切換閘門後，www 由 Shopline 切換至新站。**PG 遷移必須在切換前完成**（2026-08-14 Alan 拍板，理由：切換前 = 零生產風險窗口；ERP 已定案 PG16 同引擎）。

## 2. 依賴圖與執行順序

```
Phase S (hotfix/api-field-access)  ← 今日，獨立最優先
        │
ADMIN-UI-001 (3d) ──┐
FE-QA-001    (2d) ──┤  ← 兩者可並行（不同檔案域）
        │           │
        └─────┬─────┘
        DB-PG-001 (2–3d)   ← 需 BP-002 修復已合併
              │
        APP-API-001 (4–5d) ← API 契約凍結 → APP 開發並行啟動
              │
        全站回歸 → 切換閘門 → www DNS 切換
```

## 3. 進度追蹤表（站會逐日更新）

| 工作單 | 內容 | 時間盒 | 前置 | 狀態 |
|---|---|---|---|---|
| Phase S | API 欄位權限修補（cost 外洩） | 0.5h | 無 | 🔴 待執行（今日） |
| BP-002 | cart/OAuth P0（外包） | 3–7d | 無 | 🟡 進行中（外部） |
| ADMIN-UI-001 | 後台專業化 | 3d | Phase S | ⚪ 待啟動 |
| FE-QA-001 | 前台品質修復 | 2d | 無 | ⚪ 待啟動 |
| DB-PG-001 | SQLite → PG16 | 2–3d | BP-002 合併 | ⚪ 待啟動 |
| APP-API-001 | API v1 契約層 | 4–5d | DB-PG-001 | ⚪ 待啟動 |
| CUTOVER | 回歸 + DNS 切換 | 1d | 全部 | ⚪ 未排程 |

樂觀路徑合計 **12–15 個工作天**（含並行）。

## 4. www 切換閘門（Definition of Cutover-Ready）

技術閘門：
1. `/api/products` 公開回應無 cost/sourcing/totalSold（Phase S 驗證通過）
2. BP-002：購物車 + OAuth 登入在 pre 全流程通過
3. DB 已為 PG16，全表 count 對帳通過，備份 cron 運轉 ≥3 日
4. ECPay／LINE Pay 正式金流在 pre 完成至少 1 筆實付＋退款測試
5. Lighthouse（行動端）：LCP < 2.5s、CLS < 0.1、SEO ≥ 90
6. /diag、/games 已移除或加權限
7. 301 對照表：Shopline 舊 URL → 新站 URL（含商品、分類、部落格）備妥
8. staging 防護（noindex）於切換時**反向解除**——正式域必須可收錄，勿把 noindex 帶上正式站 ⚠️

營運閘門：
9. 後台 operator 帳號建立，營運同仁完成試操作
10. 訂單／出貨 SOP 在新後台跑通 1 個完整週期
11. 回滾方案：DNS TTL 降至 300s，Shopline 保留可回切 ≥14 天

## 5. 自動化站會（每日）

排程代理每個工作日 09:00 執行：
1. **健康檢查**：pre 首頁 HTTP 狀態與 TTFB；`/api/products?limit=1` 是否含 `cost`（P0-SEC 迴歸驗證）；`X-Robots-Tag` 是否存在
2. **進度對照**：依本文件 §3 表格輸出紅黃綠燈
3. **今日單一最高槓桿行動**建議
4. 異常（站掛、cost 重現、閘門項退步）→ 紅燈置頂

## 6. 文件索引

| 文件 | 用途 |
|---|---|
| CKMU-CUTOVER-000.md | 本文件（主控） |
| CKMU-ADMIN-UI-001.md | 後台專業化（已交付 2026-08-14） |
| FE-QA-001.md | 前台品質（含實測基準） |
| DB-PG-001.md | PG 遷移 runbook 工作單 |
| APP-API-001.md | API v1 契約工作單 |
| docs/api/API-STRUCTURE.md | Prompt A 產出（供 INFACE 與 APP 團隊） |

*所有工作單完工 → DECISION-LOG.md 記錄 + ai-report 回報，交接零考古。*
