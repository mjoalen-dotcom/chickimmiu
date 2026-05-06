'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Upload, Heart, RefreshCw, X } from 'lucide-react'

interface Props { settings: Record<string, unknown> }

/**
 * 穿搭 PK 對戰 — 接通 /api/games/style_pk/(feed|submit|vote) 版本
 * ─────────────────────────────────────────────────────────────
 *
 * UI 兩個分頁：
 *   Vote   — fetch /api/games/style_pk/feed 取作品，兩兩配對成 PK 卡片，可 like 投票
 *   Submit — 上傳一張圖 + 文案 → /api/media → /api/games/style_pk/submit
 *
 * PR-3 scope：投票僅用 `like` voteType（UNIQUE 擋重複、beforeChange 擋 self-vote）。
 * 房間配對 / pk_pick 1v1 配對流程留給後續 PR（需要 room + settle endpoint）。
 */

interface FeedImage {
  url: string | null
  thumbnailUrl: string | null
  alt: string
}

interface FeedItem {
  id: number | string
  caption: string
  voteCount: number
  createdAt: string
  playerDisplayName: string
  isMine: boolean
  images: FeedImage[]
  myLiked: boolean
}

interface FeedResponse {
  success: boolean
  error?: string
  data?: {
    items: FeedItem[]
    hasMore: boolean
    total: number
  }
}

type Tab = 'vote' | 'submit'

const DEFAULT_VOTER_POINTS = 3
const DEFAULT_WINNER_POINTS = 50
const MAX_CAPTION_LEN = 500
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

export function StylePKGame({ settings }: Props) {
  const voterPoints = (settings.voterPoints as number) || DEFAULT_VOTER_POINTS
  const winnerPoints = (settings.winnerPoints as number) || DEFAULT_WINNER_POINTS

  const [tab, setTab] = useState<Tab>('vote')
  const [authError, setAuthError] = useState(false)

  // ── Feed state ──
  const [feedItems, setFeedItems] = useState<FeedItem[]>([])
  const [loadingFeed, setLoadingFeed] = useState(false)
  const [feedError, setFeedError] = useState<string | null>(null)
  const [votingIds, setVotingIds] = useState<Set<string>>(new Set())
  const [voteMsg, setVoteMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  // ── Submit state ──
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const fetchFeed = useCallback(async () => {
    setLoadingFeed(true)
    setFeedError(null)
    try {
      const res = await fetch('/api/games/style_pk/feed?limit=12', {
        credentials: 'include',
      })
      if (res.status === 401) {
        setAuthError(true)
        return
      }
      const json = (await res.json()) as FeedResponse
      if (!res.ok || !json.success || !json.data) {
        setFeedError(json.error || `無法載入投稿 (HTTP ${res.status})`)
        return
      }
      setFeedItems(json.data.items)
    } catch (err) {
      setFeedError(err instanceof Error ? err.message : '網路錯誤')
    } finally {
      setLoadingFeed(false)
    }
  }, [])

  useEffect(() => {
    fetchFeed()
  }, [fetchFeed])

  // 清理 object URL
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleVote = useCallback(
    async (submission: FeedItem) => {
      if (submission.isMine) {
        setVoteMsg({ kind: 'err', text: '不能對自己的作品投票' })
        return
      }
      if (submission.myLiked) return

      const key = String(submission.id)
      if (votingIds.has(key)) return

      setVotingIds((prev) => {
        const next = new Set(prev)
        next.add(key)
        return next
      })
      setVoteMsg(null)

      // 樂觀更新
      setFeedItems((items) =>
        items.map((it) =>
          it.id === submission.id
            ? { ...it, myLiked: true, voteCount: it.voteCount + 1 }
            : it,
        ),
      )

      try {
        const res = await fetch('/api/games/style_pk/vote', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ submissionId: submission.id, voteType: 'like' }),
        })
        const json = (await res.json()) as {
          success: boolean
          error?: string
          reason?: string
        }
        if (res.ok && json.success) {
          setVoteMsg({ kind: 'ok', text: `投票成功，獲得 ${voterPoints} 點` })
          return
        }
        // 失敗 → 回捲 optimistic update（duplicate 例外：server 說「已投」= 保持樂觀結果）
        if (json.reason === 'duplicate_vote') {
          setVoteMsg({ kind: 'ok', text: '你已經投過這份作品' })
          return
        }
        setFeedItems((items) =>
          items.map((it) =>
            it.id === submission.id
              ? {
                  ...it,
                  myLiked: false,
                  voteCount: Math.max(0, it.voteCount - 1),
                }
              : it,
          ),
        )
        setVoteMsg({
          kind: 'err',
          text: json.error || `投票失敗 (HTTP ${res.status})`,
        })
      } catch (err) {
        setFeedItems((items) =>
          items.map((it) =>
            it.id === submission.id
              ? {
                  ...it,
                  myLiked: false,
                  voteCount: Math.max(0, it.voteCount - 1),
                }
              : it,
          ),
        )
        setVoteMsg({
          kind: 'err',
          text: err instanceof Error ? err.message : '網路錯誤',
        })
      } finally {
        setVotingIds((prev) => {
          const next = new Set(prev)
          next.delete(key)
          return next
        })
      }
    },
    [votingIds, voterPoints],
  )

  const handleFilePick = useCallback(
    (f: File | null) => {
      setSubmitError(null)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      if (!f) {
        setFile(null)
        setPreviewUrl(null)
        return
      }
      if (!/^image\/(jpeg|png|webp|gif)$/i.test(f.type)) {
        setSubmitError('僅支援 JPEG / PNG / WEBP / GIF')
        return
      }
      if (f.size > MAX_IMAGE_BYTES) {
        setSubmitError('圖片超過 8 MB 上限')
        return
      }
      setFile(f)
      setPreviewUrl(URL.createObjectURL(f))
    },
    [previewUrl],
  )

  const handleSubmit = useCallback(async () => {
    if (submitting) return
    if (!file) {
      setSubmitError('請先選擇一張圖片')
      return
    }
    if (caption.length > MAX_CAPTION_LEN) {
      setSubmitError(`文案最多 ${MAX_CAPTION_LEN} 字`)
      return
    }
    setSubmitError(null)
    setSubmitting(true)
    try {
      // 1) 上傳圖片 → Media collection
      const form = new FormData()
      form.append('file', file)
      form.append(
        '_payload',
        JSON.stringify({
          alt: caption.slice(0, 60) || '穿搭 PK 投稿',
          // 文字標籤；real folder 關聯由 admin 手動指派或後續 PR 自動化
          folderName: 'ugc/style-pk',
        }),
      )
      const upRes = await fetch('/api/media', {
        method: 'POST',
        credentials: 'include',
        body: form,
      })
      if (upRes.status === 401) {
        setAuthError(true)
        return
      }
      const upJson = (await upRes.json()) as { doc?: { id?: number | string }; errors?: unknown; message?: string }
      if (!upRes.ok || !upJson.doc?.id) {
        setSubmitError(upJson.message || `圖片上傳失敗 (HTTP ${upRes.status})`)
        return
      }
      const mediaId = upJson.doc.id

      // 2) 建立 submission
      const subRes = await fetch('/api/games/style_pk/submit', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: [mediaId],
          caption: caption.trim() || undefined,
        }),
      })
      const subJson = (await subRes.json()) as {
        success: boolean
        error?: string
        reason?: string
      }
      if (subRes.status === 401) {
        setAuthError(true)
        return
      }
      if (!subRes.ok || !subJson.success) {
        setSubmitError(subJson.error || `投稿失敗 (HTTP ${subRes.status})`)
        return
      }

      setSubmitted(true)
      // 重新抓 feed，讓新作品出現在 vote 分頁
      fetchFeed()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '網路錯誤')
    } finally {
      setSubmitting(false)
    }
  }, [submitting, file, caption, fetchFeed])

  const resetSubmitForm = useCallback(() => {
    setSubmitted(false)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(null)
    setPreviewUrl(null)
    setCaption('')
    setSubmitError(null)
  }, [previewUrl])

  // ── 未登入 ──
  if (authError) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <p className="text-lg mb-4">請先登入才能參加穿搭 PK</p>
        <a
          href="/login?redirect=/games/style-pk"
          className="inline-block px-6 py-2.5 bg-gold-500 text-white rounded-full text-sm hover:bg-gold-600 transition-colors"
        >
          前往登入
        </a>
      </div>
    )
  }

  // Pair-up client-side：每 2 個作品做一張 PK 卡
  const pairs: Array<[FeedItem, FeedItem | null]> = []
  for (let i = 0; i < feedItems.length; i += 2) {
    pairs.push([feedItems[i], feedItems[i + 1] ?? null])
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Tab */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('vote')}
          className={`flex-1 py-2.5 rounded-xl text-sm transition-all ${
            tab === 'vote' ? 'bg-foreground text-cream-50' : 'bg-white border border-cream-200'
          }`}
        >
          🗳️ 投票
        </button>
        <button
          onClick={() => setTab('submit')}
          className={`flex-1 py-2.5 rounded-xl text-sm transition-all ${
            tab === 'submit' ? 'bg-foreground text-cream-50' : 'bg-white border border-cream-200'
          }`}
        >
          📸 投稿
        </button>
      </div>

      {/* ── Vote tab ── */}
      {tab === 'vote' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">最新投稿 · 點 ♥ 投票</p>
            <button
              onClick={fetchFeed}
              disabled={loadingFeed}
              className="inline-flex items-center gap-1 text-xs text-gold-600 hover:text-gold-700 disabled:opacity-50"
            >
              <RefreshCw size={12} className={loadingFeed ? 'animate-spin' : ''} />
              {loadingFeed ? '載入中' : '重新整理'}
            </button>
          </div>

          {feedError && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-center text-sm text-rose-600">
              {feedError}
            </div>
          )}

          {voteMsg && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-xl px-4 py-2 text-center text-xs ${
                voteMsg.kind === 'ok'
                  ? 'bg-gold-500/10 text-gold-600'
                  : 'bg-rose-50 text-rose-600 border border-rose-200'
              }`}
            >
              {voteMsg.text}
            </motion.div>
          )}

          {!loadingFeed && pairs.length === 0 && !feedError && (
            <div className="text-center py-14 bg-white rounded-2xl border border-cream-200">
              <p className="text-4xl mb-3">⚔️</p>
              <p className="text-sm text-muted-foreground mb-4">還沒有任何投稿，搶先上傳開啟 PK！</p>
              <button
                onClick={() => setTab('submit')}
                className="px-5 py-2 bg-foreground text-cream-50 rounded-full text-sm"
              >
                立即投稿
              </button>
            </div>
          )}

          {pairs.map(([left, right], idx) => (
            <div
              key={`pair-${left.id}-${right?.id ?? 'solo'}`}
              className="bg-white rounded-2xl border border-cream-200 overflow-hidden"
            >
              <div className="px-4 py-2 bg-cream-50 border-b border-cream-200 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">PK #{idx + 1}</span>
                <span className="text-[10px] text-gold-600">投票獲 {voterPoints} 點</span>
              </div>
              <div className="flex">
                <PKSide
                  item={left}
                  voting={votingIds.has(String(left.id))}
                  onVote={() => handleVote(left)}
                />
                <div className="flex items-center px-2">
                  <div className="w-10 h-10 rounded-full bg-foreground text-cream-50 flex items-center justify-center text-xs font-bold">
                    VS
                  </div>
                </div>
                {right ? (
                  <PKSide
                    item={right}
                    voting={votingIds.has(String(right.id))}
                    onVote={() => handleVote(right)}
                  />
                ) : (
                  <div className="flex-1 p-6 text-center flex items-center justify-center text-muted-foreground text-xs">
                    等待對手投稿
                  </div>
                )}
              </div>
            </div>
          ))}

          {feedItems.length > 0 && (
            <p className="text-center text-xs text-muted-foreground">
              每次投票獲得 {voterPoints} 點 · 勝出者獲得 {winnerPoints} 點
            </p>
          )}
        </div>
      )}

      {/* ── Submit tab ── */}
      {tab === 'submit' && (
        <div className="text-center">
          {submitted ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-10">
              <p className="text-4xl mb-4">⚔️</p>
              <p className="text-lg font-serif mb-2">穿搭已提交！</p>
              <p className="text-sm text-muted-foreground mb-6">
                作品已進入投票池，回到投票分頁看看吧 ✨
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => {
                    resetSubmitForm()
                    setTab('vote')
                  }}
                  className="px-5 py-2.5 bg-foreground text-cream-50 rounded-full text-sm"
                >
                  看投票池
                </button>
                <button
                  onClick={resetSubmitForm}
                  className="px-5 py-2.5 bg-gold-500/10 text-gold-600 rounded-full text-sm"
                >
                  再投一件
                </button>
              </div>
            </motion.div>
          ) : (
            <div>
              <label
                htmlFor="style-pk-image"
                className={`block w-full aspect-[3/4] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center mb-4 cursor-pointer transition-colors overflow-hidden relative ${
                  previewUrl
                    ? 'border-gold-400 bg-black'
                    : 'border-cream-300 bg-cream-50 hover:border-gold-400'
                }`}
              >
                {previewUrl ? (
                  <>
                    {/* Preview：用 <Image> 很費事（blob URL），用原生 img 合理 */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt="預覽"
                      className="w-full h-full object-contain"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        handleFilePick(null)
                        if (fileInputRef.current) fileInputRef.current.value = ''
                      }}
                      className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-full hover:bg-black/80"
                      aria-label="清除圖片"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <Upload size={32} className="text-cream-300 mb-3" />
                    <p className="text-sm text-muted-foreground">上傳你的穿搭照</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      JPEG / PNG / WEBP / GIF · 8 MB 內
                    </p>
                  </>
                )}
              </label>
              <input
                id="style-pk-image"
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(e) => handleFilePick(e.target.files?.[0] ?? null)}
                className="sr-only"
              />
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION_LEN))}
                placeholder="描述你的穿搭風格（選填）"
                className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-gold-400/40"
              />
              <p className="text-[10px] text-muted-foreground mb-4 text-right">
                {caption.length} / {MAX_CAPTION_LEN}
              </p>
              {submitError && (
                <p className="text-sm text-rose-600 mb-3">{submitError}</p>
              )}
              <button
                onClick={handleSubmit}
                disabled={submitting || !file}
                className="w-full py-3 bg-foreground text-cream-50 rounded-xl text-sm tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? '送出中...' : '提交穿搭 PK'}
              </button>
              <p className="text-[10px] text-muted-foreground mt-3">
                每日投稿上限 5 件，超過會被擋
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── PK side 卡：左右共用 ──

function PKSide({
  item,
  voting,
  onVote,
}: {
  item: FeedItem
  voting: boolean
  onVote: () => void
}) {
  const cover = item.images[0]
  return (
    <button
      type="button"
      onClick={onVote}
      disabled={voting || item.myLiked || item.isMine}
      className={`flex-1 p-3 text-center transition-all ${
        item.myLiked
          ? 'bg-gold-500/10'
          : item.isMine
            ? 'bg-cream-100/50 cursor-default'
            : 'hover:bg-cream-50'
      }`}
      aria-label={`為 ${item.playerDisplayName} 投票`}
    >
      <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden bg-cream-100 mb-2">
        {cover?.url ? (
          <Image
            src={cover.url}
            alt={cover.alt || item.playerDisplayName}
            fill
            sizes="(max-width: 640px) 45vw, 240px"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl">👗</div>
        )}
      </div>
      <p className="text-sm font-medium truncate">{item.playerDisplayName}</p>
      {item.caption && (
        <p className="text-[10px] text-muted-foreground mb-2 line-clamp-1">
          {item.caption}
        </p>
      )}
      <div className="flex items-center justify-center gap-1 text-xs text-pink-500">
        <Heart
          size={12}
          fill={item.myLiked ? 'currentColor' : 'none'}
          className={voting ? 'animate-pulse' : ''}
        />
        {item.voteCount}
      </div>
      {item.isMine && (
        <p className="text-[10px] text-muted-foreground mt-1">（這是你的作品）</p>
      )}
    </button>
  )
}
