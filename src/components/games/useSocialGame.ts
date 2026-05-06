'use client'

/**
 * useSocialGame — 7 款社交遊戲共用 hook
 * ──────────────────────────────────────
 * Backend 已經就位（src/lib/games/socialGameActions.ts + 4 條 routes）：
 *   - GET  /api/games/[gameType]/feed   → 撈作品 feed
 *   - POST /api/games/[gameType]/submit → 提交作品（圖片 + 文字）
 *   - POST /api/games/[gameType]/vote   → 投票 / 點讚
 *   - POST /api/games/[gameType]/room   → 建房 / 加房
 *   - POST /api/games/[gameType]/wish   → 許願（wish_pool 專屬）
 *
 * 本 hook 統一各遊戲共用流程：
 *   - 初始載入 feed
 *   - 提交作品（FormData 含 images + caption）
 *   - 投票
 *   - 重新整理 feed
 *
 * 各遊戲 UI 仍保留各自的 hero / theme / room 邏輯，但所有後端 round-trip
 * 走這支 hook 確保一致性 & 簡化測試。
 */
import { useCallback, useEffect, useState } from 'react'

export type SocialGameType =
  | 'style_pk'
  | 'style_relay'
  | 'weekly_challenge'
  | 'co_create'
  | 'blind_box'
  | 'queen_vote'
  | 'team_style'
  | 'wish_pool'

export interface FeedItem {
  id: number | string
  caption: string
  voteCount: number
  createdAt: string
  playerDisplayName: string
  images: Array<{ url: string | null; thumbnailUrl: string | null; alt: string | null }>
  myLiked: boolean
  parent?: number | string | null
  metadata?: Record<string, unknown>
}

export interface SubmitParams {
  images?: number[]
  caption?: string
  tags?: string[]
  parent?: number | string
  wish?: number | string
  room?: number | string
  theme?: string
  metadata?: Record<string, unknown>
}

interface ApiOk<T> {
  success: true
  data: T
}
interface ApiErr {
  success: false
  error: string
  reason?: string
  retryAfter?: number
}
type ApiRes<T> = ApiOk<T> | ApiErr

interface State {
  feed: FeedItem[]
  hasMore: boolean
  total: number
  loading: boolean
  error: string | null
  submitting: boolean
  submitMessage: string | null
}

const initialState = (): State => ({
  feed: [],
  hasMore: false,
  total: 0,
  loading: true,
  error: null,
  submitting: false,
  submitMessage: null,
})

export function useSocialGame(gameType: SocialGameType, autoload = true) {
  const [state, setState] = useState<State>(initialState)

  const fetchFeed = useCallback(
    async (limit = 12, offset = 0) => {
      setState((s) => ({ ...s, loading: true, error: null }))
      try {
        const res = await fetch(`/api/games/${gameType}/feed?limit=${limit}&offset=${offset}`, {
          credentials: 'include',
        })
        const json = (await res.json()) as ApiRes<{
          items: FeedItem[]
          hasMore: boolean
          total: number
        }>
        if (!res.ok || !json.success) {
          setState((s) => ({
            ...s,
            loading: false,
            error: !json.success ? json.error : 'feed 載入失敗',
          }))
          return
        }
        setState((s) => ({
          ...s,
          loading: false,
          feed: json.data.items,
          hasMore: json.data.hasMore,
          total: json.data.total,
        }))
      } catch (err) {
        setState((s) => ({
          ...s,
          loading: false,
          error: err instanceof Error ? err.message : '網路錯誤',
        }))
      }
    },
    [gameType],
  )

  const submit = useCallback(
    async (params: SubmitParams): Promise<ApiRes<unknown>> => {
      setState((s) => ({ ...s, submitting: true, submitMessage: null, error: null }))
      try {
        const res = await fetch(`/api/games/${gameType}/submit`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        })
        const json = (await res.json()) as ApiRes<unknown>
        if (json.success) {
          setState((s) => ({ ...s, submitting: false, submitMessage: '投稿成功！' }))
          // 重抓 feed
          await fetchFeed()
        } else {
          setState((s) => ({
            ...s,
            submitting: false,
            error: json.error,
            submitMessage: null,
          }))
        }
        return json
      } catch (err) {
        const msg = err instanceof Error ? err.message : '網路錯誤'
        setState((s) => ({ ...s, submitting: false, error: msg }))
        return { success: false, error: msg }
      }
    },
    [gameType, fetchFeed],
  )

  const vote = useCallback(
    async (submissionId: number | string, voteType: 'like' | 'pk_pick' | 'star' | 'score' = 'like') => {
      try {
        const res = await fetch(`/api/games/${gameType}/vote`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ submission: submissionId, voteType }),
        })
        const json = (await res.json()) as ApiRes<{ voteCount?: number }>
        if (json.success) {
          // 樂觀更新 feed
          setState((s) => ({
            ...s,
            feed: s.feed.map((item) =>
              item.id === submissionId
                ? {
                    ...item,
                    myLiked: true,
                    voteCount: json.data?.voteCount ?? item.voteCount + 1,
                  }
                : item,
            ),
          }))
        }
        return json
      } catch (err) {
        return {
          success: false as const,
          error: err instanceof Error ? err.message : '網路錯誤',
        }
      }
    },
    [gameType],
  )

  const wish = useCallback(
    async (params: { title: string; description?: string; bountyPoints?: number; tags?: string[] }) => {
      try {
        const res = await fetch(`/api/games/${gameType}/wish`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        })
        const json = (await res.json()) as ApiRes<unknown>
        if (json.success) {
          await fetchFeed()
        }
        return json
      } catch (err) {
        return {
          success: false as const,
          error: err instanceof Error ? err.message : '網路錯誤',
        }
      }
    },
    [gameType, fetchFeed],
  )

  const createRoom = useCallback(
    async (params: { title?: string; description?: string; theme?: string; maxParticipants?: number }) => {
      try {
        const res = await fetch(`/api/games/${gameType}/room`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create', ...params }),
        })
        const json = (await res.json()) as ApiRes<{ inviteCode?: string; room?: { id: number } }>
        return json
      } catch (err) {
        return {
          success: false as const,
          error: err instanceof Error ? err.message : '網路錯誤',
        }
      }
    },
    [gameType],
  )

  useEffect(() => {
    if (autoload) void fetchFeed()
  }, [autoload, fetchFeed])

  return {
    ...state,
    fetchFeed,
    submit,
    vote,
    wish,
    createRoom,
  }
}
