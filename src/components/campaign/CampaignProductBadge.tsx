'use client'

/**
 * CampaignProductBadge — PLP / PDP 活動資格 badge（CHIC Commerce OS P0-C）
 *
 * scope 判斷用 /api/campaigns/active 的 scopeSummary（client 簡化版，僅決定顯示；
 * 真正資格與價格永遠以 server quote 為準）。色弱可辨：深底金字 + 邊線，非純色相。
 */
import { productMatchesCampaign, useActiveCampaigns } from './useActiveCampaigns'

interface Props {
  productId: number | string
  categoryIds?: Array<number | string>
  tags?: string[]
  className?: string
}

export function CampaignProductBadge({ productId, categoryIds, tags, className }: Props) {
  const { enabled, campaigns } = useActiveCampaigns()
  if (!enabled) return null
  const campaign = campaigns.find(
    (c) => c.badgeText && productMatchesCampaign(c, { id: productId, categoryIds, tags }),
  )
  if (!campaign) return null
  return (
    <span
      className={`inline-flex items-center rounded border border-gold-600 bg-neutral-900 px-1.5 py-0.5 text-[11px] font-medium leading-tight text-gold-300 ${className ?? ''}`}
    >
      {campaign.badgeText}
    </span>
  )
}
