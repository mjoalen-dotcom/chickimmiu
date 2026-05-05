import type { Endpoint, PayloadRequest } from 'payload'

interface ShoplineCustomer {
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
  addresses?: Array<{
    recipient?: string
    phone?: string
    city?: string
    district?: string
    zipcode?: string
    address?: string
    is_default?: boolean
  }>
  note?: string
}

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

    let customers: ShoplineCustomer[]
    try {
      const body = await req.json?.()
      if (!body || !Array.isArray((body as { customers?: unknown }).customers)) {
        return Response.json(
          { success: false, message: '請提供 { customers: [...] } JSON body' },
          { status: 400 },
        )
      }
      customers = (body as { customers: ShoplineCustomer[] }).customers
    } catch (err) {
      return Response.json(
        { success: false, message: `JSON 解析失敗：${(err as Error).message}` },
        { status: 400 },
      )
    }

    const batch = limit > 0 ? customers.slice(0, limit) : customers

    if (dryRun) {
      const preview = batch.slice(0, 10).map((c, i) => ({
        row: i + 1,
        email: c.email || null,
        shoplineCustomerId: c.customer_id || null,
        phone: c.phone || null,
        name: c.name || null,
      }))
      return Response.json({
        success: true,
        mode: 'dry-run',
        totalInPayload: customers.length,
        willProcess: batch.length,
        samplePreview: preview,
      })
    }

    const results: ImportResult[] = []
    let created = 0
    let updated = 0
    let skipped = 0
    let failed = 0

    for (let i = 0; i < batch.length; i += batchSize) {
      const chunk = batch.slice(i, i + batchSize)

      for (let j = 0; j < chunk.length; j++) {
        const c = chunk[j]
        const rowNum = i + j + 1

        if (!c.email && !c.customer_id && !c.phone) {
          skipped++
          results.push({ row: rowNum, action: 'skipped', message: '無 email / customer_id / phone，無法識別' })
          continue
        }

        try {
          const match = await findExistingUser(req, c)

          const userData = buildUserData(c)

          if (match.doc) {
            await req.payload.update({
              collection: 'users',
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
            const newUser = await req.payload.create({
              collection: 'users',
              data: {
                ...userData,
                email: c.email || `shopline_${c.customer_id || c.phone}@placeholder.local`,
                password: generateRandomPassword(),
                role: 'customer',
                signupSource: 'shopline',
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
      results,
    })
  },
}

async function findExistingUser(
  req: PayloadRequest,
  c: ShoplineCustomer,
): Promise<{ doc: Record<string, unknown> | null; by: 'email' | 'shoplineCustomerId' | 'phone' }> {
  // Priority 1: email
  if (c.email) {
    const found = await req.payload.find({
      collection: 'users',
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
      collection: 'users',
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
      collection: 'users',
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

function buildUserData(c: ShoplineCustomer): Record<string, unknown> {
  const data: Record<string, unknown> = {}

  if (c.name) data.name = c.name
  if (c.phone) data.phone = c.phone
  if (c.customer_id) data.shoplineCustomerId = c.customer_id
  if (c.birthday) data.birthday = c.birthday

  if (c.gender) {
    const genderMap: Record<string, string> = { male: 'male', female: 'female', '男': 'male', '女': 'female' }
    data.gender = genderMap[c.gender.toLowerCase()] || 'other'
  }

  if (c.tags && c.tags.length > 0) {
    data.tags = c.tags.map((tag) => ({ tag }))
  }

  if (c.last_login_at) data.lastLoginDate = c.last_login_at
  if (typeof c.total_spent === 'number') data.lifetimeSpend = c.total_spent
  if (typeof c.order_count === 'number') data.orderCount = c.order_count

  if (c.email_subscribed !== undefined || c.sms_subscribed !== undefined || c.line_subscribed !== undefined) {
    data.subscriptionStatus = {
      ...(c.email_subscribed !== undefined && { emailSubscribed: c.email_subscribed }),
      ...(c.sms_subscribed !== undefined && { smsSubscribed: c.sms_subscribed }),
      ...(c.line_subscribed !== undefined && { lineSubscribed: c.line_subscribed }),
    }
  }

  if (c.addresses && c.addresses.length > 0) {
    data.addresses = c.addresses.map((a) => ({
      recipientName: a.recipient || c.name || '',
      phone: a.phone || c.phone || '',
      city: a.city || '',
      district: a.district || '',
      zipCode: a.zipcode || '',
      address: a.address || '',
      isDefault: a.is_default || false,
    }))
  }

  if (c.note) data.crmNote = c.note

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
