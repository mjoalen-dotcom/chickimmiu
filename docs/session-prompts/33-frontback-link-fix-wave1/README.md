# Wave 1 — Front/Back Link Integrity & Storefront Hardening

**Date**: 2026-05-06
**Status**: 規劃完成，等 user 同意後派工
**Trigger**: user 反映 PDP `/products/現貨-率性反摺牛仔寬褲-藍色-free--ecbd15` 404 + PLP/Collections 後台改不到 + 想確保封測公開營運穩定

---

## 🚨 0. P0 事故先做：PDP system-wide 404

**[PR-0 hotfix](PR-zero-pdp-hotfix.md)** — prod 1,224 published products **全 PDP 404**（curl 5/5 失敗）。

API endpoint 命中、PDP server component query 不命中。最可能是 Next.js dynamic [slug] params decode bug。

**必先 merge + deploy 才能派 Wave 1**（沒 PDP 就沒辦法驗 δ/ε/θ）。

---

## 1. 偵察結論（已驗證）

| # | 問題 | 嚴重度 | 證據 |
|---|---|---|---|
| 1 | **所有 PDP 404**（不只 ecbd15）— curl 5/5 真實在 DB published slug 全顯示「商品不存在」 | **P0** | API 命中、PDP miss → 見 [PR-0](PR-zero-pdp-hotfix.md) §1 |
| 2 | Shopline 商品已部分匯入（prod 1,224 published），ecbd15 那支 **DB 確實有**（id=4647 status=published），純 PDP route bug | P0 | API `where[slug][equals]=...&depth=2` 命中 docs[0] |
| 3 | PLP 寫死 `limit:200` 沒 server pagination | P1 | [src/app/(frontend)/products/page.tsx:65](../../../src/app/(frontend)/products/page.tsx) |
| 4 | PLP 客戶端 hardcoded `displayOrder` 14 個 slug，與 prod 實際分類對不上 | P1 | [src/app/(frontend)/products/ProductListClient.tsx:75-79](../../../src/app/(frontend)/products/ProductListClient.tsx) |
| 5 | PLP size filter 是 placeholder，price range 寫死 0-10000 | P2 | ProductListClient.tsx:419-426 |
| 6 | `/collections` 7 個卡片 hardcoded，圖片用 shoplineimg.com 全 broken | P1 | [src/app/(frontend)/collections/page.tsx:13-56](../../../src/app/(frontend)/collections/page.tsx) |
| 7 | `/collections/[slug]` `COLLECTION_META` hardcoded 7 條 | P1 | [src/app/(frontend)/collections/[slug]/page.tsx:14-46](../../../src/app/(frontend)/collections/[slug]/page.tsx) |
| 8 | `/category/[slug]` route 不存在（Categories.slug:72 描述卻是 `/category/dresses`） | P1 | Glob 結果 |
| 9 | 沒有 `ProductListSettings` global，後台無法控制每頁筆數/排序/banner | P1 | grep globals 確認 |
| 10 | `Categories.productCount` 是 readOnly numeric 但無 hook 計算 | P2 | Categories.ts:152-159 + Products.ts hooks |

**Front-back revalidate 鏈**：OK（Products/Categories afterChange 都有 revalidatePath）。**這部分不破**。

---

## 2. 切分原則

- 每個 PR 動的檔案盡量不重疊
- 同一檔被多 PR 動，必須在不同區塊（不同 field group / 不同 hook）
- Wave 1 全部不動 `ProductListClient.tsx` 與 `products/page.tsx` — 留給 Wave 2 做整合
- `payload.config.ts` 是唯一 hot spot：α/β 各加 1 行 globals register；後 merge 那個 rebase < 1 分鐘

---

## 3. Wave 1 — 8 個獨立 PR，可同時派 8 個 worktree

| PR | Branch suggestion | 內容 | Migration | Prompt |
|---|---|---|---|---|
| α | `claude/wave1-product-list-settings` | 新 global `ProductListSettings`（pageSize/sort/maxPrice/banner...） | yes | [PR-alpha](PR-alpha-product-list-settings.md) |
| β | `claude/wave1-collections-page-settings` | 新 global `CollectionsPageSettings`（admin-driven themed cards） | yes | [PR-beta](PR-beta-collections-page-settings.md) |
| γ | `claude/wave1-category-product-count` | Products afterChange 自動重算 categories.productCount + 一鍵 recount endpoint | no | [PR-gamma](PR-gamma-category-product-count.md) |
| δ | `claude/wave1-product-alias-slugs` | Products 加 `aliasSlugs[]`，PDP 找不到時 fallback + 301 redirect canonical | yes | [PR-delta](PR-delta-product-alias-slugs.md) |
| ε | `claude/wave1-category-route` | 新 `/category/[slug]` server-rendered route | no | [PR-epsilon](PR-epsilon-category-route.md) |
| ζ | `claude/wave1-link-integrity-view` | admin `/admin/diagnostics/link-integrity` 列出 orphan/dup/mismatch | no | [PR-zeta](PR-zeta-admin-link-integrity.md) |
| θ | `claude/wave1-smoke-storefront` | `scripts/smoke-storefront.ts` 跑 N 個 PDP/PLP/category 200 OK + 內容驗 | no | [PR-theta](PR-theta-smoke-storefront.md) |
| ι | `claude/wave1-i18n-storefront-admin` | 5 語系字典補新 admin field label + ProductListClient hardcoded 中文補 t() | no | [PR-iota](PR-iota-i18n.md) |

**檔案佔用矩陣**：

| 檔案 | α | β | γ | δ | ε | ζ | θ | ι |
|---|---|---|---|---|---|---|---|---|
| `src/payload.config.ts` | +1 line (globals[]) | +1 line (globals[]) |  |  |  |  |  |  |
| `src/collections/Products.ts` |  |  | hooks 加段 | fields aliasSlugs 區 |  |  |  |  |
| `src/collections/Categories.ts` |  |  | endpoints[] 加 |  |  |  |  |  |
| `src/app/(frontend)/products/[slug]/page.tsx` |  |  |  | fallback 加 5 行 |  |  |  |  |
| `src/app/(frontend)/category/[slug]/page.tsx` |  |  |  |  | NEW |  |  |  |
| `src/messages/*.json` |  |  |  |  |  |  |  | 5 檔 NEW namespace |
| `src/migrations/*.ts` | NEW | NEW |  | NEW |  |  |  |  |
| `scripts/smoke-storefront.ts` |  |  |  |  |  |  | NEW |  |
| `src/app/(payload)/admin/.../diagnostics/...` |  |  |  |  |  | NEW |  |  |

零重疊。

---

## 4. Wave 2（Wave 1 全 merge 後再做）

| PR | 內容 | 依賴 |
|---|---|---|
| η | 補匯入剩餘 Shopline 商品（prod 已有 1,224，但 7,226 - 1,224 = ~6,000 仍缺）+ alias 寫入 | δ (aliasSlugs schema) |
| κ | PLP 分頁化（接 PR-α 設定）+ size filter 實作 + 用 Categories.sortOrder 取代 hardcoded displayOrder + 接 t() | α + γ + ι |
| λ | `/collections` + `/collections/[slug]` 接 PR-β、圖片改 R2 | β |
| μ | PDP related products 改成接 PR-α `defaultRelatedCount` + admin override | α + PR-0 |

Wave 2 prompt 等 Wave 1 merge 完再寫（避免 spec 提早寫到 1 變動）。

---

## 5. 跨 session 協調 matrix（沒讀清楚別動手）

9 個 session 不會互相通訊。協調點全寫死在這。**每個 session 開工前讀這節**。

### 5.1 依賴（merge 順序）

```
PR-0 hotfix  ──┐
               ├──── 必須最先 merge + prod deploy
               │     （沒這個 PDP 全壞，δ/θ/ε 都驗不到）
               ▼
α / β / γ / ε / ζ / θ / ι   ←  PR-0 merge 後可以 8 條同時開
               │
PR-δ  ─────────┘
        ↑ δ 也要等 PR-0 merge，因為 δ 改的 page.tsx 是 PR-0 重寫過的版本
```

### 5.2 檔案 conflict matrix

| 雙方 PR | 共用檔 | 衝突區段 | 解法 |
|---|---|---|---|
| α ↔ β | `src/payload.config.ts` | `globals: [...]` array 各加 1 行 | **後 merge 那個 rebase 1 行**（git mergetool / 手解 5 分鐘） |
| γ ↔ δ | `src/collections/Products.ts` | γ 改 `hooks.afterChange[]` / `afterDelete[]`、δ 改 `fields.tabs[].fields[]` aliasSlugs | **不同檔內區段**，rebase 通常自動解；若 conflict 看 PR-γ 改 hooks block、PR-δ 改 fields block |
| PR-0 ↔ δ | `src/app/(frontend)/products/[slug]/page.tsx` | PR-0 抽 `findProductBySlug` helper、δ 在 helper 內加 alias fallback | **PR-0 必先 merge**；δ rebase 後在 helper **取消註解** alias placeholder（PR-0 已留） |
| α/β ↔ ζ | `src/payload.config.ts`（如果 ζ 改了） | endpoints register | ζ 已建議改 `Products.collection.endpoints[]` 避開；若 ζ 不得不改 payload.config，跟 α/β 一樣後 merge rebase |

**完全獨立、無 conflict**：ε（純新檔 `category/[slug]/`）、θ（純新檔 `scripts/`）、ι（純改 `messages/*.json`）

### 5.3 跨 session 同步點（如何發現對方做了什麼）

唯一同步管道是 **git**：

1. 每個 session **動手前** `git fetch origin && git log origin/main..HEAD origin/main` 看 main 與自己 branch 差了什麼
2. 看到 `claude/wave1-*` 別人的 PR 已 merge 進 main → `git rebase origin/main` 拉進來
3. 看到別人 PR 還 open，但動到自己同檔 → 不要等對方，自己照 spec 寫；最後誰晚 merge 誰 rebase

### 5.4 何時該 stop 並回報 user

session 在以下情況**停下、不要硬幹**：

- 偵察結果與 spec 嚴重不符（例如 spec 說 PDP 200 但實測 404 — PR-0 已包含此情境）
- 上述 conflict matrix 出現預期外的衝突（例如同檔同行被兩 PR 動）
- migration 跑不過、PRAGMA 冪等失敗
- `pnpm build` 出現非自己改動的錯（代表 main 本身壞了）
- `tsc` 報錯但 fix 涉及該 PR scope 外的檔案

回報格式：「我是 PR-X 的 session。在做 <step> 時遇到 <事實>。spec 對應在 <位置>。建議 <選項 A / B>，等指示。」

---

## 6. 通用規則（每個 Wave 1 PR 都遵守）

1. **Branch from `main`**，不要從別人 worktree branch
2. **Migration**：用 `npx payload generate:migration` 產生，再人工改成 PRAGMA 冪等（先檢查 column 存不存在）— 範本見既有 `src/migrations/20260505_160000_add_utm_lock_rels.ts`
3. **Schema 改動**：必須補 `payload_locked_documents_rels.<slug>_id` 欄位（教訓見 [memory: feedback_prod_schema_sync_on_new_collections.md](../../../memory/) — Wave 1 只有 δ 加 array 子表，不需 lock_rels；但 ε/ζ 不動 schema 不影響）
4. **Admin component 加新的**：必跑 `pnpm payload generate:importmap` 並 commit `src/app/(payload)/admin/importMap.js`（教訓見 PR #50/#134/#136/#143-147）
5. **Acceptance 必有**：
   - `pnpm tsc --noEmit` 0 err
   - `pnpm build` 清
   - 該 PR 自己的 smoke (curl/REST 或 page render 截圖)
6. **不要動 ProductListClient.tsx 也不要動 products/page.tsx**（除非 prompt 明確列出）— 留給 Wave 2
7. **i18n**：新 admin field label 用中文 hardcoded 即可，PR-ι 會集中補 5 語系

---

## 7. 開工前 user 動作

- [ ] 確認 plan，回「OK 派工」
- [ ] （可選）開 8 個 worktree：`git worktree add .claude/worktrees/wave1-<x> claude/wave1-<x>-<short>`
- [ ] 每個 worktree 用對應 PR-prompt 跑

---

## 8. 風險與緩解

| 風險 | 緩解 |
|---|---|
| `payload.config.ts` 同時被 α/β edit conflict | 約定 α 先 merge → β rebase；conflict 可預期，1 分鐘 |
| α/γ 都加 hooks 到 Products.ts | γ 加在 hooks.afterChange[] **第二位**；α 不動 hooks |
| Wave 1 期間 prod 持續封測 | 所有 PR 都 status=draft 或新 global 預設不啟用；不影響現有 published 商品 |
| Shopline 商品 7,226 還沒匯入，PR-η 是頭等大事 | Wave 2 第一個做 |
