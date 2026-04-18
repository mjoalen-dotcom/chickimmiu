# 07 — 安全強化（headers / upload 驗證 / admin）

## 目標
- `next.config.mjs` headers 補 HSTS / CSP / CORP / Permissions-Policy
- UGC 上傳 MIME 白名單 + size limit + path traversal 檢查
- `/admin` 加硬化提示（Cloudflare Access 或 BasicAuth middleware）+ 紀錄登入嘗試
- 驗證 Payload session cookie flags（httpOnly / secure / sameSite）

## ▼▼▼ 以下整段貼到新 session ▼▼▼

```
# 07 — Security Polish (headers + uploads + admin)

## Context
- CHIC KIM & MIU Next.js 15 + Payload v3
- 本機：`C:\Users\mjoal\ally-site\chickimmiu`

## Background
- `next.config.mjs:25-65` 目前有 X-Content-Type-Options / X-Frame-Options (SAMEORIGIN, DENY for /api) / X-XSS-Protection / Referrer-Policy — **缺 HSTS、CSP、COEP/COOP/CORP、Permissions-Policy**
- UGC (`src/collections/UGCPosts.ts`) 有 Media field — 預設 Payload 沒強制 MIME / size 限制
- `/admin` 是 Payload 預設，走 email+password 無 IP allowlist

## Your Task

### Task A: Security headers

讀 `next.config.mjs`，headers() 陣列加（保留現有）：
```js
{
  source: '/:path*',
  headers: [
    // 現有保留
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
    {
      key: 'Content-Security-Policy',
      value: [
        "default-src 'self'",
        "img-src 'self' data: https://shoplineimg.com https://*.r2.cloudflarestorage.com https://pre.chickimmiu.com",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googletagmanager.com https://www.google-analytics.com",  // Next 15 inline boot + GTM
        "style-src 'self' 'unsafe-inline'",  // Tailwind inline
        "connect-src 'self' https://www.google-analytics.com https://*.ecpay.com.tw https://sandbox-api-pay.line.me https://api-pay.line.me https://ccore.newebpay.com",
        "font-src 'self' data:",
        "frame-src https://*.ecpay.com.tw",  // ECPay 付款頁 iframe
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self' https://payment.ecpay.com.tw https://payment-stage.ecpay.com.tw",
        "upgrade-insecure-requests",
      ].join('; '),
    },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
    { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ],
},
```

CSP 是最容易出錯的——**一定要在本機 dev 測完**：
```
pnpm build && pnpm start -p 3006
# 開 browser devtools → Console 看 CSP violation
# 首頁 / PDP / checkout（ECPay 如果跑完組 03 就會 iframe）/ login 都掃一遍
```
遇到 violation：只補 CSP 必要 source，**不要**一律 `unsafe-inline` 所有指令。

### Task B: UGC upload 驗證

讀 `src/collections/UGCPosts.ts`。Media 相關欄位通常走 `relationTo: 'media'` 或 `type: 'upload'`。要補：
1. 在 Media collection (`src/collections/Media.ts`) 的 `upload` config 加：
   ```ts
   upload: {
     staticDir: '...',
     mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
     // Payload v3 不直接支援 maxFileSize，用 hook 擋
   },
   hooks: {
     beforeChange: [async ({ data, operation, req }) => {
       // 若 req.file 存在 → 擋大小 + MIME 白名單
       const f = req.file
       if (f) {
         const MAX = 8 * 1024 * 1024  // 8MB
         if (f.size > MAX) throw new Error('檔案過大（上限 8MB）')
         const allow = /^image\/(jpeg|png|webp|gif)$/
         if (!allow.test(f.mimetype)) throw new Error('不支援的檔案格式')
         // path traversal：filename 禁 .. 與 /
         if (/[\/\\]|\.\./.test(f.name)) throw new Error('非法檔名')
       }
       return data
     }],
   },
   ```
2. UGC form 端（`UGCPosts` 使用者上傳介面）的 client 端也加 size/MIME preview 檢查（雙重防線）

### Task C: /admin IP allowlist via middleware

若組 02 已建 `src/middleware.ts`（rate-limit），在**同一檔**加 admin gate；若組 02 沒 merge，自己建。

兩種做法擇一（使用者決定）：
- **Cloudflare Access**（推薦，免寫 code）：寫 `docs/admin-cloudflare-access.md` 步驟讓使用者在 Cloudflare Zero Trust 設 Application，policy = email allowlist
- **BasicAuth middleware**（程式內）：
  ```ts
  if (req.nextUrl.pathname.startsWith('/admin')) {
    const auth = req.headers.get('authorization')
    const expected = 'Basic ' + Buffer.from(`${process.env.ADMIN_BASIC_USER}:${process.env.ADMIN_BASIC_PW}`).toString('base64')
    if (!auth || auth !== expected) {
      return new NextResponse('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': 'Basic' } })
    }
  }
  ```
  這會**雙重驗證**：先 Basic 再 Payload 本身。封測期適合。

### Task D: Payload session cookie flags 驗證

讀 `src/collections/Users.ts` auth config。確認：
```ts
auth: {
  cookies: {
    domain: process.env.NODE_ENV === 'production' ? '.chickimmiu.com' : undefined,
    sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production',
  },
  tokenExpiration: 60 * 60 * 24 * 7,  // 7d
  // ...
}
```
若已有但 flags 不對就修。`httpOnly` 是 Payload 預設強制 true，不可關閉。

### Task E: 記錄登入嘗試
新建 `src/collections/LoginAttempts.ts`：email / ip / success / timestamp / userAgent。Users auth `afterLogin` hook create 一筆。admin 可查。

Payload auth 已有 `maxLoginAttempts` + `lockTime`；確認 Users.ts 設了（若沒，加 `auth.maxLoginAttempts: 10, lockTime: 600000` 10 分鐘鎖）。

### Task F: 驗證 + push

```
pnpm tsc --noEmit
pnpm build && pnpm start -p 3006
# 用 curl 驗 headers：
curl -sI http://localhost:3006/ | grep -iE "strict-transport|content-security|permissions-policy|cross-origin"
# 應全出現
# 再用 browser 開 localhost:3006/ /products /products/<slug> /login，devtools Console 不該有 CSP violation
# 測 admin gate（若選 BasicAuth）：
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3006/admin   # 應 401
curl -s -o /dev/null -w "%{http_code}\n" -u user:pw http://localhost:3006/admin   # 應 200 / 302 到 login
```

commit：
```
git checkout -b chore/security-polish
git add next.config.mjs src/collections/Media.ts src/collections/UGCPosts.ts src/collections/Users.ts src/collections/LoginAttempts.ts src/middleware.ts docs/admin-cloudflare-access.md .env.example
git commit -m "$(cat <<'EOF'
chore(security): CSP/HSTS/Permissions-Policy + UGC upload validation + admin gate

- next.config.mjs: HSTS preload-ready, CSP (locked to known origins),
  Permissions-Policy, COOP/CORP
- Media upload: MIME whitelist (jpeg/png/webp/gif), 8MB cap, path-traversal check
- Users auth: maxLoginAttempts=10, lockTime=10min, session cookie flags verified
  (httpOnly, secure in prod, sameSite=Lax)
- LoginAttempts collection logs every auth attempt for incident review
- /admin gate: BasicAuth middleware OR Cloudflare Access (doc'd, user chooses)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin chore/security-polish
```

## Prod Deploy
```
cd /var/www/chickimmiu && git pull && pnpm install --frozen-lockfile && pnpm build && pm2 restart chickimmiu-nextjs
# 新 env（若選 BasicAuth admin gate）：
# ADMIN_BASIC_USER=...
# ADMIN_BASIC_PW=...
# smoke：
curl -sI https://pre.chickimmiu.com/ | grep -iE "strict-transport|content-security"
curl -s -o /dev/null -w "%{http_code}\n" https://pre.chickimmiu.com/admin   # 若選 BasicAuth 應 401
```
**CSP regression 風險**：若 prod 用到其他第三方（Meta Pixel / GA / LINE Tag / 客服 widget 等），CSP 可能擋掉。部署後使用者 30 min 內監控：
- 在各頁 Devtools Console 掃 `Refused to load` / `violates Content Security Policy`
- 有 violation 就回 patch CSP 加對應 host

## Guardrails
- 不碰：`src/seed/**`、`src/app/(frontend)/account/**`、`Orders.ts/cartStore.ts`、`contact/size-guide/shipping/returns/`、`recommendationEngine.ts`、cron endpoints
- **可碰** `next.config.mjs` headers、Media.ts uploads、Users.ts auth、middleware.ts admin gate 區塊
- 若 middleware.ts 與組 02 合併衝突：以先 merge 者為主，後到者 rebase 手解
- **絕對不要** `script-src *` 或 `default-src *`——寧可 patch 特定 host
- 不用 force push
```

---
