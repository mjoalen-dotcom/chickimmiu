# Session Prompt 11 — Phase 2 收尾（email 驗證信 + 勾 ROADMAP）

**產生時間**：2026-04-18（session 10 post-ROADMAP 之後）
**上一段 session**：確認 git 狀態 + 查到 ROADMAP 陳舊（Phase 2b 早就 done）

---

## 上段做完

- `git log --oneline -10` 確認 `main@9055b97` 跟 `origin/main` 同步、無 WIP
- 發掘 **ROADMAP.md 兩個 Phase 2 項目的實際狀態跟勾選狀態不一致**：
  - **(b) OAuth↔Payload cookie 橋接** 其實早已 DONE 在 main（commit `98c877a`，PR #3 `feat/line-oauth`）。`src/auth.ts:162-169` 用 `getFieldsToSign + jwtSign` 寫 `payload-token` cookie，跟 Payload `/api/users/login` 行為一致。memory line 20 + ROADMAP 沒同步這件事。
  - **(a) Email 驗證信** 仍 pending，但**部份 WIP 散在 `feat/auth-hardening-v2` branch**（commit `2b49015`，未 merge）— Resend adapter 已接好 `payload.config.ts`，還有 customerLogout endpoint + LogoutButton + rateLimit middleware + OAuth fail-loud banner。但這個 branch **不能直接 merge**（見下）。

## 現況

- `main` 乾淨 + 同步 `origin/main@9055b97`
- `feat/auth-hardening-v2`（local + origin）有 `2b49015`：Resend adapter / logout / rate-limit / fail-loud
- main 上 `src/endpoints/customerLogout.ts` + `src/app/(frontend)/account/LogoutButton.tsx` **都不存在** → 目前會員 `/account` 登出按鈕可能是死的（需驗證）
- main `Users.ts` 無 `verify:` 設定，forgot-password token 仍 log 到 console
- main `payload.config.ts` 無 emailAdapter

## ⚠️ 不能直接 merge `feat/auth-hardening-v2`

該 branch 從 `bd1f5c0`（PR #1）分出去，**沒包含** PR #2 security-polish / PR #4 cron / PR #5 line-oauth-state / PR #6 member-fields / PR #7 ROADMAP。直接 merge 會：

1. **REVERT** `Users.ts` 的 `maxLoginAttempts:10 + lockTime:10min`（PR #2 security-polish 加的暴力破解防護）
2. **REVERT** `LoginAttempts` collection 的 `afterLogin` 稽核 hook
3. 跟 `next.config.mjs`（CSP/HSTS）、`src/middleware.ts`（admin BasicAuth + rate-limit 合併）衝突
4. 跟 member-fields migration + body/invoice fields 的 SettingsClient 衝突

## 請先做的事

### 1. 更新 ROADMAP.md（30 秒）
把 Phase 2 勾選狀態修正：
- 現在 line 43 `- [ ] OAuth（Google / Facebook / LINE / Apple）與 Payload cookie 橋接完成` → 改成 `- [x] ... — 98c877a`
- 備註欄裡的「OAuth↔Payload cookie 橋接 仍 pending」刪掉
- 也許新增一行 current status snapshot 的日期

### 2. Cherry-pick + 新寫 Phase 2(a) email 驗證信（feat/email-verification branch）

從 `main` 開新 branch。**不要** merge `feat/auth-hardening-v2`；改成挑需要的：

**A. Resend adapter 接 Payload**（抄 `2b49015` 的 `src/payload.config.ts` 片段）：
- `pnpm add @payloadcms/email-resend`
- import `resendAdapter` → `email: resendAdapter({ apiKey: env.RESEND_API_KEY, defaultFromAddress: env.EMAIL_FROM_ADDRESS, defaultFromName: 'CHIC KIM & MIU' })`
- `.env.example` 加 `RESEND_API_KEY=` + `EMAIL_FROM_ADDRESS=noreply@chickimmiu.com`
- 要使用者提供 real `RESEND_API_KEY`（從 Resend dashboard 拿）

**B. 打開 email 驗證**：`src/collections/Users.ts` `auth` block 加：
```ts
verify: {
  generateEmailSubject: () => 'CHIC KIM & MIU｜請驗證您的 Email',
  generateEmailHTML: ({ token, user }) => {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pre.chickimmiu.com'
    const verifyUrl = `${siteUrl}/verify-email?token=${token}`
    // TODO: 抄 forgotPassword 的 HTML template 品牌風格，改成驗證連結
    return `...`
  },
},
```

**C. 新寫 `/verify-email` 前台頁**：`src/app/(frontend)/verify-email/page.tsx`
- Client component，讀 URL `?token=...`
- POST `/api/users/verify/${token}` → Payload 內建端點
- 成功：顯示「已驗證，請[登入](/login)」；失敗：提示 token 過期/無效

**D. 註冊流程調整**：`src/app/(frontend)/register/page.tsx`
- 註冊成功後改顯示「請到信箱點驗證連結」，不要 auto-login
- 檢查 `customerRegister` endpoint 有沒有把 `_verified:false` 預設傳回

**E. Logout button（從 `feat/auth-hardening-v2` cherry-pick）**：
- `src/endpoints/customerLogout.ts` 跟 `src/app/(frontend)/account/LogoutButton.tsx` 兩個檔抄過來
- `Users.ts` `endpoints` 陣列加 `customerLogoutEndpoint`
- `src/app/(frontend)/account/layout.tsx` 把死按鈕換成 `<LogoutButton />`

**F. Migration**：Payload 開 `verify` 會讓 Users collection 要 `_verified` 跟 `_verificationToken` 欄位 → 寫 SQLite migration（PRAGMA 冪等 pattern，參考 `20260417_100000_add_stored_value_balance.ts`）

### 3. 驗證流程
1. `pnpm tsc --noEmit` 清 0 err
2. 本地 `pnpm dev` 起來：
   - 註冊新 email → 收到驗證信（如果沒 RESEND_API_KEY，Payload 會 throw 或把內容 log 出來，看 server console）
   - 點驗證連結 → `/verify-email` 成功
   - 登入 → 進 `/account` → logout 按鈕能清 cookie 並 redirect /login
3. 勾 ROADMAP Phase 2 line 40 `- [x]` + 更新備註

### 4. PR

```
feat(phase2-email): resend adapter + email verification + logout
```

Body 列：A-F 每個 bullet + 驗證步驟。

### 5. Cleanup
Merge 後 `git branch -D feat/auth-hardening-v2` + `git push origin --delete feat/auth-hardening-v2`（stale，不會再用到）。

## 要注意

- **`feat/auth-hardening-v2` 不要 merge** — 只能 cherry-pick `payload.config.ts` / `customerLogout` / `LogoutButton` / `.env.example` 四個片段
- **RESEND_API_KEY** 要跟使用者要；他可能還沒註冊 Resend。alternate = nodemailer + SMTP（用 Gmail App Password 或類似），但 Resend 已有 WIP 程式碼故優先
- **Prod 部署 gotcha**：`RESEND_API_KEY` 寫 prod `.env` 後要 `pnpm build + pm2 restart chickimmiu-nextjs`，middleware/config 會 bake env
- **平行 session**：工作前 `git log --oneline -10` + `git fetch origin`
- **gh CLI** 路徑：`"/c/Program Files/GitHub CLI/gh.exe"`（bash）/ `.\gh.exe`（PowerShell）
- **R2 token rotation** 仍 pending（跟本次不相干但別忘）
- **CSP 缺口**：`connect.facebook.net` 不在 script-src/connect-src，若開 Meta Pixel env 會被擋（跟本次不相干）

## 相關文件

- `docs/ROADMAP.md` — 要勾 Phase 2
- `docs/oauth-payload-sync.md`（`feat/auth-hardening-v2` 上）— OAuth↔Payload sync plan + finish-it checklist
- `feedback_payload_cookie_bridge.md`（memory）— OAuth cookie 橋接 pattern（已落實）
- `src/auth.ts:162-169` — `getFieldsToSign + jwtSign` 寫 `payload-token` 的實作
- `src/migrations/20260417_100000_add_stored_value_balance.ts` — SQLite PRAGMA 冪等 migration 範本
