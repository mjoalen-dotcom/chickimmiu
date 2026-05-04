'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { useCurrentUser } from '@/lib/auth/useCurrentUser'
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
  Banknote,
  Handshake,
  Clock,
  Tag,
  X,
  Check,
} from 'lucide-react'
import { useCartStore } from '@/stores/cartStore'
import { CheckoutLastChance } from '@/components/recommendation/CheckoutLastChance'
import { PromoUpsellSection } from '@/components/cart/PromoUpsellSection'
import {
  trackBeginCheckout,
  trackPurchase,
  getStoredUTM,
  purchaseEventId,
  getCurrentAttribution,
} from '@/lib/tracking'
import { sendServerPurchaseEvent } from '@/app/actions/tracking'

/* ── 付款方式 ──
 * cash_cod 只在所選物流支援貨到付款（cashOnDelivery=true）時顯示，
 * 且訂單總額（subtotal + shippingFee）≤ codMaxAmount 才能選。
 * cash_meetup (到辦公室取貨付款) 只在所選物流 type=meetup 時顯示；該 tab 下也只有此付款可選。
 */
type PaymentMethodId = 'paypal' | 'ecpay' | 'newebpay' | 'linepay' | 'cash_cod' | 'cash_meetup'
interface PaymentMethodOption {
  id: PaymentMethodId
  name: string
  desc: string
  icon: typeof CreditCard
  color: string
  requiresCashOnDelivery?: boolean
  requiresMeetup?: boolean
}

const PAYMENT_METHODS: PaymentMethodOption[] = [
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
  {
    id: 'cash_cod',
    name: '宅配貨到付款（現金）',
    desc: '收到商品時付現給物流司機 / 超商櫃檯',
    icon: Banknote,
    color: 'text-emerald-600',
    requiresCashOnDelivery: true,
  },
  {
    id: 'cash_meetup',
    name: '到辦公室取貨付款（現金）',
    desc: '到辦公室取貨時收取現金',
    icon: Handshake,
    color: 'text-amber-600',
    requiresMeetup: true,
  },
]

/* ── 物流方式 ── */
type ShippingType = 'home_delivery' | 'convenience_store' | 'meetup' | 'international'

interface ShippingOption {
  id: string
  type: ShippingType
  carrier: string
  name: string
  desc: string
  fee: number
  freeThreshold: number
  estimatedDays: string
  icon: typeof Truck
  cashOnDelivery?: boolean
}

const SHIPPING_OPTIONS: ShippingOption[] = [
  // 宅配
  {
    id: 'hct',
    type: 'home_delivery',
    carrier: 'hct',
    name: '新竹物流',
    desc: '新竹物流到府配送（台灣本島）',
    fee: 120,
    freeThreshold: 1500,
    estimatedDays: '2-4 個工作天',
    icon: Truck,
    cashOnDelivery: true,
  },
  {
    id: 'tcat',
    type: 'home_delivery',
    carrier: 'tcat',
    name: '黑貓宅急便',
    desc: '宅配到府，可指定配送時段',
    fee: 100,
    freeThreshold: 1500,
    estimatedDays: '1-2 個工作天',
    icon: Truck,
    cashOnDelivery: true,
  },
  {
    id: 'post',
    type: 'home_delivery',
    carrier: 'post',
    name: '郵局宅配',
    desc: '中華郵政寄送',
    fee: 80,
    freeThreshold: 2000,
    estimatedDays: '2-4 個工作天',
    icon: Package,
    cashOnDelivery: true,
  },
  // 超商取貨
  {
    id: '711',
    type: 'convenience_store',
    carrier: '711',
    name: '7-ELEVEN 超商取貨',
    desc: '全台 7-ELEVEN 門市取貨',
    fee: 60,
    freeThreshold: 1000,
    estimatedDays: '2-3 個工作天',
    icon: Building2,
    cashOnDelivery: true,
  },
  {
    id: 'family',
    type: 'convenience_store',
    carrier: 'family',
    name: '全家超商取貨',
    desc: '全台全家門市取貨',
    fee: 60,
    freeThreshold: 1000,
    estimatedDays: '2-3 個工作天',
    icon: Building2,
    cashOnDelivery: true,
  },
  {
    id: 'hilife',
    type: 'convenience_store',
    carrier: 'hilife',
    name: '萊爾富超商取貨',
    desc: '全台萊爾富門市取貨',
    fee: 60,
    freeThreshold: 1000,
    estimatedDays: '2-3 個工作天',
    icon: Building2,
    cashOnDelivery: true,
  },
  {
    id: 'ok',
    type: 'convenience_store',
    carrier: 'ok',
    name: 'OK mart 超商取貨',
    desc: '全台 OK 門市取貨',
    fee: 60,
    freeThreshold: 1000,
    estimatedDays: '2-3 個工作天',
    icon: Building2,
    cashOnDelivery: true,
  },
  // 到辦公室取貨
  {
    id: 'meetup',
    type: 'meetup',
    carrier: 'meetup',
    name: '到辦公室取貨',
    desc: '約定時段至辦公室取貨，僅支援現金付款',
    fee: 0,
    freeThreshold: 0,
    estimatedDays: '備貨完成後通知取貨',
    icon: Handshake,
  },
  // 國際
  {
    id: 'intl',
    type: 'international',
    carrier: 'dhl',
    name: '國際快遞',
    desc: 'DHL / FedEx 國際配送',
    fee: 350,
    freeThreshold: 5000,
    estimatedDays: '5-10 個工作天',
    icon: Plane,
  },
]

const TAIWAN_CITIES = [
  '台北市', '新北市', '桃園市', '台中市', '台南市', '高雄市',
  '基隆市', '新竹市', '新竹縣', '苗栗縣', '彰化縣', '南投縣',
  '雲林縣', '嘉義市', '嘉義縣', '屏東縣', '宜蘭縣', '花蓮縣',
  '台東縣', '澎湖縣', '金門縣', '連江縣',
]

export default function CheckoutPage() {
  // Unified auth check — Payload cookie (email/pw + OAuth-after-bridge) first,
  // NextAuth session as fallback for the brief OAuth-before-bridge window.
  // useSession() alone misses Payload-only sessions, which is why logged-in
  // email/pw users were still seeing the "登入後可快速填入收件資訊" prompt.
  const { user, isAuthenticated, loading: authLoading } = useCurrentUser()
  const router = useRouter()
  const { items, clearCart } = useCartStore()
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethodId>('ecpay')
  const [selectedShipping, setSelectedShipping] = useState('711')
  const [shippingTypeFilter, setShippingTypeFilter] = useState<ShippingType>('convenience_store')
  const [isProcessing, setIsProcessing] = useState(false)

  // 付款設定（從 /api/payment-settings 拉，失敗用 fallback）
  const [paymentSettings, setPaymentSettings] = useState<{
    enabledMethods: string[]
    codDefaultFee: number
    codMaxAmount: number
  }>({ enabledMethods: ['ecpay', 'cash_cod', 'cash_meetup'], codDefaultFee: 30, codMaxAmount: 20000 })

  useEffect(() => {
    fetch('/api/payment-settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => { if (s) setPaymentSettings(s) })
      .catch(() => { /* 用預設 */ })
  }, [])

  // 結帳設定（從 /api/checkout-settings 拉，失敗用 fallback）
  type CheckoutCfg = {
    requireTOS: boolean
    tosLinkText: string
    requireMarketingConsent: boolean
    marketingConsentText: string
    minOrderAmount: number
    maxItemsPerOrder: number
    notes: { allowOrderNote: boolean; orderNoteLabel: string; orderNoteMaxLength: number }
  }
  const [checkoutCfg, setCheckoutCfg] = useState<CheckoutCfg>({
    requireTOS: true,
    tosLinkText: '同意服務條款與隱私權政策',
    requireMarketingConsent: false,
    marketingConsentText: '我願意收到 CHIC KIM & MIU 最新活動與優惠資訊',
    minOrderAmount: 0,
    maxItemsPerOrder: 99,
    notes: { allowOrderNote: true, orderNoteLabel: '給賣家的備註', orderNoteMaxLength: 200 },
  })

  const [tosAccepted, setTosAccepted] = useState(false)
  const [marketingAccepted, setMarketingAccepted] = useState(false)

  useEffect(() => {
    fetch('/api/checkout-settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => { if (s) setCheckoutCfg(s) })
      .catch(() => { /* 用預設 */ })
  }, [])

  // 稅務設定（TaxSettings global，失敗用台灣標準 5% 含稅）
  const [taxSettings, setTaxSettings] = useState<{
    defaultTaxIncluded: boolean
    defaultTaxRate: number
    shippingTaxable: boolean
  }>({ defaultTaxIncluded: true, defaultTaxRate: 5, shippingTaxable: true })
  useEffect(() => {
    fetch('/api/globals/tax-settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (!s) return
        setTaxSettings({
          defaultTaxIncluded: Boolean(s.defaultTaxIncluded ?? true),
          defaultTaxRate: Number(s.defaultTaxRate ?? 5),
          shippingTaxable: Boolean(s.shippingTaxable ?? true),
        })
      })
      .catch(() => { /* 用預設 */ })
  }, [])

  // Full profile fetch (name / phone / addresses) — useCurrentUser only exposes
  // id/email/name so we re-pull /api/users/me here to back the "同訂購人資料"
  // autofill + "記錄此收件資料到地址簿" address-book append flow.
  type SavedAddress = {
    recipientName?: string
    phone?: string
    zipCode?: string
    city?: string
    district?: string
    address?: string
    isDefault?: boolean
    label?: string
  }
  const [userProfile, setUserProfile] = useState<{
    name?: string
    phone?: string
    addresses: SavedAddress[]
  } | null>(null)
  const [useProfileData, setUseProfileData] = useState(false)
  // 預設勾選：1a 決議 — submit 時沒額外 modal，只在按鈕上方寫「下次可快速選用」
  const [saveAddressToBook, setSaveAddressToBook] = useState(true)

  useEffect(() => {
    if (!isAuthenticated) {
      setUserProfile(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('/api/users/me', { credentials: 'include' })
        if (!r.ok) return
        const body = (await r.json()) as { user?: Record<string, unknown> | null }
        const u = body?.user
        if (!u || cancelled) return
        setUserProfile({
          name: (u.name as string | undefined) ?? undefined,
          phone: (u.phone as string | undefined) ?? undefined,
          addresses: Array.isArray(u.addresses) ? (u.addresses as SavedAddress[]) : [],
        })
      } catch {
        /* ignore — checkbox just stays disabled */
      }
    })()
    return () => { cancelled = true }
  }, [isAuthenticated])

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

  // 到辦公室取貨資訊（location 預設「辦公室」，customer 可改）
  const [meetupInfo, setMeetupInfo] = useState({
    location: '辦公室',
    preferredTime: '',
  })

  // 優惠券（19A Coupons）
  type AppliedCoupon = {
    couponId: number | string
    couponCode: string
    name: string
    discountType: 'percentage' | 'fixed' | 'free_shipping'
    discountAmount: number
    freeShipping: boolean
  }
  const [couponInput, setCouponInput] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null)

  // 電子發票
  const [invoiceType, setInvoiceType] = useState<'b2c_personal' | 'b2c_carrier' | 'b2b' | 'donation'>('b2c_personal')
  const [carrierType, setCarrierType] = useState<'none' | 'phone_barcode' | 'natural_cert'>('none')
  const [carrierNumber, setCarrierNumber] = useState('')
  const [loveCode, setLoveCode] = useState('')
  const [buyerUBN, setBuyerUBN] = useState('')
  const [buyerCompanyName, setBuyerCompanyName] = useState('')

  const shippingOption = SHIPPING_OPTIONS.find((s) => s.id === selectedShipping)
  const isConvenienceStore = shippingOption?.type === 'convenience_store'
  const isMeetup = shippingOption?.type === 'meetup'

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

  const rawShippingFee = calcShippingFee()
  // 免運優惠券：把運費歸零（仍保留原價於摘要顯示）
  const shippingFee = appliedCoupon?.freeShipping ? 0 : rawShippingFee

  // COD 手續費：只有選 cash_cod 時才計入 total
  const codFee = selectedPayment === 'cash_cod' ? paymentSettings.codDefaultFee : 0
  // 優惠券折扣（百分比 / 固定金額；free_shipping 走上方運費歸零路徑）
  const couponDiscount = appliedCoupon && !appliedCoupon.freeShipping ? appliedCoupon.discountAmount : 0
  const total = Math.max(0, subtotal + shippingFee + codFee - couponDiscount)

  // COD 上限檢查（不含 COD 手續費本身，避免 self-reference）
  const baseTotalForCodCheck = subtotal + shippingFee
  const codBlockedByMax =
    paymentSettings.codMaxAmount > 0 && baseTotalForCodCheck > paymentSettings.codMaxAmount

  // 過濾可用付款方式：
  //   1. admin 必須啟用
  //   2. meetup 物流 → 只露 cash_meetup；其他物流 → 隱藏 cash_meetup
  //   3. cash_cod 需物流支援 COD 且訂單金額未超上限
  const availablePayments = PAYMENT_METHODS.filter((pm) => {
    if (!paymentSettings.enabledMethods.includes(pm.id)) return false
    if (isMeetup) return pm.requiresMeetup === true
    if (pm.requiresMeetup) return false
    if (pm.requiresCashOnDelivery) {
      if (!shippingOption?.cashOnDelivery) return false
      if (codBlockedByMax) return false
    }
    return true
  })

  // 若目前選的付款被過濾掉，自動切到第一個可用的
  useEffect(() => {
    const stillAvailable = availablePayments.some((pm) => pm.id === selectedPayment)
    if (!stillAvailable && availablePayments.length > 0) {
      setSelectedPayment(availablePayments[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShipping, paymentSettings, codBlockedByMax])

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

  const handleApplyCoupon = async () => {
    const code = couponInput.trim()
    if (!code) {
      setCouponError('請輸入優惠碼')
      return
    }
    setCouponLoading(true)
    setCouponError(null)
    try {
      const res = await fetch('/api/cart/apply-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          code,
          subtotal,
          items: items.map((i) => ({
            productId: i.productId,
            subtotal: (i.salePrice ?? i.price) * i.quantity,
          })),
        }),
      })
      const body = (await res.json().catch(() => null)) as
        | {
            valid: boolean
            reason?: string
            couponId?: number | string
            couponCode?: string
            name?: string
            discountType?: 'percentage' | 'fixed' | 'free_shipping'
            discountAmount?: number
            freeShipping?: boolean
          }
        | null
      if (!body || !body.valid) {
        setAppliedCoupon(null)
        setCouponError(body?.reason || '優惠碼無法使用')
        return
      }
      setAppliedCoupon({
        couponId: body.couponId!,
        couponCode: body.couponCode!,
        name: body.name || body.couponCode!,
        discountType: body.discountType!,
        discountAmount: body.discountAmount ?? 0,
        freeShipping: Boolean(body.freeShipping),
      })
      setCouponError(null)
    } catch (err) {
      console.error('[Checkout] apply-coupon error:', err)
      setCouponError('驗證失敗，請稍後再試')
    } finally {
      setCouponLoading(false)
    }
  }

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null)
    setCouponInput('')
    setCouponError(null)
  }

  const filteredShipping = SHIPPING_OPTIONS.filter(
    (s) => s.type === shippingTypeFilter,
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 超商取貨驗證
    if (isConvenienceStore && !storeInfo.storeName) {
      alert('請選擇取貨門市')
      return
    }

    // 到辦公室取貨驗證
    if (isMeetup && (!meetupInfo.location.trim() || !meetupInfo.preferredTime.trim())) {
      alert('請填寫取貨地點與建議時段')
      return
    }

    // Orders.customer 是必填 relationship → 必須登入。
    // （useCurrentUser 以 Payload cookie 為準，POST /api/orders 會驗同一 cookie。）
    if (!isAuthenticated || !user) {
      alert('請先登入後再結帳')
      router.push('/login?redirect=/checkout')
      return
    }

    // 最低消費 / 最大件數 / TOS / 行銷同意（讀 CheckoutSettings）
    if (checkoutCfg.minOrderAmount > 0 && subtotal < checkoutCfg.minOrderAmount) {
      alert(`最低消費金額為 NT$${checkoutCfg.minOrderAmount.toLocaleString()}`)
      return
    }
    const totalItems = items.reduce((n, i) => n + i.quantity, 0)
    if (totalItems > checkoutCfg.maxItemsPerOrder) {
      alert(`單筆訂單最多 ${checkoutCfg.maxItemsPerOrder} 件商品`)
      return
    }
    if (checkoutCfg.requireTOS && !tosAccepted) {
      alert('請先勾選同意服務條款')
      return
    }
    if (checkoutCfg.requireMarketingConsent && !marketingAccepted) {
      alert('請先勾選同意接收行銷訊息')
      return
    }

    setIsProcessing(true)

    const utmParams = getStoredUTM()

    const orderItems = items.map((i) => ({
      product: i.productId,
      productName: i.name,
      sku: i.variant?.sku,
      variant: i.variant ? `${i.variant.colorName} / ${i.variant.size}` : undefined,
      quantity: i.quantity,
      unitPrice: i.salePrice ?? i.price,
      subtotal: (i.salePrice ?? i.price) * i.quantity,
    }))

    // orderNumber 由 Orders.ts beforeValidate hook 依 OrderSettings.numbering 產生；
    // client 不再自行產生（避免跟 admin 後台設定不一致）。
    const orderPayload = {
      customer: user.id,
      items: orderItems,
      subtotal,
      subtotalBeforeDiscount: subtotal,
      shippingFee,
      codFee,
      total,
      discountAmount: couponDiscount,
      discountReason: appliedCoupon
        ? `優惠券 ${appliedCoupon.couponCode}${appliedCoupon.freeShipping ? '（免運）' : ''}`
        : undefined,
      couponCode: appliedCoupon?.couponCode,
      coupon: appliedCoupon?.couponId,
      paymentMethod: selectedPayment,
      paymentStatus: 'unpaid' as const,
      status: 'pending' as const,
      shippingAddress: isConvenienceStore
        ? {
            recipientName: form.recipientName,
            phone: form.phone,
            address: storeInfo.storeAddress,
            city: '超商取貨',
            district: '',
            zipCode: '',
          }
        : isMeetup
        ? {
            recipientName: form.recipientName,
            phone: form.phone,
            // Orders.shippingMethod has no meetup sub-group, so 取貨地點 + 時段
            // are packed into the existing shippingAddress.address string
            // (admin can still read it in the order detail view).
            address: `[到辦公室取貨] ${meetupInfo.location}（${meetupInfo.preferredTime}）`,
            city: '到辦公室取貨',
            district: '',
            zipCode: '',
          }
        : {
            recipientName: form.recipientName,
            phone: form.phone,
            address: form.address,
            city: form.city,
            district: form.district,
            zipCode: form.zipCode,
          },
      shippingMethod: {
        methodName: shippingOption?.name,
        carrier: shippingOption?.carrier,
        convenienceStore:
          isConvenienceStore && storeInfo.storeName
            ? {
                storeName: storeInfo.storeName,
                storeId: storeInfo.storeId,
                storeAddress: storeInfo.storeAddress,
              }
            : undefined,
        estimatedDays: shippingOption?.estimatedDays,
      },
      // PR-B：UTM 歸因（first-touch 90 天 cookie + last-touch session）
      // Orders.ts attribution group 不存 landingPath（只 Users.firstTouchAttribution 存），
      // 所以這裡 strip 掉 landingPath 欄位。
      attribution: (() => {
        const a = getCurrentAttribution()
        const stripLanding = (t: typeof a.firstTouch) => {
          if (!t) return undefined
          const { landingPath: _drop, ...rest } = t
          void _drop
          return rest
        }
        return {
          firstTouch: stripLanding(a.firstTouch),
          lastTouch: stripLanding(a.lastTouch),
        }
      })(),
      customerNote: form.customerNote || undefined,
    }

    let createdOrderNumber = ''
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(orderPayload),
      })

      if (!res.ok) {
        const errBody = (await res.json().catch(() => null)) as
          | { errors?: { message: string }[]; message?: string }
          | null
        const errMsg =
          errBody?.errors?.[0]?.message || errBody?.message || `HTTP ${res.status}`
        console.error('[Checkout] Order API failed:', errMsg, errBody, { utm: utmParams })
        alert(`訂單建立失敗：${errMsg}`)
        setIsProcessing(false)
        return
      }

      const result = (await res.json()) as { doc?: { orderNumber?: string } }
      createdOrderNumber = result.doc?.orderNumber || ''
      if (!createdOrderNumber) {
        console.error('[Checkout] Order created but no orderNumber in response', result)
        alert('訂單建立成功但編號遺失，請聯繫客服')
        setIsProcessing(false)
        return
      }
    } catch (err) {
      console.error('[Checkout] Order creation error:', err)
      alert('訂單建立失敗，請檢查網路連線後再試')
      setIsProcessing(false)
      return
    }

    // Address-book append — best effort, 不 block 跳轉。
    // 只對宅配 / 國際（非超商、非面交）真正帶地址的模式有意義。
    // Race (2a): GET 新 snapshot → compare fingerprint → PATCH 全新 array。
    // 多分頁同時下單 → 後寫者贏；下單頻率低可接受。
    if (
      saveAddressToBook &&
      !isConvenienceStore &&
      !isMeetup &&
      userProfile &&
      user?.id
    ) {
      const fp = (a: SavedAddress) =>
        [a.recipientName, a.phone, a.city, a.district, a.address]
          .map((s) => (s ?? '').trim())
          .join('|')
      const newAddr: SavedAddress = {
        recipientName: form.recipientName,
        phone: form.phone,
        zipCode: form.zipCode,
        city: form.city,
        district: form.district,
        address: form.address,
        isDefault: userProfile.addresses.length === 0,
      }
      try {
        const meRes = await fetch('/api/users/me', { credentials: 'include' })
        const meBody = meRes.ok ? await meRes.json() : null
        const latest: SavedAddress[] =
          Array.isArray(meBody?.user?.addresses) ? meBody.user.addresses : []
        const newFp = fp(newAddr)
        const exists = latest.some((a) => fp(a) === newFp)
        if (!exists) {
          await fetch(`/api/users/${user.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ addresses: [...latest, newAddr] }),
          })
        }
      } catch (err) {
        console.warn('[Checkout] Save address to book failed (non-fatal):', err)
      }
    }

    // ── Pixel + CAPI 雙線（Meta 用 (event_name, event_id) 去重）──
    // eventID 用訂單編號衍生，雙擊「完成下單」也只算一次 conversion。
    const eventID = purchaseEventId(createdOrderNumber)

    trackPurchase(
      {
        transaction_id: createdOrderNumber,
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
      },
      eventID,
    )

    // Server-side CAPI — 缺 META_CAPI_ACCESS_TOKEN env (或 GlobalSettings.tracking
    // .metaCapiToken) 時自動 no-op。失敗永遠不擋 checkout 後續導頁。
    sendServerPurchaseEvent({
      transactionId: createdOrderNumber,
      value: total,
      currency: 'TWD',
      eventID,
      sourceUrl: typeof window !== 'undefined' ? window.location.href : undefined,
      userEmail: user?.email,
      userPhone: form.phone,
      items: items.map((i) => ({
        id: i.productId,
        name: i.name,
        quantity: i.quantity,
        price: i.salePrice ?? i.price,
      })),
    }).catch((err) => {
      console.warn('[Checkout] CAPI fire-and-forget failed (non-fatal):', err)
    })

    clearCart()
    router.push(`/checkout/success/${createdOrderNumber}`)
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
              {/* Social login prompt — hide once auth is confirmed (either way) */}
              {!authLoading && !isAuthenticated && (
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
                      { type: 'meetup' as ShippingType, label: '到辦公室取貨', icon: Handshake },
                      { type: 'international' as ShippingType, label: '國際配送', icon: Plane },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.type}
                      type="button"
                      onClick={() => {
                        setShippingTypeFilter(tab.type)
                        const first = SHIPPING_OPTIONS.find((s) => s.type === tab.type)
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
                  {filteredShipping.map((opt) => (
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
                      <opt.icon size={20} className="mt-0.5 text-gold-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{opt.name}</p>
                          <span className="text-xs font-medium text-gold-600">
                            {subtotal >= opt.freeThreshold ? (
                              <span className="text-green-600">免運費</span>
                            ) : (
                              `NT$ ${opt.fee}`
                            )}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] text-muted-foreground">
                            ⏱ {opt.estimatedDays}
                          </span>
                          {subtotal < opt.freeThreshold && (
                            <span className="text-[10px] text-muted-foreground">
                              滿 NT$ {opt.freeThreshold.toLocaleString()} 免運
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* ═══════════════════════════════════════ */}
              {/* ── 收件資訊 / 門市選擇 ── */}
              {/* ═══════════════════════════════════════ */}
              <div className="bg-white rounded-2xl border border-cream-200 p-6">
                <h2 className="font-medium mb-5 flex items-center gap-2">
                  <MapPin size={18} className="text-gold-500" />
                  {isConvenienceStore ? '取貨人資訊' : isMeetup ? '取貨資訊' : '收件資訊'}
                </h2>

                {/* 同訂購人資料：勾選後 auto-fill name/phone（永遠相關）+ 若為宅配且
                    profile 有預設地址，一併帶入 city/district/zipCode/address。 */}
                {isAuthenticated && (() => {
                  const canUse = Boolean(userProfile?.name && userProfile?.phone)
                  const hint = !userProfile
                    ? '載入個人資料中…'
                    : !canUse
                    ? '請先到「帳號設定」填寫姓名與電話'
                    : null
                  const onToggle = (checked: boolean) => {
                    setUseProfileData(checked)
                    if (!checked || !userProfile) return
                    const defaultAddr =
                      userProfile.addresses.find((a) => a.isDefault) ??
                      userProfile.addresses[0]
                    setForm((prev) => ({
                      ...prev,
                      recipientName: userProfile.name || prev.recipientName,
                      phone: userProfile.phone || prev.phone,
                      ...(!isConvenienceStore && !isMeetup && defaultAddr
                        ? {
                            city: defaultAddr.city || prev.city,
                            district: defaultAddr.district || prev.district,
                            zipCode: defaultAddr.zipCode || prev.zipCode,
                            address: defaultAddr.address || prev.address,
                          }
                        : {}),
                    }))
                  }
                  return (
                    <label
                      className={`flex items-start gap-2 mb-4 text-sm cursor-pointer select-none ${
                        canUse ? '' : 'opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={useProfileData}
                        disabled={!canUse}
                        onChange={(e) => onToggle(e.target.checked)}
                        className="mt-0.5 accent-gold-500"
                      />
                      <span>
                        <span className="font-medium">同訂購人資料</span>
                        <span className="text-muted-foreground ml-1.5">
                          {!isConvenienceStore && !isMeetup
                            ? '（自動填入姓名、電話、預設地址）'
                            : '（自動填入姓名、電話）'}
                        </span>
                        {hint && (
                          <span className="block text-xs text-muted-foreground mt-0.5">
                            {hint}
                          </span>
                        )}
                      </span>
                    </label>
                  )
                })()}

                {/* 收件人基本資訊（宅配 / 超商 / 辦公室取貨都需要） */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">
                      {isConvenienceStore || isMeetup ? '取貨人姓名' : '收件人姓名'} *
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

                {/* 到辦公室取貨表單 */}
                {isMeetup && (
                  <div className="mt-5 space-y-4">
                    <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-500/10 px-3 py-2 rounded-lg">
                      <Info size={14} className="mt-0.5 shrink-0" />
                      <p>
                        到辦公室取貨僅支援現金付款。訂單成立後客服會聯繫您確認取貨時間，請填寫您方便的建議時段。
                      </p>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1">
                        <MapPin size={12} className="text-gold-500" />
                        取貨地點 *
                      </label>
                      <input
                        type="text"
                        required
                        value={meetupInfo.location}
                        onChange={(e) =>
                          setMeetupInfo((prev) => ({ ...prev, location: e.target.value }))
                        }
                        placeholder="預設為辦公室；如需其他地點請自行更改"
                        className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1">
                        <Clock size={12} className="text-gold-500" />
                        建議取貨時段 *
                      </label>
                      <input
                        type="text"
                        required
                        value={meetupInfo.preferredTime}
                        onChange={(e) =>
                          setMeetupInfo((prev) => ({ ...prev, preferredTime: e.target.value }))
                        }
                        placeholder="例如：週六下午 2-5 點、平日晚上 7 點後"
                        className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
                      />
                    </div>
                  </div>
                )}

                {/* 宅配 / 國際地址表單 */}
                {!isConvenienceStore && !isMeetup && (
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
                    {/* 記錄此收件資料到地址簿（提交時若為新地址才真的存，否則靜默跳過） */}
                    {isAuthenticated && (
                      <label className="sm:col-span-2 flex items-start gap-2 text-sm cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={saveAddressToBook}
                          onChange={(e) => setSaveAddressToBook(e.target.checked)}
                          className="mt-0.5 accent-gold-500"
                        />
                        <span>
                          記錄此收件資料到地址簿
                          <span className="text-muted-foreground ml-1.5">
                            （下次可在「同訂購人資料」快速帶入）
                          </span>
                        </span>
                      </label>
                    )}
                  </div>
                )}

                {/* 訂單備註（checkoutCfg.notes.allowOrderNote = false 時隱藏） */}
                {checkoutCfg.notes.allowOrderNote && (
                  <div className="mt-4">
                    <label className="text-xs text-muted-foreground mb-1.5 block">
                      {checkoutCfg.notes.orderNoteLabel}（選填，最多 {checkoutCfg.notes.orderNoteMaxLength} 字）
                    </label>
                    <textarea
                      value={form.customerNote}
                      onChange={(e) =>
                        updateForm(
                          'customerNote',
                          e.target.value.slice(0, checkoutCfg.notes.orderNoteMaxLength),
                        )
                      }
                      rows={2}
                      maxLength={checkoutCfg.notes.orderNoteMaxLength}
                      className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40 resize-none"
                    />
                  </div>
                )}
              </div>

              {/* ═══════════════════════════════════════ */}
              {/* ── 優惠碼 ── */}
              {/* ═══════════════════════════════════════ */}
              <div className="bg-white rounded-2xl border border-cream-200 p-6">
                <h2 className="font-medium mb-5 flex items-center gap-2">
                  <Tag size={18} className="text-gold-500" />
                  優惠碼
                </h2>
                {appliedCoupon ? (
                  <div className="flex items-start justify-between gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                    <div className="flex items-start gap-2 min-w-0">
                      <Check size={16} className="mt-0.5 text-green-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {appliedCoupon.couponCode}
                          <span className="text-xs text-muted-foreground ml-2">
                            {appliedCoupon.name}
                          </span>
                        </p>
                        <p className="text-xs text-green-700 mt-0.5">
                          {appliedCoupon.freeShipping
                            ? '已套用免運優惠'
                            : `已折抵 NT$ ${appliedCoupon.discountAmount.toLocaleString()}`}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground shrink-0"
                      aria-label="移除優惠券"
                    >
                      <X size={14} />
                      移除
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                        placeholder="輸入優惠碼，例如 WELCOME10"
                        className="flex-1 px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40 uppercase tracking-wide"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleApplyCoupon()
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        disabled={couponLoading || !couponInput.trim()}
                        className="px-5 py-3 bg-foreground text-cream-50 rounded-xl text-sm hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {couponLoading ? '驗證中…' : '套用'}
                      </button>
                    </div>
                    {couponError && (
                      <p className="text-xs text-rose-600 mt-2">{couponError}</p>
                    )}
                  </div>
                )}
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
                  {availablePayments.map((pm) => (
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
                        {pm.id === 'cash_cod' && (
                          <p className="text-[10px] text-emerald-700 mt-1">
                            手續費 NT$ {paymentSettings.codDefaultFee}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
                {isMeetup && (
                  <p className="text-xs text-amber-700 mt-3">
                    到辦公室取貨僅支援現金付款；如需信用卡 / 行動支付請改選宅配或超商取貨。
                  </p>
                )}
                {!isMeetup && codBlockedByMax && shippingOption?.cashOnDelivery && (
                  <p className="text-xs text-amber-700 mt-3">
                    訂單金額超過 NT$ {paymentSettings.codMaxAmount.toLocaleString()}，
                    本訂單不適用貨到付款。
                  </p>
                )}
                {!isMeetup && !shippingOption?.cashOnDelivery && (
                  <p className="text-xs text-muted-foreground mt-3">
                    所選物流不支援貨到付款；改選宅配/超商可使用 COD。
                  </p>
                )}
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
            <div className="lg:sticky lg:top-28 h-fit space-y-4">
              <PromoUpsellSection />
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
                  {codFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">貨到付款手續費</span>
                      <span>NT$ {codFee}</span>
                    </div>
                  )}
                  {appliedCoupon && (couponDiscount > 0 || appliedCoupon.freeShipping) && (
                    <div className="flex justify-between text-green-700">
                      <span className="flex items-center gap-1">
                        <Tag size={12} />
                        優惠券（{appliedCoupon.couponCode}）
                      </span>
                      <span>
                        {appliedCoupon.freeShipping
                          ? '免運'
                          : `− NT$ ${couponDiscount.toLocaleString()}`}
                      </span>
                    </div>
                  )}
                  {(() => {
                    const rate = taxSettings.defaultTaxRate || 0
                    if (rate <= 0) return null
                    // 稅基：已扣優惠後的 subtotal + (可選) 運費
                    const discountedSubtotal = Math.max(0, subtotal - couponDiscount)
                    const taxableBase =
                      discountedSubtotal + (taxSettings.shippingTaxable ? shippingFee : 0)
                    const tax = taxSettings.defaultTaxIncluded
                      ? Math.round((taxableBase * rate) / (100 + rate))
                      : Math.round((taxableBase * rate) / 100)
                    if (tax <= 0) return null
                    return (
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>
                          {taxSettings.defaultTaxIncluded ? '含' : '加收'} {rate}% 營業稅
                        </span>
                        <span>NT$ {tax.toLocaleString()}</span>
                      </div>
                    )
                  })()}
                </div>

                <div className="border-t border-cream-200 pt-4 flex justify-between items-baseline">
                  <span className="font-medium">合計</span>
                  <span className="text-xl font-medium text-gold-600">
                    NT$ {total.toLocaleString()}
                  </span>
                </div>

                {checkoutCfg.minOrderAmount > 0 && subtotal < checkoutCfg.minOrderAmount && (
                  <p className="text-xs text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">
                    本站最低消費為 NT$ {checkoutCfg.minOrderAmount.toLocaleString()}，
                    還差 NT$ {(checkoutCfg.minOrderAmount - subtotal).toLocaleString()}
                  </p>
                )}

                {/* TOS / 行銷同意（讀 CheckoutSettings）*/}
                {checkoutCfg.requireTOS && (
                  <label className="flex items-start gap-2 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={tosAccepted}
                      onChange={(e) => setTosAccepted(e.target.checked)}
                      className="mt-0.5 accent-gold-500"
                    />
                    <span>
                      我已閱讀並同意
                      <Link href="/terms" className="text-gold-600 hover:underline mx-0.5">
                        服務條款
                      </Link>
                      與
                      <Link href="/privacy-policy" className="text-gold-600 hover:underline mx-0.5">
                        隱私權政策
                      </Link>
                    </span>
                  </label>
                )}
                {checkoutCfg.requireMarketingConsent && (
                  <label className="flex items-start gap-2 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={marketingAccepted}
                      onChange={(e) => setMarketingAccepted(e.target.checked)}
                      className="mt-0.5 accent-gold-500"
                    />
                    <span>{checkoutCfg.marketingConsentText}</span>
                  </label>
                )}

                <button
                  type="submit"
                  disabled={
                    isProcessing ||
                    (checkoutCfg.minOrderAmount > 0 && subtotal < checkoutCfg.minOrderAmount)
                  }
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-foreground text-cream-50 rounded-xl text-sm tracking-wide hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Lock size={14} />
                  {isProcessing ? '處理中...' : '確認付款'}
                </button>

                {!checkoutCfg.requireTOS && (
                  <p className="text-[10px] text-center text-muted-foreground leading-relaxed">
                    點擊「確認付款」即表示您同意我們的
                    <Link href="/terms" className="text-gold-600 hover:underline mx-0.5">
                      服務條款
                    </Link>
                    與
                    <Link href="/privacy-policy" className="text-gold-600 hover:underline mx-0.5">
                      隱私權政策
                    </Link>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </form>
    </main>
  )
}
