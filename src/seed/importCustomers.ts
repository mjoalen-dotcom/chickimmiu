/**
 * Shopline 顧客資料匯入腳本
 * ─────────────────────────
 * 從 Shopline 匯出的 XLS/CSV 檔案匯入顧客到 Payload Users collection
 *
 * 使用方式：
 *   PAYLOAD_SECRET=xxx DATABASE_URI=file:./data/chickimmiu.db npx tsx src/seed/importCustomers.ts
 */

import { getPayload } from 'payload'
import config from '../payload.config'
import fs from 'fs'

// Pre-converted CSV from XLS using npx xlsx-cli
const XLS_PATH = 'C:/Users/mjoal/ally-site/chickimmiu/data/customers.csv'

interface ShoplineCustomer {
  shoplineId: string
  name: string
  email: string
  joinDate: string
  orderCount: number
  totalSpent: number
  shoppingCredit: number
  points: number
  isMember: boolean
  memberDate: string
  facebookId: string
  lineId: string
  isBlacklisted: boolean
  hasPassword: boolean
  acceptEmail: boolean
  acceptSms: boolean
  acceptLine: boolean
  lastLogin: string
  phone: string
  phoneCode: string
  memberPhone: string
  recipientName: string
  recipientPhone: string
  address1: string
  memberTier: string
  address2: string
  city: string
  district: string
  zipCode: string
  country: string
  gender: string
  birthday: string
  height: string
  weight: string
  footSize: string
  measurements: string
  companyInvoice: string
  tags: string
  notes: string
  utmSource: string
  utmMedium: string
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current.trim())
  return fields
}

function parseAmount(str: string): number {
  if (!str) return 0
  const cleaned = str.replace(/[NT$,\s]/g, '')
  return parseInt(cleaned, 10) || 0
}

function parseBirthday(str: string): string | null {
  if (!str) return null
  // Format: DD-MM-YYYY → YYYY-MM-DD
  const parts = str.split('-')
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts
    if (yyyy && mm && dd) {
      return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
    }
  }
  return null
}

function parseCustomer(fields: string[]): ShoplineCustomer | null {
  if (fields.length < 30) return null
  const shoplineId = fields[0]
  if (!shoplineId || shoplineId === '顧客 ID') return null // skip header

  return {
    shoplineId,
    name: fields[1] || '',
    email: fields[2] || '',
    joinDate: fields[3] || '',
    orderCount: parseInt(fields[6]) || 0,
    totalSpent: parseAmount(fields[7]),
    shoppingCredit: parseAmount(fields[11]),
    points: parseAmount(fields[15]),
    isMember: fields[16] === 'Y',
    memberDate: fields[17] || '',
    facebookId: fields[19] || '',
    lineId: fields[20] || '',
    isBlacklisted: fields[21] === 'Y',
    hasPassword: fields[22] === 'Y',
    acceptEmail: fields[23] === 'Y',
    acceptSms: fields[24] === 'Y',
    acceptLine: fields[26] === 'Y',
    lastLogin: fields[28] || '',
    phone: fields[29] || '',
    phoneCode: fields[30] || '',
    memberPhone: fields[31] || '',
    recipientName: fields[32] || '',
    recipientPhone: fields[33] || '',
    address1: fields[34] || '',
    memberTier: fields[35] || '',
    address2: fields[37] || '',
    city: fields[38] || '',
    district: fields[39] || '',
    zipCode: fields[40] || '',
    country: fields[41] || '',
    gender: fields[42] || '',
    birthday: fields[43] || '',
    height: fields[44] || '',
    weight: fields[45] || '',
    footSize: fields[46] || '',
    measurements: fields[47] || '',
    companyInvoice: fields[48] || '',
    tags: fields[49] || '',
    notes: fields[50] || '',
    utmSource: fields[51] || '',
    utmMedium: fields[52] || '',
  }
}

async function main() {
  const payload = await getPayload({ config })

  // Read the file
  const rawContent = fs.readFileSync(XLS_PATH, 'utf-8')
  // Remove BOM if present
  const content = rawContent.replace(/^\uFEFF/, '')
  const lines = content.split('\n').filter((l) => l.trim().length > 0)

  console.log(`📋 讀取到 ${lines.length} 行（含標題）\n`)

  // Parse header
  const header = parseCSVLine(lines[0])
  console.log(`📊 欄位數: ${header.length}`)
  console.log(`📊 前 5 個欄位: ${header.slice(0, 5).join(', ')}\n`)

  // Parse all customers
  const customers: ShoplineCustomer[] = []
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i])
    const customer = parseCustomer(fields)
    if (customer && customer.email) {
      customers.push(customer)
    }
  }

  console.log(`👥 有效顧客（有 email）: ${customers.length}\n`)

  // Statistics
  const withOrders = customers.filter((c) => c.orderCount > 0)
  const withPhone = customers.filter((c) => c.phone || c.memberPhone)
  const withAddress = customers.filter((c) => c.address1)
  const withBirthday = customers.filter((c) => c.birthday)

  console.log('📊 顧客資料統計:')
  console.log(`   有訂單: ${withOrders.length}`)
  console.log(`   有電話: ${withPhone.length}`)
  console.log(`   有地址: ${withAddress.length}`)
  console.log(`   有生日: ${withBirthday.length}`)
  console.log(`   黑名單: ${customers.filter((c) => c.isBlacklisted).length}`)
  console.log(`   有 LINE: ${customers.filter((c) => c.lineId).length}`)
  console.log(`   有 Facebook: ${customers.filter((c) => c.facebookId).length}`)
  console.log()

  // Total spent distribution
  const spendBuckets = {
    '0 (未消費)': 0,
    '1-1999': 0,
    '2000-4999': 0,
    '5000-9999': 0,
    '10000+': 0,
  }
  customers.forEach((c) => {
    if (c.totalSpent === 0) spendBuckets['0 (未消費)']++
    else if (c.totalSpent < 2000) spendBuckets['1-1999']++
    else if (c.totalSpent < 5000) spendBuckets['2000-4999']++
    else if (c.totalSpent < 10000) spendBuckets['5000-9999']++
    else spendBuckets['10000+']++
  })
  console.log('💰 消費分佈:')
  Object.entries(spendBuckets).forEach(([k, v]) => console.log(`   ${k}: ${v} 人`))
  console.log()

  // Import customers
  console.log('📥 開始匯入顧客到 Payload...\n')
  let created = 0
  let skipped = 0
  let errors = 0

  for (const c of customers) {
    try {
      // Check if already exists
      const existing = await payload.find({
        collection: 'users',
        where: { email: { equals: c.email } },
        limit: 1,
      })

      if (existing.docs.length > 0) {
        skipped++
        continue
      }

      // Build user data
      const userData: Record<string, unknown> = {
        email: c.email,
        password: 'CKMU2026!temp', // Temporary password, users will need to reset
        name: c.name || c.recipientName || c.email.split('@')[0],
        role: 'customer',
        phone: c.memberPhone || c.phone || '',
        points: c.points,
        shoppingCredit: c.shoppingCredit,
        totalSpent: c.totalSpent,
        lifetimeSpend: c.totalSpent,
        isBlacklisted: c.isBlacklisted,
      }

      // Birthday
      const bd = parseBirthday(c.birthday)
      if (bd) userData.birthday = bd

      // Last login
      if (c.lastLogin) {
        userData.lastLoginDate = new Date(c.lastLogin.replace(' ', 'T') + '+08:00').toISOString()
      }

      // LINE UID
      if (c.lineId) userData.lineUid = c.lineId

      // Social logins
      if (c.facebookId || c.lineId) {
        userData.socialLogins = {
          facebookId: c.facebookId || undefined,
          lineId: c.lineId || undefined,
        }
      }

      // Body profile
      if (c.height || c.weight) {
        userData.bodyProfile = {
          height: c.height ? parseFloat(c.height) : undefined,
          weight: c.weight ? parseFloat(c.weight) : undefined,
          preferredSizes: c.footSize ? `腳長 ${c.footSize}` : undefined,
        }
      }

      // Address
      if (c.recipientName && c.address1) {
        userData.addresses = [
          {
            label: '住家',
            recipientName: c.recipientName,
            phone: c.recipientPhone || c.memberPhone || c.phone || '',
            zipCode: c.zipCode || '',
            city: c.city || '',
            district: c.district || '',
            address: c.address1 + (c.address2 ? ' ' + c.address2 : ''),
            isDefault: true,
          },
        ]
      }

      // Tags from Shopline
      const tags: { tag: string }[] = []
      if (c.tags) {
        c.tags.split(',').forEach((t) => {
          const trimmed = t.trim()
          if (trimmed) tags.push({ tag: trimmed })
        })
      }
      // Auto-tag based on UTM source
      if (c.utmSource) tags.push({ tag: `UTM:${c.utmSource}` })
      if (c.acceptLine) tags.push({ tag: 'LINE好友' })
      if (tags.length > 0) userData.tags = tags

      // CRM note
      const notes: string[] = []
      if (c.notes) notes.push(c.notes)
      if (c.shoplineId) notes.push(`Shopline ID: ${c.shoplineId}`)
      if (c.orderCount > 0) notes.push(`Shopline 訂單數: ${c.orderCount}`)
      if (c.memberDate) notes.push(`會員註冊: ${c.memberDate}`)
      if (c.measurements) notes.push(`三圍: ${c.measurements}`)
      if (c.companyInvoice) notes.push(`統編: ${c.companyInvoice}`)
      userData.crmNote = notes.join(' | ')

      await (payload.create as Function)({
        collection: 'users',
        data: userData,
      })

      created++
      if (created % 50 === 0) {
        console.log(`  ✅ 已匯入 ${created} 位顧客...`)
      }
    } catch (err: unknown) {
      errors++
      if (errors <= 5) {
        console.log(`  ❌ 匯入失敗 (${c.email}): ${(err as Error).message?.substring(0, 80)}`)
      }
    }
  }

  console.log(`\n╔════════════════════════════════╗`)
  console.log(`║  匯入完成                      ║`)
  console.log(`╠════════════════════════════════╣`)
  console.log(`║  ✅ 成功建立: ${String(created).padStart(4)} 位           ║`)
  console.log(`║  ⏭️  已存在跳過: ${String(skipped).padStart(4)} 位         ║`)
  console.log(`║  ❌ 錯誤: ${String(errors).padStart(4)} 位               ║`)
  console.log(`╚════════════════════════════════╝`)

  process.exit(0)
}

main().catch((e) => {
  console.error('❌ 腳本錯誤:', e.message)
  process.exit(1)
})
