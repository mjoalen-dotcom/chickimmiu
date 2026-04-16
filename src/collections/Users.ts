import type { CollectionConfig } from 'payload'

import { isAdmin, isAdminFieldLevel } from '../access/isAdmin'
import { isAdminOrSelf } from '../access/isAdminOrSelf'
import { createExportEndpoint, createImportEndpoint, type FieldMapping } from '../endpoints/importExport'

const userFieldMappings: FieldMapping[] = [
  { key: 'name', label: '姓名' },
  { key: 'email', label: 'Email' },
  { key: 'role', label: '角色' },
  { key: 'phone', label: '電話' },
  { key: 'points', label: '點數' },
  { key: 'shoppingCredit', label: '購物金' },
  { key: 'totalSpent', label: '累計消費' },
  { key: 'birthday', label: '生日' },
  { key: 'referralCode', label: '推薦碼' },
  { key: 'addresses', label: '地址（JSON）' },
]

/**
 * Users Collection
 * ────────────────
 * Reorganized with tabs for better UX:
 *   Tab 1: Basic Info & Permissions
 *   Tab 2: Membership & Points
 *   Tab 3: CRM & Credit
 *   Tab 4: Preferences & Tags
 *   Tab 5: Addresses & Social
 *   Tab 6: Activity & Orders
 *   Tab 7: Game & AI
 */
export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['name', 'email', 'role', 'memberTier', 'points', 'totalSpent', 'creditStatus', 'createdAt'],
    group: '會員管理',
    description: '系統使用者（管理員、合作夥伴、一般會員）— 分區管理介面',
    components: {
      beforeListTable: [
        {
          path: '@/components/admin/ImportExportButtons',
          clientProps: { collectionSlug: 'users' },
        },
      ],
    },
  },
  auth: {
    tokenExpiration: 60 * 60 * 24 * 7,
    cookies: {
      sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production',
    },
  },
  access: {
    admin: ({ req: { user } }) => {
      if (!user) return false
      return user.role === 'admin' || user.role === 'partner'
    },
    read: isAdminOrSelf,
    create: isAdmin,
    update: isAdminOrSelf,
    delete: isAdmin,
  },
  endpoints: [
    createExportEndpoint('users', userFieldMappings),
    createImportEndpoint('users', userFieldMappings),
  ],
  fields: [
    // ════════════════════════════════════════════════════════════════
    // TABS layout for organized, intuitive form
    // ════════════════════════════════════════════════════════════════
    {
      type: 'tabs',
      tabs: [
        // ── TAB 1: Basic Info & Permissions ──────────────────────
        {
          label: '基本資料 & 權限',
          description: '會員基本資訊、角色權限設定',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'name',
                  label: '姓名',
                  type: 'text',
                  required: true,
                  admin: { width: '50%' },
                },
                {
                  name: 'phone',
                  label: '電話',
                  type: 'text',
                  admin: { width: '50%' },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'role',
                  label: '角色',
                  type: 'select',
                  required: true,
                  defaultValue: 'customer',
                  options: [
                    { label: '管理員 Admin', value: 'admin' },
                    { label: '合作夥伴 Partner', value: 'partner' },
                    { label: '一般會員 Customer', value: 'customer' },
                  ],
                  access: {
                    create: isAdminFieldLevel,
                    update: isAdminFieldLevel,
                  },
                  admin: {
                    width: '50%',
                    description: '決定使用者可以看到的後台與 API 範圍',
                  },
                },
                {
                  name: 'birthday',
                  label: '生日',
                  type: 'date',
                  admin: { width: '50%', date: { pickerAppearance: 'dayOnly' } },
                },
              ],
            },
            {
              name: 'gender',
              label: '性別',
              type: 'select',
              options: [
                { label: '女性', value: 'female' },
                { label: '男性', value: 'male' },
                { label: '其他 / 不透露', value: 'other' },
              ],
              admin: {
                description: '影響會員等級前台稱號顯示（未填或 female → frontName；male → frontNameMale fallback frontName）',
              },
            },
            {
              name: 'avatar',
              label: '頭像',
              type: 'upload',
              relationTo: 'media',
            },
            // Admin permission info group
            {
              name: 'adminPermissions',
              label: '管理員權限設定',
              type: 'group',
              admin: {
                description: '僅管理員角色適用的權限設定',
                condition: (data) => data?.role === 'admin',
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'canManageProducts',
                      label: '商品管理',
                      type: 'checkbox',
                      defaultValue: true,
                      admin: { width: '25%' },
                    },
                    {
                      name: 'canManageOrders',
                      label: '訂單管理',
                      type: 'checkbox',
                      defaultValue: true,
                      admin: { width: '25%' },
                    },
                    {
                      name: 'canManageUsers',
                      label: '會員管理',
                      type: 'checkbox',
                      defaultValue: true,
                      admin: { width: '25%' },
                    },
                    {
                      name: 'canManageMarketing',
                      label: '行銷管理',
                      type: 'checkbox',
                      defaultValue: true,
                      admin: { width: '25%' },
                    },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'canManageFinance',
                      label: '財務管理',
                      type: 'checkbox',
                      defaultValue: false,
                      admin: { width: '25%' },
                    },
                    {
                      name: 'canManageSettings',
                      label: '系統設定',
                      type: 'checkbox',
                      defaultValue: false,
                      admin: { width: '25%' },
                    },
                    {
                      name: 'canManageContent',
                      label: '內容管理',
                      type: 'checkbox',
                      defaultValue: true,
                      admin: { width: '25%' },
                    },
                    {
                      name: 'canManageCRM',
                      label: 'CRM 管理',
                      type: 'checkbox',
                      defaultValue: false,
                      admin: { width: '25%' },
                    },
                  ],
                },
              ],
            },
          ],
        },

        // ── TAB 2: Membership & Points ──────────────────────────
        {
          label: '會員等級 & 點數',
          description: '會員等級、點數餘額、購物金',
          fields: [
            {
              name: 'memberTier',
              label: '會員等級',
              type: 'relationship',
              relationTo: 'membership-tiers',
              admin: {
                description: '由系統根據累計消費自動升級，或由管理員手動調整。等級：T0 優雅初遇者 → T1 曦漾仙子 → T2 優漾女神 → T3 金曦女王 → T4 星耀皇后 → T5 璀璨天后',
              },
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'points',
                  label: '會員點數',
                  type: 'number',
                  defaultValue: 0,
                  min: 0,
                  access: { update: isAdminFieldLevel },
                  admin: { width: '33%' },
                },
                {
                  name: 'shoppingCredit',
                  label: '購物金餘額',
                  type: 'number',
                  defaultValue: 0,
                  min: 0,
                  access: { update: isAdminFieldLevel },
                  admin: { width: '33%' },
                },
                {
                  name: 'totalSpent',
                  label: '累計消費金額',
                  type: 'number',
                  defaultValue: 0,
                  min: 0,
                  access: { update: isAdminFieldLevel },
                  admin: { width: '33%' },
                },
              ],
            },
            // Subscription status
            {
              name: 'subscriptionStatus',
              label: '訂閱狀態',
              type: 'group',
              admin: { description: '會員訂閱狀態與偏好' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'emailSubscribed',
                      label: 'Email 訂閱',
                      type: 'checkbox',
                      defaultValue: true,
                      admin: { width: '33%' },
                    },
                    {
                      name: 'smsSubscribed',
                      label: 'SMS 訂閱',
                      type: 'checkbox',
                      defaultValue: false,
                      admin: { width: '33%' },
                    },
                    {
                      name: 'lineSubscribed',
                      label: 'LINE 訂閱',
                      type: 'checkbox',
                      defaultValue: false,
                      admin: { width: '33%' },
                    },
                  ],
                },
                {
                  name: 'unsubscribedAt',
                  label: '取消訂閱日期',
                  type: 'date',
                  admin: { readOnly: true },
                },
              ],
            },
            // Referral
            {
              type: 'row',
              fields: [
                {
                  name: 'referralCode',
                  label: '推薦碼',
                  type: 'text',
                  unique: true,
                  admin: { width: '50%', description: '此會員的專屬推薦碼（可分享給朋友）' },
                },
                {
                  name: 'referredBy',
                  label: '推薦人',
                  type: 'relationship',
                  relationTo: 'users',
                  admin: { width: '50%', description: '註冊時使用的推薦碼所屬會員' },
                },
              ],
            },
          ],
        },

        // ── TAB 3: CRM & Credit Score ──────────────────────────
        {
          label: 'CRM & 信用',
          description: '信用分數、黑名單管理、客服等級',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'creditScore',
                  label: '信用分數',
                  type: 'number',
                  defaultValue: 100,
                  min: 0,
                  max: 100,
                  access: { update: isAdminFieldLevel },
                  admin: { width: '33%', description: '0~100，預設 100' },
                },
                {
                  name: 'creditStatus',
                  label: '信用狀態',
                  type: 'select',
                  defaultValue: 'excellent',
                  options: [
                    { label: '優質好客人 (90-100)', value: 'excellent' },
                    { label: '一般 (70-89)', value: 'normal' },
                    { label: '觀察名單 (50-69)', value: 'watchlist' },
                    { label: '警示名單 (30-49)', value: 'warning' },
                    { label: '黑名單 (10-29)', value: 'blacklist' },
                    { label: '停權 (0-9)', value: 'suspended' },
                  ],
                  access: { update: isAdminFieldLevel },
                  admin: { width: '33%', readOnly: true, description: '系統依信用分數自動判斷' },
                },
                {
                  name: 'serviceLevel',
                  label: '客服等級',
                  type: 'select',
                  defaultValue: 'standard',
                  options: [
                    { label: '標準', value: 'standard' },
                    { label: '優先', value: 'priority' },
                    { label: 'VIP 專屬', value: 'vip' },
                  ],
                  admin: { width: '33%' },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'isBlacklisted',
                  label: '黑名單',
                  type: 'checkbox',
                  defaultValue: false,
                  access: { update: isAdminFieldLevel },
                  admin: { width: '25%', description: '信用分數低於 30 自動標記' },
                },
                {
                  name: 'isSuspended',
                  label: '停權',
                  type: 'checkbox',
                  defaultValue: false,
                  access: { update: isAdminFieldLevel },
                  admin: { width: '25%', description: '信用分數低於 10 自動停權' },
                },
                {
                  name: 'blacklistReason',
                  label: '黑名單原因',
                  type: 'text',
                  admin: {
                    width: '50%',
                    description: '記錄黑名單原因',
                    condition: (data) => Boolean(data?.isBlacklisted),
                  },
                },
              ],
            },
            {
              name: 'vipOwner',
              label: '專屬 VIP 客服',
              type: 'relationship',
              relationTo: 'users',
              admin: { description: 'T4（星耀皇后）以上指派專屬客服人員' },
            },
            {
              name: 'crmNote',
              label: 'CRM 備註',
              type: 'textarea',
              admin: { description: '客服或管理員留下的會員備註' },
            },
          ],
        },

        // ── TAB 4: Preferences & Tags ──────────────────────────
        {
          label: '偏好 & 標籤',
          description: '購物偏好、行銷分群標籤',
          fields: [
            {
              name: 'tags',
              label: '會員標籤',
              type: 'array',
              admin: { description: '行銷分群標籤，例如：韓系愛好者、職場穿搭、高回購、沉睡客' },
              fields: [
                { name: 'tag', label: '標籤', type: 'text', required: true },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'preferredCategory',
                  label: '偏好商品類別',
                  type: 'text',
                  admin: { width: '33%', description: '如：洋裝、上衣、套裝' },
                },
                {
                  name: 'preferredSize',
                  label: '常購尺碼',
                  type: 'text',
                  admin: { width: '33%', description: '如 M、S/M' },
                },
                {
                  name: 'preferredColor',
                  label: '偏好色系',
                  type: 'text',
                  admin: { width: '33%', description: '如：米白、黑色、粉色系' },
                },
              ],
            },
            // Body profile for AI
            {
              name: 'bodyProfile',
              label: '身體資料（AI 尺寸推薦用）',
              type: 'group',
              admin: { description: '可選填，系統將自動推薦最合適的尺寸與款式' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'height', label: '身高（cm）', type: 'number', min: 100, max: 250, admin: { width: '25%' } },
                    { name: 'weight', label: '體重（kg）', type: 'number', min: 30, max: 200, admin: { width: '25%' } },
                    {
                      name: 'bodyShape',
                      label: '身形',
                      type: 'select',
                      options: [
                        { label: '瘦小', value: 'petite' },
                        { label: '標準', value: 'standard' },
                        { label: '豐滿', value: 'curvy' },
                        { label: '梨型（下身較寬）', value: 'pear' },
                        { label: '蘋果型（中段較寬）', value: 'apple' },
                        { label: '沙漏型（上下均勻）', value: 'hourglass' },
                        { label: '運動型', value: 'athletic' },
                      ],
                      admin: { width: '25%' },
                    },
                    { name: 'preferredSizes', label: '常穿尺寸', type: 'text', admin: { width: '25%', description: '例如 M, S/M' } },
                  ],
                },
              ],
            },
          ],
        },

        // ── TAB 5: Addresses & Social ──────────────────────────
        {
          label: '地址 & 社群',
          description: '地址簿、社群帳號綁定',
          fields: [
            {
              name: 'addresses',
              label: '地址簿',
              type: 'array',
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'label', label: '地址標籤', type: 'text', admin: { width: '30%', description: '例如：住家、公司' } },
                    { name: 'recipientName', label: '收件人姓名', type: 'text', required: true, admin: { width: '35%' } },
                    { name: 'phone', label: '聯絡電話', type: 'text', required: true, admin: { width: '35%' } },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    { name: 'zipCode', label: '郵遞區號', type: 'text', admin: { width: '15%' } },
                    { name: 'city', label: '縣市', type: 'text', required: true, admin: { width: '20%' } },
                    { name: 'district', label: '鄉鎮區', type: 'text', admin: { width: '20%' } },
                    { name: 'address', label: '詳細地址', type: 'text', required: true, admin: { width: '35%' } },
                    { name: 'isDefault', label: '預設', type: 'checkbox', defaultValue: false, admin: { width: '10%' } },
                  ],
                },
              ],
            },
            {
              name: 'socialLogins',
              label: '社群帳號綁定',
              type: 'group',
              admin: { description: '透過 NextAuth v5 綁定的社群帳號' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'googleId', label: 'Google ID', type: 'text', admin: { width: '25%' } },
                    { name: 'facebookId', label: 'Facebook ID', type: 'text', admin: { width: '25%' } },
                    { name: 'lineId', label: 'LINE ID', type: 'text', admin: { width: '25%' } },
                    { name: 'appleId', label: 'Apple ID', type: 'text', admin: { width: '25%' } },
                  ],
                },
              ],
            },
            {
              name: 'lineUid',
              label: 'LINE UID',
              type: 'text',
              admin: { description: 'LINE 官方帳號用戶 UID，用於推播訊息' },
            },
          ],
        },

        // ── TAB 6: Activity & Spending ──────────────────────────
        {
          label: '活動 & 消費',
          description: '消費統計、訂單歷史、登入記錄',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'annualSpend',
                  label: '年度消費金額',
                  type: 'number',
                  defaultValue: 0,
                  min: 0,
                  access: { update: isAdminFieldLevel },
                  admin: { width: '33%', description: '當年度累計消費，每年 1/1 歸零' },
                },
                {
                  name: 'lifetimeSpend',
                  label: '歷史累計消費金額',
                  type: 'number',
                  defaultValue: 0,
                  min: 0,
                  access: { update: isAdminFieldLevel },
                  admin: { width: '33%', description: '自註冊以來累計消費總額' },
                },
                {
                  name: 'orderCount',
                  label: '訂單總數',
                  type: 'number',
                  defaultValue: 0,
                  min: 0,
                  access: { update: isAdminFieldLevel },
                  admin: { width: '33%', readOnly: true, description: '系統自動計算' },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'lastOrderDate',
                  label: '最後購買日期',
                  type: 'date',
                  admin: { width: '50%', readOnly: true },
                },
                {
                  name: 'lastLoginDate',
                  label: '最後登入日期',
                  type: 'date',
                  admin: { width: '50%', readOnly: true },
                },
              ],
            },
            // Order history note
            {
              name: 'orderHistoryNote',
              label: '訂單歷史備註',
              type: 'textarea',
              admin: {
                description: '查看完整訂單記錄請前往 Orders 集合篩選此會員',
                readOnly: true,
              },
            },
          ],
        },

        // ── TAB 7: Game Activity & AI DM ──────────────────────────
        {
          label: '遊戲 & AI',
          description: '遊樂場活動記錄、AI 推薦 DM',
          fields: [
            {
              name: 'gameActivity',
              label: '遊樂場活動記錄',
              type: 'group',
              admin: { description: '記錄會員在遊樂場中參與過的遊戲與獲得的獎勵' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'totalGamesPlayed',
                      label: '總遊戲次數',
                      type: 'number',
                      defaultValue: 0,
                      min: 0,
                      admin: { width: '33%', readOnly: true },
                    },
                    {
                      name: 'totalPointsWon',
                      label: '遊戲獲得點數',
                      type: 'number',
                      defaultValue: 0,
                      min: 0,
                      admin: { width: '33%', readOnly: true },
                    },
                    {
                      name: 'favoriteGame',
                      label: '最常玩的遊戲',
                      type: 'text',
                      admin: { width: '33%', readOnly: true },
                    },
                  ],
                },
                {
                  name: 'recentGames',
                  label: '最近遊戲記錄',
                  type: 'array',
                  admin: { readOnly: true, description: '系統自動記錄最近 10 筆遊戲活動' },
                  maxRows: 10,
                  fields: [
                    {
                      type: 'row',
                      fields: [
                        { name: 'gameName', label: '遊戲名稱', type: 'text', admin: { width: '30%' } },
                        { name: 'result', label: '結果', type: 'text', admin: { width: '20%' } },
                        { name: 'reward', label: '獎勵', type: 'text', admin: { width: '25%' } },
                        { name: 'playedAt', label: '時間', type: 'date', admin: { width: '25%' } },
                      ],
                    },
                  ],
                },
              ],
            },
            // AI DM section
            {
              name: 'aiDmPreferences',
              label: 'AI 行銷 DM 設定',
              type: 'group',
              admin: { description: '根據會員瀏覽與購買行為，自動產生個人化行銷訊息' },
              fields: [
                {
                  name: 'interestedProducts',
                  label: '感興趣的商品',
                  type: 'relationship',
                  relationTo: 'products',
                  hasMany: true,
                  admin: { description: '系統自動追蹤或手動新增的感興趣商品清單' },
                },
                {
                  name: 'lastDmSentAt',
                  label: '上次 DM 發送時間',
                  type: 'date',
                  admin: { readOnly: true },
                },
                {
                  name: 'dmChannel',
                  label: 'DM 發送管道',
                  type: 'select',
                  defaultValue: 'email',
                  options: [
                    { label: 'Email', value: 'email' },
                    { label: 'LINE', value: 'line' },
                    { label: 'SMS', value: 'sms' },
                    { label: 'All Channels', value: 'all' },
                  ],
                },
                {
                  name: 'dmHistory',
                  label: 'DM 發送記錄',
                  type: 'array',
                  admin: { readOnly: true },
                  maxRows: 20,
                  fields: [
                    {
                      type: 'row',
                      fields: [
                        { name: 'channel', label: '管道', type: 'text', admin: { width: '15%' } },
                        { name: 'subject', label: '主題', type: 'text', admin: { width: '35%' } },
                        { name: 'status', label: '狀態', type: 'text', admin: { width: '15%' } },
                        { name: 'sentAt', label: '發送時間', type: 'date', admin: { width: '20%' } },
                        { name: 'openedAt', label: '開啟時間', type: 'date', admin: { width: '15%' } },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  timestamps: true,
}
