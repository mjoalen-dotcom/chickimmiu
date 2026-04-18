# ISSUE-003 — 無 `/forgot-password` 流程（前端連結不存在、路由不存在）

**Severity**: ~~P0 Blocker~~ → **RESOLVED in commit `bd1f5c0`** (feat(phase5.6-auth): wire email/pw login + register + forgot/reset)
**Detected**: 2026-04-18 QA
**Resolved**: 2026-04-18
**Area**: Auth / Password Recovery

## 症狀

使用者忘記密碼時完全沒有自助恢復途徑。

## 根本原因

- [src/app/(frontend)/login/page.tsx](src/app/(frontend)/login/page.tsx) 沒有「忘記密碼」連結
- grep `忘記密碼|forgot[- _]?password|reset[- _]?password` 在 `src/` 底下只在 migration JSON 找到（歷史欄位），**沒有任何前端 route 或 UI**
- `src/app/(frontend)/forgot-password/` 目錄不存在
- `src/app/(frontend)/reset-password/` 目錄不存在

## 期望行為

- `/login` 頁加「忘記密碼？」連結 → `/forgot-password`
- `/forgot-password`：輸入 email → 呼叫 Payload `/api/users/forgot-password`（Payload 內建）→ 寄出重設連結
- `/reset-password?token=xxx`：表單輸入新密碼 → 呼叫 Payload `/api/users/reset-password` → redirect `/login`

## 建議修法

Payload v3 內建 `forgot-password` / `reset-password` REST endpoints（`users` collection 啟用 auth 就有）。所以這題只需要：

1. 新增 `src/app/(frontend)/forgot-password/page.tsx`（email 表單 → POST `/api/users/forgot-password`）
2. 新增 `src/app/(frontend)/reset-password/page.tsx`（讀 `?token=` + 新密碼表單 → POST `/api/users/reset-password`）
3. `/login` 加連結
4. 驗證 Payload users collection 的 `forgotPassword: {}` 設定 + SMTP 轉發器（見 email 設定備註）

## ⚠️ 依賴

此 issue 無法獨立驗證完成 — 需要 SMTP 設定正確才會實際寄出 email。封測期若 prod 沒接 SMTP，至少先：
- UI 該有
- API call 該通
- 前端顯示「已寄出重設信，若未收到請聯繫客服」

封測階段客服可以手動協助重設。

## 相關

- ISSUE-001 / ISSUE-002
- 建議合併同一 PR

## 測試驗收條件

- [ ] `/login` 可見「忘記密碼」連結
- [ ] `/forgot-password` 表單能 POST 成功（response 200）
- [ ] 收信（或檢查 Payload users `resetPasswordToken` 欄位有值）
- [ ] `/reset-password?token=...` 能成功更新密碼並 redirect `/login`
