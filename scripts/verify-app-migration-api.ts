/**
 * APP 遷移需求（2026-08-20 Google Doc）後端落地驗證
 * ──────────────────────────────────────────────
 * 驗證範圍：
 *   B-1  game-settings 生效（簽到點數 / freePerTier / pointsCost / dailyLimit / prizes）
 *   B-2  獎表帶 id（settings prizes rowId / 抽獎 sourceSettingsId）
 *   A-1  getPublicLeaderboard 遮罩（無全名、無 userId 欄位）
 *   A-2  points-transactions 本人查詢資料形狀
 *   D-1  customers.memberTier / referralCode 本人 update 被欄位權限擋下
 *   D-2  coupons read 非 admin 被拒
 *   D-4  user-rewards.user maxDepth=0（depth=2 仍只回 id）
 *
 * 跑法（fresh verify DB，兩段式見 memory）：
 *   rm -f ./data/verify-app-api.db
 *   NODE_ENV=production DATABASE_URI="file:./data/verify-app-api.db" pnpm payload migrate
 *   NODE_ENV=production DATABASE_URI="file:./data/verify-app-api.db" pnpm payload run scripts/dev-sync-sqlite-schema.ts
 *   RESEND_API_KEY= NODE_ENV=production DATABASE_URI="file:./data/verify-app-api.db" pnpm payload run scripts/verify-app-migration-api.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import {
  getEffectiveGameConfig,
  getPrizeTableForDisplay,
  performDailyCheckin,
  drawPrize,
  __clearGameSettingsCache,
} from '../src/lib/games/gameEngine'
import { getPublicLeaderboard } from '../src/lib/games/leaderboardData'

let failures = 0
const pass = (label: string) => console.log(`  ✅ ${label}`)
const fail = (label: string, detail?: unknown) => {
  console.log(`  ❌ ${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''}`)
  failures++
}
const expect = (cond: boolean, label: string, detail?: unknown) =>
  cond ? pass(label) : fail(label, detail)

async function main() {
  const payload = await getPayload({ config })
  type Loose = Record<string, unknown>
  // 注意 .bind(payload)：直接解構 payload.update 會丟 this，內部 this.collections 直接炸
  const create = payload.create.bind(payload) as unknown as (args: Loose) => Promise<Loose>
  const update = payload.update.bind(payload) as unknown as (args: Loose) => Promise<Loose>

  console.log('── 前置：建測試會員 ──')
  // 凍結版 SQLite 鏈的 mini_game_records / points_transactions FK 仍指向 users 表
  //（customers 表由 dev-sync 補建）。比照正式資料搬移的「ID 保留策略」：
  // 先建同序 users 影子列，讓 customers 拿到相同 id，FK 可過。
  const mk = async (email: string, name: string, points: number) => {
    await create({
      collection: 'users',
      data: {
        email: `shadow.${email}`,
        password: 'Verify12345!',
        name,
        role: 'customer',
        _verified: true,
      },
      disableVerificationEmail: true,
      overrideAccess: true,
    })
    return create({
      collection: 'customers',
      data: {
        email,
        password: 'Verify12345!',
        name,
        points,
        _verified: true,
      },
      disableVerificationEmail: true,
      overrideAccess: true,
    })
  }
  const alice = await mk('alice.verify@test.local', '王小美', 900)
  const bob = await mk('bob.verify@test.local', '陳大文', 380)
  pass(`customers 建立 alice=${alice.id} bob=${bob.id}`)

  console.log('── B-1：後台 game-settings 寫入自訂值 ──')
  await (payload.updateGlobal as unknown as (args: Loose) => Promise<Loose>)({
    slug: 'game-settings',
    data: {
      dailyCheckin: { day1to6Points: 7, day7BonusPoints: 70, streakBonusMultiplier: 2 },
      spinWheel: {
        freePerTier: { ordinary: 2, bronze: 2, silver: 3, gold: 3, platinum: 5, diamond: 9 },
        pointsCostPerPlay: 33,
        dailyLimit: 4,
        prizes: [
          { prizeName: '甲獎 8 點', prizeType: 'points', prizeAmount: 8, weight: 50 },
          { prizeName: '乙獎購物金 3 元', prizeType: 'credit', prizeAmount: 3, weight: 30 },
          { prizeName: '銘謝惠顧', prizeType: 'none', prizeAmount: 0, weight: 20 },
        ],
      },
    },
    overrideAccess: true,
  })
  __clearGameSettingsCache()

  const checkinCfg = await getEffectiveGameConfig('daily_checkin')
  expect(checkinCfg?.checkin?.day1to6Points === 7, 'daily_checkin day1to6Points=7（後台值）', checkinCfg?.checkin)
  expect(checkinCfg?.checkin?.day7BonusPoints === 70, 'day7BonusPoints=70', checkinCfg?.checkin)

  const spinCfg = await getEffectiveGameConfig('spin_wheel')
  expect(spinCfg?.pointsCost === 33, 'spin_wheel pointsCost=33（後台值）', spinCfg?.pointsCost)
  expect(spinCfg?.dailyLimit === 4, 'spin_wheel dailyLimit=4', spinCfg?.dailyLimit)
  expect(spinCfg?.freePlaysPerDay.ordinary === 2, 'spin_wheel freePerTier.ordinary=2', spinCfg?.freePlaysPerDay)
  expect(spinCfg?.settingsPrizes.length === 3, 'settingsPrizes 3 筆', spinCfg?.settingsPrizes.length)

  console.log('── B-2：獎表帶 id ──')
  const table = await getPrizeTableForDisplay('spin_wheel')
  expect(table.length === 3, 'display 獎表 = 後台 3 筆（非硬編碼 8 筆）', table.length)
  expect(table.every((t) => typeof t.id === 'string' && t.id.length > 0), '每筆帶 array row id', table)

  const drawNames = new Set<string>()
  let sawSettingsId = false
  for (let i = 0; i < 20; i++) {
    const p = await drawPrize('spin_wheel', 'ordinary', 100)
    if (p) {
      drawNames.add(p.prize)
      if (p.sourceSettingsId) sawSettingsId = true
    }
  }
  const allowed = new Set(['甲獎 8 點', '乙獎購物金 3 元', '銘謝惠顧'])
  expect([...drawNames].every((n) => allowed.has(n)), '20 次抽獎全部落在後台獎池', [...drawNames])
  expect(sawSettingsId, '抽中獎項帶 sourceSettingsId')

  console.log('── B-1：簽到實發後台點數 ──')
  // 路由層傳的是 user.id 原值（number，TS 端 cast 成 string），這裡照做
  const checkin = await performDailyCheckin(alice.id as unknown as string)
  expect(checkin.prize.amount === 7, `簽到發 7 點（後台值）`, checkin.prize)
  const aliceAfter = (await payload.findByID({
    collection: 'customers',
    id: alice.id as string | number,
  })) as unknown as Loose
  expect((aliceAfter.points as number) === 907, 'alice 點數 900+7=907', aliceAfter.points)

  console.log('── A-2：points-transactions 本人查詢 ──')
  const txns = await payload.find({
    collection: 'points-transactions',
    where: { user: { equals: alice.id } } as never,
    sort: '-createdAt',
    limit: 20,
    depth: 0,
    overrideAccess: true,
  })
  expect(txns.totalDocs >= 1, `alice 至少 1 筆 txn（簽到）`, txns.totalDocs)
  const t0 = txns.docs[0] as unknown as Loose
  expect((t0.amount as number) === 7 && typeof t0.createdAt === 'string', 'txn 形狀 {amount, createdAt…}', t0)

  console.log('── A-1：排行榜遮罩 ──')
  const lb = await getPublicLeaderboard(payload, 10)
  expect(lb.length >= 2, `排行榜 ≥2 筆`, lb.length)
  expect(
    lb.every((e) => !('userId' in (e as unknown as Loose))),
    '不含 userId 欄位',
  )
  expect(
    lb.every((e) => e.name.includes('*')),
    '姓名全部遮罩（含 *）',
    lb.map((e) => e.name),
  )
  expect(
    lb.every((e) => e.name !== '王小美' && e.name !== '陳大文'),
    '不出現全名',
  )

  console.log('── D-1：本人改 memberTier / referralCode 被欄位權限擋 ──')
  const tier = await create({
    collection: 'membership-tiers',
    data: {
      name: '測試鑽石',
      slug: 'diamond',
      level: 5,
      minSpent: 200000,
      frontName: '璀璨天后',
    },
    overrideAccess: true,
  }).catch((e: unknown) => {
    console.log(`  （tier 建立失敗，memberTier 斷言退化為 null 檢查：${(e as Error).message}）`)
    return null
  })
  const aliceUser = (await payload.findByID({
    collection: 'customers',
    id: alice.id as string | number,
    depth: 0,
  })) as unknown as Loose
  const beforeCode = aliceUser.referralCode
  await update({
    collection: 'customers',
    id: alice.id,
    data: {
      name: '王小美改',
      ...(tier ? { memberTier: tier.id } : {}),
      referralCode: 'HACKCODE',
    },
    overrideAccess: false,
    user: { ...aliceUser, collection: 'customers' },
  }).catch((e: unknown) => {
    fail('本人 update 不應整筆被拒（僅該欄位剝除）', e instanceof Error ? e.message : e)
    if (e instanceof Error) console.log((e.stack || '').split('\n').slice(0, 8).join('\n'))
    return null
  })
  const aliceFinal = (await payload.findByID({
    collection: 'customers',
    id: alice.id as string | number,
    depth: 0,
  })) as unknown as Loose
  expect(aliceFinal.name === '王小美改', '一般欄位 name 改動成功', aliceFinal.name)
  expect(aliceFinal.memberTier == null, 'memberTier 未被本人寫入', aliceFinal.memberTier)
  expect(aliceFinal.referralCode === beforeCode, 'referralCode 未被本人改掉', {
    before: beforeCode,
    after: aliceFinal.referralCode,
  })

  console.log('── C-2：公開暱稱 ──')
  await update({
    collection: 'customers',
    id: alice.id,
    data: { nickname: '  小美醬  ' },
    overrideAccess: false,
    user: { ...aliceFinal, collection: 'customers' },
  }).catch((e: unknown) => {
    fail('本人應可自改 nickname', e instanceof Error ? e.message : e)
    return null
  })
  const aliceNick = (await payload.findByID({
    collection: 'customers',
    id: alice.id as string | number,
    depth: 0,
  })) as unknown as Loose
  expect(aliceNick.nickname === '小美醬', 'nickname 寫入成功且已 trim', aliceNick.nickname)
  const lb2 = await getPublicLeaderboard(payload, 10)
  expect(
    lb2.some((e) => e.name === '小美醬'),
    '排行榜顯示暱稱（原樣、不遮罩）',
    lb2.map((e) => e.name),
  )
  expect(
    lb2.some((e) => e.name.includes('*')),
    '未設暱稱者仍遮罩',
    lb2.map((e) => e.name),
  )

  console.log('── B-4：等級門檻改讀 membership-tiers ──')
  {
    const { loadTierThresholds, calculateTier } = await import('../src/lib/crm/tierEngine')
    await create({
      collection: 'membership-tiers',
      data: {
        name: '測試銅牌',
        slug: 'bronze',
        level: 1,
        minSpent: 5000,
        annualSpentThreshold: 3000,
        frontName: '曦漾仙子',
      },
      overrideAccess: true,
    }).catch((e: unknown) => {
      console.log(`  （bronze tier 建立失敗：${(e as Error).message}）`)
      return null
    })
    const thresholds = await loadTierThresholds(payload)
    expect(thresholds.bronze?.lifetime === 5000, 'bronze lifetime 門檻 = 後台 minSpent 5000', thresholds.bronze)
    expect(calculateTier(3680, 0, thresholds) === 'ordinary', '3,680 未達 5,000 → ordinary（文件 id 8 案例修正）')
    expect(calculateTier(5000, 0, thresholds) === 'bronze', '5,000 → bronze')
    expect(calculateTier(0, 3000, thresholds) === 'bronze', '年度 3,000（annualSpentThreshold）→ bronze 快速通道')
  }

  console.log('── D-2：coupons read 非 admin 被拒 ──')
  await create({
    collection: 'coupons',
    data: { code: 'VF10', name: '驗證券', discountType: 'fixed', discountValue: 10 },
    overrideAccess: true,
  })
  const couponRead = await payload
    .find({
      collection: 'coupons',
      overrideAccess: false,
      user: { ...aliceFinal, collection: 'customers' } as never,
      limit: 10,
    })
    .then((r) => ({ ok: true as const, total: r.totalDocs }))
    .catch(() => ({ ok: false as const, total: 0 }))
  expect(!couponRead.ok, '一般會員 read coupons 被拒（Forbidden）', couponRead)

  console.log('── D-4：user-rewards.user maxDepth=0 ──')
  const reward = await create({
    collection: 'user-rewards',
    data: {
      user: alice.id,
      rewardType: 'coupon',
      displayName: '驗證獎',
      state: 'unused',
      expiresAt: new Date(Date.now() + 86400_000 * 30).toISOString(),
      requiresPhysicalShipping: false,
    },
    overrideAccess: true,
  })
  const rewardDeep = (await payload.findByID({
    collection: 'user-rewards',
    id: reward.id as string | number,
    depth: 2,
    overrideAccess: true,
  })) as unknown as Loose
  expect(
    typeof rewardDeep.user === 'number' || typeof rewardDeep.user === 'string',
    'depth=2 下 user 仍只回 id（不內嵌完整物件）',
    typeof rewardDeep.user,
  )

  console.log('')
  if (failures === 0) {
    console.log('🎉 全部 pass（APP 遷移需求後端落地驗證通過）')
    process.exit(0)
  } else {
    console.log(`❌ ${failures} 個 assertion 失敗`)
    process.exit(1)
  }
}

await main()
