import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * PR-E1 — DPA Retargeting Custom Audience 定義
 *
 * 儲存 Meta Custom Audience 的定義（audience type / 時間窗口 / 過濾條件），
 * 以及同步狀態（metaAudienceId / syncStatus / lastSyncAt / syncError）。
 *
 * PR-E1 只做 schema + admin UI，不打 Meta API。
 * PR-E2 加 sync engine + 手動觸發。
 * PR-E3 加 cron 自動同步。
 */
export const AdAudiences: CollectionConfig = {
  slug: 'ad-audiences',
  labels: { singular: '廣告受眾', plural: '廣告受眾' },
  admin: {
    group: '④ 行銷推廣',
    useAsTitle: 'name',
    defaultColumns: ['name', 'type', 'timeWindowDays', 'syncStatus', 'lastSyncAt', 'updatedAt'],
    description:
      'Meta Custom Audience 定義 — 把 Pixel 瀏覽 / 加購 / 結帳行為轉為再行銷受眾。' +
      'PR-E2 加同步引擎後，「強制同步」按鈕會推到 Meta Ads Manager。',
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    // ── 基本定義 ──
    {
      name: 'name',
      label: '受眾名稱',
      type: 'text',
      required: true,
      admin: {
        description: '在 Meta Ads Manager 顯示的受眾名稱，例如「14天瀏覽未購買」',
      },
    },
    {
      name: 'description',
      label: '說明',
      type: 'textarea',
      admin: {
        description: '內部備註，不會同步到 Meta',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'type',
          label: '受眾類型',
          type: 'select',
          required: true,
          options: [
            { label: '瀏覽未購買（ViewContent → no Purchase）', value: 'viewers' },
            { label: '棄購車（AddToCart → no Purchase）', value: 'cart_abandoners' },
            { label: '已購買客戶（Purchase, LTV 種子）', value: 'purchasers' },
            { label: '特定商品瀏覽者（ViewContent of content_id=X）', value: 'product_specific' },
          ],
          defaultValue: 'viewers',
          admin: { width: '50%' },
        },
        {
          name: 'enabled',
          label: '啟用',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            width: '50%',
            description: '關閉後 cron 不會自動同步這個受眾',
          },
        },
      ],
    },

    // ── 時間窗口 ──
    {
      type: 'row',
      fields: [
        {
          name: 'timeWindowDays',
          label: '行為回溯天數',
          type: 'number',
          required: true,
          defaultValue: 14,
          min: 1,
          max: 180,
          admin: {
            width: '50%',
            description: '包含過去 N 天內有該行為的使用者（Meta 上限 180 天）',
          },
        },
        {
          name: 'excludePurchasersDays',
          label: '排除已購買天數',
          type: 'number',
          defaultValue: 14,
          min: 0,
          max: 180,
          admin: {
            width: '50%',
            description:
              '過去 N 天內有 Purchase 的人從受眾中排除。' +
              '0 = 不排除。主要用於 viewers / cart_abandoners 類型。',
          },
        },
      ],
    },

    // ── 商品級過濾 ──
    {
      name: 'filterProducts',
      label: '指定商品（僅 product_specific 類型）',
      type: 'relationship',
      relationTo: 'products',
      hasMany: true,
      admin: {
        description: '只納入瀏覽過這些商品的使用者。留空 = 全商品。',
        condition: (data) => data?.type === 'product_specific',
      },
    },

    // ── Meta 同步狀態（read-only，PR-E2 sync engine 寫入）──
    {
      name: 'syncStatus',
      label: '同步狀態',
      type: 'select',
      defaultValue: 'idle',
      options: [
        { label: '未同步', value: 'idle' },
        { label: '同步中', value: 'pending' },
        { label: '已同步', value: 'synced' },
        { label: '同步失敗', value: 'error' },
      ],
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'PR-E2 sync engine 自動更新',
      },
    },
    {
      name: 'metaAudienceId',
      label: 'Meta Audience ID',
      type: 'text',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Meta 回傳的 Custom Audience ID（首次 CREATE 後寫入）',
      },
    },
    {
      name: 'lastSyncAt',
      label: '上次同步',
      type: 'date',
      admin: {
        position: 'sidebar',
        readOnly: true,
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'syncError',
      label: '同步錯誤',
      type: 'textarea',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: '最近一次同步失敗的錯誤訊息',
      },
    },
    {
      name: 'estimatedSize',
      label: '預估受眾人數',
      type: 'number',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: '上次同步時符合條件的不重複使用者數（< 100 人 Meta 不會投放）',
      },
    },
  ],
}
