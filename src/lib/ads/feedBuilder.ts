/**
 * Meta / Google Shopping 商品 feed 產生器
 * ─────────────────────────────────────────
 * 兩個平台都接受 Google Shopping RSS 2.0 格式（xmlns:g），所以共用此 builder。
 * 個別平台（Meta vs Google）僅 channel <title>/<description>/<link> 不同。
 *
 * 變體展開策略（PR-A 確認 = 策略 a）：
 *   - 每個 SKU 一筆 <item>，shared item_group_id（= product slug）
 *   - 單變體商品：無 item_group_id（Google 規範如此）
 *
 * Fallback chain（per-field）：
 *   variant.gtin → product.gtin → 不輸出
 *   adsTitleOverride → product.name
 *   adsDescriptionOverride → shortDescription → richText 純文字
 *   adsGender → settings.defaults.defaultGender
 *   adsAgeGroup → settings.defaults.defaultAgeGroup
 *   adsCondition → settings.defaults.defaultCondition
 *   googleProductCategory → settings.defaults.defaultGoogleProductCategory
 *   productType → settings.defaults.defaultProductTypePrefix + ' > ' + category.name
 *   brand → settings.defaults.defaultBrand
 */

import type { Payload, Where } from 'payload'

import type { Product, Media, Category, AdsCatalogSetting } from '../../payload-types'

export type FeedFlavor = 'meta' | 'google'

interface BuildFeedOptions {
  payload: Payload
  flavor: FeedFlavor
  siteUrl: string
}

interface FeedItem {
  id: string
  itemGroupId: string | null
  title: string
  description: string
  link: string
  imageLink: string | null
  additionalImageLinks: string[]
  availability: 'in stock' | 'out of stock' | 'preorder'
  price: string // "1280 TWD"
  salePrice: string | null
  brand: string
  condition: 'new' | 'refurbished' | 'used'
  gender: 'female' | 'male' | 'unisex'
  ageGroup: string
  googleProductCategory: string | null
  productType: string | null
  color: string | null
  size: string | null
  gtin: string | null
  mpn: string | null
  identifierExists: boolean
}

/* ─── XML escaping ─── */
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/* ─── Lexical (Payload v3 richText) → 純文字 ─── */
function lexicalToText(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const out: string[] = []
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    const n = node as Record<string, unknown>
    if (typeof n.text === 'string') out.push(n.text)
    if (Array.isArray(n.children)) n.children.forEach(visit)
  }
  const root = (value as Record<string, unknown>).root
  if (root && typeof root === 'object' && Array.isArray((root as Record<string, unknown>).children)) {
    ;((root as Record<string, unknown>).children as unknown[]).forEach(visit)
  }
  return out.join(' ').replace(/\s+/g, ' ').trim()
}

/* ─── Media URL resolver ─── */
function resolveMediaUrl(media: number | Media | null | undefined, siteUrl: string): string | null {
  if (!media || typeof media !== 'object') return null
  const url = (media as Media).url
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `${siteUrl}${url.startsWith('/') ? '' : '/'}${url}`
}

/* ─── Format price as "1280 TWD" (Google Shopping required format) ─── */
function formatPrice(amount: number, currency: string): string {
  // Meta/Google accept integers and decimals; TWD typically has no decimal places
  const rounded = currency === 'TWD' || currency === 'JPY' ? Math.round(amount) : amount.toFixed(2)
  return `${rounded} ${currency}`
}

/* ─── Build per-product items (1+ items per product if variants exist) ─── */
function buildItemsForProduct(
  product: Product,
  category: Category | null,
  settings: AdsCatalogSetting,
  siteUrl: string,
): FeedItem[] {
  const defaults = settings.defaults || {}
  const productTypeSegments = [
    defaults.defaultProductTypePrefix?.trim(),
    category?.name?.trim(),
  ].filter((s): s is string => Boolean(s))

  const baseTitle = (product.adsTitleOverride || product.name || '').trim()
  const baseDescription = (() => {
    if (product.adsDescriptionOverride && product.adsDescriptionOverride.trim()) {
      return product.adsDescriptionOverride.trim()
    }
    if (product.shortDescription && product.shortDescription.trim()) {
      return product.shortDescription.trim()
    }
    const fromRich = lexicalToText(product.description)
    if (fromRich) return fromRich.slice(0, 5000)
    return baseTitle
  })()

  const brand = (product.brand || defaults.defaultBrand || 'CHIC KIM & MIU').trim()
  const gender = (product.adsGender || defaults.defaultGender || 'female') as
    | 'female'
    | 'male'
    | 'unisex'
  const ageGroup = product.adsAgeGroup || defaults.defaultAgeGroup || 'adult'
  const condition = (product.adsCondition || defaults.defaultCondition || 'new') as
    | 'new'
    | 'refurbished'
    | 'used'
  const gpc =
    product.googleProductCategory?.trim() ||
    defaults.defaultGoogleProductCategory?.trim() ||
    null
  const productType =
    product.productType?.trim() ||
    (productTypeSegments.length > 0 ? productTypeSegments.join(' > ') : null)
  const currency = (defaults.defaultCurrency || 'TWD').trim()

  const productLink = `${siteUrl}/products/${product.slug}`
  const featuredImageUrl =
    resolveMediaUrl(product.featuredImage as number | Media | null | undefined, siteUrl) ||
    (Array.isArray(product.images) && product.images.length > 0
      ? resolveMediaUrl(product.images[0]?.image as number | Media | null | undefined, siteUrl)
      : null)
  const galleryUrls = (Array.isArray(product.images) ? product.images : [])
    .map((entry) => resolveMediaUrl(entry?.image as number | Media | null | undefined, siteUrl))
    .filter((u): u is string => Boolean(u))
    .slice(0, 10) // Meta/Google 上限 10 張 additional

  const productSku = product.productSku || product.slug
  const productGtin = product.gtin?.trim() || null
  const productMpn = product.mpn?.trim() || null
  const itemGroupId = product.slug || String(product.id)

  const variants = Array.isArray(product.variants) ? product.variants : []
  const allowPreOrder = Boolean(product.allowPreOrder)

  const items: FeedItem[] = []

  if (variants.length > 0) {
    for (const v of variants) {
      const sku = v.sku?.trim() || `${productSku}-${v.colorName}-${v.size}`
      const stock = typeof v.stock === 'number' ? v.stock : 0
      const availability: FeedItem['availability'] =
        stock > 0 ? 'in stock' : allowPreOrder ? 'preorder' : 'out of stock'

      const variantPrice = typeof v.priceOverride === 'number' && v.priceOverride > 0
        ? v.priceOverride
        : product.price
      const salePrice =
        typeof v.priceOverride === 'number' && v.priceOverride > 0
          ? null // 變體已覆寫 = 該價格即售價，不輸出 sale_price
          : typeof product.salePrice === 'number' && product.salePrice > 0
            ? product.salePrice
            : null

      const gtin = v.gtin?.trim() || productGtin
      const identifierExists = Boolean(gtin || (brand && productMpn))

      items.push({
        id: sku,
        itemGroupId,
        title: [baseTitle, v.colorName, v.size].filter(Boolean).join(' '),
        description: baseDescription,
        link: productLink,
        imageLink:
          resolveMediaUrl(v.colorSwatch as number | Media | null | undefined, siteUrl) ||
          featuredImageUrl,
        additionalImageLinks: galleryUrls,
        availability,
        price: formatPrice(variantPrice, currency),
        salePrice: salePrice ? formatPrice(salePrice, currency) : null,
        brand,
        condition,
        gender,
        ageGroup,
        googleProductCategory: gpc,
        productType,
        color: v.colorName?.trim() || null,
        size: v.size?.trim() || null,
        gtin,
        mpn: productMpn,
        identifierExists,
      })
    }
  } else {
    // 單品（無變體）
    const stock = typeof product.stock === 'number' ? product.stock : 0
    const availability: FeedItem['availability'] =
      stock > 0 ? 'in stock' : allowPreOrder ? 'preorder' : 'out of stock'
    const salePrice =
      typeof product.salePrice === 'number' && product.salePrice > 0 ? product.salePrice : null
    const identifierExists = Boolean(productGtin || (brand && productMpn))

    items.push({
      id: productSku,
      itemGroupId: null,
      title: baseTitle,
      description: baseDescription,
      link: productLink,
      imageLink: featuredImageUrl,
      additionalImageLinks: galleryUrls,
      availability,
      price: formatPrice(product.price, currency),
      salePrice: salePrice ? formatPrice(salePrice, currency) : null,
      brand,
      condition,
      gender,
      ageGroup,
      googleProductCategory: gpc,
      productType,
      color: null,
      size: null,
      gtin: productGtin,
      mpn: productMpn,
      identifierExists,
    })
  }

  return items
}

/* ─── XML render ─── */
function renderItem(item: FeedItem): string {
  const lines: string[] = ['    <item>']
  lines.push(`      <g:id>${xmlEscape(item.id)}</g:id>`)
  if (item.itemGroupId) {
    lines.push(`      <g:item_group_id>${xmlEscape(item.itemGroupId)}</g:item_group_id>`)
  }
  lines.push(`      <g:title><![CDATA[${item.title}]]></g:title>`)
  lines.push(`      <g:description><![CDATA[${item.description}]]></g:description>`)
  lines.push(`      <g:link>${xmlEscape(item.link)}</g:link>`)
  if (item.imageLink) {
    lines.push(`      <g:image_link>${xmlEscape(item.imageLink)}</g:image_link>`)
  }
  for (const url of item.additionalImageLinks.slice(0, 10)) {
    if (url !== item.imageLink) {
      lines.push(`      <g:additional_image_link>${xmlEscape(url)}</g:additional_image_link>`)
    }
  }
  lines.push(`      <g:availability>${item.availability}</g:availability>`)
  lines.push(`      <g:price>${xmlEscape(item.price)}</g:price>`)
  if (item.salePrice) {
    lines.push(`      <g:sale_price>${xmlEscape(item.salePrice)}</g:sale_price>`)
  }
  lines.push(`      <g:brand><![CDATA[${item.brand}]]></g:brand>`)
  lines.push(`      <g:condition>${item.condition}</g:condition>`)
  lines.push(`      <g:gender>${item.gender}</g:gender>`)
  lines.push(`      <g:age_group>${item.ageGroup}</g:age_group>`)
  if (item.googleProductCategory) {
    lines.push(
      `      <g:google_product_category><![CDATA[${item.googleProductCategory}]]></g:google_product_category>`,
    )
  }
  if (item.productType) {
    lines.push(`      <g:product_type><![CDATA[${item.productType}]]></g:product_type>`)
  }
  if (item.color) {
    lines.push(`      <g:color><![CDATA[${item.color}]]></g:color>`)
  }
  if (item.size) {
    lines.push(`      <g:size><![CDATA[${item.size}]]></g:size>`)
  }
  if (item.gtin) {
    lines.push(`      <g:gtin>${xmlEscape(item.gtin)}</g:gtin>`)
  }
  if (item.mpn) {
    lines.push(`      <g:mpn>${xmlEscape(item.mpn)}</g:mpn>`)
  }
  if (!item.identifierExists) {
    lines.push(`      <g:identifier_exists>false</g:identifier_exists>`)
  }
  lines.push('    </item>')
  return lines.join('\n')
}

/* ─── Public entry: build full RSS 2.0 feed XML ─── */
export async function buildCatalogFeed(opts: BuildFeedOptions): Promise<{
  xml: string
  itemCount: number
  productCount: number
  cacheTtlSeconds: number
  enabled: boolean
}> {
  const { payload, flavor, siteUrl } = opts

  // 拿 settings
  const settings = (await payload.findGlobal({
    slug: 'ads-catalog-settings',
    depth: 0,
  })) as AdsCatalogSetting

  if (!settings?.general?.enabled) {
    return {
      xml: '',
      itemCount: 0,
      productCount: 0,
      cacheTtlSeconds: 60,
      enabled: false,
    }
  }

  const includeOutOfStock = settings.general.includeOutOfStock !== false
  const includeDraft = Boolean(settings.general.includeDraft)
  const cacheTtl = (settings.general.feedCacheTtlMinutes || 60) * 60

  const where: Where = {
    excludeFromAdsCatalog: { not_equals: true },
  }
  if (!includeDraft) {
    where.status = { equals: 'published' }
  }

  // 拿全部商品（depth 1 才能解析 featuredImage / images / category）
  const productsResult = await payload.find({
    collection: 'products',
    where,
    limit: 5000,
    depth: 1,
  })

  const allItems: FeedItem[] = []
  let productCount = 0

  for (const product of productsResult.docs) {
    const category =
      product.category && typeof product.category === 'object'
        ? (product.category as Category)
        : null
    const items = buildItemsForProduct(product as Product, category, settings, siteUrl)
    const filtered = includeOutOfStock
      ? items
      : items.filter((i) => i.availability !== 'out of stock')
    if (filtered.length > 0) productCount += 1
    allItems.push(...filtered)
  }

  const channelTitle =
    flavor === 'meta'
      ? 'CHIC KIM & MIU — Meta 商品目錄'
      : 'CHIC KIM & MIU — Google Shopping 商品目錄'
  const channelDescription =
    flavor === 'meta'
      ? 'CHIC KIM & MIU 韓系質感女裝品牌商品目錄（Meta Commerce / Advantage+ 動態廣告）'
      : 'CHIC KIM & MIU 韓系質感女裝品牌商品目錄（Google Shopping / Performance Max 動態廣告）'

  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    '  <channel>',
    `    <title><![CDATA[${channelTitle}]]></title>`,
    `    <link>${xmlEscape(siteUrl)}</link>`,
    `    <description><![CDATA[${channelDescription}]]></description>`,
  ]

  for (const item of allItems) {
    lines.push(renderItem(item))
  }

  lines.push('  </channel>')
  lines.push('</rss>')

  return {
    xml: lines.join('\n'),
    itemCount: allItems.length,
    productCount,
    cacheTtlSeconds: cacheTtl,
    enabled: true,
  }
}
