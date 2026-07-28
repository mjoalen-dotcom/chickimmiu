import * as crypto from 'crypto'

/**
 * ECPay 物流「電子地圖」選店 — 結帳頁超商取貨用
 * ────────────────────────────────────────────
 * 只做兩件事：載入物流設定、組建 /Express/map 表單參數。
 * 路由層在 src/app/(frontend)/api/logistics/ecpay/map/。
 *
 * 憑證來源：env `ECPAY_LOGISTICS_MERCHANT_ID / _HASH_KEY / _HASH_IV`
 * （物流模組與金流可能是不同組憑證，所以不沿用 ECPAY_*）。
 * `ECPAY_LOGISTICS_ENV=sandbox|production` 決定閘道，未設時退回
 * ECPAY_ENV，再退回 NODE_ENV。sandbox 且憑證未填時用綠界物流文件
 * 公開測試商店（C2C 2000933 / B2C 2000132）。
 * production 且憑證未填 → isConfigured=false，map 路由回 503。
 *
 * 注意：電子地圖回傳（ServerReplyURL）是「顧客瀏覽器」的表單 POST，
 * 不是 server-to-server，所以本機 localhost 也收得到。
 */

export interface EcpayLogisticsConfig {
  merchantId: string
  hashKey: string
  hashIV: string
  /** /Express/map 端點（含路徑） */
  mapUrl: string
  sandbox: boolean
  isConfigured: boolean
  /** C2C（店到店，預設）或 B2C（大宗寄倉，需另簽約） */
  cvsType: 'C2C' | 'B2C'
}

const ECPAY_LOGISTICS_STAGE_MAP = 'https://logistics-stage.ecpay.com.tw/Express/map'
const ECPAY_LOGISTICS_PROD_MAP = 'https://logistics.ecpay.com.tw/Express/map'

/** 綠界物流文件公開測試商店（僅 sandbox fallback 用） */
const STAGE_C2C = { id: '2000933', key: 'XBERn1YOvpM9nfZc', iv: 'h1ONHk4P4yqbl5LK' }
const STAGE_B2C = { id: '2000132', key: '5294y06JbISpM5x9', iv: 'v77hoKGq4kWxNNIS' }

export function loadEcpayLogisticsConfig(): EcpayLogisticsConfig {
  const envFlag = (
    process.env.ECPAY_LOGISTICS_ENV ||
    process.env.ECPAY_ENV ||
    ''
  ).toLowerCase()
  const sandbox = envFlag
    ? envFlag !== 'production'
    : process.env.NODE_ENV !== 'production'

  const cvsType =
    (process.env.ECPAY_LOGISTICS_CVS_TYPE || '').toUpperCase() === 'B2C' ? 'B2C' : 'C2C'
  const fallback = cvsType === 'B2C' ? STAGE_B2C : STAGE_C2C

  const envId = process.env.ECPAY_LOGISTICS_MERCHANT_ID || ''
  const envKey = process.env.ECPAY_LOGISTICS_HASH_KEY || ''
  const envIV = process.env.ECPAY_LOGISTICS_HASH_IV || ''
  const hasEnvCreds = Boolean(envId && envKey && envIV)

  return {
    merchantId: envId || (sandbox ? fallback.id : ''),
    hashKey: envKey || (sandbox ? fallback.key : ''),
    hashIV: envIV || (sandbox ? fallback.iv : ''),
    mapUrl: sandbox ? ECPAY_LOGISTICS_STAGE_MAP : ECPAY_LOGISTICS_PROD_MAP,
    sandbox,
    isConfigured: sandbox ? true : hasEnvCreds,
    cvsType,
  }
}

/**
 * 物流 API 的 .NET 風格 URL encode（與金流 CheckMacValue 同規則）：
 * encodeURIComponent 後還原 `-_.!*()`、空白轉 `+`、整串轉小寫。
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
 * 物流 CheckMacValue：與金流同流程但雜湊用 MD5（物流介接文件規範）。
 * 參數依 key 排序 → HashKey= 前綴 + &HashIV= 後綴 → URL encode 全串
 * → 小寫 → MD5 → 大寫 hex。
 */
export function generateLogisticsCheckMacValue(
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
  return crypto.createHash('md5').update(encoded, 'utf8').digest('hex').toUpperCase()
}

/**
 * ShippingMethods.carrier 代碼 → 電子地圖 LogisticsSubType。
 * B2C（大宗寄倉）沒有 OK mart；OK 超商 C2C（OKMARTC2C）已於
 * 2026/7/1 終止服務（綠界物流狀態代碼表異動歷程），一併下架。
 */
const CVS_SUBTYPE: Record<'C2C' | 'B2C', Record<string, string>> = {
  C2C: {
    '711': 'UNIMARTC2C',
    family: 'FAMIC2C',
    hilife: 'HILIFEC2C',
  },
  B2C: {
    '711': 'UNIMART',
    family: 'FAMI',
    hilife: 'HILIFE',
  },
}

export function carrierToLogisticsSubType(
  cfg: EcpayLogisticsConfig,
  carrier: string,
): string | null {
  return CVS_SUBTYPE[cfg.cvsType][carrier] ?? null
}

export interface BuildCvsMapParamsInput {
  /** ShippingMethods.carrier：711 / family / hilife / ok */
  carrier: string
  /** 是否代收貨款（貨到付款）——地圖只列出支援代收的門市 */
  isCollection: boolean
  /** 綠界選店後把門市資訊 POST 回來的網址（顧客瀏覽器端） */
  serverReplyURL: string
  /** 0=PC、1=行動裝置 */
  device: 0 | 1
  /** 原樣帶回 ServerReplyURL 的自訂字串（≤20 字） */
  extraData?: string
}

/**
 * 組出送往 /Express/map 的表單參數。電子地圖規格（?p=10108）本身
 * 沒有列 CheckMacValue，但實測綠界端會忽略多帶的欄位，帶上正確的
 * MD5 檢查碼兩邊相容（LAUNCH §4-6 決議帶上）。
 */
export function buildCvsMapParams(
  cfg: EcpayLogisticsConfig,
  input: BuildCvsMapParamsInput,
): Record<string, string> {
  const subType = carrierToLogisticsSubType(cfg, input.carrier)
  if (!subType) {
    throw new Error(`carrier ${input.carrier} 不支援 ECPay 電子地圖（cvsType=${cfg.cvsType}）`)
  }
  const params: Record<string, string> = {
    MerchantID: cfg.merchantId,
    LogisticsType: 'CVS',
    LogisticsSubType: subType,
    IsCollection: input.isCollection ? 'Y' : 'N',
    ServerReplyURL: input.serverReplyURL,
    ExtraData: (input.extraData || '').slice(0, 20),
    Device: String(input.device),
  }
  params.CheckMacValue = generateLogisticsCheckMacValue(params, cfg.hashKey, cfg.hashIV)
  return params
}
