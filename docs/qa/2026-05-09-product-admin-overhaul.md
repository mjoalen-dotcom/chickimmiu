# 2026-05-09 Product Admin Overhaul QA

## 環境
- Repo: `chickimmiu`
- Branch: `feat/product-admin-overhaul`
- Node: `v24.15.0`（專案 engines 要求 `20.x`，本次僅做本地驗證）

## 驗證結果總覽
| 項目 | 結果 | 備註 | 截圖/證據 |
|---|---|---|---|
| V1 `pnpm tsc --noEmit` | PASS | 型別檢查 0 error | `screenshots/2026-05-09/V1-tsc-pass.png` |
| V2 `NODE_OPTIONS=--max-old-space-size=2048 pnpm build` | PASS | Next build 完成，route manifest 正常輸出 | `screenshots/2026-05-09/V2-build-pass.png` |
| V3 `pnpm payload migrate` + SQLite 驗欄位 | FAIL（受既有 migration 鏈阻擋） | 缺 `PAYLOAD_SECRET` 補齊後，仍在 `20260415_112142_add_size_charts` 失敗：既有 DB 報 `size_charts_measurements already exists`；fresh DB 報 `no such table: products_images`，因此無法進到本次 `20260508_160000...` migration | `screenshots/2026-05-09/V3-migrate-fail-existing-table.png`、`screenshots/2026-05-09/V3-migrate-fail-missing-products_images.png` |
| V4-a `/admin/collections/products` 工具列/批次按鈕 | PARTIAL | `pnpm dev` 下路由回應 `200`，但後續 `/api/products?limit=1` 觸發 `no such table: products`（DB 未完成 migration），無法完成有效資料列表 smoke | `screenshots/2026-05-09/V4a-admin-route-200-but-db-error.png` |
| V4-b 商品編輯頁 4 tab + 毛利 + tab badge + save toast | FAIL（未能完成手動） | 受 V3 / DB 基線阻擋，無法完成帶資料的編輯流程驗證 | `screenshots/2026-05-09/V4b-manual-blocked.png` |
| V4-c 變體 inline table 拖曳/批次填入/縮圖 | FAIL（未能完成手動） | 受 V3 / DB 基線阻擋 | `screenshots/2026-05-09/V4c-manual-blocked.png` |
| V4-d 列表批次改分類/改價/加標籤 | FAIL（未能完成手動） | 受 V3 / DB 基線阻擋 | `screenshots/2026-05-09/V4d-manual-blocked.png` |
| V4-e 一鍵複製商品後綴與 draft 重置 | FAIL（未能完成手動） | 受 V3 / DB 基線阻擋 | `screenshots/2026-05-09/V4e-manual-blocked.png` |
| V4-f 建立頁 wizard 3 步與上架按鈕 | FAIL（未能完成手動） | 受 V3 / DB 基線阻擋 | `screenshots/2026-05-09/V4f-manual-blocked.png` |
| V4-g 前台新商品影片 + 限購提示 | FAIL（未能完成手動） | `/products` route 可回應 `200`，但未完成含測試資料的端到端流程 | `screenshots/2026-05-09/V4g-partial.png` |

## 本次補充證據（log）
- `tmp/dev-20260509_125520.out.log`
  - `GET /admin/collections/products 200`
  - `GET /products 200`
  - `GET /api/products?limit=1&depth=0 500`
  - `SQLITE_ERROR: no such table: products`
- migration 失敗訊息：
  - 既有 DB：`table size_charts_measurements already exists`
  - fresh DB：`ALTER TABLE products_images ... no such table: products_images`

## 備註
- 6 個主要功能 commit 與 PR #209 內容未變更。
- 本次重跑再次確認：目前主要阻塞是既有 migration 基線問題（`20260415_112142_add_size_charts`），非本次 6 大改造本身型別或 build 問題。
