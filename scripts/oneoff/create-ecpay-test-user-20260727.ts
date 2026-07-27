import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * ECPay E2E 驗收用測試會員（冪等 upsert by email）— 2026-07-27
 * ─────────────────────────────────────────────
 * 建立 / 重設一個已驗證（_verified）的一般會員帳號，供 pre. 站
 * 全流程刷卡驗收（登入 → 結帳 → 綠界 sandbox → callback 回填 paid）。
 *
 * 用法（env 帶憑證，不寫死在 repo）：
 *   TEST_USER_EMAIL=... TEST_USER_PASSWORD=... pnpm payload run scripts/oneoff/create-ecpay-test-user-20260727.ts
 */
const email = process.env.TEST_USER_EMAIL
const password = process.env.TEST_USER_PASSWORD

if (!email || !password) {
  console.error('缺 TEST_USER_EMAIL / TEST_USER_PASSWORD env，中止')
  process.exit(1)
}

async function main() {
  const payload = await getPayload({ config })

  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (existing.docs.length > 0) {
    const u = existing.docs[0] as unknown as { id: string | number; points?: number }
    await payload.update({
      collection: 'users',
      id: u.id,
      data: { password, _verified: true } as never,
      overrideAccess: true,
    })
    console.log(`[test-user] 既有帳號重設密碼 + _verified：id=${u.id} points=${u.points ?? 0}`)
  } else {
    const created = await payload.create({
      collection: 'users',
      data: {
        email,
        password,
        name: 'ECPay 驗收測試',
        role: 'customer',
        _verified: true,
      } as never,
      overrideAccess: true,
      disableVerificationEmail: true,
    })
    console.log(`[test-user] 已建立：id=${(created as unknown as { id: string | number }).id}`)
  }
  console.log('[done] create-ecpay-test-user 完成')
}

await main()
process.exit(0)
