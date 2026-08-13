import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { loadActiveCommerceRules, loadPromotionSettings } from '@/lib/promotions/snapshots'

/**
 * GET /api/campaigns/active?surface=cart（CHIC Commerce OS P0-C）
 * ─────────────────────────────────────────────────────────────
 * 前台活動版位資料源：倒數（server 權威時間）、badge、CTA。
 * - serverNow 一併回傳 → client 只算顯示偏移，refresh 不會重置倒數。
 * - 只回目前在排程窗內的活動；surface 參數過濾版位。
 * - 不回成本 / 預算 / 規則細節（那些只進 quote 的彙總結果）。
 */
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const surface = url.searchParams.get('surface')
  try {
    const payload = await getPayload({ config })
    const settings = await loadPromotionSettings(payload)
    const serverNow = new Date().toISOString()
    if (settings.killSwitch || !settings.storefrontEnabled) {
      return NextResponse.json({ ok: true, storefrontEnabled: false, serverNow, campaigns: [] })
    }
    const { campaigns, rules } = await loadActiveCommerceRules(payload, { settings })
    const now = Date.parse(serverNow)
    const live = campaigns.filter((c) => {
      if (c.startAt && now < Date.parse(c.startAt)) return false
      if (c.endAt && now >= Date.parse(c.endAt)) return false
      if (surface && c.surfaces.length > 0 && !c.surfaces.includes(surface)) return false
      return true
    })
    return NextResponse.json({
      ok: true,
      storefrontEnabled: true,
      serverNow,
      campaigns: live.map((c) => {
        const campaignRules = rules.filter((r) => String(r.campaignId) === String(c.id))
        const primary = campaignRules[0]
        return {
          id: c.id,
          slug: c.campaignSlug,
          name: c.campaignName,
          headline: c.headline,
          badgeText: c.badgeText,
          ctaText: c.ctaText,
          ctaHref: c.ctaHref,
          startAt: c.startAt,
          endAt: c.endAt,
          surfaces: c.surfaces,
          // PLP/PDP badge 的資格摘要（只給 scope，不含護欄/預算）
          scopeSummary: primary
            ? {
                includeProducts: primary.scope.includeProducts ?? [],
                includeCategories: primary.scope.includeCategories ?? [],
                excludeProducts: primary.scope.excludeProducts ?? [],
                excludeCategories: primary.scope.excludeCategories ?? [],
                excludeTags: primary.scope.excludeTags ?? [],
              }
            : null,
        }
      }),
    })
  } catch (err) {
    console.error('[campaigns/active] failed', err)
    return NextResponse.json({ ok: false, storefrontEnabled: false, campaigns: [] }, { status: 500 })
  }
}
