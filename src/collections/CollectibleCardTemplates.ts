import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * 造型卡牌藍圖（per-SKU）。
 *
 * 稀缺設計：
 *   admin 手動開藍圖 → 指定一個 product → 設定 totalSupply（總流通量）
 *   總量切三池：
 *     salePool         — 銷售池（paid 訂單 mint，unitPrice > NT$5,000 才觸發）
 *     pointsShopPool   — 點數兌換池（會員用點數買）
 *     craftingPool     — 合成池（3 張 common → 1 張 limited 抽取）
 *
 * 三池獨立不互借：避免熱門品銷售池一下秒空，玩家完全沒機會合成/兌換。
 *
 * nextSerialNo / *PoolRemaining 由 mint 端原子寫入（SQLite 單進程 OK）。
 *
 * Q1/Q2/Q3（2026-04-21 scope 決策）：
 *   Q1 退貨撤卡 — 由 Orders.status='cancelled' hook 處理，把該訂單 mint 的卡
 *      標記為 status='revoked'，serial 不回收（避免 serial 空洞）
 *   Q2 商品下架 — isActive=false，不再 mint，既有卡保留
 *   Q3 frameTier 動態 — 不存 frameTier 到 template，OG 圖渲染時依當下擁有者
 *      的 memberTier.slug 現算
 */
export const CollectibleCardTemplates: CollectionConfig = {
  slug: 'collectible-card-templates',
  admin: {
    group: '互動體驗',
    useAsTitle: 'adminTitle',
    defaultColumns: ['adminTitle', 'product', 'totalSupply', 'salePoolRemaining', 'pointsShopPoolRemaining', 'craftingPoolRemaining', 'isActive'],
    description: '每個商品一張藍圖。觸發條件：商品定價 > NT$5,000 才能開藍圖發限量卡。',
  },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  timestamps: true,
  fields: [
    {
      name: 'product',
      label: '關聯商品',
      type: 'relationship',
      relationTo: 'products',
      required: true,
      unique: true,
      admin: {
        description: '每個商品僅能有一張藍圖。',
      },
    },
    {
      name: 'adminTitle',
      label: '藍圖名稱（後台顯示用）',
      type: 'text',
      required: true,
      admin: {
        description: '例：「鳳凰錦袍限量卡」。僅後台管理使用，不顯示給客戶。',
      },
    },
    {
      name: 'isActive',
      label: '啟用中',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: '關閉後不再 mint 新卡（既有卡仍可使用、轉送、銷毀）。',
      },
    },
    {
      name: 'totalSupply',
      label: '總流通量',
      type: 'number',
      required: true,
      min: 1,
      defaultValue: 500,
      admin: {
        description: '全部三池加總上限。建立後不建議修改（會破壞稀缺承諾）。',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'salePool',
          label: '銷售池（張）',
          type: 'number',
          required: true,
          min: 0,
          defaultValue: 350,
          admin: { width: '33%' },
        },
        {
          name: 'pointsShopPool',
          label: '點數商店池（張）',
          type: 'number',
          required: true,
          min: 0,
          defaultValue: 100,
          admin: { width: '33%' },
        },
        {
          name: 'craftingPool',
          label: '合成池（張）',
          type: 'number',
          required: true,
          min: 0,
          defaultValue: 50,
          admin: { width: '33%' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'salePoolRemaining',
          label: '銷售池剩餘',
          type: 'number',
          required: true,
          defaultValue: 350,
          admin: {
            width: '33%',
            readOnly: true,
            description: '由 mint hook 自動扣減。',
          },
        },
        {
          name: 'pointsShopPoolRemaining',
          label: '點數池剩餘',
          type: 'number',
          required: true,
          defaultValue: 100,
          admin: { width: '33%', readOnly: true },
        },
        {
          name: 'craftingPoolRemaining',
          label: '合成池剩餘',
          type: 'number',
          required: true,
          defaultValue: 50,
          admin: { width: '33%', readOnly: true },
        },
      ],
    },
    {
      name: 'nextSerialNo',
      label: '下一個序號',
      type: 'number',
      required: true,
      defaultValue: 1,
      admin: {
        readOnly: true,
        description: '1 ~ totalSupply。mint 後自動 +1。',
      },
    },
    {
      name: 'pointsShopPrice',
      label: '點數商店售價（點）',
      type: 'number',
      required: true,
      min: 1,
      defaultValue: 1200,
      admin: {
        description: '會員用點數兌換一張限量卡所需點數。',
      },
    },
    {
      name: 'burnPointsReward',
      label: '銷毀換點數（點）',
      type: 'number',
      required: true,
      min: 0,
      defaultValue: 500,
      admin: {
        description: '限量卡被銷毀時，擁有者獲得的點數。',
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        if (operation === 'create' && data) {
          // 建立時：三池 remaining 初始化為池子大小
          if (typeof data.salePool === 'number' && data.salePoolRemaining == null) {
            data.salePoolRemaining = data.salePool
          }
          if (typeof data.pointsShopPool === 'number' && data.pointsShopPoolRemaining == null) {
            data.pointsShopPoolRemaining = data.pointsShopPool
          }
          if (typeof data.craftingPool === 'number' && data.craftingPoolRemaining == null) {
            data.craftingPoolRemaining = data.craftingPool
          }
          // totalSupply 自動 = 三池加總（若未指定）
          if (data.totalSupply == null) {
            data.totalSupply =
              (data.salePool as number) + (data.pointsShopPool as number) + (data.craftingPool as number)
          }
        }
        return data
      },
    ],
  },
}
