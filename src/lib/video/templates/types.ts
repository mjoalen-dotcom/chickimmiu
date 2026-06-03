/**
 * CHIC KIM & MIU — Reels Video Template System
 *
 * 每個 Template 定義一種「影片風格與敘事結構」。
 * 之後只要給商品資料 + 指定 Template，就能自動產生結構化的 Video Brief。
 */

export type TemplateId =
  | 'classic-elegant'   // 經典氣質（最萬用）
  | 'story-emotional'   // 故事生活感（金老佛爺強項）
  | 'detail-obsessed'   // 細節控（強調材質做工）
  | 'quick-sell'        // 快速成交（新品/熱賣/限時）

export interface ShotDefinition {
  id: string
  type: 'model-full' | 'model-detail' | 'fabric-closeup' | 'lifestyle' | 'text-hook' | 'cta'
  duration: number // 建議秒數
  description: string // 這一鏡要做什麼
  camera: string
  keyAction: string
  textOverlay?: string
}

export interface VideoTemplate {
  id: TemplateId
  displayName: string
  description: string
  recommendedDuration: number // 總秒數建議
  bestFor: string[] // 適合哪些類型的商品
  vibe: string

  // 固定鏡頭順序（最重要）
  shotList: ShotDefinition[]

  // 文案調性
  captionStyle: {
    opening: string
    bodyTone: string
    cta: string
  }

  // 音樂氛圍建議
  musicMood: string
}
