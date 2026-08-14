export const BLOG_SITE_OPTIONS = [
  { label: '購物網站部落格（pre.chickimmiu.com）', value: 'store' },
  { label: '金老佛爺部落格（blog.kimlafayette.com）', value: 'kim' },
] as const

export type BlogSite = (typeof BLOG_SITE_OPTIONS)[number]['value']

export const BLOG_CATEGORY_OPTIONS = [
  { label: '穿搭教學', value: 'styling', sites: ['store', 'kim'] },
  { label: '新品介紹', value: 'new-arrivals', sites: ['store', 'kim'] },
  { label: '品牌故事', value: 'brand-story', sites: ['store', 'kim'] },
  { label: '優惠活動', value: 'promotions', sites: ['store', 'kim'] },
  { label: '時尚趨勢', value: 'trends', sites: ['store', 'kim'] },
  { label: '時尚流行', value: 'fashion', sites: ['kim'] },
  { label: '美容彩妝', value: 'beauty', sites: ['kim'] },
  { label: '購物情報', value: 'shopping', sites: ['kim'] },
  { label: '美食料理', value: 'food', sites: ['kim'] },
  { label: '生活綜合', value: 'lifestyle', sites: ['kim'] },
  { label: '親子育兒', value: 'parenting', sites: ['kim'] },
  { label: '旅遊紀錄', value: 'travel', sites: ['kim'] },
  { label: 'KPOP 男團介紹', value: 'kpop-boy-groups', sites: ['kim'] },
  { label: 'KPOP 女團介紹', value: 'kpop-girl-groups', sites: ['kim'] },
] as const satisfies ReadonlyArray<{
  label: string
  sites: readonly BlogSite[]
  value: string
}>

export type BlogCategoryValue = (typeof BLOG_CATEGORY_OPTIONS)[number]['value']

export function blogCategoryOptionsForSite(site: BlogSite) {
  return BLOG_CATEGORY_OPTIONS.filter((option) =>
    (option.sites as readonly BlogSite[]).includes(site),
  ).map(({ label, value }) => ({ label, value }))
}

export function blogCategoryLabel(value: unknown): string {
  const normalized = typeof value === 'string' ? value : ''
  return (
    BLOG_CATEGORY_OPTIONS.find((option) => option.value === normalized)?.label ||
    normalized ||
    '未分類'
  )
}

export function blogSiteFromPost(post: {
  publishToKimLafayette?: boolean | null
}): BlogSite {
  return post.publishToKimLafayette === true ? 'kim' : 'store'
}

export function isBlogCategoryForSite(site: BlogSite, value: unknown): boolean {
  return blogCategoryOptionsForSite(site).some((option) => option.value === value)
}

export function isBlogSite(value: unknown): value is BlogSite {
  return value === 'store' || value === 'kim'
}
