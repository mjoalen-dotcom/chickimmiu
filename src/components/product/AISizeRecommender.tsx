'use client'

import { useState } from 'react'
import { Sparkles, Ruler, ChevronDown, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * AI 尺寸快速選擇器
 * 顧客輸入身高體重 → 立即顯示最合適尺寸
 * 降低退換貨率、提升轉換率
 */

interface SizeChart {
  size: string
  heightRange: [number, number] // [min, max] cm
  weightRange: [number, number] // [min, max] kg
}

const DEFAULT_SIZE_CHART: SizeChart[] = [
  { size: 'S', heightRange: [150, 160], weightRange: [40, 50] },
  { size: 'M', heightRange: [155, 168], weightRange: [48, 58] },
  { size: 'L', heightRange: [160, 172], weightRange: [55, 65] },
  { size: 'XL', heightRange: [165, 178], weightRange: [62, 75] },
  { size: 'XXL', heightRange: [168, 185], weightRange: [70, 90] },
]

interface BodyShapeAdvice {
  shape: string
  label: string
  advice: string
  sizeAdjust: number // -1 = 建議小一號, 0 = 正常, +1 = 建議大一號
}

const BODY_SHAPE_ADVICE: BodyShapeAdvice[] = [
  { shape: 'petite', label: '瘦小', advice: '建議選擇合身尺寸，避免過大顯得沒精神', sizeAdjust: 0 },
  { shape: 'standard', label: '標準', advice: '依推薦尺寸選擇即可', sizeAdjust: 0 },
  { shape: 'curvy', label: '豐滿', advice: '建議選擇大一號，穿著更舒適', sizeAdjust: 1 },
  { shape: 'pear', label: '梨型', advice: '上身可選推薦尺寸，下裝建議大一號', sizeAdjust: 0 },
  { shape: 'apple', label: '蘋果型', advice: '建議選擇寬鬆版型，大一號更修身', sizeAdjust: 1 },
  { shape: 'hourglass', label: '沙漏型', advice: '選擇合身款式最能展現身材優勢', sizeAdjust: 0 },
  { shape: 'athletic', label: '運動型', advice: '肩寬者上衣建議大一號', sizeAdjust: 0 },
]

/**
 * Fit Score 推薦公式
 * 後台可調整權重（LoyaltySettings > recommendationConfig > fitScoreWeights）
 * 預設：身高40% + 體重30% + 身形20% + 歷史偏好10%
 */
interface FitScoreWeights {
  height: number  // 0-100
  weight: number  // 0-100
  shape: number   // 0-100
  history: number // 0-100
}

const DEFAULT_WEIGHTS: FitScoreWeights = { height: 40, weight: 30, shape: 20, history: 10 }

function recommendSize(
  height: number,
  weight: number,
  bodyShape?: string,
  weights: FitScoreWeights = DEFAULT_WEIGHTS,
): { size: string; confidence: number; advice: string; fitScore: number } {
  const bmi = weight / ((height / 100) ** 2)
  const totalWeight = weights.height + weights.weight + weights.shape + weights.history
  const hW = weights.height / totalWeight
  const wW = weights.weight / totalWeight
  const sW = weights.shape / totalWeight

  let bestSize = 'M'
  let bestFitScore = 0

  for (const sc of DEFAULT_SIZE_CHART) {
    const heightMid = (sc.heightRange[0] + sc.heightRange[1]) / 2
    const heightSpread = (sc.heightRange[1] - sc.heightRange[0]) / 2
    const weightMid = (sc.weightRange[0] + sc.weightRange[1]) / 2
    const weightSpread = (sc.weightRange[1] - sc.weightRange[0]) / 2

    // 身高得分（高斯分佈）
    const heightDist = Math.abs(height - heightMid) / heightSpread
    const heightScore = Math.max(0, 100 - heightDist * 40)

    // 體重得分
    const weightDist = Math.abs(weight - weightMid) / weightSpread
    const weightScore = Math.max(0, 100 - weightDist * 40)

    // 身形匹配得分
    const shapeInfo = BODY_SHAPE_ADVICE.find((s) => s.shape === bodyShape)
    let shapeScore = 70 // 未選身形預設
    if (shapeInfo) {
      shapeScore = 85
      // 大尺寸身形加分大尺寸，小尺寸身形加分小尺寸
      const sizeIndex = DEFAULT_SIZE_CHART.indexOf(sc)
      const midIndex = Math.floor(DEFAULT_SIZE_CHART.length / 2)
      if (shapeInfo.sizeAdjust === 1 && sizeIndex > midIndex) shapeScore = 95
      if (shapeInfo.sizeAdjust === -1 && sizeIndex < midIndex) shapeScore = 95
    }

    // 歷史偏好得分（暫用 BMI 推估，上線後接 User 歷史資料）
    let historyScore = 70
    if (bmi < 18.5 && sc.size === 'S') historyScore = 90
    else if (bmi >= 18.5 && bmi < 24 && (sc.size === 'M' || sc.size === 'S')) historyScore = 85
    else if (bmi >= 24 && bmi < 27 && (sc.size === 'L' || sc.size === 'M')) historyScore = 85
    else if (bmi >= 27 && (sc.size === 'XL' || sc.size === 'XXL')) historyScore = 90

    const fitScore = heightScore * hW + weightScore * wW + shapeScore * sW + historyScore * (1 - hW - wW - sW)

    if (fitScore > bestFitScore) {
      bestFitScore = fitScore
      bestSize = sc.size
    }
  }

  // 身形建議
  const shapeInfo = BODY_SHAPE_ADVICE.find((s) => s.shape === bodyShape)
  let advice = shapeInfo?.advice || '依推薦尺寸選擇即可'

  if (shapeInfo?.sizeAdjust === 1) {
    const sizeIndex = DEFAULT_SIZE_CHART.findIndex((s) => s.size === bestSize)
    if (sizeIndex < DEFAULT_SIZE_CHART.length - 1) {
      bestSize = DEFAULT_SIZE_CHART[sizeIndex + 1].size
      advice += '（已自動調大一號）'
    }
  }

  if (bmi > 25) {
    advice += '。BMI 偏高，建議選擇有彈性的面料'
  }

  const confidence = Math.min(95, Math.max(60, Math.round(bestFitScore)))

  return { size: bestSize, confidence, advice, fitScore: Math.round(bestFitScore) }
}

interface Props {
  availableSizes: string[]
  onSizeSelect?: (size: string) => void
  productCategory?: string
}

export function AISizeRecommender({ availableSizes, onSizeSelect, productCategory }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [bodyShape, setBodyShape] = useState('')
  const [result, setResult] = useState<{ size: string; confidence: number; advice: string } | null>(null)

  const handleRecommend = () => {
    const h = parseFloat(height)
    const w = parseFloat(weight)
    if (!h || !w || h < 100 || h > 250 || w < 30 || w > 200) return

    const rec = recommendSize(h, w, bodyShape || undefined)
    setResult(rec)
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm text-gold-600 hover:text-gold-700 transition-colors"
      >
        <Sparkles size={14} />
        AI 尺寸推薦
        <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 p-4 bg-gold-500/5 border border-gold-500/20 rounded-xl space-y-3">
              <p className="text-xs text-muted-foreground">
                輸入身高體重，AI 立即推薦最合適尺寸
              </p>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="ai-size-height" className="text-[10px] text-muted-foreground">身高（cm）</label>
                  <input
                    id="ai-size-height"
                    name="height"
                    type="number"
                    inputMode="numeric"
                    autoComplete="off"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    placeholder="165"
                    min={100}
                    max={250}
                    className="w-full px-3 py-2 rounded-lg border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
                  />
                </div>
                <div>
                  <label htmlFor="ai-size-weight" className="text-[10px] text-muted-foreground">體重（kg）</label>
                  <input
                    id="ai-size-weight"
                    name="weight"
                    type="number"
                    inputMode="numeric"
                    autoComplete="off"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="55"
                    min={30}
                    max={200}
                    className="w-full px-3 py-2 rounded-lg border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="ai-size-body-shape" className="text-[10px] text-muted-foreground">身形（選填）</label>
                <select
                  id="ai-size-body-shape"
                  name="bodyShape"
                  value={bodyShape}
                  onChange={(e) => setBodyShape(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-cream-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gold-400/40"
                >
                  <option value="">不指定</option>
                  {BODY_SHAPE_ADVICE.map((s) => (
                    <option key={s.shape} value={s.shape}>{s.label}</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleRecommend}
                className="w-full py-2.5 bg-gold-500 text-white rounded-lg text-sm hover:bg-gold-600 transition-colors flex items-center justify-center gap-2"
              >
                <Sparkles size={14} />
                立即推薦
              </button>

              {/* Result */}
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-xl p-4 border border-gold-500/30"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Ruler size={16} className="text-gold-500" />
                      <span className="text-sm font-medium">推薦尺寸</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      信心度 {result.confidence}%
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mb-3">
                    {availableSizes.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => onSizeSelect?.(s)}
                        className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${
                          s === result.size
                            ? 'bg-gold-500 text-white ring-2 ring-gold-500/30 scale-110'
                            : 'bg-cream-100 text-foreground/60 hover:bg-cream-200'
                        }`}
                      >
                        {s === result.size && <Check size={10} className="inline mr-0.5" />}
                        {s}
                      </button>
                    ))}
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {result.advice}
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
