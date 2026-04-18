'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { signIn } from 'next-auth/react'
import {
  CreditCard,
  Store,
  Smartphone,
  Lock,
  ChevronDown,
  ArrowLeft,
  Truck,
  Package,
  MapPin,
  Building2,
  Plane,
  Info,
  FileText,
  Heart,
} from 'lucide-react'
import { useCartStore } from '@/stores/cartStore'
import { CheckoutLastChance } from '@/components/recommendation/CheckoutLastChance'
import { trackBeginCheckout, trackPurchase, getStoredUTM } from '@/lib/tracking'

/* ── 付款方式 ── */
const PAYMENT_METHODS = [
  {
    id: 'paypal',
    name: 'PayPal',
    desc: '國際信用卡 / PayPal 帳戶',
    icon: CreditCard,
    color: 'text-blue-600',
  },
  {
    id: 'ecpay',
    name: '綠界科技 ECPay',
    desc: '信用卡 / ATM / 超商代碼',
    icon: CreditCard,
    color: 'text-green-600',
  },
  {
    id: 'newebpay',
    name: '藍新支付',
    desc: '信用卡 / WebATM / 超商',
    icon: Store,
    color: 'text-indigo-600',
  },
  {
    id: 'linepay',
    name: 'LINE Pay',
    desc: 'LINE 錢包快速付款',
    icon: Smartphone,
    color: 'text-[#06C755]',
  },
]

/* ── 物流方式 ── */
type ShippingType = 'home_delivery' | 'convenience_store' | 'international'

interface ShippingOption {
  id: string
  type: ShippingType
  carrier: string
  name: string
  description: string
  fee: number
  freeThreshold: number
  estimatedDays: string
}

/**
 * Shipping options are fetched from /api/shipping-settings on mount (reads
 * ShippingMethods collection + GlobalSettings.shipping). Previously hardcoded
 * here and mismatched with cart page's fallback, which is how customers saw
 * 「滿 1000 免運」in the cart and 「滿 1500 免運」at checkout.
 */
function getShippingIcon(carrier: string) {
  switch (carrier) {
    case '711':
    case 'family':
    case 'hilife':
    case 'ok':
      return Building2
    case 'dhl':
    case 'fedex':
      return Plane
    case 'post':
      return Package
    case 'tcat':
    case 'hct':
    default:
      return Truck
  }
}

const TAIWAN_CITIES = [
  '台北市', '新北市', '桃園市', '台中市', '台南市', '高雄市',
  '基隆市', '新竹市', '新竹縣', '苗栗縣', '彰化縣', '南投縣',
  '雲林縣', '嘉義市', '嘉義縣', '屏東縣', '宜蘭縣', '花蓮縣',
  '台東縣', '澎湖縣', '金門縣', '連江縣',
]

export default function CheckoutPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { items, clearCart } = useCartStore()
  const [selectedPayment, setSelectedPayment] = useState('ecpay')
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([])
  const [selectedShipping, setSelectedShipping] = useState<string>('')
  const [shippingTypeFilter, setShippingTypeFilter] = useState<ShippingType>('convenience_store')
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/shipping-settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data || !Array.isArray(data.methods)) return
        const opts = data.methods as ShippingOption[]
        setShippingOptions(opts)
        // Default selection: first convenience_store, else first available
        const first = opts.find((o) => o.type === 'convenience_store') ?? opts[0]
        if (first) setSelectedShipping(first.id)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const [form, setForm] = useState({
    recipientName: '',
    phone: '',
    city: '',
    district: '',
    zipCode: '',
    address: '',
    customerNote: '',
  })

  // 超商門市選擇
  const [storeInfo, setStoreInfo] = useState({
    storeName: '',
    storeId: '',
    storeAddress: '',
  })

  // 電子發票
  const [invoiceType, setInvoiceType] = useState<'b2c_personal' | 'b2c_carrier' | 'b2b' | 'donation'>('b2c_personal')
  const [carrierType, setCarrierType] = useState<'none' | 'phone_barcode' | 'natural_cert'>('none')
  const [carrierNumber, setCarrierNumber] = useState('')
  const [loveCode, setLoveCode] = useState('')
  const [buyerUBN, setBuyerUBN] = useState('')
  const [buyerCompanyName, setBuyerCompanyName] = useState('')

  const shippingOption = shippingOptions.find((s) => s.id === selectedShipping)
  const isConvenienceStore = shippingOption?.type === 'convenience_store'

  const subtotal = items.reduce(
    (sum, i) => sum + (i.salePrice ?? i.price) * i.quantity,
    0,
  )

  // 運費計算：依會員等級、訂閱會員、物流方式
  const calcShippingFee = () => {
    if (!shippingOption) return 0
    // 免運門檻
    if (subtotal >= shippingOption.freeThreshold) return 0
    return shippingOption.fee
  }

  const shippingFee = calcShippingFee()
  const total = subtotal + shippingFee

  // BeginCheckout 追蹤（僅觸發一次）
  const trackedRef = useRef(false)
  useEffect(() => {
    if (items.length > 0 && !trackedRef.current) {
      trackedRef.current = true
      trackBeginCheckout(
        items.map((i) => ({
          item_id: i.productId,
          item_name: i.name,
          price: i.salePrice ?? i.price,
          quantity: i.quantity,
          item_variant: i.variant
            ? `${i.variant.colorName} / ${i.variant.size}`
            : undefined,
        })),
        subtotal,
      )
    }
  }, [items, subtotal])

  const updateForm = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const filteredShipping = shippingOptions.filter(
    (s) => s.type === shippingTypeFilter,
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 超商取貨驗證
    if (isConvenienceStore && !storeInfo.storeName) {
      alert('請選擇取貨門市')
      return
    }

    setIsProcessing(true)

    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
    const orderNumber = `CKM-${dateStr}-${rand}`

    const utmParams = getStoredUTM()

    // In production, this would create the order via Payload API
    console.log('[Checkout] Creating order:', {
      orderNumber,
      customer: session?.user?.id || 'guest',
      items: items.map((i) => ({
        productId: i.productId,
        name: i.name,
        variant: i.variant ? `${i.variant.colorName} / ${i.variant.size}` : null,
        quantity: i.quantity,
        unitPrice: i.salePrice ?? i.price,
        subtotal: (i.salePrice ?? i.price) * i.quantity,
      })),
      subtotal,
      shippingFee,
      total,
      paymentMethod: selectedPayment,
      shippingMethod: {
        methodName: shippingOption?.name,
        carrier: shippingOption?.carrier,
        convenienceStore: isConvenienceStore ? storeInfo : null,
        estimatedDays: shippingOption?.estimatedDays,
      },
      shippingAddress: isConvenienceStore
        ? {
            recipientName: form.recipientName,
            phone: form.phone,
            address: storeInfo.storeAddress,
            city: '',
            district: '',
            zipCode: '',
          }
        : form,
      utm: utmParams,
    })

    trackPurchase({
      transaction_id: orderNumber,
      value: total,
      currency: 'TWD',
      shipping: shippingFee,
      items: items.map((i) => ({
        item_id: i.productId,
        item_name: i.name,
        price: i.salePrice ?? i.price,
        quantity: i.quantity,
        item_variant: i.variant
          ? `${i.variant.colorName} / ${i.variant.size}`
          : undefined,
      })),
    })

    await new Promise((resolve) => setTimeout(resolve, 1500))

    clearCart()
    router.push(`/checkout/success/${orderNumber}`)
  }

  if (items.length === 0) {
    return (
      <main className="bg-cream-50 min-h-screen">
        <div className="container py-16 text-center">
          <h1 className="text-2xl font-serif mb-3">購物車是空的</h1>
          <p className="text-sm text-muted-foreground mb-6">
            請先將商品加入購物車再進行結帳
          </p>
          <Link
            href="/products"
            className="inline-flex items-center gap-2 px-8 py-3 bg-foreground text-cream-50 rounded-full text-sm hover:bg-foreground/90 transition-colors"
          >
            探索全部商品
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="bg-cream-50 min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-b from-cream-100 to-cream-50 border-b border-cream-200">
        <div className="container py-8 md:py-10">
          <Link
            href="/cart"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <ArrowLeft size={14} />
            返回購物車
          </Link>
          <p className="text-xs tracking-[0.3em] text-gold-500 mb-2">CHECKOUT</p>
          <h1 className="text-2xl md:text-3xl font-serif">結帳</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="container py-8 md:py-12">
          <div className="grid lg:grid-cols-[1fr_400px] gap-8 lg:gap-12">
            {/* ── Left: Forms ── */}
            <div className="space-y-8">
              {/* Social login prompt */}
              {!session && (
                <div className="bg-gold-500/5 border border-gold-500/20 rounded-2xl p-5">
                  <p className="text-sm font-medium mb-2">
                    登入後可快速填入收件資訊
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => signIn('google', { callbackUrl: '/checkout' })}
                      className="px-4 py-2 bg-white border border-cream-200 rounded-lg text-xs hover:bg-cream-50 transition-colors"
                    >
                      Google 登入
                    </button>
                    <button
                      type="button"
                      onClick={() => signIn('facebook', { callbackUrl: '/checkout' })}
                      className="px-4 py-2 bg-white border border-cream-200 rounded-lg text-xs hover:bg-cream-50 transition-colors"
                    >
                      Facebook 登入
                    </button>
                    <button
                      type="button"
                      onClick={() => signIn('line', { callbackUrl: '/checkout' })}
                      className="px-4 py-2 bg-white border border-cream-200 rounded-lg text-xs hover:bg-cream-50 transition-colors"
                    >
                      LINE 登入
                    </button>
                  </div>
                </div>
              )}

              {/* ═══════════════════════════════════════ */}
              {/* ── 物流方式選擇 ── */}
              {/* ═══════════════════════════════════════ */}
              <div className="bg-white rounded-2xl border border-cream-200 p-6">
                <h2 className="font-medium mb-5 flex items-center gap-2">
                  <Truck size={18} className="text-gold-500" />
                  物流方式
                </h2>

                {/* 類型切換 */}
                <div className="flex gap-1 bg-cream-100 rounded-full p-1 mb-5">
                  {(
                    [
                      { type: 'convenience_store' as ShippingType, label: '超商取貨', icon: Building2 },
                      { type: 'home_delivery' as ShippingType, label: '宅配到府', icon: Truck },
                      { type: 'international' as ShippingType, label: '國際配送', icon: Plane },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.type}
                      type="button"
                      onClick={() => {
                        setShippingTypeFilter(tab.type)
                        const first = shippingOptions.find((s) => s.type === tab.type)
                        if (first) setSelectedShipping(first.id)
                      }}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs transition-all flex-1 justify-center ${
                        shippingTypeFilter === tab.type
                          ? 'bg-foreground text-cream-50'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <tab.icon size={14} />
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* 物流商選擇 */}
                <div className="space-y-2">
                  {filteredShipping.length === 0 && shippingOptions.length === 0 ? (
                    <div className="p-4 text-xs text-muted-foreground text-center">
                      載入物流方式中…
                    </div>
                  ) : filteredShipping.length === 0 ? (
                    <div className="p-4 text-xs text-muted-foreground text-center">
                      此類別暫無啟用的物流方式
                    </div>
                  ) : (
                    filteredShipping.map((opt) => {
                      const Icon = getShippingIcon(opt.carrier)
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setSelectedShipping(opt.id)}
                          className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                            selectedShipping === opt.id
                              ? 'border-gold-500 bg-gold-500/5'
                              : 'border-cream-200 hover:border-gold-300'
                          }`}
                        >
                          <Icon size={20} className="mt-0.5 text-gold-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium">{opt.name}</p>
                              <span className="text-xs font-medium text-gold-600">
                                {opt.freeThreshold > 0 && subtotal >= opt.freeThreshold ? (
                                  <span className="text-green-600">免運費</span>
                                ) : (
                                  `NT$ ${opt.fee}`
                                )}
                              </span>
                            </div>
                            {opt.description && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {opt.description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-1">
                              {opt.estimatedDays && (
                                <span className="text-[10px] text-muted-foreground">
                                  ⏱ {opt.estimatedDays}
                                </span>
                              )}
                              {opt.freeThreshold > 0 && subtotal < opt.freeThreshold && (
                                <span className="text-[10px] text-muted-foreground">
                                  滿 NT$ {opt.freeThreshold.toLocaleString()} 免運
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>

              {/* ═══════════════════════════════════════ */}
              {/* ── 收件資訊 / 門市選擇 ── */}
              {/* ═══════════════════════════════════════ */}
              <div className="bg-white rounded-2xl border border-cream-200 p-6">
                <h2 className="font-medium mb-5 flex items-center gap-2">
                  <MapPin size={18} className="text-gold-500" />
                  {isConvenienceStore ? '取貨人資訊' : '收件資訊'}
                </h2>

                {/* 收件人基本資訊（宅配與超商都需要） */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">
                      {isConvenienceStore ? '取貨人姓名' : '收件人姓名'} *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.recipientName}
                      onChange={(e) => updateForm('recipientName', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">
                      聯絡電話 *
                    </label>
                    <input
                      type="tel"
                      required
                      value={form.phone}
                      onChange={(e) => updateForm('phone', e.target.value)}
                      placeholder="09xx-xxx-xxx"
                      className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
                    />
                  </div>
                </div>

                {/* 超商門市選擇 */}
                {isConvenienceStore && (
                  <div className="mt-5 space-y-4">
                    <div className="flex items-center gap-2 text-xs text-gold-600 bg-gold-500/5 px-3 py-2 rounded-lg">
                      <Info size={14} />
                      請選擇取貨門市
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1.5 block">
                          門市名稱 *
                        </label>
                        <input
                          type="text"
                          required
                          value={storeInfo.storeName}
                          onChange={(e) =>
                            setStoreInfo((prev) => ({ ...prev, storeName: e.target.value }))
                          }
                          placeholder={`請輸入${shippingOption?.name.split(' ')[0]}門市名稱`}
                          className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1.5 block">
                          門市代號
                        </label>
                        <input
                          type="text"
                          value={storeInfo.storeId}
                          onChange={(e) =>
                            setStoreInfo((prev) => ({ ...prev, storeId: e.target.value }))
                          }
                          placeholder="選填"
                          className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-xs text-muted-foreground mb-1.5 block">
                          門市地址 *
                        </label>
                        <input
                          type="text"
                          required
                          value={storeInfo.storeAddress}
                          onChange={(e) =>
                            setStoreInfo((prev) => ({ ...prev, storeAddress: e.target.value }))
                          }
                          placeholder="請輸入門市地址"
                          className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
                        />
                      </div>
                    </div>

                    {/* 門市地圖選擇按鈕（實際整合物流商 API 使用） */}
                    <button
                      type="button"
                      className="w-full py-3 border-2 border-dashed border-gold-400/50 rounded-xl text-sm text-gold-600 hover:bg-gold-500/5 transition-colors flex items-center justify-center gap-2"
                    >
                      <MapPin size={16} />
                      從地圖選擇門市
                    </button>
                  </div>
                )}

                {/* 宅配 / 國際地址表單 */}
                {!isConvenienceStore && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div className="relative">
                      <label className="text-xs text-muted-foreground mb-1.5 block">
                        縣市 *
                      </label>
                      <select
                        required
                        value={form.city}
                        onChange={(e) => updateForm('city', e.target.value)}
                        className="w-full appearance-none px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40 bg-white"
                      >
                        <option value="">請選擇</option>
                        {TAIWAN_CITIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <ChevronDown
                        size={14}
                        className="absolute right-3 bottom-3.5 text-muted-foreground pointer-events-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1.5 block">
                        鄉鎮區
                      </label>
                      <input
                        type="text"
                        value={form.district}
                        onChange={(e) => updateForm('district', e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1.5 block">
                        郵遞區號
                      </label>
                      <input
                        type="text"
                        value={form.zipCode}
                        onChange={(e) => updateForm('zipCode', e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs text-muted-foreground mb-1.5 block">
                        詳細地址 *
                      </label>
                      <input
                        type="text"
                        required
                        value={form.address}
                        onChange={(e) => updateForm('address', e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
                      />
                    </div>
                  </div>
                )}

                {/* 訂單備註 */}
                <div className="mt-4">
                  <label className="text-xs text-muted-foreground mb-1.5 block">
                    訂單備註（選填）
                  </label>
                  <textarea
                    value={form.customerNote}
                    onChange={(e) => updateForm('customerNote', e.target.value)}
                    rows={2}
                    className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40 resize-none"
                  />
                </div>
              </div>

              {/* ── AI 智能推薦：最後加購 ── */}
              <CheckoutLastChance />

              {/* Payment method */}
              <div className="bg-white rounded-2xl border border-cream-200 p-6">
                <h2 className="font-medium mb-5 flex items-center gap-2">
                  <CreditCard size={18} className="text-gold-500" />
                  付款方式
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PAYMENT_METHODS.map((pm) => (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setSelectedPayment(pm.id)}
                      className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                        selectedPayment === pm.id
                          ? 'border-gold-500 bg-gold-500/5'
                          : 'border-cream-200 hover:border-gold-300'
                      }`}
                    >
                      <pm.icon size={20} className={`mt-0.5 shrink-0 ${pm.color}`} />
                      <div>
                        <p className="text-sm font-medium">{pm.name}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {pm.desc}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* ═══════════════════════════════════════ */}
              {/* ── 電子發票設定 ── */}
              {/* ═══════════════════════════════════════ */}
              <div className="bg-white rounded-2xl border border-cream-200 p-6">
                <h2 className="font-medium mb-5 flex items-center gap-2">
                  <FileText size={18} className="text-gold-500" />
                  電子發票
                </h2>

                {/* 發票類型選擇 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
                  {([
                    { id: 'b2c_personal' as const, label: '個人發票', desc: '二聯式' },
                    { id: 'b2c_carrier' as const, label: '載具發票', desc: '存入載具' },
                    { id: 'b2b' as const, label: '公司發票', desc: '三聯式' },
                    { id: 'donation' as const, label: '捐贈發票', desc: '捐贈愛心' },
                  ]).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setInvoiceType(t.id)}
                      className={`p-3 rounded-xl border-2 text-center transition-all ${
                        invoiceType === t.id
                          ? 'border-gold-500 bg-gold-500/5'
                          : 'border-cream-200 hover:border-gold-300'
                      }`}
                    >
                      <p className="text-xs font-medium">{t.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{t.desc}</p>
                    </button>
                  ))}
                </div>

                {/* 載具選擇 */}
                {invoiceType === 'b2c_carrier' && (
                  <div className="space-y-4 mb-4">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1.5 block">載具類型</label>
                      <div className="flex gap-2">
                        {([
                          { id: 'phone_barcode' as const, label: '手機條碼' },
                          { id: 'natural_cert' as const, label: '自然人憑證' },
                        ]).map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setCarrierType(c.id)}
                            className={`flex-1 py-2.5 rounded-lg border text-xs transition-all ${
                              carrierType === c.id
                                ? 'border-gold-500 bg-gold-500/5 font-medium'
                                : 'border-cream-200 hover:border-gold-300'
                            }`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1.5 block">
                        {carrierType === 'phone_barcode' ? '手機條碼（/ 開頭）' : '自然人憑證號碼'}
                      </label>
                      <input
                        type="text"
                        value={carrierNumber}
                        onChange={(e) => setCarrierNumber(e.target.value)}
                        placeholder={carrierType === 'phone_barcode' ? '/ABC+123' : '2 碼英文 + 14 碼數字'}
                        className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
                      />
                    </div>
                  </div>
                )}

                {/* 三聯式公司資訊 */}
                {invoiceType === 'b2b' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1.5 block">統一編號 *</label>
                      <input
                        type="text"
                        required
                        value={buyerUBN}
                        onChange={(e) => setBuyerUBN(e.target.value.replace(/\D/g, '').slice(0, 8))}
                        placeholder="8 碼數字"
                        maxLength={8}
                        className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1.5 block">公司名稱 *</label>
                      <input
                        type="text"
                        required
                        value={buyerCompanyName}
                        onChange={(e) => setBuyerCompanyName(e.target.value)}
                        placeholder="公司全名"
                        className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
                      />
                    </div>
                  </div>
                )}

                {/* 捐贈發票 */}
                {invoiceType === 'donation' && (
                  <div className="mb-4">
                    <label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1">
                      <Heart size={12} className="text-rose-400" />
                      愛心碼（捐贈碼）
                    </label>
                    <input
                      type="text"
                      value={loveCode}
                      onChange={(e) => setLoveCode(e.target.value.replace(/\D/g, '').slice(0, 7))}
                      placeholder="3~7 碼數字，例如 7681（伊甸基金會）"
                      maxLength={7}
                      className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      不知道愛心碼？可至
                      <a
                        href="https://www.einvoice.nat.gov.tw/APCONSUMER/BTC603W/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gold-600 hover:underline mx-0.5"
                      >
                        財政部電子發票平台
                      </a>
                      查詢
                    </p>
                  </div>
                )}

                <p className="text-[10px] text-muted-foreground">
                  依財政部規定，電子發票將於付款完成後自動開立並寄送至您的 Email
                </p>
              </div>
            </div>

            {/* ── Right: Order summary ── */}
            <div className="lg:sticky lg:top-28 h-fit">
              <div className="bg-white rounded-2xl border border-cream-200 p-6 space-y-5">
                <h2 className="font-medium">訂單摘要</h2>

                {/* Items */}
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {items.map((item) => {
                    const key = item.variant?.sku || item.productId
                    const unitPrice = item.salePrice ?? item.price
                    return (
                      <div key={key} className="flex gap-3">
                        <div className="relative w-14 h-16 rounded-lg overflow-hidden bg-cream-100 shrink-0">
                          {item.image ? (
                            <Image
                              src={item.image}
                              alt={item.name}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-[8px] text-muted-foreground">
                              圖
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{item.name}</p>
                          {item.variant && (
                            <p className="text-[10px] text-muted-foreground">
                              {item.variant.colorName} / {item.variant.size}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-0.5">
                            x {item.quantity}
                          </p>
                        </div>
                        <p className="text-xs font-medium whitespace-nowrap">
                          NT$ {(unitPrice * item.quantity).toLocaleString()}
                        </p>
                      </div>
                    )
                  })}
                </div>

                <div className="border-t border-cream-200 pt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">商品小計</span>
                    <span>NT$ {subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      運費（{shippingOption?.name}）
                    </span>
                    <span>
                      {shippingFee === 0 ? (
                        <span className="text-green-600">免運費</span>
                      ) : (
                        `NT$ ${shippingFee}`
                      )}
                    </span>
                  </div>
                  {shippingOption && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Truck size={10} />
                      預計 {shippingOption.estimatedDays} 送達
                    </div>
                  )}
                </div>

                <div className="border-t border-cream-200 pt-4 flex justify-between items-baseline">
                  <span className="font-medium">合計</span>
                  <span className="text-xl font-medium text-gold-600">
                    NT$ {total.toLocaleString()}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-foreground text-cream-50 rounded-xl text-sm tracking-wide hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-wait"
                >
                  <Lock size={14} />
                  {isProcessing ? '處理中...' : '確認付款'}
                </button>

                <p className="text-[10px] text-center text-muted-foreground leading-relaxed">
                  點擊「確認付款」即表示您同意我們的
                  <Link href="/terms" className="text-gold-600 hover:underline mx-0.5">
                    服務條款
                  </Link>
                  與
                  <Link href="/privacy" className="text-gold-600 hover:underline mx-0.5">
                    隱私權政策
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </form>
    </main>
  )
}
