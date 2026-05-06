'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, ArrowRight, Sparkles, Share2, RotateCw, ShoppingBag, User } from 'lucide-react'
import {
  MBTI_QUESTIONS,
  MBTI_LIFESTYLE_QUESTIONS,
  TOTAL_QUIZ_QUESTIONS,
  type MBTIAxis,
  type LifestyleOccasion,
} from '@/lib/games/mbtiQuestions'
import { OCCASION_META } from '@/lib/games/mbtiOccasions'

/**
 * MBTI 個性穿搭測驗 — 前端遊戲頁（PR-Y MBTI64 擴充）
 * ─────────────────────────────────
 * 4 階段 state machine：
 *   intro → quiz (28 MBTI 題 + 4 lifestyle 場合題) → computing → result
 *
 * 後端對接 POST /api/games/mbti/play
 *   送 { answers: { [questionId]: 'E'|'I'|... }, lifestyleAnswers: { [questionId]: 'urban'|... } }
 *   回 { success, mbtiType, primaryOccasion, subPersonality, nickname, tagline, ...
 *        recommendedProducts, pointsRemaining, ... }
 */

type Phase = 'intro' | 'quiz' | 'computing' | 'result' | 'error'

interface PlayResult {
  success: boolean
  mbtiType?: string
  primaryOccasion?: string
  occasionLabel?: string
  occasionIcon?: string
  subTagline?: string
  nickname?: string
  tagline?: string
  personality?: string
  styleAnalysis?: string
  styleKeywords?: string[]
  outfitTips?: string[]
  paletteHint?: string
  accentColor?: string
  recommendedProducts?: Array<{
    id: number
    slug?: string
    name?: string
    price?: number
    salePrice?: number | null
    featuredImage?: { url?: string; alt?: string } | string | number | null
    images?: Array<{ image?: { url?: string; alt?: string } }>
  }>
  pointsRemaining?: number
  pointsSpent?: number
  message?: string
}

interface Settings {
  pointsCostPerPlay?: number
  dailyLimit?: number
  allowRetake?: boolean
  displayName?: string
  description?: string
  icon?: string
}

export function MBTIStyleGame({ settings }: { settings: Record<string, unknown> }) {
  const s = settings as Settings
  const pointsCost = s.pointsCostPerPlay ?? 50
  const dailyLimit = s.dailyLimit ?? 1
  const allowRetake = s.allowRetake !== false

  const [phase, setPhase] = useState<Phase>('intro')
  const [questionIdx, setQuestionIdx] = useState(0) // 0..31
  const [mbtiAnswers, setMbtiAnswers] = useState<Record<string, MBTIAxis>>({})
  const [lifestyleAnswers, setLifestyleAnswers] = useState<Record<string, LifestyleOccasion>>({})
  const [result, setResult] = useState<PlayResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string>('')

  // 28 題 MBTI + 4 題 lifestyle = 32 題；idx 28..31 走 lifestyle
  const totalQuestions = TOTAL_QUIZ_QUESTIONS
  const isLifestylePhase = questionIdx >= MBTI_QUESTIONS.length
  const lifestyleIdx = questionIdx - MBTI_QUESTIONS.length
  const currentMbtiQuestion = !isLifestylePhase ? MBTI_QUESTIONS[questionIdx] : null
  const currentLifestyleQuestion = isLifestylePhase ? MBTI_LIFESTYLE_QUESTIONS[lifestyleIdx] : null

  const progress = useMemo(
    () => Math.round(((questionIdx + 1) / totalQuestions) * 100),
    [questionIdx, totalQuestions],
  )

  const handleStart = () => {
    setPhase('quiz')
    setQuestionIdx(0)
    setMbtiAnswers({})
    setLifestyleAnswers({})
    setErrorMsg('')
  }

  const submitAll = async (
    finalMbti: Record<string, MBTIAxis>,
    finalLifestyle: Record<string, LifestyleOccasion>,
  ) => {
    setPhase('computing')
    try {
      const res = await fetch('/api/games/mbti/play', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: finalMbti, lifestyleAnswers: finalLifestyle }),
      })
      const data = (await res.json()) as PlayResult

      // 1.2s 計算動畫，給玩家「期待感」
      await new Promise((r) => setTimeout(r, 1200))

      if (!data.success) {
        setErrorMsg(data.message || '測驗發生錯誤')
        setPhase('error')
        return
      }
      setResult(data)
      setPhase('result')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error'
      setErrorMsg(msg)
      setPhase('error')
    }
  }

  const handleMbtiAnswer = (axis: MBTIAxis) => {
    if (!currentMbtiQuestion) return
    const newAnswers = { ...mbtiAnswers, [currentMbtiQuestion.id]: axis }
    setMbtiAnswers(newAnswers)

    if (questionIdx < totalQuestions - 1) {
      setQuestionIdx((i) => i + 1)
      return
    }
    // 不會在 MBTI 階段走完最後一題（最後 4 題是 lifestyle）
    void submitAll(newAnswers, lifestyleAnswers)
  }

  const handleLifestyleAnswer = (occasion: LifestyleOccasion) => {
    if (!currentLifestyleQuestion) return
    const newLifestyle = { ...lifestyleAnswers, [currentLifestyleQuestion.id]: occasion }
    setLifestyleAnswers(newLifestyle)

    if (questionIdx < totalQuestions - 1) {
      setQuestionIdx((i) => i + 1)
      return
    }
    // 最後一題（第 32 題）→ 整體 submit
    void submitAll(mbtiAnswers, newLifestyle)
  }

  const handleBack = () => {
    if (questionIdx > 0) setQuestionIdx((i) => i - 1)
  }

  const handleShare = async () => {
    if (!result?.mbtiType) return
    const occasionStr = result.occasionLabel ? `（${result.occasionLabel}場合）` : ''
    const text = `我是 ${result.mbtiType} ${result.nickname}${occasionStr}！${result.subTagline || result.tagline} — 一起來測你的 64 個性穿搭風格 🎨`
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'CHIC KIM & MIU - MBTI64 個性穿搭測驗',
          text,
          url: window.location.href,
        })
      } catch {
        /* 使用者取消 */
      }
      return
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${window.location.href}`)
      alert('連結已複製！分享給朋友看你的穿搭個性 ✨')
    } catch {
      alert('分享失敗，請手動複製連結')
    }
  }

  const handleRetake = () => {
    setPhase('intro')
    setQuestionIdx(0)
    setMbtiAnswers({})
    setLifestyleAnswers({})
    setResult(null)
    setErrorMsg('')
  }

  // ════════════════════════════════════════
  //  Phase: error
  // ════════════════════════════════════════
  if (phase === 'error') {
    return (
      <div className="max-w-md mx-auto py-12 text-center">
        <p className="text-5xl mb-4">😢</p>
        <p className="text-base font-serif mb-2">測驗無法進行</p>
        <p className="text-sm text-muted-foreground mb-6">{errorMsg}</p>
        <button
          onClick={handleRetake}
          className="px-6 py-2.5 bg-foreground text-cream-50 rounded-xl text-sm tracking-wide hover:bg-foreground/90 transition-colors"
        >
          回到首頁
        </button>
      </div>
    )
  }

  // ════════════════════════════════════════
  //  Phase: computing
  // ════════════════════════════════════════
  if (phase === 'computing') {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <div className="relative inline-block mb-6">
          <div className="w-20 h-20 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin" />
          <Sparkles
            size={28}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gold-500"
          />
        </div>
        <p className="text-lg font-serif mb-2">正在分析你的 64 個性穿搭風格…</p>
        <p className="text-sm text-muted-foreground">為你精選最適合的場合單品</p>
      </div>
    )
  }

  // ════════════════════════════════════════
  //  Phase: result
  // ════════════════════════════════════════
  if (phase === 'result' && result) {
    const accent = result.accentColor || 'from-indigo-400 to-purple-600'
    const occasionLabel = result.occasionLabel || ''
    const occasionIcon = result.occasionIcon || '✨'
    return (
      <div className="max-w-3xl mx-auto">
        {/* Hero */}
        <div className={`rounded-3xl bg-gradient-to-br ${accent} p-8 md:p-12 text-white text-center mb-6 shadow-lg`}>
          <p className="text-xs tracking-[0.3em] opacity-80 mb-3">YOUR MBTI64</p>
          <p className="text-6xl md:text-7xl font-serif mb-2 tracking-wider">
            {result.mbtiType}
            {occasionLabel ? (
              <span className="text-3xl md:text-4xl ml-2 opacity-90">·{occasionLabel}</span>
            ) : null}
          </p>
          <p className="text-xl md:text-2xl font-serif mb-2">
            {occasionIcon} {result.nickname}
          </p>
          <p className="text-sm opacity-90 max-w-md mx-auto leading-relaxed mb-1">
            {result.subTagline || result.tagline}
          </p>
          {result.paletteHint && (
            <p className="text-xs opacity-80 mt-2">配色：{result.paletteHint}</p>
          )}
          {Array.isArray(result.styleKeywords) && result.styleKeywords.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mt-6">
              {result.styleKeywords.map((kw) => (
                <span
                  key={kw}
                  className="text-xs px-3 py-1 rounded-full bg-white/20 backdrop-blur"
                >
                  #{kw}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* CTA：去個人專屬頁面 */}
        <Link
          href="/account/personality"
          className="block bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl p-5 mb-6 hover:opacity-95 transition-opacity"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-serif mb-1 flex items-center gap-2">
                <User size={18} />
                打開我的個性穿搭分析頁
              </p>
              <p className="text-xs opacity-90">
                4 種場合 sub-personality + 平日好運 / 突破自己 / 按個性 3 種推薦切換
              </p>
            </div>
            <ArrowRight size={20} />
          </div>
        </Link>

        {/* Personality */}
        <div className="bg-white rounded-2xl border border-cream-200 p-6 md:p-8 mb-6">
          <h3 className="text-base font-serif mb-3 flex items-center gap-2">
            <span className="w-1 h-5 bg-gold-500 rounded" />
            你的個性
          </h3>
          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
            {result.personality}
          </p>
        </div>

        {/* Style analysis */}
        <div className="bg-white rounded-2xl border border-cream-200 p-6 md:p-8 mb-4">
          <h3 className="text-base font-serif mb-3 flex items-center gap-2">
            <span className="w-1 h-5 bg-gold-500 rounded" />
            你的穿搭風格
          </h3>
          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line mb-4">
            {result.styleAnalysis}
          </p>

          {/* 場合穿搭建議 */}
          {Array.isArray(result.outfitTips) && result.outfitTips.length > 0 && (
            <div className="bg-cream-50 rounded-xl p-4 border border-cream-200">
              <p className="text-xs tracking-widest text-purple-600 mb-2">
                {occasionIcon} {occasionLabel}場合 · 穿搭重點
              </p>
              <ul className="space-y-1.5">
                {result.outfitTips.map((tip, i) => (
                  <li key={i} className="text-sm text-foreground/80 flex gap-2 leading-relaxed">
                    <span className="text-gold-500">·</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Recommended products */}
        {Array.isArray(result.recommendedProducts) && result.recommendedProducts.length > 0 && (
          <div className="mb-8">
            <h3 className="text-base font-serif mb-4 flex items-center gap-2">
              <ShoppingBag size={18} className="text-gold-500" />
              為你精選 — {result.mbtiType}
              {occasionLabel ? `（${occasionLabel}場合）` : ''}適合的穿搭
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {result.recommendedProducts.slice(0, 8).map((p) => {
                const imgObj =
                  typeof p.featuredImage === 'object' && p.featuredImage != null && 'url' in p.featuredImage
                    ? p.featuredImage
                    : p.images?.[0]?.image
                const imgUrl = imgObj?.url
                const price = p.salePrice ?? p.price
                return (
                  <Link
                    key={p.id}
                    href={p.slug ? `/products/${p.slug}` : `/products`}
                    className="group block"
                  >
                    <div className="aspect-[3/4] rounded-xl overflow-hidden bg-cream-100 mb-2 relative">
                      {imgUrl ? (
                        <Image
                          src={imgUrl}
                          alt={imgObj?.alt || p.name || '商品'}
                          fill
                          sizes="(max-width: 768px) 50vw, 25vw"
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                          無圖片
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-foreground/80 line-clamp-2 mb-1">{p.name}</p>
                    {price != null && (
                      <p className="text-sm text-gold-600 font-medium">NT$ {price.toLocaleString()}</p>
                    )}
                  </Link>
                )
              })}
            </div>
            <div className="text-center mt-6">
              <Link
                href={`/products?personalityType=${result.mbtiType}`}
                className="inline-flex items-center gap-1 text-sm text-gold-600 hover:underline"
              >
                看更多 {result.mbtiType} 推薦
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3 justify-center pb-4">
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-cream-300 rounded-xl text-sm hover:bg-cream-100 transition-colors"
          >
            <Share2 size={16} />
            分享結果
          </button>
          {allowRetake && (
            <button
              onClick={handleRetake}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-cream-50 rounded-xl text-sm hover:bg-foreground/90 transition-colors"
            >
              <RotateCw size={16} />
              再測一次（消耗 {pointsCost} 點）
            </button>
          )}
        </div>

        {result.pointsRemaining != null && (
          <p className="text-center text-xs text-muted-foreground mt-2">
            目前點數餘額：{result.pointsRemaining} 點
          </p>
        )}
      </div>
    )
  }

  // ════════════════════════════════════════
  //  Phase: quiz (MBTI 28 + lifestyle 4)
  // ════════════════════════════════════════
  if (phase === 'quiz' && (currentMbtiQuestion || currentLifestyleQuestion)) {
    const dimLabel: Record<string, string> = {
      EI: '能量來源',
      SN: '感知方式',
      TF: '決策依據',
      JP: '生活態度',
    }
    return (
      <div className="max-w-xl mx-auto">
        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>
              第 {questionIdx + 1} / {totalQuestions} 題
              <span className="ml-2 text-gold-600">
                ·{' '}
                {isLifestylePhase
                  ? '生活場合（決定 64 sub-personality）'
                  : dimLabel[currentMbtiQuestion?.dimension ?? ''] || currentMbtiQuestion?.dimension}
              </span>
            </span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 bg-cream-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-400 to-purple-500 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question */}
        <div className="bg-white rounded-2xl border border-cream-200 p-6 md:p-8 mb-4">
          {isLifestylePhase ? (
            <p className="text-xs tracking-widest text-purple-600 mb-3">
              ✨ 場合題 — 決定你 16 型 × 4 場合 = 64 個性中的場合
            </p>
          ) : null}
          <p className="text-base md:text-lg font-serif text-foreground/90 leading-relaxed mb-6">
            {currentMbtiQuestion?.text || currentLifestyleQuestion?.text}
          </p>

          <div className="space-y-3">
            {currentMbtiQuestion?.options.map((opt, idx) => (
              <button
                key={`${currentMbtiQuestion.id}-${idx}`}
                onClick={() => handleMbtiAnswer(opt.axis)}
                className="w-full text-left px-5 py-4 border-2 border-cream-200 rounded-xl hover:border-purple-400 hover:bg-purple-50/50 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-cream-100 group-hover:bg-purple-500 group-hover:text-white text-sm font-medium flex items-center justify-center transition-colors">
                    {idx === 0 ? 'A' : 'B'}
                  </span>
                  <span className="text-sm text-foreground/85 leading-relaxed pt-0.5">
                    {opt.label}
                  </span>
                </div>
              </button>
            ))}
            {currentLifestyleQuestion?.options.map((opt, idx) => {
              const meta = OCCASION_META[opt.occasion]
              return (
                <button
                  key={`${currentLifestyleQuestion.id}-${idx}`}
                  onClick={() => handleLifestyleAnswer(opt.occasion)}
                  className="w-full text-left px-5 py-4 border-2 border-cream-200 rounded-xl hover:border-purple-400 hover:bg-purple-50/50 transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-cream-100 group-hover:bg-purple-500 group-hover:text-white text-base flex items-center justify-center transition-colors">
                      {meta.icon}
                    </span>
                    <span className="text-sm text-foreground/85 leading-relaxed pt-0.5">
                      {opt.label}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Nav */}
        <div className="flex items-center justify-between text-xs">
          <button
            onClick={handleBack}
            disabled={questionIdx === 0}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowLeft size={14} />
            上一題
          </button>
          <span className="text-muted-foreground">
            {questionIdx === totalQuestions - 1 ? '選答後直接看結果' : '選一個答案會自動進入下一題'}
          </span>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════
  //  Phase: intro (default)
  // ════════════════════════════════════════
  return (
    <div className="max-w-md mx-auto text-center py-8">
      <p className="text-6xl mb-4">{(s.icon as string) || '🧠'}</p>
      <h2 className="text-2xl font-serif mb-3">
        {(s.displayName as string) || 'MBTI64 個性穿搭測驗'}
      </h2>
      <p className="text-sm text-muted-foreground leading-relaxed mb-6 px-2">
        {(s.description as string) ||
          '32 題詳細 MBTI64 測驗 — 16 型 × 4 場合 = 64 sub-personality，找出你的個性穿搭風格 + 場合切換推薦！'}
      </p>

      <div className="grid grid-cols-3 gap-3 mb-6 max-w-sm mx-auto">
        <div className="bg-white/70 rounded-xl p-3 border border-cream-200">
          <p className="text-xs text-muted-foreground">題目</p>
          <p className="text-sm font-medium text-purple-600 mt-0.5">32 題</p>
        </div>
        <div className="bg-white/70 rounded-xl p-3 border border-cream-200">
          <p className="text-xs text-muted-foreground">時長</p>
          <p className="text-sm font-medium text-purple-600 mt-0.5">約 6 分鐘</p>
        </div>
        <div className="bg-white/70 rounded-xl p-3 border border-cream-200">
          <p className="text-xs text-muted-foreground">點數</p>
          <p className="text-sm font-medium text-purple-600 mt-0.5">{pointsCost} 點</p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-indigo-500/5 to-purple-500/10 rounded-2xl border border-purple-500/20 p-5 mb-4 text-left">
        <p className="text-xs tracking-widest text-purple-600 mb-2">測驗會幫你找出</p>
        <ul className="text-sm space-y-1.5 text-foreground/80">
          <li>· 16 型 MBTI 個性類型</li>
          <li>· 主要場合（都會 / 度假 / 派對 / 居家）</li>
          <li>· 16 × 4 = 64 sub-personality 對應穿搭風格</li>
          <li>· 個人專屬分析頁面（平日好運 / 突破自己 / 按個性切換推薦）</li>
        </ul>
      </div>

      {!allowRetake && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 text-left flex items-start gap-2">
          <span className="text-amber-600 text-base leading-none mt-0.5">⚠️</span>
          <div>
            <p className="text-xs font-medium text-amber-700">每位會員終身限測 1 次</p>
            <p className="text-[11px] text-amber-700/80 leading-relaxed mt-0.5">
              個性是穩定特質，請在心情平靜時誠實作答；測完結果會永久顯示在你的會員中心。
            </p>
          </div>
        </div>
      )}

      <button
        onClick={handleStart}
        className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl text-sm tracking-wide hover:opacity-90 transition-opacity shadow-md"
      >
        開始測驗（消耗 {pointsCost} 點）
      </button>

      <p className="text-xs text-muted-foreground mt-3">
        {allowRetake
          ? (dailyLimit > 0 ? `每日限 ${dailyLimit} 次 · 可重複測驗` : '無次數限制 · 可重複測驗')
          : '每位會員終身限 1 次'}
      </p>
    </div>
  )
}

export default MBTIStyleGame
