# Session Prompt 10 — Post-ROADMAP Handoff

**產生時間**：2026-04-18（PR #7 merge 後）
**上一段 session**：建立 `docs/ROADMAP.md` + gh CLI 安裝/授權 + memory 更新

---

## 上段做完

- PR #7 `docs/ROADMAP.md` merge 進 main（`9055b97`），封測→正式上線 5-phase canonical 清單建好
- gh CLI 剛裝好 + authed（`mjoalen-dotcom`）；bash 要用完整路徑 `"/c/Program Files/GitHub CLI/gh.exe"`，PATH 下次開 session 才更新
- Memory 同步：新增 `project_roadmap.md`、更新 `reference_gh_cli.md`

## 現況

- Branch `main` 乾淨 + 同步 `origin/main@9055b97`；無 WIP
- `docs/roadmap` branch 已 local+origin 刪乾淨

## 請先做的事

1. `git log --oneline -10` 確認沒有其他 session 又推了東西（使用者並行多 session 習慣）
2. 讀 `docs/ROADMAP.md` 確認 phase 勾選狀態
3. 按 roadmap 順序建議下一目標：**Phase 2 剩 2 項**
   - **(a) Email 驗證信** — resend / nodemailer 接 Payload Users `verify` flag；忘記密碼也共用同一 SMTP（memory 提過 token 目前只 log 到 console）
   - **(b) OAuth↔Payload cookie 橋接** — 參考 `feedback_payload_cookie_bridge.md` 的 `getFieldsToSign + jwtSign` pattern；症狀：OAuth 使用者進 `/account/points` 仍被 redirect

若使用者想跳到 Phase 3/4/5，先 flag 跳 phase 風險並確認意圖。

## 要注意

- **gh CLI** 可用但 bash PATH 未更新 → 用 `"/c/Program Files/GitHub CLI/gh.exe"` 完整路徑；PowerShell 用 `& "..."` 或 `.\gh.exe`
- **Prod 可能 split state**（disk pulled 但未 build+restart）→ `cd /var/www/chickimmiu && pnpm install --frozen-lockfile && pnpm build && pm2 restart chickimmiu-nextjs`
- **R2 token** rotation 仍 pending（access key 曾在對話 log 曝光）
- **CSP 缺口**：`connect.facebook.net` 不在 `script-src`/`connect-src`，若開 `NEXT_PUBLIC_META_PIXEL_ID` env 會被擋
- **平行 session**：任何工作前先 `git log --oneline -10` + `preview_list` 確認最新

## 相關文件

- `docs/ROADMAP.md` — phase 進度 source of truth
- `feedback_payload_cookie_bridge.md`（memory）— OAuth cookie 橋接 pattern
- `HANDOFF_QA_PR2.md`、`HANDOFF_SESSION7.md` — 舊 handoff，必要時回查
