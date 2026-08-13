'use client'

/**
 * CampaignBanner — 活動主張 + server 權威倒數（CHIC Commerce OS P0-C）
 *
 * - 只顯示一個主活動（doc §8.3：每頁一個主張，不堆疊）。
 * - 倒數基準 = server 時間偏移 + endAt；refresh 不重置；歸零即整條消失。
 * - 無障礙：數字區 aria-hidden（不對 SR 每秒廣播），另供文字版結束時間；
 *   支援 prefers-reduced-motion（本元件本來就無動畫）。
 * - 色弱可讀：深底 + 金字 + 高明度對比邊線，不以色相為唯一訊號。
 * - 事件：campaign_exposed（每 session 每活動一次）/ campaign_clicked。
 */
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { enqueueBehaviorEvent } from '@/lib/behaviorTracking'
import { useActiveCampaigns } from './useActiveCampaigns'

interface Props {
  surface?: 'home' | 'plp' | 'pdp' | 'cart' | 'checkout' | 'member' | 'complete'
}

function pad(n: number): string {
  return String(Math.max(0, n)).padStart(2, '0')
}

export function CampaignBanner({ surface = 'home' }: Props) {
  const { enabled, campaigns, offsetMs } = useActiveCampaigns()
  const campaign = campaigns.find((c) => c.surfaces.length === 0 || c.surfaces.includes(surface)) ?? null
  const [nowMs, setNowMs] = useState<number | null>(null)

  useEffect(() => {
    if (!campaign) return
    setNowMs(Date.now() + offsetMs)
    const timer = setInterval(() => setNowMs(Date.now() + offsetMs), 1000)
    return () => clearInterval(timer)
  }, [campaign?.id, offsetMs]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!campaign) return
    try {
      const key = `ckm-campaign-exposed-${campaign.id}-${surface}`
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch {
      /* sessionStorage 不可用時仍送事件 */
    }
    enqueueBehaviorEvent({ eventType: 'campaign_exposed', campaignId: campaign.id, surface })
  }, [campaign?.id, surface]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!enabled || !campaign || nowMs == null) return null
  const endMs = campaign.endAt ? Date.parse(campaign.endAt) : null
  if (endMs != null && nowMs >= endMs) return null // 歸零即失效，不留殘影

  const remain = endMs != null ? Math.max(0, endMs - nowMs) : null
  const d = remain != null ? Math.floor(remain / 86_400_000) : 0
  const h = remain != null ? Math.floor((remain % 86_400_000) / 3_600_000) : 0
  const m = remain != null ? Math.floor((remain % 3_600_000) / 60_000) : 0
  const s = remain != null ? Math.floor((remain % 60_000) / 1000) : 0
  const endText = endMs != null ? new Date(endMs).toLocaleString('zh-TW', { hour12: false }) : null

  return (
    <section
      aria-label={`限時活動：${campaign.headline ?? campaign.name}`}
      className="bg-neutral-900 text-cream-50 border-y border-gold-600"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 py-3 sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {campaign.badgeText ? (
            <span className="shrink-0 rounded-full border border-gold-400 px-2.5 py-0.5 text-xs font-medium text-gold-300">
              {campaign.badgeText}
            </span>
          ) : null}
          <p className="truncate text-sm font-medium sm:text-base">{campaign.headline ?? campaign.name}</p>
        </div>
        <div className="flex items-center gap-4">
          {remain != null ? (
            <>
              <div className="flex items-center gap-1 font-serif tabular-nums" aria-hidden="true">
                {d > 0 ? (
                  <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-sm text-gold-300">{d}天</span>
                ) : null}
                <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-sm text-gold-300">{pad(h)}</span>
                <span className="text-gold-500">:</span>
                <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-sm text-gold-300">{pad(m)}</span>
                <span className="text-gold-500">:</span>
                <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-sm text-gold-300">{pad(s)}</span>
              </div>
              <span className="sr-only">活動至 {endText} 止</span>
            </>
          ) : null}
          {campaign.ctaText && campaign.ctaHref ? (
            <Link
              href={campaign.ctaHref}
              onClick={() =>
                enqueueBehaviorEvent({ eventType: 'campaign_clicked', campaignId: campaign.id, surface })
              }
              className="min-h-[44px] shrink-0 rounded-full bg-gold-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-gold-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-300 flex items-center"
            >
              {campaign.ctaText}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  )
}
