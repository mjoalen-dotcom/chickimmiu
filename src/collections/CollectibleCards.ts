import type { CollectionConfig, Access, Where } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * 已發行的造型卡實例。
 *
 * 兩種 cardType：
 *   common   — 每筆訂單 line item × qty 發一張，無序號、無限量
 *   limited  — 商品定價 > NT$5,000 + 有藍圖 + salePool 還有額度，才額外發一張，
 *              帶 serialNo（1..template.totalSupply unique per template）
 *
 * mintedVia：
 *   purchase     — 來自 paid 訂單
 *   points-shop  — 會員點數兌換
 *   craft        — 3 張同 SKU common 合成（common 會被標 status='burned'）
 *   transfer     — 不實際 mint，僅作為 CardEvents 紀錄
 *
 * status：
 *   active          — 仍被某會員持有
 *   burned          — 已消滅換點（或合成時被消耗）
 *   revoked         — 訂單被取消/退貨而撤回（Q1 決策）
 *   transferred-out — 已轉出（保留這筆紀錄但 owner 改成新擁有者；此狀態實際上
 *                     很少用，因為 transfer 是「改 owner」不是 soft-delete）
 *
 * shareSlug：32 字元 nanoid，用於 `/cards/:slug` 公開分享頁。
 */
const readOwnCards: Access = ({ req: { user } }) => {
  if (!user) return false
  const userData = user as unknown as Record<string, unknown>
  if (userData.role === 'admin') return true
  return {
    owner: { equals: user.id },
  } as Where
}

export const CollectibleCards: CollectionConfig = {
  slug: 'collectible-cards',
  admin: {
    group: '⑤ 互動體驗',
    useAsTitle: 'displayTitle',
    defaultColumns: ['displayTitle', 'cardType', 'serialNo', 'owner', 'status', 'mintedVia', 'mintedAt'],
    description: '會員持有的每張造型卡（common + limited）。',
  },
  access: {
    read: readOwnCards,
    // 所有寫入必須由 hook/endpoint 驅動（payload.create with overrideAccess）；
    // admin UI 禁止手動新增/編輯，避免 serial/pool counter 失同步。
    create: isAdmin,
    update: isAdmin,
    delete: () => false,
  },
  timestamps: true,
  fields: [
    {
      name: 'displayTitle',
      label: '顯示標題',
      type: 'text',
      admin: {
        description: '列表顯示用。mint 時自動寫入，例：「鳳凰錦袍 #0042（限量）」。',
        readOnly: true,
      },
    },
    {
      name: 'cardType',
      label: '卡種',
      type: 'select',
      required: true,
      options: [
        { label: '普通卡', value: 'common' },
        { label: '限量卡', value: 'limited' },
      ],
    },
    {
      name: 'product',
      label: '關聯商品',
      type: 'relationship',
      relationTo: 'products',
      required: true,
      index: true,
    },
    {
      name: 'template',
      label: '藍圖（limited 卡才有）',
      type: 'relationship',
      relationTo: 'collectible-card-templates',
      index: true,
      admin: {
        description: 'common 卡此欄為空；limited 卡必填。',
      },
    },
    {
      name: 'serialNo',
      label: '序號（limited 卡才有）',
      type: 'number',
      admin: {
        description: '1..template.totalSupply。unique per template（由 migration 建 composite index）。',
      },
    },
    {
      name: 'owner',
      label: '目前擁有者',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      admin: {
        description: 'burned/revoked 時為空。',
      },
    },
    {
      name: 'originalOwner',
      label: '首位擁有者',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: '永遠不變。',
        readOnly: true,
      },
    },
    {
      name: 'status',
      label: '狀態',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: '持有中', value: 'active' },
        { label: '已銷毀', value: 'burned' },
        { label: '已撤回（訂單取消/退貨）', value: 'revoked' },
        { label: '已轉出', value: 'transferred-out' },
      ],
      index: true,
    },
    {
      name: 'mintedVia',
      label: 'Mint 來源',
      type: 'select',
      required: true,
      options: [
        { label: '訂單付款', value: 'purchase' },
        { label: '點數兌換', value: 'points-shop' },
        { label: '合成（3→1）', value: 'craft' },
      ],
    },
    {
      name: 'sourceOrder',
      label: '來源訂單',
      type: 'relationship',
      relationTo: 'orders',
      admin: {
        description: 'mintedVia=purchase 時填入，退貨撤卡要用。',
      },
      index: true,
    },
    {
      name: 'mintedAt',
      label: 'Mint 時間',
      type: 'date',
      required: true,
      defaultValue: () => new Date().toISOString(),
      admin: { readOnly: true },
    },
    {
      name: 'designSeed',
      label: '美術 seed',
      type: 'text',
      required: true,
      admin: {
        description: '32 字元 hex，OG 圖渲染時用來決定裝飾元素（光線角度、粒子偏移）。',
        readOnly: true,
      },
    },
    {
      name: 'shareSlug',
      label: '分享 slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: '公開 URL 用。/cards/:shareSlug 可被任何人看到。',
        readOnly: true,
      },
    },
    {
      name: 'ownerNicknameSnapshot',
      label: '擁有者暱稱快照',
      type: 'text',
      admin: {
        description: 'mint 當下的擁有者暱稱，OG 圖顯示用；transfer 時更新。',
      },
    },
  ],
}
