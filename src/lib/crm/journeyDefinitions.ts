/**
 * 14 種預定義自動化旅程模板
 * ─────────────────────────────────────
 * CHIC KIM & MIU 行銷自動化旅程定義
 *
 * ⚠️ 所有訊息模板必須使用前台稱號（優雅初遇者、曦漾仙子...）
 *    絕對不可出現 bronze / silver / gold 等後台分級碼
 *
 * 這些模板可透過 seed 腳本匯入 AutomationJourneys collection，
 * 或由管理員在後台手動調整。
 */

import type { JourneyStep } from './automationEngine'

// ── Types ──────────────────────────────────────────────

export interface JourneyTemplate {
  slug: string
  name: string
  description: string
  isActive: boolean
  triggerType: 'event' | 'schedule' | 'condition'
  triggerEvent: string
  conditions: Record<string, unknown>
  steps: JourneyStep[]
  priority: number
  maxExecutionsPerUser: number
  cooldownHours: number
}

// ── 14 Journey Templates ───────────────────────────────

export const JOURNEY_TEMPLATES: JourneyTemplate[] = [
  // ─── 1. 註冊歡迎 ───
  {
    slug: 'welcome_registration',
    name: '註冊歡迎',
    description: '新會員註冊後立即發送歡迎訊息與首購優惠，建立第一印象',
    isActive: true,
    triggerType: 'event',
    triggerEvent: 'user_registered',
    conditions: {},
    steps: [
      {
        stepOrder: 1,
        action: 'send_line',
        delayMinutes: 0,
        templateKey: 'welcome_line',
        content:
          '親愛的新朋友，歡迎加入 CHIC KIM & MIU 大家庭！🌸\n\n' +
          '您已成為我們的「優雅初遇者」，專屬歡迎禮已送達：\n' +
          '🎁 50 會員點數\n' +
          '🎫 首購 9 折優惠券\n\n' +
          '期待與您一起發現更多美好穿搭 💕',
      },
      {
        stepOrder: 2,
        action: 'send_email',
        delayMinutes: 5,
        templateKey: 'welcome_email',
        content:
          '歡迎加入 CHIC KIM & MIU！\n\n' +
          '親愛的「優雅初遇者」，感謝您的加入。\n' +
          '您的帳戶已開通，歡迎禮已準備就緒：\n' +
          '- 50 會員點數已入帳\n' +
          '- 首購 9 折優惠券（30 天內有效）\n\n' +
          '立即探索我們精心挑選的時尚單品吧！',
      },
      {
        stepOrder: 3,
        action: 'add_tag',
        delayMinutes: 0,
        templateKey: '',
        content: 'new_member',
      },
    ],
    priority: 1,
    maxExecutionsPerUser: 1,
    cooldownHours: 0,
  },

  // ─── 2. 首購感謝 + 加購推薦 ───
  {
    slug: 'first_purchase_thanks',
    name: '首購感謝 + 加購推薦',
    description: '首次購買後發送感謝訊息，並推薦搭配商品促進回購',
    isActive: true,
    triggerType: 'event',
    triggerEvent: 'first_purchase',
    conditions: {},
    steps: [
      {
        stepOrder: 1,
        action: 'send_line',
        delayMinutes: 0,
        templateKey: 'first_purchase_thanks_line',
        content:
          '恭喜您完成首次購買！🎉\n\n' +
          '感謝您選擇 CHIC KIM & MIU，您的信用分數已獲得 +15 分加分！\n' +
          '持續購物可以累積更多點數，解鎖更多會員好禮喔 ✨',
      },
      {
        stepOrder: 2,
        action: 'wait',
        delayMinutes: 1440, // 24 小時後
        templateKey: '',
        content: '',
      },
      {
        stepOrder: 3,
        action: 'send_line',
        delayMinutes: 0,
        templateKey: 'first_purchase_recommendation',
        content:
          '親愛的，您昨天入手的單品搭配這些更好看喔 💕\n\n' +
          '為您精選了幾款完美搭配，現在加購享專屬折扣！\n' +
          '👉 點擊查看推薦搭配',
      },
    ],
    priority: 2,
    maxExecutionsPerUser: 1,
    cooldownHours: 0,
  },

  // ─── 3. 棄單提醒（3 步驟） ───
  {
    slug: 'cart_abandoned',
    name: '棄單提醒',
    description: '購物車未結帳的三階段提醒：1 小時、24 小時、72 小時',
    isActive: true,
    triggerType: 'event',
    triggerEvent: 'cart_abandoned',
    conditions: {},
    steps: [
      {
        stepOrder: 1,
        action: 'send_line',
        delayMinutes: 60,
        templateKey: 'cart_abandoned_1h',
        content:
          '親愛的，您的購物車裡有好東西在等您喔 🛒\n\n' +
          '別讓心儀的單品溜走了～現在結帳還來得及！',
      },
      {
        stepOrder: 2,
        action: 'send_email',
        delayMinutes: 1440,
        templateKey: 'cart_abandoned_24h',
        content:
          '您的購物車商品還在等您！\n\n' +
          '提醒您，部分商品庫存有限，建議盡早完成結帳。\n' +
          '現在回來結帳，我們為您保留了專屬優惠 💕',
      },
      {
        stepOrder: 3,
        action: 'send_line',
        delayMinutes: 4320,
        templateKey: 'cart_abandoned_72h',
        content:
          '最後提醒！您購物車中的商品即將被其他人搶走 😢\n\n' +
          '限時為您保留最後優惠，把握機會喔！\n' +
          '⚠️ 溫馨提醒：棄單可能會影響信用分數',
      },
    ],
    priority: 3,
    maxExecutionsPerUser: 3,
    cooldownHours: 72,
  },

  // ─── 4. 升級通知 ───
  {
    slug: 'tier_upgrade',
    name: '升級通知',
    description: '會員等級升級時發送恭喜訊息，介紹新等級權益',
    isActive: true,
    triggerType: 'event',
    triggerEvent: 'tier_upgraded',
    conditions: {},
    steps: [
      {
        stepOrder: 1,
        action: 'send_line',
        delayMinutes: 0,
        templateKey: 'tier_upgrade_line',
        content:
          '🎊 恭喜升級！\n\n' +
          '親愛的，您已成功晉升！全新的會員等級帶來更多專屬禮遇：\n\n' +
          '✨ 更高的購物折扣\n' +
          '✨ 加倍的點數累積\n' +
          '✨ 專屬優惠券\n\n' +
          '感謝您對 CHIC KIM & MIU 的支持 💕',
      },
      {
        stepOrder: 2,
        action: 'send_email',
        delayMinutes: 5,
        templateKey: 'tier_upgrade_email',
        content:
          '恭喜等級升級！\n\n' +
          '您的會員等級已提升，新等級的專屬權益已經啟用。\n' +
          '歡迎到會員中心查看您的全新權益詳情！',
      },
      {
        stepOrder: 3,
        action: 'assign_coupon',
        delayMinutes: 0,
        templateKey: 'tier_upgrade_coupon',
        content: '升級專屬優惠券',
      },
    ],
    priority: 1,
    maxExecutionsPerUser: 6,
    cooldownHours: 0,
  },

  // ─── 5. 沉睡喚回（3 階段） ───
  {
    slug: 'dormant_wakeup',
    name: '沉睡喚回',
    description: '30天、45天、60天未活動的會員分階段喚醒',
    isActive: true,
    triggerType: 'schedule',
    triggerEvent: 'dormant_30d',
    conditions: { inactiveDays: { min: 30 } },
    steps: [
      {
        stepOrder: 1,
        action: 'send_line',
        delayMinutes: 0,
        templateKey: 'dormant_30d',
        content:
          '好久不見！我們想念您了 💕\n\n' +
          'CHIC KIM & MIU 最近上了好多新品，\n' +
          '為您準備了回歸專屬禮：限時 85 折優惠券！\n\n' +
          '快來看看有什麼適合您的吧 🌸',
      },
      {
        stepOrder: 2,
        action: 'send_email',
        delayMinutes: 21600, // 15 天後（45 天）
        templateKey: 'dormant_45d',
        content:
          '親愛的，我們為您保留了專屬優惠\n\n' +
          '距離上次購物已經有一段時間了，\n' +
          '您的會員點數和優惠券都在等您回來使用！\n\n' +
          '限時加碼：回歸首單享雙倍點數 ✨',
      },
      {
        stepOrder: 3,
        action: 'send_line',
        delayMinutes: 43200, // 30 天後（60 天）
        templateKey: 'dormant_60d',
        content:
          '最後的溫馨提醒 💝\n\n' +
          '您帳戶中的點數和優惠即將到期，\n' +
          '別讓它們白白浪費了！\n\n' +
          '現在回來購物，我們額外贈送您 100 點數作為回歸禮 🎁',
      },
    ],
    priority: 5,
    maxExecutionsPerUser: 1,
    cooldownHours: 720, // 30 天冷卻
  },

  // ─── 6. 生日月禮遇 ───
  {
    slug: 'birthday_treat',
    name: '生日月禮遇',
    description: '生日月份自動發送生日祝福與專屬優惠',
    isActive: true,
    triggerType: 'schedule',
    triggerEvent: 'birthday_month',
    conditions: {},
    steps: [
      {
        stepOrder: 1,
        action: 'send_line',
        delayMinutes: 0,
        templateKey: 'birthday_line',
        content:
          '🎂 生日快樂！\n\n' +
          '親愛的，CHIC KIM & MIU 祝您生日快樂！\n\n' +
          '專屬生日禮已送達您的帳戶：\n' +
          '🎁 生日專屬優惠券\n' +
          '🌟 信用分數 +10 生日加分\n' +
          '💰 生日月消費享雙倍點數\n\n' +
          '整個月都是您的寵愛月 💕',
      },
      {
        stepOrder: 2,
        action: 'send_email',
        delayMinutes: 0,
        templateKey: 'birthday_email',
        content:
          '生日快樂！CHIC KIM & MIU 為您準備了專屬驚喜\n\n' +
          '您的生日禮物已經準備好了，整個生日月都可以使用！\n' +
          '趕快到會員中心領取您的生日驚喜吧 🎂',
      },
      {
        stepOrder: 3,
        action: 'assign_coupon',
        delayMinutes: 0,
        templateKey: 'birthday_coupon',
        content: '生日專屬優惠券',
      },
    ],
    priority: 2,
    maxExecutionsPerUser: 1,
    cooldownHours: 8760, // 一年冷卻
  },

  // ─── 7. 新品分級優先通知 ───
  {
    slug: 'new_product_priority',
    name: '新品分級優先通知',
    description: '新品上架時依等級分級通知，金曦女王以上享 24 小時搶先購',
    isActive: true,
    triggerType: 'event',
    triggerEvent: 'new_product_launch',
    conditions: { tierLevel: { min: 3 } },
    steps: [
      {
        stepOrder: 1,
        action: 'condition_check',
        delayMinutes: 0,
        templateKey: 'check_tier_t3_plus',
        content: '檢查會員等級是否為金曦女王（T3）以上',
      },
      {
        stepOrder: 2,
        action: 'send_line',
        delayMinutes: 0,
        templateKey: 'new_product_vip_line',
        content:
          '✨ 專屬搶先看！\n\n' +
          '身為尊貴的高階會員，您享有新品 24 小時搶先購資格！\n\n' +
          '🆕 全新系列即將上架\n' +
          '⏰ 您比一般會員早 24 小時搶購\n' +
          '💫 搶先購期間享專屬折扣\n\n' +
          '立即查看新品 → CHIC KIM & MIU',
      },
      {
        stepOrder: 3,
        action: 'send_email',
        delayMinutes: 5,
        templateKey: 'new_product_vip_email',
        content:
          '新品搶先看 — 高階會員專屬\n\n' +
          '全新系列已為您開放搶先購！\n' +
          '24 小時獨享期，不與他人競爭。\n\n' +
          '點擊查看新品系列 →',
      },
    ],
    priority: 3,
    maxExecutionsPerUser: 0, // 無限制
    cooldownHours: 24,
  },

  // ─── 8. 高 VIP 專屬關懷 ───
  {
    slug: 'vip_care',
    name: '高 VIP 專屬關懷',
    description: '星耀皇后（T4）與璀璨天后（T5）專屬關懷訊息',
    isActive: true,
    triggerType: 'schedule',
    triggerEvent: 'vip_care',
    conditions: { tierCodes: ['platinum', 'diamond'] },
    steps: [
      {
        stepOrder: 1,
        action: 'send_line',
        delayMinutes: 0,
        templateKey: 'vip_care_line',
        content:
          '💎 尊貴的您，近來好嗎？\n\n' +
          'CHIC KIM & MIU 團隊特別為您準備了專屬關懷：\n\n' +
          '🌟 本月專屬造型諮詢服務已開放預約\n' +
          '🎁 專屬禮遇已更新，歡迎查看\n' +
          '💕 如有任何需要，您的專屬客服隨時為您服務\n\n' +
          '感謝您一直以來的支持與信賴 ✨',
      },
      {
        stepOrder: 2,
        action: 'send_email',
        delayMinutes: 0,
        templateKey: 'vip_care_email',
        content:
          '專屬會員關懷\n\n' +
          '尊貴的您好，感謝您長期以來對 CHIC KIM & MIU 的支持。\n\n' +
          '本月為您準備了以下專屬服務：\n' +
          '- 一對一造型諮詢預約\n' +
          '- 新品優先試穿體驗\n' +
          '- 專屬客服直通管道\n\n' +
          '期待繼續為您服務 💕',
      },
    ],
    priority: 1,
    maxExecutionsPerUser: 0,
    cooldownHours: 720, // 30 天
  },

  // ─── 9. 點數到期前提醒 ───
  {
    slug: 'points_expiry',
    name: '點數到期前提醒',
    description: '點數即將到期前提醒會員儘速使用',
    isActive: true,
    triggerType: 'schedule',
    triggerEvent: 'points_expiring',
    conditions: { pointsExpiringDays: 14 },
    steps: [
      {
        stepOrder: 1,
        action: 'send_line',
        delayMinutes: 0,
        templateKey: 'points_expiry_line',
        content:
          '⏰ 點數即將到期提醒！\n\n' +
          '親愛的，您帳戶中有點數即將在 14 天後到期。\n' +
          '別讓辛苦累積的點數白白浪費了！\n\n' +
          '💡 小提醒：點數可在結帳時直接折抵消費\n' +
          '👉 立即前往購物使用點數',
      },
      {
        stepOrder: 2,
        action: 'send_email',
        delayMinutes: 10080, // 7 天後再提醒
        templateKey: 'points_expiry_email',
        content:
          '最後提醒：您的點數將在 7 天後到期！\n\n' +
          '趕緊把握最後機會使用您的會員點數，\n' +
          '結帳時可直接折抵消費金額！',
      },
    ],
    priority: 4,
    maxExecutionsPerUser: 0,
    cooldownHours: 336, // 14 天
  },

  // ─── 10. 信用分數變動通知 ───
  {
    slug: 'credit_score_change',
    name: '信用分數變動通知',
    description: '信用分數發生變動時通知會員，扣分時以溫馨語氣提醒',
    isActive: true,
    triggerType: 'event',
    triggerEvent: 'credit_score_changed',
    conditions: {},
    steps: [
      {
        stepOrder: 1,
        action: 'send_line',
        delayMinutes: 0,
        templateKey: 'credit_score_change_line',
        content:
          '💫 信用分數異動通知\n\n' +
          '親愛的，您的信用分數已更新。\n\n' +
          '信用分數是我們重視每一位客人的方式，\n' +
          '分數越高可享有越多專屬權益喔！\n\n' +
          '💡 提升信用分數的方式：\n' +
          '  ✅ 持續購物\n' +
          '  ✅ 撰寫好評\n' +
          '  ✅ 推薦好友\n\n' +
          '您是我們重視的好客人 💕',
      },
    ],
    priority: 5,
    maxExecutionsPerUser: 0,
    cooldownHours: 24,
  },

  // ─── 11. 信用分數低於 60 觀察警示 ───
  {
    slug: 'credit_watchlist',
    name: '信用分數觀察警示',
    description: '信用分數低於 60 時溫馨提醒會員注意',
    isActive: true,
    triggerType: 'condition',
    triggerEvent: 'credit_low_60',
    conditions: { creditScore: { max: 60 } },
    steps: [
      {
        stepOrder: 1,
        action: 'send_line',
        delayMinutes: 0,
        templateKey: 'credit_watchlist_line',
        content:
          '💝 溫馨提醒\n\n' +
          '親愛的，我們注意到您的信用分數目前偏低。\n\n' +
          '信用分數會影響您的會員權益，包括：\n' +
          '  📋 退貨額度\n' +
          '  🎫 優惠券領取資格\n' +
          '  🎁 專屬活動參與資格\n\n' +
          '不用擔心！只要持續正常購物就能輕鬆提升 ✨\n' +
          '如有任何問題，歡迎隨時聯繫客服，我們很樂意幫助您 💕',
      },
      {
        stepOrder: 2,
        action: 'send_email',
        delayMinutes: 5,
        templateKey: 'credit_watchlist_email',
        content:
          '關於您的會員信用分數\n\n' +
          '親愛的會員，我們想溫馨提醒您，目前的信用分數可能影響部分會員權益。\n\n' +
          '提升信用分數很簡單：\n' +
          '- 每次購物 +8 分\n' +
          '- 撰寫商品評價 +10 分\n' +
          '- 附照片評價 +12 分\n' +
          '- 推薦好友註冊 +18 分\n\n' +
          '我們期待您繼續享受美好的購物體驗！',
      },
    ],
    priority: 4,
    maxExecutionsPerUser: 3,
    cooldownHours: 168, // 7 天
  },

  // ─── 12. 信用分數低於 30 黑名單警告 ───
  {
    slug: 'credit_blacklist',
    name: '信用分數黑名單警告',
    description: '信用分數低於 30 時嚴重警告，部分權益將受限',
    isActive: true,
    triggerType: 'condition',
    triggerEvent: 'credit_low_30',
    conditions: { creditScore: { max: 30 } },
    steps: [
      {
        stepOrder: 1,
        action: 'send_line',
        delayMinutes: 0,
        templateKey: 'credit_blacklist_line',
        content:
          '⚠️ 重要通知\n\n' +
          '親愛的會員，您的信用分數目前較低，\n' +
          '以下會員權益將暫時受到限制：\n\n' +
          '  ❌ 無理由退貨功能暫停\n' +
          '  ❌ 部分優惠券無法領取\n' +
          '  ❌ 專屬活動暫時無法參與\n\n' +
          '我們理解每位客人都有不同的情況，\n' +
          '歡迎透過購物和好評來提升分數，\n' +
          '也歡迎聯繫客服了解更多 💝',
      },
      {
        stepOrder: 2,
        action: 'send_email',
        delayMinutes: 0,
        templateKey: 'credit_blacklist_email',
        content:
          '會員權益異動通知\n\n' +
          '由於信用分數較低，您的部分會員權益已暫時受限。\n\n' +
          '我們鼓勵您透過以下方式提升信用分數：\n' +
          '- 持續正常購物\n' +
          '- 撰寫真實商品評價\n' +
          '- 推薦好友加入\n\n' +
          '如對信用分數有疑問，歡迎聯繫客服團隊，\n' +
          '我們會詳細為您說明。',
      },
      {
        stepOrder: 3,
        action: 'add_tag',
        delayMinutes: 0,
        templateKey: '',
        content: 'credit_blacklist',
      },
    ],
    priority: 2,
    maxExecutionsPerUser: 2,
    cooldownHours: 336, // 14 天
  },

  // ─── 13. 連續退貨警示 ───
  {
    slug: 'consecutive_returns',
    name: '連續退貨警示',
    description: '偵測到連續退貨行為時溫馨提醒會員',
    isActive: true,
    triggerType: 'event',
    triggerEvent: 'consecutive_returns',
    conditions: { consecutiveReturns: { min: 2 } },
    steps: [
      {
        stepOrder: 1,
        action: 'send_line',
        delayMinutes: 0,
        templateKey: 'consecutive_returns_line',
        content:
          '💝 溫馨提醒\n\n' +
          '親愛的，我們注意到您近期有多筆退貨紀錄。\n\n' +
          '頻繁退貨會影響您的信用分數和會員權益，\n' +
          '如果是尺寸或款式的問題，\n' +
          '歡迎在購買前使用我們的 AI 尺寸推薦功能！\n\n' +
          '📏 AI 智慧選尺寸 — 幫您找到最合適的款式\n' +
          '💬 有任何疑問？歡迎聯繫客服\n\n' +
          '我們希望每一次購物都讓您滿意 ✨',
      },
      {
        stepOrder: 2,
        action: 'send_email',
        delayMinutes: 60,
        templateKey: 'consecutive_returns_email',
        content:
          '關於近期退貨紀錄\n\n' +
          '親愛的會員，我們發現您近期有多筆退貨。\n\n' +
          '為了幫助您選到最合適的商品，建議您：\n' +
          '1. 使用 AI 尺寸推薦功能\n' +
          '2. 參考商品頁面的真人試穿照\n' +
          '3. 購買前聯繫客服諮詢\n\n' +
          '溫馨提醒：連續退貨會影響信用分數，\n' +
          '影響部分會員權益的使用。',
      },
    ],
    priority: 3,
    maxExecutionsPerUser: 3,
    cooldownHours: 168, // 7 天
  },

  // ─── 14. 好客人表揚 ───
  {
    slug: 'good_customer',
    name: '好客人表揚',
    description: '信用分數達 95 以上的優良會員獎勵通知',
    isActive: true,
    triggerType: 'condition',
    triggerEvent: 'good_customer',
    conditions: { creditScore: { min: 95 } },
    steps: [
      {
        stepOrder: 1,
        action: 'send_line',
        delayMinutes: 0,
        templateKey: 'good_customer_line',
        content:
          '🌟 您是我們最棒的客人！\n\n' +
          '親愛的，恭喜您的信用分數達到卓越等級！\n\n' +
          '作為我們最重視的好客人，特別送上：\n' +
          '🎁 優良會員專屬 +10 點信用分數加分\n' +
          '🎫 好客人專屬優惠券\n' +
          '✨ 下次購物享額外點數加成\n\n' +
          '感謝您一直以來的支持與信賴！\n' +
          'CHIC KIM & MIU 因為有您而更美好 💕',
      },
      {
        stepOrder: 2,
        action: 'assign_coupon',
        delayMinutes: 0,
        templateKey: 'good_customer_coupon',
        content: '好客人專屬優惠券',
      },
      {
        stepOrder: 3,
        action: 'add_tag',
        delayMinutes: 0,
        templateKey: '',
        content: 'good_customer',
      },
    ],
    priority: 1,
    maxExecutionsPerUser: 0,
    cooldownHours: 720, // 30 天
  },
]
