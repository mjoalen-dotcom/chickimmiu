import type { GlobalConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'
import { revalidateLayout } from '../lib/revalidate'

/**
 * PromotionSettings — Campaign Engine 全域開關（CHIC Commerce OS P0）
 *
 * 三層 kill switch 的最上層：這裡 killSwitch=true → 整個促銷引擎立即停用
 * （前台版位消失、quote 不套任何 campaign 折扣）。
 * 單一活動的開關在 marketing-campaigns.commerce.killSwitch；單一規則用 status=disabled。
 */
export const PromotionSettings: GlobalConfig = {
  slug: 'promotion-settings',
  label: '促銷引擎設定',
  admin: {
    group: '④ 行銷推廣',
    description: 'Campaign Engine 全域開關與護欄預設值',
  },
  access: { read: () => true, update: isAdmin },
  hooks: {
    afterChange: [
      async () => {
        revalidateLayout()
      },
    ],
  },
  fields: [
    {
      name: 'killSwitch',
      label: '🚨 全引擎緊急停止',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: '勾選後所有活動促銷立即停用（前台版位消失、報價不套活動折扣）。單一活動請用該活動的商務設定。',
      },
    },
    {
      name: 'storefrontEnabled',
      label: '前台活動版位顯示',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: '倒數 / 購物車進度 / 商品 badge 的總開關。預設關閉，活動核准後再開。',
      },
    },
    {
      name: 'serverPricingEnforcement',
      label: '伺服器計價強制（安全防線）',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description:
          '⚠️ 開啟時建單一律由伺服器重算金額並擋掉不一致的訂單（防竄改）。關閉 = 回到舊行為（信任 client 金額），僅限緊急回退使用。',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'quoteTtlSeconds',
          label: '報價有效秒數',
          type: 'number',
          defaultValue: 300,
          min: 60,
          admin: { description: '前台 quote 的 expiresAt；過期需重新報價' },
        },
        {
          name: 'defaultMarginFloorPct',
          label: '預設最低毛利率 %',
          type: 'number',
          min: 0,
          max: 100,
          admin: { description: '規則未填毛利底線時的預設值；留空 = 不強制' },
        },
      ],
    },
  ],
}
