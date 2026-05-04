'use client'

/**
 * SocialGameShell — 7 款社交遊戲共用外殼
 * ─────────────────────────────────────
 * 各 stub 遊戲 (style-relay / weekly-challenge / co-create / wish-pool / blind-box /
 * queen-vote / team-style) 統一走這支元件接到 backend：
 *   - useSocialGame(gameType)：撈 feed + submit + vote + wish + createRoom
 *   - <SocialFeed>：列表顯示
 *
 * 不同遊戲的差異透過 props 控制：
 *   - heroContent: 該遊戲的特殊 hero（主題、規則、房間 status 等）
 *   - showSubmitForm: 是否顯示投稿表單
 *   - submitFormProps: 表單行為（wish 模式 / 接龍模式 / 一般模式）
 *   - showVote / showCrown: 是否顯示按讚 / 排行冠軍
 *
 * Backend 已經就位（src/lib/games/socialGameActions.ts），全部走真實 API。
 */
import { useState, type ReactNode } from 'react'
import { Sparkles, Send, Image as ImageIcon, AlertCircle } from 'lucide-react'

import {
  useSocialGame,
  type FeedItem,
  type SocialGameType,
} from './useSocialGame'
import SocialFeed from './SocialFeed'

export type SubmitMode = 'submit' | 'wish' | 'relay'

export interface SocialGameShellProps {
  gameType: SocialGameType
  /** 頁面 hero 區（icon、標題、規則、theme、房間狀態 etc.） */
  heroContent: ReactNode
  /** 投稿模式：'submit' = 圖+文 / 'wish' = 純文字許願 / 'relay' = 圖+選 parent */
  submitMode?: SubmitMode
  /** 是否顯示投稿表單；某些情境（如未登入、活動結束）可隱藏 */
  showSubmitForm?: boolean
  /** 投稿按鈕文字 */
  submitLabel?: string
  /** 投稿說明文字 */
  submitHint?: string
  /** 是否顯示 vote / like 按鈕 */
  showVote?: boolean
  /** 是否顯示排行（top 3 標頂冠） */
  showCrown?: boolean
  /** vote 按鈕文字 */
  voteLabel?: string
  /** feed 為空時的文字 */
  emptyFeedText?: string
}

export default function SocialGameShell({
  gameType,
  heroContent,
  submitMode = 'submit',
  showSubmitForm = true,
  submitLabel = '投稿',
  submitHint,
  showVote = false,
  showCrown = false,
  voteLabel = '按讚',
  emptyFeedText,
}: SocialGameShellProps) {
  const social = useSocialGame(gameType)
  const [caption, setCaption] = useState('')
  const [imagesInput, setImagesInput] = useState('') // 暫用 ID 字串輸入；media upload UI 另案
  const [tagsInput, setTagsInput] = useState('')
  const [bountyPoints, setBountyPoints] = useState<string>('100')
  const [selectedParent, setSelectedParent] = useState<number | string | null>(null)

  const parseImageIds = (raw: string): number[] => {
    return raw
      .split(/[,\s]+/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isInteger(n) && n > 0)
  }

  const parseTags = (raw: string): string[] => {
    return raw
      .split(/[,\s]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .slice(0, 10)
  }

  const handleSubmit = async () => {
    if (submitMode === 'wish') {
      if (caption.trim().length === 0) {
        alert('請輸入願望內容')
        return
      }
      const r = await social.wish({
        title: caption.slice(0, 80),
        description: caption,
        bountyPoints: parseInt(bountyPoints, 10) || 0,
        tags: parseTags(tagsInput),
      })
      if (!r.success) alert(r.error || '提交失敗')
      else {
        setCaption('')
        setTagsInput('')
      }
      return
    }

    const imageIds = parseImageIds(imagesInput)
    if (imageIds.length === 0) {
      alert('請至少輸入 1 個圖片 media ID')
      return
    }

    const params = {
      images: imageIds,
      caption: caption.trim() || undefined,
      tags: parseTags(tagsInput),
      ...(submitMode === 'relay' && selectedParent ? { parent: selectedParent } : {}),
    }

    const r = await social.submit(params)
    if (!r.success) alert(r.error || '投稿失敗')
    else {
      setCaption('')
      setImagesInput('')
      setTagsInput('')
      setSelectedParent(null)
    }
  }

  const handleVote = async (item: FeedItem) => {
    if (item.myLiked) return
    const r = await social.vote(item.id, 'like')
    if (!r.success) alert(r.error || '投票失敗')
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Hero */}
      {heroContent}

      {/* Error banner */}
      {social.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
          <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
          <p className="text-xs text-red-700">{social.error}</p>
        </div>
      )}

      {/* Success message */}
      {social.submitMessage && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
          <Sparkles size={16} className="text-green-600" />
          <p className="text-xs text-green-700">{social.submitMessage}</p>
        </div>
      )}

      {/* Submit form */}
      {showSubmitForm && (
        <div className="bg-white rounded-2xl border border-cream-200 p-5">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Send size={14} className="text-gold-500" />
            {submitMode === 'wish' ? '提出你的穿搭願望' : submitLabel}
          </h3>

          {submitHint && (
            <p className="text-xs text-muted-foreground mb-3">{submitHint}</p>
          )}

          {submitMode === 'relay' && selectedParent !== null && (
            <p className="text-xs text-blue-600 mb-3 bg-blue-50 px-3 py-1.5 rounded-lg">
              繼續接龍：作品 #{selectedParent}（已從下方 feed 選取）
            </p>
          )}

          {submitMode !== 'wish' && (
            <div className="mb-3">
              <label className="text-xs font-medium text-foreground/70 block mb-1.5">
                <ImageIcon size={12} className="inline mr-1" />
                圖片 Media ID（封測階段：admin 上傳到媒體庫後將 ID 填這裡，多 ID 用逗號分隔）
              </label>
              <input
                type="text"
                value={imagesInput}
                onChange={(e) => setImagesInput(e.target.value)}
                placeholder="例：1, 2, 3"
                className="w-full px-3 py-2 text-sm border border-cream-300 rounded-lg focus:outline-none focus:border-gold-500"
              />
            </div>
          )}

          <div className="mb-3">
            <label className="text-xs font-medium text-foreground/70 block mb-1.5">
              {submitMode === 'wish' ? '願望內容' : '說明 / 描述'}
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={
                submitMode === 'wish'
                  ? '描述你想要的穿搭風格 / 場合 / 顏色喜好...'
                  : '一句話介紹你的穿搭'
              }
              rows={3}
              className="w-full px-3 py-2 text-sm border border-cream-300 rounded-lg focus:outline-none focus:border-gold-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs font-medium text-foreground/70 block mb-1.5">
                標籤（逗號分隔，最多 10 個）
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="例：韓系, 復古, 通勤"
                className="w-full px-3 py-2 text-sm border border-cream-300 rounded-lg focus:outline-none focus:border-gold-500"
              />
            </div>
            {submitMode === 'wish' && (
              <div>
                <label className="text-xs font-medium text-foreground/70 block mb-1.5">
                  懸賞點數
                </label>
                <input
                  type="number"
                  min={0}
                  value={bountyPoints}
                  onChange={(e) => setBountyPoints(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-cream-300 rounded-lg focus:outline-none focus:border-gold-500"
                />
              </div>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={social.submitting}
            className="w-full py-3 bg-gradient-to-r from-gold-500 to-amber-600 text-white rounded-xl text-sm font-medium hover:opacity-95 transition-opacity disabled:opacity-50"
          >
            {social.submitting
              ? '送出中...'
              : submitMode === 'wish'
                ? '發送願望'
                : submitLabel}
          </button>
        </div>
      )}

      {/* Feed */}
      <div>
        <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Sparkles size={14} className="text-gold-500" />
          {showCrown ? '本期排行 + 最新作品' : '最新作品'}
          {social.total > 0 && (
            <span className="text-xs text-muted-foreground">（{social.total} 件）</span>
          )}
        </h3>
        <SocialFeed
          items={social.feed}
          loading={social.loading}
          showVote={showVote}
          showCrown={showCrown}
          voteLabel={voteLabel}
          onVote={handleVote}
          onSelect={
            submitMode === 'relay' ? (item) => setSelectedParent(item.id) : undefined
          }
          selectedId={submitMode === 'relay' ? selectedParent : null}
          emptyText={emptyFeedText}
        />
      </div>
    </div>
  )
}
