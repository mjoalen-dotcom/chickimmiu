# 02 — 會員認證強化

## 目標
- 登出按鈕真的能登出
- 忘記密碼真的能收到 email（裝 Resend adapter）
- /api/users/login + /api/users/forgot-password 加 rate-limit
- OAuth 登入後同步 Payload session（不然 OAuth 使用者進 /account 被踢回 /login）
- 把工作樹 PR#2（member pages 已接真資料的 6 檔）commit 掉

## 前置
- Wave 1（組 01）必須先 merge（改了 seed，避免合併衝突）

## ▼▼▼ 以下整段貼到新 session ▼▼▼

```
# 02 — Auth Hardening + PR#2 commit

## Context
- 專案：CHIC KIM & MIU Next.js 15 + Payload v3（見 README.md / CLAUDE.md）
- 本機路徑：`C:\Users\mjoal\ally-site\chickimmiu`
- 開始前跑 `git log --oneline -10` 確認最新，沒看到 `fix/prod-media-secrets` 合併到 main 則先等

## Background
- commit `bd1f5c0` 已接了 `/login` / `/register` / `/forgot-password` / `/reset-password` 走 Payload REST
- **src/auth.ts** 設了 NextAuth 但沒 CredentialsProvider；只做 OAuth
- **工作樹未 commit**：6 檔 M + 3 檔新 Client（`git status`），PR#2 — member pages 已接真資料，其中：
  - `src/app/(frontend)/account/layout.tsx:34` 已加 `if (!user) redirect('/login?redirect=/account')` auth gate
  - `src/app/(frontend)/account/layout.tsx:53-59` 登出 button **無 onClick**（壞掉）
- `/api/users/forgot-password` 有回應但 Payload 無 email adapter，token 目前只 log 到 systemd journal
- OAuth callback 不會 set `payload-token` cookie → OAuth 使用者進 `/account/**` 會被踢回 `/login`

## Your Task — 6 個 Task

### Task A: 先 commit PR#2 工作樹
```
git fetch origin
git checkout main
git pull --ff-only origin main
git checkout -b feat/auth-hardening
# 不要用 main 裡的 WIP，要從乾淨 main 起；但工作樹的檔案要搬過來
# 比較好的做法：先 stash WIP，checkout main pull，再 pop，再開新 branch
```
實際順序：
```
git stash push -u -m "pr2-wip"
git checkout main && git pull --ff-only origin main
git checkout -b feat/auth-hardening
git stash pop
```

驗證 PR#2 檔案內容正確（各 page 都接 Payload 真資料、不是 demo）：
- `src/app/(frontend)/account/page.tsx` 應該 `await payload.auth({ headers })` + `payload.find` 抓真實點數/階級
- `src/app/(frontend)/account/orders/page.tsx` + `OrdersClient.tsx` 應該抓 Orders where user.id = 當前
- `src/app/(frontend)/account/addresses/page.tsx` + `AddressesClient.tsx` 應該讀 user.addresses JSON array，PATCH `/api/users/{id}`
- `src/app/(frontend)/account/settings/page.tsx` + `SettingsClient.tsx` 應可更新 name/phone/birthday

若任何頁面**還在 hardcode demo 資料**，先補成真資料再 commit。

### Task B: 登出按鈕 + endpoint

建立 `src/endpoints/customerLogout.ts`：
```ts
import type { Endpoint } from 'payload'

export const customerLogoutEndpoint: Endpoint = {
  path: '/users/logout',
  method: 'post',
  handler: async (req) => {
    const res = Response.json({ ok: true })
    // clear the payload-token cookie
    res.headers.set('Set-Cookie', 'payload-token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax' + (process.env.NODE_ENV === 'production' ? '; Secure' : ''))
    return res
  },
}
```

註冊到 payload.config：`endpoints: [...existing, customerLogoutEndpoint]`

把 `src/app/(frontend)/account/layout.tsx` 的 `<button>` 改成 Client Component（抽到 `LogoutButton.tsx`）：
```tsx
'use client'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
export function LogoutButton() {
  const router = useRouter()
  async function onLogout() {
    await fetch('/api/users/logout', { method: 'POST', credentials: 'include' })
    router.push('/login')
    router.refresh()
  }
  return <button onClick={onLogout} type="button" className="...">...</button>
}
```

### Task C: Email Adapter (Resend)
```
pnpm add @payloadcms/email-resend
```
改 `src/payload.config.ts`：
```ts
import { resendAdapter } from '@payloadcms/email-resend'
// ...
email: resendAdapter({
  defaultFromAddress: process.env.EMAIL_FROM_ADDRESS ?? 'no-reply@chickimmiu.com',
  defaultFromName: 'CHIC KIM & MIU',
  apiKey: process.env.RESEND_API_KEY ?? '',
}),
```

若 `RESEND_API_KEY` 沒設，`forgotPassword` 發送會失敗——這是對的，避免 silent success。

`.env.example` 加：
```
RESEND_API_KEY=re_xxxxxxxx
EMAIL_FROM_ADDRESS=no-reply@chickimmiu.com
```

更新 `src/app/(frontend)/forgot-password/page.tsx` 裡提到「封測期客服可從 server log 撈 token」的註解，改成「Resend adapter 已裝，正式環境需設 RESEND_API_KEY」。

### Task D: Rate-Limit

新建 `src/lib/rateLimit.ts`，用 in-memory Map（簡單、SQLite 單 process 可接受；之後可換 Redis）：
```ts
const hits = new Map<string, { count: number; resetAt: number }>()
export function check(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const r = hits.get(key)
  if (!r || r.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: limit - 1 }
  }
  if (r.count >= limit) return { ok: false, remaining: 0, retryAfter: Math.ceil((r.resetAt - now) / 1000) }
  r.count++
  return { ok: true, remaining: limit - r.count }
}
```

建 `src/middleware.ts` 對 auth endpoint 套 rate-limit：
```ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { check } from './lib/rateLimit'
export function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
  if (p === '/api/users/login') {
    const r = check(`login:${ip}`, 5, 60_000)
    if (!r.ok) return new NextResponse('Too Many Requests', { status: 429 })
  }
  if (p === '/api/users/forgot-password') {
    const r = check(`forgot:${ip}`, 3, 60_000)
    if (!r.ok) return new NextResponse('Too Many Requests', { status: 429 })
  }
  return NextResponse.next()
}
export const config = { matcher: ['/api/users/:path*'] }
```

### Task E: OAuth → Payload session sync

讀 `src/auth.ts`，在 NextAuth `signIn` callback 裡（使用者 OAuth 驗證通過後），手動做一次 Payload login 取得 `payload-token` cookie。做法：OAuth 使用者首次登入後，在 `signIn` callback 內：
1. `payload.find({ collection: 'users', where: { email: { equals: user.email } } })` 找使用者
2. 若無 → `payload.create` 建一個，password 隨機（用 `crypto.randomUUID()`，OAuth 者不用密碼）
3. `payload.login({ collection: 'users', data: { email, password: randomPw } })` 會吐 token
4. 把 token set 到 response cookie（NextAuth 的 callback 無法直接 set cookie，需改走 `src/app/api/auth/[...nextauth]/route.ts` wrapper）

若這部分太複雜，產出 `docs/oauth-payload-sync.md` 說明「本 task 未完成、留到下 session」，並在 OAuth callback 明確 redirect `/login?oauth=unfinished&msg=請用 email/pw 登入`。勿偽裝成完成。

### Task F: 驗證 + push
```
pnpm tsc --noEmit   # 0 err
PAYLOAD_SECRET=dummy DATABASE_URI=file:./data/chickimmiu.db pnpm build
# 本機 dev 跑一下
pnpm dev -p 3002
# curl 測 login rate-limit：6 次打 /api/users/login 應在第 6 次拿 429
for i in {1..6}; do curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3002/api/users/login -d '{"email":"x","password":"y"}' -H "content-type: application/json"; done
# 期待 400 400 400 400 400 429 之類（400 因 body 格式，429 是 rate limit）
```

commit：
```
git add src/endpoints/customerLogout.ts src/app/\(frontend\)/account/layout.tsx src/app/\(frontend\)/account/LogoutButton.tsx src/payload.config.ts .env.example src/lib/rateLimit.ts src/middleware.ts src/app/\(frontend\)/account/page.tsx src/app/\(frontend\)/account/orders/ src/app/\(frontend\)/account/addresses/ src/app/\(frontend\)/account/settings/
git commit -m "$(cat <<'EOF'
feat(auth): logout endpoint, Resend email, rate-limit, OAuth sync + commit PR#2 member pages

- Payload logout endpoint clears payload-token cookie
- Account layout logout button wired via client island
- @payloadcms/email-resend adapter for forgot-password emails
- Middleware rate-limits /api/users/login (5/min) and /api/users/forgot-password (3/min)
- PR#2 member pages (orders/addresses/settings) now read real user data
- (OAuth->Payload session sync status documented; partial)

ISSUE-001 ISSUE-002 ISSUE-003 ISSUE-004 ISSUE-005 ISSUE-006 ISSUE-007 ISSUE-008

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin feat/auth-hardening
```

## Verification Checklist
- [ ] `pnpm tsc --noEmit` 0 err
- [ ] `pnpm build` 成功
- [ ] 本機 dev 登入 → 點登出 → 回 /login + 再打 /account 被踢回 /login（cookie 已清）
- [ ] 打 6 次 /api/users/login 第 6 次 429
- [ ] 打 /api/users/forgot-password 4 次第 4 次 429
- [ ] `RESEND_API_KEY` 沒設時，送忘記密碼會 500（期望行為）；設了且設 `EMAIL_FROM_ADDRESS` 後真的收到信
- [ ] PR#2 6 檔的 demo 資料全清，都接 Payload 真資料

## Prod Deploy note
使用者 SSH 後在 prod 做：
```
cd /var/www/chickimmiu && git pull origin feat/auth-hardening   # 或等 merge 後 git pull origin main
pnpm install --frozen-lockfile
pnpm build
pm2 restart chickimmiu-nextjs
```
**新 env**：`RESEND_API_KEY` 需在 `/var/www/chickimmiu/.env` 加，否則 forgot-password 會 500。

## Guardrails
- 不碰：`src/seed/**`（組 01）、`src/collections/Orders.ts` `src/stores/cartStore.ts`（組 03）、`src/app/(frontend)/{contact,size-guide,shipping,returns}/`（組 04）、`src/lib/recommendationEngine.ts`（組 05）、`next.config.mjs` headers（組 07）
- 不用 `git push --force`
- 不跳 pre-commit hook
- 若 Task E（OAuth sync）做不完，明確 documented，不要假裝做完
```

---
