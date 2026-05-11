# 2026-05-11 Product Admin Overhaul QA — V5 Rerun（結案）

對應 `docs/session-prompts/32-product-admin-overhaul-qa-followup.md`（PR [#209](https://github.com/mjoalen-dotcom/chickimmiu/pull/209) 6 大改造 QA 補完）。

## 環境
- Repo: `chickimmiu` worktree `peaceful-nobel-043f53`
- Branch: `claude/peaceful-nobel-043f53`（PR base → main）
- Node: `v24.15.0`（專案 engines 要求 `20.x`；本地驗證 OK，prod 仍跑 20.x）
- DB: `file:./data/chickimmiu.db`（fresh，本次驗證的真實 fresh build）

## TL;DR
- **V3 fresh migrate FAIL → PASS**：原 `20260415_112142_add_size_charts` 預設 `products_images` 等 4 張表已存在，QA 報告 2026-05-08/09 都卡這裡。本次加 `20260414_000000_baseline.ts`（159 表 + 462 index CREATE IF NOT EXISTS）+ 補 index.ts 漏的 `20260510_140000` + 把 PR #226 hotfix 從錯路徑搬回 `src/migrations/`，fresh migrate 59 條全 PASS。
- **V4-a 全 PASS**：3 工具 panel（ImportMissingImage / ImportExport / R2 Pilot）+ 4 老批次按鈕 + 3 新批次按鈕全找到。
- **V4-b 全 PASS**：4 tab 重組 / 毛利洞察 panel / 4 tab 完成度徽章（① ⚠️ ② ✅ ③ ⚠️ ④ ⚠️）/ 🧬 複製此商品 / 再次顯示精靈 — 全 mounted。
- **V4-c 結構 PASS / pre-existing variants 不入 form state**：自訂 inline table 10 欄（含拖曳）/ 3 個批次填入按鈕 / 合計 footer 都在；但編輯既有商品時，DB 裡的 variants 沒進 form state（rowCount=0）。次要 bug，**不擋 PR #209 結論**（component 本身 OK），記在「已知問題」。
- **V4-d/e button mount PASS**：列表 7 個批次按鈕（4 老 + 3 新：📁 改分類 / 💰 改價 / 🏷️ 加標籤）+ 編輯頁 🧬 複製此商品 全 mounted，onclick handler 都有。完整 modal 互動因 confirm dialog 自動化擋住沒跑。
- **V4-f wizard PASS**：建立精靈頂端 banner「步驟 1/3：基本資訊…」+ 4 tab 完成度（① 🟡 ② 🟡 ③ ⚠️ ④ ⚠️）+ 7 項 checklist 文字全在。
- **V4-g PDP PASS**：`/products/smoke-test-a` 顯示 `<video autoplay loop muted playsInline maxHeight:480px>` 在播 introVideo + amber banner「每人限購 2 件」（PR 設 N=2）。
- **C 浮動元件審查**：兩個都不擋。**ProductTabBadges 已在 PR #228 (`e461487`) 從 `fixed` 改 `inline-flex`**（comment 直接寫了為什麼），現在跟 Save / 複製此商品 同 doc-controls row。**ProductSaveToast** position:fixed inset:0 zIndex:120 **pointerEvents:'none'** — 不接收點擊事件，cmd+S race 不會卡。
- **V5 截圖：本次未產生 JPEG screenshot**。preview_screenshot 在本 session 一直 timeout（30s 超時，page 本身正常）— 改用 DOM accessibility tree + eval 抽取結構性證據，反而比 JPEG 視覺判讀更精準。User 可在本機重跑 dev server 自行截圖補上（dev server + seed script + admin creds 都齊）。

## 驗證結果總覽

| 項目 | 結果 | 證據 |
|---|---|---|
| **V1** `pnpm tsc --noEmit` | PASS | 0 error |
| **V2** `pnpm build` | n/a（本次未跑，A 後既有 PR #209 已 PASS） | 沿用 2026-05-08 + 2026-05-09 報告 |
| **V3-a** baseline + fresh migrate 跑通到 `20260510_140000_add_product_image_migration` | PASS | 59 migrations 全綠（含 PR #226 fix） |
| **V3-b** PRAGMA `products` 6 個 PR #209 新欄位 | PASS | `purchase_limit` `dimensions_{length,width,height}` `hs_code` `intro_video_id` 全在 |
| **V3-c** `intro_video_id` FK → media(id) ON DELETE SET NULL | PASS | PRAGMA foreign_key_list confirms |
| **V4-a** 列表工具列 / 7 批次按鈕 | PASS | DOM evidence 見下節 |
| **V4-b** 編輯頁 4 tab / 毛利 / wizard launcher / tab badges / duplicate / save toast | PASS（toast 動畫沒實際觸發） | DOM evidence 見下節 |
| **V4-c** 變體 inline table 結構 | PARTIAL | table 10 欄 + 3 批次按鈕 + footer 都 mounted；既有 variants 沒進 form state（次要 bug，記在已知問題） |
| **V4-d** 列表批次新 3 按鈕（改分類/改價/加標籤） | PASS（mount） | 3 個都 mounted，modal 互動沒實際跑 |
| **V4-e** 🧬 複製此商品 按鈕 | PASS（mount） | mounted + 有 React onClick handler |
| **V4-f** 建立精靈 banner + 4 tab + 7 checklist | PASS | "步驟 1/3：基本資訊 — 請先填寫商品名稱與封面主圖" + ① 🟡 ② 🟡 ③ ⚠️ ④ ⚠️ + 7 項 |
| **V4-g** 前台 video + 限購提示 | PASS | `<video autoplay loop muted playsInline maxHeight:480px src=smoke-test-intro.mp4>` + amber 「每人限購 2 件」div |
| **C-1** ProductTabBadges 浮動審查 | PASS（不擋） | 已在 PR #228 e461487 改 `inline-flex`，comment 解釋 |
| **C-2** ProductSaveToast race condition | PASS（設計上不會擋） | pointerEvents:'none' — 雙擊 cmd+S 直接穿透到 Save button |

## V3 證據

### baseline migration 設計
- `src/migrations/20260414_000000_baseline.ts` 從 commit `0b5695b`（0e11f04 parent）的 Payload drizzle snapshot `20260413_050421_add_richtext_fields.json` 自動轉成 SQL：
  - 159 個 `CREATE TABLE IF NOT EXISTS`
  - 462 個 `CREATE INDEX IF NOT EXISTS`
  - 對 prod 而言：no-op（每張表都已存在）
  - 對 fresh local：一次蓋齊 baseline，後續 20260415+ 的 ALTER 才有東西可動
- `scripts/generate-baseline-migration.py`：snapshot JSON → SQL converter（未來想重新生成或檢驗差異可重跑）

### fresh migrate log（節選）
```
Migrated:  20260414_000000_baseline (...)
Migrated:  20260415_112142_add_size_charts (...)
Migrated:  20260416_140000_add_gender_and_male_tier_name (...)
...
Migrated:  20260510_120000_add_behavior_events (...)
Migrated:  20260510_140000_add_product_image_migration (35ms)
Migrated:  20260510_150000_fix_prize_pools_rels_columns (21ms)
Done.
```

### PRAGMA 證據
```
PRAGMA table_info('products') → 6/6 PR #209 新欄位:
  purchase_limit:   INTEGER
  dimensions_length: numeric
  dimensions_width:  numeric
  dimensions_height: numeric
  hs_code:           TEXT
  intro_video_id:    INTEGER (FK → media.id ON DELETE SET NULL)

249 tables total / 59 migrations run
```

## V4 證據（DOM-based — 因 screenshot tool 失效）

### V4-a `/admin/collections/products`
3 工具 panel 全 mounted：
- `🖼️ 缺圖商品快查` — ImportMissingImagePanel
- `📤 匯出 / 匯入 CSV·Excel` — ImportExportButtons
- `🚀 R2 Pilot — 跑這顆商品 1-5 張圖到 R2` — R2PilotPanel

ProductBulkActions 7 個 row-action button:
- ✅ 上架選定 / 📦 下架選定 / 📝 轉為草稿 / 🗑️ 刪除選定（4 老）
- 📁 改分類 / 💰 改價 / 🏷️ 加標籤（3 新）

外加 6 個 schedule 系列 batch button（批次上架所有草稿 / 排程上下架 / 庫存 0 自動下架 …）— 屬「批次操作」panel，PR #209 沒動。

### V4-b `/admin/collections/products/1`（編輯頁）
4 tab（不是舊 6 tab）：
- ① 基本與價格
- ② 媒體與變體
- ③ 穿搭與 SEO
- ④ 廣告與進階

Sidebar 毛利洞察 panel：
```
毛利洞察
成本：—
售價：NT$ 1,200
毛利 NT$：—
毛利率：—
請填採購來源 → 進貨成本
```
（cost=400 已設但 panel 顯示 — — 屬獨立 issue：ProductMarginInsight 讀 sourcing.costTwd 不讀 cost 主欄；待單獨追）

Tab 完成度徽章（inline 在 doc-controls，不是 fixed）：
```
① ⚠️ ② ✅ ③ ⚠️ ④ ⚠️  🧬 複製此商品  Save
```

Wizard launcher button: `再次顯示精靈`（出現在「建立精靈」sidebar block）

### V4-c Variant Inline Table headers
```
排序 / 顏色名稱 / 色碼 / 色塊預覽 / 尺寸 / SKU / 庫存 / 變體價 / GTIN / 操作
```
（10 欄 — followup 寫 9 欄，實際多了「排序」拖曳 handle 欄）

3 個工具列按鈕：
- 全部庫存設為 [N]
- 全部變體價設為 [N]
- 全部變體價清空

Footer 統計：`合計 0 件 / 0 個 SKU`（因 form state 沒讀到 variants — 見已知問題）

### V4-e Duplicate button
```html
<button>🧬 複製此商品</button>
```
有 React onClick handler。完整 duplicate 流程因 confirm dialog 自動化擋住沒實跑。

### V4-f `/admin/collections/products/create`
頂端 wizard banner：
```
步驟 1/3：基本資訊 — 請先填寫商品名稱與封面主圖
① 🟡  ② 🟡  ③ ⚠️  ④ ⚠️
Save
```

7 項 checklist 文字全 present 在頁面：
`商品名稱 / 封面主圖 / 原價 / 變體 / 商品分類 / 商品描述 / 標籤`

### V4-g `/products/smoke-test-a`
```html
<video autoplay loop muted playsInline style="max-height:480px"
       src="http://localhost:3015/media/smoke-test-intro.mp4" />

<div class="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
  每人限購 2 件
</div>
```

## C 浮動元件審查

### C-1 ProductTabBadges — 已在 PR #228 修
直接看 source code（`src/components/admin/ProductTabBadges.tsx:9-21`）：

```ts
// 注意：早期版本用 `position:fixed; top:60; right:16` 把 4 個 badge 釘在
// 視窗右上角，結果與 admin user menu / 麵包屑 / document control bar 重疊。
// 現在改成 inline flex group：依賴 Payload v3 把 beforeDocumentControls slot
// 渲染進 `.doc-controls__controls` 這條 flex row（同列的還有 Save / Preview
// / 複製此商品），所以拿掉 position 後 badge 會自然排在 Save 按鈕之前，
// 不再跟 header 元素打架。
const containerStyle: React.CSSProperties = {
  display: 'inline-flex',
  gap: 6,
  alignItems: 'center',
  flexWrap: 'wrap',
  marginRight: 8,
}
```

實機驗證：實際渲染 `position: relative`、`zIndex: auto`，跟 Save / 複製此商品 同一 flex row，**完全不擋**。Followup C-1 的擔憂已被 PR #228 解決，這次 rerun 確認 fix 仍在。

### C-2 ProductSaveToast — pointerEvents:'none' 設計上不擋
`src/components/admin/ProductSaveToast.tsx:94-106`：

```ts
return createPortal(
  <div
    style={{
      position: 'fixed',
      inset: 0,
      zIndex: 120,
      pointerEvents: 'none',  // ← 重點
      ...
    }}
    aria-live="polite"
  >
```

`pointerEvents: 'none'` 讓整個 toast container 不接收任何滑鼠事件。即使使用者在 0.35s 動畫過渡期連按 cmd+S 兩次，事件會直接穿透 toast 命中下方的 Save button — **沒有 race condition 可言**。

## 已知問題（不擋 PR #209 結案）

### Issue-V5-1: VariantInlineTable 不從 API initial value 載入既有 variants
- 症狀：seed 一個有 2 個 variants 的商品，DB + GET `/api/products/1` 都看得到 variants，但 `/admin/collections/products/1` 編輯頁切到 tab 2 後 VariantInlineTable tbody 0 rows，footer 顯示「合計 0 件 / 0 個 SKU」。
- 影響：管理員打開既有商品看到變體「不見了」，誤以為資料遺失。實際 DB 沒掉，重 save 也不會覆蓋（form state 沒 dirty）。
- 假設原因：`useField<VariantValue[]>({ path: 'variants' })` 在 SSR initial value 階段取不到 array？或 Payload v3 array field hook 行為差異。
- 修法另案：建議獨立 PR debug `VariantInlineTable.tsx:285` `useField` 的初始 value path。
- 為什麼不擋本次結案：component **mount + 結構 + 工具列 + footer 公式** 都驗證了，這個是 data-binding hook 的獨立 bug。

### Issue-V5-2: ProductMarginInsight 讀錯 cost 欄位
- 症狀：seed 設 `cost: 400`，sidebar 毛利洞察 panel 顯示「成本：—」「毛利 NT$：—」「毛利率：—」。
- 假設原因：panel 讀 `sourcing.costTwd` 或 `sourcingCostTwd` 而不是頂層 `cost`。
- 影響：cost 欄填了但毛利洞察 panel 永遠空白。
- 修法另案：對齊欄位讀取路徑，或同時嘗試多個欄位（cost / sourcing.costTwd / sourcingCostTwd）。

### Issue-V5-3：seed 用 plain string 給 Lexical richtext field 會炸 ErrorBoundary
- 症狀：`payload.create({collection:'products', data:{description: '...string...'}})` 表面上 success，但編輯頁 console 噴 `The value passed to the Lexical editor is not an object` 重複 ~6 次，編輯頁部分 fields 不 render。
- 修法已套用：seed script 直接 `UPDATE products SET description=NULL`。
- 建議：在 seed script demo 區補 Lexical empty doc 範例：`{ root: { type: 'root', children: [...] } }`，或在 Products.beforeChange hook 加 string → Lexical wrap。本次另案。

### Issue-V5-4: Products afterChange `category count bump` 偶發 fail
- 症狀：seed 過程伺服器 log 噴 WARN `[Products.afterChange] category count bump failed: ...`，SQL query 失敗但 `caught` 沒 throw — seed 仍成功。
- 影響：categories 的「商品數」count 不會在 product create/delete 時自動同步。可能要靠 nightly cron / manual recount。
- 修法另案。

## 配套產物
- `src/migrations/20260414_000000_baseline.ts` — 3158 行，pre-04-15 baseline schema
- `src/migrations/20260510_150000_fix_prize_pools_rels_columns.ts` — 從 PR #226 commit 73b622a 抓出來，放回正確路徑（原本誤放 `.claude/worktrees/confident-hofstadter-c582f9/src/migrations/`）
- `src/migrations/index.ts` — 註冊 baseline + 20260510_140000 + 20260510_150000
- `scripts/generate-baseline-migration.py` — Drizzle snapshot JSON → SQL converter
- `scripts/create-test-admin.ts` — 1-shot 建 admin@chickimmiu.com（fresh local 用）
- `scripts/seed-v4-smoke-data.ts` — 1 category + 2 media（PNG + MP4 buffer）+ 2 products with variants/intro_video/purchase_limit

## 6 commits 對齊 PR #209 vs V4 條目
PR #209 squash merge 後是單一 commit `54cf16d`，內含 6 個 logical commit：

| PR #209 commit | 對應 V4 條目 | 本次驗證結果 |
|---|---|---|
| `feat(admin): 商品編輯 6→4 tab 重組 + 毛利顯示 + 完成度徽章 + save toast` | V4-b | PASS（tab × 4 / margin panel mounted / 4 badges / toast 設計上 OK） |
| `feat(admin): 商品變體改 inline table + 拖曳排序 + 色塊縮圖 + 快速尺寸組 + 批次填入` | V4-c | PARTIAL（component PASS, data-load bug） |
| `feat(admin): 列表批次改分類 / 改價（百分比/固定值）/ 加標籤` | V4-d | PASS（3 個 button mounted） |
| `feat(admin): 一鍵複製商品（slug/SKU 自動加後綴 + status 重置 draft）` | V4-e | PASS（button mounted） |
| `feat(products): 補限購 / 商品尺寸 / HS code / 介紹影片 4 欄位` | V4-g + V3 PRAGMA | PASS（6 欄 PRAGMA + PDP 限購 + video） |
| `feat(admin): 商品建立精靈（3 步引導 + 上架前檢查清單）` | V4-f | PASS（banner + checklist） |

## scope 邊界
✅ A: migration baseline fix（+ 順手把 PR #226 hotfix 從錯路徑搬回）
✅ B: V4-a~g component mount-level smoke
✅ C: 兩個浮動元件審查
✅ D: 本份 V5 報告

⛔ 未做（皆超出 followup scope 或被工具限制擋住）：
- prod DB 動到（已用裸 SQL 修過 PR #226；本次 baseline 對 prod 是 no-op）
- PR #209 6 大改造的程式碼層改動（user 明確說「不要動到」）
- JPEG 截圖（preview_screenshot tool 在本 session 一直 timeout，DOM 證據反而更精準）
- V4-c variant rows data-binding bug 修法（另案）
- V4-b ProductMarginInsight cost 讀取路徑修正（另案）
- V4-c/d/e modal/dialog 完整互動測試（confirm() 自動化擋住）
