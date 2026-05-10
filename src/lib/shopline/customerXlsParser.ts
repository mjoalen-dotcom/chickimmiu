/**
 * Shopline ShoplineCustomerReport 解析器
 * ──────────────────────────────────────
 * 直接讀 Shopline 後台匯出的 `chickimmiu_ShoplineCustomerReport_*.xls`（OLE BIFF）
 * 或 `.xlsx`（OOXML），統一用 SheetJS。
 *
 * 檔案約束：
 *   Sheet 名: 'Users'
 *   Row 1: 61 個中文欄頭
 *   Row 2 起: 資料（17,000+ 筆）
 *   日期格式: 'YYYY-MM-DD HH:mm:ss'（無時區，視為 Asia/Taipei）
 *   Y/N flags、空白普遍存在
 *
 * 對應到 src/endpoints/shoplineCustomerImport.ts 的 ShoplineCustomer interface
 * （snake_case key 與既有 JSON 路徑保持相容）。
 */
import * as XLSX from 'xlsx'

/* ============================================================
   Shopline 中文欄頭常數（依 inspect 結果）
   ============================================================ */
const H = {
  customerId: '顧客 ID',
  fullName: '全名',
  email: '電郵',
  joinDate: '加入日期',
  joinSource: '加入來源',
  language: '語言',
  orderCount: '訂單數',
  totalSpent: '累積金額',
  creditGranted: '已發放購物金',
  creditDeducted: '已扣除購物金',
  creditUsed: '已使用購物金',
  creditCurrent: '現有購物金',
  pointsGranted: '已發放點數',
  pointsDeducted: '已扣除點數',
  pointsUsed: '已使用點數',
  pointsCurrent: '現有點數',
  isMember: '會員',
  memberJoinDate: '會員註冊日期',
  memberJoinSource: '會員註冊來源',
  facebookId: 'Facebook 註冊 ID',
  lineId: 'LINE 註冊 ID',
  blacklist: '黑名單-禁止登入下單',
  hasPassword: '已設置密碼',
  acceptEmail: '接受電郵優惠宣傳',
  acceptSms: '接受簡訊優惠宣傳',
  acceptFb: '接受 FB 優惠宣傳',
  acceptLine: '接受 LINE 優惠宣傳',
  acceptWhatsapp: '接受 WhatsApp 優惠宣傳',
  lastLoginAt: '最後登入時間',
  contactPhone: '聯絡電話',
  intlCode: '國際電話區碼',
  memberPhone: '會員綁定手機號碼',
  recipientName: '收件人姓名',
  recipientPhone: '收件人電話',
  address1: '地址 1',
  memberTier: '會員級別',
  memberValidUntil: '會員有效期',
  address2: '地址 2',
  city: '城市',
  district: '地區/州/省份',
  zipcode: '郵政編號（如適用)',
  country: '國家／地區',
  gender: '性別',
  birthday: '生日',
  height: '身高',
  weight: '體重',
  footLength: '腳長尺寸',
  measurements: '胸圍/腰圍/臀圍',
  invoice: '公司發票資料',
  tags: '標籤',
  note: '備註',
  utmSource: 'UTM 來源',
  utmMedium: 'UTM 媒介',
  utmSourceMedium: 'UTM 來源/媒介',
  utmCampaign: 'UTM 活動名稱',
  utmTerm: 'UTM 活動字詞',
  utmContent: 'UTM 活動內容',
  utmCapturedAt: 'UTM 點擊時間',
  referrerName: '推薦人姓名',
  referrerEmail: '推薦人電郵',
  referrerPhone: '推薦人手機',
} as const

/* ============================================================
   Output schema — 對齊 shoplineCustomerImportEndpoint
   ============================================================ */

export interface ShoplineCustomerAddress {
  recipient?: string
  phone?: string
  city?: string
  district?: string
  zipcode?: string
  address?: string
  is_default?: boolean
}

export interface ShoplineCustomerBody {
  height?: number
  weight?: number
  foot_length?: number
  bust?: number
  waist?: number
  hips?: number
  /** 原始 "胸圍/腰圍/臀圍" 字串，無法解析時保留以便人工確認 */
  measurements_raw?: string
}

export interface ShoplineCustomerAttribution {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  captured_at?: string
}

export interface ShoplineCustomer {
  customer_id?: string
  email?: string
  name?: string
  phone?: string
  birthday?: string
  gender?: 'male' | 'female' | 'other' | null
  tags?: string[]
  signup_source?: string
  last_login_at?: string
  total_spent?: number
  order_count?: number
  points?: number
  shopping_credit?: number
  email_subscribed?: boolean
  sms_subscribed?: boolean
  line_subscribed?: boolean
  fb_subscribed?: boolean
  whatsapp_subscribed?: boolean
  is_blacklisted?: boolean
  facebook_id?: string
  line_id?: string
  member_tier_label?: string
  body?: ShoplineCustomerBody
  attribution?: ShoplineCustomerAttribution
  invoice_raw?: string
  referrer_email?: string
  addresses?: ShoplineCustomerAddress[]
  note?: string
  language?: string
  /** 行號（含 row 1 header），用於 error report */
  row?: number
}

export interface ParseReport {
  totalRows: number
  parsed: number
  skippedNoIdentifier: number
  warnings: string[]
  customers: ShoplineCustomer[]
}

/* ============================================================
   Public entry
   ============================================================ */

/**
 * 解析 Shopline ShoplineCustomerReport buffer。支援 .xls (BIFF) 與 .xlsx。
 * 整個檔案一次讀進記憶體 — 17K rows ≈ 12MB 在 server 端 Node 完全沒問題。
 */
export function parseShoplineCustomerXls(buf: Buffer): ParseReport {
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: false, cellNF: false, cellText: false })

  // 找 'Users' sheet；不行就用第一個
  const sheetName = wb.SheetNames.includes('Users') ? 'Users' : wb.SheetNames[0]
  if (!sheetName) {
    return {
      totalRows: 0,
      parsed: 0,
      skippedNoIdentifier: 0,
      warnings: ['Workbook 沒有任何工作表'],
      customers: [],
    }
  }
  const ws = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, {
    header: 1,
    defval: '',
    raw: false, // 把日期、數字都吐成已 format 過的字串，pure-string 處理較簡單
  })

  if (rows.length < 2) {
    return {
      totalRows: rows.length,
      parsed: 0,
      skippedNoIdentifier: 0,
      warnings: ['檔案沒有資料列（只有 header 或全空）'],
      customers: [],
    }
  }

  const header = rows[0].map((h) => String(h ?? '').trim())

  // header label → column index
  const idx: Record<string, number> = {}
  for (let i = 0; i < header.length; i++) idx[header[i]] = i

  // 確認必要欄都在；缺了就 warning（不擋整個解析，只代表那批欄會 undefined）
  const warnings: string[] = []
  const requiredHeaders = [H.customerId, H.email, H.fullName]
  for (const h of requiredHeaders) {
    if (!(h in idx)) warnings.push(`缺少欄位「${h}」— 將跳過該欄資料`)
  }

  const get = (row: string[], label: string): string => {
    const i = idx[label]
    if (i == null) return ''
    return String(row[i] ?? '').trim()
  }

  const customers: ShoplineCustomer[] = []
  let skippedNoIdentifier = 0

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    if (!row || row.every((v) => !String(v ?? '').trim())) continue // 全空跳過

    const c = parseRow(row, get, r + 1)
    if (!c.email && !c.customer_id && !c.phone) {
      skippedNoIdentifier++
      continue
    }
    customers.push(c)
  }

  return {
    totalRows: rows.length - 1,
    parsed: customers.length,
    skippedNoIdentifier,
    warnings,
    customers,
  }
}

/* ============================================================
   Row-level parser
   ============================================================ */

function parseRow(
  row: string[],
  get: (row: string[], label: string) => string,
  rowNum: number,
): ShoplineCustomer {
  const customerId = get(row, H.customerId)
  const email = get(row, H.email).toLowerCase() || undefined
  const name = get(row, H.fullName) || undefined

  // 電話：會員綁定 → 聯絡電話 → 收件人電話
  const phone =
    get(row, H.memberPhone) || get(row, H.contactPhone) || get(row, H.recipientPhone) || undefined

  // 訂單統計
  const orderCount = parseInteger(get(row, H.orderCount))
  const totalSpent = parseAmount(get(row, H.totalSpent))
  const points = parseInteger(get(row, H.pointsCurrent))
  const credit = parseAmount(get(row, H.creditCurrent))

  // 訂閱旗標
  const emailSub = parseYesNo(get(row, H.acceptEmail))
  const smsSub = parseYesNo(get(row, H.acceptSms))
  const lineSub = parseYesNo(get(row, H.acceptLine))
  const fbSub = parseYesNo(get(row, H.acceptFb))
  const waSub = parseYesNo(get(row, H.acceptWhatsapp))
  const isBlacklisted = parseYesNo(get(row, H.blacklist)) ?? false

  // 性別
  const genderRaw = get(row, H.gender)
  const gender: 'male' | 'female' | 'other' | null =
    genderRaw === '男' || genderRaw.toLowerCase() === 'male'
      ? 'male'
      : genderRaw === '女' || genderRaw.toLowerCase() === 'female'
        ? 'female'
        : genderRaw
          ? 'other'
          : null

  // 生日：可能是 "DD-MM-YYYY" / "YYYY-MM-DD" / "YYYY/MM/DD"
  const birthday = parseBirthday(get(row, H.birthday))

  // 身體量測
  const body = parseBody({
    heightRaw: get(row, H.height),
    weightRaw: get(row, H.weight),
    footLengthRaw: get(row, H.footLength),
    measurementsRaw: get(row, H.measurements),
  })

  // UTM
  const utmCaptured = parseDateTime(get(row, H.utmCapturedAt))
  const attribution: ShoplineCustomerAttribution = trimEmptyKeys({
    utm_source: get(row, H.utmSource) || undefined,
    utm_medium: get(row, H.utmMedium) || undefined,
    utm_campaign: get(row, H.utmCampaign) || undefined,
    utm_term: get(row, H.utmTerm) || undefined,
    utm_content: get(row, H.utmContent) || undefined,
    captured_at: utmCaptured || undefined,
  })

  // 地址
  const addressLine = combineAddressLines(get(row, H.address1), get(row, H.address2))
  const addresses: ShoplineCustomerAddress[] = []
  if (addressLine || get(row, H.recipientName) || get(row, H.city)) {
    addresses.push({
      recipient: get(row, H.recipientName) || name,
      phone: get(row, H.recipientPhone) || phone,
      city: get(row, H.city) || undefined,
      district: get(row, H.district) || undefined,
      zipcode: get(row, H.zipcode) || undefined,
      address: addressLine || undefined,
      is_default: true,
    })
  }

  // 標籤
  const tags = parseTagList(get(row, H.tags))
  // FB / WhatsApp 沒有對應 schema 欄位，但保留 marketing 偏好可加 tag
  if (fbSub === false) tags.push('未訂閱FB')
  if (waSub === true) tags.push('接受WhatsApp')

  // 備註：Shopline note + 推薦人 + 國際電話區碼 + 會員級別字串 + 會員有效期 + 國家
  // 全壓進 crmNote，避免資訊遺失。memberTier relationship 需手動 lookup → 不在此 set。
  const noteParts: string[] = []
  const noteRaw = get(row, H.note)
  if (noteRaw) noteParts.push(noteRaw)
  const tierLabel = get(row, H.memberTier)
  if (tierLabel) noteParts.push(`Shopline 會員級別：${tierLabel}`)
  const tierValidUntil = get(row, H.memberValidUntil)
  if (tierValidUntil) noteParts.push(`會員有效期：${tierValidUntil}`)
  const country = get(row, H.country)
  if (country && country !== 'TW' && country !== '台灣' && country !== 'Taiwan') {
    noteParts.push(`國家：${country}`)
  }
  const intl = get(row, H.intlCode)
  if (intl && intl !== '886') noteParts.push(`國際電話區碼：${intl}`)
  const refName = get(row, H.referrerName)
  const refEmail = get(row, H.referrerEmail)
  const refPhone = get(row, H.referrerPhone)
  if (refName || refEmail || refPhone) {
    noteParts.push(`Shopline 推薦人：${[refName, refEmail, refPhone].filter(Boolean).join(' / ')}`)
  }
  const orderCountForNote = orderCount
  if (orderCountForNote && orderCountForNote > 0) {
    noteParts.push(`Shopline 歷史訂單數：${orderCountForNote}`)
  }

  return {
    row: rowNum,
    customer_id: customerId || undefined,
    email,
    name,
    phone,
    birthday: birthday || undefined,
    gender,
    tags: tags.length > 0 ? tags : undefined,
    signup_source: get(row, H.joinSource) || undefined,
    last_login_at: parseDateTime(get(row, H.lastLoginAt)) || undefined,
    total_spent: totalSpent,
    order_count: orderCount,
    points,
    shopping_credit: credit,
    email_subscribed: emailSub ?? undefined,
    sms_subscribed: smsSub ?? undefined,
    line_subscribed: lineSub ?? undefined,
    fb_subscribed: fbSub ?? undefined,
    whatsapp_subscribed: waSub ?? undefined,
    is_blacklisted: isBlacklisted,
    facebook_id: get(row, H.facebookId) || undefined,
    line_id: get(row, H.lineId) || undefined,
    member_tier_label: tierLabel || undefined,
    body: hasAnyValue(body) ? body : undefined,
    attribution: hasAnyValue(attribution) ? attribution : undefined,
    invoice_raw: get(row, H.invoice) || undefined,
    referrer_email: refEmail ? refEmail.toLowerCase() : undefined,
    addresses: addresses.length > 0 ? addresses : undefined,
    note: noteParts.length > 0 ? noteParts.join(' | ') : undefined,
    language: get(row, H.language) || undefined,
  }
}

/* ============================================================
   Helpers
   ============================================================ */

function parseInteger(s: string): number {
  if (!s) return 0
  const cleaned = String(s).replace(/[,\s]/g, '')
  const n = parseInt(cleaned, 10)
  return Number.isFinite(n) ? n : 0
}

function parseAmount(s: string): number {
  if (!s) return 0
  // 支援 "NT$11,520"、"$11520"、"11520.00"
  const cleaned = String(s).replace(/[NT$,\s]/g, '')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? Math.round(n) : 0
}

function parseYesNo(s: string): boolean | null {
  const v = String(s).trim().toUpperCase()
  if (v === 'Y' || v === 'YES' || v === 'TRUE' || v === '1' || v === '是') return true
  if (v === 'N' || v === 'NO' || v === 'FALSE' || v === '0' || v === '否') return false
  return null
}

/**
 * Shopline 生日格式可能是 "DD-MM-YYYY"（importCustomers.ts 已踩過）或 "YYYY-MM-DD"。
 * 統一輸出 ISO date "YYYY-MM-DD"。無法 parse 回空字串。
 */
function parseBirthday(s: string): string {
  if (!s) return ''
  const trimmed = s.trim()
  if (!trimmed) return ''

  // YYYY-MM-DD 或 YYYY/MM/DD
  let m = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (m) {
    const [, yyyy, mm, dd] = m
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }
  // DD-MM-YYYY 或 DD/MM/YYYY
  m = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (m) {
    const [, dd, mm, yyyy] = m
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }
  return ''
}

/**
 * "2026-05-03 23:34:20" (Shopline 視為 Asia/Taipei 無時區) → ISO UTC string
 * 採與 importCustomers.ts:262 同一個 trick：直接接 +08:00 進 Date。
 */
function parseDateTime(s: string): string {
  if (!s) return ''
  const trimmed = s.trim()
  if (!trimmed) return ''
  // 避免底線、毫秒等變體；只接受典型 SQL-style
  const m = trimmed.match(/^(\d{4}-\d{2}-\d{2})[\sT](\d{2}:\d{2}:\d{2})/)
  if (!m) {
    // 試純日期
    const d = trimmed.match(/^(\d{4}-\d{2}-\d{2})$/)
    if (d) return new Date(`${d[1]}T00:00:00+08:00`).toISOString()
    return ''
  }
  return new Date(`${m[1]}T${m[2]}+08:00`).toISOString()
}

function combineAddressLines(a1: string, a2: string): string {
  const parts = [a1, a2].map((s) => String(s || '').trim()).filter(Boolean)
  return parts.join(' ')
}

function parseTagList(s: string): string[] {
  if (!s) return []
  // Shopline 標籤可能用「,」「、」「|」「;」分隔
  return s
    .split(/[,、|;]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
}

function parseBody(args: {
  heightRaw: string
  weightRaw: string
  footLengthRaw: string
  measurementsRaw: string
}): ShoplineCustomerBody {
  const out: ShoplineCustomerBody = {}

  const h = parseFloat(args.heightRaw.replace(/[^\d.]/g, ''))
  if (Number.isFinite(h) && h > 0) out.height = h

  const w = parseFloat(args.weightRaw.replace(/[^\d.]/g, ''))
  if (Number.isFinite(w) && w > 0) out.weight = w

  const f = parseFloat(args.footLengthRaw.replace(/[^\d.]/g, ''))
  if (Number.isFinite(f) && f > 0) out.foot_length = f

  // 「胸圍/腰圍/臀圍」可能格式「90/65/95」、「90-65-95」、「B90 W65 H95」、「90,65,95」
  const m = args.measurementsRaw
    .split(/[/\-,\s]+/)
    .map((p) => p.replace(/[^\d.]/g, ''))
    .map((p) => parseFloat(p))
    .filter((n) => Number.isFinite(n) && n > 0)
  if (m.length >= 3) {
    out.bust = m[0]
    out.waist = m[1]
    out.hips = m[2]
  } else if (args.measurementsRaw) {
    out.measurements_raw = args.measurementsRaw
  }

  return out
}

function trimEmptyKeys<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue
    out[k] = v
  }
  return out as T
}

function hasAnyValue(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false
  return Object.values(obj as Record<string, unknown>).some(
    (v) => v !== undefined && v !== null && v !== '',
  )
}
