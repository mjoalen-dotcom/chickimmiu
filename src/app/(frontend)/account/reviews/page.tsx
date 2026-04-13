'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Star, Camera, MessageSquare } from 'lucide-react'

const DEMO_REVIEWS = [
  {
    id: '1',
    product: 'Serene 名媛蕾絲層次洋裝',
    productImage: 'https://shoplineimg.com/559df3efe37ec64e9f000092/69c140b9f04a564933f21f59/1500x.webp?source_format=png',
    rating: 5,
    title: '質感超好！',
    content: '布料質感真的很好，版型也很修身，搭配高跟鞋超好看。',
    date: '2026-04-06',
    status: 'approved',
    photos: [],
  },
  {
    id: '2',
    product: 'Y2K個性橢圓墨鏡',
    productImage: 'https://shoplineimg.com/559df3efe37ec64e9f000092/69bd18487d7f9fb65f0f78b4/1500x.webp?source_format=png',
    rating: 4,
    title: '很時髦',
    content: '戴起來很有型，但鏡片如果能再暗一點會更好。',
    date: '2026-03-28',
    status: 'approved',
    photos: [],
  },
  {
    id: '3',
    product: 'Quincy 氣質裹身微開衩洋裝',
    productImage: 'https://shoplineimg.com/559df3efe37ec64e9f000092/69b8e8ecf7cad647346583b3/1500x.webp?source_format=png',
    rating: 5,
    title: '約會必穿！',
    content: '穿去約會男友超驚艷，開衩的設計很性感又不會太過。',
    date: '2026-03-22',
    status: 'pending',
    photos: [],
  },
]

function StarRating({ rating, interactive = false, onChange }: { rating: number; interactive?: boolean; onChange?: (r: number) => void }) {
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

export default function ReviewsPage() {
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

          {/* Product select */}
          <div>
            <label className="text-sm text-muted-foreground block mb-1">選擇已購商品</label>
            <select className="w-full px-4 py-2.5 rounded-xl border border-cream-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gold-400/40">
              <option value="">請選擇...</option>
              <option value="1">Serene 名媛蕾絲層次洋裝 (ORD-20260401)</option>
              <option value="2">Y2K個性橢圓墨鏡 (ORD-20260320)</option>
            </select>
          </div>

          {/* Rating */}
          <div>
            <label className="text-sm text-muted-foreground block mb-2">評分</label>
            <StarRating rating={newRating} interactive onChange={setNewRating} />
          </div>

          {/* Title */}
          <div>
            <label className="text-sm text-muted-foreground block mb-1">標題</label>
            <input
              type="text"
              placeholder="一句話形容你的體驗"
              className="w-full px-4 py-2.5 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
            />
          </div>

          {/* Content */}
          <div>
            <label className="text-sm text-muted-foreground block mb-1">評價內容</label>
            <textarea
              rows={4}
              placeholder="分享你的穿搭心得、尺寸建議、質感感受..."
              className="w-full px-4 py-2.5 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40 resize-none"
            />
          </div>

          {/* Photo upload */}
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

          {/* Submit */}
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
      <div className="space-y-4">
        {DEMO_REVIEWS.map((review) => (
          <div key={review.id} className="bg-white rounded-2xl border border-cream-200 p-5">
            <div className="flex gap-4">
              <div className="w-16 h-20 rounded-lg overflow-hidden relative shrink-0 border border-cream-200">
                <Image
                  src={review.productImage}
                  alt={review.product}
                  fill
                  className="object-cover"
                  sizes="64px"
                  unoptimized
                />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium">{review.product}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <StarRating rating={review.rating} />
                      <span className="text-xs text-muted-foreground">{review.date}</span>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full ${
                      review.status === 'approved'
                        ? 'bg-green-50 text-green-600'
                        : 'bg-yellow-50 text-yellow-600'
                    }`}
                  >
                    {review.status === 'approved' ? '已發布' : '審核中'}
                  </span>
                </div>
                <p className="text-sm font-medium mt-2">{review.title}</p>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{review.content}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
