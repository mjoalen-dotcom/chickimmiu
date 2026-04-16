# CHIC KIM & MIU — Phase 4 交接文件

> 臨時交接文件，Phase 4 完成後可刪除（或加進 .gitignore）。
> 用途：跨對話傳遞任務脈絡，避免重新解釋。
> **最後更新**: 2026-04-16 — Task 1 + Task 2 已完成並 commit，Task 3 待做（開新對話執行）

## 專案

- 路徑: `C:\Users\mjoal\ally-site\chickimmiu`
- 技術: Payload CMS v3 + Next.js 15.4.11
- Dev server: port 3001（`preview_start` with `chickimmiu-next`）

## 目前進度

- ✅ Stage 1-5 完成
- ✅ Phase 3 Shopline xlsx importer（已 wire 到 `Products.ts`，dry-run 測試 1488 rows → 500 products OK）
- 🚧 **Phase 4** — Task 1 + 2 完成、Task 3 待做

---

## ✅ Task 1 — PDP 前台對齊（DONE）

**檔案**: `src/app/(frontend)/products/[slug]/ProductDetailClient.tsx`

改動摘要：
- 刪除 `fabricInfo` 解構（原本讀 `product.fabricInfo` — 路徑根本是錯的，實際 schema 是 `product.sourcing.fabricInfo`，內部欄位不該露到前台）
- 改解構 Phase 1 公開欄位：`material` / `careInstructions` / `stylingTips` / `modelInfo` / `sizeChart`
- `sizeChart` 用 `typeof === 'object'` 守衛（page.tsx 用 `depth: 2` populate，有可能是 object / id / null）
- **尺寸表動態化**：讀 `sizeChart.measurements[].label` + `sizeChart.rows[].values[]`，表頭會跟著 `sizeChart.unit`（cm/inch）顯示單位，空的時候顯示「尚未設定尺寸表」提示
- **商品資訊表格**：移除 `fabricInfo.thickness/transparency/elasticity/madeIn` 這 4 個內部欄位；`fabricInfo.material` 換成 `product.material`；新增 `productOrigin` + `brand` 兩行
- **洗滌說明動態化**：有 `careInstructions` 就用 `whitespace-pre-line` 渲染；沒有就 fallback 到原本的 4 條預設文字
- **新增 modelInfo 卡片**：height / weight / wearingSize / bodyShape，4 格 grid，任一欄位有值才顯示整張卡
- **新增 stylingTips 卡片**：單段文字，whitespace-pre-line

---

## ✅ Task 2 — RichText Upload feature（DONE）

**檔案 1**: `src/payload.config.ts`
```ts
import { lexicalEditor, UploadFeature } from '@payloadcms/richtext-lexical'
// ...
editor: lexicalEditor({
  features: ({ defaultFeatures }) => [
    ...defaultFeatures,
    UploadFeature({ collections: { media: { fields: [] } } }),
  ],
}),
```

**檔案 2**: `src/app/(frontend)/products/[slug]/ProductDetailClient.tsx`
- `LexicalNodeRenderer` 新增 `case 'upload'`（L97-143）
- 自動判斷 `mimeType?.startsWith('video/')` 決定 `<video>` 或 `<Image>`
- 用 `normalizeMediaUrl(value.url)` 處理 CDN URL
- 安全 fallback：`!value || !src` 直接 return null

---

## 🚧 Task 3 — 後台 CSS 爆版修復（TODO，下個對話做）

**根本原因（已診斷完成）**: CSS Grid `1fr` 的 implicit minimum 是 `auto`（= min-content），長 SKU / 長顏色名會撐爆 grid child 寬度，連帶把父容器推寬，導致 Payload admin 的 `.css-n9qnu9` grid 被 content 推得錯位遮字。

**修復方式**: 把以下 5 處的 `1fr` 改成 `minmax(0, 1fr)`

| # | 檔案 | Line | 原 grid | 改成 |
|---|---|---|---|---|
| 1 | `src/components/admin/ShoplineImportPanel.tsx` | 888 | `repeat(5, 1fr) auto` | `repeat(5, minmax(0, 1fr)) auto` |
| 2 | `src/components/admin/ShoplineImportPanel.tsx` | 406 | `repeat(4, 1fr)` | `repeat(4, minmax(0, 1fr))` |
| 3 | `src/components/admin/ShoplineImportPanel.tsx` | 578 | `repeat(3, 1fr)` | `repeat(3, minmax(0, 1fr))` |
| 4 | `src/components/admin/ShoplineImportPanel.tsx` | 686 | `repeat(4, 1fr)` | `repeat(4, minmax(0, 1fr))` |
| 5 | `src/components/admin/ImageMigrationPanel.tsx` | 229 | `repeat(3, 1fr)` | `repeat(3, minmax(0, 1fr))` |

最關鍵的是 **#1（line 888）** — 那是 6 欄變體 grid（顏色/尺寸/價格/庫存/SKU/移除），SKU 欄最容易長。

**不要**直接寫 custom CSS 去蓋 `.css-n9qnu9`，那是 Payload 自己的 hashed class，build 後會變。從根源修 grid 才是正解。

**驗證方式**: 改完後打開後台 `/admin/collections/products`，展開 Shopline Import Panel 填幾個長 SKU（例如 `SSM-97970160-黑色-XXXL`），觀察整個面板不再爆版。

---

## 關鍵檔案（全部用 Read tool 打開就可以接續）

- `src/app/(frontend)/products/[slug]/ProductDetailClient.tsx` — PDP 主檔（Task 1 改動位置）
- `src/app/(frontend)/products/[slug]/page.tsx` — 已用 `depth: 2`
- `src/payload.config.ts` — Task 2 已改
- `src/collections/Products.ts` — schema（Tab 4 穿搭資訊有 material/careInstructions/modelInfo/stylingTips/sizeChart）
- `src/collections/SizeCharts.ts` — sizeChart 結構（measurements[] + rows[] + unit）
- `src/components/admin/ShoplineImportPanel.tsx` — Task 3 主要改動位置
- `src/components/admin/ImageMigrationPanel.tsx` — Task 3 次要改動位置

## Commit 紀錄

- Task 1 + Task 2 已 commit（詳見 `git log` 最新 commit）

## 下個對話的開場白範例

> 接續 Phase 4 Task 3。讀 `PHASE4_HANDOFF.md` 裡的「Task 3」section，用 Edit tool 改那 5 處 `1fr` → `minmax(0, 1fr)`，然後 `preview_start chickimmiu-next` 驗證 compile。完成後我會自己開後台驗證視覺。
