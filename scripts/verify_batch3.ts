/**
 * Batch 3（CRM 自動化旅程執行器）驗證 — 乾淨 temp DB。
 *
 *   rm -f data/_b3.db*
 *   DATABASE_URI=file:./data/_b3.db NODE_OPTIONS=--no-deprecation yes y | \
 *     DATABASE_URI=file:./data/_b3.db NODE_OPTIONS=--no-deprecation pnpm exec payload migrate
 *   DATABASE_URI=file:./data/_b3.db NODE_OPTIONS=--no-deprecation pnpm exec payload run scripts/verify_batch3.ts
 *
 * 覆蓋：add_tag / remove_tag / assign_coupon(UserRewards) / condition_check(halt|continue) /
 *       wait 持久化暫停 + resumeDueJourneys 續跑。
 */
import { getPayload } from 'payload'
import config from '@payload-config'

import { triggerJourney, resumeDueJourneys } from '@/lib/crm/automationEngine'

const results: Array<{ name: string; ok: boolean; detail: string }> = []
function check(name: string, ok: boolean, detail = '') {
  results.push({ name, ok, detail })
  process.stdout.write(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}\n`)
}

let counter = 0
function uniq(tag: string): string {
  counter += 1
  return `${tag}-${Date.now()}-${counter}`
}

async function main() {
  const payload = await getPayload({ config })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = payload as any

  async function mkUser(opts: { points?: number } = {}): Promise<string> {
    const u = await p.create({
      collection: 'users',
      data: { email: `${uniq('b3')}@test.local`, password: 'Test12345!', name: 'B3', ...(opts.points !== undefined ? { points: opts.points } : {}) },
      disableVerificationEmail: true,
      overrideAccess: true,
    })
    return String(u.id)
  }

  async function mkJourney(steps: Array<Record<string, unknown>>): Promise<string> {
    const slug = uniq('jny')
    await p.create({
      collection: 'automation-journeys',
      data: { name: slug, slug, isActive: true, triggerType: 'event', triggerEvent: 'user_registered', steps },
      overrideAccess: true,
    })
    return slug
  }

  async function tags(userId: string): Promise<string[]> {
    const u = await p.findByID({ collection: 'users', id: userId, depth: 0 })
    return (Array.isArray(u.tags) ? u.tags : []).map((t: { tag?: string }) => t?.tag).filter(Boolean)
  }

  async function latestLog(userId: string): Promise<Record<string, unknown> | undefined> {
    const r = await p.find({ collection: 'automation-logs', where: { user: { equals: userId } }, sort: '-createdAt', limit: 1, overrideAccess: true })
    return r.docs[0]
  }

  // ── Test 1: add_tag / remove_tag ──
  try {
    const user = await mkUser()
    const slug = await mkJourney([
      { stepOrder: 1, action: 'add_tag', delayMinutes: 0, content: 'VIP' },
      { stepOrder: 2, action: 'add_tag', delayMinutes: 0, content: '韓系愛好者' },
      { stepOrder: 3, action: 'remove_tag', delayMinutes: 0, content: 'VIP' },
    ])
    await triggerJourney(slug, { userId: user, event: 'test', data: {} })
    const t = await tags(user)
    check('add_tag+remove_tag → tags=[韓系愛好者]', t.length === 1 && t[0] === '韓系愛好者', `tags=${JSON.stringify(t)}`)
    const log = await latestLog(user)
    check('journey completed', log?.status === 'completed', `status=${log?.status}`)
  } catch (e) {
    check('add_tag/remove_tag suite', false, e instanceof Error ? e.message : String(e))
  }

  // ── Test 2: assign_coupon → UserRewards ──
  try {
    const user = await mkUser()
    const slug = await mkJourney([
      { stepOrder: 1, action: 'assign_coupon', delayMinutes: 0, templateKey: 'welcome', content: '{"displayName":"新客9折券","amount":100,"expiryDays":30}' },
    ])
    await triggerJourney(slug, { userId: user, event: 'test', data: {} })
    const r = await p.find({ collection: 'user-rewards', where: { user: { equals: user } }, limit: 10, overrideAccess: true })
    const reward = r.docs[0]
    check('assign_coupon → 1 user-reward', r.totalDocs === 1, `total=${r.totalDocs}`)
    check('reward displayName/type/state', reward?.displayName === '新客9折券' && reward?.rewardType === 'coupon' && reward?.state === 'unused', JSON.stringify({ d: reward?.displayName, t: reward?.rewardType, s: reward?.state }))
    check('reward couponCode set + amount 100', Boolean(reward?.couponCode) && reward?.amount === 100, `code=${reward?.couponCode} amount=${reward?.amount}`)
    check('reward requiresPhysicalShipping=false', reward?.requiresPhysicalShipping === false, `=${reward?.requiresPhysicalShipping}`)
  } catch (e) {
    check('assign_coupon suite', false, e instanceof Error ? e.message : String(e))
  }

  // ── Test 3a: condition_check TRUE → continue ──
  try {
    const user = await mkUser({ points: 200 })
    const slug = await mkJourney([
      { stepOrder: 1, action: 'condition_check', delayMinutes: 0, content: '{"field":"points","op":"gte","value":100}' },
      { stepOrder: 2, action: 'add_tag', delayMinutes: 0, content: 'qualified' },
    ])
    await triggerJourney(slug, { userId: user, event: 'test', data: {} })
    const t = await tags(user)
    check('condition TRUE → step2 runs (qualified)', t.includes('qualified'), `tags=${JSON.stringify(t)}`)
  } catch (e) {
    check('condition_check TRUE suite', false, e instanceof Error ? e.message : String(e))
  }

  // ── Test 3b: condition_check FALSE → halt ──
  try {
    const user = await mkUser({ points: 10 })
    const slug = await mkJourney([
      { stepOrder: 1, action: 'condition_check', delayMinutes: 0, content: '{"field":"points","op":"gte","value":100}' },
      { stepOrder: 2, action: 'add_tag', delayMinutes: 0, content: 'qualified' },
    ])
    await triggerJourney(slug, { userId: user, event: 'test', data: {} })
    const t = await tags(user)
    check('condition FALSE → step2 skipped (no tag)', !t.includes('qualified'), `tags=${JSON.stringify(t)}`)
    const log = await latestLog(user)
    const executed = Array.isArray(log?.executedSteps) ? (log!.executedSteps as Array<{ action: string }>) : []
    check('only condition_check executed (1 step)', executed.length === 1 && executed[0]?.action === 'condition_check', `executed=${JSON.stringify(executed.map((e) => e.action))}`)
  } catch (e) {
    check('condition_check FALSE suite', false, e instanceof Error ? e.message : String(e))
  }

  // ── Test 4: wait 持久化暫停 + resume ──
  try {
    const user = await mkUser()
    const slug = await mkJourney([
      { stepOrder: 1, action: 'add_tag', delayMinutes: 0, content: 'before' },
      { stepOrder: 2, action: 'wait', delayMinutes: 60, content: '' },
      { stepOrder: 3, action: 'add_tag', delayMinutes: 0, content: 'after' },
    ])
    await triggerJourney(slug, { userId: user, event: 'test', data: {} })
    const t1 = await tags(user)
    const log1 = await latestLog(user)
    check('wait → paused (status in_progress)', log1?.status === 'in_progress', `status=${log1?.status}`)
    check('wait → resumeAt set, currentStep=2', Boolean(log1?.resumeAt) && log1?.currentStep === 2, `resumeAt=${log1?.resumeAt} step=${log1?.currentStep}`)
    check('wait → "before" added, "after" not yet', t1.includes('before') && !t1.includes('after'), `tags=${JSON.stringify(t1)}`)

    // 模擬延遲到期：把 resumeAt 改到過去，跑 resumeDueJourneys
    await p.update({ collection: 'automation-logs', id: log1!.id, data: { resumeAt: new Date(Date.now() - 60_000).toISOString() }, overrideAccess: true })
    const res = await resumeDueJourneys()
    check('resumeDueJourneys resumed=1', res.resumed === 1, `resumed=${res.resumed} errors=${JSON.stringify(res.errors)}`)
    const t2 = await tags(user)
    const log2 = await latestLog(user)
    check('after resume → "after" added', t2.includes('after'), `tags=${JSON.stringify(t2)}`)
    check('after resume → status completed', log2?.status === 'completed', `status=${log2?.status}`)
  } catch (e) {
    check('wait/resume suite', false, e instanceof Error ? e.message : String(e))
  }

  const passed = results.filter((r) => r.ok).length
  const failed = results.length - passed
  process.stdout.write(`\n=== Batch 3 verify: ${passed} PASS / ${failed} FAIL (of ${results.length}) ===\n`)
  if (failed > 0) process.exitCode = 1
}

await main()
