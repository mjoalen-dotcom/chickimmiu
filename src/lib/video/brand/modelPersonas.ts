/**
 * CHIC KIM & MIU — Brand Model Personas
 *
 * 這些是持久化的 AI 模特兒角色定義，用來產生「真人模特兒穿搭實拍感」的社群短影音。
 * 目標：建立品牌辨識度，讓觀眾感覺是「同一個人」在不同單品中自然展現穿搭。
 *
 * 目前策略（Phase 1）：先用 1 個主力角色，求「可用」與一致性。
 * 多樣化角色會在後續迭代加入。
 */

export interface ModelPersona {
  id: string
  displayName: string
  ageRange: string
  description: string // 給 video_gen 的核心外貌描述
  bodySpec: string
  hair: string
  makeup: string
  vibe: string
  typicalPoses: string[]
  negativePrompt: string // 固定負向提示，避免每次生成跑偏
}

/**
 * 主力角色：「Kim 系熟女溫柔知性款」
 * 定位：接近金老佛爺自身的調性，30+ 女性最有共鳴
 * 這是 Phase 1 優先使用的角色
 */
export const KIM_MAIN: ModelPersona = {
  id: 'kim-main',
  displayName: 'Kim 系熟女溫柔知性款',
  ageRange: '32-36 歲',
  description: `
32-36 歲的韓台混血女性，杏仁眼、鼻樑自然不誇張、臉型柔和帶一點成熟感。
皮膚白皙帶奶油光澤，微笑時眼尾有細微自然紋路（不完美但真實）。
身材勻稱，168cm 左右，52-55kg，梨形或標準身形，肩線柔和，手臂線條自然。
整體氣質溫柔、從容、不刻意，像隔壁會好好穿衣服的姊姊。
  `.trim(),
  bodySpec: '168cm / 52-55kg，梨形或標準身形，肩線柔和，腰臀比例自然',
  hair: '中長微卷髮，髮尾自然捲，顏色偏奶茶或自然黑棕，偶爾夾半邊或低馬尾',
  makeup: '裸色唇、微暈腮紅、眉毛自然不刻意，眼線極細或幾乎無，皮膚透亮不假',
  vibe: '溫柔、從容、知性、親切、不端架子、有生活感',
  typicalPoses: [
    '自然慢走 + 輕微轉身',
    '手指輕觸衣角或布料',
    '側身回眸看鏡頭',
    '低頭整理袖口或衣擺',
    '雙手插口袋站立',
    '輕鬆靠窗或坐在咖啡廳椅子上'
  ],
  negativePrompt: `
不要太年輕（小於 30 歲）、不要歐美感、不要誇張五官、不要完美無瑕皮膚、
不要過度性感、不要夜店妝、不要假睫毛、不要過白或過黃皮膚、
不要僵硬的棚拍姿勢、不要過度笑容、不要商業模特兒死板表情
  `.trim()
}

/**
 * 未來備用角色（目前不啟用）
 * 活力韓系女孩（26-29 歲，更跳、更甜，適合 jin-live / 年輕款）
 */
export const KIM_YOUNG: ModelPersona = {
  id: 'kim-young',
  displayName: '活力韓系女孩',
  ageRange: '26-29 歲',
  description: '更年輕、清爽、短髮或高馬尾、笑容明亮，適合可愛或休閒款式。',
  bodySpec: '165-168cm，偏直筒或微有曲線',
  hair: '短髮、清爽馬尾、或自然直髮',
  makeup: '清透、微甜、唇色偏蜜桃',
  vibe: '清新、活潑、有朝氣',
  typicalPoses: ['輕快走路', '轉圈', '比手勢'],
  negativePrompt: KIM_MAIN.negativePrompt
}

export const ALL_PERSONAS = [KIM_MAIN, KIM_YOUNG] as const

export type PersonaId = (typeof ALL_PERSONAS)[number]['id']

/**
 * 預設主力角色（Phase 1 強烈建議使用這個）
 */
export const DEFAULT_PERSONA = KIM_MAIN
