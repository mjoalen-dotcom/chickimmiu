import type { Endpoint, PayloadRequest } from 'payload'
import {
  parseShoplineCustomerXls,
  type ShoplineCustomer as ParsedCustomer,
  type ShoplineCustomerAddress,
  type ShoplineCustomerAttribution,
  type ShoplineCustomerBody,
} from '../lib/shopline/customerXlsParser'

/**
 * Shopline 顧客匯入 endpoint
 * ──────────────────────────
 * 支援兩種輸入：
 *   1. multipart/form-data：上傳 .xls / .xlsx，server 端用 SheetJS 直接 parse
 *      （封測主流入口；admin panel ShoplineCustomerImporter 走這條）
 *   2. JSON body { customers: [...] }：留給將來程式化呼叫 / 測試
 *
 * 兩種輸入都共用同樣的 upsert 邏輯：
 *   - email 為主 key（Payload Users 唯一索引在 email）
 *   - 沒 email 的 fallback 用 shoplineCustomerId 找；再 fallback 用 phone
 *   - dryRun=1 預覽（不寫 DB）；dryRun=0 真寫
 *   - limit=N 只處理前 N 筆（測試用）
 *   - batchSize=N 每批 N 筆（影響 progress / log granularity）
 */

interface JsonBodyCustomer {
  customer_id?: string
  email?: string
  name?: string
  phone?: string
  birthday?: string
  gender?: string
  tags?: string[]
  signup_source?: string
  last_login_at?: string
  total_spent?: number
  order_count?: number
  email_subscribed?: boolean
  sms_subscribed?: boolean
  line_subscribed?: boolean
  addresses?: ShoplineCustomerAddress[]
  note?: string
}

type ImportableCustomer = ParsedCustomer | JsonBodyCustomer

interface ImportResult {
  row: number
  action: 'created' | 'updated' | 'skipped' | 'error'
  email?: string
  shoplineCustomerId?: string
  matchedBy?: 'email' | 'shoplineCustomerId' | 'phone'
  id?: number
  message?: string
}

export const shoplineCustomerImportEndpoint: Endpoint = {
  path: '/shopline-customer-import',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    if (!req.user || (req.user as unknown as Record<string, unknown>).role !== 'admin') {
      return Response.json({ success: false, message: '權限不足' }, { status: 403 })
    }

    const url = new URL(req.url || '', 'http://localhost')
    const dryRun = url.searchParams.get('dryRun') !== '0'
    const limitRaw = url.searchParams.get('limit')
    const limit = limitRaw ? Math.max(1, parseInt(limitRaw, 10) || 0) : 0
    const batchSize = Math.max(1, parseInt(url.searchParams.get('batchSize') || '50', 10))

    // ── 解析輸入 ────────────────────────────────────────────
    const contentType = req.headers?.get('content-type') || ''
    let customers: ImportableCustomer[]
    let parseWarnings: string[] = []
    let totalRowsInFile = 0
    let skippedNoIdentifier = 0

    try {
      if (contentType.includes('multipart/form-data')) {
        const formData = await (req as unknown as Request).formData()
        const file = formData.get('file') as File | null
        if (!file) {
          return Response.json(
            { success: false, message: '請上傳 .xls 或 .xlsx 檔案（form field 名稱：file）' },
            { status: 400 },
          )
        }
        const buf = Buffer.from(await file.arrayBuffer())
        const report = parseShoplineCustomerXls(buf)
        customers = report.customers
        parseWarnings = report.warnings
        totalRowsInFile = report.totalRows
        skippedNoIdentifier = report.skippedNoIdentifier
      } else {
        const body = await req.json?.()
        if (!body || !Array.isArray((body as { customers?: unknown }).customers)) {
          return Response.json(
            { success: false, message: '請提供 { customers: [...] } JSON body 或上傳檔案' },
            { status: 400 },
          )
        }
        customers = (body as { customers: JsonBodyCustomer[] }).customers
        totalRowsInFile = customers.length
      }
    } catch (err) {
      return Response.json(
        { success: false, message: `解析輸入失敗：${(err as Error).message}` },
        { status: 400 },
      )
    }

    const batch = limit > 0 ? customers.slice(0, limit) : customers

    // ── Dry-run：只回預覽 ─────────────────────────────────
    if (dryRun) {
      const preview = batch.slice(0, 10).map((c, i) => {
        const cc = c as ParsedCustomer
        return {
          row: cc.row || i + 1,
          email: cc.email || null,
          shoplineCustomerId: cc.customer_id || null,
          phone: cc.phone || null,
          name: cc.name || null,
          gender: cc.gender ?? null,
          memberTierLabel: cc.member_tier_label || null,
          tags: cc.tags || [],
          hasAddress: Boolean(cc.addresses && cc.addresses.length > 0),
          hasUtm: Boolean(cc.attribution),
          hasSocial: Boolean(cc.facebook_id || cc.line_id),
        }
      })

      // 統計用：有 email、有 phone、有 LINE、有 FB、黑名單、有訂閱
      const stats = computeStats(batch as ParsedCustomer[])

      return Response.json({
        success: true,
        mode: 'dry-run',
        totalRowsInFile,
        totalInPayload: customers.length,
        willProcess: batch.length,
        skippedNoIdentifier,
        warnings: parseWarnings,
        stats,
        samplePreview: preview,
      })
    }

    // ── Commit ──────────────────────────────────────────
    const results: ImportResult[] = []
    let created = 0
    let updated = 0
    let skipped = 0
    let failed = 0

    for (let i = 0; i < batch.length; i += batchSize) {
      const chunk = batch.slice(i, i + batchSize)

      for (let j = 0; j < chunk.length; j++) {
        const c = chunk[j] as ParsedCustomer
        const rowNum = c.row || i + j + 1

        if (!c.email && !c.customer_id && !c.phone) {
          skipped++
          results.push({
            row: rowNum,
            action: 'skipped',
            message: '無 email / customer_id / phone，無法識別',
          })
          continue
        }

        try {
          const match = await findExistingUser(req, c)
          const userData = buildUserData(c)

          if (match.doc) {
            await req.payload.update({
              collection: 'customers',
              id: match.doc.id as number,
              data: userData,
              overrideAccess: true,
            })
            updated++
            results.push({
              row: rowNum,
              action: 'updated',
              email: c.email,
              shoplineCustomerId: c.customer_id,
              matchedBy: match.by,
              id: match.doc.id as number,
            })
          } else {
            const newUser = await (req.payload.create as (args: unknown) => Promise<unknown>)({
              collection: 'customers',
              draft: false,
              data: {
                ...userData,
                name:
                  c.name ||
                  (c.email ? c.email.split('@')[0] : '') ||
                  `Shopline ${c.customer_id || c.phone || 'Customer'}`,
                email: c.email || `shopline_${c.customer_id || c.phone}@placeholder.local`,
                password: generateRandomPassword(),
                signupSource: 'shopline',
                _verified: true,
              },
              overrideAccess: true,
              disableVerificationEmail: true,
            })
            created++
            results.push({
              row: rowNum,
              action: 'created',
              email: c.email,
              shoplineCustomerId: c.customer_id,
              id: (newUser as unknown as { id: number }).id,
            })
          }
        } catch (err) {
          failed++
          results.push({
            row: rowNum,
            action: 'error',
            email: c.email,
            shoplineCustomerId: c.customer_id,
            message: err instanceof Error ? err.message : String(err),
          })
        }
      }
    }

    return Response.json({
      success: true,
      mode: 'commit',
      total: batch.length,
      created,
      updated,
      skipped,
      failed,
      warnings: parseWarnings,
      // 只回前 100 筆 results，整批 17K 回傳會炸 response body
      results: results.slice(0, 100),
      totalResults: results.length,
    })
  },
}

/* ============================================================
   Helpers — find / build / stats
   ============================================================ */

async function findExistingUser(
  req: PayloadRequest,
  c: ImportableCustomer,
): Promise<{ doc: Record<string, unknown> | null; by: 'email' | 'shoplineCustomerId' | 'phone' }> {
  // Priority 1: email
  if (c.email) {
    const found = await req.payload.find({
      collection: 'customers',
      where: { email: { equals: c.email } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (found.docs.length > 0) {
      return { doc: found.docs[0] as unknown as Record<string, unknown>, by: 'email' }
    }
  }

  // Priority 2: shoplineCustomerId
  if (c.customer_id) {
    const found = await req.payload.find({
      collection: 'customers',
      where: { shoplineCustomerId: { equals: c.customer_id } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (found.docs.length > 0) {
      return { doc: found.docs[0] as unknown as Record<string, unknown>, by: 'shoplineCustomerId' }
    }
  }

  // Priority 3: phone
  if (c.phone) {
    const found = await req.payload.find({
      collection: 'customers',
      where: { phone: { equals: c.phone } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (found.docs.length > 0) {
      return { doc: found.docs[0] as unknown as Record<string, unknown>, by: 'phone' }
    }
  }

  return { doc: null, by: 'email' }
}

function buildUserData(c: ImportableCustomer): Record<string, unknown> {
  const cc = c as ParsedCustomer
  const data: Record<string, unknown> = {}

  if (cc.name) data.name = cc.name
  if (cc.phone) data.phone = cc.phone
  if (cc.customer_id) data.shoplineCustomerId = cc.customer_id
  if (cc.birthday) data.birthday = cc.birthday

  if (cc.gender) {
    data.gender = cc.gender
  }

  if (cc.tags && cc.tags.length > 0) {
    data.tags = cc.tags.map((tag) => ({ tag }))
  }

  if (cc.last_login_at) data.lastLoginDate = cc.last_login_at
  if (typeof cc.total_spent === 'number') {
    data.totalSpent = cc.total_spent
    data.lifetimeSpend = cc.total_spent
  }
  if (typeof cc.order_count === 'number') data.orderCount = cc.order_count
  if (typeof cc.points === 'number') data.points = cc.points
  if (typeof cc.shopping_credit === 'number') data.shoppingCredit = cc.shopping_credit
  if (cc.is_blacklisted === true) data.isBlacklisted = true

  // 訂閱偏好（只有 parser 路徑會帶 fb_subscribed / whatsapp_subscribed；JSON 路徑沒這些）
  const sub = (c as ParsedCustomer)
  if (
    sub.email_subscribed !== undefined ||
    sub.sms_subscribed !== undefined ||
    sub.line_subscribed !== undefined
  ) {
    data.subscriptionStatus = {
      ...(sub.email_subscribed !== undefined && { emailSubscribed: sub.email_subscribed }),
      ...(sub.sms_subscribed !== undefined && { smsSubscribed: sub.sms_subscribed }),
      ...(sub.line_subscribed !== undefined && { lineSubscribed: sub.line_subscribed }),
    }
  }

  // 社群帳號
  if (cc.facebook_id || cc.line_id) {
    data.socialLogins = {
      ...(cc.facebook_id && { facebookId: cc.facebook_id }),
      ...(cc.line_id && { lineId: cc.line_id }),
    }
    if (cc.line_id) data.lineUid = cc.line_id
  }

  // 身體資料
  if (cc.body) {
    const b = cc.body as ShoplineCustomerBody
    data.bodyProfile = {
      ...(typeof b.height === 'number' && { height: b.height }),
      ...(typeof b.weight === 'number' && { weight: b.weight }),
      ...(typeof b.foot_length === 'number' && { footLength: b.foot_length }),
      ...(typeof b.bust === 'number' && { bust: b.bust }),
      ...(typeof b.waist === 'number' && { waist: b.waist }),
      ...(typeof b.hips === 'number' && { hips: b.hips }),
    }
  }

  // UTM 首次接觸歸因
  if (cc.attribution) {
    const a = cc.attribution as ShoplineCustomerAttribution
    data.firstTouchAttribution = {
      ...(a.utm_source && { utmSource: a.utm_source }),
      ...(a.utm_medium && { utmMedium: a.utm_medium }),
      ...(a.utm_campaign && { utmCampaign: a.utm_campaign }),
      ...(a.utm_term && { utmTerm: a.utm_term }),
      ...(a.utm_content && { utmContent: a.utm_content }),
      ...(a.captured_at && { capturedAt: a.captured_at }),
    }
  }

  // 公司發票（原字串保留）
  if (cc.invoice_raw) {
    data.invoiceInfo = { invoiceTitle: cc.invoice_raw }
  }

  // 地址
  if (cc.addresses && cc.addresses.length > 0) {
    data.addresses = cc.addresses.map((a, idx) => ({
      label: idx === 0 ? '住家' : `Shopline 地址 ${idx + 1}`,
      recipientName: a.recipient || cc.name || '',
      phone: a.phone || cc.phone || '',
      city: a.city || '',
      district: a.district || '',
      zipCode: a.zipcode || '',
      address: a.address || '',
      isDefault: a.is_default ?? idx === 0,
    }))
  }

  // 備註（含未對應的會員級別、推薦人等）
  if (cc.note) data.crmNote = cc.note

  // 註冊來源：只有 update 時帶（create 時 outer 已固定為 'shopline'）
  // signupSource 在 create 時被 outer code 強制設為 'shopline'，update 時就不動
  return data
}

function generateRandomPassword(): string {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%'
  let pw = ''
  for (let i = 0; i < 16; i++) {
    pw += chars[Math.floor(Math.random() * chars.length)]
  }
  return pw
}

function computeStats(customers: ParsedCustomer[]): Record<string, number> {
  let withEmail = 0
  let withPhone = 0
  let withLine = 0
  let withFb = 0
  let withAddress = 0
  let withBirthday = 0
  let withBody = 0
  let withUtm = 0
  let blacklisted = 0
  let memberTierLabeled = 0

  for (const c of customers) {
    if (c.email) withEmail++
    if (c.phone) withPhone++
    if (c.line_id) withLine++
    if (c.facebook_id) withFb++
    if (c.addresses && c.addresses.length > 0) withAddress++
    if (c.birthday) withBirthday++
    if (c.body) withBody++
    if (c.attribution) withUtm++
    if (c.is_blacklisted) blacklisted++
    if (c.member_tier_label) memberTierLabeled++
  }

  return {
    withEmail,
    withPhone,
    withLine,
    withFb,
    withAddress,
    withBirthday,
    withBody,
    withUtm,
    blacklisted,
    memberTierLabeled,
  }
}
