import type { VideoTemplate } from './types'

/**
 * Template 4: Quick Sell（快速成交）
 * 節奏較快、Hook 強、適合新品上市、熱賣、限時優惠、直播帶貨。
 * 目的：讓人看完想馬上點進去看。
 */
export const QuickSell: VideoTemplate = {
  id: 'quick-sell',
  displayName: '快速成交',
  description: '節奏明快、Hook 強烈、重點突出。適合新品、熱賣款、需要快速曝光的商品。',
  recommendedDuration: 8,
  bestFor: ['新品', '熱賣款', '限量', '直播帶貨', '優惠活動商品'],
  vibe: '明快、吸引人、想馬上看更多',

  shotList: [
    {
      id: 'strong-hook',
      type: 'text-hook',
      duration: 1.2,
      description: '最吸睛的畫面 + 強力文字',
      camera: '快速推進',
      keyAction: '正面或最美角度',
      textOverlay: '這件真的太好看了'
    },
    {
      id: 'wow-moment',
      type: 'model-full',
      duration: 2,
      description: '最漂亮的走位或轉身',
      camera: '跟拍 + 快速轉身',
      keyAction: '大動作轉身，衣服飛起',
      textOverlay: '走起來超有型'
    },
    {
      id: 'key-selling-point',
      type: 'model-detail',
      duration: 2,
      description: '最強賣點（版型 / 顏色 / 舒適）',
      camera: '快速切換 2-3 個細節',
      keyAction: '手指快速指出重點',
      textOverlay: '只有這 3 色，賣完就沒了'
    },
    {
      id: 'urgency',
      type: 'lifestyle',
      duration: 1.5,
      description: '真實穿出去很漂亮',
      camera: '自然光 + 生活場景',
      keyAction: '輕鬆走動',
      textOverlay: '今天穿出去好多人問'
    },
    {
      id: 'fast-cta',
      type: 'cta',
      duration: 1.3,
      description: '強力但不硬的 CTA',
      camera: '定格微笑',
      keyAction: '直接看鏡頭',
      textOverlay: '快點進來看'
    }
  ],

  captionStyle: {
    opening: '很直接、很吸睛',
    bodyTone: '明快、有點小興奮',
    cta: '「快點進來看」或「真的很推薦」'
  },

  musicMood: '輕快、正面、有點律動的背景音樂'
}
