/**
 * Seed SiteThemes — 5 個主題 preset（常駐 + 春夏秋冬）
 * ─────────────────────────────────────────────────────
 * 「CKMU 經典」常駐主題預設啟用。其他季節主題未啟用，由 admin 後台勾選切換。
 *
 * 用法：
 *   npx tsx src/seed/seedSiteThemes.ts
 *   或在 src/seed/run.ts 內 import seedSiteThemes() 一鍵跑。
 *
 * 冪等：以 `name` 作 unique key，已存在則 skip（不覆蓋使用者調整過的色票）。
 */

import { getPayload } from 'payload'
import config from '../payload.config'

interface ThemePreset {
  name: string
  season: 'spring' | 'summer' | 'autumn' | 'winter' | 'event' | 'default'
  isActive?: boolean
  palettePrimary: string
  paletteAccent: string
  paletteSurface: string
  paletteInk: string
  paletteOnPrimary: string
  paletteOnAccent: string
  paletteHeroOverlayFrom: string
  paletteHeroOverlayTo: string
  paletteHeroOverlayOpacity: number
  serifFont: string
  sansFont: string
  heroLayout: 'split' | 'editorial' | 'cinematic' | 'magazine'
  heroMinHeightDesktop: number
  heroMinHeightMobile: number
}

const PRESETS: ThemePreset[] = [
  {
    name: 'CKMU 經典',
    season: 'default',
    isActive: true,
    palettePrimary: '#C19A5B',
    paletteAccent: '#EFBBAA',
    paletteSurface: '#F9F5EC',
    paletteInk: '#2C2C2C',
    paletteOnPrimary: '#FDFBF7',
    paletteOnAccent: '#2C2C2C',
    paletteHeroOverlayFrom: '#000000',
    paletteHeroOverlayTo: '#000000',
    paletteHeroOverlayOpacity: 0.45,
    serifFont: 'noto-serif-tc',
    sansFont: 'noto-sans-tc',
    heroLayout: 'split',
    heroMinHeightDesktop: 85,
    heroMinHeightMobile: 60,
  },
  {
    name: '春櫻 2026',
    season: 'spring',
    isActive: false,
    palettePrimary: '#E8537C',
    paletteAccent: '#FFC8DD',
    paletteSurface: '#FFF1F4',
    paletteInk: '#3D1F2E',
    paletteOnPrimary: '#FFFFFF',
    paletteOnAccent: '#3D1F2E',
    paletteHeroOverlayFrom: '#3D1F2E',
    paletteHeroOverlayTo: '#3D1F2E',
    paletteHeroOverlayOpacity: 0.4,
    serifFont: 'noto-serif-tc',
    sansFont: 'noto-sans-tc',
    heroLayout: 'editorial',
    heroMinHeightDesktop: 90,
    heroMinHeightMobile: 70,
  },
  {
    name: '夏海 2026',
    season: 'summer',
    isActive: false,
    palettePrimary: '#1FA9A0',
    paletteAccent: '#A8E0DA',
    paletteSurface: '#EAF7F5',
    paletteInk: '#0E2B33',
    paletteOnPrimary: '#FFFFFF',
    paletteOnAccent: '#0E2B33',
    paletteHeroOverlayFrom: '#0E2B33',
    paletteHeroOverlayTo: '#0E2B33',
    paletteHeroOverlayOpacity: 0.5,
    serifFont: 'noto-serif-tc',
    sansFont: 'noto-sans-tc',
    heroLayout: 'cinematic',
    heroMinHeightDesktop: 100,
    heroMinHeightMobile: 85,
  },
  {
    name: '秋楓 2026',
    season: 'autumn',
    isActive: false,
    palettePrimary: '#B7672D',
    paletteAccent: '#E2C89A',
    paletteSurface: '#FAF1E4',
    paletteInk: '#3A2418',
    paletteOnPrimary: '#FFFFFF',
    paletteOnAccent: '#3A2418',
    paletteHeroOverlayFrom: '#3A2418',
    paletteHeroOverlayTo: '#3A2418',
    paletteHeroOverlayOpacity: 0.45,
    serifFont: 'noto-serif-tc',
    sansFont: 'noto-sans-tc',
    heroLayout: 'magazine',
    heroMinHeightDesktop: 95,
    heroMinHeightMobile: 75,
  },
  {
    name: '冬雪 2026',
    season: 'winter',
    isActive: false,
    palettePrimary: '#3E5C76',
    paletteAccent: '#B5C7D8',
    paletteSurface: '#EDF2F6',
    paletteInk: '#101D2A',
    paletteOnPrimary: '#FFFFFF',
    paletteOnAccent: '#101D2A',
    paletteHeroOverlayFrom: '#101D2A',
    paletteHeroOverlayTo: '#101D2A',
    paletteHeroOverlayOpacity: 0.55,
    serifFont: 'noto-serif-tc',
    sansFont: 'noto-sans-tc',
    heroLayout: 'editorial',
    heroMinHeightDesktop: 90,
    heroMinHeightMobile: 70,
  },
]

export async function seedSiteThemes(): Promise<void> {
  const payload = await getPayload({ config })

  for (const preset of PRESETS) {
    try {
      const existing = await payload.find({
        collection: 'site-themes',
        where: { name: { equals: preset.name } },
        limit: 1,
      })
      if (existing.docs.length > 0) {
        // eslint-disable-next-line no-console
        console.log(`  → ${preset.name} (已存在，skip)`)
        continue
      }
      await (payload.create as (args: unknown) => Promise<unknown>)({
        collection: 'site-themes',
        data: preset,
      })
      // eslint-disable-next-line no-console
      console.log(`  ✓ ${preset.name}${preset.isActive ? ' (active)' : ''}`)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`  ✗ ${preset.name}:`, err)
    }
  }
}

// Standalone runner via `payload run src/seed/seedSiteThemes.ts`.
// MUST be top-level await — `payload run` does `await import(scriptPath)` then
// `process.exit(0)`, so fire-and-forget would exit before seed completes.
// Pattern lifted from seedCore.ts.
// eslint-disable-next-line no-console
console.log('🎨 Seeding SiteThemes (5 presets)...')
await seedSiteThemes()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log('✅ Done.')
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('❌ Seed 失敗:', err)
    process.exit(1)
  })
