import type { Access, CollectionConfig, Where } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * 會員獎項庫存（寶物箱）
 *
 * 跟 MiniGameRecords（「事件 log」）分離 — 本表是「庫存」source-of-truth。
 * MiniGameRecords `outcome='win'` 的 afterChange hook 自動建一筆 UserRewards。
 *
 * State machine：
 *   unused → pending_attach（checkout 勾選隨單寄出）→ shipped（order delivered）
 *   unused → consumed（電子券手動「標記已使用」）
 *   unused → expired（beforeRead lazy：expiresAt < now）
 *
 * ⚠️ 點數 / 購物金類獎項不進這表（已直接寫入 user.points / user.shoppingCredit）。
 */

const isOwnerOrAdmin: Access = ({ req: { user } }) => {
  if (!user) return false
  const userData = user as unknown as Record<string, unknown>
  if (userData.role === 'admin') return true
  return { user: { equals: user.id } } as Where
}

export const UserRewards: CollectionConfig = {
  slug: 'user-rewards',
  labels: { singular: '會員獎勵', plural: '會員獎勵' },
  admin: {
    group: '③ 會員與 CRM',
    useAsTitle: 'displayName',
    defaultColumns: ['user', 'rewardType', 'displayName', 'state', 'expiresAt', 'createdAt'],
    description: '會員寶物箱獎項庫存（實體 / 電子券 / 優惠券 / 贈品）',
  },
  access: {
    read: isOwnerOrAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  timestamps: true,
  fields: [
    {
      name: 'user',
      label: '會員',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },
    {
      name: 'sourceRecord',
      label: '來源紀錄',
      type: 'relationship',
      relationTo: 'mini-game-records',
      admin: {
        description: '觸發本筆獎項的遊戲紀錄；admin 手動建獎時留空',
      },
    },
    {
      name: 'redemptionRef',
      label: '來源兌換項目',
      type: 'relationship',
      relationTo: 'points-redemptions',
      admin: {
        description: '若本筆 reward 來自會員點數兌換，記錄兌換的 PointsRedemption；用於 maxPerUser / maxPerDay 檢查',
      },
    },
    {
      name: 'pointsCostSnapshot',
      label: '兌換時花費點數（快照）',
      type: 'number',
      admin: {
        description: '從 PointsRedemption.pointsCost 寫入；後續 admin 改價不影響此筆',
      },
    },
    {
      name: 'rewardType',
      label: '獎項類型',
      type: 'select',
      required: true,
      options: [
        { label: '免運券', value: 'free_shipping_coupon' },
        { label: '電影券（實體）', value: 'movie_ticket_physical' },
        { label: '電影券（電子）', value: 'movie_ticket_digital' },
        { label: '優惠券', value: 'coupon' },
        { label: '贈品（實體）', value: 'gift_physical' },
        { label: '徽章', value: 'badge' },
      ],
    },
    {
      name: 'displayName',
      label: '顯示名稱',
      type: 'text',
      required: true,
      admin: {
        description: '會員看到的獎項名（例如「2026 春季電影券」）',
      },
    },
    {
      name: 'amount',
      label: '數量 / 面額',
      type: 'number',
      admin: {
        description: '電影券張數、優惠券折扣面額（NTD）等數值',
      },
    },
    {
      name: 'couponCode',
      label: '兌換碼',
      type: 'text',
      unique: true,
      admin: {
        description: '電子券專用，需唯一；實體獎項可留空',
      },
    },
    {
      name: 'redemptionInstructions',
      label: '兌換方式說明',
      type: 'textarea',
      admin: {
        description: '兌換地點、使用期限、注意事項',
      },
    },
    {
      name: 'state',
      label: '狀態',
      type: 'select',
      required: true,
      defaultValue: 'unused',
      options: [
        { label: '未使用', value: 'unused' },
        { label: '預定隨下單寄出', value: 'pending_attach' },
        { label: '已寄出（附隨訂單）', value: 'shipped' },
        { label: '已使用', value: 'consumed' },
        { label: '已過期', value: 'expired' },
      ],
    },
    {
      name: 'attachedToOrder',
      label: '隨單寄出訂單',
      type: 'relationship',
      relationTo: 'orders',
      admin: {
        description: 'state = pending_attach / shipped 時必填；記錄此獎項附在哪張訂單',
      },
    },
    {
      name: 'shippedAt',
      label: '寄出時間',
      type: 'date',
    },
    {
      name: 'consumedAt',
      label: '使用時間',
      type: 'date',
    },
    {
      name: 'expiresAt',
      label: '過期時間',
      type: 'date',
      required: true,
      admin: {
        description: '過期後 read 時自動標為 expired；admin 建獎時務必設遠未來日期代表「永久有效」',
      },
    },
    {
      name: 'requiresPhysicalShipping',
      label: '需實體寄出',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: '實體獎項勾選（checkout 自動 attach）；電子券 / 徽章請取消勾選',
      },
    },
  ],
  hooks: {
    afterRead: [
      ({ doc }) => {
        if (!doc) return doc
        if (
          doc.state === 'unused' &&
          doc.expiresAt &&
          new Date(doc.expiresAt).getTime() < Date.now()
        ) {
          return { ...doc, state: 'expired' }
        }
        return doc
      },
    ],
  },
}
