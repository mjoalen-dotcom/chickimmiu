/**
 * MBTI64 場合擴充（PR-Y）
 * ─────────────────────────────────────
 * 16 MBTI 基本型 × 4 場合 = 64 sub-personalities
 *
 * 4 場合（occasion）：
 *   - urban    都會：工作 / 通勤 / 商務社交
 *   - vacation 度假：旅行 / 戶外 / 放鬆
 *   - party    派對：夜晚 / 慶典 / 節慶
 *   - cozy     居家：在家 / 散步 / 休閒日常
 *
 * 用法：
 *   1. 玩家做完 28 題基本 MBTI + 4 題 lifestyle 場合題
 *   2. 推算 primaryOccasion（最高分場合）
 *   3. 結果頁顯示 4 個 sub-personality（玩家所屬 MBTI 型 × 4 場合）
 *   4. 商品推薦依 (mbtiType, occasion) tuple 對應 collectionTags
 *
 * 64 個 sub-personality 各有：
 *   - subTagline:   一句話 sub-type slogan
 *   - outfitTips:   3 條穿搭建議
 *   - keyItems:     重點單品（4-6 個）
 *   - paletteHint:  色彩提示（2-4 色）
 *   - collectionTags:對應 Products.collectionTags 的 enum value（補強基本型）
 */

import type { MBTIType } from './mbtiResults'

export type OccasionMode = 'urban' | 'vacation' | 'party' | 'cozy'

export const OCCASION_LIST: OccasionMode[] = ['urban', 'vacation', 'party', 'cozy']

export const OCCASION_META: Record<
  OccasionMode,
  {
    label: string
    icon: string
    accent: string
    description: string
    /** lifestyle 題 +1 分時對應的場合；參考用 */
    lifestyleHint: string
  }
> = {
  urban: {
    label: '都會',
    icon: '🏙️',
    accent: 'from-slate-500 to-indigo-600',
    description: '工作日 / 通勤 / 商務社交場合',
    lifestyleHint: '咖啡廳工作、城市散步、職場會議',
  },
  vacation: {
    label: '度假',
    icon: '🌴',
    accent: 'from-amber-400 to-orange-500',
    description: '旅行 / 戶外 / 放鬆出走場合',
    lifestyleHint: '看海、爬山、城外咖啡廳、機場',
  },
  party: {
    label: '派對',
    icon: '✨',
    accent: 'from-rose-500 to-fuchsia-600',
    description: '夜晚 / 派對 / 慶典 / 節慶場合',
    lifestyleHint: '生日趴、夜店、紅毯、慶功宴',
  },
  cozy: {
    label: '居家',
    icon: '🏠',
    accent: 'from-stone-300 to-rose-300',
    description: '在家 / 散步 / 鄰居買菜 / 寵物日常',
    lifestyleHint: '在家烤甜點、看劇、社區散步',
  },
}

export interface MBTISubResult {
  subTagline: string
  outfitTips: string[]
  keyItems: string[]
  paletteHint: string
  collectionTags: string[]
}

/**
 * 16 × 4 = 64 sub-personalities
 *
 * 命名 key：`${MBTIType}-${OccasionMode}` — 例如 'INTJ-urban'
 */
export const MBTI_SUB_RESULTS: Record<string, MBTISubResult> = {
  /* ───── INTJ 建築師：冷靜俐落極簡知性派 ───── */
  'INTJ-urban': {
    subTagline: '都會建築師：用結構征服早八到晚十',
    outfitTips: [
      '深色西裝套裝為主軸，肩線堅挺、腰線俐落',
      '白色或灰色合身上衣 + 修身西裝褲，避免 oversize',
      '銀色細項鍊或金屬感耳釘，杜絕花俏配件',
    ],
    keyItems: ['結構洋裝', '黑色西裝外套', '直筒西裝褲', '簡約皮帶', '尖頭跟鞋'],
    paletteHint: '黑、深藍、深灰、駝',
    collectionTags: ['formal-dresses', 'brand-custom'],
  },
  'INTJ-vacation': {
    subTagline: '度假建築師：山與海皆是我的計畫',
    outfitTips: [
      'Linen 寬鬆襯衫 + 同色系直筒褲，帶結構但好走動',
      '簡約墨鏡 + 帆布托特包，不選蕾絲與印花',
      '低調米白或灰綠系，避免亮粉與濃豔色',
    ],
    keyItems: ['亞麻襯衫', '寬擺長裙', '帆布托特', '經典墨鏡', '皮拖'],
    paletteHint: '米白、灰綠、卡其、奶油',
    collectionTags: ['brand-custom'],
  },
  'INTJ-party': {
    subTagline: '夜場建築師：黑色禮服 + 一個亮點',
    outfitTips: [
      '黑色俐落禮服或結構襯衫裙，不挑澎裙',
      '一件 statement 銀飾或紅唇做唯一焦點',
      '線條乾淨、不亂層次，氣場勝過繽紛',
    ],
    keyItems: ['黑色洋裝', '結構連身褲', '高跟鞋', '迷你包', '銀飾耳環'],
    paletteHint: '黑、酒紅、銀、墨綠',
    collectionTags: ['formal-dresses', 'celebrity-style'],
  },
  'INTJ-cozy': {
    subTagline: '居家建築師：灰調針織主義者',
    outfitTips: [
      '灰色或駝色針織 + 寬鬆直筒褲，材質要好',
      '單色家居拖鞋，避免毛茸茸或卡通圖',
      '配件僅一只手錶或細鏈，極簡到底',
    ],
    keyItems: ['長版針織', '駝色羊毛開襟', '高腰寬褲', '簡約襪子', '極簡手錶'],
    paletteHint: '駝、淺灰、米、奶白',
    collectionTags: ['brand-custom'],
  },

  /* ───── INTP 邏輯學家：低調文藝中性實穿派 ───── */
  'INTP-urban': {
    subTagline: '都會學者：襯衫 + 寬褲是我的城市制服',
    outfitTips: [
      '白色或灰調棉襯衫 + 寬版西裝褲，書卷氣',
      '搭一只皮托特裝 MacBook，配色不超過 3 色',
      '免複雜配件，眼鏡就是最好的 statement',
    ],
    keyItems: ['素色棉襯衫', '寬版西裝褲', '單色針織', '皮托特', '簡約眼鏡'],
    paletteHint: '白、淺灰、駝、深藍',
    collectionTags: ['brand-custom'],
  },
  'INTP-vacation': {
    subTagline: '度假學者：書與海風是我最好的伴侶',
    outfitTips: [
      '舒服棉麻長裙或寬褲，色系沉穩好搭',
      '草帽 + 帆布袋是必要，不要任何 logo',
      '配色保留 1 個低彩度亮點（淡藍或淺粉）',
    ],
    keyItems: ['麻棉長裙', '寬棉褲', '草帽', '帆布托特', '皮拖鞋'],
    paletteHint: '淺米、奶茶、淺藍、莫蘭迪粉',
    collectionTags: ['brand-custom'],
  },
  'INTP-party': {
    subTagline: '夜場學者：書卷氣的 black-tie',
    outfitTips: [
      '黑色或墨綠絲質連身褲，比禮服更舒服',
      '中性風皮革小肩背包，避免閃亮鑲鑽',
      '低跟鞋或粗跟靴，舞池跑得動',
    ],
    keyItems: ['絲質連身褲', '黑色針織連衣裙', '中性西裝外套', '皮革鏈包', '粗跟靴'],
    paletteHint: '黑、墨綠、深紫、銀灰',
    collectionTags: ['celebrity-style', 'brand-custom'],
  },
  'INTP-cozy': {
    subTagline: '居家學者：能直接出門買咖啡的舒適',
    outfitTips: [
      '寬鬆 T-shirt + 棉麻寬褲，重點是「能出門」',
      '針織開襟方便加減層次',
      '帆布鞋常駐玄關，不換鞋直接走',
    ],
    keyItems: ['寬版 T', '棉麻寬褲', '針織開襟', '棉襪', '帆布鞋'],
    paletteHint: '白、米、灰、淺卡其',
    collectionTags: ['brand-custom'],
  },

  /* ───── ENTJ 指揮官：氣場全開 Power Dressing ───── */
  'ENTJ-urban': {
    subTagline: '都會指揮官：肩線就是談判桌',
    outfitTips: [
      '結構西裝套裝或硬挺襯衫裙，肩部有設計',
      '酒紅或深藍配色 + 金屬感配件做亮點',
      '尖頭跟鞋一定到位，不容妥協',
    ],
    keyItems: ['結構西裝套裝', '硬挺襯衫', '及膝鉛筆裙', '金釦皮帶', '尖頭跟鞋'],
    paletteHint: '黑、深藍、酒紅、駱駝',
    collectionTags: ['formal-dresses', 'brand-custom'],
  },
  'ENTJ-vacation': {
    subTagline: '度假指揮官：穿一件白裙也要 hold 住',
    outfitTips: [
      '純白或米色長洋裝，剪裁有腰線',
      '草帽 + 鎖鏈包，不挑度假感太強的元素',
      '色彩不繁雜，sun-kissed 風格但保留優雅',
    ],
    keyItems: ['白色長洋裝', '針織比基尼罩衫', '寬擺裙褲', '鎖鏈手提包', '麂皮涼鞋'],
    paletteHint: '白、米、淺褐、海軍藍',
    collectionTags: ['celebrity-style', 'brand-custom'],
  },
  'ENTJ-party': {
    subTagline: '夜場指揮官：紅 / 酒紅 power gown',
    outfitTips: [
      '酒紅或鮮紅 power gown 是首選，剪裁要修身',
      '尖頭高跟 + 大耳環一次給夠',
      '濃豔紅唇取代繁複層次，氣場全開',
    ],
    keyItems: ['酒紅長禮服', '深 V 連身褲', '幾何耳環', '鎖鏈包', '高跟鞋'],
    paletteHint: '酒紅、墨綠、金、黑',
    collectionTags: ['formal-dresses', 'celebrity-style'],
  },
  'ENTJ-cozy': {
    subTagline: '居家指揮官：在家也保有領袖感',
    outfitTips: [
      '深色羊毛家居洋裝或針織連身，材質要好',
      '不留鬆垮細節，腰部線條要保留',
      '配件最多一只手錶或項鍊，乾淨得體',
    ],
    keyItems: ['針織連身洋裝', '羊毛開襟外套', '長版針織衫', '皮拖鞋', '極簡項鍊'],
    paletteHint: '深藍、深灰、駝、酒紅',
    collectionTags: ['brand-custom'],
  },

  /* ───── ENTP 辯論家：混搭玩味個性派 ───── */
  'ENTP-urban': {
    subTagline: '都會辯論家：印 T + 西裝外套',
    outfitTips: [
      '西裝外套 + 印 T 經典混搭，下身選休閒西褲',
      '一個 statement 帆布袋或復古手提包',
      '休閒鞋 / 樂福鞋切換看當天氣場',
    ],
    keyItems: ['印 T', '西裝外套', '休閒西褲', '托特包', '樂福鞋'],
    paletteHint: '白、卡其、酒紅、深藍',
    collectionTags: ['host-style', 'celebrity-style'],
  },
  'ENTP-vacation': {
    subTagline: '度假辯論家：印花 + 草帽永遠對',
    outfitTips: [
      '熱帶印花襯衫或洋裝，色彩可大膽撞',
      '寬擺裙搭運動鞋是只有你 hold 得住',
      '一條絲巾打髮帶或腰帶都好玩',
    ],
    keyItems: ['印花洋裝', '草帽', '寬擺裙', '運動涼鞋', '絲巾'],
    paletteHint: '橘、椰青、奶油黃、墨綠',
    collectionTags: ['celebrity-style', 'host-style'],
  },
  'ENTP-party': {
    subTagline: '夜場辯論家：撞色禮服 + 復古元素',
    outfitTips: [
      '不對稱版型或撞色禮服，誇張剪裁無妨',
      '復古耳環 + 細跟涼鞋平衡華麗',
      '一抹紫紅或寶藍唇色是你的記憶點',
    ],
    keyItems: ['不對稱禮服', '復古洋裝', '撞色連身褲', '誇張耳環', '緞面跟鞋'],
    paletteHint: '寶藍、紫紅、芥末黃、墨綠',
    collectionTags: ['celebrity-style', 'host-style'],
  },
  'ENTP-cozy': {
    subTagline: '居家辯論家：搞怪 logo Tee + 短褲',
    outfitTips: [
      '俏皮 logo / 文字 T + 寬鬆短褲，不無聊',
      '襪子可以亂搭顏色，這就是你的玩心',
      '在家戴復古帽也行，反正有趣最重要',
    ],
    keyItems: ['logo T', '寬鬆短褲', '混色襪', '復古貝雷帽', '休閒拖鞋'],
    paletteHint: '深藍、芥末黃、酒紅、白',
    collectionTags: ['host-style'],
  },

  /* ───── INFJ 提倡者：詩意層次莫蘭迪派 ───── */
  'INFJ-urban': {
    subTagline: '都會詩人：層次莫蘭迪 + 絲質',
    outfitTips: [
      '絲質襯衫 + 米色或灰色長裙，溫柔有重量',
      '羊毛大衣是冬季 must-have，材質要細膩',
      '小耳環 + 一條細鏈即可，避免過載',
    ],
    keyItems: ['絲質襯衫', '長版針織', '米色長裙', '羊毛大衣', '小巧手提包'],
    paletteHint: '莫蘭迪粉、灰藍、米駝、奶茶',
    collectionTags: ['brand-custom', 'celebrity-style'],
  },
  'INFJ-vacation': {
    subTagline: '度假詩人：白裙 + 草帽 + 詩集',
    outfitTips: [
      '白色 / 米色長洋裝，剪裁柔和',
      '草帽 + 麻質托特包，整體偏天然',
      '配色低彩度，不超過 3 色',
    ],
    keyItems: ['白長洋裝', '麻質托特', '草帽', '麂皮涼鞋', '絲巾'],
    paletteHint: '白、米、淡藍、奶茶',
    collectionTags: ['celebrity-style'],
  },
  'INFJ-party': {
    subTagline: '夜場詩人：層次絲緞 + 莫蘭迪暗色',
    outfitTips: [
      '深紫或墨綠絲緞洋裝，剪裁柔和不過於 sexy',
      '小巧 micro bag + 細跟涼鞋',
      '裸妝 + 玫瑰唇色，不誇張不冷淡',
    ],
    keyItems: ['絲緞洋裝', '長版針織連身', '小巧鏈包', '細跟涼鞋', '珍珠耳環'],
    paletteHint: '墨綠、深紫、酒紅、奶白',
    collectionTags: ['celebrity-style', 'brand-custom'],
  },
  'INFJ-cozy': {
    subTagline: '居家詩人：奶茶毛衣 + 木質香氛',
    outfitTips: [
      '奶茶或灰粉色羊毛開襟 + 同色系長褲',
      '柔軟襪子 + 棉拖鞋，整體偏溫暖',
      '簡單耳環，配香氛蠟燭就完美',
    ],
    keyItems: ['羊毛開襟', '長版針織', '棉麻長褲', '毛襪', '棉拖'],
    paletteHint: '奶茶、灰粉、米白、淺灰',
    collectionTags: ['brand-custom', 'celebrity-style'],
  },

  /* ───── INFP 調停者：浪漫文藝波西米亞派 ───── */
  'INFP-urban': {
    subTagline: '都會詩人：印花長裙 + 復古開襟',
    outfitTips: [
      '小碎花或植物印花長洋裝 + 復古針織開襟',
      '帆布托特或絨面手提包，避免太硬挺',
      '低跟瑪麗珍鞋或軟皮樂福鞋',
    ],
    keyItems: ['印花長裙', '復古開襟', '針織背心', '絨面手提', '瑪麗珍鞋'],
    paletteHint: '奶茶、藕粉、淡藍、淡黃',
    collectionTags: ['celebrity-style'],
  },
  'INFP-vacation': {
    subTagline: '度假詩人：自然系波西米亞',
    outfitTips: [
      '蕾絲邊長洋裝 + 編織涼鞋，整體放鬆',
      '草編包 + 流蘇圍巾，自由不拘',
      '色彩柔但有亮點（淡橘 / 嫩綠）',
    ],
    keyItems: ['蕾絲長裙', '碎花上衣', '草編包', '編織涼鞋', '流蘇圍巾'],
    paletteHint: '淡綠、藕粉、奶油黃、白',
    collectionTags: ['celebrity-style'],
  },
  'INFP-party': {
    subTagline: '夜場詩人：紗質夢幻洋裝',
    outfitTips: [
      '紗質或蕾絲短洋裝，柔和透視層次',
      '小巧珍珠包 + 一字繫帶涼鞋',
      '玫瑰金飾品 + 微亮腮紅',
    ],
    keyItems: ['紗質洋裝', '蕾絲連身', '珍珠包', '繫帶涼鞋', '蝴蝶結髮飾'],
    paletteHint: '玫瑰金、藕粉、淺紫、奶白',
    collectionTags: ['celebrity-style', 'host-style'],
  },
  'INFP-cozy': {
    subTagline: '居家詩人：法式碎花睡衣風',
    outfitTips: [
      '碎花棉麻睡衣或寬鬆洋裝，超軟材質',
      '針織開襟外套 + 毛襪，整體鬆軟',
      '一杯茶 + 一本書就完美',
    ],
    keyItems: ['碎花長裙', '針織開襟', '毛絨拖鞋', '蕾絲手帕', '髮帶'],
    paletteHint: '藕粉、奶白、淡綠、淺黃',
    collectionTags: ['celebrity-style'],
  },

  /* ───── ENFJ 主人公：溫暖知性優雅甜美派 ───── */
  'ENFJ-urban': {
    subTagline: '都會主人公：溫柔職場優雅',
    outfitTips: [
      '柔和米色 / 奶茶套裝，不過於冷峻',
      '及膝洋裝 + 短版針織開襟，得體有溫度',
      '珍珠耳環 + 雅緻手提包',
    ],
    keyItems: ['米色西裝', '及膝洋裝', '針織開襟', '珍珠飾品', '雅緻手提'],
    paletteHint: '奶茶、藕粉、淺藍、奶白',
    collectionTags: ['host-style', 'celebrity-style'],
  },
  'ENFJ-vacation': {
    subTagline: '度假主人公：溫柔陽光女神',
    outfitTips: [
      '鵝黃或奶白色長洋裝，剪裁柔和',
      '麂皮涼鞋 + 草帽，整體溫和',
      '一抹珊瑚紅唇是你的招牌',
    ],
    keyItems: ['鵝黃洋裝', '碎花長裙', '草帽', '麂皮涼鞋', '簡約手鐲'],
    paletteHint: '鵝黃、奶白、淺粉、淺藍',
    collectionTags: ['celebrity-style', 'host-style'],
  },
  'ENFJ-party': {
    subTagline: '夜場主人公：粉色禮服 + 大耳環',
    outfitTips: [
      '粉色或藕色禮服，剪裁優雅有腰線',
      '水鑽或閃亮耳環一次給足',
      '裸色高跟 + 玫瑰金妝',
    ],
    keyItems: ['粉色禮服', '蕾絲連身', '閃耳環', '裸色跟鞋', '亮片小包'],
    paletteHint: '藕粉、玫瑰金、淺紫、奶白',
    collectionTags: ['host-style', 'celebrity-style'],
  },
  'ENFJ-cozy': {
    subTagline: '居家主人公：奶茶針織 + 溫暖燈光',
    outfitTips: [
      '奶茶 / 米駝色針織連身，柔和材質',
      '羊毛開襟 + 軟拖鞋，整體溫暖',
      '一只小巧珍珠耳釘即可',
    ],
    keyItems: ['針織連身洋裝', '羊毛開襟', '軟拖鞋', '珍珠耳釘', '髮帶'],
    paletteHint: '奶茶、藕粉、米白、淺灰',
    collectionTags: ['celebrity-style'],
  },

  /* ───── ENFP 競選者：活力滿點色彩故事派 ───── */
  'ENFP-urban': {
    subTagline: '都會競選者：印花洋裝 + 鮮豔配件',
    outfitTips: [
      '碎花 / 復古印花連身洋裝，剪裁不無聊',
      '亮色手提包 + 復古墨鏡',
      '大膽用紅色或鵝黃配件做亮點',
    ],
    keyItems: ['碎花洋裝', '復古襯衫', '亮色手提', '復古墨鏡', '繫帶平底'],
    paletteHint: '紅、橘、鵝黃、靛藍',
    collectionTags: ['celebrity-style', 'host-style'],
  },
  'ENFP-vacation': {
    subTagline: '度假競選者：色彩派對！',
    outfitTips: [
      '熱帶印花連身洋裝，色彩越多越好',
      '彩色草帽 + 大耳環，全身焦點',
      '繽紛色塊涼鞋是 finishing touch',
    ],
    keyItems: ['熱帶洋裝', '色塊上衣', '彩色草帽', '誇張耳環', '繫帶涼鞋'],
    paletteHint: '芒果橘、椰青、寶藍、火紅',
    collectionTags: ['celebrity-style', 'host-style'],
  },
  'ENFP-party': {
    subTagline: '夜場競選者：亮片禮服 + 紅唇',
    outfitTips: [
      '亮片或閃光禮服，反射所有派對燈光',
      '誇張耳環 + 高跟鞋一次到位',
      '大膽紅唇 / 紫唇是身份證',
    ],
    keyItems: ['亮片禮服', '蕾絲連身', '誇張耳環', '亮面跟鞋', '亮片小包'],
    paletteHint: '亮銀、寶藍、火紅、紫紅',
    collectionTags: ['celebrity-style', 'host-style'],
  },
  'ENFP-cozy': {
    subTagline: '居家競選者：彩色家居服 + 笑聲',
    outfitTips: [
      '鮮豔印花居家洋裝，超舒服超浮誇',
      '亂色襪 + 卡通拖鞋都 OK',
      '色彩讓你在家也有戲',
    ],
    keyItems: ['印花居家洋裝', '色塊 T', '混色襪', '卡通拖鞋', '髮飾'],
    paletteHint: '芒果橘、玫瑰粉、椰青、奶白',
    collectionTags: ['celebrity-style', 'host-style'],
  },

  /* ───── ISTJ 物流師：經典恆久品質派 ───── */
  'ISTJ-urban': {
    subTagline: '都會物流師：白襯衫 + 卡其褲',
    outfitTips: [
      '純棉白襯衫 + 卡其直筒褲，永遠不錯',
      '駝色大衣 + 經典皮帶',
      '尖頭跟鞋或樂福鞋，配件不囉嗦',
    ],
    keyItems: ['白襯衫', '卡其長褲', '駝色大衣', '皮帶', '尖頭跟鞋'],
    paletteHint: '白、卡其、駝、深藍',
    collectionTags: ['formal-dresses', 'brand-custom'],
  },
  'ISTJ-vacation': {
    subTagline: '度假物流師：素色長洋裝 + 草帽',
    outfitTips: [
      '純色（米 / 奶白 / 海軍藍）長洋裝',
      '草帽 + 樸素手提，無印花無裝飾',
      '低跟涼鞋走得遠',
    ],
    keyItems: ['純色長裙', '亞麻襯衫', '草帽', '帆布托特', '低跟涼鞋'],
    paletteHint: '米、白、深藍、灰',
    collectionTags: ['brand-custom'],
  },
  'ISTJ-party': {
    subTagline: '夜場物流師：經典小黑裙再現',
    outfitTips: [
      '小黑裙是你的本命，不需要其他',
      '珍珠項鍊 + 黑色高跟鞋，得體俐落',
      '簡約小包，避免亮片與誇張剪裁',
    ],
    keyItems: ['小黑裙', '經典禮服', '珍珠項鍊', '黑色跟鞋', '簡約晚宴包'],
    paletteHint: '黑、深藍、奶白、銀',
    collectionTags: ['formal-dresses', 'brand-custom'],
  },
  'ISTJ-cozy': {
    subTagline: '居家物流師：駝色針織 + 棉拖',
    outfitTips: [
      '駝色或灰色針織開襟 + 直筒長褲',
      '純棉襪 + 皮拖鞋，材質要好',
      '不講究花樣，講究耐用',
    ],
    keyItems: ['針織開襟', '長版毛衣', '直筒褲', '純棉襪', '皮拖鞋'],
    paletteHint: '駝、灰、米、深藍',
    collectionTags: ['brand-custom'],
  },

  /* ───── ISFJ 守衛者：溫柔舒適甜美日常派 ───── */
  'ISFJ-urban': {
    subTagline: '都會守衛者：奶茶針織 + 及膝裙',
    outfitTips: [
      '奶茶針織上衣 + A 字及膝裙',
      '小巧珍珠耳釘 + 簡約手提包',
      '低跟鞋或瑪麗珍，走路不痛',
    ],
    keyItems: ['針織上衣', 'A 字裙', '蓬袖洋裝', '珍珠耳釘', '瑪麗珍鞋'],
    paletteHint: '奶茶、藕粉、米白、淺藍',
    collectionTags: ['celebrity-style', 'host-style'],
  },
  'ISFJ-vacation': {
    subTagline: '度假守衛者：粉色長洋裝 + 髮帶',
    outfitTips: [
      '淡粉或淡藍長洋裝，剪裁柔和',
      '髮帶 + 小巧珍珠飾品',
      '草帽 + 麂皮涼鞋，整體偏溫和',
    ],
    keyItems: ['粉色長裙', '蕾絲上衣', '髮帶', '麂皮涼鞋', '小巧手提'],
    paletteHint: '藕粉、奶白、淡藍、奶茶',
    collectionTags: ['celebrity-style'],
  },
  'ISFJ-party': {
    subTagline: '夜場守衛者：粉色蕾絲禮服',
    outfitTips: [
      '蕾絲粉色或淺紫禮服，甜而不膩',
      '玫瑰金飾品 + 裸色高跟',
      '玫瑰唇色 + 微亮腮紅',
    ],
    keyItems: ['蕾絲禮服', '緞面連身', '玫瑰金飾品', '裸色跟鞋', '珍珠手包'],
    paletteHint: '藕粉、玫瑰金、奶白、淡紫',
    collectionTags: ['celebrity-style', 'host-style'],
  },
  'ISFJ-cozy': {
    subTagline: '居家守衛者：絨毛睡衣 + 熱可可',
    outfitTips: [
      '柔軟絨毛睡衣或寬鬆針織連身',
      '毛拖鞋 + 蓬鬆毛襪',
      '熱可可 / 熱牛奶必備',
    ],
    keyItems: ['絨毛睡衣', '針織連身', '毛拖鞋', '蓬鬆毛襪', '髮帶'],
    paletteHint: '藕粉、奶白、奶茶、淺灰',
    collectionTags: ['celebrity-style'],
  },

  /* ───── ESTJ 總經理：專業俐落商務通勤派 ───── */
  'ESTJ-urban': {
    subTagline: '都會總經理：合身西裝 + 公事包',
    outfitTips: [
      '合身西裝套裝是日常戰服',
      '結構洋裝 + 中跟鞋切換',
      '極簡黑 / 海軍藍配件，不亂搭',
    ],
    keyItems: ['西裝套裝', '結構洋裝', '及膝鉛筆裙', '中跟鞋', '皮革公事包'],
    paletteHint: '黑、海軍藍、米駝、白',
    collectionTags: ['formal-dresses', 'brand-custom'],
  },
  'ESTJ-vacation': {
    subTagline: '度假總經理：素色長洋裝 + 草編托特',
    outfitTips: [
      '純色長洋裝（米 / 白 / 海軍藍）',
      '草編托特 + 經典墨鏡',
      '低跟皮涼鞋，走得遠',
    ],
    keyItems: ['白長裙', '亞麻寬褲', '草編托特', '皮涼鞋', '經典墨鏡'],
    paletteHint: '白、米、海軍藍、淺褐',
    collectionTags: ['brand-custom'],
  },
  'ESTJ-party': {
    subTagline: '夜場總經理：深藍 / 黑色禮服',
    outfitTips: [
      '深藍或黑色俐落禮服，剪裁有腰線',
      '簡約金飾 + 高跟鞋',
      '紅唇做唯一焦點',
    ],
    keyItems: ['深藍禮服', '黑色連身', '金色飾品', '高跟鞋', '小巧手包'],
    paletteHint: '深藍、黑、金、奶白',
    collectionTags: ['formal-dresses', 'celebrity-style'],
  },
  'ESTJ-cozy': {
    subTagline: '居家總經理：羊毛針織 + 及膝裙',
    outfitTips: [
      '質感羊毛針織 + 同色系長褲或裙',
      '配件保留簡約手錶 + 細鏈',
      '在家也保留得體感',
    ],
    keyItems: ['羊毛針織', '及膝針織裙', '長版開襟', '皮拖鞋', '極簡手錶'],
    paletteHint: '深藍、駝、米、深灰',
    collectionTags: ['brand-custom'],
  },

  /* ───── ESFJ 執政官：親和流行社交派 ───── */
  'ESFJ-urban': {
    subTagline: '都會執政官：韓系職場優雅',
    outfitTips: [
      '及膝韓系洋裝 + 短版開襟',
      '珍珠耳環 + 韓風小手提',
      '低跟瑪麗珍 / 樂福鞋',
    ],
    keyItems: ['韓系洋裝', 'A 字裙', '蓬袖上衣', '珍珠飾品', '韓風小手提'],
    paletteHint: '藕粉、奶白、淺藍、奶茶',
    collectionTags: ['celebrity-style', 'host-style'],
  },
  'ESFJ-vacation': {
    subTagline: '度假執政官：粉色印花長裙',
    outfitTips: [
      '碎花或粉色長洋裝，韓系少女風',
      '草帽 + 蝴蝶結手提',
      '淡色腮紅 + 玫瑰唇',
    ],
    keyItems: ['碎花長裙', '蓬袖上衣', '草帽', '蝴蝶結手提', '繫帶涼鞋'],
    paletteHint: '玫瑰粉、奶白、淡綠、奶油黃',
    collectionTags: ['celebrity-style', 'host-style'],
  },
  'ESFJ-party': {
    subTagline: '夜場執政官：粉色蕾絲蓬蓬裙',
    outfitTips: [
      '粉色蓬蓬裙或公主感蕾絲洋裝',
      '玫瑰金水鑽飾品 + 蝴蝶結跟鞋',
      '亮片小手提包',
    ],
    keyItems: ['蓬蓬洋裝', '蕾絲連身', '水鑽飾品', '蝴蝶結跟鞋', '亮片手提'],
    paletteHint: '玫瑰粉、玫瑰金、奶白、淡紫',
    collectionTags: ['celebrity-style', 'host-style'],
  },
  'ESFJ-cozy': {
    subTagline: '居家執政官：粉色家居 + 髮捲',
    outfitTips: [
      '粉色或奶白柔軟家居洋裝',
      '蓬鬆髮捲 + 棉拖鞋',
      '髮帶 + 美甲是必要儀式感',
    ],
    keyItems: ['居家洋裝', '蕾絲睡衣', '髮帶', '蓬鬆拖鞋', '蝴蝶結髮飾'],
    paletteHint: '玫瑰粉、奶白、奶茶、淺紫',
    collectionTags: ['celebrity-style'],
  },

  /* ───── ISTP 鑑賞家：機能極簡街頭派 ───── */
  'ISTP-urban': {
    subTagline: '都會鑑賞家：軍綠工裝風',
    outfitTips: [
      '軍綠或卡其工裝褲 + 短版機能上衣',
      '黑色運動鞋 / 馬丁靴',
      '簡約托特包 + 皮帶',
    ],
    keyItems: ['工裝褲', '機能短版上衣', '皮夾克', '運動鞋', '皮帶'],
    paletteHint: '軍綠、卡其、黑、灰',
    collectionTags: ['brand-custom'],
  },
  'ISTP-vacation': {
    subTagline: '度假鑑賞家：機能戶外風',
    outfitTips: [
      '快乾棉麻長褲 + 短版上衣，方便活動',
      '帆布漁夫帽 + 機能托特',
      '運動涼鞋 / 戶外靴',
    ],
    keyItems: ['機能長褲', '短版上衣', '漁夫帽', '機能托特', '運動涼鞋'],
    paletteHint: '卡其、軍綠、灰、白',
    collectionTags: ['brand-custom'],
  },
  'ISTP-party': {
    subTagline: '夜場鑑賞家：黑色皮革 + 銀飾',
    outfitTips: [
      '黑色皮夾克 + 緊身連身裙',
      '銀色項鍊 / 大耳環',
      '黑色靴子或厚底鞋',
    ],
    keyItems: ['皮夾克', '緊身連身', '銀飾', '黑色厚底', '迷你皮包'],
    paletteHint: '黑、銀、深紅、墨綠',
    collectionTags: ['celebrity-style', 'host-style'],
  },
  'ISTP-cozy': {
    subTagline: '居家鑑賞家：黑灰運動風',
    outfitTips: [
      '黑灰運動衫 + 寬鬆運動褲',
      '帽 T + 棉襪',
      '室內拖鞋 / 短襪',
    ],
    keyItems: ['黑灰運動衫', '寬鬆運動褲', '帽 T', '棉襪', '室內拖鞋'],
    paletteHint: '黑、深灰、軍綠、白',
    collectionTags: ['brand-custom'],
  },

  /* ───── ISFP 探險家：自然復古藝術派 ───── */
  'ISFP-urban': {
    subTagline: '都會探險家：復古印花 + 帆布',
    outfitTips: [
      '小碎花或植物印花長洋裝',
      '帆布托特 + 復古手錶',
      '低跟瑪麗珍 / 帆布鞋',
    ],
    keyItems: ['印花洋裝', '針織開襟', '帆布托特', '復古手錶', '帆布鞋'],
    paletteHint: '奶茶、淺綠、藕粉、奶白',
    collectionTags: ['celebrity-style'],
  },
  'ISFP-vacation': {
    subTagline: '度假探險家：自然系波西米亞',
    outfitTips: [
      '蕾絲長裙 + 編織配件',
      '草帽 + 流蘇圍巾',
      '皮繫帶涼鞋 / 帆布鞋',
    ],
    keyItems: ['蕾絲長裙', '碎花上衣', '草帽', '流蘇圍巾', '繫帶涼鞋'],
    paletteHint: '奶油黃、淡綠、藕粉、米白',
    collectionTags: ['celebrity-style'],
  },
  'ISFP-party': {
    subTagline: '夜場探險家：絲質緞面 + 復古飾品',
    outfitTips: [
      '絲質或緞面短洋裝，色澤柔和',
      '復古耳環 / 流蘇耳環',
      '裸色高跟 + 玫瑰金妝',
    ],
    keyItems: ['絲質洋裝', '緞面連身', '復古耳環', '裸色跟鞋', '小巧鏈包'],
    paletteHint: '玫瑰金、奶白、淺紫、淡綠',
    collectionTags: ['celebrity-style'],
  },
  'ISFP-cozy': {
    subTagline: '居家探險家：碎花棉麻睡衣',
    outfitTips: [
      '碎花棉麻寬鬆洋裝',
      '針織開襟 + 毛襪',
      '一杯花茶 + 一本詩集',
    ],
    keyItems: ['碎花長裙', '針織開襟', '毛襪', '繡花拖鞋', '髮帶'],
    paletteHint: '奶茶、淡綠、藕粉、奶白',
    collectionTags: ['celebrity-style'],
  },

  /* ───── ESTP 企業家：大膽性感潮流前線 ───── */
  'ESTP-urban': {
    subTagline: '都會企業家：合身西裝 + 短版上衣',
    outfitTips: [
      '合身西裝外套 + 緊身短版上衣',
      '及膝鉛筆裙 / 修身西裝褲',
      '尖頭高跟 + 結構手提',
    ],
    keyItems: ['西裝外套', '緊身短版', '鉛筆裙', '尖頭跟鞋', '結構手提'],
    paletteHint: '黑、酒紅、深藍、米',
    collectionTags: ['formal-dresses', 'celebrity-style'],
  },
  'ESTP-vacation': {
    subTagline: '度假企業家：性感比基尼 + 罩衫',
    outfitTips: [
      '比基尼 + 半透明絲質罩衫',
      '誇張墨鏡 + 草帽',
      '繫帶高跟涼鞋',
    ],
    keyItems: ['比基尼', '絲質罩衫', '寬擺裙', '誇張墨鏡', '繫帶涼鞋'],
    paletteHint: '橘紅、寶藍、奶白、火紅',
    collectionTags: ['celebrity-style', 'host-style'],
  },
  'ESTP-party': {
    subTagline: '夜場企業家：深 V 緊身禮服',
    outfitTips: [
      '深 V / 露背緊身禮服，性感俐落',
      '紅唇 + 大耳環',
      '高跟鞋一定夠高',
    ],
    keyItems: ['深 V 禮服', '緊身連身', '大耳環', '高跟鞋', '亮面手包'],
    paletteHint: '紅、黑、寶藍、金',
    collectionTags: ['celebrity-style', 'host-style'],
  },
  'ESTP-cozy': {
    subTagline: '居家企業家：性感運動風',
    outfitTips: [
      '緊身運動上衣 + 短褲',
      '一字露肩 T + 寬鬆短褲',
      '黑色運動拖鞋',
    ],
    keyItems: ['緊身運動衫', '一字 T', '短褲', '運動拖鞋', '髮帶'],
    paletteHint: '黑、深紅、寶藍、銀',
    collectionTags: ['celebrity-style'],
  },

  /* ───── ESFP 表演者：鮮豔奪目舞台派 ───── */
  'ESFP-urban': {
    subTagline: '都會表演者：鮮豔印花連身',
    outfitTips: [
      '鮮豔印花連身洋裝，剪裁誇張',
      '亮色高跟 + 大耳環',
      '紅唇 + 亮腮紅',
    ],
    keyItems: ['印花洋裝', '色塊連身', '誇張耳環', '亮色跟鞋', '亮面手提'],
    paletteHint: '寶藍、火紅、芒果橘、亮綠',
    collectionTags: ['celebrity-style', 'host-style'],
  },
  'ESFP-vacation': {
    subTagline: '度假表演者：熱帶派對風',
    outfitTips: [
      '熱帶印花長洋裝 + 草帽',
      '誇張串珠項鍊 + 大耳環',
      '彩色繫帶涼鞋',
    ],
    keyItems: ['熱帶洋裝', '色塊上衣', '草帽', '串珠項鍊', '繫帶涼鞋'],
    paletteHint: '芒果橘、椰青、寶藍、火紅',
    collectionTags: ['celebrity-style', 'host-style'],
  },
  'ESFP-party': {
    subTagline: '夜場表演者：亮片誇張禮服',
    outfitTips: [
      '亮片或羽毛禮服，整身發光',
      '誇張水鑽耳環 + 高跟鞋',
      '亮色唇 + 亮片眼影',
    ],
    keyItems: ['亮片禮服', '羽毛連身', '水鑽耳環', '亮面跟鞋', '亮片小包'],
    paletteHint: '亮銀、寶藍、火紅、玫瑰金',
    collectionTags: ['celebrity-style', 'host-style'],
  },
  'ESFP-cozy': {
    subTagline: '居家表演者：彩色家居 + 唱歌',
    outfitTips: [
      '鮮豔印花居家洋裝',
      '亂色襪 + 卡通拖鞋',
      '在家也要美',
    ],
    keyItems: ['印花居家洋裝', '色塊 T', '混色襪', '卡通拖鞋', '髮飾'],
    paletteHint: '芒果橘、玫瑰粉、椰青、奶白',
    collectionTags: ['celebrity-style', 'host-style'],
  },
}

/**
 * 對應 user 的 (mbtiType, occasion) → MBTISubResult
 */
export function getSubResult(
  mbtiType: MBTIType,
  occasion: OccasionMode,
): MBTISubResult {
  const key = `${mbtiType}-${occasion}`
  return MBTI_SUB_RESULTS[key]
}

/**
 * 取對立場合（用於「突破自己」推薦）
 */
export function oppositeOccasion(occasion: OccasionMode): OccasionMode {
  switch (occasion) {
    case 'urban':
      return 'vacation'
    case 'vacation':
      return 'urban'
    case 'party':
      return 'cozy'
    case 'cozy':
      return 'party'
  }
}

/**
 * 「平日好運」用：日常 / 安全的 2 個場合（cozy + urban）
 */
export const LUCKY_DAILY_OCCASIONS: OccasionMode[] = ['cozy', 'urban']
