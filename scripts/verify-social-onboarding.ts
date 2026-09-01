/**
 * 驗證：新會員上線流程三條路徑一致（App 團隊 2026-08-27 回報案）
 * ═══════════════════════════════════════════════════════════
 *   1. 社群註冊（新帳號）→ 綁推薦人 + 發註冊禮       ← 原本缺的就是這個
 *   2. 冪等：重複呼叫不重複發點數、不重複開 welcome 帳列
 *   3. 既有會員首次綁社群（created=false 情境）→ 誤呼叫也不得洗掉既有餘額
 *   4. 推薦碼查無 / 自我推薦 → 不綁、不炸
 *   5. linkOrCreateSocialUser 的 created 旗標語意正確
 *      （新社群帳號=true；同一 socialId 回訪=false；既有 email 會員首次綁=false）
 *
 * 跑法（本地 fresh SQLite verify DB，兩段式見 memory）：
 *   rm -f ./data/verify-onboarding.db
 *   NODE_ENV=production DATABASE_URI="file:./data/verify-onboarding.db" pnpm payload migrate
 *   NODE_ENV=production DATABASE_URI="file:./data/verify-onboarding.db" pnpm payload run scripts/dev-sync-sqlite-schema.ts
 *   RESEND_API_KEY= NODE_ENV=production DATABASE_URI="file:./data/verify-onboarding.db" pnpm payload run scripts/verify-social-onboarding.ts
 *
 * 也可直接對 prod PG 跑（會建測試帳號並自行清掉）。
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { randomUUID } from 'node:crypto'

import { onboardNewCustomer } from '../src/lib/auth/newCustomerOnboarding'
import { linkOrCreateSocialUser } from '../src/lib/auth/socialIdentity'

type Loose = Record<string, unknown>

let failures = 0
const pass = (label: string) => console.log(`  ✅ ${label}`)
const fail = (label: string, detail?: unknown) => {
  console.log(`  ❌ ${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''}`)
  failures++
}
const expect = (cond: boolean, label: string, detail?: unknown) =>
  cond ? pass(label) : fail(label, detail)

const payload = await getPayload({ config })
const create = payload.create.bind(payload) as unknown as (a: Loose) => Promise<Loose>
const findByID = payload.findByID.bind(payload) as unknown as (a: Loose) => Promise<Loose>
const del = payload.delete.bind(payload) as unknown as (a: Loose) => Promise<unknown>

// 本地 SQLite verify DB 的凍結 migration 鏈裡，points_transactions / wallet_transactions
// 的 FK 仍指向 users 表（customers 是 dev-sync 補建的）。比照正式搬移的 ID 保留策略，
// 每建一個 customer 就先建一筆同序的 users 影子列，FK 才過得去。PG（prod）不需要，
// 多建的影子列無害。
const isSqlite = (process.env.DATABASE_URI || '').startsWith('file:')
const created: Array<string | number> = []
const mkCustomer = async (extra: Loose = {}): Promise<Loose> => {
  if (isSqlite) {
    await create({
      collection: 'users',
      data: {
        email: `shadow-${randomUUID()}@test.chickimmiu.com`,
        password: randomUUID(),
        name: 'shadow',
        role: 'customer',
        _verified: true,
      },
      disableVerificationEmail: true,
      overrideAccess: true,
    }).catch(() => undefined)
  }
  const doc = await create({
    collection: 'customers',
    data: {
      email: `onboard-${randomUUID()}@test.chickimmiu.com`,
      password: randomUUID(),
      name: '上線流程測試',
      _verified: true,
      ...extra,
    },
    disableVerificationEmail: true,
    overrideAccess: true,
  })
  created.push(doc.id as string | number)
  return doc
}

const pointsOf = async (id: string | number) =>
  Number(((await findByID({ collection: 'customers', id, depth: 0 })) as Loose).points ?? 0)

const welcomeTxnCount = async (id: string | number) => {
  const r = await payload.count({
    collection: 'points-transactions',
    where: { and: [{ user: { equals: id } }, { source: { equals: 'welcome' } }] } as never,
    overrideAccess: true,
  })
  return r.totalDocs
}

async function main() {
  // 讀後台實際設定（不寫死 100，避免與營運參數脫節）
  const loyalty = (await payload.findGlobal({ slug: 'loyalty-settings', depth: 0 })) as unknown as Loose
  const sr = (loyalty.signupReward as Loose) || {}
  const expectPoints = sr.enabled === false ? 0 : Math.max(0, Math.floor(Number(sr.points ?? 0)))
  console.log(`後台 signupReward：enabled=${sr.enabled} points=${sr.points} → 預期發 ${expectPoints} 點\n`)

  // 推薦人（拿他的 referralCode 當邀請碼）
  const referrer = await mkCustomer({ name: '推薦人' })
  const referrerDoc = (await findByID({
    collection: 'customers',
    id: referrer.id as string | number,
    depth: 0,
  })) as Loose
  const refCode = String(referrerDoc.referralCode || '')
  console.log(`[前置] 推薦人 id=${referrer.id} referralCode=${refCode || '(無)'}\n`)

  console.log('[1] 社群註冊新帳號 → 綁推薦人 + 發註冊禮')
  {
    const u = await mkCustomer({ name: '社群新會員' })
    const r = await onboardNewCustomer(payload, { userId: u.id as string | number, referralCode: refCode })
    const doc = (await findByID({ collection: 'customers', id: u.id as string | number, depth: 0 })) as Loose
    const boundId = typeof doc.referredBy === 'object' && doc.referredBy !== null
      ? (doc.referredBy as Loose).id
      : doc.referredBy
    expect(String(boundId) === String(referrer.id), 'referredBy 綁到推薦人', { boundId, notes: r.notes })
    expect((await pointsOf(u.id as string | number)) === expectPoints, `點數 = ${expectPoints}`, await pointsOf(u.id as string | number))
    expect((await welcomeTxnCount(u.id as string | number)) === (expectPoints > 0 ? 1 : 0), 'welcome 帳列 1 筆')
  }

  console.log('\n[2] 冪等：同一人重複跑 onboarding')
  {
    const u = await mkCustomer()
    await onboardNewCustomer(payload, { userId: u.id as string | number, referralCode: refCode })
    await onboardNewCustomer(payload, { userId: u.id as string | number, referralCode: refCode })
    expect((await pointsOf(u.id as string | number)) === expectPoints, `點數仍為 ${expectPoints}（沒發兩次）`, await pointsOf(u.id as string | number))
    expect((await welcomeTxnCount(u.id as string | number)) === (expectPoints > 0 ? 1 : 0), 'welcome 帳列仍 1 筆')
  }

  console.log('\n[3] 既有會員（已有餘額）誤呼叫 → 餘額不被洗掉')
  {
    const u = await mkCustomer({ points: 777 })
    await onboardNewCustomer(payload, { userId: u.id as string | number, referralCode: refCode })
    const after = await pointsOf(u.id as string | number)
    expect(after === 777 + expectPoints, `點數為增量 777+${expectPoints}=${777 + expectPoints}，不是被覆寫成 ${expectPoints}`, after)
  }

  console.log('\n[4] 推薦碼查無 / 自我推薦')
  {
    const u = await mkCustomer()
    const r1 = await onboardNewCustomer(payload, { userId: u.id as string | number, referralCode: 'NOSUCHCODE123' })
    expect(r1.referredBy === undefined, '查無推薦碼 → 不綁定、不擋註冊', r1.notes)
    expect((await pointsOf(u.id as string | number)) === expectPoints, '註冊禮照常發放')

    const selfDoc = (await findByID({ collection: 'customers', id: u.id as string | number, depth: 0 })) as Loose
    const selfCode = String(selfDoc.referralCode || '')
    const u2 = await mkCustomer()
    if (selfCode) {
      // 用自己的碼推薦自己
      const r2 = await onboardNewCustomer(payload, {
        userId: u2.id as string | number,
        referralCode: String(((await findByID({ collection: 'customers', id: u2.id as string | number, depth: 0 })) as Loose).referralCode || ''),
      })
      expect(r2.referredBy === undefined, '自我推薦 → 不綁定', r2.notes)
    }
  }

  console.log('\n[5] linkOrCreateSocialUser 的 created 旗標語意')
  {
    const sub = `apple-sub-${randomUUID()}`
    const first = await linkOrCreateSocialUser({ provider: 'apple', providerAccountId: sub, email: null, name: 'Apple 新用戶' })
    expect(first?.created === true, '全新社群帳號 → created=true')
    if (first) created.push(first.user.id)

    const again = await linkOrCreateSocialUser({ provider: 'apple', providerAccountId: sub, email: null })
    expect(again?.created === false, '同一 socialId 回訪 → created=false')
    expect(String(again?.user.id) === String(first?.user.id), '回訪對到同一個會員')

    // 既有 email 會員第一次改用 Google 登入 → 不是新註冊
    const existing = await mkCustomer({ points: 500 })
    const existingEmail = String(((await findByID({ collection: 'customers', id: existing.id as string | number, depth: 0 })) as Loose).email)
    const linkExisting = await linkOrCreateSocialUser({
      provider: 'google',
      providerAccountId: `google-sub-${randomUUID()}`,
      email: existingEmail,
      name: 'x',
    })
    expect(linkExisting?.created === false, '既有 email 會員首次綁社群 → created=false（不會誤發註冊禮）')
    expect(String(linkExisting?.user.id) === String(existing.id), '綁到既有會員本人')
    expect((await pointsOf(existing.id as string | number)) === 500, '既有會員點數未受影響')
  }

  console.log('\n[6] 軟刪除會員再次社群登入 → 自動復原原帳號（Alan 2026-09-01 拍板）')
  {
    const sub = `apple-restore-${randomUUID()}`
    const link1 = await linkOrCreateSocialUser({ provider: 'apple', providerAccountId: sub, email: null, name: '待復原會員' })
    const uid = link1!.user.id
    created.push(uid)
    // 給他一些餘額，驗證復原後資產仍在
    await (payload.update as unknown as (a: Loose) => Promise<Loose>)({
      collection: 'customers', id: uid, data: { points: 456 }, overrideAccess: true,
    })
    // 軟刪除（等同 admin 在後台刪除：Payload 對 trash 集合是寫 deletedAt，
    // 不是 payload.delete —— 後者一律永久刪除）
    await (payload.update as unknown as (a: Loose) => Promise<Loose>)({
      collection: 'customers',
      id: uid,
      data: { deletedAt: new Date().toISOString() },
      overrideAccess: true,
    })
    const gone = await payload.find({ collection: 'customers', where: { id: { equals: uid } }, limit: 1, overrideAccess: true })
    expect(gone.docs.length === 0, '軟刪除後一般查詢已查不到')

    const link2 = await linkOrCreateSocialUser({ provider: 'apple', providerAccountId: sub, email: null })
    expect(link2 !== null, '再次登入沒有 throw（舊行為會撞 email 唯一索引）')
    expect(String(link2?.user.id) === String(uid), '復原的是同一個帳號（不是開新帳）', { was: uid, now: link2?.user.id })
    expect(link2?.created === false, 'created=false（復原不是新註冊 → 不會再發一次註冊禮）')
    const back = (await findByID({ collection: 'customers', id: uid, depth: 0 })) as Loose
    expect(!back.deletedAt, 'deletedAt 已清空（帳號回到啟用狀態）', back.deletedAt)
    expect(Number(back.points) === 456, '原有點數保留', back.points)
  }

  // 清理
  console.log('')
  for (const id of created) {
    await del({ collection: 'customers', id, overrideAccess: true }).catch(() => {})
  }
  console.log(`已清理 ${created.length} 個測試帳號（customers 為 soft-delete，會留在已刪除清單）`)

  if (failures === 0) {
    console.log('\n🎉 全部 pass')
    process.exit(0)
  } else {
    console.log(`\n❌ ${failures} 個 assertion 失敗`)
    process.exit(1)
  }
}

await main()
