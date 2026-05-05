import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * AdAudiences Collection — PR-E1（schema only，未接 Meta API）
 * ──────────────────────────────────────────────────────────
 * Meta Custom Audience 動態受眾管理：把 PR-B (ProductViewEvents) +
 * Orders 的行為事件，餵給 Meta 自動產生 retargeting 受眾。
 *
 * 4 個基本受眾類型：
 *   - viewers          : 14 天看過商品但未購買
 *   - cart_abandoners  : 14 天加購未結帳
 *   - purchasers       : 90 天內已購買（Lookalike 種子）
 *   - product_specific : 看過特定商品（filterProductIds）
 *
 * Pipeline:
 *   PR-E1（this PR）：純 schema，admin 後台可建/編，不打 Meta API
 *   PR-E2：sync engine + 強制同步按鈕（user 觸發）→ POST /customaudiences
 *   PR-E3：cron 自動同步（每 6-12 小時）
 *
 * 同步狀態 syncStatus：idle → pending → synced / error
 *   - idle    ：未同步過（or 重置）
 *   - pending ：sync engine 進行中
 *   - synced  ：成功，metaAudienceId 有值，lastSyncAt 寫入
 *   - error   ：syncError 有訊息，下次 retry
 *
 * Meta 政策提醒（PR-E2/E3 實作 sync 時必須處理）：
 *   - audience size < 100 不會 deliver
 *   - 必須過濾 marketingAccepted=false 的 user
 *   - email 必須 sha256 lowercase 前 hash 才上傳（複用 PR-C sha256Lower）
 */
export const AdAudiences: CollectionConfig = {
  slug: 'ad-audiences',
  labels: { singular: '廣告受眾', plural: '廣告受眾' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'type', 'timeWindowDays', 'syncStatus', 'lastSyncAt'],
    group: '④ 行銷推廣',
    description:
      'Meta Custom Audience 動態受眾管理（PR-E1：純 schema，未接 Meta API；PR-E2 後才會真的同步到 Meta）',
    listSearchableFields: ['name', 'description', 'metaAudienceId'],
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'name',
          label: '受眾名稱',
          type: 'text',
          required: true,
          admin: { width: '60%', description: '行銷對內顯示名稱，例如「14 天瀏覽未購買」' },
        },
        {
          name: 'type',
          label: '受眾類型',
          type: 'select',
          required: true,
          defaultValue: 'viewers',
          dbName: 'ad_audience_type',
          options: [
            { label: '瀏覽未購（Viewers）', value: 'viewers' },
            { label: '加購未結（Cart Abandoners）', value: 'cart_abandoners' },
            { label: '已購買者（Past Purchasers / LTV）', value: 'purchasers' },
            { label: '商品瀏覽者（Product Specific）', value: 'product_specific' },
          ],
          admin: { width: '40%' },
        },
      ],
    },
    {
      name: 'description',
      label: '描述',
      type: 'textarea',
      admin: { description: '受眾用途、投放策略、預期 lookalike 種子用途等' },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'timeWindowDays',
          label: '時間窗口（天）',
          type: 'number',
          defaultValue: 14,
          min: 1,
          max: 365,
          required: true,
          admin: {
            width: '50%',
            description: '回溯多少天的事件。Viewers/Cart 建議 14；Purchasers 建議 90',
          },
        },
        {
          name: 'excludePurchasersDays',
          label: '排除已購買者（天）',
          type: 'number',
          defaultValue: 14,
          min: 0,
          max: 365,
          admin: {
            width: '50%',
            description: '0 = 不排除。Viewers/Cart 通常設 14（已購買的不再投放）',
          },
        },
      ],
    },
    {
      name: 'filterProductIds',
      label: '指定商品（僅 Product Specific 類型）',
      type: 'relationship',
      relationTo: 'products',
      hasMany: true,
      admin: {
        description: '只計算瀏覽過這些商品的訪客。其他類型可忽略。',
        condition: (data) => data?.type === 'product_specific',
      },
    },
    {
      name: 'enabled',
      label: '啟用 cron 自動同步',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'PR-E3 cron 才會用到。預設關閉，避免 cron 上線時自動跑歷史 audience。手動同步按鈕（PR-E2）不受此 flag 限制。',
      },
    },
    // ─── Sync 狀態（read-only，由 sync engine 寫入）──────────
    {
      type: 'row',
      fields: [
        {
          name: 'syncStatus',
          label: '同步狀態',
          type: 'select',
          defaultValue: 'idle',
          dbName: 'ad_audience_sync_status',
          options: [
            { label: '未同步', value: 'idle' },
            { label: '同步中', value: 'pending' },
            { label: '已同步', value: 'synced' },
            { label: '失敗', value: 'error' },
          ],
          admin: { width: '50%', readOnly: true },
        },
        {
          name: 'lastSyncAt',
          label: '上次同步時間',
          type: 'date',
          admin: {
            width: '50%',
            readOnly: true,
            date: { pickerAppearance: 'dayAndTime' },
          },
        },
      ],
    },
    {
      name: 'metaAudienceId',
      label: 'Meta Audience ID',
      type: 'text',
      admin: {
        readOnly: true,
        description: '首次 sync 後 Meta 回傳。後續 sync 用此 ID 增/減 users，不重建。',
      },
    },
    {
      name: 'estimatedSize',
      label: '估計受眾人數',
      type: 'number',
      admin: {
        readOnly: true,
        description: '上次 sync 計算的 unique user 數。低於 100 Meta 不會 deliver。',
      },
    },
    {
      name: 'syncError',
      label: '同步錯誤訊息',
      type: 'textarea',
      admin: { readOnly: true, description: '失敗時 Meta API error / fbtrace_id' },
    },
  ],
  timestamps: true,
}
