'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Star, Camera, MessageSquare, Star as StarFill } from 'lucide-react'

export type AccountReviewLite = {
  id: string
  productName: string
  productImage: string | null
  rating: number
  title: string
  content: string
  date: string
  status: string
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  approved: { label: '已發布', color: 'text-green-600', bg: 'bg-green-50' },
  pending: { label: '審核中', color: 'text-yellow-600', bg: 'bg-yellow-50' },
  rejected: { label: '未通過', color: 'text-red-600', bg: 'bg-red-50' },
}

function StarRating({
  rating,
  interactive = false,
  onChange,
}: {
  rating: number
  interactive?: boolean
  onChange?: (r: number) => void
}) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          disabled={!interactive}
          onClick={() => onChange?.(s)}
          className={interactive ? 'cursor-pointer' : 'cursor-default'}
        >
          <Star
            size={interactive ? 24 : 14}
            className={s <= rating ? 'text-gold-500 fill-gold-500' : 'text-cream-300'}
          />
        </button>
      ))}
    </div>
  )
}

export default function ReviewsClient({ reviews }: { reviews: AccountReviewLite[] }) {
  const [showForm, setShowForm] = useState(false)
  const [newRating, setNewRating] = useState(0)

  return (
    <main className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs tracking-[0.3em] text-gold-500 mb-2">REVIEWS</p>
          <h1 className="text-2xl font-serif">我的評價</h1>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-5 py-2.5 bg-gold-500 text-white rounded-xl text-sm hover:bg-gold-600 transition-colors flex items-center gap-2"
        >
          <MessageSquare size={14} />
          撰寫評價
        </button>
      </div>

      {/* Write review form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-cream-200 p-6 space-y-4">
          <h3 className="font-medium">撰寫商品評價</h3>

          <div>
            <label className="text-sm text-muted-foreground block mb-1">選擇已購商品</label>
            <select className="w-full px-4 py-2.5 rounded-xl border border-cream-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gold-400/40">
              <option value="">請選擇...</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-muted-foreground block mb-2">評分</label>
            <StarRating rating={newRating} interactive onChange={setNewRating} />
          </div>

          <div>
            <label className="text-sm text-muted-foreground block mb-1">標題</label>
            <input
              type="text"
              placeholder="一句話形容你的體驗"
              className="w-full px-4 py-2.5 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground block mb-1">評價內容</label>
            <textarea
              rows={4}
              placeholder="分享你的穿搭心得、尺寸建議、質感感受..."
              className="w-full px-4 py-2.5 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40 resize-none"
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground block mb-2">上傳照片（最多 5 張）</label>
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-cream-300 rounded-xl text-sm text-muted-foreground hover:border-gold-400 transition-colors"
            >
              <Camera size={18} />
              點擊上傳照片
            </button>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              className="px-6 py-2.5 bg-gold-500 text-white rounded-xl text-sm hover:bg-gold-600 transition-colors"
            >
              提交評價
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-6 py-2.5 border border-cream-200 rounded-xl text-sm hover:bg-cream-50 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Review list */}
      {reviews.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-cream-200">
          <StarFill size={48} className="mx-auto text-cream-200 mb-4" />
          <p className="text-sm text-muted-foreground mb-2">目前還沒有評價紀錄</p>
          <p className="text-xs text-muted-foreground">完成訂單後即可為商品撰寫評價並獲得點數</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => {
            const statusInfo = STATUS_MAP[review.status] ?? STATUS_MAP.pending
            return (
              <div key={review.id} className="bg-white rounded-2xl border border-cream-200 p-5">
                <div className="flex gap-4">
                  {review.productImage ? (
                    <div className="w-16 h-20 rounded-lg overflow-hidden relative shrink-0 border border-cream-200">
                      <Image
                        src={review.productImage}
                        alt={review.productName}
                        fill
                        className="object-cover"
                        sizes="64px"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-20 rounded-lg shrink-0 bg-cream-100 border border-cream-200 flex items-center justify-center">
                      <Star size={20} className="text-cream-300" />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">{review.productName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <StarRating rating={review.rating} />
                          <span className="text-xs text-muted-foreground">{review.date}</span>
                        </div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusInfo.bg} ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    {review.title && <p className="text-sm font-medium mt-2">{review.title}</p>}
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{review.content}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
