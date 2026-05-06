import type { Payload } from 'payload'

/**
 * Seed 5 預設幣別 — TWD/USD/JPY/KRW/CNY
 *
 * 匯率為 2026 年 5 月參考值（1 TWD 對該幣別），admin 後台可隨時改：
 *   - TWD: 1 (base)
 *   - USD: 0.031   ←  約 1 USD ≈ 32 TWD
 *   - JPY: 4.8     ←  約 1 JPY ≈ 0.21 TWD（即 100 JPY ≈ 21 TWD）
 *   - KRW: 41.5    ←  約 1 KRW ≈ 0.024 TWD（即 100 KRW ≈ 2.4 TWD）
 *   - CNY: 0.225   ←  約 1 CNY ≈ 4.4 TWD
 *
 * 冪等：用 code 作 unique key，已存在就 skip（不覆蓋 admin 改過的匯率）。
 */
export async function seedCurrencies(payload: Payload): Promise<void> {
  const presets = [
    {
      code: 'TWD',
      label: '新台幣',
      symbol: 'NT$',
      rateAgainstTwd: 1,
      decimalPlaces: 0,
      isActive: true,
      displayOrder: 1,
      description: '本站交易實際結算幣別',
    },
    {
      code: 'USD',
      label: '美元',
      symbol: 'US$',
      rateAgainstTwd: 0.031,
      decimalPlaces: 2,
      isActive: true,
      displayOrder: 2,
      description: '匯率參考值，請依實際情況調整（僅用於前台顯示估算）',
    },
    {
      code: 'JPY',
      label: '日圓',
      symbol: '¥',
      rateAgainstTwd: 4.8,
      decimalPlaces: 0,
      isActive: true,
      displayOrder: 3,
    },
    {
      code: 'KRW',
      label: '韓圜',
      symbol: '₩',
      rateAgainstTwd: 41.5,
      decimalPlaces: 0,
      isActive: true,
      displayOrder: 4,
    },
    {
      code: 'CNY',
      label: '人民幣',
      symbol: '¥',
      rateAgainstTwd: 0.225,
      decimalPlaces: 2,
      isActive: true,
      displayOrder: 5,
    },
  ]

  let created = 0
  let skipped = 0

  for (const item of presets) {
    try {
      const existing = await payload.find({
        collection: 'currencies',
        where: { code: { equals: item.code } },
        limit: 1,
      })
      if (existing.docs.length > 0) {
        console.log(`  → ${item.code} ${item.label} (已存在)`)
        skipped++
        continue
      }
      await (payload.create as unknown as (args: unknown) => Promise<unknown>)({
        collection: 'currencies',
        data: item as unknown as Record<string, unknown>,
      })
      console.log(`  ✓ ${item.code} ${item.label} (rate=${item.rateAgainstTwd})`)
      created++
    } catch (err) {
      console.error(`  ✗ ${item.code}:`, err)
    }
  }

  console.log(`💱 Currencies seed 完成：新增 ${created} / 跳過 ${skipped}`)
}
