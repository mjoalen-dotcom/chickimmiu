/**
 * Shopline CSV 解析器
 * 解析 Shopline Bulk Update Excel 轉出的 CSV UTF-8 檔案
 * 處理多行變體合併、分類映射、欄位校驗
 */

import { mapShoplineCategory } from './categoryMapping'

// ── Shopline CSV 欄位名稱對照 ──
// Shopline 匯出的欄位名稱可能有多種格式
const FIELD_ALIASES: Record<string, string[]> = {
  productName: [
    'Product Name (Traditional Chinese)',
    'Product Name',
    '商品名稱',
    '商品名稱 (繁體中文)',
  ],
  regularPrice: ['Regular Price', '原價', '定價'],
  salePrice: ['Sale Price', '售價', '特價'],
  categories: [
    'Online Store Categories',
    'Categories',
    '商品分類',
    '線上商店分類',
  ],
  summary: [
    'Product Summary (Traditional Chinese)',
    'Product Summary',
    '商品摘要',
    '商品摘要 (繁體中文)',
  ],
  seoTitle: [
    'SEO Title (Traditional Chinese)',
    'SEO Title',
    'SEO 標題',
    'SEO 標題 (繁體中文)',
  ],
  seoDescription: [
    'SEO Description (Traditional Chinese)',
    'SEO Description',
    'SEO 描述',
    'SEO 描述 (繁體中文)',
  ],
  variant: [
    'Variant (Traditional Chinese)',
    'Variant',
    '規格',
    '規格 (繁體中文)',
  ],
  variantPrice: ['Variant Price', '規格售價', '規格價格'],
  weight: ['Weight(KG)', 'Weight', '重量(KG)', '重量'],
  sku: ['SKU', 'sku', '商品編號'],
  image: [
    'Product Main Image',
    'Main Image',
    '主要圖片',
    '商品主圖',
    'Image URL',
  ],
  stock: ['Stock', 'Inventory', '庫存', '庫存數量'],
  status: ['Status', '狀態', '上架狀態'],
  productId: ['Product ID', '商品ID', '商品編號'],
}

// ── 解析結果型別 ──

export interface ParsedVariant {
  color: string
  size: string
  price: number
  stock: number
  sku: string
}

export interface ParsedProduct {
  id: string
  name: string
  category: string
  categorySlug: string
  price_ntd: number
  original_price_ntd: number
  colors: string[]
  sizes: string[]
  short_desc: string
  full_description: string
  main_image_url: string
  product_url: string
  weight_kg: number
  sku: string
  tags: string[]
  seo_title: string
  seo_description: string
  variants: ParsedVariant[]
  // 解析狀態
  _warnings: string[]
  _errors: string[]
  _rowNumbers: number[]
}

export interface ParseResult {
  products: ParsedProduct[]
  totalRows: number
  totalProducts: number
  totalVariants: number
  errors: { row: number; message: string }[]
  warnings: { row: number; message: string }[]
  unmappedCategories: string[]
}

// ── CSV 解析核心 ──

/**
 * 解析 CSV 字串（處理引號包裹、換行等）
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
  }
  result.push(current.trim())
  return result
}

/**
 * 解析完整 CSV 文字
 */
function parseCSVText(text: string): { headers: string[]; rows: string[][] } {
  // 處理 BOM
  const cleanText = text.replace(/^\uFEFF/, '')

  // 處理跨行引號欄位
  const lines: string[] = []
  let current = ''
  let inQuotes = false

  for (const char of cleanText) {
    if (char === '"') inQuotes = !inQuotes
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (current.trim()) lines.push(current)
      current = ''
    } else if (char !== '\r') {
      current += char
    }
  }
  if (current.trim()) lines.push(current)

  if (lines.length < 2) return { headers: [], rows: [] }

  const headers = parseCSVLine(lines[0])
  const rows = lines.slice(1).map(parseCSVLine)

  return { headers, rows }
}

/**
 * 根據別名對照找到欄位 index
 */
function findColumnIndex(headers: string[], fieldKey: string): number {
  const aliases = FIELD_ALIASES[fieldKey] || [fieldKey]
  for (const alias of aliases) {
    const idx = headers.findIndex(
      h => h.trim().toLowerCase() === alias.toLowerCase()
    )
    if (idx !== -1) return idx
  }
  return -1
}

function getField(row: string[], idx: number): string {
  if (idx < 0 || idx >= row.length) return ''
  return (row[idx] || '').trim()
}

function toNumber(val: string): number {
  const n = parseFloat(val.replace(/[,$\s]/g, ''))
  return isNaN(n) ? 0 : n
}

/**
 * 從變體名稱解析顏色和尺寸
 * Shopline 變體格式通常為：「黑色 / S」「黑色-S」「Free」等
 */
function parseVariantName(variant: string): { color: string; size: string } {
  if (!variant) return { color: '', size: 'Free' }

  // 常見分隔符
  const separators = [' / ', '/', ' - ', '-', ' _ ', '｜', '|']
  for (const sep of separators) {
    if (variant.includes(sep)) {
      const parts = variant.split(sep).map(s => s.trim()).filter(Boolean)
      if (parts.length >= 2) {
        // 判斷哪個是尺寸、哪個是顏色
        const sizePatterns = /^(XXS|XS|S|M|L|XL|XXL|XXXL|2XL|3XL|Free|F|均碼|ONE SIZE|\d+)$/i
        const lastPart = parts[parts.length - 1]
        const firstPart = parts[0]

        if (sizePatterns.test(lastPart)) {
          return { color: parts.slice(0, -1).join(' '), size: lastPart }
        }
        if (sizePatterns.test(firstPart)) {
          return { color: parts.slice(1).join(' '), size: firstPart }
        }
        // 預設：第一個是顏色，最後一個是尺寸
        return { color: firstPart, size: lastPart }
      }
    }
  }

  // 無分隔符 — 判斷是純尺寸還是純顏色
  const sizeOnly = /^(XXS|XS|S|M|L|XL|XXL|XXXL|2XL|3XL|Free|F|均碼|ONE SIZE|\d+)$/i
  if (sizeOnly.test(variant)) {
    return { color: '', size: variant }
  }

  return { color: variant, size: 'Free' }
}

/**
 * 生成 URL-safe slug
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 80)
}

// ── 主解析函數 ──

/**
 * 解析 Shopline CSV 檔案內容
 * @param csvText - CSV 文字內容
 * @returns 解析結果
 */
export function parseShoplineCSV(csvText: string): ParseResult {
  const { headers, rows } = parseCSVText(csvText)

  if (headers.length === 0) {
    return {
      products: [],
      totalRows: 0,
      totalProducts: 0,
      totalVariants: 0,
      errors: [{ row: 0, message: 'CSV 檔案無法解析，請確認格式是否正確' }],
      warnings: [],
      unmappedCategories: [],
    }
  }

  // 建立欄位索引
  const col = {
    name: findColumnIndex(headers, 'productName'),
    regularPrice: findColumnIndex(headers, 'regularPrice'),
    salePrice: findColumnIndex(headers, 'salePrice'),
    categories: findColumnIndex(headers, 'categories'),
    summary: findColumnIndex(headers, 'summary'),
    seoTitle: findColumnIndex(headers, 'seoTitle'),
    seoDescription: findColumnIndex(headers, 'seoDescription'),
    variant: findColumnIndex(headers, 'variant'),
    variantPrice: findColumnIndex(headers, 'variantPrice'),
    weight: findColumnIndex(headers, 'weight'),
    sku: findColumnIndex(headers, 'sku'),
    image: findColumnIndex(headers, 'image'),
    stock: findColumnIndex(headers, 'stock'),
    status: findColumnIndex(headers, 'status'),
    productId: findColumnIndex(headers, 'productId'),
  }

  // 檢查必要欄位
  const errors: { row: number; message: string }[] = []
  const warnings: { row: number; message: string }[] = []

  if (col.name === -1) {
    errors.push({ row: 0, message: '找不到「商品名稱」欄位。可用欄位：' + headers.join(', ') })
    return { products: [], totalRows: rows.length, totalProducts: 0, totalVariants: 0, errors, warnings, unmappedCategories: [] }
  }

  // 逐行解析，將同一商品的多行合併
  const productMap = new Map<string, { rows: { data: string[]; rowNum: number }[] }>()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const name = getField(row, col.name)
    if (!name) {
      // 可能是變體續行（Shopline 某些匯出格式，續行的商品名稱為空）
      // 嘗試附加到上一個商品
      if (productMap.size > 0) {
        const lastKey = [...productMap.keys()].pop()!
        productMap.get(lastKey)!.rows.push({ data: row, rowNum: i + 2 })
      }
      continue
    }

    if (!productMap.has(name)) {
      productMap.set(name, { rows: [] })
    }
    productMap.get(name)!.rows.push({ data: row, rowNum: i + 2 })
  }

  // 轉換每個商品
  const products: ParsedProduct[] = []
  const unmappedSet = new Set<string>()
  let variantCount = 0

  let productIndex = 0
  for (const [name, { rows: productRows }] of productMap) {
    productIndex++
    const firstRow = productRows[0].data
    const rowNums = productRows.map(r => r.rowNum)
    const productWarnings: string[] = []
    const productErrors: string[] = []

    // 基本資料（取第一行）
    const regularPrice = toNumber(getField(firstRow, col.regularPrice))
    const salePrice = toNumber(getField(firstRow, col.salePrice))
    const categoriesStr = getField(firstRow, col.categories)
    const summary = getField(firstRow, col.summary)
    const seoTitle = getField(firstRow, col.seoTitle)
    const seoDescription = getField(firstRow, col.seoDescription)
    const weight = toNumber(getField(firstRow, col.weight))
    const mainSku = getField(firstRow, col.sku)
    const imageUrl = getField(firstRow, col.image)
    const productId = getField(firstRow, col.productId)

    // 分類映射
    const { primaryCategory, tags, rawCategories } = mapShoplineCategory(categoriesStr)
    if (!primaryCategory && categoriesStr) {
      productWarnings.push(`無法映射分類: ${categoriesStr}`)
      rawCategories.forEach(c => unmappedSet.add(c))
    }

    // 解析所有變體
    const variants: ParsedVariant[] = []
    const colorSet = new Set<string>()
    const sizeSet = new Set<string>()

    for (const { data: row, rowNum } of productRows) {
      const variantName = getField(row, col.variant)
      const variantPriceStr = getField(row, col.variantPrice)
      const variantSku = getField(row, col.sku)
      const variantStock = toNumber(getField(row, col.stock))

      if (variantName) {
        const { color, size } = parseVariantName(variantName)
        const vPrice = variantPriceStr ? toNumber(variantPriceStr) : (salePrice || regularPrice)

        variants.push({
          color: color || '預設',
          size: size || 'Free',
          price: vPrice,
          stock: Math.max(0, Math.round(variantStock)),
          sku: variantSku || `${mainSku}-${color}-${size}`,
        })

        if (color) colorSet.add(color)
        sizeSet.add(size || 'Free')
        variantCount++
      } else if (productRows.length === 1) {
        // 無變體商品 — 建立一個預設變體
        variants.push({
          color: '預設',
          size: 'Free',
          price: salePrice || regularPrice,
          stock: Math.max(0, Math.round(toNumber(getField(row, col.stock)))),
          sku: mainSku || generateSlug(name),
        })
        sizeSet.add('Free')
        variantCount++
      }
    }

    // 校驗
    if (regularPrice <= 0 && salePrice <= 0) {
      productErrors.push('缺少價格資訊')
    }
    if (variants.length === 0) {
      productWarnings.push('無變體資訊，已建立預設變體')
      variants.push({
        color: '預設',
        size: 'Free',
        price: salePrice || regularPrice,
        stock: 0,
        sku: mainSku || generateSlug(name),
      })
    }

    // 組裝商品物件
    const product: ParsedProduct = {
      id: productId || `import-${productIndex}`,
      name,
      category: primaryCategory?.name || '未分類',
      categorySlug: primaryCategory?.slug || '',
      price_ntd: salePrice || regularPrice,
      original_price_ntd: regularPrice || salePrice,
      colors: colorSet.size > 0 ? [...colorSet] : ['預設'],
      sizes: sizeSet.size > 0 ? [...sizeSet] : ['Free'],
      short_desc: summary,
      full_description: summary, // richText 需後續轉換
      main_image_url: imageUrl,
      product_url: `/products/${generateSlug(name)}`,
      weight_kg: weight,
      sku: mainSku,
      tags,
      seo_title: seoTitle || name,
      seo_description: seoDescription || summary,
      variants,
      _warnings: productWarnings,
      _errors: productErrors,
      _rowNumbers: rowNums,
    }

    products.push(product)

    // 收集全域錯誤/警告
    productErrors.forEach(msg => errors.push({ row: rowNums[0], message: `${name}: ${msg}` }))
    productWarnings.forEach(msg => warnings.push({ row: rowNums[0], message: `${name}: ${msg}` }))
  }

  return {
    products,
    totalRows: rows.length,
    totalProducts: products.length,
    totalVariants: variantCount,
    errors,
    warnings,
    unmappedCategories: [...unmappedSet],
  }
}

/**
 * 將解析結果轉為匯出用 JSON
 */
export function toExportJSON(products: ParsedProduct[]): string {
  const exportData = products.map(p => ({
    id: p.id,
    category: p.category,
    name: p.name,
    price_ntd: p.price_ntd,
    original_price_ntd: p.original_price_ntd,
    colors: p.colors,
    sizes: p.sizes,
    short_desc: p.short_desc,
    full_description: p.full_description,
    main_image_url: p.main_image_url,
    product_url: p.product_url,
    weight_kg: p.weight_kg,
    sku: p.sku,
    tags: p.tags,
    seo_title: p.seo_title,
    seo_description: p.seo_description,
    variants: p.variants,
  }))
  return JSON.stringify(exportData, null, 2)
}
