#!/usr/bin/env node
/**
 * Apple「Sign in with Apple」client secret（ES256 JWT）產生器
 * ─────────────────────────────────────────────────────────
 * Apple 的 OAuth client secret 不是固定字串，而是拿 Apple Developer 後台下載的
 * .p8 私鑰簽出來的 JWT，**exp 最長 15777000 秒（約 180 天）**，過期後社群登入
 * 整條斷掉 —— 所以 prod 要配 cron 定期重簽（見 setup-social-oauth-prod.sh）。
 *
 * 用法：
 *   node scripts/generate-apple-client-secret.mjs \
 *     --key AuthKey_ABC123DEFG.p8 \        # Apple 後台下載的私鑰（只能下載一次）
 *     --team-id 1A2B3C4D5E \               # Membership 頁的 Team ID（10 碼）
 *     --client-id com.chickimmiu.web \     # Services ID（不是 App ID）
 *     --key-id ABC123DEFG \                # 金鑰的 Key ID（10 碼）
 *     [--days 170] \                       # 有效天數，上限 180，預設 170
 *     [--write-env /var/www/chickimmiu/.env]  # 直接更新 .env 的 AUTH_APPLE_SECRET
 *
 * 純 Node 內建 crypto，無任何依賴（pnpm 不 hoist，別 import 'jose'）。
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs'
import { createPrivateKey, sign } from 'node:crypto'

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : undefined
}

const keyPath = arg('key')
const teamId = arg('team-id')
const clientId = arg('client-id')
const keyId = arg('key-id')
const days = Number(arg('days') || 170)
const writeEnv = arg('write-env')

const fail = (msg) => {
  console.error(`❌ ${msg}`)
  process.exit(1)
}

if (!keyPath || !teamId || !clientId || !keyId) {
  fail('缺參數。必填：--key <p8檔> --team-id <10碼> --client-id <ServicesID> --key-id <10碼>')
}
if (!existsSync(keyPath)) fail(`找不到金鑰檔：${keyPath}`)
if (!/^[A-Z0-9]{10}$/i.test(teamId)) fail(`Team ID 格式不對（應為 10 碼英數）：${teamId}`)
if (!/^[A-Z0-9]{10}$/i.test(keyId)) fail(`Key ID 格式不對（應為 10 碼英數）：${keyId}`)
if (!(days > 0 && days <= 180)) fail(`--days 必須在 1~180 之間（Apple 上限 15777000 秒）：${days}`)

const pem = readFileSync(keyPath, 'utf8')
if (!pem.includes('PRIVATE KEY')) fail(`${keyPath} 不像 .p8 私鑰（沒有 PRIVATE KEY 區塊）`)

const b64url = (input) =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const now = Math.floor(Date.now() / 1000)
const header = b64url(JSON.stringify({ alg: 'ES256', kid: keyId }))
const payload = b64url(
  JSON.stringify({
    iss: teamId,
    iat: now,
    exp: now + days * 86400,
    aud: 'https://appleid.apple.com',
    sub: clientId,
  }),
)
const signingInput = `${header}.${payload}`
// JWT 的 ES256 簽章要 raw (r‖s) 64 bytes，不是 DER —— dsaEncoding 必須 ieee-p1363
const signature = sign('sha256', Buffer.from(signingInput), {
  key: createPrivateKey(pem),
  dsaEncoding: 'ieee-p1363',
})
const jwt = `${signingInput}.${b64url(signature)}`

const expDate = new Date((now + days * 86400) * 1000).toISOString().slice(0, 10)

if (writeEnv) {
  if (!existsSync(writeEnv)) fail(`--write-env 指定的檔案不存在：${writeEnv}`)
  copyFileSync(writeEnv, `${writeEnv}.bak-applesecret-${new Date().toISOString().replace(/[:.]/g, '-')}`)
  const lines = readFileSync(writeEnv, 'utf8').split('\n')
  const idx = lines.findIndex((l) => l.startsWith('AUTH_APPLE_SECRET='))
  if (idx > -1) lines[idx] = `AUTH_APPLE_SECRET=${jwt}`
  else lines.push(`AUTH_APPLE_SECRET=${jwt}`)
  writeFileSync(writeEnv, lines.join('\n'))
  console.log(`✅ 已更新 ${writeEnv} 的 AUTH_APPLE_SECRET（效期至 ${expDate}，舊檔已備份）`)
  console.log('   記得 pm2 restart chickimmiu-nextjs --update-env 讓新 secret 生效')
} else {
  console.log(jwt)
  console.error(`（效期至 ${expDate}；把上面整串填進 AUTH_APPLE_SECRET）`)
}
