/**
 * E2E 結帳測試種子 — 乾淨 _e2e.db。
 * 建：published 商品 + 3 張券（2 可疊加 + 1 不可疊加）+ 已驗證客戶。
 */
import { getPayload } from 'payload'
import config from '@payload-config'

async function main() {
  const payload = await getPayload({ config })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = payload as any

  const cat = await p.create({ collection: 'categories', data: { name: 'E2E 分類', slug: 'e2e-cat' }, overrideAccess: true })
  await p.create({
    collection: 'products',
    data: { name: 'E2E 測試洋裝', slug: 'e2e-prod', price: 1000, category: cat.id, status: 'published' },
    overrideAccess: true,
  })

  const mk = (data: Record<string, unknown>) => p.create({ collection: 'coupons', data, overrideAccess: true })
  await mk({ code: 'E2ESTACK10', name: 'E2E 可疊加九折', discountType: 'percentage', discountValue: 10, stackable: true, isActive: true })
  await mk({ code: 'E2EWELCOME50', name: 'E2E 可疊加減50', discountType: 'fixed', discountValue: 50, stackable: true, isActive: true })
  await mk({ code: 'E2ESOLO', name: 'E2E 單獨用減30', discountType: 'fixed', discountValue: 30, stackable: false, isActive: true })

  await p.create({
    collection: 'users',
    data: { email: 'e2e@test.local', password: 'Test12345!', name: 'E2E 客戶', role: 'customer', _verified: true },
    disableVerificationEmail: true,
    overrideAccess: true,
  })

  process.stdout.write('E2E seed done: product e2e-prod, coupons E2ESTACK10/E2EWELCOME50/E2ESOLO, user e2e@test.local\n')
}

await main()
