import type { CollectionConfig, Access, Where } from 'payload'
import { APIError } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { recordInventory } from '../lib/inventory/server'
import { adjustWallet } from '../lib/wallet/server'
import { createExportEndpoint, type FieldMapping } from '../endpoints/importExport'
import { orderCreditScoreHook } from '../lib/crm/creditScoreHooks'
import { autoIssueInvoiceForOrder } from '../lib/invoice/ecpayInvoiceEngine'
import { sendOrderConfirmationEmail } from '../lib/email/orderConfirmation'
import { sendPaymentReceivedEmail } from '../lib/email/paymentReceived'
import { sendOrderShippedEmail } from '../lib/email/orderShipped'
import { sendOrderDeliveredEmail } from '../lib/email/orderDelivered'
import { sendOrderCancelledEmail } from '../lib/email/orderCancelled'
import { sendOrderRefundedEmail } from '../lib/email/orderRefunded'
import { sendAdminNewOrderAlert } from '../lib/email/adminNewOrderAlert'
import { calculateTier, TIER_LEVELS } from '../lib/crm/tierEngine'
import {
  beforeChangeServerPricing,
  afterChangeWritePromotionRecords,
  afterChangeReversePromotions,
} from '../lib/promotions/orderPricingHook'
import { beforeChangeAffiliateAttribution } from '../lib/affiliate/orderAttributionHook'
import {
  afterChangeReverseOrderFinancials,
  writePurchasePointsLedger,
} from '../lib/commerce/orderReversal'
import { triggerJourney } from '../lib/crm/automationEngine'
import { generateOrderNumber, type OrderNumberingSettings } from '../lib/commerce/orderNumbering'
import { calculateOrderTax, type TaxSettingsLike } from '../lib/commerce/calculateTax'
import {
  mintCardsForPaidOrder,
  revokeCardsForCancelledOrder,
} from '../utils/mintCollectibleCards'

/**
 * 訂單讀取權限：
 * - Admin：看全部
 * - Partner：只看自己推薦的訂單（affiliateInfo.affiliateUser === user.id）
 * - Customer：只看自己的訂單（customer === user.id）
 */
const readOwnOrReferral: Access = ({ req: { user } }) => {
  if (!user) return false
  const role = (user as { role?: string }).role
  if (role === 'admin') return true
  if (role === 'partner') {
    return { 'affiliateInfo.affiliateUser': { equals: user.id } } as Where
  }
  return { customer: { equals: user.id } }
}

const orderFieldMappings: FieldMapping[] = [
  // 識別
  { key: 'orderNumber', label: '訂單編號' },
  { key: 'createdAt', label: '建立時間' },
  { key: 'status', label: '訂單狀態' },
  // 顧客（depth 預設 2 會 populate customer relationship）
  { key: 'customer.email', label: '顧客 Email' },
  { key: 'customer.name', label: '顧客姓名' },
  // 收件
  { key: 'shippingAddress.recipientName', label: '收件人' },
  { key: 'shippingAddress.phone', label: '收件電話' },
  { key: 'shippingAddress.zipCode', label: '郵遞區號' },
  { key: 'shippingAddress.city', label: '縣市' },
  { key: 'shippingAddress.district', label: '鄉鎮區' },
  { key: 'shippingAddress.address', label: '詳細地址' },
  // 金額
  { key: 'subtotal', label: '商品小計' },
  { key: 'shippingFee', label: '運費' },
  { key: 'codFee', label: 'COD 手續費' },
  { key: 'discountAmount', label: '折扣金額' },
  { key: 'taxAmount', label: '稅額' },
  { key: 'total', label: '訂單總額' },
  // 付款
  { key: 'paymentMethod', label: '付款方式' },
  { key: 'paymentStatus', label: '付款狀態' },
  { key: 'paymentTransactionId', label: '金流交易編號' },
  // 物流
  { key: 'shippingMethod.methodName', label: '配送方式' },
  { key: 'shippingMethod.carrier', label: '物流商' },
  { key: 'trackingNumber', label: '託運單號' },
  // 優惠
  { key: 'couponCode', label: '優惠碼' },
  // 備註
  { key: 'customerNote', label: '顧客備註' },
  { key: 'adminNote', label: '管理備註' },
]

export const Orders: CollectionConfig = {
  slug: 'orders',
  labels: { singular: '訂單', plural: '訂單' },
  admin: {
    useAsTitle: 'orderNumber',
    defaultColumns: ['orderNumber', 'customer', 'total', 'quickProcess', 'paymentMethod', 'paymentStatus', 'createdAt'],
    listSearchableFields: ['orderNumber', 'customerEmail', 'customerName'],
    group: '① 訂單與物流',
    description: '訂單紀錄與管理（含出貨單列印、取貨總報表）',
    components: {
      beforeListTable: [
        {
          path: '@/components/admin/OrderBulkShipPanel',
        },
        {
          path: '@/components/admin/OrderToolsPanel',
        },
        {
          path: '@/components/admin/OrderExportButton',
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
      admin: {
        readOnly: true,
        description:
          '下單時自動產生（讀 OrderSettings.numbering）。若 admin 手動建單留白，hook 會 beforeChange 階段補齊。',
      },
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
    {
      // 訪客結帳（WO-BP002 C）：customer 指向自動建立的 is_guest 臨時帳號
      // （合成信箱不可投遞），這裡放顧客真正填的聯絡信箱 —— 所有訂單信件
      // 都優先讀這欄。會員單留空。
      name: 'guestEmail',
      label: '訪客聯絡信箱',
      type: 'email',
      admin: {
        readOnly: true,
        description: '訪客結帳時顧客填寫的信箱；會員訂單留空（以會員信箱寄送）',
        condition: (data) => Boolean(data?.guestEmail),
      },
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
        // ── 19D 促銷三件套：加購 / 贈品 / 組合商品標記 ──
        { name: 'bundleRef', label: '組合商品', type: 'relationship', relationTo: 'bundles', admin: { description: '此行若屬於某組合商品的一部分則標記' } },
        { name: 'isGift', label: '是否為贈品', type: 'checkbox', defaultValue: false, admin: { description: '贈品行 price 應為 0，不列入 subtotal' } },
        { name: 'isAddOn', label: '是否為加購品', type: 'checkbox', defaultValue: false },
        { name: 'giftRuleRef', label: '觸發贈品規則', type: 'relationship', relationTo: 'gift-rules' },
        { name: 'addOnRuleRef', label: '觸發加購規則', type: 'relationship', relationTo: 'add-on-products' },
      ],
    },
    // ── 寶物箱隨單寄出獎項 ──
    // 由 beforeChange hook 在 order create 時自動從 UserRewards 撈進來；
    // admin 也可以手動編輯這個 array（例如客服補償場景）。不影響訂單總額。
    {
      name: 'gifts',
      label: '隨單寄出寶物箱獎項',
      type: 'array',
      fields: [
        { name: 'reward', label: '獎項', type: 'relationship', relationTo: 'user-rewards', required: true },
        { name: 'rewardType', label: '類型（快照）', type: 'text' },
        { name: 'displayName', label: '顯示名稱（快照）', type: 'text' },
        { name: 'amount', label: '數量/面額（快照）', type: 'number' },
      ],
      admin: {
        description:
          '此訂單隨單寄出的寶物箱獎項（自動從會員未使用實體獎項附加，不影響訂單總金額）。admin 可手動調整。',
      },
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
      name: 'subtotalBeforeDiscount',
      label: '優惠前小計',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: { readOnly: true, description: '套用 coupon 之前的 subtotal 快照' },
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
      name: 'couponCode',
      label: '優惠券代碼',
      type: 'text',
      admin: { readOnly: true, description: '結帳時套用的 coupon code 快照' },
    },
    {
      name: 'coupon',
      label: '優惠券（主要 / 相容舊單）',
      type: 'relationship',
      relationTo: 'coupons',
      admin: { readOnly: true },
    },
    {
      name: 'appliedCoupons',
      label: '套用的優惠券（多張疊加）',
      type: 'json',
      admin: {
        readOnly: true,
        description: '多券疊加快照 [{coupon, couponCode, discountAmount}]；各券 usageCount 由 CouponRedemptions per-coupon 累加',
      },
    },
    // ── Campaign Engine（CHIC Commerce OS P0）：伺服器計價快照 ────────────
    // 建單時由 Orders.beforeChange 的 promotion pricing hook 寫入；不可變。
    // 財務對帳：本快照 + promotion-applications；behavior-events 只做分析。
    {
      name: 'promotion',
      label: '促銷計價快照',
      type: 'group',
      admin: { description: '伺服器重算結果（quote / 套用規則 / 分攤）；client 金額不可信' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'quoteId', label: 'Quote ID', type: 'text', admin: { readOnly: true } },
            {
              name: 'pricingVersion',
              label: '計價引擎版本',
              type: 'text',
              admin: { readOnly: true },
            },
            {
              name: 'serverEnforced',
              label: '伺服器強制計價',
              type: 'checkbox',
              defaultValue: false,
              admin: { readOnly: true, description: '此單金額是否經伺服器重算驗證' },
            },
          ],
        },
        { name: 'quoteHash', label: 'Quote Hash', type: 'text', admin: { readOnly: true } },
        {
          type: 'row',
          fields: [
            {
              name: 'discountTotal',
              label: '活動折抵合計',
              type: 'number',
              defaultValue: 0,
              min: 0,
              admin: { readOnly: true, description: '促銷規則折抵（不含券/會員折扣欄位）' },
            },
            {
              name: 'shippingDiscountTotal',
              label: '運費折抵合計',
              type: 'number',
              defaultValue: 0,
              min: 0,
              admin: { readOnly: true },
            },
          ],
        },
        {
          name: 'appliedPromotionSnapshots',
          label: '套用規則快照',
          type: 'json',
          admin: {
            readOnly: true,
            description: '[{ ruleKey, version, source, effectType, discountAmount, allocations[] }]',
          },
        },
        {
          name: 'rewardIntents',
          label: '獎勵意圖快照',
          type: 'json',
          admin: {
            readOnly: true,
            description: 'XP / Mystery Key / 點數倍率等；實際發放由 Reward Orchestrator（P1）處理',
          },
        },
      ],
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
    // ── 稅額 ──
    // beforeChange hook 會依 TaxSettings + 各 line item 的 product.taxCategory
    // 自動填這 4 個欄位（admin 可 override，但每次 save 會重算）。
    {
      name: 'taxAmount',
      label: '稅額（商品 + 運費）',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: { readOnly: true, description: '由系統依 TaxSettings 自動計算' },
    },
    {
      name: 'taxRate',
      label: '適用稅率（%）',
      type: 'number',
      defaultValue: 5,
      min: 0,
      admin: { readOnly: true },
    },
    {
      name: 'subtotalExcludingTax',
      label: '商品未稅小計',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: { readOnly: true },
    },
    {
      name: 'shippingTaxAmount',
      label: '運費稅額',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: { readOnly: true },
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
        { label: '已退回', value: 'returned' },
        { label: '已取消', value: 'cancelled' },
        { label: '已退款', value: 'refunded' },
      ],
      admin: {
        description:
          'returned＝包裹退回（未取退回門市/賣家已取回），由綠界物流貨態自動標或手動標；後續退款仍走 refunded',
      },
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
        // ── ECPay C2C 託運單（/Express/Create 發號後回寫；LAUNCH §4-6 後續） ──
        {
          name: 'ecpayLogisticsId',
          label: '綠界物流交易編號',
          type: 'text',
          admin: { description: 'AllPayLogisticsID——超商發號後回寫，已有值不重覆發號' },
        },
        {
          name: 'cvsPaymentNo',
          label: '寄貨編號',
          type: 'text',
          admin: { description: 'CVSPaymentNo——門市代寄用，同步寫入訂單追蹤號' },
        },
        {
          name: 'cvsValidationNo',
          label: '寄貨驗證碼',
          type: 'text',
          admin: { description: 'CVSValidationNo——僅 7-11 C2C，列印託運單要用' },
        },
        {
          name: 'logisticsStatus',
          label: '物流狀態',
          type: 'text',
          admin: { description: '綠界物流狀態通知（ServerReplyURL）最新一筆：代碼|訊息|時間' },
        },
        {
          name: 'returnLogisticsId',
          label: '逆物流交易編號',
          type: 'text',
          admin: { description: '宅配退貨（ReturnHome）建立後標記；超商 C2C 退貨走門市自動退回無編號' },
        },
        {
          name: 'returnLogisticsStatus',
          label: '逆物流狀態',
          type: 'text',
          admin: { description: '退貨貨態最新一筆：代碼|訊息|時間' },
        },
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
    // ── UTM 歸因 ──
    {
      name: 'attribution',
      label: 'UTM 歸因',
      type: 'group',
      admin: {
        description:
          '訂單的 UTM 來源歸因。firstTouch = 該會員首次進站時的 UTM（90 天 cookie）；' +
          'lastTouch = 結帳當下 session 的 UTM。報表頁 /admin/reports/utm-attribution 用此資料聚合。',
      },
      fields: [
        {
          name: 'firstTouch',
          label: '首次接觸（First-touch）',
          type: 'group',
          fields: [
            { name: 'utmSource', label: 'UTM Source', type: 'text' },
            { name: 'utmMedium', label: 'UTM Medium', type: 'text' },
            { name: 'utmCampaign', label: 'UTM Campaign', type: 'text' },
            { name: 'utmTerm', label: 'UTM Term', type: 'text' },
            { name: 'utmContent', label: 'UTM Content', type: 'text' },
            { name: 'referrer', label: 'Referrer', type: 'text' },
            { name: 'capturedAt', label: '首次捕獲時間', type: 'date' },
          ],
        },
        {
          name: 'lastTouch',
          label: '最後接觸（Last-touch）',
          type: 'group',
          fields: [
            { name: 'utmSource', label: 'UTM Source', type: 'text' },
            { name: 'utmMedium', label: 'UTM Medium', type: 'text' },
            { name: 'utmCampaign', label: 'UTM Campaign', type: 'text' },
            { name: 'utmTerm', label: 'UTM Term', type: 'text' },
            { name: 'utmContent', label: 'UTM Content', type: 'text' },
            { name: 'referrer', label: 'Referrer', type: 'text' },
            { name: 'capturedAt', label: '最後捕獲時間', type: 'date' },
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
        read: ({ req: { user } }) => Boolean((user as { role?: string } | null | undefined)?.role === 'admin'),
      },
    },
  ],
  timestamps: true,
  endpoints: [createExportEndpoint('orders', orderFieldMappings)],
  hooks: {
    // ── 訂單編號自動產生（beforeValidate 以確保 required 驗證前已有值） ──
    // 若 caller（checkout / admin）已傳入 orderNumber 則尊重，不覆寫。
    // Fallback：OrderSettings 讀取失敗或 race 時退回「CKMU+YYYYMMDD+timestamp-tail」
    // 保證 DB NOT NULL / unique 不會擋下單。
    beforeValidate: [
      async ({ data, operation, req }) => {
        if (operation !== 'create' || !data) return data
        const incoming = String((data as Record<string, unknown>).orderNumber ?? '').trim()
        if (incoming) return data

        try {
          const settings = (await req.payload.findGlobal({
            slug: 'order-settings',
            depth: 0,
          })) as unknown as Record<string, unknown>
          const numbering = (settings?.numbering ?? {}) as OrderNumberingSettings
          const orderNumber = await generateOrderNumber(req.payload, numbering)
          return { ...data, orderNumber }
        } catch (err) {
          req.payload.logger?.error?.({
            err,
            msg: 'Orders beforeValidate: orderNumber auto-gen failed, using fallback',
          })
          const now = new Date()
          const ymd = now.toISOString().slice(0, 10).replace(/-/g, '')
          const tail = String(now.getTime()).slice(-6)
          return { ...data, orderNumber: `CKMU${ymd}${tail}` }
        }
      },
    ],
    beforeChange: [
      // ── 下單前庫存可用量檢查（LB-03）──
      // 只在 create 時跑：逐項比對可用庫存，數量超過且非預購商品 → 擋單（回 400，前端顯示訊息）。
      // 這是「拒絕超賣」的主要防線；afterChange 的 Math.max(0,…) 只當最後夾制，不再依賴它擋超賣。
      async ({ data, operation, req }) => {
        if (operation !== 'create' || !data) return data
        const items =
          ((data as Record<string, unknown>).items as
            | {
                product?: string | number | { id: string | number }
                sku?: string
                quantity?: number
                productName?: string
              }[]
            | undefined) || []
        for (const item of items) {
          // ⚠️ product 可能是 string（前台購物車的 id 是字串）、number（App / server 端
          // 建單、SQLite 原生 id）或 populated object。舊版只認 string + object，數字 id
          // 會讓 productId 變 undefined → 整個超賣防線被跳過（實測：庫存 5 可以下 8 單）。
          const rawProduct = item.product
          const productId =
            rawProduct != null && typeof rawProduct === 'object'
              ? (rawProduct as { id?: string | number }).id
              : rawProduct
          const qty = Number(item.quantity) || 0
          if (productId == null || productId === '' || qty <= 0) continue
          const product = (await req.payload
            .findByID({ collection: 'products', id: productId, depth: 0, req })
            .catch(() => null)) as Record<string, unknown> | null
          if (!product) continue
          if (product.allowPreOrder) continue // 預購商品允許缺貨下單
          const variants = product.variants as { sku?: string; stock?: number }[] | undefined
          let available: number
          if (variants && variants.length > 0 && item.sku) {
            available = Number(variants.find((v) => v.sku === item.sku)?.stock ?? 0)
          } else {
            available = Number(product.stock ?? 0)
          }
          if (qty > available) {
            const name = item.productName || (product.name as string) || '商品'
            throw new APIError(
              `「${name}」庫存不足，目前僅剩 ${available} 件，請調整數量後再結帳`,
              400,
            )
          }
        }
        return data
      },
      // ── Campaign Engine：伺服器計價強制（庫存檢查後、稅前）──
      // 重算全部金額 + 擋不一致訂單 + 活動預算原子預留；詳見 lib/promotions/orderPricingHook.ts
      beforeChangeServerPricing,
      // ── 稅額自動計算 ──
      // 每次 create/update 都重算（以保證 items 或 shippingFee 被 admin 手動改動後
      // tax 欄位跟上）。失敗時 log 但不 throw，讓訂單還是能存檔（客服場景）。
      async ({ data, req }) => {
        try {
          const taxSettings = (await req.payload.findGlobal({
            slug: 'tax-settings',
          })) as unknown as TaxSettingsLike
          if (!taxSettings) return data

          const rawItems = (data.items as unknown as Array<Record<string, unknown>> | undefined) ?? []
          const lineItems: { amount: number; taxCategory?: string }[] = []

          for (const li of rawItems) {
            const amount = Number(li?.subtotal ?? 0)
            if (!amount || amount <= 0) continue
            const productRef = li?.product
            let taxCategory: string | undefined
            const productId =
              typeof productRef === 'string' || typeof productRef === 'number'
                ? productRef
                : ((productRef as Record<string, unknown> | null)?.id as
                    | string
                    | number
                    | undefined)
            if (productId != null) {
              try {
                const prod = (await req.payload.findByID({
                  collection: 'products',
                  id: productId,
                  depth: 0,
                })) as unknown as Record<string, unknown>
                taxCategory = (prod?.taxCategory as string) || 'standard'
              } catch {
                taxCategory = 'standard'
              }
            }
            lineItems.push({ amount, taxCategory })
          }

          const shippingFee = Number(data.shippingFee ?? 0) || 0
          const result = calculateOrderTax(lineItems, shippingFee, taxSettings)

          return {
            ...data,
            taxAmount: result.taxAmount,
            taxRate: result.taxRate,
            subtotalExcludingTax: result.subtotalExcludingTax,
            shippingTaxAmount: result.shippingTaxAmount,
          }
        } catch (err) {
          req.payload.logger.error({ err, msg: 'Orders beforeChange: tax calc failed' })
          return data
        }
      },
      // ── 合作夥伴分潤歸因（total 已由 beforeChangeServerPricing 定案後才算佣金）──
      beforeChangeAffiliateAttribution,
      // ── 寶物箱自動附加 ──
      // 新訂單 create 時，把該會員所有 unused + 實體 + 未過期的 UserRewards
      // 自動塞進 data.gifts。admin 可以在 admin panel 手動先填 data.gifts，
      // 這種情況下 hook 不覆寫（已填 = 手動意圖）。
      async ({ data, operation, req }) => {
        if (operation !== 'create') return data
        const existingGifts = (data.gifts as unknown[] | undefined) ?? []
        if (existingGifts.length > 0) return data // 已手動填寫，尊重 admin 意圖

        const customerId =
          typeof data.customer === 'string' || typeof data.customer === 'number'
            ? data.customer
            : ((data.customer as unknown as Record<string, unknown>)?.id as string | number | undefined)
        if (!customerId) return data

        try {
          const nowISO = new Date().toISOString()
          const rewards = await req.payload.find({
            collection: 'user-rewards',
            where: {
              and: [
                { user: { equals: customerId } },
                { state: { equals: 'unused' } },
                { requiresPhysicalShipping: { equals: true } },
                { expiresAt: { greater_than: nowISO } },
              ],
            },
            limit: 50,
            depth: 0,
            overrideAccess: true,
          })
          if (rewards.docs.length === 0) return data

          const gifts = rewards.docs.map((r) => {
            const row = r as unknown as Record<string, unknown>
            return {
              reward: row.id as number,
              rewardType: String(row.rewardType ?? ''),
              displayName: String(row.displayName ?? ''),
              amount: typeof row.amount === 'number' ? row.amount : undefined,
            }
          })
          return { ...data, gifts }
        } catch (err) {
          req.payload.logger.error({
            err,
            msg: 'Orders beforeChange: UserRewards auto-attach failed',
            customerId,
          })
          return data
        }
      },
    ],
    afterChange: [
      // ── 優惠券兌換記錄 ──
      // order create 時若有 couponCode/coupon → 寫 CouponRedemptions 一筆
      // （該 collection 的 afterChange 會自動累加 coupons.usageCount）
      async ({ doc, operation, req }) => {
        if (operation !== 'create') return
        const customerId =
          typeof doc.customer === 'string' || typeof doc.customer === 'number'
            ? doc.customer
            : ((doc.customer as unknown as Record<string, unknown>)?.id as number | string | undefined)
        const resolveRel = (v: unknown): number | string | undefined =>
          typeof v === 'number' || typeof v === 'string'
            ? v
            : ((v as Record<string, unknown>)?.id as number | string | undefined)
        const writeRedemption = async (couponId: number | string | undefined, discount: number) => {
          if (couponId == null) return
          try {
            await (req.payload.create as Function)({
              collection: 'coupon-redemptions',
              data: {
                coupon: couponId,
                user: customerId,
                order: doc.id,
                discountAmount: discount,
                redeemedAt: new Date().toISOString(),
              },
              overrideAccess: true,
            })
          } catch (err) {
            req.payload.logger.error({
              err,
              msg: 'Orders afterChange: CouponRedemptions 建立失敗',
              couponId,
              orderId: doc.id,
            })
          }
        }

        // 多券疊加：每張各寫一筆 redemption（各自累加 usageCount）。含免運券（discount 0）也記。
        const applied = Array.isArray(doc.appliedCoupons)
          ? (doc.appliedCoupons as Array<Record<string, unknown>>)
          : []
        if (applied.length > 0) {
          for (const ac of applied) {
            await writeRedemption(resolveRel(ac.coupon ?? ac.couponId), Number(ac.discountAmount) || 0)
          }
          return
        }

        // 後備（舊單 / 單券路徑）：用 doc.coupon + 總折扣
        const couponRel = doc.coupon as number | string | Record<string, unknown> | null | undefined
        const discount = (doc.discountAmount as number) ?? 0
        if (!couponRel || discount <= 0) return
        await writeRedemption(resolveRel(couponRel), discount)
      },
      async ({ doc, previousDoc, req, operation }) => {
        const payload = req.payload
        const status = doc.status as string
        const prevStatus = previousDoc?.status as string | undefined

        // ── 新訂單建立：自動扣庫存 ──
        // LB-03：只在 create 扣一次庫存。原本 pending→processing 也扣，造成每張訂單雙重扣減。
        // 缺貨拒單已移到 beforeChange 的可用量檢查；此處 Math.max(0,…) 僅作最後夾制。
        if (operation === 'create') {
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

              let newBal: number | null = null
              if (variants && variants.length > 0 && item.sku) {
                // 扣減指定變體庫存
                const updatedVariants = variants.map((v) => {
                  if (v.sku === item.sku) {
                    newBal = Math.max(0, (v.stock ?? 0) - item.quantity)
                    return { ...v, stock: newBal }
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
                newBal = Math.max(0, currentStock - item.quantity)
                await (payload.update as Function)({
                  collection: 'products',
                  id: productId,
                  data: { stock: newBal },
                })
              }

              // 進銷存：寫銷售出庫流水（best-effort；recordInventory 內含 try/catch，不影響下單）
              if (newBal !== null && item.quantity) {
                await recordInventory(payload, {
                  productId,
                  sku: item.sku,
                  type: 'sale_out',
                  quantityDelta: -item.quantity,
                  balanceAfter: newBal,
                  relatedOrder: doc.id as string | number,
                  note: `訂單 ${(doc.orderNumber as string) || doc.id} 出庫`,
                })
              }
            } catch (err) {
              console.error(`[Orders Hook] 庫存扣減失敗 (product: ${productId}):`, err)
            }
          }
        }

        // ── 付款完成：發點數 + 更新累積消費/訂單統計 ──
        // 觸發時機改成 paymentStatus === 'paid'（原本掛在 status==='delivered'）：
        //   - Credit card / PayPal / LINE Pay：付款成功當下即觸發
        //   - COD：driver 確認 + admin 勾 paid 時觸發
        //   - 讓會員「買完 → 立刻看到點數入帳 + 消費金額更新」，不用等到出貨送達
        // 舊的 delivered-trigger 會 double-credit，所以整塊搬到這裡。
        const paymentStatus = doc.paymentStatus as string
        const prevPaymentStatus = previousDoc?.paymentStatus as string | undefined
        if (paymentStatus === 'paid' && prevPaymentStatus !== 'paid') {
          // ── totalSold 累加（付款當下；powers 熱銷排序 / 推薦 trending / 毛利洞察）──
          // 依商品去重（同商品多變體 line item 合計）；贈品不計入真實銷量。
          try {
            const paidItems =
              (doc.items as Array<{
                product: string | { id: string }
                quantity?: number
                isGift?: boolean
              }>) || []
            const soldDelta = new Map<string, number>()
            for (const it of paidItems) {
              if (it.isGift) continue
              const pid = typeof it.product === 'string' ? it.product : it.product?.id
              const qty = Number(it.quantity) || 0
              if (!pid || qty <= 0) continue
              soldDelta.set(String(pid), (soldDelta.get(String(pid)) || 0) + qty)
            }
            for (const [pid, qty] of soldDelta) {
              try {
                const p = await payload.findByID({ collection: 'products', id: pid, depth: 0 })
                const cur = Number((p as unknown as Record<string, unknown>).totalSold) || 0
                await (payload.update as Function)({
                  collection: 'products',
                  id: pid,
                  data: { totalSold: cur + qty },
                })
              } catch (e) {
                console.error(`[Orders Hook] totalSold 累加失敗 (product ${pid}):`, e)
              }
            }
          } catch (e) {
            console.error('[Orders Hook] totalSold 累加整體失敗:', e)
          }

          // ── 分潤：付款後累加合作夥伴佣金（event-driven；冪等靠 commissionStatus pending→confirmed）──
          try {
            const aff = (doc.affiliateInfo as Record<string, unknown> | undefined) || {}
            const affUserRaw = aff.affiliateUser
            const affUserId =
              typeof affUserRaw === 'object' && affUserRaw !== null
                ? (affUserRaw as { id: unknown }).id
                : affUserRaw
            const commission = Number(aff.commissionAmount) || 0
            if (affUserId && commission > 0 && aff.commissionStatus === 'pending') {
              const affRes = await payload.find({
                collection: 'affiliates',
                where: { user: { equals: affUserId } },
                limit: 1,
                depth: 0,
              })
              const affDoc = affRes.docs[0] as unknown as Record<string, unknown> | undefined
              if (affDoc) {
                await (payload.update as Function)({
                  collection: 'affiliates',
                  id: affDoc.id as string | number,
                  data: {
                    totalEarnings: (Number(affDoc.totalEarnings) || 0) + commission,
                    pendingAmount: (Number(affDoc.pendingAmount) || 0) + commission,
                  },
                })
                // 標記已入帳（冪等；nested update 的 paymentStatus 仍 paid→paid 不重觸發本區塊）
                await (payload.update as Function)({
                  collection: 'orders',
                  id: doc.id,
                  data: {
                    affiliateInfo: {
                      referralCode: aff.referralCode,
                      affiliateUser: affUserId,
                      commissionRate: aff.commissionRate,
                      commissionAmount: commission,
                      commissionStatus: 'confirmed',
                    },
                  },
                })
              }
            }
          } catch (e) {
            console.error('[Orders Hook] 分潤佣金累加失敗:', e)
          }

          const customerId =
            typeof doc.customer === 'string'
              ? doc.customer
              : ((doc.customer as unknown as Record<string, unknown>)?.id as unknown as string)
          const orderTotal = (doc.total as number) ?? 0

          if (customerId) {
            try {
              const customer = await payload.findByID({ collection: 'users', id: customerId })
              const customerData = customer as unknown as Record<string, unknown>

              // ── 點數發放（依 LoyaltySettings + 會員倍率） ──
              let pointsEarned = 0
              try {
                const loyaltySettings = await payload.findGlobal({ slug: 'loyalty-settings' })
                const autoTriggers = loyaltySettings.autoTriggers as unknown as Record<string, unknown> | undefined
                const pointsConfig = loyaltySettings.pointsConfig as unknown as Record<string, unknown> | undefined

                // Accept either legacy awardOnOrderDelivered or new awardOnOrderPaid flag —
                // the semantic intent was always "award on order completion", just shifted
                // to paid. Admins don't need to flip a new toggle.
                const shouldAward =
                  Boolean(autoTriggers?.awardOnOrderPaid ?? autoTriggers?.awardOnOrderDelivered) &&
                  Boolean(pointsConfig?.enabled)

                if (shouldAward) {
                  const pointsPerDollar = (pointsConfig?.pointsPerDollar as number) ?? 1
                  const basePoints = Math.floor(orderTotal * pointsPerDollar)

                  const rawTier = customerData.memberTier
                  const tierSlug =
                    typeof rawTier === 'string'
                      ? rawTier
                      : ((rawTier as unknown as Record<string, unknown>)?.slug as string) || 'bronze'
                  const tierMultipliers =
                    loyaltySettings.tierMultipliers as unknown as Record<string, unknown> | undefined
                  const multiplier = (tierMultipliers?.[`${tierSlug}Multiplier`] as number) ?? 1

                  // 訂閱會員點數倍率（SubscriptionPlans.benefits.pointsMultiplier）
                  // 疊乘在 tier 倍率之上；無生效訂閱 = 1。查詢失敗不影響基礎發放。
                  let subscriptionMultiplier = 1
                  try {
                    const { getActiveMembership } = await import('../lib/subscription/activate')
                    const m = await getActiveMembership(payload, customerData)
                    const pm = Number(m?.plan.benefits?.pointsMultiplier)
                    if (Number.isFinite(pm) && pm > 0) subscriptionMultiplier = pm
                  } catch (subErr) {
                    console.error('[Orders Hook] 訂閱倍率查詢失敗（用 1）:', subErr)
                  }
                  pointsEarned = Math.floor(basePoints * multiplier * subscriptionMultiplier)
                }
              } catch (err) {
                console.error('[Orders Hook] LoyaltySettings 讀取失敗:', err)
              }

              // ── 累積消費 / 訂單統計（單一 users.update 打平所有欄位） ──
              const currentPoints = (customerData.points as number) ?? 0
              const currentTotalSpent = (customerData.totalSpent as number) ?? 0
              const currentLifetimeSpend = (customerData.lifetimeSpend as number) ?? 0
              const currentAnnualSpend = (customerData.annualSpend as number) ?? 0
              const currentOrderCount = (customerData.orderCount as number) ?? 0

              await (payload.update as Function)({
                collection: 'users',
                id: customerId,
                data: {
                  points: currentPoints + pointsEarned,
                  totalSpent: currentTotalSpent + orderTotal,
                  lifetimeSpend: currentLifetimeSpend + orderTotal,
                  annualSpend: currentAnnualSpend + orderTotal,
                  orderCount: currentOrderCount + 1,
                  lastOrderDate: new Date().toISOString(),
                },
              })
              // 補寫 points-transactions 帳本（既有缺口：以往只改 users.points，
              // 帳本無 purchase row → 無法重建餘額、退款也無從回收）。
              // local API 呼叫，PointsTransactions 的 sync hooks 不會重複加點。
              await writePurchasePointsLedger(payload, {
                userId: customerId,
                orderId: doc.id as number | string,
                orderNumber: doc.orderNumber as string | undefined,
                points: pointsEarned,
                balanceAfter: currentPoints + pointsEarned,
              })
              console.log(
                `[Orders Hook] 付款完成：${doc.orderNumber} 會員 ${customerId} +${pointsEarned} 點，累積消費 +NT$${orderTotal}`,
              )

              // ── 推薦首購獎勵（首筆付款訂單觸發一次；發購物金給推薦人+被推薦人，寫錢包帳本）──
              try {
                if (currentOrderCount === 0) {
                  const referredByRaw = customerData.referredBy
                  const referrerId =
                    typeof referredByRaw === 'object' && referredByRaw !== null
                      ? (referredByRaw as { id: unknown }).id
                      : referredByRaw
                  if (referrerId) {
                    const refSettings = (await payload.findGlobal({
                      slug: 'referral-settings',
                      depth: 0,
                    })) as unknown as Record<string, unknown>
                    const rewards = (refSettings.rewards as Record<string, unknown>) || {}
                    const minAmount = Number(rewards.minPurchaseAmount) || 0
                    if (rewards.enabled !== false && orderTotal >= minAmount) {
                      const refereeReward = Number(rewards.refereePurchaseReward) || 0
                      const referrerReward = Number(rewards.referrerPurchaseReward) || 0
                      if (refereeReward > 0) {
                        await adjustWallet(payload, {
                          userId: customerId,
                          wallet: 'shoppingCredit',
                          amount: refereeReward,
                          type: 'earn',
                          source: 'referral',
                          description: '推薦首購回饋（被推薦人）',
                        })
                      }
                      if (referrerReward > 0 && String(referrerId) !== String(customerId)) {
                        await adjustWallet(payload, {
                          userId: referrerId as string | number,
                          wallet: 'shoppingCredit',
                          amount: referrerReward,
                          type: 'earn',
                          source: 'referral',
                          description: `推薦首購回饋（您推薦的好友完成首購）`,
                        })
                      }
                    }
                  }
                }
              } catch (e) {
                console.error('[Orders Hook] 推薦首購獎勵失敗:', e)
              }

              // ── 自動升等（只升不降；降等由 /api/cron/annual-tier-reset 處理） ──
              try {
                const newLifetime = currentLifetimeSpend + orderTotal
                const newAnnual = currentAnnualSpend + orderTotal
                const newTierSlug = calculateTier(newLifetime, newAnnual)
                const rawOldTier = customerData.memberTier
                const oldTierSlug =
                  typeof rawOldTier === 'string'
                    ? rawOldTier
                    : ((rawOldTier as unknown as Record<string, unknown>)?.slug as string) || 'ordinary'
                const oldLevel = TIER_LEVELS[oldTierSlug] ?? 0
                const newLevel = TIER_LEVELS[newTierSlug] ?? 0

                if (newLevel > oldLevel) {
                  const tierFind = await payload.find({
                    collection: 'membership-tiers',
                    where: { slug: { equals: newTierSlug } } satisfies Where,
                    limit: 1,
                    depth: 0,
                  })
                  const newTierDoc = tierFind.docs[0] as unknown as Record<string, unknown> | undefined
                  if (newTierDoc) {
                    const newTierId = newTierDoc.id as string | number
                    const giftPoints = Number(newTierDoc.upgradeGiftPoints ?? 0) || 0
                    const frontName = (newTierDoc.frontName as string) ?? newTierSlug

                    await (payload.update as Function)({
                      collection: 'users',
                      id: customerId,
                      data: {
                        memberTier: newTierId,
                        ...(giftPoints > 0
                          ? { points: currentPoints + pointsEarned + giftPoints }
                          : {}),
                      },
                    })

                    if (giftPoints > 0) {
                      try {
                        await (payload.create as Function)({
                          collection: 'points-transactions',
                          data: {
                            user: customerId,
                            type: 'earn',
                            amount: giftPoints,
                            source: 'tier_upgrade',
                            description: `升級至「${frontName}」贈點`,
                          },
                        })
                      } catch (err) {
                        console.error('[Orders Hook] 升級贈點 txn 建立失敗:', err)
                      }
                    }

                    // 觸發所有 triggerEvent='tier_upgraded' 的 active event journey
                    try {
                      const journeys = await payload.find({
                        collection: 'automation-journeys',
                        where: {
                          and: [
                            { triggerType: { equals: 'event' } },
                            { triggerEvent: { equals: 'tier_upgraded' } },
                            { isActive: { equals: true } },
                          ],
                        } satisfies Where,
                        limit: 50,
                        depth: 0,
                      })
                      for (const j of journeys.docs) {
                        const slug = (j as unknown as Record<string, unknown>).slug as string | undefined
                        if (!slug) continue
                        triggerJourney(slug, {
                          userId: String(customerId),
                          event: 'tier_upgraded',
                          data: {
                            oldTierSlug,
                            newTierSlug,
                            newTierFrontName: frontName,
                            orderId: String(doc.id),
                            orderNumber: String(doc.orderNumber ?? ''),
                          },
                        }).catch((err) => console.error('[Orders Hook] tier_upgraded journey 觸發失敗:', err))
                      }
                    } catch (err) {
                      console.error('[Orders Hook] tier_upgraded journey 查詢失敗:', err)
                    }

                    console.log(
                      `[Orders Hook] 會員 ${customerId} 升等：${oldTierSlug} → ${newTierSlug}${giftPoints > 0 ? `（+${giftPoints} 贈點）` : ''}`,
                    )
                  }
                }
              } catch (err) {
                console.error('[Orders Hook] 升等判斷失敗:', err)
              }
            } catch (err) {
              console.error('[Orders Hook] 付款後統計更新失敗:', err)
            }
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
      // ── create：寄訂單確認信給顧客（OrderSettings.sendConfirmationEmail） ──
      // LB-05：改成下單當下觸發（原本掛在 pending→processing，顧客下單後收不到任何信，
      // 且要等店員手動推進狀態）。文案由 orderConfirmation.ts 依付款狀態動態決定，
      // 未付款現金單不會謊稱「已收到付款」。pending→processing 不再寄，避免重複。
      async ({ doc, operation, req }) => {
        if (operation !== 'create') return
        try {
          const settings = (await req.payload.findGlobal({
            slug: 'order-settings',
          })) as unknown as { notifications?: { sendConfirmationEmail?: boolean } }
          if (settings?.notifications?.sendConfirmationEmail === false) return
        } catch {
          // 讀 global 失敗沿用預設行為（寄）
        }
        sendOrderConfirmationEmail(req.payload, doc as unknown as Record<string, unknown>).catch(
          (err) => console.error('[Orders Hook] 訂單確認信寄送失敗:', err),
        )
        // LINE 推播（會員有 lineUid 才送；lineMessagingEnabled 總開關關閉 = no-op）
        import('../lib/line/orderNotifications')
          .then(({ sendOrderConfirmationLine }) =>
            sendOrderConfirmationLine(req.payload, doc as unknown as Record<string, unknown>),
          )
          .catch((err) => console.error('[Orders Hook] 訂單確認 LINE 推播失敗:', err))
      },
      // ── paymentStatus unpaid→paid：寄付款完成信給顧客 ──
      // 線上金流 callback 回填與 admin 手動標 paid 都會觸發。與 create 時的
      // 訂單確認信互補：確認信在未付款當下只說「訂單已成立」，這封才宣告收款。
      // 冪等靠 prev!=='paid' gate（與點數/發票/mint 卡同一模式）。
      async ({ doc, previousDoc, req }) => {
        const paymentStatus = doc.paymentStatus as string
        const prevPaymentStatus = previousDoc?.paymentStatus as string | undefined
        if (paymentStatus !== 'paid' || prevPaymentStatus === 'paid') return
        sendPaymentReceivedEmail(req.payload, doc as unknown as Record<string, unknown>).catch(
          (err) => console.error('[Orders Hook] 付款完成信寄送失敗:', err),
        )
      },
      // ── status → shipped：寄出貨通知信（OrderSettings.sendShippedEmail） ──
      async ({ doc, previousDoc, req }) => {
        const status = doc.status as string
        const prevStatus = previousDoc?.status as string | undefined
        if (status !== 'shipped' || prevStatus === 'shipped') return
        try {
          const settings = (await req.payload.findGlobal({
            slug: 'order-settings',
          })) as unknown as { notifications?: { sendShippedEmail?: boolean } }
          if (settings?.notifications?.sendShippedEmail === false) return
        } catch {
          // fall through — 預設寄
        }
        sendOrderShippedEmail(req.payload, doc as unknown as Record<string, unknown>).catch(
          (err) => console.error('[Orders Hook] 出貨通知信寄送失敗:', err),
        )
        // LINE 推播（會員有 lineUid 才送；lineMessagingEnabled 總開關關閉 = no-op）
        import('../lib/line/orderNotifications')
          .then(({ sendOrderShippedLine }) =>
            sendOrderShippedLine(req.payload, doc as unknown as Record<string, unknown>),
          )
          .catch((err) => console.error('[Orders Hook] 出貨 LINE 推播失敗:', err))
      },
      // ── status → delivered：寄送達通知信（OrderSettings.sendDeliveredEmail，預設寄） ──
      async ({ doc, previousDoc, req }) => {
        const status = doc.status as string
        const prevStatus = previousDoc?.status as string | undefined
        if (status !== 'delivered' || prevStatus === 'delivered') return
        try {
          const settings = (await req.payload.findGlobal({
            slug: 'order-settings',
          })) as unknown as { notifications?: { sendDeliveredEmail?: boolean } }
          if (settings?.notifications?.sendDeliveredEmail === false) return
        } catch {
          // fall through — 預設寄
        }
        sendOrderDeliveredEmail(req.payload, doc as unknown as Record<string, unknown>).catch(
          (err) => console.error('[Orders Hook] 送達通知信寄送失敗:', err),
        )
      },
      // ── status → cancelled：寄取消通知信（無 toggle，一律寄） ──
      async ({ doc, previousDoc, req }) => {
        const status = doc.status as string
        const prevStatus = previousDoc?.status as string | undefined
        if (status === 'cancelled' && prevStatus !== 'cancelled') {
          sendOrderCancelledEmail(req.payload, doc as unknown as Record<string, unknown>).catch(
            (err) => console.error('[Orders Hook] 取消通知信寄送失敗:', err),
          )
        }
      },
      // ── status → refunded：寄退款通知信（無 toggle，一律寄） ──
      async ({ doc, previousDoc, req }) => {
        const status = doc.status as string
        const prevStatus = previousDoc?.status as string | undefined
        if (status === 'refunded' && prevStatus !== 'refunded') {
          sendOrderRefundedEmail(req.payload, doc as unknown as Record<string, unknown>).catch(
            (err) => console.error('[Orders Hook] 退款通知信寄送失敗:', err),
          )
        }
      },
      // ── create：寄 admin 新單通知（OrderSettings.sendAdminNewOrderAlert + adminAlertEmails） ──
      async ({ doc, operation, req }) => {
        if (operation !== 'create') return
        try {
          const settings = (await req.payload.findGlobal({
            slug: 'order-settings',
          })) as unknown as {
            notifications?: {
              sendAdminNewOrderAlert?: boolean
              adminAlertEmails?: Array<{ email?: string }>
            }
          }
          const notif = settings?.notifications
          if (notif?.sendAdminNewOrderAlert === false) return
          const emails = (notif?.adminAlertEmails ?? [])
            .map((e) => e?.email)
            .filter((e): e is string => Boolean(e))
          if (emails.length === 0) return
          sendAdminNewOrderAlert(
            req.payload,
            doc as unknown as Record<string, unknown>,
            emails,
          ).catch((err) => console.error('[Orders Hook] admin 新單通知失敗:', err))
        } catch (err) {
          console.error('[Orders Hook] 讀 order-settings 失敗:', err)
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
      // ── 付款成功：Mint 造型卡（每件發 common，>NT$5000 商品額外發 limited） ──
      async ({ doc, previousDoc, req }) => {
        const paymentStatus = doc.paymentStatus as string
        const prevPaymentStatus = previousDoc?.paymentStatus as string | undefined
        if (paymentStatus === 'paid' && prevPaymentStatus !== 'paid') {
          try {
            const result = await mintCardsForPaidOrder(req.payload, {
              id: doc.id as string | number,
              orderNumber: doc.orderNumber as string | undefined,
              customer: doc.customer as string | number,
              items: (doc.items as unknown[]) as Parameters<typeof mintCardsForPaidOrder>[1]['items'],
            })
            console.log(
              `[Orders Hook] 訂單 ${doc.orderNumber} mint 卡：+${result.commonsMinted} common, +${result.limitedMinted} limited${result.errors.length ? `（errors: ${result.errors.length}）` : ''}`,
            )
            if (result.errors.length) {
              console.error('[Orders Hook] mint 卡部分失敗：', result.errors)
            }
          } catch (err) {
            console.error('[Orders Hook] mint 卡異常：', err)
          }
        }
      },
      // ── 訂單取消：撤回該訂單 mint 的造型卡（status=active 的才撤） ──
      async ({ doc, previousDoc, req }) => {
        const status = doc.status as string
        const prevStatus = previousDoc?.status as string | undefined
        if (status === 'cancelled' && prevStatus !== 'cancelled') {
          try {
            const result = await revokeCardsForCancelledOrder(
              req.payload,
              doc.id as string | number,
              doc.orderNumber as string | undefined,
            )
            if (result.revoked > 0) {
              console.log(
                `[Orders Hook] 訂單 ${doc.orderNumber} 取消撤卡：${result.revoked} 張`,
              )
            }
            if (result.errors.length) {
              console.error('[Orders Hook] 撤卡部分失敗：', result.errors)
            }
          } catch (err) {
            console.error('[Orders Hook] 撤卡異常：', err)
          }
        }
      },
      // ── 新訂單建立：收件地址自動寫回 user.addresses[] ──
      // 原本結帳頁的「儲存此地址到我的地址簿」勾選框只寫回當下編輯的 form state；
      // 客戶真正完成下單後地址沒有落地到 Users.addresses，下次結帳仍要重填一次。
      // 這個 hook 在 create 時把 shippingAddress 自動去重加進地址簿，讓封測會員的
      // 第二張訂單開始就能從地址簿直接挑（上一張訂單有存就跳過）。
      // 超商取貨 + 到辦公室取貨 (meetup) 都 skip — 門市地址 / 面交特殊格式不算個人地址。
      async ({ doc, operation, req }) => {
        if (operation !== 'create') return
        const payload = req.payload
        const customerId =
          typeof doc.customer === 'string'
            ? doc.customer
            : ((doc.customer as unknown as Record<string, unknown>)?.id as unknown as string)
        if (!customerId) return

        const shippingMethod = doc.shippingMethod as Record<string, unknown> | null | undefined
        const convenienceStore = shippingMethod?.convenienceStore as Record<string, unknown> | null | undefined
        if (convenienceStore?.storeName) return

        const addr = (doc.shippingAddress as Record<string, unknown> | null | undefined) ?? {}
        const addressStr = String(addr.address || '')
        // meetup / 面交 fake-address format — not a real postal address
        if (addressStr.startsWith('[到辦公室取貨]') || addressStr.startsWith('[面交]')) return
        if (!addressStr || !addr.city || !addr.recipientName) return

        try {
          const customer = (await payload.findByID({ collection: 'users', id: customerId })) as unknown as Record<string, unknown>
          const currentAddresses =
            (customer.addresses as Record<string, unknown>[] | null | undefined) ?? []

          const key = `${addr.recipientName ?? ''}|${addr.phone ?? ''}|${addr.city ?? ''}|${addr.district ?? ''}|${addr.address ?? ''}`
          const alreadySaved = currentAddresses.some(
            (a) =>
              `${a.recipientName ?? ''}|${a.phone ?? ''}|${a.city ?? ''}|${a.district ?? ''}|${a.address ?? ''}` === key,
          )
          if (alreadySaved) return

          const newEntry = {
            label: '',
            recipientName: (addr.recipientName as string) ?? '',
            phone: (addr.phone as string) ?? '',
            zipCode: (addr.zipCode as string) ?? '',
            city: (addr.city as string) ?? '',
            district: (addr.district as string) ?? '',
            address: (addr.address as string) ?? '',
            isDefault: currentAddresses.length === 0,
          }

          await (payload.update as Function)({
            collection: 'users',
            id: customerId,
            data: { addresses: [...currentAddresses, newEntry] },
          })
          console.log(`[Orders Hook] 收件地址自動寫回 users.addresses：${customerId}`)
        } catch (err) {
          console.error('[Orders Hook] 地址自動儲存失敗:', err)
        }
      },
      // ── 信用分數 Hook ──
      orderCreditScoreHook,
      // ── 寶物箱獎項 state 回流 ──
      // 1) create 且 doc.gifts 非空：把 UserRewards 標記 pending_attach + attachedToOrder=doc.id
      // 2) status → shipped / delivered：把本張單 attached 的 UserRewards 標 shipped + shippedAt
      // 3) status → cancelled / refunded：只把還沒寄出的 UserRewards (state=pending_attach)
      //    revert 成 unused；已 shipped 的不動（物已送出無法退）。
      async ({ doc, previousDoc, req, operation }) => {
        const payload = req.payload
        const rawOrderId = (doc as { id?: number | string }).id
        if (!rawOrderId) return
        const orderId = Number(rawOrderId)
        if (Number.isNaN(orderId)) return

        const gifts = ((doc.gifts as unknown[] | undefined) ?? []) as Array<Record<string, unknown>>
        const status = doc.status as string
        const prevStatus = previousDoc?.status as string | undefined

        // create：把 gifts 內每筆 UserRewards 更新 state=pending_attach
        if (operation === 'create' && gifts.length > 0) {
          for (const g of gifts) {
            const rawRewardId =
              typeof g.reward === 'number' || typeof g.reward === 'string'
                ? g.reward
                : ((g.reward as Record<string, unknown> | null)?.id as number | string | undefined)
            const rewardId = rawRewardId != null ? Number(rawRewardId) : NaN
            if (Number.isNaN(rewardId)) continue
            try {
              await payload.update({
                collection: 'user-rewards',
                id: rewardId,
                data: {
                  state: 'pending_attach',
                  attachedToOrder: orderId,
                },
                overrideAccess: true,
              })
            } catch (err) {
              payload.logger.error({
                err,
                msg: 'Orders afterChange: pending_attach 更新失敗',
                rewardId,
                orderId,
              })
            }
          }
        }

        // status → shipped / delivered：標 shipped + shippedAt
        const nowShipped =
          (status === 'shipped' && prevStatus !== 'shipped') ||
          (status === 'delivered' && prevStatus !== 'delivered' && prevStatus !== 'shipped')
        if (nowShipped) {
          try {
            const attached = await payload.find({
              collection: 'user-rewards',
              where: {
                and: [
                  { attachedToOrder: { equals: orderId } },
                  { state: { equals: 'pending_attach' } },
                ],
              },
              limit: 100,
              depth: 0,
              overrideAccess: true,
            })
            const shippedAt = new Date().toISOString()
            for (const r of attached.docs) {
              await payload.update({
                collection: 'user-rewards',
                id: Number((r as unknown as { id: number | string }).id),
                data: { state: 'shipped', shippedAt },
                overrideAccess: true,
              })
            }
          } catch (err) {
            payload.logger.error({
              err,
              msg: 'Orders afterChange: shipped 狀態回流失敗',
              orderId,
            })
          }
        }

        // status → cancelled / refunded：把尚未寄出的 rewards 還原為 unused
        const nowCancelled =
          (status === 'cancelled' && prevStatus !== 'cancelled') ||
          (status === 'refunded' && prevStatus !== 'refunded')
        if (nowCancelled) {
          try {
            const attached = await payload.find({
              collection: 'user-rewards',
              where: {
                and: [
                  { attachedToOrder: { equals: orderId } },
                  { state: { equals: 'pending_attach' } },
                ],
              },
              limit: 100,
              depth: 0,
              overrideAccess: true,
            })
            for (const r of attached.docs) {
              await payload.update({
                collection: 'user-rewards',
                id: Number((r as unknown as { id: number | string }).id),
                data: {
                  state: 'unused',
                  attachedToOrder: null as unknown as undefined,
                },
                overrideAccess: true,
              })
            }
          } catch (err) {
            payload.logger.error({
              err,
              msg: 'Orders afterChange: cancelled 狀態還原失敗',
              orderId,
            })
          }
        }
      },
      // ── Campaign Engine：促銷套用紀錄 + 分析事件（create）──
      afterChangeWritePromotionRecords,
      // ── Campaign Engine：取消 / 退款 → applications 回沖 + 活動預算歸還 ──
      afterChangeReversePromotions,
      // ── 取消 / 退款 → 券額度與點數回沖（修既有洩漏；見 lib/commerce/orderReversal.ts）──
      afterChangeReverseOrderFinancials,
    ],
  },
}
