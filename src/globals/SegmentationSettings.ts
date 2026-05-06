import type { GlobalConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

/**
 * 會員分群設定 Global
 * ─────────────────────────
 * 控制分群演算法權重、門檻與排程設定
 * 所有權重與門檻皆可從後台即時調整，無需重新部署
 */
export const SegmentationSettings: GlobalConfig = {
  slug: 'segmentation-settings',
  label: '會員分群設定',
  admin: {
    group: '③ 會員與 CRM',
    description:
      '【設定】分群演算法權重、判定門檻、每日排程時間。此處改動後，下一次排程會以新參數重算所有會員並寫入「會員分群紀錄」collection。',
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  fields: [
    // ═══════════════════════════════════════
    // ── 分群權重 ──
    // ═══════════════════════════════════════
    {
      name: 'weights',
      label: '綜合分數權重（%）',
      type: 'group',
      admin: { description: '五項權重加總須為 100%' },
      fields: [
        { name: 'rfmWeight', label: 'RFM 分數權重', type: 'number', defaultValue: 40, min: 0, max: 100, admin: { description: '預設 40%' } },
        { name: 'creditWeight', label: '信用分數權重', type: 'number', defaultValue: 25, min: 0, max: 100, admin: { description: '預設 25%' } },
        { name: 'ltvChurnWeight', label: 'LTV + 流失預測權重', type: 'number', defaultValue: 15, min: 0, max: 100, admin: { description: '預設 15%' } },
        { name: 'behaviorWeight', label: '行為偏好權重', type: 'number', defaultValue: 10, min: 0, max: 100, admin: { description: '預設 10%' } },
        { name: 'tierWeight', label: '等級 + 訂閱權重', type: 'number', defaultValue: 10, min: 0, max: 100, admin: { description: '預設 10%' } },
      ],
    },

    // ═══════════════════════════════════════
    // ── 分群門檻 ──
    // ═══════════════════════════════════════
    {
      name: 'segmentThresholds',
      label: '分群判定門檻',
      type: 'group',
      admin: { description: '各分群的判定條件，由高優先到低優先' },
      fields: [
        // BLK1
        { name: 'blk1CreditThreshold', label: 'BLK1 — 信用分數低於', type: 'number', defaultValue: 30, admin: { description: '信用分數 < 此值 → 高風險警示客' } },
        // RISK2
        { name: 'risk2CreditThreshold', label: 'RISK2 — 信用分數低於', type: 'number', defaultValue: 50, admin: { description: '信用分數 < 此值 且退貨率高 → 退貨觀察客' } },
        { name: 'risk2ReturnRateThreshold', label: 'RISK2 — 退貨率高於（%）', type: 'number', defaultValue: 25, admin: { description: '退貨率 > 此值 → 退貨觀察客' } },
        // VIP1
        { name: 'vip1MinScore', label: 'VIP1 — 最低綜合分數', type: 'number', defaultValue: 85 },
        { name: 'vip1MinCredit', label: 'VIP1 — 最低信用分數', type: 'number', defaultValue: 90 },
        // VIP2
        { name: 'vip2MinScore', label: 'VIP2 — 最低綜合分數', type: 'number', defaultValue: 70 },
        { name: 'vip2MinCredit', label: 'VIP2 — 最低信用分數', type: 'number', defaultValue: 80 },
        // RISK1
        { name: 'risk1ChurnThreshold', label: 'RISK1 — 流失分數門檻', type: 'number', defaultValue: 70, admin: { description: '流失分數 >= 此值 → 流失高風險客' } },
        { name: 'risk1DaysThreshold', label: 'RISK1 — 未購天數門檻', type: 'number', defaultValue: 45, admin: { description: '距上次購買 > 此天數 → 流失高風險客' } },
        // SLP1
        { name: 'slp1DaysThreshold', label: 'SLP1 — 沉睡天數門檻', type: 'number', defaultValue: 60, admin: { description: '距上次購買 > 此天數 → 沉睡復活客' } },
        // NEW1
        { name: 'newMaxAge', label: 'NEW1 — 帳齡上限（天）', type: 'number', defaultValue: 30, admin: { description: '帳齡 < 此天數 且訂單 <= 1 → 優雅初遇新客' } },
        // POT1
        { name: 'pot1MinScore', label: 'POT1 — 最低綜合分數', type: 'number', defaultValue: 55 },
        { name: 'pot1MaxAge', label: 'POT1 — 帳齡上限（天）', type: 'number', defaultValue: 90 },
        { name: 'pot1MinCredit', label: 'POT1 — 最低信用分數', type: 'number', defaultValue: 75 },
        // REG2
        { name: 'reg2MedianThreshold', label: 'REG2 — 客單價中位數門檻（TWD）', type: 'number', defaultValue: 1500, admin: { description: '客單價 < 此值 且購買 >= 3 次 → 價格敏感優雅客' } },
      ],
    },

    // ═══════════════════════════════════════
    // ── 排程設定 ──
    // ═══════════════════════════════════════
    {
      name: 'cronSchedule',
      label: '每日排程設定',
      type: 'group',
      fields: [
        { name: 'enabled', label: '啟用每日自動分群', type: 'checkbox', defaultValue: true },
        { name: 'runAtHour', label: '執行時間（時）', type: 'number', defaultValue: 3, min: 0, max: 23, admin: { description: '每天凌晨3點執行' } },
        { name: 'notifyOnComplete', label: '完成後通知管理員', type: 'checkbox', defaultValue: true },
      ],
    },

    // ═══════════════════════════════════════
    // ── 分群色碼 ──
    // ═══════════════════════════════════════
    {
      name: 'segmentColors',
      label: '分群色碼對照',
      type: 'array',
      admin: { description: '10 大分群的代碼、前台名稱、色碼' },
      defaultValue: [
        { code: 'VIP1', label: '璀璨忠誠女王', color: '#9B59B6' },
        { code: 'VIP2', label: '金曦風格領袖', color: '#F1C40F' },
        { code: 'POT1', label: '潛力優雅新星', color: '#3498DB' },
        { code: 'REG1', label: '穩定優雅會員', color: '#2ECC71' },
        { code: 'REG2', label: '價格敏感優雅客', color: '#1ABC9C' },
        { code: 'RISK1', label: '流失高風險客', color: '#E67E22' },
        { code: 'RISK2', label: '退貨觀察客', color: '#E74C3C' },
        { code: 'NEW1', label: '優雅初遇新客', color: '#00BCD4' },
        { code: 'SLP1', label: '沉睡復活客', color: '#95A5A6' },
        { code: 'BLK1', label: '高風險警示客', color: '#34495E' },
      ],
      fields: [
        { name: 'code', label: '分群代碼', type: 'text' },
        { name: 'label', label: '前台名稱', type: 'text' },
        { name: 'color', label: '色碼', type: 'text' },
      ],
    },
  ],
}
