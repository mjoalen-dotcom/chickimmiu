'use client'

/**
 * CartCampaignProgress — 購物車 Style Quest 進度（CHIC Commerce OS P0-C）
 *
 * - 進度由 /api/pricing/quote 的 server 評估結果驅動（client 不自己算資格）。
 * - 0/2 → 1/2 → UNLOCKED；刪除 / 改數量 debounce 後重新報價 → 自動回退。
 * - 解鎖狀態不只變色：加圖示 + 文案（色弱可辨）；容器邊線用高明度對比。
 * - aria-live="polite" 播報解鎖；reward_unlocked / progress_viewed 事件接 P0-D。
 */
import { useEffect, useRef } from 'react'

import { useCartStore } from '@/stores/cartStore'
import { enqueueBehaviorEvent } from '@/lib/behaviorTracking'
import { useActiveCampaigns } from './useActiveCampaigns'
import { useCartQuote, type QuoteProgressHint } from './useCartQuote'

interface Props {
  surface: 'cart' | 'checkout'
  className?: string
}

function hintLabel(hint: QuoteProgressHint, badgeText: string | null | undefined): string {
  if (badgeText) return badgeText
  if (hint.effectType === 'fixed_discount_per_group' && hint.effectAmount) {
    return `任選 ${hint.target} 件現折 NT$${hint.effectAmount.toLocaleString()}`
  }
  if (hint.effectType === 'percent_discount_nth_unit' && hint.effectPercentOff) {
    return `第 ${hint.target} 件 ${(100 - hint.effectPercentOff) / 10} 折`
  }
  if (hint.kind === 'subtotal' && hint.effectAmount) {
    return `滿 NT$${hint.target.toLocaleString()} 折 NT$${hint.effectAmount.toLocaleString()}`
  }
  // 兩種效果都限登入會員（訪客結帳每筆都是新的臨時帳號，「每人 1 次」擋不住），
  // 文案要講清楚，不要讓訪客解鎖了才發現領不到。
  if (hint.effectType === 'coupon_drop') {
    return '限量券包（會員限定，先搶先贏）'
  }
  if (hint.effectType === 'mystery_gift') {
    return '神秘禮物（會員限定，付款後抽獎．保證有獎）'
  }
  return '活動優惠'
}

export function CartCampaignProgress({ surface, className }: Props) {
  const items = useCartStore((s) => s.items)
  const { enabled, campaigns } = useActiveCampaigns()
  const quote = useCartQuote(items)
  const prevUnlocked = useRef<Record<string, boolean>>({})
  const viewedOnce = useRef(false)

  // 每頁最多兩條進度，避免版面堆疊（doc §8.3：一頁一個主張）
  const hints = enabled ? quote.progress.slice(0, 2) : []
  const applications = quote.applications.filter((a) => a.source === 'campaign_rule')

  useEffect(() => {
    if (hints.length === 0) return
    if (!viewedOnce.current) {
      viewedOnce.current = true
      enqueueBehaviorEvent({
        eventType: 'progress_viewed',
        surface,
        campaignId: hints[0]?.campaignId ?? undefined,
        ruleKey: hints[0]?.ruleKey,
      })
    }
    for (const hint of hints) {
      if (hint.unlocked && !prevUnlocked.current[hint.ruleKey]) {
        enqueueBehaviorEvent({
          eventType: 'reward_unlocked',
          surface,
          campaignId: hint.campaignId ?? undefined,
          ruleKey: hint.ruleKey,
        })
      }
      prevUnlocked.current[hint.ruleKey] = hint.unlocked
    }
  }, [hints, surface])

  if (!enabled || hints.length === 0) return null

  const badgeByCampaign = new Map(campaigns.map((c) => [String(c.id), c.badgeText]))

  return (
    <div className={className} aria-live="polite">
      {hints.map((hint) => {
        const applied = applications.find((a) => a.ruleKey === hint.ruleKey)
        const pct = hint.target > 0 ? Math.min(100, Math.round((hint.current / hint.target) * 100)) : 0
        const label = hintLabel(hint, badgeByCampaign.get(String(hint.campaignId)))
        return (
          <div
            key={hint.ruleKey}
            className={
              hint.unlocked
                ? 'mb-3 rounded-xl border-2 border-gold-600 bg-gold-500/10 p-3'
                : 'mb-3 rounded-xl border border-neutral-400 bg-white p-3'
            }
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-neutral-900">
                {hint.unlocked ? (
                  <>
                    <span aria-hidden="true">🎉 </span>已解鎖：{label}
                    {applied && applied.discountAmount > 0 ? (
                      <span className="ml-1 font-semibold text-gold-700">
                        −NT${applied.discountAmount.toLocaleString()}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <>
                    {label}
                    {hint.kind === 'quantity' ? (
                      <span className="ml-1 text-neutral-600">— 再加 {hint.remaining} 件即解鎖</span>
                    ) : (
                      <span className="ml-1 text-neutral-600">
                        — 差 NT${hint.remaining.toLocaleString()} 解鎖
                      </span>
                    )}
                  </>
                )}
              </p>
              <span className="shrink-0 text-xs tabular-nums text-neutral-600">
                {hint.kind === 'quantity' ? `${hint.current}/${hint.target}` : `${pct}%`}
              </span>
            </div>
            <div
              className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={hint.target}
              aria-valuenow={hint.current}
              aria-label={label}
            >
              <div
                className={hint.unlocked ? 'h-full bg-gold-600' : 'h-full bg-neutral-500'}
                style={{ width: `${pct}%`, transition: 'width 300ms ease' }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
