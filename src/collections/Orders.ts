import type { CollectionConfig, Access, Where } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { orderCreditScoreHook } from '../lib/crm/creditScoreHooks'
import { autoIssueInvoiceForOrder } from '../lib/invoice/ecpayInvoiceEngine'
import { sendOrderConfirmationEmail } from '../lib/email/orderConfirmation'

/**
 * 訂單讀取權限：
 * - Admin：看全部
 * - Partner：只看自己推薦的訂單（affiliateInfo.affiliateUser === user.id）
 * - Customer：只看自己的訂單（customer === user.id）
 */
const readOwnOrReferral: Access = ({ req: { user } }) => {
  if (!user) return false
  if (user.role === 'admin') return true
  if (user.role === 'partner') {
    return { 'affiliateInfo.affiliateUser': { equals: user.id } } as Where
  }
  return { customer: { equals: user.id } }
}

export const Orders: CollectionConfig = {
  slug: 'orders',
  admin: {
    useAsTitle: 'orderNumber',
    defaultColumns: ['orderNumber', 'customer', 'total', 'quickProcess', 'paymentMethod', 'paymentStatus', 'createdAt'],
    listSearchableFields: ['orderNumber', 'customerEmail', 'customerName'],
    group: '訂單管理',
    description: '訂單紀錄與管理（含出貨單列印、取貨總報表）',
    components: {
      beforeListTable: [
        {
          path: '@/components/admin/OrderToolsPanel',
        },
      ],
    },
  },
  access: {
    read: readOwnOrReferral,
    create: ({ req: { user } }) => Boolean(user),
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'orderNumber',
      label: '訂單編號',
      type: 'text',
      required: true,
      unique: true,
      admin: { description: '格式：CKM-YYYYMMDD-XXXX' },
    },
    // ── 訂單列表快捷按鈕：status=pending 時顯示「處理中 + 列印」，一鍵 PATCH
    //    status→processing 並開新分頁列印檢貨單（沿用 /api/order-print?id=）。
    //    其他狀態顯示狀態文字，取代原本顯示的 status 下拉讀值。
    {
      name: 'quickProcess',
      type: 'ui',
      label: '訂單狀態 / 快捷',
      admin: {
        components: {
          Cell: '@/components/admin/OrderProcessingCellButton',
        },
      },
    },
    {
      name: 'customer',
      label: '訂購會員',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    // ── 訂單項目 ──
    {
      name: 'items',
      label: '訂購商品',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        { name: 'product', label: '商品', type: 'relationship', relationTo: 'products', required: true },
        { name: 'productName', label: '商品名稱（快照）', type: 'text', required: true },
        { name: 'variant', label: '變體資訊', type: 'text', admin: { description: '例如：黑色 / M' } },
        { name: 'sku', label: 'SKU', type: 'text' },
        { name: 'quantity', label: '數量', type: 'number', required: true, min: 1 },
        { name: 'unitPrice', label: '單價', type: 'number', required: true, min: 0 },
        { name: 'subtotal', label: '小計', type: 'number', required: true, min: 0 },
      ],
    },
    // ── 金額 ──
    {
      name: 'subtotal',
      label: '商品小計',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'discountAmount',
      label: '折扣金額',
      type: 'number',
      defaultValue: 0,
      min: 0,
    },
    {
      name: 'discountReason',
      label: '折扣原因',
      type: 'text',
      admin: { description: '例如：金牌會員 5% 折扣、優惠券 SUMMER2024' },
    },
    {
      name: 'shippingFee',
      label: '運費',
      type: 'number',
      required: true,
      min: 0,
      defaultValue: 0,
    },
    {
      name: 'total',
      label: '訂單總金額',
      type: 'number',
      required: true,
      min: 0,
    },
    // ── 會員點數 / 購物金使用 ──
    {
      name: 'pointsUsed',
      label: '使用點數',
      type: 'number',
      defaultValue: 0,
      min: 0,
    },
    {
      name: 'creditUsed',
      label: '使用購物金',
      type: 'number',
      defaultValue: 0,
      min: 0,
    },
    // ── 訂單狀態 ──
    {
      name: 'status',
      label: '訂單狀態',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: '待處理', value: 'pending' },
        { label: '處理中', value: 'processing' },
        { label: '已出貨', value: 'shipped' },
        { label: '已送達', value: 'delivered' },
        { label: '已取消', value: 'cancelled' },
        { label: '已退款', value: 'refunded' },
      ],
    },
    // ── 付款 ──
    {
      name: 'paymentMethod',
      label: '付款方式',
      type: 'select',
      options: [
        { label: 'PayPal', value: 'paypal' },
        { label: '綠界科技 ECPay', value: 'ecpay' },
        { label: '藍新支付 NewebPay', value: 'newebpay' },
        { label: 'LINE Pay', value: 'linepay' },
        { label: '現金—宅配貨到付款', value: 'cash_cod' },
        { label: '現金—到辦公室取貨付款', value: 'cash_meetup' },
      ],
      admin: {
        description: 'cash_cod / cash_meetup 訂單預設 paymentStatus=unpaid，配送員到貨 / 客戶到辦公室取貨收款後 admin 手動 mark paid',
      },
    },
    {
      name: 'codFee',
      label: 'COD 手續費（新台幣）',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: '只有 paymentMethod=cash_cod 時計入 total。預設讀 GlobalSettings.payment.codDefaultFee；admin 可 per-order 覆蓋',
        condition: (data: Record<string, unknown>) => data?.paymentMethod === 'cash_cod',
      },
    },
    {
      name: 'paymentStatus',
      label: '付款狀態',
      type: 'select',
      required: true,
      defaultValue: 'unpaid',
      options: [
        { label: '未付款', value: 'unpaid' },
        { label: '已付款', value: 'paid' },
        { label: '退款中', value: 'refunding' },
        { label: '已退款', value: 'refunded' },
      ],
    },
    {
      name: 'paymentTransactionId',
      label: '金流交易編號',
      type: 'text',
    },
    // ── 收件資訊 ──
    {
      name: 'shippingAddress',
      label: '收件地址',
      type: 'group',
      fields: [
        { name: 'recipientName', label: '收件人姓名', type: 'text', required: true },
        { name: 'phone', label: '聯絡電話', type: 'text', required: true },
        { name: 'zipCode', label: '郵遞區號', type: 'text' },
        { name: 'city', label: '縣市', type: 'text', required: true },
        { name: 'district', label: '鄉鎮區', type: 'text' },
        { name: 'address', label: '詳細地址', type: 'text', required: true },
      ],
    },
    // ── 物流方式 ──
    {
      name: 'shippingMethod',
      label: '物流方式',
      type: 'group',
      fields: [
        { name: 'method', label: '配送方式', type: 'relationship', relationTo: 'shipping-methods' },
        { name: 'methodName', label: '物流名稱（快照）', type: 'text', admin: { description: '例如：7-ELEVEN 超商取貨' } },
        { name: 'carrier', label: '物流商代碼', type: 'text', admin: { description: '例如：711, family, tcat' } },
        {
          name: 'convenienceStore',
          label: '超商門市資訊',
          type: 'group',
          admin: { description: '僅超商取貨需填寫', condition: (_, siblingData) => ['711', 'family', 'hilife', 'ok'].includes(siblingData?.carrier || '') },
          fields: [
            { name: 'storeName', label: '門市名稱', type: 'text' },
            { name: 'storeId', label: '門市代號', type: 'text' },
            { name: 'storeAddress', label: '門市地址', type: 'text' },
          ],
        },
        { name: 'estimatedDays', label: '預計送達天數', type: 'text' },
      ],
    },
    {
      name: 'trackingNumber',
      label: '物流追蹤號',
      type: 'text',
    },
    // ── 合作夥伴分潤 ──
    {
      name: 'affiliateInfo',
      label: '分潤資訊',
      type: 'group',
      admin: { description: '透過合作夥伴推薦連結進來的訂單' },
      fields: [
        { name: 'referralCode', label: '推薦碼', type: 'text' },
        { name: 'affiliateUser', label: '推薦人', type: 'relationship', relationTo: 'users' },
        { name: 'commissionRate', label: '佣金比例（%）', type: 'number', min: 0, max: 100 },
        { name: 'commissionAmount', label: '佣金金額', type: 'number', min: 0 },
        {
          name: 'commissionStatus',
          label: '佣金狀態',
          type: 'select',
          defaultValue: 'pending',
          options: [
            { label: '待確認', value: 'pending' },
            { label: '已確認', value: 'confirmed' },
            { label: '已發放', value: 'paid' },
            { label: '已取消', value: 'cancelled' },
          ],
        },
      ],
    },
    // ── 備註 ──
    {
      name: 'customerNote',
      label: '顧客備註',
      type: 'textarea',
    },
    {
      name: 'adminNote',
      label: '管理員備註（僅內部可見）',
      type: 'textarea',
      access: {
        read: ({ req: { user } }) => Boolean(user?.role === 'admin'),
      },
    },
  ],
  timestamps: true,
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, req, operation }) => {
        const payload = req.payload
        const status = doc.status as string
        const prevStatus = previousDoc?.status as string | undefined

        // ── 新訂單建立：自動扣庫存 ──
        if (operation === 'create' || (status === 'processing' && prevStatus === 'pending')) {
          const items = doc.items as {
            product: string | { id: string }
            sku?: string
            quantity: number
          }[]

          for (const item of items) {
            const productId = typeof item.product === 'string' ? item.product : item.product?.id
            if (!productId) continue

            try {
              const product = await payload.findByID({ collection: 'products', id: productId })
              const variants = product.variants as { sku?: string; stock?: number }[] | undefined

              if (variants && variants.length > 0 && item.sku) {
                // 扣減指定變體庫存
                const updatedVariants = variants.map((v) => {
                  if (v.sku === item.sku) {
                    return { ...v, stock: Math.max(0, (v.stock ?? 0) - item.quantity) }
                  }
                  return v
                })
                await (payload.update as Function)({
                  collection: 'products',
                  id: productId,
                  data: { variants: updatedVariants } as unknown as Record<string, unknown>,
                })
              } else {
                // 扣減總庫存
                const currentStock = (product.stock as number) ?? 0
                await (payload.update as Function)({
                  collection: 'products',
                  id: productId,
                  data: { stock: Math.max(0, currentStock - item.quantity) },
                })
              }
            } catch (err) {
              console.error(`[Orders Hook] 庫存扣減失敗 (product: ${productId}):`, err)
            }
          }
        }

        // ── 訂單送達：自動發放點數（讀取 LoyaltySettings） ──
        if (status === 'delivered' && prevStatus !== 'delivered') {
          try {
            const loyaltySettings = await payload.findGlobal({ slug: 'loyalty-settings' })
            const autoTriggers = loyaltySettings.autoTriggers as unknown as Record<string, unknown> | undefined
            const pointsConfig = loyaltySettings.pointsConfig as unknown as Record<string, unknown> | undefined

            if (autoTriggers?.awardOnOrderDelivered && pointsConfig?.enabled) {
              const pointsPerDollar = (pointsConfig.pointsPerDollar as number) ?? 1
              const orderTotal = (doc.total as number) ?? 0
              const basePoints = Math.floor(orderTotal * pointsPerDollar)

              // 取得會員等級倍率
              const customerId = typeof doc.customer === 'string' ? doc.customer : (doc.customer as unknown as Record<string, unknown>)?.id as unknown as string
              if (customerId) {
                const customer = await payload.findByID({ collection: 'users', id: customerId })
                const tierSlug = (customer.memberTier as unknown as string) || 'bronze'
                const tierMultipliers = loyaltySettings.tierMultipliers as unknown as Record<string, unknown> | undefined
                const multiplierKey = `${tierSlug}Multiplier`
                const multiplier = (tierMultipliers?.[multiplierKey] as number) ?? 1
                const pointsEarned = Math.floor(basePoints * multiplier)

                // 實際寫入 User 點數
                const currentPoints = (customer.points as number) ?? 0
                await (payload.update as Function)({
                  collection: 'users',
                  id: customerId,
                  data: { points: currentPoints + pointsEarned },
                })
                console.log(`[Loyalty] 訂單 ${doc.orderNumber} 送達，會員 ${customerId} 獲得 ${pointsEarned} 點（${tierSlug} ${multiplier}x）`)
              }
            }
          } catch (err) {
            console.error('[Orders Hook] 點數發放失敗:', err)
          }
        }

        // ── 訂單取消：自動回補庫存 ──
        if (status === 'cancelled' && prevStatus !== 'cancelled') {
          const items = doc.items as {
            product: string | { id: string }
            sku?: string
            quantity: number
          }[]

          for (const item of items) {
            const productId = typeof item.product === 'string' ? item.product : item.product?.id
            if (!productId) continue

            try {
              const product = await payload.findByID({ collection: 'products', id: productId })
              const variants = product.variants as { sku?: string; stock?: number }[] | undefined

              if (variants && variants.length > 0 && item.sku) {
                const updatedVariants = variants.map((v) => {
                  if (v.sku === item.sku) {
                    return { ...v, stock: (v.stock ?? 0) + item.quantity }
                  }
                  return v
                })
                await (payload.update as Function)({
                  collection: 'products',
                  id: productId,
                  data: { variants: updatedVariants } as unknown as Record<string, unknown>,
                })
              } else {
                const currentStock = (product.stock as number) ?? 0
                await (payload.update as Function)({
                  collection: 'products',
                  id: productId,
                  data: { stock: currentStock + item.quantity },
                })
              }
            } catch (err) {
              console.error(`[Orders Hook] 庫存回補失敗 (product: ${productId}):`, err)
            }
          }
        }
      },
      // ── pending → processing：寄訂單確認信給顧客 ──
      async ({ doc, previousDoc, req }) => {
        const status = doc.status as string
        const prevStatus = previousDoc?.status as string | undefined
        if (status === 'processing' && prevStatus === 'pending') {
          sendOrderConfirmationEmail(req.payload, doc as unknown as Record<string, unknown>).catch(
            (err) => console.error('[Orders Hook] 訂單確認信寄送失敗:', err),
          )
        }
      },
      // ── 付款成功：自動開立電子發票 ──
      async ({ doc, previousDoc, operation }) => {
        const paymentStatus = doc.paymentStatus as string
        const prevPaymentStatus = previousDoc?.paymentStatus as string | undefined

        // 只在付款狀態變為 paid 時觸發
        if (paymentStatus === 'paid' && prevPaymentStatus !== 'paid') {
          try {
            const result = await autoIssueInvoiceForOrder(doc.id as unknown as string)
            if (result.success) {
              console.log(`[Orders Hook] 訂單 ${doc.orderNumber} 自動開立發票成功`)
            } else {
              console.error(`[Orders Hook] 訂單 ${doc.orderNumber} 自動開立發票失敗:`, result.error)
            }
          } catch (err) {
            console.error(`[Orders Hook] 自動開立發票異常:`, err)
          }
        }
      },
      // ── 信用分數 Hook ──
      orderCreditScoreHook,
    ],
  },
}
