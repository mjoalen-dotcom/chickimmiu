# 交接提示詞 — 09 post-member-fields

前一對話結束於 **2026-04-18（對話 10 / session 8）**。下一個 session 開場直接把本文件複製給 Claude。

---

## ⚠️ 開工前必做（多 session 平行 hazard）

1. `git log --oneline -10` — 確認 origin/main 最新 SHA
2. `preview_list` — 看有沒有別 session 的 preview 在跑
3. 若要做新工作：**開新 worktree from origin/main**，不要污染現有 working tree

## 上一對話產出（已完成）

### A. PR #6 `feat/member-account-fields` — `bde53b1` 已 push，等 user click merge

- `Users.ts`：Tab 4 `bodyProfile` += 腳長 / 胸圍 / 腰圍 / 臀圍；Tab 1 新增 `invoiceInfo` group（發票抬頭 / 統編 / 地址 / 聯絡人 / 電話）
- Migration `20260418_230000_add_body_and_invoice_fields`（4 numeric + 5 text，PRAGMA 冪等 pattern 承 `20260417_100000_add_stored_value_balance`）
- `/account/settings` 前台 3 區塊：基本資料 / 身體資料（AI 尺寸推薦用）/ 公司發票資料
- 共用一個「儲存變更」按鈕，PATCH `/api/users/:id` 送巢狀 group
- 統編 input 強制數字 + 8 碼上限
- `tsc --noEmit` 0 err / `next build` 清
- PR URL：https://github.com/mjoalen-dotcom/chickimmiu/pull/new/feat/member-account-fields
- Worktree 位置：`C:\Users\mjoal\ally-site\ckmu-member-fields`（`node_modules` 是 junction 指到 main tree）

### B. 技術架構 PDF 已生成

- 檔案：`docs/architecture/CKMU_Tech_Architecture_2026-04-18.pdf`（8 頁 A4, 123 KB, Noto Sans TC）
- 產生器：`docs/architecture/_build_arch_pdf.py`（內容變了重跑 `python _build_arch_pdf.py`）
- 涵蓋：核心棧 / 35 collections / 15 globals / 前台路由 / 安全層 / ops / git 狀態 / 7 個關鍵資料流

---

## 當前狀態

- **origin/main HEAD**：`c39cf89`（PR #1 auth + PR #2 security-polish merged）
- **Prod 實跑**：`fa1db25`（比 main 舊，落後 3+ commits）
  - 同步指令：
    ```bash
    cd /var/www/chickimmiu
    git pull
    pnpm install --frozen-lockfile
    pnpm payload migrate        # 跑 login_attempts + body_and_invoice_fields
    pnpm build
    pm2 restart chickimmiu-nextjs
    ```
- **本機 main working tree**：branch `feat/cron-runner` (`955883d`)，但 working tree 混了**未 commit 的 commerce 檔案**
  - Modified: `cart/page.tsx`、`checkout/page.tsx`、`Orders.ts`、`Providers.tsx`、`migrations/index.ts`、`payload.config.ts`、`cartStore.ts`
  - Untracked: `Carts.ts`、`/api/cart/`、`/api/shipping-settings/`、`20260418_180000_add_carts_table.ts`
- **在飛的 branch**：
  - `feat/commerce-core` `f513daa` — PR #3（原子庫存鎖 + server cart + 統一 shipping API）
  - `feat/cron-runner` `955883d` — GitHub Actions cron runner
  - `feat/member-account-fields` `bde53b1` — 本次新增（見 A）
  - `feat/line-oauth` — NextAuth LINE provider（A unblock prod 實測過）
  - `feat/phase5.8-gamification` — Phase 5.8 scope locked
  - `chore/security-polish` `96b46cf` — 已 merge 為 PR #2（**可刪**）
  - `feat/auth-hardening` / `-v2` — 已 merge 為 PR #1（**可刪**）

---

## 優先處理（依優先序）

### [HIGH] 1. Merge + Deploy PR #6 到 prod

a. 使用者至 GitHub click merge PR #6
b. SSH prod 跑上方同步指令（**注意務必跑 `pnpm payload migrate`** — 新欄位不跑 migration 會讓 admin / settings 儲存 500）
c. 實測 https://pre.chickimmiu.com/account/settings 三區塊 UI 能讀寫
d. 後台 `/admin/collections/users/:id` 確認 Tab 1「公司發票資料」group + Tab 4「身體資料」新 row 都顯示

### [MED] 2. 本機 `feat/cron-runner` working tree 清理

未 commit 的 commerce 檔案要決定去向。優先**先 diff 確認是否跟 `feat/commerce-core` `f513daa` 已 commit 內容相同**：

```bash
cd C:/Users/mjoal/ally-site/chickimmiu
git diff feat/commerce-core -- src/collections/Carts.ts src/collections/Orders.ts
git diff feat/commerce-core -- "src/app/(frontend)/api/cart/" "src/app/(frontend)/api/shipping-settings/"
```

- **若相同** → 純歷史殘留：`git checkout -- <各檔案>` + `rm` untracked，還原 branch 為乾淨的 `955883d`
- **若不同** → 是新工作：`git stash` 後評估要不要開 PR #7 或合進 commerce-core

### [MED] 3. FB Business Manager IDs → 新 global `SocialIntegrationSettings`

使用者在對話 10 貼的資料：

| 項目 | 名稱 | ID |
|---|---|---|
| 企業管理平台 | Chickim&miu | `2137781379827397` |
| 主要粉絲專頁 | Chic Kim & Miu | `210263407374946` |
| 商品目錄 | 目錄＿產品 | `1080980348719933` |

**建議做法**：開 `src/globals/SocialIntegrationSettings.ts`，純資料欄位（FB Business Manager / Page / Catalog / Pixel / Commerce Account），未來擴充 LINE OA channel ID / IG professional account ID / WhatsApp business ID。**純 admin 填寫，前台不展示。** 這是 B「訊息通知整合」scope 的第一步 — 不含 webhook / 實際 API 呼叫。做成獨立 PR，不要混進別的。

### [LOW] 4. Checkout 自動帶入發票資料

現在 `/checkout` 手填。改 `CheckoutClient.tsx` 從登入 user 的 `invoiceInfo` 預填 → 大幅減少結帳摩擦。需等 PR #3 commerce-core merge 後再做（checkout 邏輯在 PR #3 有動）。

### [LOW] 5. AI 尺寸推薦實作

`bodyProfile`（身高 / 體重 / bust / waist / hips / footLength）→ SizeCharts 距離匹配 → PDP 顯示「建議尺碼：M」。前提是 SizeCharts 資料齊（seedCore 時已插過，要重新驗）。

### [LOW] 6. 遺留老問題

- **OAuth ↔ Payload cookie 橋接**：OAuth 使用者進 `/account/**` 會被 `payload.auth()` 拒絕 redirect `/login`。NextAuth `session-token` 與 Payload `payload-token` 是兩套獨立 cookie。方案：auth callback 時用 Payload `jwtSign` 同步簽一張 `payload-token` Set-Cookie 下去（見 memory「Payload cookie bridging」）
- **CSP 補 `connect.facebook.net`**：啟用 Meta Pixel 前
- **R2 access key rotation**：`74d908356510dce1fbdad700dc2e32df` 曾在 log 洩露，應輪替或確認已輪替
- **Payload SMTP adapter**：forgot-password token 目前只 log 到 server console，需串 SMTP 才能正式寄信

---

## 務必遵守

- **60% context warning**：累積超過就主動提醒 user 選 `/compact` 或開新對話
- **非部署型變更保守優先**：封測中，admin-configurable > hardcode
- **新程式碼先開 worktree**：不要污染 main working tree 的 `feat/cron-runner` 混亂狀態
- **`gh` CLI 不可用**：PR 靠 GitHub URL 手動 click
- **開工先 `git log --oneline -10`**：多 session 平行，很容易在別人已完成的 batch 上白做

---

## 參考文件（最新優先）

- `docs/architecture/CKMU_Tech_Architecture_2026-04-18.pdf` ← **新**，完整技術快照
- `docs/session-prompts/09-post-member-fields-handoff.md` ← **本文件**
- `docs/session-prompts/08-line-oauth-last-mile-and-cart-cod.md`
- `docs/session-prompts/07-security-polish.md`（已 merge PR #2）
- `docs/session-prompts/06-cron-runner.md` + `06-github-secrets-setup.md`
- `docs/session-prompts/05-real-ai-data.md`
- `docs/session-prompts/04-missing-pages.md`
- `docs/session-prompts/03-commerce-core.md`（PR #3 未 merge）
- `docs/session-prompts/02-auth-hardening.md`（已 merge PR #1）
- `HANDOFF_SESSION7.md`
- `HANDOFF_QA_PR2.md`
- `HANDOFF_B5_DIAGNOSIS.md`
- `HANDOFF_NEXT_15_5_UPGRADE.md`
- `QA_REPORT_2026-04-18.md` + `docs/issues/ISSUE-001..009.md`

---

*（本文件由對話 10 結尾自動生成。下一個 session 完成其中任務後，請在新的 `10-*.md` 更新狀態並移除本檔已完成項目。）*
