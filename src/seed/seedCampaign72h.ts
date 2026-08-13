/**
 * Seed：72H CHIC STYLE HUNT（doc §11 第一場活動）— 停用草稿
 * ────────────────────────────────────────────────────────
 * 跑法：pnpm seed:campaign72h（--dry-run 用 pnpm seed:campaign72h:dry）
 * 沿用 seedAutomationJourneys 模式：upsert by slug、keepAlive、頂層 await。
 *
 * ⚠️ 刻意 seed 成不可上線狀態（status=draft + commerce.killSwitch=true +
 * budgetCap 留空）：啟用前必須由 Alan／財務填入預算與核准（doc §17），
 * 後台 beforeChange 會強制擋沒填完的啟用。正式環境預設不執行本 seed。
 */
import { getPayload } from 'payload'
import config from '../payload.config'

const log = (...args: unknown[]) => console.error('[seed72h]', ...args)
log('argv:', process.argv.slice(2).join(' ') || '(none)')

const DRY_RUN = process.argv.includes('--dry-run')
const keepAlive = setInterval(() => {}, 60_000)

process.on('unhandledRejection', (err) => {
  console.error('[seed72h] unhandledRejection', err)
  process.exit(1)
})
process.on('uncaughtException', (err) => {
  console.error('[seed72h] uncaughtException', err)
  process.exit(1)
})

const CAMPAIGN_SLUG = '72h-chic-style-hunt'

async function main() {
  const payload = await getPayload({ config: await config })

  // 排程佔位：啟用時由後台改成真檔期（server 權威時間）
  const startDate = new Date(Date.now() + 7 * 86_400_000).toISOString()
  const endDate = new Date(Date.now() + 10 * 86_400_000).toISOString()

  const campaignData = {
    campaignName: '72H CHIC STYLE HUNT',
    campaignSlug: CAMPAIGN_SLUG,
    campaignType: 'flash_sale',
    status: 'draft',
    description:
      '72 小時限時 Style Hunt：任選 2 件現折 NT$1,000。目標：每單件數 / AOV / 增量貢獻毛利；同時驗證 Campaign Studio → Checkout 完整鏈（doc §11）。',
    schedule: { startDate, endDate, timezone: 'Asia/Taipei' },
    commerce: {
      enabled: true,
      killSwitch: true, // 安全預設：即使誤轉 active 也不出折扣
      objective: 'aov',
      surfaces: ['home', 'plp', 'pdp', 'cart', 'checkout'],
      headline: '72H CHIC STYLE HUNT｜任選 2 件現折 NT$1,000',
      badgeText: '任選2件折$1,000',
      ctaText: '立即選購',
      ctaHref: '/products',
      // budgetCap 刻意留空：Alan／財務填入前無法啟用（fail closed）
    },
    adminNote:
      '【啟用前必填（doc §17）】1) commerce.budgetCap 活動總預算 2) 核准人+核准時間 3) 檔期改為真實 72H 4) 規則 status 改 active 5) 關 killSwitch 6) 促銷引擎設定開 storefrontEnabled。缺一不可，後台會擋。',
  }

  const ruleData = {
    name: '任選 2 件現折 NT$1,000',
    slug: 'mix2-fixed1000',
    status: 'draft', // 啟用時改 active；active 後 DSL 鎖定，要改就開新版本
    version: 1,
    benefitClass: 'item_promo',
    priority: 300,
    scope: { excludeTags: [{ tag: 'final-sale' }] },
    conditions: { minQuantity: 2, segmentsNotIn: ['BLK1'] },
    effect: {
      effectType: 'fixed_discount_per_group',
      groupSize: 2,
      amount: 1000,
      repeatMode: 'once_per_order', // 「每滿 2 件重複折」需 Alan 拍板後改 every_full_group + 新版本
    },
    stacking: { exclusiveGroup: 'mix-match-main', stackableWithAll: true },
    guardrails: { minimumGrossMarginPct: 30 }, // doc §11 建議值；正式啟用前確認
    adminNote: '72H 主規則。eligible 商品範圍 / final-sale 排除 / 疊加政策依 doc §17 由 Alan 確認。',
  }

  // upsert campaign by slug
  const existing = await payload.find({
    collection: 'marketing-campaigns',
    where: { campaignSlug: { equals: CAMPAIGN_SLUG } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  let campaignId: number | string
  if (existing.docs[0]) {
    campaignId = (existing.docs[0] as { id: number | string }).id
    if (DRY_RUN) {
      log(`DRY-RUN：would update campaign #${campaignId}`)
    } else {
      await payload.update({
        collection: 'marketing-campaigns',
        id: campaignId,
        data: campaignData as never,
        overrideAccess: true,
      })
      log(`updated campaign #${campaignId}`)
    }
  } else if (DRY_RUN) {
    log('DRY-RUN：would create campaign', CAMPAIGN_SLUG)
    campaignId = -1
  } else {
    const created = await payload.create({
      collection: 'marketing-campaigns',
      data: campaignData as never,
      overrideAccess: true,
    })
    campaignId = created.id as number | string
    log(`created campaign #${campaignId}`)
  }

  // upsert rule by campaign+slug+version
  if (!DRY_RUN && campaignId !== -1) {
    const existingRule = await payload.find({
      collection: 'promotion-rules' as never,
      where: {
        and: [
          { campaign: { equals: campaignId } },
          { slug: { equals: ruleData.slug } },
          { version: { equals: 1 } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const ruleDoc = existingRule.docs[0] as { id: number | string; status?: string } | undefined
    if (ruleDoc) {
      if (ruleDoc.status === 'active') {
        log(`rule #${ruleDoc.id} 已是 active（DSL 鎖定），跳過更新`)
      } else {
        await payload.update({
          collection: 'promotion-rules' as never,
          id: ruleDoc.id as never,
          data: { ...ruleData, campaign: campaignId } as never,
          overrideAccess: true,
        })
        log(`updated rule #${ruleDoc.id}`)
      }
    } else {
      const createdRule = await payload.create({
        collection: 'promotion-rules' as never,
        data: { ...ruleData, campaign: campaignId } as never,
        overrideAccess: true,
      })
      log(`created rule #${(createdRule as { id: number | string }).id}`)
    }
  } else if (DRY_RUN) {
    log('DRY-RUN：would upsert rule mix2-fixed1000 v1')
  }

  log('done（活動為 draft + killSwitch，啟用步驟見 campaign.adminNote）')
  clearInterval(keepAlive)
  process.exit(0)
}

await main().catch((err) => {
  console.error('[seed72h] FATAL', err)
  process.exit(1)
})
