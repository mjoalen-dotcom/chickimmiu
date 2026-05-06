import type { GlobalConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

/**
 * CRM 系統設定 Global
 * ─────────────────────────
 * 控制信用分數演算法參數、自動化規則、AI 客服設定
 * 所有權重與門檻皆可從後台即時調整，無需重新部署
 *
 * ⚠️ 前台稱號與後台分級碼完全分離
 *    前台只顯示：優雅初遇者 / 曦漾仙子 / 優漾女神 / 金曦女王 / 星耀皇后 / 璀璨天后
 */
export const CRMSettings: GlobalConfig = {
  slug: 'crm-settings',
  label: 'CRM 系統設定',
  admin: {
    group: '③ 會員與 CRM',
    description: '信用分數權重、自動化規則、AI 客服、通知模板完整設定',
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  fields: [
    // ═══════════════════════════════════════
    // ── 信用分數加分權重 ──
    // ═══════════════════════════════════════
    {
      name: 'creditRewards',
      label: '信用分數 — 加分項目',
      type: 'group',
      admin: { description: '所有加分權重可即時調整' },
      fields: [
        { name: 'firstRegister', label: '首次註冊', type: 'number', defaultValue: 10 },
        { name: 'firstPurchase', label: '首購', type: 'number', defaultValue: 15 },
        { name: 'normalPurchase', label: '正常購買', type: 'number', defaultValue: 8 },
        { name: 'purchaseAmountBonusPer1000', label: '每消費 NT$1000 額外加分', type: 'number', defaultValue: 2, admin: { description: '上限 +10' } },
        { name: 'purchaseAmountBonusMax', label: '消費額外加分上限', type: 'number', defaultValue: 10 },
        { name: 'onTimeDelivery', label: '準時收貨', type: 'number', defaultValue: 5 },
        { name: 'goodReview', label: '好評', type: 'number', defaultValue: 10 },
        { name: 'photoReview', label: '好評附圖', type: 'number', defaultValue: 12 },
        { name: 'referralSuccess', label: '推薦成功', type: 'number', defaultValue: 18 },
        { name: 'birthdayBonus', label: '生日月', type: 'number', defaultValue: 10 },
        { name: 'subscriberMonthly', label: '訂閱會員每月加分', type: 'number', defaultValue: 5 },
        { name: 'goodCustomerReward', label: '好客人表揚（≥95分）', type: 'number', defaultValue: 10 },
      ],
    },

    // ═══════════════════════════════════════
    // ── 信用分數扣分權重 ──
    // ═══════════════════════════════════════
    {
      name: 'creditPenalties',
      label: '信用分數 — 扣分項目',
      type: 'group',
      admin: { description: '⚠️ 扣分值請填正數，系統會自動取負' },
      fields: [
        { name: 'returnGeneralMin', label: '一般退貨 — 最低扣分', type: 'number', defaultValue: 8 },
        { name: 'returnGeneralMax', label: '一般退貨 — 最高扣分', type: 'number', defaultValue: 15 },
        { name: 'returnNoReason', label: '無理由退貨', type: 'number', defaultValue: 25 },
        { name: 'returnNoReasonConsecutive2', label: '連續第 2 次無理由退貨', type: 'number', defaultValue: 35 },
        { name: 'returnNoReasonConsecutive3Plus', label: '連續第 3 次以上無理由退貨', type: 'number', defaultValue: 50 },
        { name: 'returnRatePenalty', label: '高退貨率額外扣分', type: 'number', defaultValue: 15, admin: { description: '30 天內退貨率 > 40% 額外扣分' } },
        { name: 'returnRateThreshold', label: '高退貨率門檻（%）', type: 'number', defaultValue: 40 },
        { name: 'returnRateWindowDays', label: '退貨率計算窗口（天）', type: 'number', defaultValue: 30 },
        { name: 'abandonedCart', label: '棄單', type: 'number', defaultValue: 6 },
        { name: 'maliciousCancel', label: '惡意取消', type: 'number', defaultValue: 20 },
      ],
    },

    // ═══════════════════════════════════════
    // ── 信用分數門檻 ──
    // ═══════════════════════════════════════
    {
      name: 'creditThresholds',
      label: '信用分數 — 區間門檻',
      type: 'group',
      admin: { description: '各區間的分數門檻與對應後果' },
      fields: [
        { name: 'excellentMin', label: '優質好客人 — 最低分', type: 'number', defaultValue: 90, admin: { description: '90~100：最高優惠、優先客服' } },
        { name: 'normalMin', label: '一般 — 最低分', type: 'number', defaultValue: 70, admin: { description: '70~89：正常會員權益' } },
        { name: 'watchlistMin', label: '觀察名單 — 最低分', type: 'number', defaultValue: 50, admin: { description: '50~69：減少優惠、觀察中' } },
        { name: 'warningMin', label: '警示名單 — 最低分', type: 'number', defaultValue: 30, admin: { description: '30~49：禁止抽獎、減少推薦' } },
        { name: 'blacklistMin', label: '黑名單 — 最低分', type: 'number', defaultValue: 10, admin: { description: '10~29：無任何優惠、點數、抽獎' } },
        { name: 'suspendedBelow', label: '停權 — 低於此分數', type: 'number', defaultValue: 10, admin: { description: '0~9：無法下單' } },
      ],
    },

    // ═══════════════════════════════════════
    // ── 信用分數通知模板 ──
    // ═══════════════════════════════════════
    {
      name: 'creditNotifications',
      label: '信用分數 — 通知訊息模板',
      type: 'group',
      admin: { description: '扣分與狀態變更時的通知訊息' },
      fields: [
        { name: 'positiveMessage', label: '加分訊息', type: 'textarea', defaultValue: '太棒了！感謝您的支持，您的信用分數已提升 🌟' },
        { name: 'mildDeductMessage', label: '輕微扣分訊息', type: 'textarea', defaultValue: '您是我們重視的好客人，請繼續保持喔～' },
        { name: 'seriousDeductMessage', label: '嚴重扣分訊息', type: 'textarea', defaultValue: '溫馨提醒：頻繁退貨會影響您的會員權益，如有任何問題歡迎聯繫客服 💝' },
        { name: 'watchlistMessage', label: '進入觀察名單訊息', type: 'textarea', defaultValue: '您的信用分數目前低於標準，部分優惠將暫時受限。我們相信您能很快恢復！💪' },
        { name: 'blacklistMessage', label: '黑名單警告訊息', type: 'textarea', defaultValue: '您的信用分數較低，部分會員優惠將暫時受限。歡迎透過購物提升分數！' },
        { name: 'goodCustomerMessage', label: '好客人表揚訊息', type: 'textarea', defaultValue: '恭喜您！您是我們最珍貴的好客人 ✨ 感謝您一直以來的支持與信賴！' },
      ],
    },

    // ═══════════════════════════════════════
    // ── AI 客服設定 ──
    // ═══════════════════════════════════════
    {
      name: 'aiCustomerService',
      label: 'AI 客服設定',
      type: 'group',
      fields: [
        { name: 'enabled', label: '啟用 AI 客服', type: 'checkbox', defaultValue: true },
        { name: 'greetingMessage', label: '歡迎訊息', type: 'textarea', defaultValue: '您好！我是 CHIC KIM & MIU 的智能客服助手 ✨ 請問有什麼我可以幫您的嗎？' },
        { name: 'maxAIRounds', label: 'AI 最多回覆次數', type: 'number', defaultValue: 5, admin: { description: '超過此次數自動轉接真人客服' } },
        { name: 'escalateOnNegativeSentiment', label: '偵測到負面情緒自動轉接', type: 'checkbox', defaultValue: true },
        { name: 'escalateHighVIP', label: 'T4/T5 自動轉接真人', type: 'checkbox', defaultValue: true },
        { name: 'escalateOnCreditComplaint', label: '信用分數相關客訴轉接', type: 'checkbox', defaultValue: true },
        { name: 'humanAgentNotifyEmail', label: '真人客服通知 Email', type: 'email' },
        { name: 'humanAgentNotifyLine', label: '真人客服通知 LINE ID', type: 'text' },
      ],
    },

    // ═══════════════════════════════════════
    // ── 自動化流程設定 ──
    // ═══════════════════════════════════════
    {
      name: 'automationConfig',
      label: '自動化流程設定',
      type: 'group',
      fields: [
        { name: 'enabled', label: '啟用自動化流程', type: 'checkbox', defaultValue: true },
        { name: 'maxJourneysPerDay', label: '每位會員每日最多觸發 Journey 數', type: 'number', defaultValue: 3 },
        { name: 'quietHoursStart', label: '免打擾開始時間', type: 'number', defaultValue: 22, admin: { description: '24 小時制，例如 22 表示晚上 10 點' } },
        { name: 'quietHoursEnd', label: '免打擾結束時間', type: 'number', defaultValue: 8, admin: { description: '24 小時制，例如 8 表示早上 8 點' } },
        { name: 'defaultCooldownHours', label: '預設冷卻時間（小時）', type: 'number', defaultValue: 24 },
        { name: 'cartAbandonDelays', label: '棄單提醒時間點', type: 'group', fields: [
          { name: 'firstReminder', label: '第一次（分鐘）', type: 'number', defaultValue: 60 },
          { name: 'secondReminder', label: '第二次（分鐘）', type: 'number', defaultValue: 1440 },
          { name: 'thirdReminder', label: '第三次（分鐘）', type: 'number', defaultValue: 4320 },
        ]},
        { name: 'dormantDays', label: '沉睡喚回天數設定', type: 'group', fields: [
          { name: 'firstWakeup', label: '第一次（天）', type: 'number', defaultValue: 30 },
          { name: 'secondWakeup', label: '第二次（天）', type: 'number', defaultValue: 45 },
          { name: 'thirdWakeup', label: '第三次（天）', type: 'number', defaultValue: 60 },
        ]},
      ],
    },

    // ═══════════════════════════════════════
    // ── LINE / Email 通知設定 ──
    // ═══════════════════════════════════════
    {
      name: 'notificationChannels',
      label: 'LINE / Email 通知設定',
      type: 'group',
      fields: [
        { name: 'lineEnabled', label: '啟用 LINE 推播', type: 'checkbox', defaultValue: true },
        { name: 'lineChannelAccessToken', label: 'LINE Channel Access Token', type: 'text', admin: { description: 'LINE Messaging API Token' } },
        { name: 'emailEnabled', label: '啟用 Email 通知', type: 'checkbox', defaultValue: true },
        { name: 'emailFromName', label: '寄件人名稱', type: 'text', defaultValue: 'CHIC KIM & MIU' },
        { name: 'emailFromAddress', label: '寄件人 Email', type: 'email', defaultValue: 'hello@chickimmiu.com' },
        { name: 'smsEnabled', label: '啟用 SMS 通知', type: 'checkbox', defaultValue: false },
      ],
    },

    // ═══════════════════════════════════════
    // ── Dashboard KPI 設定 ──
    // ═══════════════════════════════════════
    {
      name: 'dashboardConfig',
      label: 'CRM Dashboard 設定',
      type: 'group',
      fields: [
        { name: 'refreshIntervalSeconds', label: '自動刷新間隔（秒）', type: 'number', defaultValue: 300 },
        { name: 'alertCreditScoreBelow', label: '信用分數低於此值發送管理員警報', type: 'number', defaultValue: 30 },
        { name: 'alertConsecutiveReturns', label: '連續退貨 N 次發送警報', type: 'number', defaultValue: 3 },
        { name: 'showReturnCorrelation', label: '顯示退貨率與扣分關聯圖', type: 'checkbox', defaultValue: true },
        { name: 'showCreditDistribution', label: '顯示信用分數分佈圖', type: 'checkbox', defaultValue: true },
      ],
    },
  ],
}
