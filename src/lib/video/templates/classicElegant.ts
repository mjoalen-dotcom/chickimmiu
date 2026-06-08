import type { VideoTemplate } from './types'

/**
 * Template 1: Classic Elegant（經典氣質）
 * 最穩、最高 CP 值，適合大部分正裝、風衣、洋裝、外套
 */
export const ClassicElegant: VideoTemplate = {
  id: 'classic-elegant',
  displayName: '經典氣質款',
  description: '溫柔從容、畫面乾淨優雅，強調版型與穿出去的感覺。金老佛爺最推薦的萬用模板。',
  recommendedDuration: 10,
  bestFor: ['風衣', '外套', '洋裝', '套裝', '襯衫', '長褲'],
  vibe: '溫柔、知性、有生活質感',

  shotList: [
    {
      id: 'hook',
      type: 'text-hook',
      duration: 1.5,
      description: '開頭快速抓住人（正面或 3/4 側面）',
      camera: '緩慢推進 + 輕微仰角',
      keyAction: '模特兒微微抬頭看鏡頭，眼神溫柔',
      textOverlay: '這件我真的每天都穿'
    },
    {
      id: 'full-body-walk',
      type: 'model-full',
      duration: 3,
      description: '完整展現版型與走路時的自然垂墜',
      camera: '跟拍 + 輕微側移',
      keyAction: '自然慢走 + 輕轉身',
      textOverlay: '版型很乾淨，腰線很漂亮'
    },
    {
      id: 'fabric-detail',
      type: 'fabric-closeup',
      duration: 2.5,
      description: '重點材質與細節',
      camera: '緩慢推進',
      keyAction: '手指輕捏布料、拉腰帶',
      textOverlay: '布料真的很舒服'
    },
    {
      id: 'lifestyle',
      type: 'lifestyle',
      duration: 2,
      description: '真實穿出去的感覺',
      camera: '側面 + 窗邊自然光',
      keyAction: '靠窗站立或輕鬆走動',
      textOverlay: '通勤、約會都好搭'
    },
    {
      id: 'cta',
      type: 'cta',
      duration: 1,
      description: '收尾 CTA',
      camera: '定格微笑',
      keyAction: '溫柔看向鏡頭',
      textOverlay: '真的很推薦'
    }
  ],

  captionStyle: {
    opening: '直接說「我每天都穿」或「真的很推薦」',
    bodyTone: '溫柔、實用、不誇張',
    cta: '輕輕一句「真的很推薦」'
  },

  musicMood: '溫暖輕鬆的鋼琴或輕民謠，帶一點生活感'
}
