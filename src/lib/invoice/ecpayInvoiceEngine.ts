import { getPayload } from 'payload'
import config from '@payload-config'
import * as crypto from 'crypto'

// ── Types ──

interface InvoiceConfig {
  merchantId: string
  hashKey: string
  hashIV: string
  gatewayUrl: string
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

/** ECPay 載具類型對照 */
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

// ── 核心函式 ──

/**
 * 從環境變數載入 ECPay 電子發票設定
 * 若環境變數未設定則使用測試環境預設值
 */
export async function loadInvoiceConfig(): Promise<InvoiceConfig> {
  const isProduction = process.env.NODE_ENV === 'production'

  const merchantId = process.env.ECPAY_INVOICE_MERCHANT_ID || '2000132'
  const hashKey = process.env.ECPAY_INVOICE_HASH_KEY || 'ejCk326UnaZWKisg'
  const hashIV = process.env.ECPAY_INVOICE_HASH_IV || 'q9jcZX8Ib9LM8wYk'

  const gatewayUrl = isProduction
    ? 'https://einvoice.ecpay.com.tw'
    : 'https://einvoice-stage.ecpay.com.tw'

  return { merchantId, hashKey, hashIV, gatewayUrl }
}

/**
 * ECPay 專用 URL 編碼
 * 依照綠界 .NET 風格 URL encoding 規則處理特殊字元
 */
function ecpayUrlEncode(str: string): string {
  let encoded = encodeURIComponent(str)

  // 還原 .NET 風格不編碼的字元
  encoded = encoded
    .replace(/%2D/gi, '-')
    .replace(/%5F/gi, '_')
    .replace(/%2E/gi, '.')
    .replace(/%21/gi, '!')
    .replace(/%2A/gi, '*')
    .replace(/%28/gi, '(')
    .replace(/%29/gi, ')')
    .replace(/%20/gi, '+')

  // 轉為小寫（ECPay 規範）
  return encoded.toLowerCase()
}

/**
 * 產生 ECPay CheckMacValue（HMAC-SHA256）
 *
 * 流程：
 * 1. 參數按 key 字母排序
 * 2. 組合成 key=value& 字串
 * 3. 前後加上 HashKey / HashIV
 * 4. 使用 ECPay URL encode
 * 5. 轉小寫
 * 6. SHA256 雜湊後轉大寫
 */
export function generateCheckMacValue(
  params: Record<string, string>,
  hashKey: string,
  hashIV: string,
): string {
  // 1. 按 key 字母排序（不區分大小寫）
  const sortedKeys = Object.keys(params).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase()),
  )

  // 2. 組合成 key=value& 字串
  const paramStr = sortedKeys.map((key) => `${key}=${params[key]}`).join('&')

  // 3. 前後加上 HashKey / HashIV
  const raw = `HashKey=${hashKey}&${paramStr}&HashIV=${hashIV}`

  // 4. URL encode（ECPay 自訂規則）
  const encoded = ecpayUrlEncode(raw)

  // 5. 轉小寫（ecpayUrlEncode 已處理）
  const lowered = encoded.toLowerCase()

  // 6. SHA256 雜湊 → 大寫
  const hash = crypto.createHash('sha256').update(lowered, 'utf8').digest('hex')

  return hash.toUpperCase()
}

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
 * 發送 POST 請求到 ECPay
 * Content-Type: application/x-www-form-urlencoded
 */
async function postToECPay(url: string, params: Record<string, string>): Promise<ECPayResponse> {
  const body = new URLSearchParams(params).toString()

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  const text = await response.text()

  // ECPay 回傳格式為 URL-encoded key=value&key=value
  const parsed: Record<string, unknown> = {}
  const pairs = text.split('&')
  for (const pair of pairs) {
    const idx = pair.indexOf('=')
    if (idx > -1) {
      const key = decodeURIComponent(pair.substring(0, idx))
      const value = decodeURIComponent(pair.substring(idx + 1))
      parsed[key] = value
    }
  }

  // RtnCode 轉為數字
  return {
    ...parsed,
    RtnCode: Number(parsed.RtnCode) || 0,
    RtnMsg: String(parsed.RtnMsg || ''),
  } as ECPayResponse
}

/**
 * 開立電子發票
 *
 * 根據發票類型自動設定列印、載具、捐贈等欄位
 * 品項使用管線符號（|）串接
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
  const cfg = await loadInvoiceConfig()
  const timestamp = Math.floor(Date.now() / 1000).toString()

  // ── 品項組合（管線分隔） ──
  const itemNames = params.items.map((i) => i.name).join('|')
  const itemCounts = params.items.map((i) => i.count.toString()).join('|')
  const itemWords = params.items.map((i) => i.word).join('|')
  const itemPrices = params.items.map((i) => i.price.toString()).join('|')
  const itemAmounts = params.items.map((i) => (i.count * i.price).toString()).join('|')
  const itemTaxTypes = params.items
    .map((i) => ITEM_TAX_TYPE_MAP[i.taxType || 'taxable'] || '1')
    .join('|')

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

  // 載具
  const carrierType = hasCarrier ? (CARRIER_TYPE_MAP[params.carrierType!] || '') : ''
  const carrierNum = hasCarrier ? (params.carrierNumber || '') : ''

  // 愛心碼
  const loveCode = isDonation ? (params.loveCode || '') : ''

  // 統一編號（B2B 必填）
  const customerIdentifier = isB2B ? (params.buyerUBN || '') : ''

  // 稅別
  const taxType = TAX_TYPE_MAP[params.taxType || 'taxable'] || '1'
  const { salesAmount } = calculateTax(params.totalAmount, params.taxType || 'taxable')

  // ── 組合 ECPay 參數 ──
  const ecpayParams: Record<string, string> = {
    MerchantID: cfg.merchantId,
    RelateNumber: params.orderNumber,
    CustomerID: params.customerId || '',
    CustomerIdentifier: customerIdentifier,
    CustomerName: isB2B ? (params.buyerCompanyName || params.buyerName) : params.buyerName,
    CustomerAddr: params.buyerAddress || '',
    CustomerPhone: params.buyerPhone || '',
    CustomerEmail: params.buyerEmail,
    Print: print,
    Donation: donation,
    LoveCode: loveCode,
    CarrierType: carrierType,
    CarrierNum: carrierNum,
    TaxType: taxType,
    SalesAmount: params.totalAmount.toString(),
    InvoiceRemark: '',
    ItemName: itemNames,
    ItemCount: itemCounts,
    ItemWord: itemWords,
    ItemPrice: itemPrices,
    ItemTaxType: itemTaxTypes,
    ItemAmount: itemAmounts,
    InvType: '07',
    TimeStamp: timestamp,
    vat: '1',
  }

  // ── 產生 CheckMacValue ──
  ecpayParams.CheckMacValue = generateCheckMacValue(ecpayParams, cfg.hashKey, cfg.hashIV)

  // ── 送出請求 ──
  try {
    const url = `${cfg.gatewayUrl}/B2CInvoice/Issue`
    const result = await postToECPay(url, ecpayParams)

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
 * 查詢發票
 * 透過發票號碼與發票日期查詢發票狀態
 */
export async function queryInvoice(
  invoiceNo: string,
  invoiceDate: string,
): Promise<ECPayResponse> {
  const cfg = await loadInvoiceConfig()
  const timestamp = Math.floor(Date.now() / 1000).toString()

  const params: Record<string, string> = {
    MerchantID: cfg.merchantId,
    RelateNumber: '',
    InvoiceNo: invoiceNo,
    InvoiceDate: invoiceDate,
    TimeStamp: timestamp,
  }

  params.CheckMacValue = generateCheckMacValue(params, cfg.hashKey, cfg.hashIV)

  try {
    const url = `${cfg.gatewayUrl}/B2CInvoice/GetIssue`
    return await postToECPay(url, params)
  } catch (error) {
    console.error('[ECPay Invoice] 查詢發票請求失敗:', error)
    return {
      RtnCode: 0,
      RtnMsg: error instanceof Error ? error.message : '查詢失敗',
    }
  }
}

/**
 * 作廢發票
 * 傳入發票號碼與作廢原因，向 ECPay 發送作廢請求
 */
export async function voidInvoice(
  invoiceNo: string,
  voidReason: string,
): Promise<{ success: boolean; rtnMsg?: string }> {
  const cfg = await loadInvoiceConfig()
  const timestamp = Math.floor(Date.now() / 1000).toString()

  const params: Record<string, string> = {
    MerchantID: cfg.merchantId,
    InvoiceNo: invoiceNo,
    InvoiceDate: '',
    Reason: voidReason,
    TimeStamp: timestamp,
  }

  // 先查詢發票取得 InvoiceDate
  const payload = await getPayload({ config })
  const invoiceRecords = await payload.find({
    collection: 'invoices',
    where: { invoiceNumber: { equals: invoiceNo } },
    limit: 1,
  })

  if (invoiceRecords.docs.length > 0) {
    const ecpayResp = invoiceRecords.docs[0].ecpayResponse as
      | { invoiceDate?: string }
      | undefined
    params.InvoiceDate = ecpayResp?.invoiceDate || ''
  }

  params.CheckMacValue = generateCheckMacValue(params, cfg.hashKey, cfg.hashIV)

  try {
    const url = `${cfg.gatewayUrl}/B2CInvoice/Invalid`
    const result = await postToECPay(url, params)

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
 * 開立折讓
 * 針對已開立發票進行部分或全額折讓
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
  const cfg = await loadInvoiceConfig()
  const timestamp = Math.floor(Date.now() / 1000).toString()

  // 品項組合
  const itemNames = items.map((i) => i.name).join('|')
  const itemCounts = items.map((i) => i.count.toString()).join('|')
  const itemWords = items.map((i) => i.word).join('|')
  const itemPrices = items.map((i) => i.price.toString()).join('|')
  const itemAmounts = items.map((i) => (i.count * i.price).toString()).join('|')
  const itemTaxTypes = items
    .map((i) => ITEM_TAX_TYPE_MAP[i.taxType || 'taxable'] || '1')
    .join('|')

  const params: Record<string, string> = {
    MerchantID: cfg.merchantId,
    InvoiceNo: invoiceNo,
    AllowanceNotify: 'E',
    NotifyMail: '',
    NotifyPhone: '',
    AllowanceAmount: allowanceAmount.toString(),
    ItemName: itemNames,
    ItemCount: itemCounts,
    ItemWord: itemWords,
    ItemPrice: itemPrices,
    ItemTaxType: itemTaxTypes,
    ItemAmount: itemAmounts,
    TimeStamp: timestamp,
  }

  // 從發票紀錄取得 Email
  const payload = await getPayload({ config })
  const invoiceRecords = await payload.find({
    collection: 'invoices',
    where: { invoiceNumber: { equals: invoiceNo } },
    limit: 1,
  })

  if (invoiceRecords.docs.length > 0) {
    const buyerInfo = invoiceRecords.docs[0].buyerInfo as
      | { buyerEmail?: string }
      | undefined
    params.NotifyMail = buyerInfo?.buyerEmail || ''
  }

  params.CheckMacValue = generateCheckMacValue(params, cfg.hashKey, cfg.hashIV)

  try {
    const url = `${cfg.gatewayUrl}/B2CInvoice/Allowance`
    const result = await postToECPay(url, params)

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
 */
export async function autoIssueInvoiceForOrder(
  orderId: string,
): Promise<{ success: boolean; invoiceId?: string; error?: string }> {
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
        collection: 'users',
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

    const invoiceItems = orderItems.map((item) => ({
      name: item.productName,
      count: item.quantity,
      word: '件',
      price: item.unitPrice,
      taxType: 'taxable',
    }))

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
        totalAmount: order.total as number,
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
      totalAmount: order.total as number,
      taxType: 'taxable',
      customerId,
    })

    // ── 更新發票紀錄 ──
    if (result.success) {
      const { salesAmount, taxAmount } = calculateTax(order.total as number, 'taxable')

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
  const payload = await getPayload({ config })

  const result = { retried: 0, succeeded: 0, failed: 0 }

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
