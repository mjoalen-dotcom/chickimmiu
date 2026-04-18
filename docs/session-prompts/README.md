# Session Prompts — 封測→正式營運待辦

基於 2026-04-18 QA 完整稽核產出的工作分組。每份 prompt 都是「貼到新 Claude Code session 即可獨立執行」的格式，含 commit / push 指令。

## 批次波（避免檔案衝突）

**Wave 1（立即，單人跑，其他組先等）**
- [01-emergency-media-secrets.md](./01-emergency-media-secrets.md) — 🚨 圖片 404 + 硬編密碼輪換（含 prod SSH）

**Wave 2（可平行 4 組）**
- [02-auth-hardening.md](./02-auth-hardening.md) — 登出/email adapter/rate-limit/OAuth→Payload session sync/PR#2 commit
- [03-commerce-core.md](./03-commerce-core.md) — 庫存鎖定/server cart/結帳付款串接/運費統一
- [04-missing-pages.md](./04-missing-pages.md) — /contact /size-guide /shipping /returns 公開版
- [07-security-polish.md](./07-security-polish.md) — CSP/HSTS/UGC upload 驗證/admin 硬化

**Wave 3（依賴 Wave 2，最後做）**
- [05-real-ai-data.md](./05-real-ai-data.md) — 真推薦引擎 + UGC 真實資料 + 相關商品
- [06-cron-runner.md](./06-cron-runner.md) — cron 端點 + 自動化 runner + points bug

## 每組 prompt 的固定段落

1. **Context** — 專案概覽、當前 commit、branch
2. **Background** — 已存在的狀態 / 相關檔案
3. **Task** — 分步執行（含精確 file paths）
4. **Verification** — 如何確認完成（tsc、build、curl）
5. **Commit & Push** — `git add` + commit 訊息 + `git push`
6. **Prod Deploy**（若涉及）— SSH 指令佔位，使用者代入
7. **Guardrails** — 禁止事項（--no-verify、force push、觸碰他組檔案）

## 使用方式

```bash
# 1) 開新 Claude Code session（可 /clear 或用新視窗）
# 2) cd C:\Users\mjoal\ally-site\chickimmiu
# 3) 把對應 .md 的「Prompt」段整個貼到 chat
# 4) 等完成 → 看它自動 commit + push
# 5) 使用者自己 SSH 到 prod 做 pnpm install && pnpm build && pm2 restart
```

## 進度追蹤

| # | 名稱 | 狀態 | Branch | Commit |
|---|---|---|---|---|
| 01 | emergency-media-secrets | ⬜ | `fix/prod-media-secrets` | — |
| 02 | auth-hardening | ⬜ | `feat/auth-hardening` | — |
| 03 | commerce-core | ⬜ | `feat/commerce-core` | — |
| 04 | missing-pages | ⬜ | `feat/cms-missing-pages` | — |
| 05 | real-ai-data | ⬜ | `feat/real-recommendations` | — |
| 06 | cron-runner | ⬜ | `feat/cron-runner` | — |
| 07 | security-polish | ⬜ | `chore/security-polish` | — |
