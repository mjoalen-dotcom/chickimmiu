import { getPayload } from 'payload'
import config from '@payload-config'
import * as crypto from 'crypto'

/**
 * ECPay 電子發票引擎 — 新版 B2CInvoice JSON+AES API
 * ────────────────────────────────────────────
 * 傳輸格式（developers.ecpay.com.tw/?p=7958 參數加密方式說明）：
 *   POST JSON { MerchantID, RqHeader:{ Timestamp }, Data }
 *   Data = base64( AES-128-CBC/PKCS7( URL-encode( JSON payload ), HashKey, HashIV ) )
 *   回應信封 { TransCode, TransMsg, RpHeader, Data }；TransCode=1 才有 Data，
 *   Data 同法解密後才是業務結果（RtnCode=1 = 成功）。
 *
 * 憑證來源：env `ECPAY_INVOICE_MERCHANT_ID / HASH_KEY / HASH_IV`。
 * `ECPAY_INVOICE_ENV=sandbox|production` 決定閘道（比照 payment/ecpay.ts）；
 * sandbox 且 env 未填時退回綠界官方電子發票測試環境憑證（2000132）。
 * production 且憑證缺值 → isConfigured=false，一律略過開立（不打 API、
 * 不建 failed 發票紀錄），避免拿測試憑證打正式端點。
 */

// ── Types ──

interface InvoiceConfig {
  merchantId: string
  hashKey: string
  hashIV: string
  gatewayUrl: string
  sandbox: boolean
  /** production 且 ECPAY_INVOICE_* 任一缺值 → false，所有開立/重試直接略過 */
  isConfigured: boolean
}

interface IssueInvoiceParams {
  orderId: string
  orderNumber: string
  invoiceType: 'b2c_personal' | 'b2c_carrier' | 'b2b' | 'donation'
  buyerName: string
  buyerEmail: string
  buyerPhone?: string
  buyerUBN?: string
  buyerCompanyName?: string
  buyerAddress?: string
  carrierType?: 'none' | 'phone_barcode' | 'natural_cert' | 'ecpay_member'
  carrierNumber?: string
  loveCode?: string
  items: Array<{
    name: string
    count: number
    word: string
    price: number
    taxType?: string
  }>
  totalAmount: number
  taxType?: string
  customerId?: string
}

interface ECPayResponse {
  RtnCode: number
  RtnMsg: string
  InvoiceNo?: string
  InvoiceDate?: string
  RandomNumber?: string
  [key: string]: unknown
}

// ── 常數 ──

/** 最大重試次數 */
const MAX_RETRY_COUNT = 3

/** ECPay 載具類型對照（B2CInvoice CarrierType） */
const CARRIER_TYPE_MAP: Record<string, string> = {
  none: '',
  ecpay_member: '1',
  natural_cert: '2',
  phone_barcode: '3',
}

/** ECPay 稅別對照 */
const TAX_TYPE_MAP: Record<string, string> = {
  taxable: '1',
  zero_tax: '2',
  tax_free: '3',
  mixed: '9',
}

/** ECPay 品項稅別對照 */
const ITEM_TAX_TYPE_MAP: Record<string, string> = {
  taxable: '1',
  zero_tax: '2',
  tax_free: '3',
}

const EINVOICE_STAGE_GATEWAY = 'https://einvoice-stage.ecpay.com.tw'
const EINVOICE_PROD_GATEWAY = 'https://einvoice.ecpay.com.tw'

/** 綠界官方電子發票測試環境公開憑證（?p=7958；僅 sandbox fallback 用） */
const STAGE_INVOICE_MERCHANT_ID = '2000132'
const STAGE_INVOICE_HASH_KEY = 'ejCk326UnaZWKisg'
const STAGE_INVOICE_HASH_IV = 'q9jcZX8Ib9LM8wYk'

// ── 設定 ──

/**
 * 從環境變數載入 ECPay 電子發票設定。
 * ECPAY_INVOICE_ENV 未設時以 NODE_ENV 判斷（比照 payment/ecpay.ts 的 ECPAY_ENV）。
 */
export function loadInvoiceConfig(): InvoiceConfig {
  const envFlag = (process.env.ECPAY_INVOICE_ENV || '').toLowerCase()
  const sandbox = envFlag
    ? envFlag !== 'production'
    : process.env.NODE_ENV !== 'production'

  const envId = process.env.ECPAY_INVOICE_MERCHANT_ID || ''
  const envKey = process.env.ECPAY_INVOICE_HASH_KEY || ''
  const envIV = process.env.ECPAY_INVOICE_HASH_IV || ''
  const hasEnvCreds = Boolean(envId && envKey && envIV)

  return {
    merchantId: envId || (sandbox ? STAGE_INVOICE_MERCHANT_ID : ''),
    hashKey: envKey || (sandbox ? STAGE_INVOICE_HASH_KEY : ''),
    hashIV: envIV || (sandbox ? STAGE_INVOICE_HASH_IV : ''),
    gatewayUrl: sandbox ? EINVOICE_STAGE_GATEWAY : EINVOICE_PROD_GATEWAY,
    sandbox,
    isConfigured: sandbox ? true : hasEnvCreds,
  }
}

// ── 傳輸層 ──

/** Data 加密：JSON → URL-encode → AES-128-CBC(PKCS7) → base64 */
export function encryptInvoiceData(
  payload: unknown,
  hashKey: string,
  hashIV: string,
): string {
  const plaintext = encodeURIComponent(JSON.stringify(payload))
  const cipher = crypto.createCipheriv('aes-128-cbc', hashKey, hashIV)
  return Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]).toString(
    'base64',
  )
}

/** Data 解密：base64 → AES 解密 → URL-decode（.NET UrlEncode 的 + 先轉空白）→ JSON */
export function decryptInvoiceData(
  data: string,
  hashKey: string,
  hashIV: string,
): Record<string, unknown> {
  const decipher = crypto.createDecipheriv('aes-128-cbc', hashKey, hashIV)
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(data, 'base64')),
    decipher.final(),
  ]).toString('utf8')
  return JSON.parse(decodeURIComponent(decrypted.replace(/\+/g, '%20')))
}

/**
 * 發送 B2CInvoice API 請求。
 * data 內容會自動補 MerchantID 後加密塞進信封的 Data。
 * 傳輸層失敗（HTTP 非 JSON / TransCode≠1）以 RtnCode:0 回報，不 throw。
 */
async function postToECPay(
  cfg: InvoiceConfig,
  path: string,
  data: Record<string, unknown>,
): Promise<ECPayResponse> {
  const envelope = {
    MerchantID: cfg.merchantId,
    RqHeader: { Timestamp: Math.floor(Date.now() / 1000) },
    Data: encryptInvoiceData(
      { MerchantID: cfg.merchantId, ...data },
      cfg.hashKey,
      cfg.hashIV,
    ),
  }

  const response = await fetch(`${cfg.gatewayUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(envelope),
  })

  const text = await response.text()
  let parsed: { TransCode?: number; TransMsg?: string; Data?: string }
  try {
    parsed = JSON.parse(text)
  } catch {
    return {
      RtnCode: 0,
      RtnMsg: `ECPay 回應非 JSON（HTTP ${response.status}）：${text.slice(0, 200)}`,
    }
  }

  if (parsed.TransCode !== 1 || !parsed.Data) {
    return {
      RtnCode: 0,
      RtnMsg: `傳輸失敗 TransCode=${parsed.TransCode ?? '?'} ${parsed.TransMsg ?? ''}`.trim(),
    }
  }

  const dataObj = decryptInvoiceData(parsed.Data, cfg.hashKey, cfg.hashIV)
  return {
    ...dataObj,
    RtnCode: Number(dataObj.RtnCode) || 0,
    RtnMsg: String(dataObj.RtnMsg || ''),
  } as ECPayResponse
}

/** Issue 回應的 InvoiceDate 是 `yyyy-MM-dd HH:mm:ss`，查詢/作廢/折讓只吃日期部分 */
function toInvoiceDateOnly(invoiceDate: string): string {
  return invoiceDate.slice(0, 10)
}

// ── 稅額 ──

/**
 * 計算稅額
 * - 應稅：salesAmount = round(totalAmount / 1.05), taxAmount = totalAmount - salesAmount
 * - 零稅率 / 免稅：salesAmount = totalAmount, taxAmount = 0
 */
export function calculateTax(
  totalAmount: number,
  taxType: string,
): { salesAmount: number; taxAmount: number } {
  if (taxType === 'taxable' || taxType === '1') {
    const salesAmount = Math.round(totalAmount / 1.05)
    const taxAmount = totalAmount - salesAmount
    return { salesAmount, taxAmount }
  }

  // 零稅率或免稅
  return { salesAmount: totalAmount, taxAmount: 0 }
}

/**
 * 品項合計對帳：綠界要求 Σ ItemAmount = SalesAmount，不符即以金額不符拒開。
 * 合計與 totalAmount 有差額時補一列調整項吸收（正差=其他費用、負差=折扣折抵），
 * 讓運費/折抵未逐列展開的舊紀錄（retry 路徑）與所有呼叫端都不會被拒開。
 */
export function reconcileInvoiceItems(
  items: IssueInvoiceParams['items'],
  totalAmount: number,
): IssueInvoiceParams['items'] {
  const target = Math.round(totalAmount)
  const lineSum = items.reduce((sum, item) => sum + item.count * item.price, 0)
  const diff = target - lineSum
  if (diff === 0) return items
  return [
    ...items,
    {
      name: diff > 0 ? '其他費用' : '折扣折抵',
      count: 1,
      word: '式',
      price: diff,
      taxType: 'taxable',
    },
  ]
}

// ── 核心函式 ──

/**
 * 開立電子發票（POST /B2CInvoice/Issue）
 *
 * 根據發票類型自動設定列印、載具、捐贈等欄位；品項為物件陣列（新版格式）。
 * B2C 不印不捐且未指定載具時，預設存綠界會員載具（CarrierType=1），
 * 符合「無實體發票必須存載具」的開立規則。
 */
export async function issueInvoice(params: IssueInvoiceParams): Promise<{
  success: boolean
  invoiceNo?: string
  invoiceDate?: string
  randomNumber?: string
  rtnCode?: number
  rtnMsg?: string
  rawResponse?: Record<string, unknown>
}> {
  const cfg = loadInvoiceConfig()
  if (!cfg.isConfigured) {
    console.warn(
      '[ECPay Invoice] production 未設定 ECPAY_INVOICE_MERCHANT_ID/HASH_KEY/HASH_IV，略過開立',
    )
    return { success: false, rtnMsg: 'ECPay 發票憑證未設定（production），已略過開立' }
  }

  // ── 發票類型相關欄位 ──
  const isB2B = params.invoiceType === 'b2b'
  const isDonation = params.invoiceType === 'donation'
  const hasCarrier =
    params.invoiceType === 'b2c_carrier' &&
    params.carrierType &&
    params.carrierType !== 'none'

  // Print: 三聯式必須印（1），其他不印（0）
  const print = isB2B ? '1' : '0'

  // Donation
  const donation = isDonation ? '1' : '0'

  // 載具：指定載具照填；B2C 不印不捐未指定 → 綠界會員載具
  let carrierType = hasCarrier ? CARRIER_TYPE_MAP[params.carrierType!] || '' : ''
  let carrierNum = hasCarrier ? params.carrierNumber || '' : ''
  if (!carrierType && print === '0' && donation === '0') {
    carrierType = '1'
    carrierNum = ''
  }

  // 愛心碼
  const loveCode = isDonation ? params.loveCode || '' : ''

  // 統一編號（B2B 必填）
  const customerIdentifier = isB2B ? params.buyerUBN || '' : ''

  // 稅別
  const taxType = TAX_TYPE_MAP[params.taxType || 'taxable'] || '1'

  // ── 品項（新版為物件陣列；合計必須等於 SalesAmount，差額補調整列） ──
  const items = reconcileInvoiceItems(params.items, params.totalAmount).map((item, idx) => ({
    ItemSeq: idx + 1,
    ItemName: item.name,
    ItemCount: item.count,
    ItemWord: item.word,
    ItemPrice: item.price,
    ItemTaxType: ITEM_TAX_TYPE_MAP[item.taxType || 'taxable'] || '1',
    ItemAmount: item.count * item.price,
  }))

  // ── 組合 Data payload ──
  const data: Record<string, unknown> = {
    RelateNumber: params.orderNumber,
    CustomerID: params.customerId
      ? String(params.customerId).replace(/[^A-Za-z0-9_]/g, '')
      : '',
    CustomerIdentifier: customerIdentifier,
    CustomerName: isB2B ? params.buyerCompanyName || params.buyerName : params.buyerName,
    CustomerAddr: params.buyerAddress || '',
    CustomerPhone: params.buyerPhone || '',
    CustomerEmail: params.buyerEmail,
    Print: print,
    Donation: donation,
    LoveCode: loveCode,
    CarrierType: carrierType,
    CarrierNum: carrierNum,
    TaxType: taxType,
    SalesAmount: Math.round(params.totalAmount),
    InvoiceRemark: '',
    Items: items,
    InvType: '07',
    vat: '1',
  }

  // ── 送出請求 ──
  try {
    const result = await postToECPay(cfg, '/B2CInvoice/Issue', data)

    const success = result.RtnCode === 1
    return {
      success,
      invoiceNo: result.InvoiceNo as string | undefined,
      invoiceDate: result.InvoiceDate as string | undefined,
      randomNumber: result.RandomNumber as string | undefined,
      rtnCode: result.RtnCode,
      rtnMsg: result.RtnMsg,
      rawResponse: result as unknown as Record<string, unknown>,
    }
  } catch (error) {
    console.error('[ECPay Invoice] 開立發票請求失敗:', error)
    return {
      success: false,
      rtnMsg: error instanceof Error ? error.message : '請求失敗',
    }
  }
}

/**
 * 查詢發票（POST /B2CInvoice/GetIssue）
 * 以發票號碼＋發票日期查詢；invoiceDate 可帶完整時間字串，自動取日期部分。
 */
export async function queryInvoice(
  invoiceNo: string,
  invoiceDate: string,
): Promise<ECPayResponse> {
  const cfg = loadInvoiceConfig()
  if (!cfg.isConfigured) {
    return { RtnCode: 0, RtnMsg: 'ECPay 發票憑證未設定（production），無法查詢' }
  }

  try {
    return await postToECPay(cfg, '/B2CInvoice/GetIssue', {
      InvoiceNo: invoiceNo,
      InvoiceDate: toInvoiceDateOnly(invoiceDate),
    })
  } catch (error) {
    console.error('[ECPay Invoice] 查詢發票請求失敗:', error)
    return {
      RtnCode: 0,
      RtnMsg: error instanceof Error ? error.message : '查詢失敗',
    }
  }
}

/**
 * 作廢發票（POST /B2CInvoice/Invalid）
 * InvoiceDate 優先用呼叫端提供值，否則從 invoices 紀錄的 ecpayResponse 取。
 */
export async function voidInvoice(
  invoiceNo: string,
  voidReason: string,
  invoiceDate?: string,
): Promise<{ success: boolean; rtnMsg?: string }> {
  const cfg = loadInvoiceConfig()
  if (!cfg.isConfigured) {
    return { success: false, rtnMsg: 'ECPay 發票憑證未設定（production），無法作廢' }
  }

  const payload = await getPayload({ config })
  const invoiceRecords = await payload.find({
    collection: 'invoices',
    where: { invoiceNumber: { equals: invoiceNo } },
    limit: 1,
  })

  let resolvedDate = invoiceDate || ''
  if (!resolvedDate && invoiceRecords.docs.length > 0) {
    const ecpayResp = invoiceRecords.docs[0].ecpayResponse as
      | { invoiceDate?: string }
      | undefined
    resolvedDate = ecpayResp?.invoiceDate || ''
  }

  try {
    const result = await postToECPay(cfg, '/B2CInvoice/Invalid', {
      InvoiceNo: invoiceNo,
      InvoiceDate: toInvoiceDateOnly(resolvedDate),
      // Reason 上限 20 字
      Reason: voidReason.slice(0, 20),
    })

    const success = result.RtnCode === 1

    // 更新 Payload 中的發票狀態
    if (success && invoiceRecords.docs.length > 0) {
      await (payload.update as Function)({
        collection: 'invoices',
        id: invoiceRecords.docs[0].id,
        data: {
          status: 'void',
          voidInfo: {
            voidReason,
            voidDate: new Date().toISOString(),
          },
        },
      })
    }

    return { success, rtnMsg: result.RtnMsg }
  } catch (error) {
    console.error('[ECPay Invoice] 作廢發票請求失敗:', error)
    return {
      success: false,
      rtnMsg: error instanceof Error ? error.message : '作廢失敗',
    }
  }
}

/**
 * 開立折讓（POST /B2CInvoice/Allowance）
 * 針對已開立發票進行部分或全額折讓；新版必帶 InvoiceDate，
 * 從 invoices 紀錄的 ecpayResponse 取得。
 */
export async function issueAllowance(
  invoiceNo: string,
  allowanceAmount: number,
  items: Array<{
    name: string
    count: number
    word: string
    price: number
    taxType?: string
  }>,
): Promise<{ success: boolean; allowanceNo?: string; rtnMsg?: string }> {
  const cfg = loadInvoiceConfig()
  if (!cfg.isConfigured) {
    return { success: false, rtnMsg: 'ECPay 發票憑證未設定（production），無法折讓' }
  }

  // 從發票紀錄取得發票日期與買受人 Email
  const payload = await getPayload({ config })
  const invoiceRecords = await payload.find({
    collection: 'invoices',
    where: { invoiceNumber: { equals: invoiceNo } },
    limit: 1,
  })

  let invoiceDate = ''
  let notifyMail = ''
  let customerName = ''
  if (invoiceRecords.docs.length > 0) {
    const doc = invoiceRecords.docs[0]
    const ecpayResp = doc.ecpayResponse as { invoiceDate?: string } | undefined
    const buyerInfo = doc.buyerInfo as
      | { buyerEmail?: string; buyerName?: string }
      | undefined
    invoiceDate = ecpayResp?.invoiceDate || ''
    notifyMail = buyerInfo?.buyerEmail || ''
    customerName = buyerInfo?.buyerName || ''
  }

  const allowanceItems = items.map((item, idx) => ({
    ItemSeq: idx + 1,
    ItemName: item.name,
    ItemCount: item.count,
    ItemWord: item.word,
    ItemPrice: item.price,
    ItemTaxType: ITEM_TAX_TYPE_MAP[item.taxType || 'taxable'] || '1',
    ItemAmount: item.count * item.price,
  }))

  try {
    const result = await postToECPay(cfg, '/B2CInvoice/Allowance', {
      InvoiceNo: invoiceNo,
      InvoiceDate: toInvoiceDateOnly(invoiceDate),
      // 有 Email 用 Email 通知，否則不通知
      AllowanceNotify: notifyMail ? 'E' : 'N',
      CustomerName: customerName,
      NotifyMail: notifyMail,
      NotifyPhone: '',
      AllowanceAmount: Math.round(allowanceAmount),
      Items: allowanceItems,
    })

    const success = result.RtnCode === 1
    const allowanceNo = result.IA_Allow_No as string | undefined

    // 更新 Payload 中的發票狀態
    if (success && invoiceRecords.docs.length > 0) {
      await (payload.update as Function)({
        collection: 'invoices',
        id: invoiceRecords.docs[0].id,
        data: {
          status: 'allowance',
          allowanceInfo: {
            allowanceAmount,
            allowanceDate: new Date().toISOString(),
            allowanceNo: allowanceNo || '',
          },
        },
      })
    }

    return { success, allowanceNo, rtnMsg: result.RtnMsg }
  } catch (error) {
    console.error('[ECPay Invoice] 開立折讓請求失敗:', error)
    return {
      success: false,
      rtnMsg: error instanceof Error ? error.message : '折讓失敗',
    }
  }
}

/**
 * 訂單付款成功後自動開立發票
 *
 * 整合 Orders afterChange hook 使用
 * 流程：
 * 1. 載入訂單資料
 * 2. 建立 pending 發票紀錄
 * 3. 呼叫 issueInvoice 開立
 * 4. 更新發票紀錄（成功/失敗）
 *
 * production 憑證未設定時直接略過（不建 failed 紀錄，避免 retry cron 空轉）。
 */
export async function autoIssueInvoiceForOrder(
  orderId: string,
): Promise<{ success: boolean; invoiceId?: string; error?: string }> {
  const cfg = loadInvoiceConfig()
  if (!cfg.isConfigured) {
    console.warn(
      `[ECPay Invoice] production 未設定 ECPAY_INVOICE_* 憑證，訂單 ${orderId} 略過開立發票`,
    )
    return { success: false, error: 'ECPay 發票憑證未設定，已略過開立' }
  }

  const payload = await getPayload({ config })

  try {
    // ── 載入訂單 ──
    const order = await payload.findByID({
      collection: 'orders',
      id: orderId,
      depth: 1,
    })

    if (!order) {
      return { success: false, error: '找不到訂單' }
    }

    // ── 檢查是否已開過發票 ──
    const existingInvoice = await payload.find({
      collection: 'invoices',
      where: { order: { equals: orderId } },
      limit: 1,
    })

    if (existingInvoice.docs.length > 0) {
      const existingStatus = existingInvoice.docs[0].status as string
      if (existingStatus === 'issued') {
        return {
          success: true,
          invoiceId: existingInvoice.docs[0].id as unknown as string,
          error: '此訂單已開立發票',
        }
      }
    }

    // ── 從訂單取得買方資訊 ──
    const customer = order.customer as unknown as Record<string, unknown> | string
    const customerId = typeof customer === 'string' ? customer : (customer?.id as unknown as string)
    let customerData: Record<string, unknown> | null = null

    if (typeof customer === 'object' && customer !== null) {
      customerData = customer
    } else if (customerId) {
      customerData = (await payload.findByID({
        collection: 'customers',
        id: customerId,
      })) as unknown as Record<string, unknown>
    }

    const shippingAddress = order.shippingAddress as unknown as Record<string, unknown> | undefined
    const buyerName =
      (shippingAddress?.recipientName as string) ||
      (customerData?.name as string) ||
      '消費者'
    const buyerEmail = (customerData?.email as string) || ''
    const buyerPhone =
      (shippingAddress?.phone as string) ||
      (customerData?.phone as string) ||
      ''
    const buyerAddress = shippingAddress
      ? `${shippingAddress.city || ''}${shippingAddress.district || ''}${shippingAddress.address || ''}`
      : ''

    // ── 組合品項 ──
    const orderItems = order.items as Array<{
      productName: string
      quantity: number
      unitPrice: number
    }>

    const orderTotal = Math.round(Number(order.total) || 0)
    if (orderTotal <= 0) {
      // 全額折抵訂單綠界必拒開，直接略過（不建 failed 紀錄，避免 retry cron 空轉）
      return { success: false, error: '訂單總額為 0，略過開立發票' }
    }

    const invoiceItems = orderItems.map((item) => ({
      name: item.productName,
      count: item.quantity,
      word: '件',
      price: item.unitPrice,
      taxType: 'taxable',
    }))

    // 運費/手續費逐列展開；剩餘差額（折價券/會員折扣/購物金）補一列負數折抵。
    // 綠界要求品項合計 = SalesAmount（order.total），缺列會以金額不符拒開（LAUNCH §4-5）
    const shippingFee = Math.round(Number(order.shippingFee) || 0)
    if (shippingFee > 0) {
      invoiceItems.push({ name: '運費', count: 1, word: '式', price: shippingFee, taxType: 'taxable' })
    }
    const codFee = Math.round(Number(order.codFee) || 0)
    if (codFee > 0) {
      invoiceItems.push({ name: '貨到付款手續費', count: 1, word: '式', price: codFee, taxType: 'taxable' })
    }
    const lineSum = invoiceItems.reduce((sum, item) => sum + item.count * item.price, 0)
    const adjustment = orderTotal - lineSum
    if (adjustment !== 0) {
      invoiceItems.push({
        name: adjustment < 0 ? '折扣折抵' : '訂單調整',
        count: 1,
        word: '式',
        price: adjustment,
        taxType: 'taxable',
      })
    }

    // ── 預設發票類型：個人二聯式（手機條碼載具） ──
    // 實務上應從訂單或前端帶入發票資訊，此處設定合理預設值
    const invoiceType: IssueInvoiceParams['invoiceType'] = 'b2c_personal'
    const orderNumber = order.orderNumber as string

    // ── 建立 pending 發票紀錄 ──
    const invoiceDoc = await (payload.create as Function)({
      collection: 'invoices',
      data: {
        order: orderId,
        customer: customerId,
        invoiceType,
        status: 'pending',
        buyerInfo: {
          buyerName,
          buyerEmail,
          buyerPhone,
          buyerAddress,
        },
        invoiceItems: invoiceItems.map((item) => ({
          itemName: item.name,
          itemCount: item.count,
          itemWord: item.word,
          itemPrice: item.price,
          itemTaxType: 'taxable',
          itemAmount: item.count * item.price,
        })),
        totalAmount: orderTotal,
        taxType: 'taxable',
        retryCount: 0,
      },
    })

    // ── 呼叫 ECPay 開立發票 ──
    const result = await issueInvoice({
      orderId,
      orderNumber,
      invoiceType,
      buyerName,
      buyerEmail,
      buyerPhone,
      buyerAddress,
      items: invoiceItems,
      totalAmount: orderTotal,
      taxType: 'taxable',
      customerId,
    })

    // ── 更新發票紀錄 ──
    if (result.success) {
      const { salesAmount, taxAmount } = calculateTax(orderTotal, 'taxable')

      await (payload.update as Function)({
        collection: 'invoices',
        id: invoiceDoc.id,
        data: {
          invoiceNumber: result.invoiceNo || '',
          status: 'issued',
          salesAmount,
          taxAmount,
          ecpayResponse: {
            invoiceNo: result.invoiceNo || '',
            invoiceDate: result.invoiceDate || '',
            randomNumber: result.randomNumber || '',
            rtnCode: String(result.rtnCode || ''),
            rtnMsg: result.rtnMsg || '',
            rawResponse: result.rawResponse || {},
          },
        },
      })

      console.log(
        `[ECPay Invoice] 訂單 ${orderNumber} 發票開立成功：${result.invoiceNo}`,
      )

      return { success: true, invoiceId: invoiceDoc.id as unknown as string }
    } else {
      await (payload.update as Function)({
        collection: 'invoices',
        id: invoiceDoc.id,
        data: {
          status: 'failed',
          lastError: result.rtnMsg || '開立失敗（未知原因）',
          retryCount: 0,
          ecpayResponse: {
            rtnCode: String(result.rtnCode || ''),
            rtnMsg: result.rtnMsg || '',
            rawResponse: result.rawResponse || {},
          },
        },
      })

      console.error(
        `[ECPay Invoice] 訂單 ${orderNumber} 發票開立失敗：${result.rtnMsg}`,
      )

      return {
        success: false,
        invoiceId: invoiceDoc.id as unknown as string,
        error: result.rtnMsg || '開立失敗',
      }
    }
  } catch (error) {
    console.error('[ECPay Invoice] autoIssueInvoiceForOrder 錯誤:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '系統錯誤',
    }
  }
}

/**
 * 自動重試失敗的發票
 *
 * 查詢 status='failed' 且 retryCount < MAX_RETRY_COUNT 的發票
 * 逐筆重新嘗試開立，更新狀態
 */
export async function retryFailedInvoices(): Promise<{
  retried: number
  succeeded: number
  failed: number
}> {
  const result = { retried: 0, succeeded: 0, failed: 0 }

  const cfg = loadInvoiceConfig()
  if (!cfg.isConfigured) {
    console.warn('[ECPay Invoice] production 未設定 ECPAY_INVOICE_* 憑證，略過發票重試')
    return result
  }

  const payload = await getPayload({ config })

  try {
    // ── 查詢需要重試的發票 ──
    const failedInvoices = await payload.find({
      collection: 'invoices',
      where: {
        and: [
          { status: { equals: 'failed' } },
          { retryCount: { less_than: MAX_RETRY_COUNT } },
        ],
      },
      limit: 50,
      depth: 1,
    })

    if (failedInvoices.docs.length === 0) {
      console.log('[ECPay Invoice] 無需重試的失敗發票')
      return result
    }

    console.log(
      `[ECPay Invoice] 找到 ${failedInvoices.docs.length} 張失敗發票待重試`,
    )

    for (const invoice of failedInvoices.docs) {
      result.retried++

      const orderId =
        typeof invoice.order === 'string'
          ? invoice.order
          : (invoice.order as unknown as Record<string, unknown>)?.id as unknown as string
      const customerId =
        typeof invoice.customer === 'string'
          ? invoice.customer
          : (invoice.customer as unknown as Record<string, unknown>)?.id as unknown as string

      // 取得訂單資料
      let order: Record<string, unknown> | null = null
      try {
        order = (await payload.findByID({
          collection: 'orders',
          id: orderId,
        })) as unknown as Record<string, unknown>
      } catch {
        console.error(`[ECPay Invoice] 重試時找不到訂單 ${orderId}`)
        result.failed++
        continue
      }

      // 標記為重試中
      const currentRetryCount = (invoice.retryCount as number) || 0
      await (payload.update as Function)({
        collection: 'invoices',
        id: invoice.id,
        data: {
          status: 'retry',
          retryCount: currentRetryCount + 1,
        },
      })

      // 組合品項
      const invoiceItemsRaw = invoice.invoiceItems as Array<{
        itemName: string
        itemCount: number
        itemWord: string
        itemPrice: number
        itemTaxType?: string
      }>

      const items = invoiceItemsRaw.map((item) => ({
        name: item.itemName,
        count: item.itemCount,
        word: item.itemWord || '件',
        price: item.itemPrice,
        taxType: item.itemTaxType || 'taxable',
      }))

      const buyerInfo = invoice.buyerInfo as unknown as Record<string, unknown> | undefined
      const invoiceType = invoice.invoiceType as IssueInvoiceParams['invoiceType']
      const carrierInfo = invoice.carrierInfo as unknown as Record<string, unknown> | undefined
      const donationInfo = invoice.donationInfo as unknown as Record<string, unknown> | undefined

      // 重新呼叫 ECPay
      const issueResult = await issueInvoice({
        orderId,
        orderNumber: order.orderNumber as string,
        invoiceType,
        buyerName: (buyerInfo?.buyerName as string) || '',
        buyerEmail: (buyerInfo?.buyerEmail as string) || '',
        buyerPhone: (buyerInfo?.buyerPhone as string) || '',
        buyerUBN: (buyerInfo?.buyerUBN as string) || '',
        buyerCompanyName: (buyerInfo?.buyerCompanyName as string) || '',
        buyerAddress: (buyerInfo?.buyerAddress as string) || '',
        carrierType: (carrierInfo?.carrierType as IssueInvoiceParams['carrierType']) || 'none',
        carrierNumber: (carrierInfo?.carrierNumber as string) || '',
        loveCode: (donationInfo?.loveCode as string) || '',
        items,
        totalAmount: invoice.totalAmount as number,
        taxType: (invoice.taxType as string) || 'taxable',
        customerId,
      })

      if (issueResult.success) {
        const { salesAmount, taxAmount } = calculateTax(
          invoice.totalAmount as number,
          (invoice.taxType as string) || 'taxable',
        )

        await (payload.update as Function)({
          collection: 'invoices',
          id: invoice.id,
          data: {
            invoiceNumber: issueResult.invoiceNo || '',
            status: 'issued',
            salesAmount,
            taxAmount,
            ecpayResponse: {
              invoiceNo: issueResult.invoiceNo || '',
              invoiceDate: issueResult.invoiceDate || '',
              randomNumber: issueResult.randomNumber || '',
              rtnCode: String(issueResult.rtnCode || ''),
              rtnMsg: issueResult.rtnMsg || '',
              rawResponse: issueResult.rawResponse || {},
            },
          },
        })

        console.log(
          `[ECPay Invoice] 重試成功：發票 ${issueResult.invoiceNo}（訂單 ${order.orderNumber}）`,
        )
        result.succeeded++
      } else {
        await (payload.update as Function)({
          collection: 'invoices',
          id: invoice.id,
          data: {
            status: 'failed',
            lastError: issueResult.rtnMsg || '重試失敗',
            ecpayResponse: {
              rtnCode: String(issueResult.rtnCode || ''),
              rtnMsg: issueResult.rtnMsg || '',
              rawResponse: issueResult.rawResponse || {},
            },
          },
        })

        console.error(
          `[ECPay Invoice] 重試失敗：訂單 ${order.orderNumber}，原因：${issueResult.rtnMsg}`,
        )
        result.failed++
      }
    }
  } catch (error) {
    console.error('[ECPay Invoice] retryFailedInvoices 錯誤:', error)
  }

  console.log(
    `[ECPay Invoice] 重試結果：共 ${result.retried} 張，成功 ${result.succeeded}，失敗 ${result.failed}`,
  )
  return result
}
