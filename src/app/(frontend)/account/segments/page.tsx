'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Users,
  ChevronDown,
  ChevronUp,
  Play,
  Loader2,
  BarChart3,
  Target,
  Sparkles,
  Tag,
  Info,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * Member Segmentation Dashboard -- 會員分群管理
 * ──────────────────────────────────────────────
 * Visualises 10-segment distribution with composite score breakdown,
 * marketing strategies, and manual run trigger.
 */

// ── Types ──

interface SegmentItem {
  code: string
  label: string
  color: string
  count: number
  percentage: number
  description: string
}

interface SegmentData {
  distribution: SegmentItem[]
  lastRunAt: string | null
  totalProcessed: number
  totalChanged: number
}

// ── Demo Data ──

const DEMO_SEGMENTS: SegmentItem[] = [
  { code: 'VIP1', label: '璀璨忠誠女王', color: '#9B59B6', count: 34, percentage: 1.2, description: '最高價值客群，高 RFM + 高信用分數' },
  { code: 'VIP2', label: '金曦風格領袖', color: '#F1C40F', count: 156, percentage: 5.5, description: '高價值忠誠客，穩定消費且信用優良' },
  { code: 'POT1', label: '潛力優雅新星', color: '#3498DB', count: 380, percentage: 13.4, description: '高潛力新客，有升級 VIP 潛力' },
  { code: 'REG1', label: '穩定優雅會員', color: '#2ECC71', count: 820, percentage: 28.8, description: '穩定消費的主力客群' },
  { code: 'REG2', label: '價格敏感優雅客', color: '#1ABC9C', count: 340, percentage: 11.9, description: '高頻但低客單價，對促銷敏感' },
  { code: 'RISK1', label: '流失高風險客', color: '#E67E22', count: 420, percentage: 14.8, description: '消費減少或長時間未消費' },
  { code: 'RISK2', label: '退貨觀察客', color: '#E74C3C', count: 95, percentage: 3.3, description: '退貨率偏高且信用分數較低' },
  { code: 'NEW1', label: '優雅初遇新客', color: '#00BCD4', count: 312, percentage: 11.0, description: '30天內新註冊的會員' },
  { code: 'SLP1', label: '沉睡復活客', color: '#95A5A6', count: 235, percentage: 8.3, description: '超過60天未消費' },
  { code: 'BLK1', label: '高風險警示客', color: '#34495E', count: 55, percentage: 1.9, description: '信用分數極低或已進入黑名單' },
]

const SEGMENT_STRATEGIES: Record<string, {
  journeySlug: string
  recommendationIntensity: string
  discountEligible: boolean
  aiTone: string
  topTags: string[]
}> = {
  VIP1: { journeySlug: 'vip-exclusive', recommendationIntensity: '高', discountEligible: false, aiTone: '尊榮感、專屬、感恩', topTags: ['高消費', '高回購', '零退貨'] },
  VIP2: { journeySlug: 'vip-nurture', recommendationIntensity: '高', discountEligible: false, aiTone: '肯定、風格推薦', topTags: ['穩定消費', '好信用', '品牌忠誠'] },
  POT1: { journeySlug: 'potential-upgrade', recommendationIntensity: '中高', discountEligible: true, aiTone: '鼓勵、探索、升級暗示', topTags: ['新客潛力', '中高消費', '活躍'] },
  REG1: { journeySlug: 'regular-engage', recommendationIntensity: '中', discountEligible: true, aiTone: '親切、日常推薦', topTags: ['穩定', '中等消費', '一般回購'] },
  REG2: { journeySlug: 'price-sensitive', recommendationIntensity: '中', discountEligible: true, aiTone: '超值、限時優惠', topTags: ['價格敏感', '高頻低單', '促銷偏好'] },
  RISK1: { journeySlug: 'churn-prevention', recommendationIntensity: '高', discountEligible: true, aiTone: '溫暖挽回、想念您', topTags: ['消費下降', '未回購', '流失風險'] },
  RISK2: { journeySlug: 'return-watch', recommendationIntensity: '低', discountEligible: false, aiTone: '中性、尺寸建議', topTags: ['高退貨', '低信用', '需觀察'] },
  NEW1: { journeySlug: 'welcome-series', recommendationIntensity: '中', discountEligible: true, aiTone: '歡迎、品牌故事', topTags: ['新註冊', '首購待轉化', '探索期'] },
  SLP1: { journeySlug: 'reactivation', recommendationIntensity: '中高', discountEligible: true, aiTone: '喚醒、新品通知', topTags: ['長期未消費', '曾活躍', '可喚回'] },
  BLK1: { journeySlug: 'restricted', recommendationIntensity: '極低', discountEligible: false, aiTone: '正式、客服導向', topTags: ['極低信用', '高風險', '限制中'] },
}

const SCORE_WEIGHTS = [
  { label: 'RFM', weight: 40, color: '#9B59B6' },
  { label: 'Credit', weight: 25, color: '#3498DB' },
  { label: 'LTV+Churn', weight: 15, color: '#2ECC71' },
  { label: 'Behavior', weight: 10, color: '#F1C40F' },
  { label: 'Tier', weight: 10, color: '#E67E22' },
]

// ── Animated Counter ──

function AnimatedNumber({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef<number | null>(null)

  useEffect(() => {
    const start = performance.now()
    const from = 0

    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress)
      setDisplay(Math.round(from + (value - from) * eased))
      if (progress < 1) {
        ref.current = requestAnimationFrame(tick)
      }
    }

    ref.current = requestAnimationFrame(tick)
    return () => {
      if (ref.current) cancelAnimationFrame(ref.current)
    }
  }, [value, duration])

  return <span>{display.toLocaleString()}</span>
}

// ── Main Page ──

export default function SegmentsPage() {
  const [data, setData] = useState<SegmentData>({
    distribution: DEMO_SEGMENTS,
    lastRunAt: null,
    totalProcessed: DEMO_SEGMENTS.reduce((s, d) => s + d.count, 0),
    totalChanged: 0,
  })
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [expandedSegment, setExpandedSegment] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch('/api/crm/segments')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.distribution) setData(d.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleManualRun = async () => {
    setRunning(true)
    try {
      const res = await fetch('/api/crm/segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'all' }),
      })
      const d = await res.json()
      if (d.success && d.data?.distribution) {
        setData((prev) => ({
          ...prev,
          distribution: d.data.distribution,
          totalProcessed: d.data.processed,
          totalChanged: d.data.changed,
          lastRunAt: new Date().toISOString(),
        }))
      }
    } catch {
      // keep existing data
    } finally {
      setRunning(false)
    }
  }

  const maxCount = Math.max(...data.distribution.map((s) => s.count), 1)

  return (
    <main className="bg-cream-50 min-h-screen">
      {/* ── Header ── */}
      <div className="bg-gradient-to-b from-cream-100 to-cream-50 border-b border-cream-200">
        <div className="container py-8 md:py-10">
          <p className="text-xs tracking-[0.3em] text-gold-500 mb-2">MEMBER SEGMENTS</p>
          <h1 className="text-2xl md:text-3xl font-serif text-[#2C2C2C]">會員分群管理</h1>
          {data.lastRunAt && (
            <p className="text-xs text-muted-foreground mt-2">
              上次執行：{new Date(data.lastRunAt).toLocaleString('zh-TW')}
              {' | '}處理 {data.totalProcessed.toLocaleString()} 位
              {data.totalChanged > 0 && `，${data.totalChanged} 位變更`}
            </p>
          )}
        </div>
      </div>

      <div className="container py-8 space-y-8">
        {/* ── Loading Overlay ── */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-gold-500" size={32} />
          </div>
        )}

        {!loading && (
          <>
            {/* ── 1. Segment Distribution Grid ── */}
            <section>
              <h2 className="text-sm font-medium mb-4 flex items-center gap-2">
                <BarChart3 size={16} className="text-gold-500" />
                分群分佈總覽
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {data.distribution.map((seg, i) => (
                  <motion.div
                    key={seg.code}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="bg-white rounded-2xl border border-cream-200 p-4 cursor-pointer hover:shadow-md hover:border-cream-300 transition-all group"
                    style={{ borderLeftWidth: 4, borderLeftColor: seg.color }}
                    onClick={() =>
                      setExpandedSegment(expandedSegment === seg.code ? null : seg.code)
                    }
                  >
                    <p className="text-[10px] tracking-wider text-muted-foreground uppercase">
                      {seg.code}
                    </p>
                    <p className="text-sm font-bold text-[#2C2C2C] mt-0.5 leading-tight">
                      {seg.label}
                    </p>
                    <p className="text-2xl font-bold mt-2 text-[#2C2C2C]">
                      <AnimatedNumber value={seg.count} />
                    </p>
                    <p className="text-[10px] text-muted-foreground">{seg.percentage}%</p>

                    {/* Progress bar */}
                    <div className="mt-2 h-1.5 bg-cream-100 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: seg.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${(seg.count / maxCount) * 100}%` }}
                        transition={{ duration: 0.7, delay: i * 0.04 }}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>

            {/* ── 2. Segment Detail Cards (expandable) ── */}
            <section>
              <h2 className="text-sm font-medium mb-4 flex items-center gap-2">
                <Target size={16} className="text-gold-500" />
                分群詳細策略
              </h2>
              <div className="space-y-3">
                {data.distribution.map((seg) => {
                  const strategy = SEGMENT_STRATEGIES[seg.code]
                  const isExpanded = expandedSegment === seg.code

                  return (
                    <motion.div
                      key={seg.code}
                      layout
                      className="bg-white rounded-2xl border border-cream-200 overflow-hidden"
                      style={{ borderLeftWidth: 4, borderLeftColor: seg.color }}
                    >
                      <button
                        type="button"
                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-cream-50 transition-colors text-left"
                        onClick={() =>
                          setExpandedSegment(isExpanded ? null : seg.code)
                        }
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                            style={{ backgroundColor: seg.color }}
                          >
                            {seg.code.slice(0, 2)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[#2C2C2C]">{seg.label}</p>
                            <p className="text-xs text-muted-foreground">{seg.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold">{seg.count.toLocaleString()}</span>
                          {isExpanded ? (
                            <ChevronUp size={16} className="text-muted-foreground" />
                          ) : (
                            <ChevronDown size={16} className="text-muted-foreground" />
                          )}
                        </div>
                      </button>

                      <AnimatePresence>
                        {isExpanded && strategy && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                          >
                            <div className="px-5 pb-5 border-t border-cream-200 pt-4">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                  <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                                    <Sparkles size={10} /> 旅程 Slug
                                  </p>
                                  <p className="text-xs font-mono bg-cream-100 px-2 py-1 rounded">
                                    {strategy.journeySlug}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-muted-foreground mb-1">推薦強度</p>
                                  <p className="text-xs font-medium">{strategy.recommendationIntensity}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-muted-foreground mb-1">折扣資格</p>
                                  <p className="text-xs font-medium">
                                    {strategy.discountEligible ? (
                                      <span className="text-emerald-600">可享折扣</span>
                                    ) : (
                                      <span className="text-muted-foreground">不適用</span>
                                    )}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-muted-foreground mb-1">AI 語氣</p>
                                  <p className="text-xs font-medium">{strategy.aiTone}</p>
                                </div>
                              </div>

                              {/* Top Tags */}
                              <div className="mt-4">
                                <p className="text-[10px] text-muted-foreground mb-2 flex items-center gap-1">
                                  <Tag size={10} /> 常見標籤
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {strategy.topTags.map((tag) => (
                                    <span
                                      key={tag}
                                      className="text-[10px] px-2 py-0.5 rounded-full border"
                                      style={{
                                        borderColor: seg.color,
                                        color: seg.color,
                                        backgroundColor: `${seg.color}10`,
                                      }}
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )
                })}
              </div>
            </section>

            {/* ── 3. Composite Score Breakdown ── */}
            <section>
              <h2 className="text-sm font-medium mb-4 flex items-center gap-2">
                <Info size={16} className="text-gold-500" />
                複合評分權重
              </h2>
              <div className="bg-white rounded-2xl border border-cream-200 p-6">
                <p className="text-xs text-muted-foreground mb-4">
                  每位會員的分群由 5 個維度的加權分數決定：
                </p>

                {/* Stacked horizontal bar */}
                <div className="h-10 rounded-full overflow-hidden flex">
                  {SCORE_WEIGHTS.map((w, i) => (
                    <motion.div
                      key={w.label}
                      className="h-full flex items-center justify-center text-white text-[10px] font-bold"
                      style={{ backgroundColor: w.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${w.weight}%` }}
                      transition={{ duration: 0.6, delay: i * 0.08 }}
                    >
                      {w.weight >= 15 && `${w.label} ${w.weight}%`}
                    </motion.div>
                  ))}
                </div>

                {/* Legend */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
                  {SCORE_WEIGHTS.map((w) => (
                    <div key={w.label} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-sm shrink-0"
                        style={{ backgroundColor: w.color }}
                      />
                      <span className="text-xs text-[#2C2C2C]">
                        {w.label}{' '}
                        <span className="text-muted-foreground">({w.weight}%)</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ── 4. Manual Run ── */}
            <section className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <motion.button
                type="button"
                onClick={handleManualRun}
                disabled={running}
                whileHover={{ scale: running ? 1 : 1.02 }}
                whileTap={{ scale: running ? 1 : 0.98 }}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gold-500 text-white font-medium text-sm rounded-xl hover:bg-gold-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
              >
                {running ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    計算中...
                  </>
                ) : (
                  <>
                    <Play size={16} />
                    立即執行分群計算
                  </>
                )}
              </motion.button>

              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <Users size={14} />
                共 {data.totalProcessed.toLocaleString()} 位會員
                {data.totalChanged > 0 && (
                  <span className="text-gold-600 font-medium">
                    | {data.totalChanged} 位分群變更
                  </span>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}
