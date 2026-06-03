'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Star, Camera, MessageSquare, Star as StarFill, X, Loader2 } from 'lucide-react'

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

export type PurchasableProduct = {
  id: string
  name: string
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

export default function ReviewsClient({
  reviews,
  purchasable,
}: {
  reviews: AccountReviewLite[]
  purchasable: PurchasableProduct[]
}) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [productId, setProductId] = useState('')
  const [newRating, setNewRating] = useState(0)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const noPurchasable = purchasable.length === 0

  const resetForm = () => {
    setProductId('')
    setNewRating(0)
    setTitle('')
    setContent('')
    setFiles([])
    setError(null)
  }

  const handlePickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    setFiles((prev) => [...prev, ...picked].slice(0, 5))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx))

  const handleSubmit = async () => {
    setError(null)
    if (!productId) return setError('請選擇已購商品')
    if (newRating < 1) return setError('請給 1–5 星評分')
    if (!content.trim()) return setError('請填寫評價內容')

    setSubmitting(true)
    try {
      // 1. 先上傳照片到 Media，收集 id
      const photoIds: string[] = []
      for (const file of files) {
        const fd = new FormData()
        fd.append('file', file)
        const up = await fetch('/api/media', { method: 'POST', body: fd, credentials: 'include' })
        if (!up.ok) throw new Error('照片上傳失敗，請稍後再試')
        const upJson = await up.json().catch(() => ({}))
        const id = upJson?.doc?.id ?? upJson?.id
        if (id) photoIds.push(String(id))
      }

      // 2. 建立評價（reviewer / status 由 server 強制）
      const res = await fetch('/api/account/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ productId, rating: newRating, title, content, photoIds }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) throw new Error(json.error || '提交失敗')

      setToast('✅ 評價已送出，審核通過後會顯示並發放點數')
      setShowForm(false)
      resetForm()
      router.refresh()
      setTimeout(() => setToast(null), 3500)
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失敗')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs tracking-[0.3em] text-gold-500 mb-2">REVIEWS</p>
          <h1 className="text-2xl font-serif">我的評價</h1>
        </div>
        <button
          onClick={() => {
            setError(null)
            setShowForm((v) => !v)
          }}
          className="px-5 py-2.5 bg-gold-500 text-white rounded-xl text-sm hover:bg-gold-600 transition-colors flex items-center gap-2"
        >
          <MessageSquare size={14} />
          撰寫評價
        </button>
      </div>

      {toast && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {toast}
        </div>
      )}

      {/* Write review form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-cream-200 p-6 space-y-4">
          <h3 className="font-medium">撰寫商品評價</h3>

          {noPurchasable ? (
            <p className="text-sm text-muted-foreground py-4">
              完成訂單後即可為購買過的商品撰寫評價並獲得點數。
            </p>
          ) : (
            <>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">選擇已購商品</label>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-cream-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gold-400/40"
                >
                  <option value="">請選擇...</option>
                  {purchasable.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
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
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="一句話形容你的體驗"
                  className="w-full px-4 py-2.5 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
                />
              </div>

              <div>
                <label className="text-sm text-muted-foreground block mb-1">評價內容</label>
                <textarea
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="分享你的穿搭心得、尺寸建議、質感感受..."
                  className="w-full px-4 py-2.5 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40 resize-none"
                />
              </div>

              <div>
                <label className="text-sm text-muted-foreground block mb-2">
                  上傳照片（最多 5 張，附圖評價點數加碼）
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePickFiles}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={files.length >= 5}
                  className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-cream-300 rounded-xl text-sm text-muted-foreground hover:border-gold-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Camera size={18} />
                  點擊上傳照片（{files.length}/5）
                </button>
                {files.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {files.map((f, i) => (
                      <span
                        key={`${f.name}-${i}`}
                        className="inline-flex items-center gap-1.5 max-w-[160px] rounded-full bg-cream-100 border border-cream-200 px-3 py-1 text-xs"
                      >
                        <span className="truncate">{f.name}</span>
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="text-muted-foreground hover:text-red-500 shrink-0"
                          aria-label="移除"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-6 py-2.5 bg-gold-500 text-white rounded-xl text-sm hover:bg-gold-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  {submitting ? '提交中...' : '提交評價'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    resetForm()
                  }}
                  className="px-6 py-2.5 border border-cream-200 rounded-xl text-sm hover:bg-cream-50 transition-colors"
                >
                  取消
                </button>
              </div>
            </>
          )}
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
