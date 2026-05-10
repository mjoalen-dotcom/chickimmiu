# 2026-05-08 Product Admin Overhaul QA

## 環境
- Repo: `chickimmiu`
- Branch: `feat/product-admin-overhaul`
- Node: `v24.15.0`（專案 engines 要求 `20.x`，僅作本地驗證）

## 驗證結果總覽
| 項目 | 結果 | 備註 | 截圖/證據 |
|---|---|---|---|
| V1 `pnpm tsc --noEmit` | PASS | 型別檢查 0 error | `screenshots/2026-05-08/V1-tsc-pass.png` |
| V2 `NODE_OPTIONS=--max-old-space-size=2048 pnpm build` | PASS | Next build 完成，Route manifest 正常輸出 | `screenshots/2026-05-08/V2-build-pass.png` |
| V3 `pnpm payload migrate` + SQLite 驗欄位 | FAIL（受既有 migration 鏈阻擋） | 在 `20260415_112142_add_size_charts` 即失敗：`products_images` table 不存在，尚未進到本次 `20260508_160000...` migration；另做補充 SQL 驗證，6 欄位與 FK 可建立 | `screenshots/2026-05-08/V3-migrate-fail-baseline.png`、`screenshots/2026-05-08/V3-column-check-pass.png` |
| V4-a `/admin/collections/products` 列表工具列/按鈕 | FAIL（需可用 admin runtime） | 本地 `pnpm dev` 可開 `/products`，但 admin route 在目前 runtime 無法穩定回應（需補齊可用 admin 啟動條件與資料） | `screenshots/2026-05-08/V4a-admin-route-fail.png` |
| V4-b 商品編輯頁 4 tab + 毛利 + tab badge + save toast | FAIL（未能完成手動） | 受 V4-a 阻擋，無法進入編輯頁逐項點測 | `screenshots/2026-05-08/V4b-manual-blocked.png` |
| V4-c 變體 inline table 拖曳/批次填入/縮圖 | FAIL（未能完成手動） | 受 V4-a 阻擋 | `screenshots/2026-05-08/V4c-manual-blocked.png` |
| V4-d 列表批次改分類/改價/加標籤 | FAIL（未能完成手動） | 受 V4-a 阻擋 | `screenshots/2026-05-08/V4d-manual-blocked.png` |
| V4-e 一鍵複製商品後綴與 draft 重置 | FAIL（未能完成手動） | 受 V4-a 阻擋 | `screenshots/2026-05-08/V4e-manual-blocked.png` |
| V4-f 建立頁 wizard 3 步與上架按鈕 | FAIL（未能完成手動） | 受 V4-a 阻擋 | `screenshots/2026-05-08/V4f-manual-blocked.png` |
| V4-g 前台新商品影片 + 限購提示 | FAIL（未能完成手動） | `/products` 路由可達，但未完成含測試資料的端到端驗證 | `screenshots/2026-05-08/V4g-partial.png` |

## V3 補充證據（程式層）
- 針對臨時 SQLite 檔做 SQL 可行性驗證：
  - `purchase_limit`
  - `dimensions_length`
  - `dimensions_width`
  - `dimensions_height`
  - `hs_code`
  - `intro_video_id`（FK -> `media.id`, `ON DELETE SET NULL`）
- 檢查輸出：
  - `COLUMNS=id,purchase_limit,dimensions_length,dimensions_width,dimensions_height,hs_code,intro_video_id`
  - `FKS=[{"table":"media","from":"intro_video_id","to":"id","on_delete":"SET NULL"...}]`

## 備註
- 本次 PR 程式改動已依 6 個 logical commit 完成。
- 若要讓 V3/V4 全 PASS，需先修復既有 migration 基線（`20260415_112142_add_size_charts` 依賴不存在的 `products_images`）。
