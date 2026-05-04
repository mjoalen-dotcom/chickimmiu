'use client'

import Image from 'next/image'
import { Heart, MessageCircle, Crown } from 'lucide-react'
import type { FeedItem } from './useSocialGame'

/**
 * SocialFeed — 7 款社交遊戲共用作品列表元件
 *
 * 顯示：
 *   - 投稿者遮罩名稱（已被 server 端 maskName）
 *   - 主要圖片（grid 樣式）
 *   - caption + voteCount + 時間
 *   - vote / like 按鈕（可選）
 *   - 對於接龍類，可標記 parent reference
 */

export interface SocialFeedProps {
  items: FeedItem[]
  loading: boolean
  emptyText?: string
  showVote?: boolean
  showCrown?: boolean // 對 queen-vote 的 top 1 標頂冠
  voteLabel?: string
  onVote?: (item: FeedItem) => void
  onSelect?: (item: FeedItem) => void
  selectedId?: number | string | null
}

function formatRelative(iso: string): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms)) return ''
  if (ms < 60_000) return '剛剛'
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} 分鐘前`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)} 小時前`
  if (ms < 604_800_000) return `${Math.floor(ms / 86_400_000)} 天前`
  return `${Math.floor(ms / 604_800_000)} 週前`
}

export default function SocialFeed({
  items,
  loading,
  emptyText = '目前還沒有作品，當第一個投稿吧！',
  showVote = false,
  showCrown = false,
  voteLabel = '按讚',
  onVote,
  onSelect,
  selectedId,
}: SocialFeedProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-cream-200 p-8 text-center text-sm text-muted-foreground">
        作品載入中...
      </div>
    )
  }
  if (items.length === 0) {
    return (
      <div className="bg-cream-50 rounded-2xl border border-cream-200 p-8 text-center">
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      </div>
    )
  }

  // 排序：voteCount 降序（顯示 ranking 用）；若 showCrown 才生效
  const ranked = showCrown
    ? [...items].sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0))
    : items

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {ranked.map((item, i) => {
        const isSelected = selectedId !== undefined && selectedId === item.id
        const main = item.images?.[0]
        const url = main?.url || main?.thumbnailUrl
        return (
          <div
            key={item.id}
            onClick={onSelect ? () => onSelect(item) : undefined}
            className={`bg-white rounded-2xl border overflow-hidden transition-all ${
              isSelected
                ? 'border-gold-500 ring-2 ring-gold-500/30'
                : 'border-cream-200 hover:border-gold-300'
            } ${onSelect ? 'cursor-pointer' : ''}`}
          >
            {showCrown && i < 3 && (
              <div
                className={`absolute -top-2 -right-2 z-10 px-2 py-1 rounded-full text-[10px] flex items-center gap-1 ${
                  i === 0
                    ? 'bg-gold-500 text-white'
                    : i === 1
                      ? 'bg-gray-400 text-white'
                      : 'bg-amber-700 text-white'
                }`}
              >
                <Crown size={10} />
                {i === 0 ? '冠軍' : i === 1 ? '亞軍' : '季軍'}
              </div>
            )}
            <div className="aspect-square bg-cream-100 relative">
              {url ? (
                <Image
                  src={url}
                  alt={main?.alt || item.caption || '投稿'}
                  fill
                  sizes="(max-width: 768px) 50vw, 33vw"
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                  無圖片
                </div>
              )}
            </div>
            <div className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-foreground/85">
                  {item.playerDisplayName || '會員'}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {formatRelative(item.createdAt)}
                </span>
              </div>
              {item.caption && (
                <p className="text-xs text-foreground/75 line-clamp-2 mb-2 leading-relaxed">
                  {item.caption}
                </p>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <MessageCircle size={12} />
                  {item.voteCount ?? 0}
                </span>
                {showVote && onVote && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onVote(item)
                    }}
                    disabled={item.myLiked}
                    className={`text-xs px-2.5 py-1 rounded-full inline-flex items-center gap-1 transition-colors ${
                      item.myLiked
                        ? 'bg-pink-100 text-pink-600 cursor-default'
                        : 'bg-pink-500 text-white hover:bg-pink-600'
                    }`}
                  >
                    <Heart size={11} fill={item.myLiked ? 'currentColor' : 'none'} />
                    {item.myLiked ? '已' + voteLabel : voteLabel}
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
