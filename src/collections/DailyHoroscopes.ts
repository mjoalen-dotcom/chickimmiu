import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'
import { ZODIAC_LABELS, ZODIAC_SIGNS } from '../lib/horoscope/zodiac'

/**
 * DailyHoroscopes Collection
 * ──────────────────────────
 * 快取每日（zodiacSign × date × gender）運勢內容。
 *
 *   - 主鍵：(zodiac_sign, date, gender) 組合查詢，所以加複合索引
 *   - 寫入：/api/horoscope/today（lazy generation：cache miss 才寫）
 *   - 讀取：/api/horoscope/today（hit 直接回） + admin（覆蓋／微調文案）
 *
 * `luckyColors` 與 `styleKeywords` 用逗號分隔的 text 儲存，避免引入 sub-table。
 * `styleKeywords` 對應 Products.collectionTags 的 enum 值（jin-style, formal-dresses…），
 * /api/horoscope/today 用這欄位 join 商品。
 */
export const DailyHoroscopes: CollectionConfig = {
  slug: 'daily-horoscopes',
  labels: { singular: '每日星座運勢', plural: '每日星座運勢' },
  admin: {
    useAsTitle: 'date',
    defaultColumns: ['date', 'zodiacSign', 'gender', 'generatedBy', 'updatedAt'],
    group: '互動體驗',
    description:
      '每日星座運勢快取（lazy 生成：使用者第一次進 /account 才會寫入）。可手動覆蓋文案。',
  },
  access: {
    read: () => true, // /api/horoscope/today 用 payload local API 直接查；公開 read 安全
    create: ({ req }) => Boolean(req.user), // API 路由用使用者 session 寫入；admin 也可
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'zodiacSign',
          label: '星座',
          type: 'select',
          required: true,
          index: true,
          options: ZODIAC_SIGNS.map((s) => ({
            value: s,
            label: `${ZODIAC_LABELS[s].emoji} ${ZODIAC_LABELS[s].zh} (${ZODIAC_LABELS[s].dateRange})`,
          })),
          admin: { width: '40%' },
        },
        {
          name: 'date',
          label: '日期',
          type: 'text',
          required: true,
          index: true,
          admin: { width: '30%', description: 'YYYY-MM-DD（Asia/Taipei）' },
        },
        {
          name: 'gender',
          label: '性別',
          type: 'select',
          required: true,
          index: true,
          options: [
            { label: '女性', value: 'female' },
            { label: '男性', value: 'male' },
          ],
          admin: { width: '30%' },
        },
      ],
    },
    {
      name: 'workFortune',
      label: '工作運',
      type: 'textarea',
      required: true,
    },
    {
      name: 'relationshipFortune',
      label: '人際關係運',
      type: 'textarea',
      required: true,
    },
    {
      name: 'moneyFortune',
      label: '財運',
      type: 'textarea',
      required: true,
    },
    {
      name: 'cautionFortune',
      label: '注意事項',
      type: 'textarea',
      required: true,
    },
    {
      name: 'outfitAdvice',
      label: '穿搭建議',
      type: 'textarea',
      required: true,
    },
    {
      type: 'row',
      fields: [
        {
          name: 'luckyColors',
          label: '幸運色（逗號分隔）',
          type: 'text',
          admin: { width: '50%', description: 'e.g. 磚紅,象牙白' },
        },
        {
          name: 'styleKeywords',
          label: '風格關鍵字（逗號分隔，對應 collectionTags）',
          type: 'text',
          admin: {
            width: '50%',
            description:
              '用 Products.collectionTags 的 enum 值：jin-live / jin-style / host-style / brand-custom / formal-dresses / rush / celebrity-style',
          },
        },
      ],
    },
    {
      name: 'generatedBy',
      label: '生成方式',
      type: 'select',
      defaultValue: 'seed',
      options: [
        { label: 'Seed 模板（fallback）', value: 'seed' },
        { label: 'Groq Llama（自動生成）', value: 'groq' },
        { label: 'Admin 手動覆寫', value: 'admin' },
      ],
      admin: { description: 'API 自動寫入；admin 編輯時請改成 admin 標記。' },
    },
  ],
  timestamps: true,
}
