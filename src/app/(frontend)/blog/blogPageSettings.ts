/**
 * /blog 列表頁的後台設定（global `blog-page-settings`）在前台的型別與預設值。
 *
 * server component 讀 global → normalize → 傳給 client component；global 尚未
 * 建立或欄位為空時一律退回這裡的預設值，前台不會因為後台沒設定就壞掉。
 */

export type BlogCategoryNavStyle =
  | 'pills-wrap'
  | 'pills-scroll'
  | 'underline'
  | 'dropdown'
  | 'hidden'

export type BlogCategorySortBy = 'count' | 'manual' | 'name'

export type BlogLayoutStyle = 'magazine' | 'editorial' | 'minimal' | 'masonry'

export type BlogLayoutColumns = '2' | '3' | '4'

export interface BlogPageSettingsView {
  categoryNav: {
    style: BlogCategoryNavStyle
    hideEmpty: boolean
    showCount: boolean
    maxVisible: number
    sortBy: BlogCategorySortBy
  }
  layout: {
    style: BlogLayoutStyle
    columns: BlogLayoutColumns
    showEditorsPick: boolean
    showExcerpt: boolean
    pageSize: number
  }
  hero: {
    enabled: boolean
    overline: string
    title: string
    titleAccent: string
    description: string
    showActions: boolean
  }
  newsletter: {
    enabled: boolean
    overline: string
    title: string
    description: string
  }
}

export const DEFAULT_BLOG_PAGE_SETTINGS: BlogPageSettingsView = {
  categoryNav: {
    style: 'pills-wrap',
    hideEmpty: true,
    showCount: true,
    maxVisible: 6,
    sortBy: 'count',
  },
  layout: {
    style: 'magazine',
    columns: '3',
    showEditorsPick: true,
    showExcerpt: true,
    pageSize: 12,
  },
  hero: {
    enabled: true,
    overline: 'Style Journal · 穿搭誌',
    title: '讓每一天',
    titleAccent: '都成為經典',
    description:
      '韓系穿搭靈感、時尚趨勢解讀、編輯部精選 — 由金老佛爺帶領，讓你從通勤到約會，從日常到重要時刻都有屬於自己的風格答案。',
    showActions: true,
  },
  newsletter: {
    enabled: true,
    overline: 'Stay in Style',
    title: '每週一封穿搭靈感信',
    description: '訂閱穿搭誌 newsletter — 第一時間收到新品上市、季節穿搭與會員專屬優惠',
  },
}

function pickString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function pickBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/**
 * Payload 的 number 欄位在 PG 走 numeric，取回來可能是字串。
 * 後台把數字欄位清空時值是 null／''，而 Number(null) 與 Number('') 都是 0
 * （不是 NaN）——不先擋掉會讓「沒設定」被當成 0，每頁篇數被夾成下限。
 */
function pickNumber(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === '') return fallback
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

function pickOption<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

/** 把 global 原始 doc 收斂成前台用的設定物件（缺欄位一律用預設值） */
export function normalizeBlogPageSettings(raw: unknown): BlogPageSettingsView {
  const d = (raw || {}) as Record<string, unknown>
  const nav = (d.categoryNav || {}) as Record<string, unknown>
  const layout = (d.layout || {}) as Record<string, unknown>
  const hero = (d.hero || {}) as Record<string, unknown>
  const newsletter = (d.newsletter || {}) as Record<string, unknown>
  const fallback = DEFAULT_BLOG_PAGE_SETTINGS

  return {
    categoryNav: {
      style: pickOption(
        nav.style,
        ['pills-wrap', 'pills-scroll', 'underline', 'dropdown', 'hidden'] as const,
        fallback.categoryNav.style,
      ),
      hideEmpty: pickBool(nav.hideEmpty, fallback.categoryNav.hideEmpty),
      showCount: pickBool(nav.showCount, fallback.categoryNav.showCount),
      maxVisible: Math.max(0, Math.round(pickNumber(nav.maxVisible, fallback.categoryNav.maxVisible))),
      sortBy: pickOption(
        nav.sortBy,
        ['count', 'manual', 'name'] as const,
        fallback.categoryNav.sortBy,
      ),
    },
    layout: {
      style: pickOption(
        layout.style,
        ['magazine', 'editorial', 'minimal', 'masonry'] as const,
        fallback.layout.style,
      ),
      columns: pickOption(layout.columns, ['2', '3', '4'] as const, fallback.layout.columns),
      showEditorsPick: pickBool(layout.showEditorsPick, fallback.layout.showEditorsPick),
      showExcerpt: pickBool(layout.showExcerpt, fallback.layout.showExcerpt),
      pageSize: Math.min(
        60,
        Math.max(3, Math.round(pickNumber(layout.pageSize, fallback.layout.pageSize))),
      ),
    },
    hero: {
      enabled: pickBool(hero.enabled, fallback.hero.enabled),
      overline: pickString(hero.overline, fallback.hero.overline),
      title: pickString(hero.title, fallback.hero.title),
      titleAccent: pickString(hero.titleAccent, fallback.hero.titleAccent),
      description: pickString(hero.description, fallback.hero.description),
      showActions: pickBool(hero.showActions, fallback.hero.showActions),
    },
    newsletter: {
      enabled: pickBool(newsletter.enabled, fallback.newsletter.enabled),
      overline: pickString(newsletter.overline, fallback.newsletter.overline),
      title: pickString(newsletter.title, fallback.newsletter.title),
      description: pickString(newsletter.description, fallback.newsletter.description),
    },
  }
}
