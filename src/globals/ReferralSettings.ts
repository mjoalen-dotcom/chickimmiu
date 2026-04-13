import type { GlobalConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

/**
 * 推薦計畫設定 Global
 * ──────────────────
 * 推薦獎勵 + 防濫用機制，所有數字皆可從後台調整
 */
export const ReferralSettings: GlobalConfig = {
  slug: 'referral-settings',
  label: '推薦計畫設定',
  admin: {
    description: '推薦碼獎勵規則、等級加成、防濫用機制完整設定',
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  fields: [
    // ── 基本獎勵 ──
    {
      name: 'rewards',
      label: '推薦獎勵',
      type: 'group',
      fields: [
        { name: 'enabled', label: '啟用推薦計畫', type: 'checkbox', defaultValue: true },
        { name: 'referrerSignupReward', label: '推薦人獎勵（註冊成功）', type: 'number', defaultValue: 50, admin: { description: '購物金' } },
        { name: 'referrerPurchaseReward', label: '推薦人獎勵（首消 NT$500+）', type: 'number', defaultValue: 100, admin: { description: '購物金' } },
        { name: 'refereeSignupReward', label: '被推薦人獎勵（註冊）', type: 'number', defaultValue: 30, admin: { description: '購物金' } },
        { name: 'refereePurchaseReward', label: '被推薦人獎勵（首消）', type: 'number', defaultValue: 50, admin: { description: '購物金' } },
        { name: 'minPurchaseAmount', label: '首消最低金額門檻', type: 'number', defaultValue: 500 },
      ],
    },

    // ── 等級加成 ──
    {
      name: 'tierBonus',
      label: '等級加成',
      type: 'group',
      admin: { description: '推薦獎勵依會員等級自動加成' },
      fields: [
        { name: 'bronzeMultiplier', label: '銅牌倍率', type: 'number', defaultValue: 1.0 },
        { name: 'silverMultiplier', label: '銀牌倍率', type: 'number', defaultValue: 1.2 },
        { name: 'goldMultiplier', label: '金牌倍率', type: 'number', defaultValue: 1.5 },
        { name: 'platinumMultiplier', label: '白金倍率', type: 'number', defaultValue: 1.8 },
        { name: 'diamondMultiplier', label: '鑽石倍率', type: 'number', defaultValue: 2.0 },
        { name: 'subscriberBonus', label: '訂閱會員額外加成', type: 'number', defaultValue: 20, admin: { description: '訂閱會員每次推薦額外購物金' } },
      ],
    },

    // ── 推薦連結設定 ──
    {
      name: 'linkSettings',
      label: '推薦連結',
      type: 'group',
      fields: [
        { name: 'cookieExpiryDays', label: 'Cookie 有效天數', type: 'number', defaultValue: 30 },
        { name: 'linkPrefix', label: '連結前綴', type: 'text', defaultValue: '/ref/' },
      ],
    },

    // ── 防濫用機制 ──
    {
      name: 'antiAbuse',
      label: '防濫用機制',
      type: 'group',
      admin: { description: '防止自推、多帳號、假帳號等濫用行為' },
      fields: [
        { name: 'selfReferralBlock', label: '封鎖自推（相同 IP/裝置）', type: 'checkbox', defaultValue: true },
        { name: 'sameIPLimit', label: '同 IP 推薦上限', type: 'number', defaultValue: 3, admin: { description: '同一 IP 最多被推薦幾次' } },
        { name: 'deviceFingerprintEnabled', label: '啟用裝置指紋偵測', type: 'checkbox', defaultValue: true },
        { name: 'sameDeviceLimit', label: '同裝置推薦上限', type: 'number', defaultValue: 2 },
        { name: 'emailVerificationRequired', label: '需 Email 驗證才發獎勵', type: 'checkbox', defaultValue: true },
        { name: 'phoneVerificationRequired', label: '需手機驗證才發獎勵', type: 'checkbox', defaultValue: false },
        { name: 'cooldownHours', label: '冷卻期（小時）', type: 'number', defaultValue: 24, admin: { description: '註冊後需等待多久才能進行推薦' } },
        { name: 'minOrderAmount', label: '最低消費門檻', type: 'number', defaultValue: 500, admin: { description: '被推薦人首消需達此金額才觸發獎勵' } },
        { name: 'monthlyReferralLimit', label: '每月推薦上限', type: 'number', defaultValue: 50, admin: { description: '每位會員每月最多推薦幾人' } },
        { name: 'autoLockThreshold', label: '異常行為自動鎖定門檻', type: 'number', defaultValue: 10, admin: { description: '短時間內推薦超過此數量自動鎖定' } },
        { name: 'autoLockWindowHours', label: '異常偵測時間窗口（小時）', type: 'number', defaultValue: 1 },
        { name: 'manualReviewEnabled', label: '啟用人工審核佇列', type: 'checkbox', defaultValue: true, admin: { description: '達到門檻的推薦需人工審核才發獎勵' } },
        { name: 'manualReviewThreshold', label: '人工審核門檻（累計推薦數）', type: 'number', defaultValue: 20 },
        { name: 'clawbackOnReturn', label: '退貨/取消時自動扣回獎勵', type: 'checkbox', defaultValue: true },
        { name: 'clawbackWindowDays', label: '扣回有效期限（天）', type: 'number', defaultValue: 30 },
      ],
    },

    // ── 黑名單 ──
    {
      name: 'blacklist',
      label: '黑名單',
      type: 'group',
      fields: [
        { name: 'blockedEmails', label: '封鎖 Email 清單', type: 'textarea', admin: { description: '每行一個 email 或 domain（例如：@tempmail.com）' } },
        { name: 'blockedIPs', label: '封鎖 IP 清單', type: 'textarea', admin: { description: '每行一個 IP 位址' } },
      ],
    },
  ],
}
