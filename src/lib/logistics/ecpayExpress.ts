import {
  type EcpayLogisticsConfig,
  carrierToLogisticsSubType,
  generateLogisticsCheckMacValue,
} from './ecpayLogisticsMap'

/**
 * ECPay 物流「託運單建立」/Express/Create — C2C 店到店發號
 * ────────────────────────────────────────────────────
 * 出貨流程（OrderBulkShipPanel 超商發號 tab → /api/admin/orders/cvs-ship）
 * 對每張超商取貨訂單發號，回寫寄貨編號（CVSPaymentNo）當追蹤碼。
 *
 * 憑證/閘道沿用 ecpayLogisticsMap 的 loadEcpayLogisticsConfig()：
 * sandbox fallback C2C 2000933、CheckMacValue=MD5。
 *
 * 回應格式是 `ResCode|detail`：成功 `1|k=v&k=v…`、失敗 `0|錯誤訊息`。
 * 7-11 C2C 取 CVSPaymentNo + CVSValidationNo；全家/萊爾富/OK 取 CVSPaymentNo。
 */

const EXPRESS_HOST_STAGE = 'https://logistics-stage.ecpay.com.tw'
const EXPRESS_HOST_PROD = 'https://logistics.ecpay.com.tw'

export function expressHost(cfg: EcpayLogisticsConfig): string {
  return cfg.sandbox ? EXPRESS_HOST_STAGE : EXPRESS_HOST_PROD
}

/** 綠界物流 MerchantTradeDate 格式（台北時間 yyyy/MM/dd HH:mm:ss） */
export function formatLogisticsTradeDate(date: Date = new Date()): string {
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
 * 物流 MerchantTradeNo：20 碼英數、不可重複。與金流同思路
 * （CK{id}T{ts}），前綴改 CKL 與金流交易號區隔；重發號時是新交易號。
 */
export function buildLogisticsTradeNo(orderId: number | string): string {
  const ts = Date.now().toString(36).toUpperCase()
  const idPart = String(orderId).replace(/[^A-Za-z0-9]/g, '').slice(0, 8)
  return `CKL${idPart}T${ts}`.slice(0, 20)
}

/** 綠界收/寄件人姓名：去特殊符號（規格禁 ^ ' ` ! @ # % & * + \ " < > | _ [ ] , 等），截 10 碼 */
export function sanitizeLogisticsName(name: string): string {
  return name.replace(/[^0-9A-Za-z一-鿿\s]/g, '').trim().slice(0, 10)
}

/** 手機：取數字，須為 09 開頭 10 碼才回傳，否則空字串 */
export function normalizeCellPhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '')
  return /^09\d{8}$/.test(digits) ? digits : ''
}

export interface BuildCvsCreateParamsInput {
  orderId: number | string
  /** ShippingMethods.carrier：711 / family / hilife / ok */
  carrier: string
  /** 商品金額（整數 1~19999，超商上限） */
  goodsAmount: number
  /** 取貨付款（代收貨款）——CollectionAmount 帶同額 */
  isCollection: boolean
  /** 顯示在託運單上的品名（會被消毒 + 截 25 碼） */
  goodsName: string
  senderName: string
  senderCellPhone: string
  receiverName: string
  receiverCellPhone: string
  receiverEmail?: string
  /** 取貨門市代號 shippingMethod.convenienceStore.storeId */
  receiverStoreId: string
  /** 物流狀態通知（server-to-server POST） */
  serverReplyURL: string
}

export function buildCvsCreateParams(
  cfg: EcpayLogisticsConfig,
  input: BuildCvsCreateParamsInput,
): Record<string, string> {
  const subType = carrierToLogisticsSubType(cfg, input.carrier)
  if (!subType) {
    throw new Error(`carrier ${input.carrier} 不支援 ECPay 超商託運（cvsType=${cfg.cvsType}）`)
  }
  const params: Record<string, string> = {
    MerchantID: cfg.merchantId,
    MerchantTradeNo: buildLogisticsTradeNo(input.orderId),
    MerchantTradeDate: formatLogisticsTradeDate(),
    LogisticsType: 'CVS',
    LogisticsSubType: subType,
    GoodsAmount: String(Math.round(input.goodsAmount)),
    IsCollection: input.isCollection ? 'Y' : 'N',
    GoodsName: input.goodsName.replace(/[^0-9A-Za-z一-鿿\s]/g, '').trim().slice(0, 25),
    SenderName: sanitizeLogisticsName(input.senderName),
    SenderCellPhone: input.senderCellPhone,
    ReceiverName: sanitizeLogisticsName(input.receiverName),
    ReceiverCellPhone: input.receiverCellPhone,
    ServerReplyURL: input.serverReplyURL,
    ReceiverStoreID: input.receiverStoreId,
  }
  if (input.isCollection) params.CollectionAmount = String(Math.round(input.goodsAmount))
  if (input.receiverEmail) params.ReceiverEmail = input.receiverEmail
  params.CheckMacValue = generateLogisticsCheckMacValue(params, cfg.hashKey, cfg.hashIV)
  return params
}

export interface CvsCreateResult {
  ok: boolean
  /** 綠界物流交易編號 */
  allPayLogisticsID?: string
  /** 寄貨編號（門市代寄用；當追蹤碼） */
  cvsPaymentNo?: string
  /** 驗證碼（7-11 C2C 才有） */
  cvsValidationNo?: string
  raw: string
  error?: string
}

/** 打 /Express/Create 並解析 `ResCode|detail` 回應 */
export async function createCvsShipment(
  cfg: EcpayLogisticsConfig,
  params: Record<string, string>,
): Promise<CvsCreateResult> {
  const res = await fetch(`${expressHost(cfg)}/Express/Create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  })
  const raw = (await res.text()).trim()
  const sep = raw.indexOf('|')
  if (sep < 0) return { ok: false, raw, error: `綠界回應格式異常：${raw.slice(0, 120)}` }
  const code = raw.slice(0, sep)
  const detail = raw.slice(sep + 1)
  if (code !== '1') return { ok: false, raw, error: detail.slice(0, 200) || `ResCode=${code}` }
  const kv: Record<string, string> = {}
  new URLSearchParams(detail).forEach((v, k) => {
    kv[k] = v
  })
  return {
    ok: true,
    allPayLogisticsID: kv.AllPayLogisticsID || '',
    cvsPaymentNo: kv.CVSPaymentNo || '',
    cvsValidationNo: kv.CVSValidationNo || '',
    raw,
  }
}

/** C2C 託運單標籤列印端點（瀏覽器 form POST，開新視窗） */
const PRINT_PATHS: Record<string, string> = {
  UNIMARTC2C: '/Express/PrintUniMartC2COrderInfo',
  FAMIC2C: '/Express/PrintFAMIC2COrderInfo',
  HILIFEC2C: '/Express/PrintHILIFEC2COrderInfo',
  OKMARTC2C: '/Express/PrintOKMARTC2COrderInfo',
}

export interface BuildPrintParamsInput {
  carrier: string
  allPayLogisticsID: string
  cvsPaymentNo: string
  cvsValidationNo?: string
}

export function buildCvsPrintForm(
  cfg: EcpayLogisticsConfig,
  input: BuildPrintParamsInput,
): { action: string; params: Record<string, string> } {
  const subType = carrierToLogisticsSubType(cfg, input.carrier)
  const path = subType ? PRINT_PATHS[subType] : undefined
  if (!path) {
    throw new Error(`carrier ${input.carrier} 沒有對應的 C2C 託運單列印端點`)
  }
  const params: Record<string, string> = {
    MerchantID: cfg.merchantId,
    AllPayLogisticsID: input.allPayLogisticsID,
    CVSPaymentNo: input.cvsPaymentNo,
  }
  // 7-11 C2C 列印需要驗證碼
  if (subType === 'UNIMARTC2C') params.CVSValidationNo = input.cvsValidationNo || ''
  params.CheckMacValue = generateLogisticsCheckMacValue(params, cfg.hashKey, cfg.hashIV)
  return { action: `${expressHost(cfg)}${path}`, params }
}

/** 驗物流狀態通知（ServerReplyURL）的 CheckMacValue（MD5，同組憑證） */
export function verifyLogisticsCallback(
  cfg: EcpayLogisticsConfig,
  params: Record<string, string>,
): boolean {
  const received = params.CheckMacValue
  if (!received) return false
  const expected = generateLogisticsCheckMacValue(params, cfg.hashKey, cfg.hashIV)
  return received.toUpperCase() === expected
}
