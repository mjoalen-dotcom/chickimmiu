import type { CollectionConfig, Access, Where } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * 造型卡審計日誌（append-only）。
 *
 * 每次 mint / transfer / burn / craft / revoke 都寫一筆，不可改不可刪。
 * 作用：反作弊、退貨回補資訊、未來做 rarity 分析。
 *
 * action 對應：
 *   mint           — 卡被建立（購買/點數/合成 都會寫）
 *   transfer       — owner 變更
 *   burn           — 會員主動銷毀換點
 *   craft-consume  — 合成時 3 張 common 被消耗
 *   craft-result   — 合成時新出的 limited 卡（與 craft-consume 同 transaction）
 *   revoke         — 訂單取消/退貨導致撤卡
 *
 * pointsDelta：
 *   burn / craft-result 時為會員點數變化（正數=入帳，負數=扣點）
 *   其他為 null
 */
const readOwnEvents: Access = ({ req: { user } }) => {
  if (!user) return false
  const userData = user as unknown as Record<string, unknown>
  if (userData.role === 'admin') return true
  return {
    or: [
      { fromUser: { equals: user.id } },
      { toUser: { equals: user.id } },
    ],
  } as Where
}

export const CollectibleCardEvents: CollectionConfig = {
  slug: 'collectible-card-events',
  admin: {
    group: '互動體驗',
    useAsTitle: 'action',
    defaultColumns: ['action', 'card', 'fromUser', 'toUser', 'pointsDelta', 'createdAt'],
    description: '造型卡事件審計日誌（唯讀）。',
  },
  access: {
    read: readOwnEvents,
    create: isAdmin,
    update: () => false,
    delete: () => false,
  },
  timestamps: true,
  fields: [
    {
      name: 'card',
      label: '卡',
      type: 'relationship',
      relationTo: 'collectible-cards',
      required: true,
      index: true,
    },
    {
      name: 'action',
      label: '動作',
      type: 'select',
      required: true,
      options: [
        { label: 'Mint（建立）', value: 'mint' },
        { label: 'Transfer（轉送）', value: 'transfer' },
        { label: 'Burn（銷毀）', value: 'burn' },
        { label: 'Craft-Consume（合成消耗）', value: 'craft-consume' },
        { label: 'Craft-Result（合成產出）', value: 'craft-result' },
        { label: 'Revoke（撤回）', value: 'revoke' },
      ],
    },
    {
      name: 'fromUser',
      label: '原擁有者',
      type: 'relationship',
      relationTo: 'users',
      index: true,
    },
    {
      name: 'toUser',
      label: '新擁有者',
      type: 'relationship',
      relationTo: 'users',
      index: true,
    },
    {
      name: 'pointsDelta',
      label: '點數變化',
      type: 'number',
      admin: {
        description: 'burn 入帳、point-shop-mint 扣點、其他為空。',
      },
    },
    {
      name: 'sourceOrder',
      label: '關聯訂單',
      type: 'relationship',
      relationTo: 'orders',
      admin: {
        description: 'mint/revoke 若來自訂單則填入。',
      },
    },
    {
      name: 'notes',
      label: '備註',
      type: 'text',
      admin: {
        description: '自動寫入，例：「訂單 #CKMU-20260421-001 付款 mint」、「訂單取消撤卡」。',
      },
    },
  ],
}
