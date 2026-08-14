import type { CollectionConfig, PayloadRequest, Where } from 'payload'

import { isAdmin } from '../access/isAdmin'
import {
  BLOG_CATEGORY_OPTIONS,
  BLOG_SITE_OPTIONS,
  isBlogCategoryForSite,
  isBlogSite,
  type BlogSite,
} from '../lib/blog/categoryTaxonomy'
import { safeRevalidate } from '../lib/revalidate'

/**
 * 部落格分類（獨立 collection，可後台管理顯示名稱 / 排序 / SEO）。
 *
 * 設計取捨：BlogPosts.category 維持 select（值不動，避免文章資料遷移風險）；
 * 本 collection 以 `site + value` 與文章的 `publishToKimLafayette + category`
 * 一一對應，讓購物網站與金老佛爺部落格可各自維護名稱、排序與 SEO。
 *
 * 對應 migration：20260608_170000_add_blog_categories（CREATE TABLE + seed 5 筆）。
 */
export const BlogCategories: CollectionConfig = {
  slug: 'blog-categories',
  labels: {
    singular: '部落格文章分類',
    plural: '兩個網站的部落格文章分類',
  },
  admin: {
    group: 'Ⓚ 兩站部落格',
    useAsTitle: 'name',
    defaultColumns: ['site', 'name', 'value', 'slug', 'displayOrder'],
    description:
      '兩個網站各自的文章分類。系統以「所屬網站＋分類值」對應文章，既有文章分類值不會被改寫。',
    components: {
      beforeListTable: ['@/components/admin/BlogCategoryListHeader'],
    },
  },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  timestamps: true,
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc, req }) => {
        const previous = (originalDoc || {}) as Record<string, unknown>
        const next = {
          ...previous,
          ...((data || {}) as Record<string, unknown>),
        }
        const site = next.site
        const value = typeof next.value === 'string' ? next.value : ''

        if (!isBlogSite(site)) {
          throw new Error('請選擇分類所屬網站。')
        }
        if (!value || !isBlogCategoryForSite(site, value)) {
          throw new Error(
            `${site === 'kim' ? '金老佛爺部落格' : '購物網站部落格'}不支援此分類值，請重新選擇。`,
          )
        }

        const currentID = previous.id
        const duplicateConditions: Where[] = [
          { site: { equals: site } },
          { value: { equals: value } },
        ]
        if (currentID != null) duplicateConditions.push({ id: { not_equals: currentID } })
        const duplicate = await req.payload.find({
          collection: 'blog-categories',
          where: { and: duplicateConditions },
          depth: 0,
          limit: 1,
          overrideAccess: true,
        })
        if (duplicate.totalDocs > 0) {
          throw new Error('這個網站已經有相同的分類值。')
        }

        const slug = typeof next.slug === 'string' ? next.slug.trim() : ''
        if (slug) {
          const slugConditions: Where[] = [
            { site: { equals: site } },
            { slug: { equals: slug } },
          ]
          if (currentID != null) slugConditions.push({ id: { not_equals: currentID } })
          const duplicateSlug = await req.payload.find({
            collection: 'blog-categories',
            where: { and: slugConditions },
            depth: 0,
            limit: 1,
            overrideAccess: true,
          })
          if (duplicateSlug.totalDocs > 0) {
            throw new Error('這個網站已經有相同的分類網址代碼。')
          }
        }

        if (
          operation === 'update' &&
          isBlogSite(previous.site) &&
          typeof previous.value === 'string' &&
          (previous.site !== site || previous.value !== value)
        ) {
          const linked = await countLinkedPosts(req, previous.site, previous.value)
          if (linked > 0) {
            throw new Error(
              `此分類仍有 ${linked} 篇文章使用。為避免文章失去分類，只能修改名稱、網址、排序與 SEO。`,
            )
          }
        }

        return { ...((data || {}) as Record<string, unknown>), site, slug: slug || null }
      },
    ],
    beforeDelete: [
      async ({ id, req }) => {
        const category = (await req.payload.findByID({
          collection: 'blog-categories',
          id,
          depth: 0,
          overrideAccess: true,
        })) as unknown as Record<string, unknown>
        if (!isBlogSite(category.site) || typeof category.value !== 'string') return

        const linked = await countLinkedPosts(req, category.site, category.value)
        if (linked > 0) {
          throw new Error(
            `此分類仍有 ${linked} 篇文章使用，不能刪除。請先替這些文章改選同網站的其他分類。`,
          )
        }
      },
    ],
    afterChange: [() => safeRevalidate(['/blog'], ['blog-categories'])],
    afterDelete: [() => safeRevalidate(['/blog'], ['blog-categories'])],
  },
  fields: [
    {
      name: 'site',
      label: '所屬網站',
      type: 'select',
      required: true,
      defaultValue: 'store',
      index: true,
      options: [...BLOG_SITE_OPTIONS],
      admin: {
        description: '購物網站與金老佛爺部落格的分類分開管理。',
      },
    },
    {
      name: 'name',
      label: '分類名稱',
      type: 'text',
      required: true,
      admin: { description: '前台頁籤顯示的中文名（例：穿搭教學）' },
    },
    {
      name: 'value',
      label: '對應文章分類值',
      type: 'select',
      required: true,
      options: BLOG_CATEGORY_OPTIONS.map(({ label, value }) => ({ label, value })),
      admin: {
        description: '必須對應文章的 category 值；同一值可由兩個網站分別管理。',
        components: {
          Field: '@/components/admin/BlogCategoryValueField',
        },
      },
    },
    {
      name: 'slug',
      label: '網址代碼',
      type: 'text',
      admin: { description: '供該網站的分類落地頁 /blog/category/<slug> 使用' },
    },
    {
      name: 'description',
      label: '分類描述',
      type: 'textarea',
    },
    {
      name: 'displayOrder',
      label: '排序',
      type: 'number',
      defaultValue: 0,
      admin: { description: '數字小者排前面' },
    },
    {
      name: 'seo',
      label: 'SEO 設定',
      type: 'group',
      fields: [
        { name: 'metaTitle', label: 'Meta 標題', type: 'text' },
        { name: 'metaDescription', label: 'Meta 描述', type: 'textarea' },
      ],
    },
  ],
}

async function countLinkedPosts(
  req: PayloadRequest,
  site: BlogSite,
  value: string,
): Promise<number> {
  const linked = await req.payload.find({
    collection: 'blog-posts',
    where: {
      and: [
        { category: { equals: value } },
        site === 'kim'
          ? { publishToKimLafayette: { equals: true } }
          : { publishToKimLafayette: { not_equals: true } },
      ],
    },
    depth: 0,
    limit: 0,
    overrideAccess: true,
  })
  return linked.totalDocs
}
