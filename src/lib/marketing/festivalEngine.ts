/**
 * 節慶行銷活動引擎
 * ─────────────────────────────────────
 * CHIC KIM & MIU 節慶行銷自動化核心邏輯
 *
 * 支援 10+ 節慶類型，每個節慶含完整的 3 階段行銷 Journey：
 *   預熱（warmup）→ 高峰（peak）→ 回購（followup）
 *
 * ⚠️ 所有前台文案一律使用前台稱號（優雅初遇者、曦漾仙子...）
 *    絕對不可出現 ordinary / bronze / gold 等後台分級碼
 *    絕對不可出現 VIP1 / BLK1 等分群碼
 */

import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'
import { TIER_FRONT_NAMES } from '../crm/tierEngine'
import { SEGMENT_DEFINITIONS } from '../crm/segmentationEngine'

// ══════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════

export interface FestivalDef {
  name: string
  months: number[]
  description: string
  defaultDuration: number
  defaultWarmupDays: number
}

export interface FestivalOffer {
  discountType: string
  discountValue: number
  couponCode: string
  pointsMultiplier: number
  bonusPoints: number
  freeShipping: boolean
  additionalPerks: string[]
}

export interface FestivalJourneyPlan {
  festivalType: string
  phases: Array<{
    phase: 'warmup' | 'peak' | 'followup'
    offsetDays: number
    durationHours: number
    messages: Array<{
      channel: string
      subject: string
      content: string
      delay: number
    }>
  }>
  offer: FestivalOffer
}

// ══════════════════════════════════════════════════════════
// 10 大節慶定義
// ══════════════════════════════════════════════════════════

export const FESTIVAL_DEFINITIONS: Record<string, FestivalDef> = {
  valentines: {
    name: '情人節 / 七夕',
    months: [2, 8],
    description: '浪漫氛圍，情侶送禮 & 約會穿搭',
    defaultDuration: 7,
    defaultWarmupDays: 7,
  },
  mothers_day: {
    name: '母親節',
    months: [5],
    description: '感恩母親，優雅女性穿搭推薦',
    defaultDuration: 10,
    defaultWarmupDays: 10,
  },
  womens_day: {
    name: '婦女節',
    months: [3],
    description: '三八女王節，寵愛自己',
    defaultDuration: 5,
    defaultWarmupDays: 5,
  },
  dragon_boat: {
    name: '端午節',
    months: [6],
    description: '夏日輕盈穿搭',
    defaultDuration: 5,
    defaultWarmupDays: 3,
  },
  mid_autumn: {
    name: '中秋節',
    months: [9],
    description: '秋日優雅穿搭',
    defaultDuration: 7,
    defaultWarmupDays: 5,
  },
  double_eleven: {
    name: '雙 11',
    months: [11],
    description: '年度最大購物盛事',
    defaultDuration: 3,
    defaultWarmupDays: 14,
  },
  black_friday: {
    name: '黑色星期五',
    months: [11],
    description: '感恩節 & 黑五特賣',
    defaultDuration: 5,
    defaultWarmupDays: 7,
  },
  christmas_newyear: {
    name: '聖誕節 & 跨年',
    months: [12],
    description: '年末派對 & 新年新衣',
    defaultDuration: 14,
    defaultWarmupDays: 10,
  },
  birthday_month: {
    name: '生日月',
    months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    description: '每月壽星專屬禮遇',
    defaultDuration: 30,
    defaultWarmupDays: 1,
  },
  seasonal_launch: {
    name: '季節換季新品',
    months: [3, 9],
    description: '春夏 / 秋冬新品發表',
    defaultDuration: 14,
    defaultWarmupDays: 7,
  },
}

// ══════════════════════════════════════════════════════════
// 客群 → 優惠等級對照
// ══════════════════════════════════════════════════════════

/** 前台稱號映射（用於文案產生） */
function getTierFrontName(tierCode: string): string {
  return TIER_FRONT_NAMES[tierCode] ?? '會員'
}

/** 分群前台標籤（用於文案產生） */
function getSegmentLabel(segmentCode: string): string {
  return SEGMENT_DEFINITIONS[segmentCode]?.label ?? '會員'
}

/**
 * 依分群碼取得優惠等級倍率
 * VIP1/VIP2 最高，BLK1 最低
 */
function getSegmentOfferLevel(segmentCode: string): number {
  const levels: Record<string, number> = {
    VIP1: 1.0,
    VIP2: 0.9,
    POT1: 0.7,
    REG1: 0.6,
    REG2: 0.5,
    NEW1: 0.55,
    RISK1: 0.4,
    RISK2: 0.3,
    SLP1: 0.65, // 沉睡客給予較高優惠以促進回歸
    BLK1: 0.1,
  }
  return levels[segmentCode] ?? 0.5
}

/**
 * 依信用分數取得額外折扣加成百分比
 * ≥90 分：+3~5%
 * 70~89：+1~2%
 * <70：+0%
 */
function getCreditScoreBonus(creditScore: number): number {
  if (creditScore >= 95) return 5
  if (creditScore >= 90) return 3
  if (creditScore >= 80) return 2
  if (creditScore >= 70) return 1
  return 0
}

// ══════════════════════════════════════════════════════════
// 節慶文案模板庫
// ══════════════════════════════════════════════════════════

/**
 * 節慶 × 階段 × 通道 × 客群的完整文案模板
 *
 * 命名規則：{festivalType}_{phase}_{channel}_{segmentTier}
 * segmentTier: 'vip' | 'regular' | 'new' | 'risk' | 'sleep'
 */
type CopySegmentTier = 'vip' | 'regular' | 'new' | 'risk' | 'sleep'

function mapSegmentToTier(segmentCode: string): CopySegmentTier {
  if (['VIP1', 'VIP2'].includes(segmentCode)) return 'vip'
  if (['REG1', 'REG2', 'POT1'].includes(segmentCode)) return 'regular'
  if (['NEW1'].includes(segmentCode)) return 'new'
  if (['RISK1', 'RISK2', 'BLK1'].includes(segmentCode)) return 'risk'
  if (['SLP1'].includes(segmentCode)) return 'sleep'
  return 'regular'
}

interface CopyTemplate {
  subject: string
  content: string
}

/**
 * 情人節文案模板（3 階段 × 4 通道 × 5 客群差異）
 */
const VALENTINES_COPY: Record<string, Record<string, Record<CopySegmentTier, CopyTemplate>>> = {
  warmup: {
    line: {
      vip: {
        subject: '專屬你的浪漫預告',
        content:
          '親愛的 {tierName}，情人節浪漫序曲即將開啟 💕\n\n' +
          '作為我們最珍貴的 {tierName}，CHIC KIM & MIU 為您準備了獨家情人節系列——\n' +
          '從約會洋裝到浪漫配飾，每一件都訴說著屬於你的美好故事。\n\n' +
          '🌹 專屬預覽將在明日為您開放\n' +
          '📦 情人節限定禮盒同步上線\n\n' +
          '期待與您共度最美的情人時光 ✨',
      },
      regular: {
        subject: '情人節穿搭靈感來了',
        content:
          '親愛的 {tierName}，最浪漫的季節即將到來 🌸\n\n' +
          'CHIC KIM & MIU 情人節特別企劃正在準備中——\n' +
          '無論是甜蜜約會還是閨蜜聚會，我們都為您準備了完美穿搭。\n\n' +
          '💝 情人節新品即將上架\n' +
          '🎀 專屬優惠即將公佈\n\n' +
          '敬請期待，讓我們一起迎接美好 💫',
      },
      new: {
        subject: '歡迎你的第一個情人節',
        content:
          '親愛的 {tierName}，歡迎來到 CHIC KIM & MIU 的浪漫世界 🌷\n\n' +
          '情人節即將到來，我們正在為您籌備專屬驚喜——\n' +
          '第一次的美好，從這裡開始。\n\n' +
          '💕 新會員專屬情人節禮遇即將揭曉\n' +
          '🎁 首購禮 + 情人節加碼同步進行\n\n' +
          '請密切關注，美好即將展開 ✨',
      },
      risk: {
        subject: '好久不見，情人節想念你',
        content:
          '親愛的 {tierName}，好久不見 🌸\n\n' +
          '情人節前夕，我們特別想念您。\n' +
          'CHIC KIM & MIU 準備了暖心回歸禮，\n' +
          '希望能在這個浪漫時節，與您再次相遇。\n\n' +
          '💝 專屬回歸優惠已為您準備\n\n' +
          '期待您的回來 💕',
      },
      sleep: {
        subject: '情人節喚醒你的美麗',
        content:
          '親愛的 {tierName}，我們好想您 🌹\n\n' +
          '距離上次見面已經好一陣子了，\n' +
          '這個情人節，讓 CHIC KIM & MIU 再次陪伴您。\n\n' +
          '💝 沉睡回歸專屬好禮已準備就緒\n' +
          '🎀 情人節限定復活優惠等您領取\n\n' +
          '讓我們重新開啟屬於你的美好時光 ✨',
      },
    },
    email: {
      vip: {
        subject: '【VIP 專屬預覽】情人節浪漫系列即將登場',
        content:
          '親愛的 {tierName}，\n\n' +
          '一年之中最浪漫的日子即將到來，CHIC KIM & MIU 為我們最珍貴的 {tierName} 準備了獨家預覽。\n\n' +
          '本季情人節系列以「心動瞬間」為主題，從溫柔粉色到優雅酒紅，\n' +
          '每一件作品都承載著對美的追求與對你的心意。\n\n' +
          '✦ 獨家 VIP 預購通道提前 48 小時開放\n' +
          '✦ 情人節限定禮盒（含精美包裝 + 手寫卡片服務）\n' +
          '✦ 滿額贈限量玫瑰香氛禮\n\n' +
          '讓我們一起，把愛穿在身上。\n\n' +
          'CHIC KIM & MIU\n' +
          '專屬你美好的時尚優雅',
      },
      regular: {
        subject: '情人節穿搭提案 | CHIC KIM & MIU',
        content:
          '親愛的 {tierName}，\n\n' +
          '情人節將至，CHIC KIM & MIU 為您精心準備了浪漫穿搭提案。\n\n' +
          '無論是甜蜜約會還是寵愛自己，我們的情人節系列都能讓您散發迷人光彩。\n\n' +
          '✦ 情人節限定新品即將上架\n' +
          '✦ 全站滿額享專屬優惠\n' +
          '✦ 情人節限定禮物包裝服務\n\n' +
          '敬請期待即將公佈的驚喜。\n\n' +
          'CHIC KIM & MIU\n' +
          '專屬你美好的時尚優雅',
      },
      new: {
        subject: '你的第一個 CHIC KIM & MIU 情人節 💕',
        content:
          '親愛的 {tierName}，\n\n' +
          '歡迎來到 CHIC KIM & MIU，很高興在這個浪漫的季節與您相遇。\n\n' +
          '為了慶祝我們的初遇，情人節期間我們特別準備了新會員專屬好禮，\n' +
          '讓您的第一次購物體驗更加美好。\n\n' +
          '✦ 新會員首購折扣 + 情人節加碼\n' +
          '✦ 免費禮物包裝服務\n' +
          '✦ 加入會員即贈點數\n\n' +
          '期待為您打造專屬浪漫。\n\n' +
          'CHIC KIM & MIU\n' +
          '專屬你美好的時尚優雅',
      },
      risk: {
        subject: '情人節，我們想念你 | CHIC KIM & MIU',
        content:
          '親愛的 {tierName}，\n\n' +
          '好久不見，在這個浪漫的季節裡，我們特別想念您。\n\n' +
          'CHIC KIM & MIU 準備了一份暖心回歸禮，\n' +
          '希望能在情人節重新與您相遇。\n\n' +
          '✦ 回歸專屬折扣已為您保留\n' +
          '✦ 情人節限定好禮等您來領\n\n' +
          '期待您的回來。\n\n' +
          'CHIC KIM & MIU\n' +
          '專屬你美好的時尚優雅',
      },
      sleep: {
        subject: '情人節的溫暖邀請 | CHIC KIM & MIU',
        content:
          '親愛的 {tierName}，\n\n' +
          '距離您上次造訪已經有一段時間了。\n' +
          '在情人節來臨之際，我們特別為您準備了回歸好禮。\n\n' +
          '✦ 沉睡會員專屬復活折扣\n' +
          '✦ 情人節限定加碼優惠\n' +
          '✦ 回歸即贈雙倍點數\n\n' +
          '讓我們重新為您的衣櫃注入浪漫。\n\n' +
          'CHIC KIM & MIU\n' +
          '專屬你美好的時尚優雅',
      },
    },
    sms: {
      vip: {
        subject: '',
        content: '【CHIC KIM & MIU】親愛的{tierName}，情人節專屬預覽即將為您開啟，VIP 獨享先行選購。敬請期待 💕',
      },
      regular: {
        subject: '',
        content: '【CHIC KIM & MIU】情人節浪漫穿搭即將登場！{tierName}專屬優惠即將公佈，敬請期待 🌸',
      },
      new: {
        subject: '',
        content: '【CHIC KIM & MIU】歡迎{tierName}！情人節新會員專屬禮遇即將揭曉，讓我們一起迎接美好 💝',
      },
      risk: {
        subject: '',
        content: '【CHIC KIM & MIU】親愛的{tierName}，好久不見！情人節暖心回歸禮已為您準備 🌹',
      },
      sleep: {
        subject: '',
        content: '【CHIC KIM & MIU】{tierName}，好想您！情人節回歸禮已準備就緒，期待再次相遇 💕',
      },
    },
    push: {
      vip: {
        subject: '情人節 VIP 專屬預覽開啟',
        content: '親愛的{tierName}，情人節限定系列搶先預覽，專屬您的浪漫已準備就緒 💕',
      },
      regular: {
        subject: '情人節穿搭靈感來了',
        content: '情人節新品即將上架，{tierName}專屬優惠同步公佈 🌸',
      },
      new: {
        subject: '你的第一個情人節驚喜',
        content: '歡迎{tierName}！情人節新會員加碼好禮即將揭曉 💝',
      },
      risk: {
        subject: '情人節想念你',
        content: '好久不見{tierName}，情人節暖心回歸禮等你來領 🌹',
      },
      sleep: {
        subject: '情人節喚醒你的美麗',
        content: '{tierName}，沉睡回歸好禮 + 情人節限定優惠等您領取 ✨',
      },
    },
  },
  peak: {
    line: {
      vip: {
        subject: '情人節正式開跑',
        content:
          '親愛的 {tierName}，情人節活動正式開始！ 🌹\n\n' +
          '🔥 專屬 {tierName} 獨享優惠：\n' +
          '✦ 全站 {discount}% OFF\n' +
          '✦ 點數 {pointsMultiplier} 倍回饋\n' +
          '✦ 滿 $2,000 免運\n' +
          '✦ 限量情人節禮盒包裝\n\n' +
          '優惠碼：{couponCode}\n' +
          '活動期間限定，手刀搶購 💕',
      },
      regular: {
        subject: '情人節甜蜜開跑',
        content:
          '親愛的 {tierName}，情人節活動開始了！ 💕\n\n' +
          '✦ 全站 {discount}% OFF\n' +
          '✦ 點數 {pointsMultiplier} 倍回饋\n' +
          '✦ 滿額免運\n\n' +
          '優惠碼：{couponCode}\n' +
          '用美麗迎接最浪漫的日子 🌸',
      },
      new: {
        subject: '新會員情人節驚喜',
        content:
          '親愛的 {tierName}，您的專屬情人節好禮來了！ 🎁\n\n' +
          '✦ 新會員 {discount}% OFF\n' +
          '✦ 加贈 {bonusPoints} 點數\n' +
          '✦ 首購免運\n\n' +
          '優惠碼：{couponCode}\n' +
          '第一次的美好，從現在開始 💝',
      },
      risk: {
        subject: '情人節回歸禮來了',
        content:
          '親愛的 {tierName}，情人節回歸專屬好禮 🌹\n\n' +
          '✦ 回歸專享 {discount}% OFF\n' +
          '✦ 點數 {pointsMultiplier} 倍回饋\n\n' +
          '優惠碼：{couponCode}\n' +
          '期待與您重新相遇 💕',
      },
      sleep: {
        subject: '沉睡復活情人節禮',
        content:
          '親愛的 {tierName}，我們為您準備了情人節復活禮！ ✨\n\n' +
          '✦ 復活專屬 {discount}% OFF\n' +
          '✦ 回歸贈 {bonusPoints} 點數\n' +
          '✦ 免運費\n\n' +
          '優惠碼：{couponCode}\n' +
          '讓美麗重新綻放 🌸',
      },
    },
    email: {
      vip: {
        subject: '【情人節限定】{tierName}專屬 {discount}% OFF 浪漫好禮',
        content:
          '親愛的 {tierName}，\n\n' +
          '情人節活動正式開跑！作為我們最珍貴的 {tierName}，\n' +
          '我們為您準備了最高規格的浪漫禮遇：\n\n' +
          '✦ 獨享 {discount}% OFF（優惠碼：{couponCode}）\n' +
          '✦ 點數 {pointsMultiplier} 倍回饋\n' +
          '✦ 加贈 {bonusPoints} 紅利點數\n' +
          '✦ 全站免運\n' +
          '✦ 限量情人節禮盒包裝\n' +
          '✦ 手寫卡片代筆服務\n\n' +
          '無論是寵愛自己還是送給心愛的人，\n' +
          '讓 CHIC KIM & MIU 為您打造最完美的情人節。\n\n' +
          'CHIC KIM & MIU\n' +
          '專屬你美好的時尚優雅',
      },
      regular: {
        subject: '情人節甜蜜優惠 | {discount}% OFF 浪漫穿搭',
        content:
          '親愛的 {tierName}，\n\n' +
          '情人節活動正式開始！\n\n' +
          '✦ 全站 {discount}% OFF（優惠碼：{couponCode}）\n' +
          '✦ 點數 {pointsMultiplier} 倍回饋\n' +
          '✦ 滿 $1,500 免運\n\n' +
          '用最美的穿搭，迎接最浪漫的日子。\n\n' +
          'CHIC KIM & MIU\n' +
          '專屬你美好的時尚優雅',
      },
      new: {
        subject: '新會員情人節專屬好禮 | {discount}% OFF',
        content:
          '親愛的 {tierName}，\n\n' +
          '在這個浪漫的節日，我們為您準備了新會員專屬情人節禮遇：\n\n' +
          '✦ 新會員 {discount}% OFF（優惠碼：{couponCode}）\n' +
          '✦ 加贈 {bonusPoints} 歡迎點數\n' +
          '✦ 首購免運\n\n' +
          '讓 CHIC KIM & MIU 陪您度過第一個美好情人節。\n\n' +
          'CHIC KIM & MIU\n' +
          '專屬你美好的時尚優雅',
      },
      risk: {
        subject: '情人節回歸禮 | 我們想念你',
        content:
          '親愛的 {tierName}，\n\n' +
          '好久不見！情人節特別為您準備了回歸好禮：\n\n' +
          '✦ 回歸專享 {discount}% OFF（優惠碼：{couponCode}）\n' +
          '✦ 點數 {pointsMultiplier} 倍回饋\n\n' +
          '期待與您在 CHIC KIM & MIU 重新相遇。\n\n' +
          'CHIC KIM & MIU\n' +
          '專屬你美好的時尚優雅',
      },
      sleep: {
        subject: '情人節復活禮 | 讓美麗重新綻放',
        content:
          '親愛的 {tierName}，\n\n' +
          '好久不見！在情人節這個特別的日子，我們想再次為您點亮美麗：\n\n' +
          '✦ 沉睡復活 {discount}% OFF（優惠碼：{couponCode}）\n' +
          '✦ 回歸贈 {bonusPoints} 點數\n' +
          '✦ 全站免運\n\n' +
          '讓我們重新為您的衣櫃注入浪漫。\n\n' +
          'CHIC KIM & MIU\n' +
          '專屬你美好的時尚優雅',
      },
    },
    sms: {
      vip: {
        subject: '',
        content: '【CHIC KIM & MIU】{tierName}專屬情人節{discount}%OFF！優惠碼{couponCode}，點數{pointsMultiplier}倍+免運。限時搶購 💕',
      },
      regular: {
        subject: '',
        content: '【CHIC KIM & MIU】情人節{discount}%OFF開跑！優惠碼{couponCode}，滿額免運+點數回饋 🌸',
      },
      new: {
        subject: '',
        content: '【CHIC KIM & MIU】新會員情人節{discount}%OFF+{bonusPoints}點！優惠碼{couponCode}，首購免運 💝',
      },
      risk: {
        subject: '',
        content: '【CHIC KIM & MIU】{tierName}情人節回歸禮{discount}%OFF！優惠碼{couponCode}，期待再相遇 🌹',
      },
      sleep: {
        subject: '',
        content: '【CHIC KIM & MIU】情人節復活禮{discount}%OFF+{bonusPoints}點！優惠碼{couponCode}，免運 ✨',
      },
    },
    push: {
      vip: {
        subject: '情人節 {discount}% OFF 專屬你',
        content: '親愛的{tierName}，情人節{discount}%OFF + 點數{pointsMultiplier}倍回饋，限時搶購！💕',
      },
      regular: {
        subject: '情人節 {discount}% OFF 甜蜜開跑',
        content: '情人節{discount}%OFF 開始了！優惠碼{couponCode}，滿額免運 🌸',
      },
      new: {
        subject: '新會員情人節 {discount}% OFF',
        content: '首購{discount}%OFF + {bonusPoints}點數！優惠碼{couponCode} 💝',
      },
      risk: {
        subject: '情人節回歸禮 {discount}% OFF',
        content: '{tierName}回歸專屬{discount}%OFF，優惠碼{couponCode} 🌹',
      },
      sleep: {
        subject: '情人節復活禮 {discount}% OFF',
        content: '復活專屬{discount}%OFF + {bonusPoints}點！優惠碼{couponCode} ✨',
      },
    },
  },
  followup: {
    line: {
      vip: {
        subject: '情人節感謝回饋',
        content:
          '親愛的 {tierName}，感謝您參與情人節活動！ 🌹\n\n' +
          '為了感謝您的支持，我們額外為您準備了：\n' +
          '✦ 回購專屬折扣碼\n' +
          '✦ 雙倍點數回饋延長 3 天\n\n' +
          '期待繼續為您帶來美好穿搭 💕',
      },
      regular: {
        subject: '情人節回購好禮',
        content:
          '親愛的 {tierName}，情人節活動圓滿結束 🌸\n\n' +
          '感謝您的參與！特別加碼 48 小時回購優惠：\n' +
          '✦ 再享折扣\n' +
          '✦ 點數加碼回饋\n\n' +
          '把握最後機會 💫',
      },
      new: {
        subject: '第一次情人節後的小驚喜',
        content:
          '親愛的 {tierName}，感謝您的首次參與！ 💝\n\n' +
          '希望您喜歡我們的情人節系列，\n' +
          '特別為您延長新會員優惠 48 小時。\n\n' +
          '期待繼續為您帶來更多美好 ✨',
      },
      risk: {
        subject: '歡迎回來的小禮物',
        content:
          '親愛的 {tierName}，很高興在情人節與您重逢！ 🌹\n\n' +
          '為了感謝您的回歸，我們準備了持續回饋：\n' +
          '✦ 下次購物專屬折扣\n\n' +
          '期待與您的每一次相遇 💕',
      },
      sleep: {
        subject: '歡迎回歸的延續禮',
        content:
          '親愛的 {tierName}，很開心再次見到您！ ✨\n\n' +
          '情人節雖已結束，但我們的心意不變：\n' +
          '✦ 回歸禮延長 72 小時\n' +
          '✦ 加碼點數回饋\n\n' +
          '讓美好持續綻放 🌸',
      },
    },
    email: {
      vip: {
        subject: '【感恩回饋】情人節後專屬 {tierName} 延續禮遇',
        content:
          '親愛的 {tierName}，\n\n' +
          '感謝您在情人節期間的支持與陪伴。\n\n' +
          '作為我們最珍貴的 {tierName}，我們特別延續以下禮遇：\n' +
          '✦ 回購專屬 8 折優惠（48 小時限定）\n' +
          '✦ 點數雙倍回饋延長 3 天\n' +
          '✦ 免費退換貨服務\n\n' +
          '再次感謝您的厚愛。\n\n' +
          'CHIC KIM & MIU\n' +
          '專屬你美好的時尚優雅',
      },
      regular: {
        subject: '情人節後回購優惠 | 48 小時限定',
        content:
          '親愛的 {tierName}，\n\n' +
          '情人節活動圓滿落幕，感謝您的參與！\n\n' +
          '✦ 回購優惠 48 小時延長\n' +
          '✦ 點數加碼回饋\n\n' +
          '把握最後機會，為衣櫃增添更多美好。\n\n' +
          'CHIC KIM & MIU\n' +
          '專屬你美好的時尚優雅',
      },
      new: {
        subject: '感謝你的第一次 | 情人節後延續禮',
        content:
          '親愛的 {tierName}，\n\n' +
          '感謝您在情人節選擇了 CHIC KIM & MIU！\n\n' +
          '✦ 新會員優惠延長 48 小時\n' +
          '✦ 下次購物滿額贈小禮物\n\n' +
          '期待為您帶來更多美好體驗。\n\n' +
          'CHIC KIM & MIU\n' +
          '專屬你美好的時尚優雅',
      },
      risk: {
        subject: '歡迎回歸 | 持續回饋',
        content:
          '親愛的 {tierName}，\n\n' +
          '很高興在情人節與您重逢！\n\n' +
          '✦ 持續回饋折扣已為您保留\n\n' +
          '期待與您的每一次相遇。\n\n' +
          'CHIC KIM & MIU\n' +
          '專屬你美好的時尚優雅',
      },
      sleep: {
        subject: '歡迎回歸 | 回歸禮延長',
        content:
          '親愛的 {tierName}，\n\n' +
          '很開心在情人節再次見到您！\n\n' +
          '✦ 回歸禮延長 72 小時\n' +
          '✦ 點數加碼回饋\n\n' +
          '讓美好持續。\n\n' +
          'CHIC KIM & MIU\n' +
          '專屬你美好的時尚優雅',
      },
    },
    sms: {
      vip: {
        subject: '',
        content: '【CHIC KIM & MIU】感謝{tierName}的支持！回購8折+雙倍點數延長3天，48小時限定 💕',
      },
      regular: {
        subject: '',
        content: '【CHIC KIM & MIU】情人節回購優惠48小時延長！把握最後機會 🌸',
      },
      new: {
        subject: '',
        content: '【CHIC KIM & MIU】感謝{tierName}的首購！新會員優惠延長48小時 💝',
      },
      risk: {
        subject: '',
        content: '【CHIC KIM & MIU】歡迎回歸{tierName}！持續回饋折扣已為您保留 🌹',
      },
      sleep: {
        subject: '',
        content: '【CHIC KIM & MIU】歡迎回來{tierName}！回歸禮延長72小時 ✨',
      },
    },
    push: {
      vip: {
        subject: '感恩回饋 | 回購8折',
        content: '{tierName}專屬回購8折+雙倍點數延長3天！💕',
      },
      regular: {
        subject: '回購優惠48小時延長',
        content: '情人節回購加碼！把握最後機會 🌸',
      },
      new: {
        subject: '新會員優惠延長',
        content: '感謝首購！新會員優惠延長48小時 💝',
      },
      risk: {
        subject: '持續回饋',
        content: '歡迎回歸！持續回饋折扣已保留 🌹',
      },
      sleep: {
        subject: '回歸禮延長72小時',
        content: '歡迎回來！回歸禮延長72小時+點數加碼 ✨',
      },
    },
  },
}

/**
 * 母親節文案模板（3 階段 × 4 通道 × 5 客群差異）
 */
const MOTHERS_DAY_COPY: Record<string, Record<string, Record<CopySegmentTier, CopyTemplate>>> = {
  warmup: {
    line: {
      vip: {
        subject: '母親節寵愛企劃搶先看',
        content:
          '親愛的 {tierName}，母親節即將到來 🌷\n\n' +
          '今年，讓 CHIC KIM & MIU 與您一起，\n' +
          '為最重要的她打造最優雅的時刻。\n\n' +
          '🎀 {tierName} 專屬母親節禮遇即將揭曉\n' +
          '👗 母親節優雅穿搭企劃搶先預覽\n' +
          '🎁 限定禮盒 & 刻字服務\n\n' +
          '感恩的心，從穿搭開始 💕',
      },
      regular: {
        subject: '母親節穿搭靈感',
        content:
          '親愛的 {tierName}，溫馨五月即將到來 🌸\n\n' +
          'CHIC KIM & MIU 母親節特別企劃正在準備中——\n' +
          '無論是送給媽媽還是寵愛自己，\n' +
          '我們都為您準備了最貼心的選擇。\n\n' +
          '🌷 母親節新品即將上架\n' +
          '💝 感恩優惠即將公佈\n\n' +
          '敬請期待 ✨',
      },
      new: {
        subject: '一起感恩母親節',
        content:
          '親愛的 {tierName}，歡迎在溫馨五月與我們相遇 🌷\n\n' +
          'CHIC KIM & MIU 母親節特別企劃即將展開，\n' +
          '為您的感恩之心增添優雅。\n\n' +
          '💕 新會員母親節專屬禮遇即將揭曉\n\n' +
          '期待與您一起表達愛 ✨',
      },
      risk: {
        subject: '母親節，想念您的光臨',
        content:
          '親愛的 {tierName}，母親節前夕特別想念您 🌸\n\n' +
          '在這個感恩的季節，CHIC KIM & MIU 準備了回歸好禮。\n\n' +
          '🌷 回歸專屬母親節禮遇等您來領\n\n' +
          '期待您的回來 💕',
      },
      sleep: {
        subject: '母親節喚醒優雅',
        content:
          '親愛的 {tierName}，好久不見 🌷\n\n' +
          '母親節即將到來，我們特別為您準備了復活好禮，\n' +
          '讓優雅再次綻放。\n\n' +
          '💝 沉睡復活 + 母親節雙重好禮即將公佈\n\n' +
          '期待再次見到您 ✨',
      },
    },
    email: {
      vip: {
        subject: '【VIP 搶先看】母親節寵愛企劃 | CHIC KIM & MIU',
        content:
          '親愛的 {tierName}，\n\n' +
          '一年一度的母親節即將來臨。\n' +
          '今年，CHIC KIM & MIU 以「優雅，是最好的感恩」為題，\n' +
          '為我們最珍貴的 {tierName} 搶先揭曉母親節企劃。\n\n' +
          '✦ VIP 預購通道提前 72 小時開放\n' +
          '✦ 母親節限定禮盒（含質感包裝 + 感恩卡片）\n' +
          '✦ 獨家刻字 / 繡字服務\n' +
          '✦ 滿額贈限量香氛禮\n\n' +
          '讓我們一起，把感恩穿在身上。\n\n' +
          'CHIC KIM & MIU\n' +
          '專屬你美好的時尚優雅',
      },
      regular: {
        subject: '母親節穿搭提案 | 優雅是最好的感恩',
        content:
          '親愛的 {tierName}，\n\n' +
          '溫馨五月即將到來，CHIC KIM & MIU 母親節企劃正在準備中。\n\n' +
          '✦ 母親節限定新品即將上架\n' +
          '✦ 感恩優惠即將公佈\n' +
          '✦ 母親節禮物包裝服務\n\n' +
          '敬請期待。\n\n' +
          'CHIC KIM & MIU\n' +
          '專屬你美好的時尚優雅',
      },
      new: {
        subject: '一起表達愛 | 母親節企劃預告',
        content:
          '親愛的 {tierName}，\n\n' +
          '歡迎在母親節前夕加入 CHIC KIM & MIU。\n' +
          '我們正在為您籌備新會員專屬的母親節好禮。\n\n' +
          '✦ 新會員母親節加碼優惠\n' +
          '✦ 首購贈點 + 感恩好禮\n\n' +
          '敬請期待。\n\n' +
          'CHIC KIM & MIU\n' +
          '專屬你美好的時尚優雅',
      },
      risk: {
        subject: '母親節，我們想念你 | CHIC KIM & MIU',
        content:
          '親愛的 {tierName}，\n\n' +
          '母親節將至，我們特別想念您。\n' +
          '回歸好禮已為您準備。\n\n' +
          '✦ 回歸專屬母親節折扣\n\n' +
          '期待您的回來。\n\n' +
          'CHIC KIM & MIU\n' +
          '專屬你美好的時尚優雅',
      },
      sleep: {
        subject: '母親節溫暖邀請 | 歡迎回歸',
        content:
          '親愛的 {tierName}，\n\n' +
          '好久不見。母親節即將到來，我們為您準備了回歸好禮。\n\n' +
          '✦ 沉睡復活折扣 + 母親節加碼\n' +
          '✦ 回歸即贈雙倍點數\n\n' +
          '讓我們重新開始。\n\n' +
          'CHIC KIM & MIU\n' +
          '專屬你美好的時尚優雅',
      },
    },
    sms: {
      vip: { subject: '', content: '【CHIC KIM & MIU】{tierName}，母親節VIP搶先預覽即將開啟！獨享限定禮盒 + 刻字服務 🌷' },
      regular: { subject: '', content: '【CHIC KIM & MIU】母親節穿搭企劃即將上線！{tierName}專屬優惠敬請期待 🌸' },
      new: { subject: '', content: '【CHIC KIM & MIU】{tierName}，母親節新會員好禮即將揭曉，期待與您一起表達愛 💕' },
      risk: { subject: '', content: '【CHIC KIM & MIU】{tierName}，母親節想念您！回歸好禮已準備 🌷' },
      sleep: { subject: '', content: '【CHIC KIM & MIU】{tierName}好久不見！母親節復活好禮即將公佈 ✨' },
    },
    push: {
      vip: { subject: '母親節 VIP 搶先預覽', content: '{tierName}，母親節限定企劃搶先看！專屬禮遇即將揭曉 🌷' },
      regular: { subject: '母親節穿搭企劃預告', content: '母親節新品即將上架，敬請期待 🌸' },
      new: { subject: '新會員母親節好禮', content: '歡迎{tierName}！母親節新會員好禮即將揭曉 💕' },
      risk: { subject: '母親節想念你', content: '好久不見{tierName}！母親節回歸禮等您來領 🌷' },
      sleep: { subject: '母親節喚醒優雅', content: '{tierName}，母親節復活好禮即將公佈 ✨' },
    },
  },
  peak: {
    line: {
      vip: {
        subject: '母親節活動正式開跑',
        content:
          '親愛的 {tierName}，母親節感恩活動開始了！ 🌷\n\n' +
          '✦ {tierName} 獨享 {discount}% OFF\n' +
          '✦ 點數 {pointsMultiplier} 倍回饋\n' +
          '✦ 加贈 {bonusPoints} 紅利點數\n' +
          '✦ 全站免運 + 母親節禮盒包裝\n\n' +
          '優惠碼：{couponCode}\n' +
          '把最好的，獻給最愛的她 💕',
      },
      regular: {
        subject: '母親節感恩優惠',
        content:
          '親愛的 {tierName}，母親節活動開始！ 🌸\n\n' +
          '✦ 全站 {discount}% OFF\n' +
          '✦ 點數 {pointsMultiplier} 倍回饋\n' +
          '✦ 滿額免運\n\n' +
          '優惠碼：{couponCode}\n' +
          '用優雅表達感恩 💕',
      },
      new: {
        subject: '新會員母親節好禮',
        content:
          '親愛的 {tierName}，母親節新會員專屬好禮！ 💝\n\n' +
          '✦ 新會員 {discount}% OFF\n' +
          '✦ 加贈 {bonusPoints} 點數\n' +
          '✦ 首購免運\n\n' +
          '優惠碼：{couponCode}\n' +
          '第一次的感恩，從這裡開始 🌷',
      },
      risk: {
        subject: '母親節回歸禮',
        content:
          '親愛的 {tierName}，母親節回歸好禮 🌷\n\n' +
          '✦ 回歸 {discount}% OFF\n' +
          '✦ 點數 {pointsMultiplier} 倍\n\n' +
          '優惠碼：{couponCode}\n' +
          '歡迎回來 💕',
      },
      sleep: {
        subject: '母親節復活禮',
        content:
          '親愛的 {tierName}，母親節復活禮！ ✨\n\n' +
          '✦ 復活 {discount}% OFF\n' +
          '✦ 回歸贈 {bonusPoints} 點\n' +
          '✦ 免運\n\n' +
          '優惠碼：{couponCode}\n' +
          '讓優雅重新綻放 🌸',
      },
    },
    email: {
      vip: {
        subject: '【母親節限定】{tierName}專屬 {discount}% OFF 感恩禮遇',
        content:
          '親愛的 {tierName}，\n\n' +
          '母親節活動正式開跑！\n\n' +
          '✦ 獨享 {discount}% OFF（優惠碼：{couponCode}）\n' +
          '✦ 點數 {pointsMultiplier} 倍回饋\n' +
          '✦ 加贈 {bonusPoints} 紅利點數\n' +
          '✦ 全站免運 + 限量母親節禮盒\n' +
          '✦ 刻字 / 繡字服務\n\n' +
          '把最優雅的，獻給最重要的人。\n\n' +
          'CHIC KIM & MIU\n' +
          '專屬你美好的時尚優雅',
      },
      regular: {
        subject: '母親節感恩優惠 | {discount}% OFF',
        content:
          '親愛的 {tierName}，\n\n' +
          '母親節活動開始！\n\n' +
          '✦ 全站 {discount}% OFF（優惠碼：{couponCode}）\n' +
          '✦ 點數 {pointsMultiplier} 倍回饋\n' +
          '✦ 滿 $1,500 免運\n\n' +
          '用優雅表達感恩。\n\n' +
          'CHIC KIM & MIU\n' +
          '專屬你美好的時尚優雅',
      },
      new: {
        subject: '新會員母親節 {discount}% OFF',
        content:
          '親愛的 {tierName}，\n\n' +
          '母親節新會員專屬：\n\n' +
          '✦ {discount}% OFF（優惠碼：{couponCode}）\n' +
          '✦ 加贈 {bonusPoints} 點數\n' +
          '✦ 首購免運\n\n' +
          'CHIC KIM & MIU\n' +
          '專屬你美好的時尚優雅',
      },
      risk: {
        subject: '母親節回歸禮 {discount}% OFF',
        content:
          '親愛的 {tierName}，\n\n' +
          '母親節回歸好禮：\n\n' +
          '✦ {discount}% OFF（優惠碼：{couponCode}）\n' +
          '✦ 點數 {pointsMultiplier} 倍\n\n' +
          'CHIC KIM & MIU\n' +
          '專屬你美好的時尚優雅',
      },
      sleep: {
        subject: '母親節復活禮 {discount}% OFF',
        content:
          '親愛的 {tierName}，\n\n' +
          '母親節復活好禮：\n\n' +
          '✦ {discount}% OFF（優惠碼：{couponCode}）\n' +
          '✦ 回歸贈 {bonusPoints} 點\n' +
          '✦ 免運\n\n' +
          'CHIC KIM & MIU\n' +
          '專屬你美好的時尚優雅',
      },
    },
    sms: {
      vip: { subject: '', content: '【CHIC KIM & MIU】{tierName}母親節{discount}%OFF！優惠碼{couponCode}，{pointsMultiplier}倍點數+免運 🌷' },
      regular: { subject: '', content: '【CHIC KIM & MIU】母親節{discount}%OFF！優惠碼{couponCode}，滿額免運 🌸' },
      new: { subject: '', content: '【CHIC KIM & MIU】新會員母親節{discount}%OFF+{bonusPoints}點！優惠碼{couponCode} 💝' },
      risk: { subject: '', content: '【CHIC KIM & MIU】母親節回歸{discount}%OFF！優惠碼{couponCode} 🌷' },
      sleep: { subject: '', content: '【CHIC KIM & MIU】母親節復活{discount}%OFF+{bonusPoints}點！優惠碼{couponCode} ✨' },
    },
    push: {
      vip: { subject: '母親節 {discount}% OFF 專屬你', content: '{tierName}母親節{discount}%OFF + {pointsMultiplier}倍點數！🌷' },
      regular: { subject: '母親節 {discount}% OFF', content: '母親節{discount}%OFF！優惠碼{couponCode} 🌸' },
      new: { subject: '新會員母親節好禮', content: '{discount}%OFF + {bonusPoints}點！優惠碼{couponCode} 💝' },
      risk: { subject: '母親節回歸禮', content: '回歸{discount}%OFF！優惠碼{couponCode} 🌷' },
      sleep: { subject: '母親節復活禮', content: '復活{discount}%OFF + {bonusPoints}點！{couponCode} ✨' },
    },
  },
  followup: {
    line: {
      vip: {
        subject: '母親節感恩延續',
        content:
          '親愛的 {tierName}，感謝您的參與！ 🌷\n\n' +
          '母親節感恩延續：\n' +
          '✦ 回購專屬 85 折（48 小時限定）\n' +
          '✦ 雙倍點數延長\n\n' +
          '繼續優雅，繼續感恩 💕',
      },
      regular: {
        subject: '母親節回購好禮',
        content: '親愛的 {tierName}，感謝參與！ 🌸\n母親節回購優惠 48 小時延長，把握機會 💫',
      },
      new: {
        subject: '感恩延續',
        content: '親愛的 {tierName}，感謝首購！ 💝\n新會員優惠延長 48 小時 ✨',
      },
      risk: {
        subject: '歡迎回來',
        content: '親愛的 {tierName}，很高興再見！ 🌷\n下次購物專屬折扣已保留 💕',
      },
      sleep: {
        subject: '回歸禮延長',
        content: '親愛的 {tierName}，歡迎回來！ ✨\n回歸禮延長 72 小時 🌸',
      },
    },
    email: {
      vip: {
        subject: '【感恩延續】{tierName} 母親節回購禮遇',
        content:
          '親愛的 {tierName}，\n\n' +
          '感謝您在母親節的支持！\n\n' +
          '✦ 回購 85 折（48 小時限定）\n' +
          '✦ 雙倍點數延長 3 天\n\n' +
          'CHIC KIM & MIU\n' +
          '專屬你美好的時尚優雅',
      },
      regular: {
        subject: '母親節回購優惠延長',
        content: '親愛的 {tierName}，\n\n感謝參與！回購優惠 48 小時延長。\n\nCHIC KIM & MIU\n專屬你美好的時尚優雅',
      },
      new: {
        subject: '感恩延續 | 新會員優惠延長',
        content: '親愛的 {tierName}，\n\n感謝首購！新會員優惠延長 48 小時。\n\nCHIC KIM & MIU\n專屬你美好的時尚優雅',
      },
      risk: {
        subject: '歡迎回歸 | 持續優惠',
        content: '親愛的 {tierName}，\n\n很高興您回來！持續回饋已保留。\n\nCHIC KIM & MIU\n專屬你美好的時尚優雅',
      },
      sleep: {
        subject: '回歸禮延長',
        content: '親愛的 {tierName}，\n\n歡迎回來！回歸禮延長 72 小時。\n\nCHIC KIM & MIU\n專屬你美好的時尚優雅',
      },
    },
    sms: {
      vip: { subject: '', content: '【CHIC KIM & MIU】感謝{tierName}！母親節回購85折+雙倍點數延長3天 🌷' },
      regular: { subject: '', content: '【CHIC KIM & MIU】母親節回購優惠48小時延長！🌸' },
      new: { subject: '', content: '【CHIC KIM & MIU】感謝{tierName}首購！優惠延長48小時 💝' },
      risk: { subject: '', content: '【CHIC KIM & MIU】歡迎回歸！持續折扣已保留 🌷' },
      sleep: { subject: '', content: '【CHIC KIM & MIU】歡迎回來！回歸禮延長72小時 ✨' },
    },
    push: {
      vip: { subject: '回購85折+雙倍點數', content: '感謝{tierName}！48小時限定 🌷' },
      regular: { subject: '回購優惠延長', content: '母親節回購48小時延長 🌸' },
      new: { subject: '新會員優惠延長', content: '感謝首購！延長48小時 💝' },
      risk: { subject: '持續優惠', content: '歡迎回歸！折扣已保留 🌷' },
      sleep: { subject: '回歸禮延長', content: '歡迎回來！延長72小時 ✨' },
    },
  },
}

/**
 * 雙 11 文案模板（3 階段 × 4 通道 × 5 客群差異）
 */
const DOUBLE_ELEVEN_COPY: Record<string, Record<string, Record<CopySegmentTier, CopyTemplate>>> = {
  warmup: {
    line: {
      vip: {
        subject: '雙 11 搶先佈局',
        content:
          '親愛的 {tierName}，年度最大盛事即將開始！ 🔥\n\n' +
          '作為我們最珍貴的 {tierName}，\n' +
          'CHIC KIM & MIU 雙 11 為您搶先揭曉：\n\n' +
          '🏷️ 史上最大折扣即將公佈\n' +
          '🎁 {tierName} 專屬加碼好禮\n' +
          '⏰ VIP 預購提前 24 小時開放\n\n' +
          '準備好您的購物清單了嗎？ ✨',
      },
      regular: {
        subject: '雙 11 即將開跑',
        content:
          '親愛的 {tierName}，雙 11 倒數計時！ 🔥\n\n' +
          'CHIC KIM & MIU 年度最大活動即將開始——\n' +
          '全站超狂優惠 + 限量好禮！\n\n' +
          '🏷️ 優惠詳情即將揭曉\n' +
          '📦 滿額好禮等你拿\n\n' +
          '敬請期待 ✨',
      },
      new: {
        subject: '新會員雙 11 首戰',
        content:
          '親愛的 {tierName}，您的第一個 CHIC KIM & MIU 雙 11！ 🎉\n\n' +
          '年度最大購物盛事即將開始，\n' +
          '新會員專屬加碼即將公佈！\n\n' +
          '💝 首購優惠 + 雙 11 疊加\n' +
          '🎁 新會員限定好禮\n\n' +
          '準備好了嗎？ ✨',
      },
      risk: {
        subject: '雙 11 想念你',
        content:
          '親愛的 {tierName}，雙 11 來了！ 🔥\n\n' +
          '年度最大活動，最棒的回歸時機。\n' +
          '我們為您準備了回歸專屬好禮。\n\n' +
          '💝 回歸 + 雙 11 雙重優惠\n\n' +
          '期待您的回來 ✨',
      },
      sleep: {
        subject: '雙 11 喚醒購物魂',
        content:
          '親愛的 {tierName}，好久不見！ 🔥\n\n' +
          '雙 11 是最好的回歸時機——\n' +
          '沉睡復活 + 雙 11 雙重加碼！\n\n' +
          '💝 超值復活禮即將揭曉\n\n' +
          '我們等您回來 ✨',
      },
    },
    email: {
      vip: {
        subject: '【VIP 搶先看】雙 11 年度盛事即將開跑 | CHIC KIM & MIU',
        content:
          '親愛的 {tierName}，\n\n' +
          '年度最大購物盛事——雙 11 即將開跑！\n' +
          'CHIC KIM & MIU 為我們最珍貴的 {tierName} 搶先揭曉今年的驚喜：\n\n' +
          '✦ 史上最高折扣（即將公佈）\n' +
          '✦ VIP 預購通道提前 24 小時開放\n' +
          '✦ 滿額贈限量大禮包\n' +
          '✦ 點數超高倍率回饋\n\n' +
          '請先將心儀商品加入購物車，搶購開始時不怕手慢！\n\n' +
          'CHIC KIM & MIU\n' +
          '專屬你美好的時尚優雅',
      },
      regular: {
        subject: '雙 11 倒數計時 | CHIC KIM & MIU',
        content:
          '親愛的 {tierName}，\n\n' +
          '雙 11 即將開跑！CHIC KIM & MIU 年度最大優惠即將揭曉。\n\n' +
          '✦ 全站超狂折扣\n' +
          '✦ 滿額好禮\n' +
          '✦ 限量福袋\n\n' +
          '敬請期待。\n\n' +
          'CHIC KIM & MIU\n' +
          '專屬你美好的時尚優雅',
      },
      new: {
        subject: '你的第一個 CHIC KIM & MIU 雙 11！',
        content:
          '親愛的 {tierName}，\n\n' +
          '歡迎在雙 11 前夕加入！新會員專屬加碼即將公佈。\n\n' +
          '✦ 首購折扣 + 雙 11 疊加\n' +
          '✦ 新會員限定好禮\n\n' +
          '敬請期待。\n\n' +
          'CHIC KIM & MIU\n' +
          '專屬你美好的時尚優雅',
      },
      risk: {
        subject: '雙 11 回歸好時機 | CHIC KIM & MIU',
        content:
          '親愛的 {tierName}，\n\n' +
          '雙 11 是最好的回歸時機！回歸 + 雙 11 雙重優惠等您。\n\n' +
          '✦ 回歸專屬折扣\n' +
          '✦ 雙 11 全站加碼\n\n' +
          '期待您的回來。\n\n' +
          'CHIC KIM & MIU\n' +
          '專屬你美好的時尚優雅',
      },
      sleep: {
        subject: '雙 11 喚醒你的購物魂 | CHIC KIM & MIU',
        content:
          '親愛的 {tierName}，\n\n' +
          '好久不見！雙 11 復活好禮即將揭曉。\n\n' +
          '✦ 沉睡復活折扣 + 雙 11 加碼\n' +
          '✦ 回歸即贈大量點數\n\n' +
          '期待再次見到您。\n\n' +
          'CHIC KIM & MIU\n' +
          '專屬你美好的時尚優雅',
      },
    },
    sms: {
      vip: { subject: '', content: '【CHIC KIM & MIU】{tierName}，雙11搶先看！VIP預購提前24小時+史上最大折扣即將公佈 🔥' },
      regular: { subject: '', content: '【CHIC KIM & MIU】雙11倒數！全站超狂優惠即將揭曉，敬請期待 🔥' },
      new: { subject: '', content: '【CHIC KIM & MIU】{tierName}第一個雙11！首購+雙11雙重好禮即將公佈 🎉' },
      risk: { subject: '', content: '【CHIC KIM & MIU】{tierName}，雙11最佳回歸時機！回歸+雙11雙重優惠等您 🔥' },
      sleep: { subject: '', content: '【CHIC KIM & MIU】{tierName}好久不見！雙11復活好禮即將揭曉 🔥' },
    },
    push: {
      vip: { subject: '雙 11 VIP 搶先佈局', content: '{tierName}，雙11 VIP預購提前24小時！🔥' },
      regular: { subject: '雙 11 倒數計時', content: '雙11超狂優惠即將開跑！🔥' },
      new: { subject: '你的第一個雙 11', content: '首購+雙11雙重好禮即將公佈！🎉' },
      risk: { subject: '雙 11 回歸好時機', content: '{tierName}，回歸+雙11雙重優惠等您！🔥' },
      sleep: { subject: '雙 11 喚醒購物魂', content: '復活+雙11加碼好禮即將揭曉！🔥' },
    },
  },
  peak: {
    line: {
      vip: {
        subject: '雙 11 正式開戰',
        content:
          '🔥🔥🔥 雙 11 正式開始！ 🔥🔥🔥\n\n' +
          '親愛的 {tierName}，您的專屬好禮：\n\n' +
          '🏷️ 全站 {discount}% OFF\n' +
          '⭐ 點數 {pointsMultiplier} 倍回饋\n' +
          '🎁 加贈 {bonusPoints} 紅利點數\n' +
          '📦 全站免運\n' +
          '🎀 滿 $3,000 贈限量福袋\n\n' +
          '優惠碼：{couponCode}\n' +
          '限時 72 小時，手刀搶購！ 💥',
      },
      regular: {
        subject: '雙 11 開戰',
        content:
          '🔥 雙 11 開始了！ 🔥\n\n' +
          '親愛的 {tierName}：\n\n' +
          '🏷️ 全站 {discount}% OFF\n' +
          '⭐ 點數 {pointsMultiplier} 倍\n' +
          '📦 免運\n\n' +
          '優惠碼：{couponCode}\n' +
          '限時 72 小時！ 💥',
      },
      new: {
        subject: '新會員雙 11 超值好禮',
        content:
          '🔥 雙 11 新會員超值好禮！ 🔥\n\n' +
          '親愛的 {tierName}：\n\n' +
          '🏷️ {discount}% OFF\n' +
          '🎁 加贈 {bonusPoints} 點\n' +
          '📦 免運\n\n' +
          '優惠碼：{couponCode}\n' +
          '把握您的第一個雙 11！ 💥',
      },
      risk: {
        subject: '雙 11 回歸超值禮',
        content:
          '🔥 雙 11 回歸禮！ 🔥\n\n' +
          '親愛的 {tierName}：\n\n' +
          '🏷️ {discount}% OFF\n' +
          '⭐ {pointsMultiplier} 倍點數\n\n' +
          '優惠碼：{couponCode}\n' +
          '限時回歸！ 💥',
      },
      sleep: {
        subject: '雙 11 復活超值禮',
        content:
          '🔥 雙 11 復活好禮！ 🔥\n\n' +
          '親愛的 {tierName}：\n\n' +
          '🏷️ {discount}% OFF\n' +
          '🎁 贈 {bonusPoints} 點\n' +
          '📦 免運\n\n' +
          '優惠碼：{couponCode}\n' +
          '最好的回歸時機！ 💥',
      },
    },
    email: {
      vip: {
        subject: '【雙 11 開戰】{tierName}專屬 {discount}% OFF + {pointsMultiplier}倍點數',
        content:
          '親愛的 {tierName}，\n\n' +
          '🔥 雙 11 正式開始！\n\n' +
          '✦ 獨享 {discount}% OFF（優惠碼：{couponCode}）\n' +
          '✦ 點數 {pointsMultiplier} 倍回饋\n' +
          '✦ 加贈 {bonusPoints} 紅利點數\n' +
          '✦ 全站免運\n' +
          '✦ 滿 $3,000 贈限量福袋\n' +
          '✦ 滿 $5,000 再抽年度大禮\n\n' +
          '限時 72 小時，錯過再等一年！\n\n' +
          'CHIC KIM & MIU\n' +
          '專屬你美好的時尚優雅',
      },
      regular: {
        subject: '雙 11 全站 {discount}% OFF 開戰！',
        content:
          '親愛的 {tierName}，\n\n' +
          '🔥 雙 11 開始了！\n\n' +
          '✦ 全站 {discount}% OFF（優惠碼：{couponCode}）\n' +
          '✦ 點數 {pointsMultiplier} 倍\n' +
          '✦ 免運\n\n' +
          '限時 72 小時！\n\n' +
          'CHIC KIM & MIU\n' +
          '專屬你美好的時尚優雅',
      },
      new: {
        subject: '新會員雙 11 {discount}% OFF + {bonusPoints} 點',
        content:
          '親愛的 {tierName}，\n\n' +
          '🔥 您的第一個雙 11！\n\n' +
          '✦ {discount}% OFF（優惠碼：{couponCode}）\n' +
          '✦ 加贈 {bonusPoints} 點\n' +
          '✦ 免運\n\n' +
          'CHIC KIM & MIU\n' +
          '專屬你美好的時尚優雅',
      },
      risk: {
        subject: '雙 11 回歸 {discount}% OFF',
        content:
          '親愛的 {tierName}，\n\n' +
          '🔥 雙 11 回歸好禮！\n\n' +
          '✦ {discount}% OFF（優惠碼：{couponCode}）\n' +
          '✦ {pointsMultiplier} 倍點數\n\n' +
          'CHIC KIM & MIU\n' +
          '專屬你美好的時尚優雅',
      },
      sleep: {
        subject: '雙 11 復活 {discount}% OFF + {bonusPoints} 點',
        content:
          '親愛的 {tierName}，\n\n' +
          '🔥 雙 11 復活好禮！\n\n' +
          '✦ {discount}% OFF（優惠碼：{couponCode}）\n' +
          '✦ 贈 {bonusPoints} 點\n' +
          '✦ 免運\n\n' +
          'CHIC KIM & MIU\n' +
          '專屬你美好的時尚優雅',
      },
    },
    sms: {
      vip: { subject: '', content: '【CHIC KIM & MIU】🔥雙11開戰！{tierName}{discount}%OFF+{pointsMultiplier}倍點數！優惠碼{couponCode}，72小時限定💥' },
      regular: { subject: '', content: '【CHIC KIM & MIU】🔥雙11{discount}%OFF開戰！優惠碼{couponCode}，免運+點數回饋，72小時💥' },
      new: { subject: '', content: '【CHIC KIM & MIU】🔥新會員雙11{discount}%OFF+{bonusPoints}點！優惠碼{couponCode}💥' },
      risk: { subject: '', content: '【CHIC KIM & MIU】🔥雙11回歸{discount}%OFF！優惠碼{couponCode}，限時回歸💥' },
      sleep: { subject: '', content: '【CHIC KIM & MIU】🔥雙11復活{discount}%OFF+{bonusPoints}點！優惠碼{couponCode}💥' },
    },
    push: {
      vip: { subject: '🔥 雙 11 開戰 {discount}% OFF', content: '{tierName}專屬{discount}%OFF+{pointsMultiplier}倍點數！72小時限定💥' },
      regular: { subject: '🔥 雙 11 {discount}% OFF', content: '全站{discount}%OFF！優惠碼{couponCode}，72小時💥' },
      new: { subject: '🔥 新會員雙 11 超值', content: '{discount}%OFF+{bonusPoints}點！{couponCode}💥' },
      risk: { subject: '🔥 雙 11 回歸禮', content: '回歸{discount}%OFF！{couponCode}💥' },
      sleep: { subject: '🔥 雙 11 復活禮', content: '復活{discount}%OFF+{bonusPoints}點！{couponCode}💥' },
    },
  },
  followup: {
    line: {
      vip: {
        subject: '雙 11 感恩延續',
        content:
          '親愛的 {tierName}，感謝您的雙 11 支持！ 🎉\n\n' +
          '延續好禮：\n' +
          '✦ 回購 85 折（24 小時限定）\n' +
          '✦ 三倍點數延長\n\n' +
          '最後一波，別錯過！ ✨',
      },
      regular: { subject: '雙 11 最後加碼', content: '親愛的 {tierName}，雙 11 回購優惠 24 小時延長！把握最後機會 🎉' },
      new: { subject: '雙 11 後的小驚喜', content: '親愛的 {tierName}，感謝首購！新會員優惠延長 24 小時 💝' },
      risk: { subject: '感謝回歸', content: '親愛的 {tierName}，歡迎回來！持續折扣已保留 🎉' },
      sleep: { subject: '回歸禮延長', content: '親愛的 {tierName}，歡迎回來！回歸禮延長 48 小時 ✨' },
    },
    email: {
      vip: {
        subject: '【雙 11 延續】{tierName} 回購 85 折 + 三倍點數',
        content:
          '親愛的 {tierName}，\n\n' +
          '感謝您的雙 11 支持！\n\n' +
          '✦ 回購 85 折（24 小時限定）\n' +
          '✦ 三倍點數延長\n\n' +
          '最後一波！\n\n' +
          'CHIC KIM & MIU\n' +
          '專屬你美好的時尚優雅',
      },
      regular: { subject: '雙 11 回購延長', content: '親愛的 {tierName}，\n\n回購優惠 24 小時延長！\n\nCHIC KIM & MIU\n專屬你美好的時尚優雅' },
      new: { subject: '雙 11 新會員延續禮', content: '親愛的 {tierName}，\n\n感謝首購！優惠延長 24 小時。\n\nCHIC KIM & MIU\n專屬你美好的時尚優雅' },
      risk: { subject: '歡迎回歸 | 持續優惠', content: '親愛的 {tierName}，\n\n歡迎回來！折扣已保留。\n\nCHIC KIM & MIU\n專屬你美好的時尚優雅' },
      sleep: { subject: '回歸禮延長', content: '親愛的 {tierName}，\n\n回歸禮延長 48 小時。\n\nCHIC KIM & MIU\n專屬你美好的時尚優雅' },
    },
    sms: {
      vip: { subject: '', content: '【CHIC KIM & MIU】感謝{tierName}！雙11回購85折+三倍點數，24小時限定🎉' },
      regular: { subject: '', content: '【CHIC KIM & MIU】雙11回購24小時延長！把握最後機會🎉' },
      new: { subject: '', content: '【CHIC KIM & MIU】感謝首購！新會員優惠延長24小時💝' },
      risk: { subject: '', content: '【CHIC KIM & MIU】歡迎回歸！持續折扣已保留🎉' },
      sleep: { subject: '', content: '【CHIC KIM & MIU】歡迎回來！回歸禮延長48小時✨' },
    },
    push: {
      vip: { subject: '雙 11 回購 85 折', content: '感謝{tierName}！24小時限定+三倍點數🎉' },
      regular: { subject: '回購延長24小時', content: '雙11最後一波！🎉' },
      new: { subject: '新會員優惠延長', content: '感謝首購！延長24小時💝' },
      risk: { subject: '持續優惠', content: '歡迎回歸！折扣已保留🎉' },
      sleep: { subject: '回歸禮延長', content: '歡迎回來！延長48小時✨' },
    },
  },
}

/** 所有節慶文案索引 */
const FESTIVAL_COPY_INDEX: Record<string, Record<string, Record<string, Record<CopySegmentTier, CopyTemplate>>>> = {
  valentines: VALENTINES_COPY,
  mothers_day: MOTHERS_DAY_COPY,
  double_eleven: DOUBLE_ELEVEN_COPY,
}

// ══════════════════════════════════════════════════════════
// Core Functions
// ══════════════════════════════════════════════════════════

/**
 * 取得節慶差異化優惠（依客群 + 信用分數）
 *
 * 優惠規則：
 * - VIP1/VIP2：基礎折扣 15~20%，信用分數 ≥90 再加 3~5%
 * - POT1/REG1：基礎折扣 10~12%
 * - REG2/NEW1：基礎折扣 8~10%
 * - RISK1/RISK2：基礎折扣 5~8%
 * - SLP1：基礎折扣 12~15%（促進回歸）
 * - BLK1：基礎折扣 3~5%（最低優惠）
 *
 * @param festivalType - 節慶類型代碼
 * @param segmentCode - 後台分群碼（VIP1, REG1...）
 * @param creditScore - 信用分數 0~100
 */
export function getFestivalOffer(
  festivalType: string,
  segmentCode: string,
  creditScore: number,
): FestivalOffer {
  const level = getSegmentOfferLevel(segmentCode)
  const creditBonus = getCreditScoreBonus(creditScore)

  // 基礎折扣 = 等級倍率 × 20（VIP1 → 20%, BLK1 → 2%）
  const baseDiscount = Math.round(level * 20)
  // 加上信用分數加成
  const totalDiscount = Math.min(baseDiscount + creditBonus, 30)

  // 點數倍率（VIP 最高 5 倍，一般 2 倍）
  const pointsMultiplier = level >= 0.9 ? 5 : level >= 0.7 ? 3 : level >= 0.5 ? 2 : 1

  // 獎勵點數
  const bonusPoints = level >= 0.9 ? 500 : level >= 0.7 ? 300 : level >= 0.5 ? 150 : level >= 0.3 ? 50 : 0

  // 免運門檻：VIP 免運，一般滿額免運
  const freeShipping = level >= 0.6

  // 節慶特殊加碼（雙 11 / 聖誕 折扣更高）
  const isMajorFestival = ['double_eleven', 'christmas_newyear', 'black_friday'].includes(festivalType)
  const festivalBonus = isMajorFestival ? 3 : 0
  const finalDiscount = Math.min(totalDiscount + festivalBonus, 30)

  // 產生優惠碼
  const festivalPrefix = festivalType.toUpperCase().slice(0, 4)
  const segmentSuffix = segmentCode
  const couponCode = `${festivalPrefix}_${segmentSuffix}_${finalDiscount}`

  // 額外福利
  const additionalPerks: string[] = []
  if (level >= 0.9) {
    additionalPerks.push('限量禮盒包裝', '手寫卡片服務', '專屬客服通道')
  }
  if (level >= 0.7) {
    additionalPerks.push('生日月加碼', '優先出貨')
  }
  if (level >= 0.5) {
    additionalPerks.push('禮物包裝服務')
  }
  if (segmentCode === 'SLP1') {
    additionalPerks.push('沉睡復活加碼點數', '免運費')
  }
  if (isMajorFestival) {
    additionalPerks.push('滿額抽獎資格')
  }

  return {
    discountType: 'percentage',
    discountValue: finalDiscount,
    couponCode,
    pointsMultiplier,
    bonusPoints,
    freeShipping,
    additionalPerks,
  }
}

/**
 * 產生節慶文案（3 階段 × 4 通道 × 差異化版本）
 *
 * 文案風格：優雅、女性化、韓系浪漫風格
 * 品牌口號：「專屬你美好的時尚優雅」
 *
 * ⚠️ 所有文案只使用前台稱號，絕不暴露後台碼
 *
 * @param festivalType - 節慶類型代碼
 * @param phase - 階段（warmup / peak / followup）
 * @param channel - 通道（line / email / sms / push）
 * @param segmentCode - 後台分群碼
 * @param tierCode - 後台等級碼
 */
export function generateFestivalCopy(
  festivalType: string,
  phase: 'warmup' | 'peak' | 'followup',
  channel: string,
  segmentCode: string,
  tierCode: string,
): { subject: string; content: string } {
  const tierName = getTierFrontName(tierCode)
  const segmentTier = mapSegmentToTier(segmentCode)

  // 從文案索引中取得模板
  const festivalCopy = FESTIVAL_COPY_INDEX[festivalType]

  // 取得對應的優惠資訊（用於替換 placeholder）
  const offer = getFestivalOffer(festivalType, segmentCode, 80) // 預設 80 分

  let template: CopyTemplate

  if (festivalCopy?.[phase]?.[channel]?.[segmentTier]) {
    template = festivalCopy[phase][channel][segmentTier]
  } else {
    // 未定義的節慶使用通用模板
    template = generateGenericCopy(festivalType, phase, channel, segmentTier, tierName)
  }

  // 替換 placeholder
  const replacements: Record<string, string> = {
    '{tierName}': tierName,
    '{discount}': String(offer.discountValue),
    '{couponCode}': offer.couponCode,
    '{pointsMultiplier}': String(offer.pointsMultiplier),
    '{bonusPoints}': String(offer.bonusPoints),
  }

  let subject = template.subject
  let content = template.content

  for (const [placeholder, value] of Object.entries(replacements)) {
    subject = subject.split(placeholder).join(value)
    content = content.split(placeholder).join(value)
  }

  return { subject, content }
}

/**
 * 通用節慶文案產生器（未定義完整模板的節慶適用）
 */
function generateGenericCopy(
  festivalType: string,
  phase: 'warmup' | 'peak' | 'followup',
  channel: string,
  segmentTier: CopySegmentTier,
  tierName: string,
): CopyTemplate {
  const festival = FESTIVAL_DEFINITIONS[festivalType]
  const festivalName = festival?.name ?? '限時活動'

  const phaseLabels: Record<string, string> = {
    warmup: '即將開始',
    peak: '正式開跑',
    followup: '感恩延續',
  }

  const greetings: Record<CopySegmentTier, string> = {
    vip: `親愛的 ${tierName}，作為我們最珍貴的 ${tierName}`,
    regular: `親愛的 ${tierName}`,
    new: `親愛的 ${tierName}，歡迎來到 CHIC KIM & MIU`,
    risk: `親愛的 ${tierName}，好久不見`,
    sleep: `親愛的 ${tierName}，我們好想您`,
  }

  const greeting = greetings[segmentTier]

  if (channel === 'sms') {
    return {
      subject: '',
      content: `【CHIC KIM & MIU】${festivalName}${phaseLabels[phase]}！${tierName}專屬優惠等您來領 ✨`,
    }
  }

  if (channel === 'push') {
    return {
      subject: `${festivalName}${phaseLabels[phase]}`,
      content: `${tierName}，${festivalName}專屬優惠已準備就緒 ✨`,
    }
  }

  if (channel === 'line') {
    if (phase === 'warmup') {
      return {
        subject: `${festivalName}預告`,
        content:
          `${greeting}，${festivalName}${phaseLabels[phase]}！ ✨\n\n` +
          `CHIC KIM & MIU 正在為您準備最美好的${festivalName}驚喜。\n\n` +
          `🎀 專屬優惠即將揭曉\n` +
          `💕 敬請期待\n\n` +
          `專屬你美好的時尚優雅`,
      }
    }
    if (phase === 'peak') {
      return {
        subject: `${festivalName}正式開跑`,
        content:
          `${greeting}，${festivalName}活動正式開始！ 🎉\n\n` +
          `✦ 全站 {discount}% OFF\n` +
          `✦ 點數 {pointsMultiplier} 倍回饋\n\n` +
          `優惠碼：{couponCode}\n` +
          `把握限時優惠 💕`,
      }
    }
    return {
      subject: `${festivalName}感恩延續`,
      content:
        `${greeting}，感謝您參與${festivalName}！ 💕\n\n` +
        `我們為您準備了回購好禮，\n` +
        `期待繼續為您帶來美好穿搭 ✨`,
    }
  }

  // email
  if (phase === 'warmup') {
    return {
      subject: `${festivalName}即將開始 | CHIC KIM & MIU`,
      content:
        `${greeting}，\n\n` +
        `${festivalName}即將到來，CHIC KIM & MIU 正在為您準備最美好的驚喜。\n\n` +
        `✦ 專屬優惠即將揭曉\n` +
        `✦ 限定好禮等您領取\n\n` +
        `敬請期待。\n\n` +
        `CHIC KIM & MIU\n` +
        `專屬你美好的時尚優雅`,
    }
  }
  if (phase === 'peak') {
    return {
      subject: `${festivalName} {discount}% OFF 正式開跑 | CHIC KIM & MIU`,
      content:
        `${greeting}，\n\n` +
        `${festivalName}活動正式開跑！\n\n` +
        `✦ 全站 {discount}% OFF（優惠碼：{couponCode}）\n` +
        `✦ 點數 {pointsMultiplier} 倍回饋\n\n` +
        `把握限時優惠！\n\n` +
        `CHIC KIM & MIU\n` +
        `專屬你美好的時尚優雅`,
    }
  }
  return {
    subject: `${festivalName}感恩延續 | CHIC KIM & MIU`,
    content:
      `${greeting}，\n\n` +
      `感謝您參與${festivalName}活動！\n\n` +
      `✦ 回購優惠已為您延長\n\n` +
      `期待繼續為您帶來美好。\n\n` +
      `CHIC KIM & MIU\n` +
      `專屬你美好的時尚優雅`,
  }
}

/**
 * 產生節慶行銷活動的完整 3 階段 Journey 流程
 *
 * 每個階段包含多通道訊息（LINE、Email、SMS、Push），
 * 依據客群和信用分數差異化內容與優惠。
 *
 * @param festivalType - 節慶類型代碼
 * @param segmentCode - 後台分群碼
 * @param creditScore - 信用分數 0~100
 * @param tierCode - 後台等級碼
 */
export function generateFestivalJourney(
  festivalType: string,
  segmentCode: string,
  creditScore: number,
  tierCode: string,
): FestivalJourneyPlan {
  const festival = FESTIVAL_DEFINITIONS[festivalType]
  if (!festival) {
    throw new Error(`[FestivalEngine] 未知的節慶類型: ${festivalType}`)
  }

  const offer = getFestivalOffer(festivalType, segmentCode, creditScore)
  const channels = ['line', 'email', 'sms', 'push']

  // 預熱階段：活動前 N 天開始
  const warmupMessages = channels.map((channel, index) => {
    const copy = generateFestivalCopy(festivalType, 'warmup', channel, segmentCode, tierCode)
    return {
      channel,
      subject: copy.subject,
      content: copy.content,
      delay: index * 60, // 每個通道間隔 60 分鐘
    }
  })

  // 高峰階段：活動正式開始
  const peakMessages = channels.map((channel, index) => {
    const copy = generateFestivalCopy(festivalType, 'peak', channel, segmentCode, tierCode)
    return {
      channel,
      subject: copy.subject,
      content: copy.content,
      delay: index * 30, // 高峰階段間隔更短
    }
  })

  // 回購階段：活動結束後
  const followupMessages = channels.map((channel, index) => {
    const copy = generateFestivalCopy(festivalType, 'followup', channel, segmentCode, tierCode)
    return {
      channel,
      subject: copy.subject,
      content: copy.content,
      delay: index * 120, // 回購階段間隔較長
    }
  })

  return {
    festivalType,
    phases: [
      {
        phase: 'warmup',
        offsetDays: -festival.defaultWarmupDays,
        durationHours: festival.defaultWarmupDays * 24,
        messages: warmupMessages,
      },
      {
        phase: 'peak',
        offsetDays: 0,
        durationHours: festival.defaultDuration * 24,
        messages: peakMessages,
      },
      {
        phase: 'followup',
        offsetDays: festival.defaultDuration,
        durationHours: 72, // 回購階段固定 72 小時
        messages: followupMessages,
      },
    ],
    offer,
  }
}

/**
 * 建立完整的節慶活動（包含所有階段、所有客群的完整計畫）
 *
 * 在 marketing-campaigns collection 中建立活動記錄，
 * 並為每個目標客群產生對應的 Journey Plan。
 *
 * @param festivalSlug - 節慶代碼（如 'valentines', 'double_eleven'）
 * @returns 新建活動的 ID
 */
export async function createFestivalCampaign(festivalSlug: string): Promise<string> {
  const festival = FESTIVAL_DEFINITIONS[festivalSlug]
  if (!festival) {
    throw new Error(`[FestivalEngine] 未知的節慶類型: ${festivalSlug}`)
  }

  const payload = await getPayload({ config })
  const now = new Date()
  const year = now.getFullYear()

  // 計算活動開始日期（取最近的月份）
  const targetMonth = getNextOccurrence(festival.months, now)
  const startDate = new Date(year, targetMonth - 1, 1)
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + festival.defaultDuration + festival.defaultWarmupDays)

  // 所有目標客群
  const allSegments = ['VIP1', 'VIP2', 'POT1', 'REG1', 'REG2', 'NEW1', 'SLP1']
  // BLK1、RISK1、RISK2 也列入但優惠最低
  const riskSegments = ['RISK1', 'RISK2', 'BLK1']

  // 為每個客群產生 Journey Plan（儲存為 JSON）
  const journeyPlans: Record<string, FestivalJourneyPlan> = {}
  for (const seg of [...allSegments, ...riskSegments]) {
    journeyPlans[seg] = generateFestivalJourney(festivalSlug, seg, 80, 'silver')
  }

  // 建立行銷活動
  const campaign = await (payload.create as Function)({
    collection: 'marketing-campaigns',
    data: {
      campaignName: `${year} ${festival.name}`,
      campaignSlug: `${festivalSlug}_${year}_${Date.now()}`,
      campaignType: 'festival',
      status: 'draft',
      description: `${festival.description}\n\n自動產生的節慶活動，包含 ${allSegments.length + riskSegments.length} 個客群的完整 3 階段 Journey。`,
      targetSegments: [...allSegments, ...riskSegments],
      channels: ['line', 'email', 'sms', 'push'],
      schedule: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        timezone: 'Asia/Taipei',
      },
      personalizedContent: {
        useAIRecommendation: true,
        useUGC: true,
        useCreditScorePersonalization: true,
        useSegmentPersonalization: true,
      },
      adminNote: `由 FestivalEngine 自動產生\n客群 Journey Plans：\n${JSON.stringify(Object.keys(journeyPlans))}`,
    },
  })

  console.log(`[FestivalEngine] 節慶活動已建立: ${campaign.id} (${festival.name})`)
  return campaign.id as unknown as string
}

/**
 * 取得即將到來的節慶列表
 *
 * @param withinDays - 未來幾天內的節慶
 */
export function getUpcomingFestivals(
  withinDays: number,
): Array<{ type: string; name: string; daysUntil: number }> {
  const now = new Date()
  const results: Array<{ type: string; name: string; daysUntil: number }> = []

  for (const [type, def] of Object.entries(FESTIVAL_DEFINITIONS)) {
    // 跳過生日月（每月都有）
    if (type === 'birthday_month') continue

    for (const month of def.months) {
      // 假設節慶在該月中旬（15 號）
      const festivalDate = new Date(now.getFullYear(), month - 1, 15)

      // 如果今年的已過，看明年的
      if (festivalDate < now) {
        festivalDate.setFullYear(festivalDate.getFullYear() + 1)
      }

      const diffMs = festivalDate.getTime() - now.getTime()
      const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

      if (daysUntil <= withinDays && daysUntil > 0) {
        results.push({ type, name: def.name, daysUntil })
      }
    }
  }

  // 依天數排序
  return results.sort((a, b) => a.daysUntil - b.daysUntil)
}

// ══════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════

/**
 * 取得下一個節慶月份
 */
function getNextOccurrence(months: number[], now: Date): number {
  const currentMonth = now.getMonth() + 1

  // 找到下一個大於等於當前月份的
  for (const m of months) {
    if (m >= currentMonth) return m
  }

  // 都過了，取明年第一個
  return months[0]
}
