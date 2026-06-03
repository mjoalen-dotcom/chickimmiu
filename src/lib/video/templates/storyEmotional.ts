import type { VideoTemplate } from './types'

/**
 * Template 2: Story Emotional（故事生活感）
 * 金老佛爺最擅長的調性，帶一點生活小故事、情感連結。
 * 適合需要「人味」的商品。
 */
export const StoryEmotional: VideoTemplate = {
  id: 'story-emotional',
  displayName: '故事生活感',
  description: '帶一點個人小故事與情感，觀眾會覺得「這是她在真的穿」。最有金老佛爺味道的模板。',
  recommendedDuration: 12,
  bestFor: ['洋裝', '針織', '外套', '日常穿搭單品', '有故事的商品'],
  vibe: '溫暖、有故事、像朋友聊天',

  shotList: [
    {
      id: 'personal-hook',
      type: 'text-hook',
      duration: 2,
      description: '用生活小故事開頭',
      camera: '近距離溫柔眼神',
      keyAction: '微笑說話感（或旁白）',
      textOverlay: '我前陣子又把它拿出來穿...'
    },
    {
      id: 'memory-moment',
      type: 'lifestyle',
      duration: 3,
      description: '回憶或日常穿著畫面',
      camera: '柔和窗光 + 生活場景',
      keyAction: '自然動作（整理頭髮、靠窗看遠方）',
      textOverlay: '那天穿去喝咖啡很好看'
    },
    {
      id: 'why-love-it',
      type: 'model-full',
      duration: 3,
      description: '講為什麼喜歡這件（版型 / 舒適 / 好搭）',
      camera: '跟拍轉身',
      keyAction: '邊走邊輕觸衣服',
      textOverlay: '真的好搭，衣櫃裡很多衣服都能配'
    },
    {
      id: 'honest-detail',
      type: 'fabric-closeup',
      duration: 2.5,
      description: '誠實講小缺點或真實優點',
      camera: '極近距離材質',
      keyAction: '手指在布料上畫圈',
      textOverlay: '我手臂有點肉，這袖子剛好遮住'
    },
    {
      id: 'warm-cta',
      type: 'cta',
      duration: 1.5,
      description: '溫柔推薦',
      camera: '定格溫柔笑容',
      keyAction: '輕輕點頭',
      textOverlay: '有需要的話可以試試看'
    }
  ],

  captionStyle: {
    opening: '用「我前陣子...」「那天穿去...」這種生活化開頭',
    bodyTone: '誠實、溫暖、帶一點自嘲',
    cta: '很輕、很真誠的推薦'
  },

  musicMood: '溫柔的吉他或鋼琴，帶一點懷舊感'
}
