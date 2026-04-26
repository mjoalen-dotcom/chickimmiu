import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * ThemeStyles — server component
 * ──────────────────────────────
 * 拉 SiteThemes active doc → 把 hex 轉 RGB channel → 注入 :root CSS variable。
 *
 * 為什麼是 RGB channel？
 *   tailwind.config.ts brand-* 用 `rgb(var(--theme-x) / <alpha-value>)` 形式，
 *   這允許 `bg-brand-primary/40` 自動帶 0.4 alpha。
 *
 * 沒 active theme 時 component 回 null，瀏覽器吃 globals.css 的預設 fallback。
 */

function hexToRgbChannels(hex: unknown): string | null {
  if (typeof hex !== 'string') return null
  const m = hex.match(/^#?([0-9a-fA-F]{6})$/)
  if (!m) return null
  const n = parseInt(m[1], 16)
  return `${(n >> 16) & 0xff} ${(n >> 8) & 0xff} ${n & 0xff}`
}

interface ActiveTheme {
  palettePrimary?: string
  paletteAccent?: string
  paletteSurface?: string
  paletteInk?: string
  paletteOnPrimary?: string
  paletteOnAccent?: string
  paletteHeroOverlayFrom?: string
  paletteHeroOverlayTo?: string
  paletteHeroOverlayOpacity?: number
  serifFont?: string
  sansFont?: string
}

async function getActiveTheme(): Promise<ActiveTheme | null> {
  if (!process.env.DATABASE_URI) return null
  try {
    const payload = await getPayload({ config })
    const result = await payload.find({
      collection: 'site-themes',
      where: { isActive: { equals: true } },
      limit: 1,
      depth: 0,
    })
    return (result.docs[0] as unknown as ActiveTheme) || null
  } catch {
    return null
  }
}

export async function ThemeStyles() {
  const theme = await getActiveTheme()
  if (!theme) return null

  const lines: string[] = []
  const map: Array<[keyof ActiveTheme, string]> = [
    ['palettePrimary', '--theme-primary'],
    ['paletteAccent', '--theme-accent'],
    ['paletteSurface', '--theme-surface'],
    ['paletteInk', '--theme-ink'],
    ['paletteOnPrimary', '--theme-on-primary'],
    ['paletteOnAccent', '--theme-on-accent'],
    ['paletteHeroOverlayFrom', '--theme-overlay-from'],
    ['paletteHeroOverlayTo', '--theme-overlay-to'],
  ]

  for (const [key, varName] of map) {
    const ch = hexToRgbChannels(theme[key])
    if (ch) lines.push(`${varName}:${ch};`)
  }

  if (typeof theme.paletteHeroOverlayOpacity === 'number') {
    const op = Math.max(0, Math.min(1, theme.paletteHeroOverlayOpacity))
    lines.push(`--theme-overlay-opacity:${op};`)
  }

  if (lines.length === 0) return null

  // Single-rule :root override — wins over globals.css fallback by source order
  // (this <style> sits in <head> AFTER globals.css imports it).
  const css = `:root{${lines.join('')}}`
  return <style dangerouslySetInnerHTML={{ __html: css }} />
}
