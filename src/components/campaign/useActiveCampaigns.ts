'use client'

/**
 * useActiveCampaigns — 前台活動資料共享 hook（CHIC Commerce OS P0-C）
 *
 * - 模組層快取（60s TTL + 進行中 promise 去重）：首頁 banner、PLP badge、
 *   cart progress 共用同一次 /api/campaigns/active 抓取。
 * - serverNow → offsetMs：倒數一律用「server 時間 + 本地流逝」計算，
 *   refresh 不會重置、client 時鐘不影響（doc §8.1）。
 */
import { useEffect, useState } from 'react'

export interface ActiveCampaign {
  id: number | string
  slug: string
  name: string
  headline: string | null
  badgeText: string | null
  ctaText: string | null
  ctaHref: string | null
  startAt: string | null
  endAt: string | null
  surfaces: string[]
  scopeSummary: {
    includeProducts: Array<number | string>
    includeCategories: Array<number | string>
    excludeProducts: Array<number | string>
    excludeCategories: Array<number | string>
    excludeTags: string[]
  } | null
}

export interface ActiveCampaignsState {
  loaded: boolean
  enabled: boolean
  campaigns: ActiveCampaign[]
  /** serverNow - clientNow（ms）；serverTime() = Date.now() + offsetMs */
  offsetMs: number
}

const EMPTY: ActiveCampaignsState = { loaded: false, enabled: false, campaigns: [], offsetMs: 0 }
const TTL_MS = 60_000

let cache: { state: ActiveCampaignsState; fetchedAt: number } | null = null
let inflight: Promise<ActiveCampaignsState> | null = null

async function fetchActive(): Promise<ActiveCampaignsState> {
  try {
    const res = await fetch('/api/campaigns/active', { credentials: 'include' })
    if (!res.ok) return { ...EMPTY, loaded: true }
    const json = (await res.json()) as {
      ok?: boolean
      storefrontEnabled?: boolean
      serverNow?: string
      campaigns?: ActiveCampaign[]
    }
    const serverNow = json.serverNow ? Date.parse(json.serverNow) : Date.now()
    return {
      loaded: true,
      enabled: Boolean(json.storefrontEnabled),
      campaigns: Array.isArray(json.campaigns) ? json.campaigns : [],
      offsetMs: serverNow - Date.now(),
    }
  } catch {
    return { ...EMPTY, loaded: true }
  }
}

export function getActiveCampaigns(): Promise<ActiveCampaignsState> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) return Promise.resolve(cache.state)
  if (inflight) return inflight
  inflight = fetchActive().then((state) => {
    cache = { state, fetchedAt: Date.now() }
    inflight = null
    return state
  })
  return inflight
}

export function useActiveCampaigns(): ActiveCampaignsState {
  const [state, setState] = useState<ActiveCampaignsState>(cache?.state ?? EMPTY)
  useEffect(() => {
    let alive = true
    getActiveCampaigns().then((s) => {
      if (alive) setState(s)
    })
    return () => {
      alive = false
    }
  }, [])
  return state
}

/** 商品是否落在活動 scope 內（badge 顯示判斷；與 server evaluator 同語意的簡化版） */
export function productMatchesCampaign(
  campaign: ActiveCampaign,
  product: { id: number | string; categoryIds?: Array<number | string>; tags?: string[] },
): boolean {
  const s = campaign.scopeSummary
  if (!s) return false
  const pid = String(product.id)
  const cats = new Set((product.categoryIds ?? []).map(String))
  const tags = new Set(product.tags ?? [])
  if (s.excludeProducts.some((p) => String(p) === pid)) return false
  if (s.excludeCategories.some((c) => cats.has(String(c)))) return false
  if (s.excludeTags.some((t) => tags.has(t))) return false
  const hasInclude = s.includeProducts.length > 0 || s.includeCategories.length > 0
  if (!hasInclude) return true
  if (s.includeProducts.some((p) => String(p) === pid)) return true
  if (s.includeCategories.some((c) => cats.has(String(c)))) return true
  return false
}
