import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

/**
 * PromotionRules — 版本化促銷規則（CHIC Commerce OS P0-B）
 *
 * - 隸屬 marketing-campaigns（活動 Root）；一條規則 = 一個受限 DSL 實例。
 * - `active` 後 DSL 欄位不可原地修改（beforeChange 擋）；要改 → 新建 doc、version+1、
 *   舊的轉 `disabled`。訂單上永遠保留當時的規則快照（promotion-applications /
 *   orders.promotion.appliedPromotionSnapshots），所以歷史訂單不受後續版本影響。
 * - 後台欄位是「授權 UI」，evaluator 吃的是 `buildRuleSnapshot()`（src/lib/promotions/
 *   snapshots.ts）轉出的 snapshot；條件/效果都是受限型別，不存在任意程式碼。
 * - 排程沿用所屬活動的 schedule.startDate/endDate（單一 source of truth，不另存）。
 */
export const PromotionRules: CollectionConfig = {
  slug: 'promotion-rules',
  labels: { singular: '促銷規則', plural: '促銷規則' },
  admin: {
    group: '④ 行銷推廣',
    useAsTitle: 'name',
    defaultColumns: ['name', 'campaign', 'effect_effectType', 'status', 'version', 'priority'],
    listSearchableFields: ['name', 'slug'],
    description: '活動的版本化促銷規則：active 後鎖定，要調整請停用舊版並建立新版本',
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data) return data
        // slug 正規化（ruleKey 組成元素：campaignId:slug:vN）
        if (typeof data.slug === 'string') {
          data.slug = data.slug
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, '-')
            .replace(/^-+|-+$/g, '')
        }
        const effect = (data.effect ?? {}) as Record<string, unknown>
        const type = effect.effectType as string | undefined
        const pct = effect.percentOff as number | undefined
        if (
          (type === 'percent_discount_per_group' ||
            type === 'percent_discount_nth_unit' ||
            type === 'order_percent_discount') &&
          (pct == null || pct <= 0 || pct > 100)
        ) {
          throw new Error('percentOff 必須在 1–100 之間（8 折 = 20）')
        }
        if (
          (type === 'fixed_discount_per_group' || type === 'order_fixed_discount') &&
          (typeof effect.amount !== 'number' || (effect.amount as number) <= 0)
        ) {
          throw new Error('折扣金額必須大於 0')
        }
        if (
          (type === 'fixed_discount_per_group' ||
            type === 'percent_discount_per_group' ||
            type === 'percent_discount_nth_unit') &&
          (typeof effect.groupSize !== 'number' || (effect.groupSize as number) < 1)
        ) {
          throw new Error('groupSize 必須 ≥ 1')
        }
        if (type === 'gift_item' && !effect.giftProduct) {
          throw new Error('gift_item 必須指定贈品商品')
        }
        return data
      },
    ],
    beforeChange: [
      ({ data, originalDoc, operation }) => {
        // active 規則不可原地改 DSL：只允許 status 轉換（active → disabled）與 adminNote
        if (operation === 'update' && originalDoc?.status === 'active') {
          const lockedKeys = [
            'slug',
            'campaign',
            'version',
            'benefitClass',
            'priority',
            'scope',
            'conditions',
            'effect',
            'stacking',
            'guardrails',
          ] as const
          for (const key of lockedKeys) {
            if (key in (data ?? {}) && JSON.stringify(data?.[key]) !== JSON.stringify(originalDoc?.[key])) {
              throw new Error(
                `active 規則不可修改「${key}」— 請將本規則停用（disabled）後另建新版本（version ${((originalDoc?.version as number) ?? 1) + 1}）`,
              )
            }
          }
        }
        return data
      },
    ],
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'name', label: '規則名稱', type: 'text', required: true },
        {
          name: 'slug',
          label: '規則代碼',
          type: 'text',
          required: true,
          admin: { description: '英數與連字號；與活動+版本組成唯一 ruleKey' },
        },
      ],
    },
    {
      name: 'campaign',
      label: '所屬活動',
      type: 'relationship',
      relationTo: 'marketing-campaigns',
      required: true,
      index: true,
      admin: { description: '排程/預算/客群沿用活動設定；本規則只定義條件與優惠' },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'status',
          label: '狀態',
          type: 'select',
          required: true,
          defaultValue: 'draft',
          index: true,
          options: [
            { label: '草稿', value: 'draft' },
            { label: '啟用', value: 'active' },
            { label: '停用', value: 'disabled' },
          ],
        },
        {
          name: 'version',
          label: '版本',
          type: 'number',
          required: true,
          defaultValue: 1,
          min: 1,
          admin: { description: 'active 後不可改；調整規則請另建新版本' },
        },
        {
          name: 'benefitClass',
          label: '利益類別',
          type: 'select',
          required: true,
          defaultValue: 'item_promo',
          options: [
            { label: '商品促銷（任N件/第N件）', value: 'item_promo' },
            { label: '訂單促銷（滿額）', value: 'order_promo' },
            { label: '運費', value: 'shipping' },
          ],
        },
        {
          name: 'priority',
          label: '優先序',
          type: 'number',
          required: true,
          defaultValue: 100,
          admin: { description: '同類別中數字小者先評估' },
        },
      ],
    },
    {
      name: 'scope',
      label: '商品範圍',
      type: 'group',
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'includeCategories',
              label: '包含分類',
              type: 'relationship',
              relationTo: 'categories',
              hasMany: true,
            },
            {
              name: 'excludeCategories',
              label: '排除分類',
              type: 'relationship',
              relationTo: 'categories',
              hasMany: true,
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'includeProducts',
              label: '包含商品',
              type: 'relationship',
              relationTo: 'products',
              hasMany: true,
              admin: { description: '包含條件皆空 = 全店商品參與' },
            },
            {
              name: 'excludeProducts',
              label: '排除商品',
              type: 'relationship',
              relationTo: 'products',
              hasMany: true,
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'includeTags',
              label: '包含標籤',
              type: 'array',
              fields: [{ name: 'tag', type: 'text', required: true }],
            },
            {
              name: 'excludeTags',
              label: '排除標籤',
              type: 'array',
              admin: { description: '例：final-sale（最終折扣品不參加活動）' },
              fields: [{ name: 'tag', type: 'text', required: true }],
            },
          ],
        },
      ],
    },
    {
      name: 'conditions',
      label: '觸發條件',
      type: 'group',
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'minQuantity', label: '最少件數（範圍內）', type: 'number', min: 1 },
            { name: 'minEligibleSubtotal', label: '範圍內滿額（NT$）', type: 'number', min: 1 },
            { name: 'minOrderSubtotal', label: '全單滿額（NT$）', type: 'number', min: 1 },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'tiersIn',
              label: '限會員等級',
              type: 'relationship',
              relationTo: 'membership-tiers',
              hasMany: true,
            },
            {
              name: 'segmentsNotIn',
              label: '排除分群',
              type: 'select',
              hasMany: true,
              options: ['VIP1', 'VIP2', 'POT1', 'REG1', 'REG2', 'RISK1', 'RISK2', 'NEW1', 'SLP1', 'BLK1'],
              admin: { description: '預設建議排除 BLK1（黑名單）' },
            },
            {
              name: 'segmentsIn',
              label: '限定分群',
              type: 'select',
              hasMany: true,
              options: ['VIP1', 'VIP2', 'POT1', 'REG1', 'REG2', 'RISK1', 'RISK2', 'NEW1', 'SLP1', 'BLK1'],
              admin: {
                description:
                  '空 = 不限。只有列在這裡的分群才吃得到這條規則；沉睡召回選 SLP1。與「排除分群」可並用（先排除再限定）。',
              },
            },
          ],
        },
        {
          name: 'requireAllProducts',
          label: '必須同時購買（買 A + B）',
          type: 'relationship',
          relationTo: 'products',
          hasMany: true,
          admin: {
            description:
              '空 = 不限。設了就必須「每一件」都在購物車裡才成立。注意這是 AND，跟上面「適用範圍」的 include 清單（OR）不同——只用 include 列 A、B 的話，買 2 件 A 也會過。列在這裡的商品也必須落在適用範圍內，否則永遠湊不齊。',
          },
        },
        {
          type: 'row',
          fields: [
            { name: 'membersOnly', label: '限登入會員', type: 'checkbox', defaultValue: false },
            { name: 'firstPurchaseOnly', label: '限首購', type: 'checkbox', defaultValue: false },
            {
              name: 'repeatPurchaseOnly',
              label: '限回購',
              type: 'checkbox',
              defaultValue: false,
              admin: { description: '已有成立訂單的會員才吃得到（與「限首購」互斥，勿同時勾）' },
            },
            {
              name: 'birthdayMonthOnly',
              label: '限生日月',
              type: 'checkbox',
              defaultValue: false,
              admin: { description: '會員生日月份 == 下單當月（台北時區）。未填生日的會員不成立。' },
            },
            {
              name: 'channels',
              label: '限通路',
              type: 'select',
              hasMany: true,
              options: [
                { label: '網站', value: 'web' },
                { label: 'App', value: 'app' },
                { label: 'LINE', value: 'line' },
              ],
              admin: { description: '空 = 不限' },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'referralRequired',
              label: '限推薦連結進來（KOL / 分潤）',
              type: 'checkbox',
              defaultValue: false,
              admin: { description: '需帶 ?ref= 推薦碼（存 30 天 cookie，伺服器端讀取，不信任前端）' },
            },
            {
              name: 'referralCodesIn',
              label: '限定推薦碼',
              type: 'array',
              admin: {
                description: '空 = 任何推薦碼皆可（需勾左邊）。填了就只有這些碼吃得到，大小寫不敏感。',
                condition: (_d, sibling) =>
                  Boolean((sibling as Record<string, unknown> | undefined)?.referralRequired),
              },
              fields: [{ name: 'code', label: '推薦碼', type: 'text', required: true }],
            },
          ],
        },
      ],
    },
    {
      name: 'effect',
      label: '優惠效果',
      type: 'group',
      fields: [
        {
          name: 'effectType',
          label: '效果類型',
          type: 'select',
          required: true,
          defaultValue: 'fixed_discount_per_group',
          options: [
            { label: '任選 N 件現折 X 元', value: 'fixed_discount_per_group' },
            { label: '任選 N 件打 X 折', value: 'percent_discount_per_group' },
            { label: '第 N 件折（折最便宜那件）', value: 'percent_discount_nth_unit' },
            { label: '滿額現折', value: 'order_fixed_discount' },
            { label: '滿額打折', value: 'order_percent_discount' },
            { label: '免運', value: 'free_shipping' },
            { label: '滿額贈品', value: 'gift_item' },
            { label: '點數倍率', value: 'points_multiplier' },
            { label: '發放獎勵（XP/鑰匙等）', value: 'grant_reward' },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'groupSize',
              label: '湊組件數 N',
              type: 'number',
              min: 1,
              defaultValue: 2,
              admin: {
                condition: (_, siblingData) =>
                  ['fixed_discount_per_group', 'percent_discount_per_group', 'percent_discount_nth_unit'].includes(
                    String(siblingData?.effectType),
                  ),
              },
            },
            {
              name: 'amount',
              label: '折扣金額（NT$）',
              type: 'number',
              min: 1,
              admin: {
                condition: (_, siblingData) =>
                  ['fixed_discount_per_group', 'order_fixed_discount'].includes(String(siblingData?.effectType)),
              },
            },
            {
              name: 'percentOff',
              label: '折抵 %（8 折填 20）',
              type: 'number',
              min: 1,
              max: 100,
              admin: {
                condition: (_, siblingData) =>
                  ['percent_discount_per_group', 'percent_discount_nth_unit', 'order_percent_discount'].includes(
                    String(siblingData?.effectType),
                  ),
              },
            },
            {
              name: 'maxAmount',
              label: '折抵上限（NT$）',
              type: 'number',
              min: 1,
              admin: {
                condition: (_, siblingData) => String(siblingData?.effectType) === 'order_percent_discount',
              },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'repeatMode',
              label: '重複模式',
              type: 'select',
              defaultValue: 'once_per_order',
              options: [
                { label: '每單一次', value: 'once_per_order' },
                { label: '每滿 N 件重複折', value: 'every_full_group' },
              ],
              admin: {
                condition: (_, siblingData) =>
                  ['fixed_discount_per_group', 'percent_discount_per_group', 'percent_discount_nth_unit'].includes(
                    String(siblingData?.effectType),
                  ),
              },
            },
            {
              name: 'unitSelection',
              label: '湊組取件',
              type: 'select',
              defaultValue: 'cheapest_first',
              options: [
                { label: '先取最便宜（商家有利）', value: 'cheapest_first' },
                { label: '先取最貴（客人有利）', value: 'most_expensive_first' },
              ],
              admin: {
                condition: (_, siblingData) => String(siblingData?.effectType) === 'percent_discount_per_group',
              },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'giftProduct',
              label: '贈品商品',
              type: 'relationship',
              relationTo: 'products',
              admin: {
                condition: (_, siblingData) => String(siblingData?.effectType) === 'gift_item',
              },
            },
            {
              name: 'giftQuantity',
              label: '贈品數量',
              type: 'number',
              min: 1,
              defaultValue: 1,
              admin: {
                condition: (_, siblingData) => String(siblingData?.effectType) === 'gift_item',
              },
            },
            {
              name: 'multiplier',
              label: '點數倍率',
              type: 'number',
              min: 1,
              admin: {
                condition: (_, siblingData) => String(siblingData?.effectType) === 'points_multiplier',
              },
            },
            {
              name: 'rewardKey',
              label: '獎勵代碼',
              type: 'text',
              admin: {
                description: '例：mystery-key；實際發放由 P1 Member Economy 落地',
                condition: (_, siblingData) => String(siblingData?.effectType) === 'grant_reward',
              },
            },
          ],
        },
      ],
    },
    {
      name: 'stacking',
      label: '疊加設定',
      type: 'group',
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'exclusiveGroup',
              label: '互斥群組',
              type: 'text',
              admin: { description: '同群組只會套用優先序最前的一條（跨活動亦互斥）' },
            },
            {
              name: 'maxBenefitPerOrder',
              label: '單筆最高折抵（NT$）',
              type: 'number',
              min: 1,
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'stackableWithAll',
              label: '可與所有類別疊加',
              type: 'checkbox',
              defaultValue: true,
            },
            {
              name: 'stackableWith',
              label: '僅可與這些類別疊加',
              type: 'select',
              hasMany: true,
              options: [
                { label: '商品促銷', value: 'item_promo' },
                { label: '訂單促銷', value: 'order_promo' },
                { label: '運費', value: 'shipping' },
                { label: '優惠券', value: 'coupon' },
                { label: '會員權益', value: 'member_tier' },
              ],
              admin: {
                condition: (_, siblingData) => !siblingData?.stackableWithAll,
              },
            },
          ],
        },
      ],
    },
    {
      name: 'guardrails',
      label: '經濟護欄',
      type: 'group',
      admin: {
        description: '缺成本資料時設了毛利底線的規則不會套用（fail closed）；活動總預算設在活動的商務設定',
      },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'minimumGrossMarginPct', label: '最低毛利率 %', type: 'number', min: 0, max: 100 },
            { name: 'perUserLimit', label: '每人可套用次數', type: 'number', min: 1 },
            { name: 'totalUsageLimit', label: '全活動可套用總次數', type: 'number', min: 1 },
          ],
        },
      ],
    },
    { name: 'adminNote', label: '內部備註', type: 'textarea' },
  ],
  timestamps: true,
}
