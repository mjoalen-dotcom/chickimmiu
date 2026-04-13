'use client'

import { useState, useEffect, useCallback } from 'react'

/* ── 服務項目 ── */
const SERVICE_TYPES = [
  { key: 'fashion_consultant', emoji: '👗', label: '時尚購物顧問' },
  { key: 'size_consultation', emoji: '📐', label: '尺寸諮詢' },
  { key: 'custom_order', emoji: '✂️', label: '客製化訂購' },
  { key: 'restaurant', emoji: '🍽️', label: '訂餐廳' },
  { key: 'michelin', emoji: '⭐', label: '米其林餐廳' },
  { key: 'tickets', emoji: '🎫', label: '演唱會 / 門票' },
  { key: 'gifts', emoji: '💐', label: '訂花 / 蛋糕 / 禮物' },
  { key: 'travel', emoji: '🏨', label: '酒店 / 旅行' },
  { key: 'private_event', emoji: '🎉', label: '私人活動' },
  { key: 'beauty_fitness', emoji: '💆', label: '美容 / 健身' },
  { key: 'chauffeur', emoji: '🚗', label: '專車接送' },
  { key: 'other', emoji: '✨', label: '其他需求' },
] as const

type ServiceKey = (typeof SERVICE_TYPES)[number]['key']

/* ── 狀態標籤設定 ── */
const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  submitted: { label: '已提交', bg: 'bg-blue-100', text: 'text-blue-700' },
  ai_processing: { label: 'AI 處理中', bg: 'bg-purple-100', text: 'text-purple-700' },
  assigned: { label: '已指派', bg: 'bg-amber-100', text: 'text-amber-700' },
  in_progress: { label: '處理中', bg: 'bg-orange-100', text: 'text-orange-700' },
  pending_confirmation: { label: '待確認', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  completed: { label: '已完成', bg: 'bg-green-100', text: 'text-green-700' },
  cancelled: { label: '已取消', bg: 'bg-gray-100', text: 'text-gray-500' },
}

/* ── 型別 ── */
interface ConciergeRequest {
  id: string
  serviceType: string
  description: string
  status: string
  priority?: string
  urgent?: boolean
  preferredDate?: string
  preferredTime?: string
  location?: string
  budget?: string
  numberOfPeople?: number
  specialRequirements?: string
  assignedConcierge?: string
  conciergeNotes?: string
  aiSuggestions?: string
  createdAt: string
  updatedAt: string
}

interface FormData {
  description: string
  preferredDate: string
  preferredTime: string
  location: string
  budget: string
  numberOfPeople: string
  specialRequirements: string
  urgent: boolean
}

const INITIAL_FORM: FormData = {
  description: '',
  preferredDate: '',
  preferredTime: '',
  location: '',
  budget: '',
  numberOfPeople: '',
  specialRequirements: '',
  urgent: false,
}

export default function ConciergePage() {
  const [isT5, setIsT5] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<ConciergeRequest[]>([])
  const [selectedService, setSelectedService] = useState<ServiceKey | null>(null)
  const [form, setForm] = useState<FormData>(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [conciergeName, setConciergeName] = useState('您的專屬管家')
  const [isBirthdayMonth, setIsBirthdayMonth] = useState(false)

  /* ── 載入資料 ── */
  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch('/api/concierge', { credentials: 'include' })
      const json = await res.json()
      if (json.success) {
        setRequests(json.data?.docs || json.data || [])
        if (json.meta?.conciergeName) {
          setConciergeName(json.meta.conciergeName)
        }
        if (json.meta?.isBirthdayMonth) {
          setIsBirthdayMonth(true)
        }
        setIsT5(true)
      } else if (res.status === 403) {
        setIsT5(false)
      }
    } catch {
      // 初始化時允許失敗，使用 demo 模式
      setIsT5(true)
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  /* ── 提交請求 ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedService || !form.description.trim()) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/concierge', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceType: selectedService,
          description: form.description,
          preferredDate: form.preferredDate || undefined,
          preferredTime: form.preferredTime || undefined,
          location: form.location || undefined,
          budget: form.budget || undefined,
          numberOfPeople: form.numberOfPeople
            ? parseInt(form.numberOfPeople, 10)
            : undefined,
          specialRequirements: form.specialRequirements || undefined,
          urgent: form.urgent,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setSelectedService(null)
        setForm(INITIAL_FORM)
        await fetchRequests()
      }
    } catch {
      // 提交失敗
    } finally {
      setSubmitting(false)
    }
  }

  /* ── 取消請求 ── */
  const handleCancel = async (requestId: string) => {
    try {
      const res = await fetch(`/api/concierge/${requestId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      })
      const json = await res.json()
      if (json.success) {
        await fetchRequests()
      }
    } catch {
      // 取消失敗
    }
  }

  /* ── 骨架載入 ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FDF8F3] to-white p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Hero skeleton */}
          <div className="h-48 rounded-2xl bg-gradient-to-r from-[#F5EDE0] to-[#FDF8F3] animate-pulse" />
          {/* Grid skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-2xl bg-white/60 animate-pulse border border-[#E8D5B8]/50"
              />
            ))}
          </div>
          {/* List skeleton */}
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-20 rounded-2xl bg-white/60 animate-pulse border border-[#E8D5B8]/50"
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  /* ── 非 T5 會員提示 ── */
  if (isT5 === false) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FDF8F3] to-white flex items-center justify-center p-6">
        <div className="bg-white/80 backdrop-blur rounded-2xl shadow-lg border border-[#E8D5B8] p-12 text-center max-w-md">
          <div className="text-5xl mb-6">👑</div>
          <h2 className="text-xl font-serif text-[#2C2C2C] mb-3">
            璀璨天后私人生活管家
          </h2>
          <p className="text-[#2C2C2C]/60 mb-6 leading-relaxed">
            此服務僅限璀璨天后會員使用
          </p>
          <div className="inline-block bg-gradient-to-r from-[#C19A5B] to-[#D4AF63] text-white text-sm px-6 py-2.5 rounded-full">
            升級至璀璨天后解鎖管家服務
          </div>
        </div>
      </div>
    )
  }

  /* ── 主要頁面 ── */
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FDF8F3] to-white">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* ═══════════ 1. 頂部歡迎區 ═══════════ */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#C19A5B] to-[#D4AF63] p-8 md:p-12 text-white shadow-xl">
          {/* 裝飾圓 */}
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/10 rounded-full" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/5 rounded-full" />
          <div className="relative z-10">
            <p className="text-sm tracking-widest uppercase opacity-80 mb-2">
              CHIC KIM &amp; MIU
            </p>
            <h1 className="text-2xl md:text-3xl font-serif mb-3">
              璀璨天后私人生活管家
            </h1>
            <p className="text-white/80 text-sm md:text-base leading-relaxed max-w-xl mb-6">
              您的專屬管家隨時為您服務。無論是時尚造型、頂級餐廳、旅行安排或任何生活需求，
              我們都將竭誠為您打理一切。
            </p>
            <div className="flex flex-wrap gap-6">
              <div>
                <p className="text-xs text-white/60 mb-1">您的專屬管家</p>
                <p className="font-medium">{conciergeName}</p>
              </div>
              <div>
                <p className="text-xs text-white/60 mb-1">回覆保證</p>
                <p className="font-medium">30 分鐘內回覆</p>
              </div>
              <div>
                <p className="text-xs text-white/60 mb-1">服務時間</p>
                <p className="font-medium">全年無休 24/7</p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════ 生日月特別提示 ═══════════ */}
        {isBirthdayMonth && (
          <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#D4AF63]/20 via-[#C19A5B]/10 to-[#D4AF63]/20 border-2 border-[#C19A5B]/40 p-6">
            <div className="absolute top-2 right-4 text-3xl opacity-30">🎂</div>
            <div className="flex items-start gap-4">
              <span className="text-3xl">🎉</span>
              <div>
                <h3 className="font-serif text-[#C19A5B] text-lg mb-1">
                  生日月快樂！專屬升級服務
                </h3>
                <p className="text-sm text-[#2C2C2C]/70 leading-relaxed">
                  本月您的管家服務已升級！享有免費米其林餐廳訂位優先權、生日花束安排、
                  以及專屬造型諮詢一次。請直接向管家提出需求。
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ═══════════ 2. 服務項目卡片 ═══════════ */}
        <section>
          <h2 className="text-lg font-serif text-[#2C2C2C] mb-4">
            服務項目
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {SERVICE_TYPES.map((s) => {
              const isActive = selectedService === s.key
              return (
                <button
                  key={s.key}
                  onClick={() =>
                    setSelectedService(isActive ? null : s.key)
                  }
                  className={`
                    group relative bg-white/80 backdrop-blur rounded-2xl p-5 text-left
                    border transition-all duration-300 ease-out
                    hover:scale-105 hover:shadow-lg
                    ${
                      isActive
                        ? 'border-[#C19A5B] shadow-lg shadow-[#C19A5B]/20 scale-105'
                        : 'border-[#E8D5B8] hover:border-[#C19A5B]/50'
                    }
                  `}
                >
                  <span className="text-3xl block mb-3">{s.emoji}</span>
                  <span className="text-sm font-medium text-[#2C2C2C]">
                    {s.label}
                  </span>
                  {isActive && (
                    <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-[#C19A5B]" />
                  )}
                </button>
              )
            })}
          </div>
        </section>

        {/* ═══════════ 3. 新增請求表單 ═══════════ */}
        {selectedService && (
          <section className="bg-white/80 backdrop-blur rounded-2xl shadow-lg border border-[#E8D5B8] p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-2xl">
                {SERVICE_TYPES.find((s) => s.key === selectedService)?.emoji}
              </span>
              <h3 className="text-lg font-serif text-[#2C2C2C]">
                新增請求 —{' '}
                {SERVICE_TYPES.find((s) => s.key === selectedService)?.label}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* 需求描述 */}
              <div>
                <label className="block text-sm font-medium text-[#2C2C2C] mb-1.5">
                  需求描述 <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                  placeholder="請詳細描述您的需求，讓管家更好地為您服務..."
                  rows={4}
                  required
                  className="w-full rounded-xl border border-[#E8D5B8] bg-white px-4 py-3 text-sm
                    text-[#2C2C2C] placeholder:text-[#2C2C2C]/30
                    focus:border-[#C19A5B] focus:ring-2 focus:ring-[#C19A5B]/20 focus:outline-none
                    transition-colors"
                />
              </div>

              {/* 雙欄 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#2C2C2C] mb-1.5">
                    偏好日期
                  </label>
                  <input
                    type="date"
                    value={form.preferredDate}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, preferredDate: e.target.value }))
                    }
                    className="w-full rounded-xl border border-[#E8D5B8] bg-white px-4 py-3 text-sm
                      text-[#2C2C2C] focus:border-[#C19A5B] focus:ring-2 focus:ring-[#C19A5B]/20
                      focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#2C2C2C] mb-1.5">
                    偏好時間
                  </label>
                  <input
                    type="time"
                    value={form.preferredTime}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, preferredTime: e.target.value }))
                    }
                    className="w-full rounded-xl border border-[#E8D5B8] bg-white px-4 py-3 text-sm
                      text-[#2C2C2C] focus:border-[#C19A5B] focus:ring-2 focus:ring-[#C19A5B]/20
                      focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#2C2C2C] mb-1.5">
                    地點
                  </label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, location: e.target.value }))
                    }
                    placeholder="例：台北市信義區"
                    className="w-full rounded-xl border border-[#E8D5B8] bg-white px-4 py-3 text-sm
                      text-[#2C2C2C] placeholder:text-[#2C2C2C]/30
                      focus:border-[#C19A5B] focus:ring-2 focus:ring-[#C19A5B]/20
                      focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#2C2C2C] mb-1.5">
                    預算
                  </label>
                  <input
                    type="text"
                    value={form.budget}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, budget: e.target.value }))
                    }
                    placeholder="例：NT$5,000 以內"
                    className="w-full rounded-xl border border-[#E8D5B8] bg-white px-4 py-3 text-sm
                      text-[#2C2C2C] placeholder:text-[#2C2C2C]/30
                      focus:border-[#C19A5B] focus:ring-2 focus:ring-[#C19A5B]/20
                      focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#2C2C2C] mb-1.5">
                    人數
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.numberOfPeople}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        numberOfPeople: e.target.value,
                      }))
                    }
                    placeholder="1"
                    className="w-full rounded-xl border border-[#E8D5B8] bg-white px-4 py-3 text-sm
                      text-[#2C2C2C] placeholder:text-[#2C2C2C]/30
                      focus:border-[#C19A5B] focus:ring-2 focus:ring-[#C19A5B]/20
                      focus:outline-none transition-colors"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={form.urgent}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, urgent: e.target.checked }))
                        }
                        className="peer sr-only"
                      />
                      <div
                        className="w-11 h-6 rounded-full bg-[#E8D5B8] transition-colors
                          peer-checked:bg-gradient-to-r peer-checked:from-[#C19A5B] peer-checked:to-[#D4AF63]"
                      />
                      <div
                        className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow
                          transition-transform peer-checked:translate-x-5"
                      />
                    </div>
                    <span className="text-sm font-medium text-[#2C2C2C]">
                      緊急需求
                    </span>
                  </label>
                </div>
              </div>

              {/* 特殊要求 */}
              <div>
                <label className="block text-sm font-medium text-[#2C2C2C] mb-1.5">
                  特殊要求
                </label>
                <textarea
                  value={form.specialRequirements}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      specialRequirements: e.target.value,
                    }))
                  }
                  placeholder="任何需要特別注意的事項..."
                  rows={2}
                  className="w-full rounded-xl border border-[#E8D5B8] bg-white px-4 py-3 text-sm
                    text-[#2C2C2C] placeholder:text-[#2C2C2C]/30
                    focus:border-[#C19A5B] focus:ring-2 focus:ring-[#C19A5B]/20 focus:outline-none
                    transition-colors"
                />
              </div>

              {/* 提交按鈕 */}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting || !form.description.trim()}
                  className="flex-1 bg-gradient-to-r from-[#C19A5B] to-[#D4AF63] text-white
                    py-3.5 rounded-xl text-sm font-medium shadow-md
                    hover:shadow-lg hover:brightness-105 transition-all
                    disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? '提交中...' : '提交請求'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedService(null)
                    setForm(INITIAL_FORM)
                  }}
                  className="px-6 py-3.5 rounded-xl text-sm font-medium text-[#2C2C2C]/60
                    border border-[#E8D5B8] hover:bg-[#FDF8F3] transition-colors"
                >
                  取消
                </button>
              </div>
            </form>
          </section>
        )}

        {/* ═══════════ 4. 我的請求列表 ═══════════ */}
        <section>
          <h2 className="text-lg font-serif text-[#2C2C2C] mb-4">
            我的請求
          </h2>

          {requests.length === 0 ? (
            <div className="bg-white/80 backdrop-blur rounded-2xl shadow-lg border border-[#E8D5B8] p-12 text-center">
              <div className="text-4xl mb-4 opacity-40">📋</div>
              <p className="text-[#2C2C2C]/50 text-sm">
                尚無管家請求，點選上方服務項目開始使用
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => {
                const statusCfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.submitted
                const service = SERVICE_TYPES.find(
                  (s) => s.key === req.serviceType,
                )
                const isExpanded = expandedId === req.id
                const canCancel = [
                  'submitted',
                  'ai_processing',
                  'assigned',
                  'in_progress',
                ].includes(req.status)

                return (
                  <div
                    key={req.id}
                    className="bg-white/80 backdrop-blur rounded-2xl shadow-lg border border-[#E8D5B8]
                      overflow-hidden transition-all"
                  >
                    {/* 標頭 */}
                    <button
                      onClick={() =>
                        setExpandedId(isExpanded ? null : req.id)
                      }
                      className="w-full flex items-center gap-4 p-5 text-left hover:bg-[#FDF8F3]/50 transition-colors"
                    >
                      <span className="text-2xl shrink-0">
                        {service?.emoji || '✨'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-medium text-sm text-[#2C2C2C]">
                            {service?.label || req.serviceType}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusCfg.bg} ${statusCfg.text}`}
                          >
                            {statusCfg.label}
                          </span>
                          {Boolean(req.urgent) && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-600">
                              緊急
                            </span>
                          )}
                          {req.priority === 'high' && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-600">
                              高優先
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#2C2C2C]/50 truncate">
                          {req.description}
                        </p>
                      </div>
                      <div className="text-xs text-[#2C2C2C]/40 shrink-0 text-right">
                        <p>
                          {new Date(req.createdAt).toLocaleDateString('zh-TW')}
                        </p>
                      </div>
                      <svg
                        className={`w-4 h-4 text-[#2C2C2C]/30 shrink-0 transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>

                    {/* 展開詳情 */}
                    {isExpanded && (
                      <div className="border-t border-[#E8D5B8]/50 px-5 pb-5 pt-4 space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                          {req.preferredDate && (
                            <div>
                              <span className="text-[#2C2C2C]/40 block mb-0.5">
                                偏好日期
                              </span>
                              <span className="text-[#2C2C2C]">
                                {req.preferredDate}
                              </span>
                            </div>
                          )}
                          {req.preferredTime && (
                            <div>
                              <span className="text-[#2C2C2C]/40 block mb-0.5">
                                偏好時間
                              </span>
                              <span className="text-[#2C2C2C]">
                                {req.preferredTime}
                              </span>
                            </div>
                          )}
                          {req.location && (
                            <div>
                              <span className="text-[#2C2C2C]/40 block mb-0.5">
                                地點
                              </span>
                              <span className="text-[#2C2C2C]">
                                {req.location}
                              </span>
                            </div>
                          )}
                          {req.budget && (
                            <div>
                              <span className="text-[#2C2C2C]/40 block mb-0.5">
                                預算
                              </span>
                              <span className="text-[#2C2C2C]">
                                {req.budget}
                              </span>
                            </div>
                          )}
                          {req.numberOfPeople && (
                            <div>
                              <span className="text-[#2C2C2C]/40 block mb-0.5">
                                人數
                              </span>
                              <span className="text-[#2C2C2C]">
                                {req.numberOfPeople} 人
                              </span>
                            </div>
                          )}
                          {req.assignedConcierge && (
                            <div>
                              <span className="text-[#2C2C2C]/40 block mb-0.5">
                                負責管家
                              </span>
                              <span className="text-[#2C2C2C]">
                                {req.assignedConcierge}
                              </span>
                            </div>
                          )}
                        </div>

                        {req.specialRequirements && (
                          <div className="text-xs">
                            <span className="text-[#2C2C2C]/40 block mb-1">
                              特殊要求
                            </span>
                            <p className="text-[#2C2C2C] bg-[#FDF8F3] rounded-xl p-3">
                              {req.specialRequirements}
                            </p>
                          </div>
                        )}

                        {req.conciergeNotes && (
                          <div className="text-xs">
                            <span className="text-[#C19A5B] font-medium block mb-1">
                              管家備註
                            </span>
                            <p className="text-[#2C2C2C] bg-gradient-to-r from-[#C19A5B]/5 to-transparent rounded-xl p-3 border border-[#C19A5B]/20">
                              {req.conciergeNotes}
                            </p>
                          </div>
                        )}

                        {req.aiSuggestions && (
                          <div className="text-xs">
                            <span className="text-purple-500 font-medium block mb-1">
                              AI 建議
                            </span>
                            <p className="text-[#2C2C2C] bg-purple-50 rounded-xl p-3 border border-purple-100">
                              {req.aiSuggestions}
                            </p>
                          </div>
                        )}

                        {/* 操作按鈕 */}
                        {canCancel && (
                          <div className="pt-1">
                            <button
                              onClick={() => handleCancel(req.id)}
                              className="text-xs text-red-400 hover:text-red-500 transition-colors
                                px-4 py-2 rounded-lg border border-red-200 hover:bg-red-50"
                            >
                              取消請求
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
