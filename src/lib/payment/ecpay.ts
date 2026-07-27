import * as crypto from 'crypto'

/**
 * ECPay 全方位金流（AIO）核心 — LB §4 線上金流串接
 * ────────────────────────────────────────────
 * 只做三件事：載入設定、產生/驗證 CheckMacValue、組建 AioCheckOut 表單參數。
 * 路由層（create / callback / result）在 src/app/(frontend)/api/payment/ecpay/。
 *
 * 憑證來源：env `ECPAY_MERCHANT_ID / ECPAY_HASH_KEY / ECPAY_HASH_IV`。
 * `ECPAY_ENV=sandbox|production` 決定閘道；sandbox 且 env 未填時退回綠界
 * 官方現行測試商店（3002607，developers.ecpay.com.tw/2856 公開憑證），
 * 可直接在測試站完成整條刷卡流程（3D 驗證頁會直接顯示 OTP=1234）。
 * ⚠️ 勿換回舊公開店 2000132：它在新版 pay-stage VerifySMS 簡訊驗證流程
 * 走不完（固定碼 1234 會被拒，2026-07-27 實測錯 3 次交易作廢）。
 * production 且憑證未填 → isConfigured=false，create 路由回 503，
 * 絕不讓正式站帶測試商店收單。
 */

export interface EcpayConfig {
  merchantId: string
  hashKey: string
  hashIV: string
  /** AioCheckOut 端點（含路徑） */
  checkoutUrl: string
  sandbox: boolean
  isConfigured: boolean
}

const ECPAY_STAGE_CHECKOUT = 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5'
const ECPAY_PROD_CHECKOUT = 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5'

/** 綠界官方 AIO 測試商店（公開憑證，僅 sandbox fallback 用；見檔頭 2000132 警告） */
const STAGE_MERCHANT_ID = '3002607'
const STAGE_HASH_KEY = 'pwFHCqoQZGmho4w6'
const STAGE_HASH_IV = 'EkRm7iFT261dpevs'

export function loadEcpayConfig(): EcpayConfig {
  const envFlag = (process.env.ECPAY_ENV || '').toLowerCase()
  const sandbox = envFlag
    ? envFlag !== 'production'
    : process.env.NODE_ENV !== 'production'

  const envId = process.env.ECPAY_MERCHANT_ID || ''
  const envKey = process.env.ECPAY_HASH_KEY || ''
  const envIV = process.env.ECPAY_HASH_IV || ''
  const hasEnvCreds = Boolean(envId && envKey && envIV)

  const merchantId = envId || (sandbox ? STAGE_MERCHANT_ID : '')
  const hashKey = envKey || (sandbox ? STAGE_HASH_KEY : '')
  const hashIV = envIV || (sandbox ? STAGE_HASH_IV : '')

  return {
    merchantId,
    hashKey,
    hashIV,
    checkoutUrl: sandbox ? ECPAY_STAGE_CHECKOUT : ECPAY_PROD_CHECKOUT,
    sandbox,
    isConfigured: sandbox ? true : hasEnvCreds,
  }
}

/**
 * ECPay .NET 風格 URL encode：encodeURIComponent 後還原 `-_.!*()`、
 * 空白轉 `+`，整串轉小寫（CheckMacValue 規範）。
 */
function ecpayUrlEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/%2D/gi, '-')
    .replace(/%5F/gi, '_')
    .replace(/%2E/gi, '.')
    .replace(/%21/gi, '!')
    .replace(/%2A/gi, '*')
    .replace(/%28/gi, '(')
    .replace(/%29/gi, ')')
    .replace(/%20/gi, '+')
    .toLowerCase()
}

/**
 * AIO CheckMacValue（EncryptType=1 / SHA256）：
 * 參數依 key 排序 → HashKey= 前綴 + &HashIV= 後綴 → ecpayUrlEncode 全串
 * → 小寫 → SHA256 → 大寫 hex。
 */
export function generateAioCheckMacValue(
  params: Record<string, string>,
  hashKey: string,
  hashIV: string,
): string {
  const sortedKeys = Object.keys(params)
    .filter((k) => k !== 'CheckMacValue')
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
  const paramStr = sortedKeys.map((k) => `${k}=${params[k]}`).join('&')
  const raw = `HashKey=${hashKey}&${paramStr}&HashIV=${hashIV}`
  const encoded = ecpayUrlEncode(raw)
  return crypto.createHash('sha256').update(encoded, 'utf8').digest('hex').toUpperCase()
}

/** callback / OrderResultURL 回傳驗章（大小寫不敏感比對） */
export function verifyAioCheckMacValue(
  params: Record<string, string>,
  hashKey: string,
  hashIV: string,
): boolean {
  const received = params.CheckMacValue
  if (!received) return false
  const expected = generateAioCheckMacValue(params, hashKey, hashIV)
  return received.toUpperCase() === expected
}

/** 綠界要求的 MerchantTradeDate 格式（台北時間 yyyy/MM/dd HH:mm:ss） */
export function formatMerchantTradeDate(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return `${get('year')}/${get('month')}/${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`
}

/**
 * MerchantTradeNo：綠界限 20 碼英數且不可重複。訂單號含 `-` 不能直接用，
 * 改用「CK + 訂單 id + base36 時間戳」確保每次重新付款都是新交易號；
 * 訂單對應關係走 CustomField1（存 orderNumber），callback 以此回查。
 */
export function buildMerchantTradeNo(orderId: number | string): string {
  const ts = Date.now().toString(36).toUpperCase()
  const idPart = String(orderId).replace(/[^A-Za-z0-9]/g, '').slice(0, 8)
  return `CK${idPart}T${ts}`.slice(0, 20)
}

export interface BuildCheckoutParamsInput {
  orderId: number | string
  orderNumber: string
  totalAmount: number
  itemNames: string[]
  siteUrl: string
}

/** 組出送往 AioCheckOut 的完整表單參數（含 CheckMacValue） */
export function buildAioCheckoutParams(
  cfg: EcpayConfig,
  input: BuildCheckoutParamsInput,
): Record<string, string> {
  // ItemName 各品項以 # 分隔，總長上限 400（保守截 380）
  const itemName =
    input.itemNames.join('#').slice(0, 380) || `訂單 ${input.orderNumber}`

  const params: Record<string, string> = {
    MerchantID: cfg.merchantId,
    MerchantTradeNo: buildMerchantTradeNo(input.orderId),
    MerchantTradeDate: formatMerchantTradeDate(),
    PaymentType: 'aio',
    TotalAmount: String(Math.round(input.totalAmount)),
    TradeDesc: 'CHIC KIM MIU Online Order',
    ItemName: itemName,
    // server-to-server 付款結果通知（背景）
    ReturnURL: `${input.siteUrl}/api/payment/ecpay/callback`,
    // 顧客瀏覽器付款完成後由綠界 POST 導回
    OrderResultURL: `${input.siteUrl}/api/payment/ecpay/result`,
    // 顧客在綠界頁按「返回商店」
    ClientBackURL: `${input.siteUrl}/checkout/success/${encodeURIComponent(input.orderNumber)}`,
    // 預設只開信用卡（同步付款）。ATM/超商代碼是非同步取號，會被
    // 60 分鐘未付款自動取消誤殺，等取消時窗策略調整後再開 ALL。
    ChoosePayment: process.env.ECPAY_CHOOSE_PAYMENT || 'Credit',
    EncryptType: '1',
    // 訂單對應鍵：callback / result 以 CustomField1 回查訂單
    CustomField1: input.orderNumber,
    NeedExtraPaidInfo: 'N',
  }
  params.CheckMacValue = generateAioCheckMacValue(params, cfg.hashKey, cfg.hashIV)
  return params
}
