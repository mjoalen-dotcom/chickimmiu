/**
 * Batch 2（推薦註冊獎勵）驗證 — 乾淨 temp DB。
 *
 *   rm -f data/_b2.db*
 *   DATABASE_URI=file:./data/_b2.db NODE_OPTIONS=--no-deprecation yes y | \
 *     DATABASE_URI=file:./data/_b2.db NODE_OPTIONS=--no-deprecation pnpm exec payload migrate
 *   DATABASE_URI=file:./data/_b2.db NODE_OPTIONS=--no-deprecation pnpm exec payload run scripts/verify_batch2.ts
 *
 * 覆蓋 grantRegistrationReferralReward：立即發放（已驗證）/ email 驗證 defer→補發 /
 *       無推薦人 / 冪等 / adjustWallet 增量入帳（不覆蓋 signup 絕對值）。
 */
import { getPayload } from 'payload'
import config from '@payload-config'

import { grantRegistrationReferralReward } from '@/lib/referral/registrationReward'

const results: Array<{ name: string; ok: boolean; detail: string }> = []
function check(name: string, ok: boolean, detail = '') {
  results.push({ name, ok, detail })
  process.stdout.write(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}\n`)
}

let counter = 0
function uniqEmail(tag: string): string {
  counter += 1
  return `b2_${tag}_${Date.now()}_${counter}@test.local`
}

async function main() {
  const payload = await getPayload({ config })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = payload as any

  async function mkUser(
    tag: string,
    opts: { verified?: boolean; referredBy?: string | number; shoppingCredit?: number } = {},
  ): Promise<string | number> {
    const u = await p.create({
      collection: 'users',
      data: {
        email: uniqEmail(tag),
        password: 'Test12345!',
        name: `B2 ${tag}`,
        ...(opts.verified ? { _verified: true } : {}),
        ...(opts.referredBy !== undefined ? { referredBy: opts.referredBy } : {}),
        ...(opts.shoppingCredit !== undefined ? { shoppingCredit: opts.shoppingCredit } : {}),
      },
      disableVerificationEmail: true,
      overrideAccess: true,
    })
    return u.id as string | number
  }

  async function sc(id: string | number): Promise<number> {
    const u = await p.findByID({ collection: 'users', id, depth: 0 })
    return Number(u.shoppingCredit) || 0
  }
  async function flag(id: string | number): Promise<boolean> {
    const u = await p.findByID({ collection: 'users', id, depth: 0 })
    return u.registrationReferralRewarded === true
  }
  async function walletRows(id: string | number): Promise<number> {
    const r = await p.find({ collection: 'wallet-transactions', where: { user: { equals: id } }, limit: 0, overrideAccess: true })
    return r.totalDocs as number
  }

  // ── Test A: 已驗證 → 立即發放雙方 + adjustWallet 增量（不覆蓋 signup 100）──
  try {
    const referrer = await mkUser('refA', { verified: true, shoppingCredit: 0 })
    const referee = await mkUser('refeeA', { verified: true, referredBy: referrer, shoppingCredit: 100 })
    const res = await grantRegistrationReferralReward(payload, referee)
    check('A granted=true', res.granted === true, JSON.stringify(res))
    check('A referee 100→130 (+30 增量)', (await sc(referee)) === 130, `sc=${await sc(referee)}`)
    check('A referrer 0→50', (await sc(referrer)) === 50, `sc=${await sc(referrer)}`)
    check('A referee flag set', await flag(referee), '')
    check('A referee wallet ledger=1', (await walletRows(referee)) === 1, `rows=${await walletRows(referee)}`)
    // 冪等
    const res2 = await grantRegistrationReferralReward(payload, referee)
    check('A idempotent (already)', res2.granted === false && res2.reason === 'already', JSON.stringify(res2))
    check('A referee sc unchanged after re-run', (await sc(referee)) === 130, `sc=${await sc(referee)}`)
  } catch (e) {
    check('A suite', false, e instanceof Error ? e.message : String(e))
  }

  // ── Test B: 未驗證 → defer；驗證後補發 ──
  try {
    const referrer = await mkUser('refB', { verified: true, shoppingCredit: 0 })
    const referee = await mkUser('refeeB', { verified: false, referredBy: referrer, shoppingCredit: 0 })
    const res = await grantRegistrationReferralReward(payload, referee)
    check('B unverified deferred', res.granted === false && res.reason === 'awaiting_verification', JSON.stringify(res))
    check('B referee no award yet', (await sc(referee)) === 0 && !(await flag(referee)), `sc=${await sc(referee)} flag=${await flag(referee)}`)
    check('B referrer no award yet', (await sc(referrer)) === 0, `sc=${await sc(referrer)}`)
    // 驗證後補發（模擬登入時 afterLogin 觸發）
    await p.update({ collection: 'users', id: referee, data: { _verified: true }, overrideAccess: true })
    const res2 = await grantRegistrationReferralReward(payload, referee)
    check('B after verify granted', res2.granted === true, JSON.stringify(res2))
    check('B referee +30 after verify', (await sc(referee)) === 30, `sc=${await sc(referee)}`)
    check('B referrer +50 after verify', (await sc(referrer)) === 50, `sc=${await sc(referrer)}`)
  } catch (e) {
    check('B suite', false, e instanceof Error ? e.message : String(e))
  }

  // ── Test C: 無推薦人 → 不發 ──
  try {
    const solo = await mkUser('soloC', { verified: true })
    const res = await grantRegistrationReferralReward(payload, solo)
    check('C no referrer → not granted', res.granted === false && res.reason === 'no_referrer', JSON.stringify(res))
  } catch (e) {
    check('C suite', false, e instanceof Error ? e.message : String(e))
  }

  const passed = results.filter((r) => r.ok).length
  const failed = results.length - passed
  process.stdout.write(`\n=== Batch 2 verify: ${passed} PASS / ${failed} FAIL (of ${results.length}) ===\n`)
  if (failed > 0) process.exitCode = 1
}

await main()
