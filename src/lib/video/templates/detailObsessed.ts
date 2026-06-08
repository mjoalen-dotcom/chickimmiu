import type { VideoTemplate } from './types'

/**
 * Template 3: Detail Obsessed（細節控）
 * 重視材質、做工、細節，適合高單價或有特別工藝的商品。
 * 給想要「很專業、很值得」的感覺。
 */
export const DetailObsessed: VideoTemplate = {
  id: 'detail-obsessed',
  displayName: '細節控',
  description: '大量近距離細節 + 材質展示，讓觀眾覺得「這件真的很用心」。適合中高價位商品。',
  recommendedDuration: 11,
  bestFor: ['高單價外套', '特殊材質洋裝', '手工/細節款', '羊毛、皮革、蕾絲類'],
  vibe: '專業、用心、值得擁有',

  shotList: [
    {
      id: 'hero-detail',
      type: 'fabric-closeup',
      duration: 2,
      description: '最漂亮的材質特寫開場',
      camera: '極慢推進 + 淺景深',
      keyAction: '光線掃過布料',
      textOverlay: '這件布料真的很特別'
    },
    {
      id: 'craft-detail',
      type: 'model-detail',
      duration: 2.5,
      description: '車線、釦子、接縫等做工',
      camera: '微距 + 環繞',
      keyAction: '手指慢慢滑過細節',
      textOverlay: '車線很整齊，做工很講究'
    },
    {
      id: 'movement-test',
      type: 'model-full',
      duration: 3,
      description: '實際穿著測試垂墜與活動度',
      camera: '跟拍 + 轉身',
      keyAction: '大幅度轉身、坐下、走動',
      textOverlay: '走動的時候很漂亮'
    },
    {
      id: 'honest-material',
      type: 'fabric-closeup',
      duration: 2,
      description: '誠實講厚薄、透氣、易皺等特性',
      camera: '近距離材質',
      keyAction: '拉扯、捏、對光',
      textOverlay: '有點透，但裡面搭內搭就很美'
    },
    {
      id: 'worth-it',
      type: 'cta',
      duration: 1.5,
      description: '值得投資的感覺',
      camera: '定格 + 輕微推進',
      keyAction: '溫柔但堅定的眼神',
      textOverlay: '值得'
    }
  ],

  captionStyle: {
    opening: '從材質直接切入',
    bodyTone: '專業但不冷冰冰，帶點生活真實感',
    cta: '「值得」兩個字就夠了'
  },

  musicMood: '乾淨、質感、輕微空靈的背景音樂'
}
