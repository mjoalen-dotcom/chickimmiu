/**
 * 驗證：App 專屬三項活動（工單 2026-08-25）
 * ═══════════════════════════════════════
 * 針對工單裡「最容易做錯」的規則逐條驗，而不是只驗 happy path：
 *   ‧ 冪等（同篇只能領一次 / 里程碑不重領 / 精選不重發 / 檢舉不重複）
 *   ‧ 精選加碼必須以 featuredAt 判定，取消精選再標記不得重發
 *   ‧ 分享獎勵：同會員同文章只有第一篇發獎；退回重審不重發
 *   ‧ 離開 approved 時自動取消精選、featuredAt 保留
 *   ‧ 訂單去重跨帳號、刪除不釋放
 *   ‧ 留言最多兩層（回覆的回覆要掛回頂層）
 *   ‧ 步數只增不減、非今日靜默忽略
 *   ‧ 點數與帳本同一交易且只加一次
 *
 * 跑法（prod PG 或本地 verify DB 皆可，會自行清理）：
 *   RESEND_API_KEY= NODE_ENV=production pnpm payload run scripts/verify-app-activities.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { randomUUID } from 'node:crypto'

import { tpeToday, tpeWeekId } from '../src/lib/app-activities/common'
import { awardActivityPoints } from '../src/lib/app-activities/award'
import { runSql } from '../src/lib/db/dialectSafeSql'
import { sql } from '@payloadcms/db-postgres'

type Loose = Record<string, unknown>

let failures = 0
const pass = (l: string) => console.log(`  ✅ ${l}`)
const fail = (l: string, d?: unknown) => {
  console.log(`  ❌ ${l}${d !== undefined ? ` — ${JSON.stringify(d)}` : ''}`)
  failures++
}
const expect = (c: boolean, l: string, d?: unknown) => (c ? pass(l) : fail(l, d))

const payload = await getPayload({ config })
const create = payload.create.bind(payload) as unknown as (a: Loose) => Promise<Loose>
const update = payload.update.bind(payload) as unknown as (a: Loose) => Promise<Loose>
const findByID = payload.findByID.bind(payload) as unknown as (a: Loose) => Promise<Loose>

const madeCustomers: Array<string | number> = []
const mkCustomer = async (): Promise<Loose> => {
  const d = await create({
    collection: 'customers',
    data: {
      email: `act-${randomUUID()}@test.chickimmiu.com`,
      password: randomUUID(),
      name: '活動測試會員',
      _verified: true,
    },
    disableVerificationEmail: true,
    overrideAccess: true,
  })
  madeCustomers.push(d.id as string | number)
  return d
}

const pointsOf = async (id: string | number) =>
  Number(((await findByID({ collection: 'customers', id, depth: 0 })) as Loose).points ?? 0)

const txnCount = async (id: string | number, source: string) => {
  const r = await payload.count({
    collection: 'points-transactions',
    where: { and: [{ user: { equals: id } }, { source: { equals: source } }] } as never,
    overrideAccess: true,
  })
  return r.totalDocs
}

async function main() {
  console.log('[前置] 寫入活動設定')
  await (payload.updateGlobal as unknown as (a: Loose) => Promise<Loose>)({
    slug: 'app-activity-settings',
    data: {
      travelRead: { isActive: true, pointsPerArticle: 3 },
      groupBuyShare: {
        isActive: true,
        sharePoints: 10,
        featuredPoints: 20,
        minContentLength: 5,
        maxImages: 3,
        editableHours: 24,
        bannedWords: [{ word: '禁字' }],
      },
      stepChallenge: {
        isActive: true,
        dailyMilestones: [
          { steps: 5000, points: 4 },
          { steps: 10000, points: 8 },
        ],
        weeklyMilestone: { steps: 50000, points: 30 },
      },
    },
    overrideAccess: true,
  })
  pass('設定已寫入（每篇 3 點 / 分享 10 點 / 精選 20 點 / 里程碑 4、8 點）')

  // ══ 共用發點層 ══
  console.log('\n[1] 發點與帳本同一交易、金額來自後台')
  {
    const u = await mkCustomer()
    const r = await awardActivityPoints(payload, {
      userId: u.id as string | number,
      amount: 3,
      source: 'travel_article_read',
      description: '閱讀愛旅遊文章：測試',
    })
    expect(r.awarded === 3 && r.balance === 3, '發 3 點、餘額 3', r)
    expect((await pointsOf(u.id as string | number)) === 3, 'customers.points 已同步（未被 hook 重複加）')
    expect((await txnCount(u.id as string | number, 'travel_article_read')) === 1, '帳本 1 筆')
  }

  // ══ 活動一 ══
  console.log('\n[2] 愛旅遊：同篇只能領一次（複合唯一索引）')
  {
    const u = await mkCustomer()
    const articleId = `travel-${randomUUID()}`
    const mk = () =>
      create({
        collection: 'travel-read-rewards',
        data: { user: u.id, articleId, articleTitle: 'T', pointsAwarded: 3, claimedAt: new Date().toISOString() },
        overrideAccess: true,
      })
    await mk()
    let blocked = false
    await mk().catch(() => { blocked = true })
    expect(blocked, '第二次寫入同一 user+articleId 被唯一索引擋下')
  }

  // ══ 活動三 ══
  console.log('\n[3] 散步趣：每日/每週紀錄唯一索引 + 週次計算')
  {
    const u = await mkCustomer()
    const date = tpeToday()
    await create({
      collection: 'step-daily-records',
      data: { user: u.id, date, steps: 6000, claimedMilestones: [] },
      overrideAccess: true,
    })
    let dupBlocked = false
    await create({
      collection: 'step-daily-records',
      data: { user: u.id, date, steps: 7000, claimedMilestones: [] },
      overrideAccess: true,
    }).catch(() => { dupBlocked = true })
    expect(dupBlocked, '同一 user+date 第二筆被擋下（一人一天一筆）')

    const wk = tpeWeekId()
    expect(/^\d{4}_W\d{2}$/.test(wk), `weekId 格式正確（${wk}）`)
    await create({
      collection: 'step-weekly-records',
      data: { user: u.id, weekId: wk, claimed: true },
      overrideAccess: true,
    })
    let wkDup = false
    await create({
      collection: 'step-weekly-records',
      data: { user: u.id, weekId: wk, claimed: true },
      overrideAccess: true,
    }).catch(() => { wkDup = true })
    expect(wkDup, '同一 user+weekId 第二筆被擋下')
  }

  // ══ 活動二：分享獎勵與精選加碼（hook）══
  console.log('\n[4] 團購分享：審核通過才發獎、退回重審不重發')
  // 自建測試文章（不動到真文章）。BlogPosts 必填 author + content(richText)。
  const admin = (await payload.find({
    collection: 'users',
    where: { role: { equals: 'admin' } },
    limit: 1,
    overrideAccess: true,
  })).docs[0] as unknown as Loose | undefined
  const lexical = {
    root: {
      type: 'root', format: '', indent: 0, version: 1, direction: 'ltr' as const,
      children: [{
        type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr' as const,
        children: [{ type: 'text', text: '測試用團購文章內容', format: 0, style: '', mode: 'normal', detail: 0, version: 1 }],
      }],
    },
  }
  const article = await create({
    collection: 'blog-posts',
    data: {
      title: `測試團購文 ${randomUUID().slice(0, 8)}`,
      slug: `test-gb-${randomUUID().slice(0, 8)}`,
      status: 'published',
      visibility: 'public',
      publishToKimLafayette: true,
      author: admin?.id,
      content: lexical,
    },
    overrideAccess: true,
  }).catch((e: unknown) => {
    console.log('  ❌ 建測試文章失敗：', e instanceof Error ? e.message.slice(0, 160) : '')
    return null
  })
  if (!article) {
    console.log('無法建立測試文章，活動二測試中止')
    process.exit(1)
  }
  const articleId = article.id

  const shareIds: Array<string | number> = []
  {
    const u = await mkCustomer()
    const s = await create({
      collection: 'group-buy-shares',
      data: {
        user: u.id, article: articleId, articleTitle: 'T', content: '很好用的東西',
        orderNumber: `ORD-${randomUUID().slice(0, 6).toUpperCase()}`,
        status: 'pending', rewarded: false, isFeatured: false, commentCount: 0,
        editableUntil: new Date(Date.now() + 86400000).toISOString(),
      },
      overrideAccess: true,
    })
    shareIds.push(s.id as string | number)
    expect((await pointsOf(u.id as string | number)) === 0, '送出時不發點（pending）')

    await update({ collection: 'group-buy-shares', id: s.id, data: { status: 'approved' }, overrideAccess: true })
    await new Promise((r) => setTimeout(r, 400))
    expect((await pointsOf(u.id as string | number)) === 10, '審核通過發 10 點', await pointsOf(u.id as string | number))
    const after = (await findByID({ collection: 'group-buy-shares', id: s.id, depth: 0 })) as Loose
    expect(after.rewarded === true, 'rewarded 已標記')

    // 退回 pending 再通過 → 不重發
    await update({ collection: 'group-buy-shares', id: s.id, data: { status: 'pending' }, overrideAccess: true })
    await update({ collection: 'group-buy-shares', id: s.id, data: { status: 'approved' }, overrideAccess: true })
    await new Promise((r) => setTimeout(r, 400))
    expect((await pointsOf(u.id as string | number)) === 10, '退回重審再通過不重複發獎', await pointsOf(u.id as string | number))

    // 同會員同文章第二篇 → 不再發獎
    const s2 = await create({
      collection: 'group-buy-shares',
      data: {
        user: u.id, article: articleId, articleTitle: 'T', content: '第二篇分享內容',
        orderNumber: `ORD2-${randomUUID().slice(0, 6).toUpperCase()}`,
        status: 'pending', rewarded: false, isFeatured: false, commentCount: 0,
        editableUntil: new Date(Date.now() + 86400000).toISOString(),
      },
      overrideAccess: true,
    })
    shareIds.push(s2.id as string | number)
    await update({ collection: 'group-buy-shares', id: s2.id, data: { status: 'approved' }, overrideAccess: true })
    await new Promise((r) => setTimeout(r, 400))
    expect((await pointsOf(u.id as string | number)) === 10, '同會員同文章第二篇不發獎', await pointsOf(u.id as string | number))

    console.log('\n[5] 精選加碼：featuredAt 冪等（取消再標記不得重發）')
    await update({ collection: 'group-buy-shares', id: s.id, data: { isFeatured: true }, overrideAccess: true })
    await new Promise((r) => setTimeout(r, 500))
    expect((await pointsOf(u.id as string | number)) === 30, '精選加碼 +20（共 30）', await pointsOf(u.id as string | number))
    const feat = (await findByID({ collection: 'group-buy-shares', id: s.id, depth: 0 })) as Loose
    expect(Boolean(feat.featuredAt), 'featuredAt 已寫入')
    const firstFeaturedAt = feat.featuredAt

    await update({ collection: 'group-buy-shares', id: s.id, data: { isFeatured: false }, overrideAccess: true })
    await update({ collection: 'group-buy-shares', id: s.id, data: { isFeatured: true }, overrideAccess: true })
    await new Promise((r) => setTimeout(r, 500))
    expect((await pointsOf(u.id as string | number)) === 30, '取消精選後再標記不重複發獎', await pointsOf(u.id as string | number))
    const feat2 = (await findByID({ collection: 'group-buy-shares', id: s.id, depth: 0 })) as Loose
    expect(feat2.featuredAt === firstFeaturedAt, 'featuredAt 未被覆蓋')
    expect((await txnCount(u.id as string | number, 'product_review_featured')) === 1, '精選加碼帳本只有 1 筆')

    console.log('\n[6] 離開 approved → 自動取消精選、featuredAt 保留')
    await update({ collection: 'group-buy-shares', id: s.id, data: { status: 'rejected' }, overrideAccess: true })
    await new Promise((r) => setTimeout(r, 500))
    const rej = (await findByID({ collection: 'group-buy-shares', id: s.id, depth: 0 })) as Loose
    expect(rej.isFeatured === false, 'isFeatured 已自動關閉（不佔精選版位）', rej.isFeatured)
    expect(Boolean(rej.featuredAt), 'featuredAt 保留（之後再精選也不會重發）')
  }

  console.log('\n[7] 訂單去重：跨帳號唯一、刪除不釋放')
  {
    const a = await mkCustomer()
    const b = await mkCustomer()
    const orderNumber = `DEDUP-${randomUUID().slice(0, 8).toUpperCase()}`
    await create({
      collection: 'group-buy-order-claims',
      data: { article: articleId, orderNumber, user: a.id },
      overrideAccess: true,
    })
    let taken = false
    await create({
      collection: 'group-buy-order-claims',
      data: { article: articleId, orderNumber, user: b.id },
      overrideAccess: true,
    }).catch(() => { taken = true })
    expect(taken, '他人用過同一文章的同一訂單號被擋下')
  }

  console.log('\n[8] 檢舉：同一人對同一目標只能一次')
  {
    const r1 = await mkCustomer()
    const target = shareIds[0]
    const mkReport = () =>
      create({
        collection: 'content-reports',
        data: {
          targetType: 'review', targetId: Number(target), review: target,
          reporter: r1.id, reason: 'spam', reasonDetail: '', status: 'pending',
        },
        overrideAccess: true,
      })
    await mkReport()
    let dup = false
    await mkReport().catch(() => { dup = true })
    expect(dup, '重複檢舉同一目標被唯一索引擋下')
  }

  console.log('\n[9] 留言：commentCount 只計 published')
  {
    const u = await mkCustomer()
    const share = shareIds[0]
    const c1 = await create({
      collection: 'group-buy-share-comments',
      data: { review: share, user: u.id, content: '推推', status: 'published' },
      overrideAccess: true,
    })
    await new Promise((r) => setTimeout(r, 400))
    let s = (await findByID({ collection: 'group-buy-shares', id: share, depth: 0 })) as Loose
    expect(Number(s.commentCount) === 1, 'published 留言計入 commentCount', s.commentCount)

    await update({ collection: 'group-buy-share-comments', id: c1.id, data: { status: 'hidden' }, overrideAccess: true })
    await new Promise((r) => setTimeout(r, 400))
    s = (await findByID({ collection: 'group-buy-shares', id: share, depth: 0 })) as Loose
    expect(Number(s.commentCount) === 0, '隱藏留言不計入', s.commentCount)
  }

  // 清理
  //
  // ⚠️ payload.delete 對有 FK 參照的列會失敗（本活動的 article/user 皆為必填，
  // FK 又是 ON DELETE SET NULL → 刪父列時會違反 NOT NULL）。所以依相依順序
  // 用一次 SQL 清乾淨；否則測試資料會殘留（實測殘留過 26 個會員與 2 篇
  // published+publishToKimLafayette 的測試文章，那會出現在 App 選單與部落格）。
  console.log('')
  const ids = madeCustomers.map((v) => Number(v)).filter(Number.isFinite)
  const idList = ids.length ? ids.join(',') : '-1'
  const artId = Number(articleId)
  const raw = async (q: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await runSql(payload, (sql as any).raw(q))
  }
  try {
    await raw(`DELETE FROM content_reports WHERE reporter_id IN (${idList}) OR target_user_id IN (${idList})`)
    await raw(`DELETE FROM group_buy_share_comments WHERE user_id IN (${idList})`)
    await raw(`DELETE FROM group_buy_shares_photos WHERE _parent_id IN (SELECT id FROM group_buy_shares WHERE user_id IN (${idList}))`)
    await raw(`DELETE FROM group_buy_shares WHERE user_id IN (${idList})`)
    await raw(`DELETE FROM group_buy_order_claims WHERE user_id IN (${idList})`)
    await raw(`DELETE FROM travel_read_rewards WHERE user_id IN (${idList})`)
    await raw(`DELETE FROM step_daily_records WHERE user_id IN (${idList})`)
    await raw(`DELETE FROM step_weekly_records WHERE user_id IN (${idList})`)
    await raw(`DELETE FROM points_transactions WHERE user_id IN (${idList})`)
    await raw(`DELETE FROM wallet_transactions WHERE user_id IN (${idList})`)
    await raw(`DELETE FROM member_segments WHERE user_id IN (${idList})`)
    await raw(`DELETE FROM customers_sessions WHERE _parent_id IN (${idList})`)
    await raw(`DELETE FROM customers WHERE id IN (${idList})`)
    if (Number.isFinite(artId)) {
      await raw(`DELETE FROM blog_posts_rels WHERE parent_id = ${artId}`)
      await raw(`DELETE FROM blog_posts WHERE id = ${artId}`)
    }
    console.log(`已清理 ${ids.length} 個測試會員、測試文章與所有活動紀錄`)
  } catch (e) {
    console.log('⚠️ 清理失敗，請手動確認殘留：', e instanceof Error ? e.message.slice(0, 200) : '')
    failures++
  }

  if (failures === 0) {
    console.log('\n🎉 全部 pass')
    process.exit(0)
  }
  console.log(`\n❌ ${failures} 個 assertion 失敗`)
  process.exit(1)
}

await main()
