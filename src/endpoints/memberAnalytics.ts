import type { Endpoint, PayloadRequest } from 'payload'

/**
 * GET /api/users/member-analytics
 * ────────────────────────────────
 * 會員分群/人口統計儀表板資料源（僅 admin 可呼叫）。
 *
 * 一次回傳：
 *   - KPI：總會員、有生日資料、本月壽星、下月壽星
 *   - 生日月份分布（1..12）
 *   - 星座分布（12 星座；依月/日）
 *   - 年齡分布（<20, 20-24, 25-29, 30-34, 35-39, 40-49, 50+）
 *   - 性別分布
 *   - 會員等級分布（memberTier）
 *   - 本月壽星名單、下月壽星名單（可點 → users list 去信祝賀）
 *   - 年齡 × 商品分類 偏好矩陣（orders → items → products → categories）
 *
 * 資料量假設：封測期 < 5k 會員、< 20k 訂單。一次拉完 server 端算；
 * 若之後資料量爆炸改成分頁 + incremental aggregation。
 */

type UserLite = {
  id: string | number
  name?: string | null
  email?: string | null
  birthday?: string | null
  gender?: 'female' | 'male' | 'other' | null
  memberTier?: string | number | null
}

type OrderItemLite = { product?: string | number | null; quantity?: number | null }
type OrderLite = {
  id: string | number
  customer?: string | number | { id: string | number } | null
  items?: OrderItemLite[] | null
  status?: string | null
}

const ZODIACS: { key: string; label: string; startMonth: number; startDay: number }[] = [
  { key: 'capricorn', label: '摩羯座', startMonth: 12, startDay: 22 },
  { key: 'aquarius', label: '水瓶座', startMonth: 1, startDay: 20 },
  { key: 'pisces', label: '雙魚座', startMonth: 2, startDay: 19 },
  { key: 'aries', label: '牡羊座', startMonth: 3, startDay: 21 },
  { key: 'taurus', label: '金牛座', startMonth: 4, startDay: 20 },
  { key: 'gemini', label: '雙子座', startMonth: 5, startDay: 21 },
  { key: 'cancer', label: '巨蟹座', startMonth: 6, startDay: 22 },
  { key: 'leo', label: '獅子座', startMonth: 7, startDay: 23 },
  { key: 'virgo', label: '處女座', startMonth: 8, startDay: 23 },
  { key: 'libra', label: '天秤座', startMonth: 9, startDay: 23 },
  { key: 'scorpio', label: '天蠍座', startMonth: 10, startDay: 24 },
  { key: 'sagittarius', label: '射手座', startMonth: 11, startDay: 23 },
]

function zodiacOf(month: number, day: number): { key: string; label: string } {
  // 摩羯座跨年 12/22 - 1/19，特判。其他找 startMonth/startDay <= 當日 最後一筆。
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) {
    return { key: 'capricorn', label: '摩羯座' }
  }
  // 跳過第 0 項（摩羯），其餘按 startMonth, startDay 升序找「最後一個起點 <= (month,day)」
  const ordered = ZODIACS.filter((z) => z.key !== 'capricorn')
  let picked = ordered[0]
  for (const z of ordered) {
    if (z.startMonth < month || (z.startMonth === month && z.startDay <= day)) {
      picked = z
    } else {
      break
    }
  }
  return { key: picked.key, label: picked.label }
}

const AGE_BUCKETS: { key: string; label: string; min: number; max: number }[] = [
  { key: 'under_20', label: '未滿 20', min: 0, max: 19 },
  { key: '20_24', label: '20–24', min: 20, max: 24 },
  { key: '25_29', label: '25–29', min: 25, max: 29 },
  { key: '30_34', label: '30–34', min: 30, max: 34 },
  { key: '35_39', label: '35–39', min: 35, max: 39 },
  { key: '40_49', label: '40–49', min: 40, max: 49 },
  { key: '50_plus', label: '50 以上', min: 50, max: 200 },
]

function ageBucketOf(age: number): string {
  for (const b of AGE_BUCKETS) {
    if (age >= b.min && age <= b.max) return b.key
  }
  return 'unknown'
}

function parseBirthday(raw: string | null | undefined): { year: number; month: number; day: number } | null {
  if (!raw) return null
  // Payload date 欄位存 ISO string；Date 物件也支援
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

function ageFrom(year: number, month: number, day: number, now: Date): number {
  let age = now.getFullYear() - year
  const m = now.getMonth() + 1
  const d = now.getDate()
  if (m < month || (m === month && d < day)) age -= 1
  return age < 0 ? 0 : age
}

export const memberAnalyticsEndpoint: Endpoint = {
  path: '/member-analytics',
  method: 'get',
  handler: async (req: PayloadRequest) => {
    const user = req.user
    if (!user || (user as { role?: string }).role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      const now = new Date()
      const thisMonth = now.getMonth() + 1
      const nextMonth = thisMonth === 12 ? 1 : thisMonth + 1

      // ── 1. Users ────────────────────────────────────────────────────────
      const usersResp = await req.payload.find({
        collection: 'users',
        limit: 10000,
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      const users = usersResp.docs as unknown as UserLite[]
      const totalMembers = users.length
      const withBirthday = users.filter((u) => !!u.birthday).length

      // ── 2. MembershipTiers (for label lookup) ──────────────────────────
      const tiersResp = await req.payload.find({
        collection: 'membership-tiers',
        limit: 100,
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      type TierLite = { id: string | number; name?: string; frontName?: string }
      const tiers = tiersResp.docs as unknown as TierLite[]
      const tierLabelMap = new Map<string, string>()
      for (const t of tiers) {
        tierLabelMap.set(
          String(t.id),
          t.frontName || t.name || `等級 ${t.id}`,
        )
      }

      // ── 3. Categories (for product → category name) ─────────────────────
      const catsResp = await req.payload.find({
        collection: 'categories',
        limit: 500,
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      type CatLite = { id: string | number; name?: string; title?: string; slug?: string }
      const cats = catsResp.docs as unknown as CatLite[]
      const catNameMap = new Map<string, string>()
      for (const c of cats) {
        catNameMap.set(String(c.id), c.name || c.title || c.slug || `分類 ${c.id}`)
      }

      // ── 4. Products (product.id → category.id) ──────────────────────────
      const productsResp = await req.payload.find({
        collection: 'products',
        limit: 10000,
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      type ProdLite = { id: string | number; category?: string | number | null; title?: string }
      const products = productsResp.docs as unknown as ProdLite[]
      const productCatMap = new Map<string, string>()
      for (const p of products) {
        if (p.category != null) productCatMap.set(String(p.id), String(p.category))
      }

      // ── 5. Orders (for age × category purchase preferences) ─────────────
      const ordersResp = await req.payload.find({
        collection: 'orders',
        limit: 20000,
        depth: 0,
        pagination: false,
        overrideAccess: true,
        where: {
          // 只算已付款以上狀態，避免未成立訂單汙染偏好統計
          status: { in: ['processing', 'shipped', 'delivered', 'completed'] },
        },
      })
      const orders = ordersResp.docs as unknown as OrderLite[]

      // ── 6. Derived per-user info ────────────────────────────────────────
      const monthBuckets = new Map<number, number>()
      for (let m = 1; m <= 12; m++) monthBuckets.set(m, 0)

      const zodiacBuckets = new Map<string, { label: string; count: number }>()
      for (const z of ZODIACS) zodiacBuckets.set(z.key, { label: z.label, count: 0 })

      const ageBucketCounts = new Map<string, number>()
      for (const b of AGE_BUCKETS) ageBucketCounts.set(b.key, 0)
      ageBucketCounts.set('unknown', 0)

      const genderBuckets = new Map<string, number>([
        ['female', 0],
        ['male', 0],
        ['other', 0],
        ['unknown', 0],
      ])

      const tierBuckets = new Map<string, number>()
      tierBuckets.set('unknown', 0)

      const thisMonthBirthdays: { id: string | number; name: string; day: number }[] = []
      const nextMonthBirthdays: { id: string | number; name: string; day: number }[] = []

      // userId → ageBucket key (for order join)
      const userAgeBucket = new Map<string, string>()

      for (const u of users) {
        // gender
        const g = u.gender || 'unknown'
        genderBuckets.set(g, (genderBuckets.get(g) || 0) + 1)

        // tier
        const tierKey = u.memberTier != null ? String(u.memberTier) : 'unknown'
        tierBuckets.set(tierKey, (tierBuckets.get(tierKey) || 0) + 1)

        const bd = parseBirthday(u.birthday)
        if (!bd) {
          ageBucketCounts.set('unknown', (ageBucketCounts.get('unknown') || 0) + 1)
          userAgeBucket.set(String(u.id), 'unknown')
          continue
        }

        monthBuckets.set(bd.month, (monthBuckets.get(bd.month) || 0) + 1)

        const z = zodiacOf(bd.month, bd.day)
        const zb = zodiacBuckets.get(z.key)
        if (zb) zb.count += 1

        const age = ageFrom(bd.year, bd.month, bd.day, now)
        const ab = ageBucketOf(age)
        ageBucketCounts.set(ab, (ageBucketCounts.get(ab) || 0) + 1)
        userAgeBucket.set(String(u.id), ab)

        if (bd.month === thisMonth) {
          thisMonthBirthdays.push({
            id: u.id,
            name: u.name || u.email || `#${u.id}`,
            day: bd.day,
          })
        } else if (bd.month === nextMonth) {
          nextMonthBirthdays.push({
            id: u.id,
            name: u.name || u.email || `#${u.id}`,
            day: bd.day,
          })
        }
      }

      thisMonthBirthdays.sort((a, b) => a.day - b.day)
      nextMonthBirthdays.sort((a, b) => a.day - b.day)

      // ── 7. Age × Category matrix ────────────────────────────────────────
      // matrix[ageBucketKey][categoryId] = totalQuantity
      const ageCatMatrix = new Map<string, Map<string, number>>()
      const usedCategoryIds = new Set<string>()

      for (const o of orders) {
        const custId =
          typeof o.customer === 'object' && o.customer !== null && 'id' in o.customer
            ? String(o.customer.id)
            : o.customer != null
              ? String(o.customer)
              : null
        if (!custId) continue
        const ab = userAgeBucket.get(custId) || 'unknown'
        if (!o.items?.length) continue
        for (const it of o.items) {
          if (it.product == null) continue
          const catId = productCatMap.get(String(it.product))
          if (!catId) continue
          usedCategoryIds.add(catId)
          const qty = typeof it.quantity === 'number' && it.quantity > 0 ? it.quantity : 1
          if (!ageCatMatrix.has(ab)) ageCatMatrix.set(ab, new Map())
          const row = ageCatMatrix.get(ab)!
          row.set(catId, (row.get(catId) || 0) + qty)
        }
      }

      // Only include buckets with at least one purchase
      const ageBucketRows = [...AGE_BUCKETS, { key: 'unknown', label: '未填生日', min: 0, max: 0 }]
        .map((b) => ({
          key: b.key,
          label: b.label,
          cells: Array.from(usedCategoryIds).map((catId) => ({
            categoryId: catId,
            categoryName: catNameMap.get(catId) || `分類 ${catId}`,
            quantity: ageCatMatrix.get(b.key)?.get(catId) || 0,
          })),
          total: Array.from(usedCategoryIds).reduce(
            (s, catId) => s + (ageCatMatrix.get(b.key)?.get(catId) || 0),
            0,
          ),
        }))
        .filter((row) => row.total > 0)

      const categoryColumns = Array.from(usedCategoryIds).map((catId) => ({
        categoryId: catId,
        categoryName: catNameMap.get(catId) || `分類 ${catId}`,
      }))

      // ── 8. Shape response ───────────────────────────────────────────────
      return Response.json({
        generatedAt: now.toISOString(),
        kpi: {
          totalMembers,
          withBirthday,
          thisMonthCount: thisMonthBirthdays.length,
          nextMonthCount: nextMonthBirthdays.length,
          thisMonth,
          nextMonth,
        },
        byMonth: Array.from(monthBuckets.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([m, count]) => ({ month: m, count })),
        byZodiac: Array.from(zodiacBuckets.entries()).map(([key, v]) => ({
          key,
          label: v.label,
          count: v.count,
        })),
        byAge: [...AGE_BUCKETS, { key: 'unknown', label: '未填生日', min: 0, max: 0 }].map((b) => ({
          key: b.key,
          label: b.label,
          count: ageBucketCounts.get(b.key) || 0,
        })),
        byGender: [
          { key: 'female', label: '女性', count: genderBuckets.get('female') || 0 },
          { key: 'male', label: '男性', count: genderBuckets.get('male') || 0 },
          { key: 'other', label: '其他 / 不透露', count: genderBuckets.get('other') || 0 },
          { key: 'unknown', label: '未填', count: genderBuckets.get('unknown') || 0 },
        ],
        byTier: Array.from(tierBuckets.entries()).map(([tierId, count]) => ({
          tierId,
          label: tierId === 'unknown' ? '未分級' : tierLabelMap.get(tierId) || `等級 ${tierId}`,
          count,
        })),
        thisMonthBirthdays,
        nextMonthBirthdays,
        ageCategoryMatrix: {
          categories: categoryColumns,
          rows: ageBucketRows,
        },
      })
    } catch (e) {
      req.payload.logger.error({ msg: 'member-analytics failed', err: e })
      return Response.json(
        { error: 'Internal error', detail: e instanceof Error ? e.message : String(e) },
        { status: 500 },
      )
    }
  },
}
