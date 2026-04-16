/**
 * Shopline XLSX 解析器（伺服器端）
 * ────────────────────────────────
 * 直接讀取 SHOPLINE 匯出的 BulkUpdateForm .xlsx 檔案，不經過 CSV 轉換。
 * 使用 ExcelJS 在 server-side 解析（前端太大的檔案會卡）。
 *
 * Shopline 檔案格式（約束）：
 *   Row 1: 英文欄位名稱（例如 "Product ID (DO NOT EDIT)"）
 *   Row 2: 繁中欄位說明（例如 "商品編號（切勿更改）"） ← 必須跳過
 *   Row 3 起：實際資料
 *   一個商品可能有多列 — 只有該組第一列填完整 product-level 欄位，
 *   後續列只有 variant-level 欄位。必須以 `Product ID (DO NOT EDIT)` 分組。
 *
 * 關鍵欄位對應（Shopline → 我們的 Products schema）：
 *   Product ID (DO NOT EDIT)          → sourcing.sourceId
 *   Product Name (Traditional Chinese) → name
 *   Product Summary (Traditional Chinese) → shortDescription
 *   SEO Title / Description / Keywords → seo.*
 *   Brand                              → brand
 *   Regular Price                      → price
 *   Sale Price (>0)                    → salePrice
 *   SKU                                → productSku
 *   Weight(KG)                         → weight（× 1000 轉公克）
 *   Supplier                           → sourcing.supplierName
 *   Product Cost                       → sourcing.costTWD
 *   Online Store Status                → status (Y=published, N=draft)
 *   Hidden Product                     → status=archived（優先）
 *   Online Store Categories            → category 映射
 *   Product Tag                        → tags
 *   Preorder Feature                   → allowPreOrder
 *   Preorder Note (Traditional Chinese) → preOrderNote
 *   Variant (Traditional Chinese)      → variants[].{colorName,size}
 *   Variant SKU                        → variants[].sku
 *   Variant Quantity                   → variants[].stock
 *   Variant Price/Sale                 → variants[].priceOverride
 */

import ExcelJS from 'exceljs'
import { mapShoplineCategory } from './categoryMapping'

/* ── Shopline 欄位名稱常數（直接比對 Row 1） ── */
const H = {
  productId: 'Product ID (DO NOT EDIT)',
  nameTC: 'Product Name (Traditional Chinese)',
  summaryTC: 'Product Summary (Traditional Chinese)',
  seoTitleTC: 'SEO Title (Traditional Chinese)',
  seoDescTC: 'SEO Description (Traditional Chinese)',
  seoKeywords: 'SEO Keywords',
  hidden: 'Hidden Product',
  preorder: 'Preorder Feature',
  preorderNoteTC: 'Preorder Note (Traditional Chinese)',
  onlineStatus: 'Online Store Status',
  brand: 'Brand',
  categories: 'Online Store Categories',
  regularPrice: 'Regular Price',
  salePrice: 'Sale Price',
  productCost: 'Product Cost',
  sku: 'SKU',
  quantity: 'Quantity (DO NOT EDIT)',
  weightKg: 'Weight(KG)',
  supplier: 'Supplier',
  productTag: 'Product Tag',
  variantId: 'Variant ID (DO NOT EDIT)',
  variantNameTC: 'Variant (Traditional Chinese) (DO NOT EDIT)',
  variantQuantity: 'Variant Quantity (DO NOT EDIT)',
  variantPrice: 'Variant Price',
  variantSalePrice: 'Variant Sale Price',
  variantSku: 'Variant SKU',
  variantCost: 'Variant Cost',
  variantWeightKg: 'Variant Weight(KG)',
  barcode: 'Barcode',
} as const

export interface ShoplineVariant {
  shoplineVariantId?: string
  colorName: string
  size: string
  sku: string
  stock: number
  priceOverride?: number
  barcode?: string
  note?: string
}

export interface ShoplineProduct {
  // 追溯
  shoplineProductId: string
  rowNumbers: number[]
  // 基本
  name: string
  slug: string
  brand?: string
  productSku?: string
  shortDescription?: string
  price: number
  salePrice?: number
  status: 'draft' | 'published' | 'archived'
  isNew: boolean
  weightGrams?: number
  // 分類
  categorySlug?: string
  categoryName?: string
  tags: string[]
  // 預購
  allowPreOrder: boolean
  preOrderNote?: string
  // 變體
  variants: ShoplineVariant[]
  // 無變體時的總庫存（從 Shopline 的 Quantity (DO NOT EDIT) 欄）
  stock?: number
  // 採購
  sourcing: {
    sourceId: string
    supplierName?: string
    costTWD?: number
  }
  // SEO
  seo: {
    metaTitle?: string
    metaDescription?: string
    keywords?: string
  }
  // 警告/錯誤
  warnings: string[]
  errors: string[]
}

export interface ShoplineParseReport {
  products: ShoplineProduct[]
  totalRows: number
  totalProducts: number
  totalVariants: number
  unmappedCategories: string[]
  globalErrors: string[]
  globalWarnings: string[]
}

/* ════════════════════════════════════════════
 *  小工具
 * ════════════════════════════════════════════ */

function cellText(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number') return String(v)
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>
    // ExcelJS 可能回傳 RichText / HyperlinkValue
    if (typeof obj.text === 'string') return obj.text.trim()
    if (Array.isArray(obj.richText)) {
      return obj.richText.map((r: { text?: string }) => r.text || '').join('').trim()
    }
    if (typeof obj.result === 'string') return obj.result.trim()
  }
  return String(v).trim()
}

function cellNumber(v: unknown): number {
  if (v == null || v === '') return 0
  if (typeof v === 'number') return isFinite(v) ? v : 0
  const n = parseFloat(String(v).replace(/[,$\s]/g, ''))
  return isNaN(n) ? 0 : n
}

function cellBool(v: unknown): boolean {
  const s = cellText(v).toLowerCase()
  return s === 'y' || s === 'yes' || s === 'true' || s === '1'
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^\w\u4e00-\u9fff\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 80) || 'product'
  )
}

/**
 * 解析 Shopline 變體名稱（繁中）
 * 輸入範例：
 *   "黑色 S"              → { color: '黑色', size: 'S' }
 *   "黑色 M"              → { color: '黑色', size: 'M' }
 *   "酒紅"                → { color: '酒紅', size: 'F' }
 *   "米色 (模特兒顏色)"    → { color: '米色', size: 'F', note: '模特兒顏色' }
 *   "黑色 (模特兒顏色) S"  → { color: '黑色', size: 'S', note: '模特兒顏色' }
 *   "Free"                → { color: '', size: 'F' }
 *
 * 規則：
 *   1. 若整個字串是 "Free"/"F"/均碼 → 視為無色 + Free size
 *   2. 先抽出所有 (...) 括號 note 保存，移除括號
 *   3. 清掉多重空白後，若最後一個 token 符合尺寸模式 → 該 token 為 size
 *   4. 剩餘 = colorName
 */
export function parseShoplineVariantName(raw: string): {
  color: string
  size: string
  note?: string
} {
  const input = (raw || '').trim()
  if (!input) return { color: '', size: 'F' }

  // 先抽 (...) 裡的註解
  const notes: string[] = []
  const noNotes = input
    .replace(/[（(]([^）)]*)[）)]/g, (_m, g1: string) => {
      const text = g1.trim()
      if (text) notes.push(text)
      return ' '
    })
    .replace(/\s+/g, ' ')
    .trim()

  const note = notes.length > 0 ? notes.join(' / ') : undefined

  const sizeRegex = /^(XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL|Free|F|均碼|ONE ?SIZE|均一|單一尺寸|\d{2,3})$/i
  const freeOnly = /^(Free|F|均碼|單一尺寸|ONE ?SIZE)$/i

  if (freeOnly.test(noNotes)) {
    return { color: '', size: 'F', note }
  }

  const tokens = noNotes.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return { color: '', size: 'F', note }

  // 最後一個 token 是 size？
  const last = tokens[tokens.length - 1]
  if (sizeRegex.test(last)) {
    return {
      color: tokens.slice(0, -1).join(' ').trim() || '',
      size: last.toUpperCase().replace(/\s+/, ''),
      note,
    }
  }

  // 第一個 token 是 size？
  const first = tokens[0]
  if (sizeRegex.test(first)) {
    return {
      color: tokens.slice(1).join(' ').trim() || '',
      size: first.toUpperCase().replace(/\s+/, ''),
      note,
    }
  }

  // 否則整串都當顏色，尺寸記為 F
  return { color: noNotes, size: 'F', note }
}

/* ════════════════════════════════════════════
 *  主解析函式
 * ════════════════════════════════════════════ */

export async function parseShoplineXlsx(
  buffer: ArrayBuffer | Buffer,
): Promise<ShoplineParseReport> {
  const wb = new ExcelJS.Workbook()
  if (buffer instanceof ArrayBuffer) {
    await wb.xlsx.load(buffer)
  } else {
    // Node Buffer — ExcelJS 接受
    // @ts-expect-error ExcelJS typings are loose for Buffer
    await wb.xlsx.load(buffer)
  }

  const ws = wb.worksheets[0]
  if (!ws) {
    return emptyReport(['檔案中找不到任何工作表'])
  }

  // 建立 header → column index 對應
  const headerRow = ws.getRow(1)
  const colIdx: Record<string, number> = {}
  headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
    const name = cellText(cell.value)
    if (name) colIdx[name] = col
  })

  const idCol = colIdx[H.productId]
  const nameCol = colIdx[H.nameTC]
  if (!idCol || !nameCol) {
    return emptyReport([
      `缺少必要欄位：${!idCol ? H.productId : ''} ${!nameCol ? H.nameTC : ''}`.trim(),
    ])
  }

  const get = (row: ExcelJS.Row, colName: string): unknown => {
    const c = colIdx[colName]
    return c ? row.getCell(c).value : undefined
  }

  /* ── 以 Product ID 分組 ── */
  const groups = new Map<
    string,
    { rows: { row: ExcelJS.Row; rowNum: number }[] }
  >()
  let currentPid = ''
  // 從 Row 3 開始（Row 2 是繁中說明列，跳過）
  const totalRows = ws.rowCount
  for (let r = 3; r <= totalRows; r++) {
    const row = ws.getRow(r)
    const pidCell = cellText(row.getCell(idCol).value)
    // Shopline 變體續行可能沒有 Product ID；仍繼承前一個商品
    if (pidCell) currentPid = pidCell
    if (!currentPid) continue

    if (!groups.has(currentPid)) groups.set(currentPid, { rows: [] })
    groups.get(currentPid)!.rows.push({ row, rowNum: r })
  }

  const products: ShoplineProduct[] = []
  const unmappedSet = new Set<string>()
  let variantCount = 0

  for (const [pid, { rows }] of groups) {
    const head = rows[0].row
    const rowNumbers = rows.map((r) => r.rowNum)
    const warnings: string[] = []
    const errors: string[] = []

    const name = cellText(get(head, H.nameTC))
    if (!name) {
      errors.push('缺少商品名稱 (Traditional Chinese)')
      continue
    }

    const regularPrice = cellNumber(get(head, H.regularPrice))
    const salePriceRaw = cellNumber(get(head, H.salePrice))
    const salePrice = salePriceRaw > 0 ? salePriceRaw : undefined
    if (regularPrice <= 0) errors.push('缺少商品原價（Regular Price）')
    if (salePrice && salePrice >= regularPrice) {
      warnings.push(`特價 ${salePrice} ≥ 原價 ${regularPrice}，已自動忽略特價`)
    }

    const brand = cellText(get(head, H.brand))
    const productSku = cellText(get(head, H.sku))
    const summary = cellText(get(head, H.summaryTC))
    const seoTitle = cellText(get(head, H.seoTitleTC))
    const seoDesc = cellText(get(head, H.seoDescTC))
    const seoKeywords = cellText(get(head, H.seoKeywords))
    const weightKg = cellNumber(get(head, H.weightKg))
    const supplier = cellText(get(head, H.supplier))
    const costTWD = cellNumber(get(head, H.productCost))
    const hidden = cellBool(get(head, H.hidden))
    const online = cellText(get(head, H.onlineStatus)).toUpperCase()
    const categoriesRaw = cellText(get(head, H.categories))
    const tagRaw = cellText(get(head, H.productTag))
    const allowPreOrder = cellBool(get(head, H.preorder))
    const preOrderNote = cellText(get(head, H.preorderNoteTC))

    // Status: hidden > online N/Y
    let status: ShoplineProduct['status']
    if (hidden) status = 'archived'
    else if (online === 'Y') status = 'published'
    else status = 'draft'

    // 分類映射
    const catResult = mapShoplineCategory(categoriesRaw)
    let fallbackCategoryName: string | undefined
    if (!catResult.primaryCategory && categoriesRaw) {
      warnings.push(`無法映射分類: ${categoriesRaw}`)
      catResult.rawCategories.forEach((c) => unmappedSet.add(c))
      // 保留原始字串讓 dry-run 顯示、commit 時 fallback 到「shopline-import」
      fallbackCategoryName = catResult.rawCategories[0] || categoriesRaw
    }

    // Tags：逗號 / 空白 / 換行分隔
    const tags = tagRaw
      .split(/[,，\n\r]+/)
      .map((t) => t.trim())
      .filter(Boolean)
    const isNew = tags.some((t) => /new/i.test(t))

    /* ── 解析所有變體 ── */
    const variants: ShoplineVariant[] = []
    for (const { row } of rows) {
      const vName = cellText(get(row, H.variantNameTC))
      if (!vName) continue

      const { color, size, note } = parseShoplineVariantName(vName)
      const vSku =
        cellText(get(row, H.variantSku)) ||
        cellText(get(row, H.sku)) ||
        `${productSku || slugify(name)}-${slugify(color || 'default')}-${size}`
      const vQtyRaw = cellText(get(row, H.variantQuantity))
      const vStock = Math.max(0, Math.round(cellNumber(vQtyRaw)))
      const vPriceText = cellText(get(row, H.variantPrice))
      const vSaleText = cellText(get(row, H.variantSalePrice))
      // Shopline 常見 "價格一致" 表示 same-as-product
      const samePrice =
        /一致|same/i.test(vPriceText) && /一致|same/i.test(vSaleText)
      const priceOverride = samePrice
        ? undefined
        : (() => {
            const v = cellNumber(get(row, H.variantSalePrice))
            const p = cellNumber(get(row, H.variantPrice))
            const chosen = v > 0 ? v : p > 0 ? p : 0
            return chosen > 0 && chosen !== regularPrice ? chosen : undefined
          })()
      const barcode = cellText(get(row, H.barcode))
      const vid = cellText(get(row, H.variantId))

      variants.push({
        shoplineVariantId: vid || undefined,
        colorName: color,
        size,
        sku: vSku,
        stock: vStock,
        priceOverride,
        barcode: barcode || undefined,
        note,
      })
      variantCount++
    }

    // 若沒變體但有 productSku & quantity → 建一個預設變體（維持單款商品）
    // 注意：我們的 schema 也支援「無變體 + 總庫存」，因此這裡選擇「不強制建變體」
    // 讓 beforeChange hook 使用 data.stock 計算低庫存
    const fallbackStock = cellNumber(get(head, H.quantity))

    const product: ShoplineProduct = {
      shoplineProductId: pid,
      rowNumbers,
      name,
      slug: slugify(name) + '-' + pid.slice(-6),
      brand: brand || 'CHIC KIM & MIU',
      productSku: productSku || undefined,
      shortDescription: summary || undefined,
      price: regularPrice,
      salePrice: salePrice && salePrice < regularPrice ? salePrice : undefined,
      status,
      isNew,
      weightGrams: weightKg > 0 ? Math.round(weightKg * 1000) : undefined,
      categorySlug: catResult.primaryCategory?.slug,
      categoryName: catResult.primaryCategory?.name || fallbackCategoryName,
      tags: Array.from(new Set([...catResult.tags, ...tags])),
      allowPreOrder,
      preOrderNote: preOrderNote || undefined,
      variants,
      stock: variants.length === 0 && fallbackStock > 0 ? Math.round(fallbackStock) : undefined,
      sourcing: {
        sourceId: pid,
        supplierName: supplier || undefined,
        costTWD: costTWD > 0 ? costTWD : undefined,
      },
      seo: {
        metaTitle: seoTitle || undefined,
        metaDescription: seoDesc || summary || undefined,
        keywords: seoKeywords || undefined,
      },
      warnings,
      errors,
    }

    // 如果沒變體而 fallback stock 也缺，補警告
    if (product.variants.length === 0 && fallbackStock <= 0) {
      product.warnings.push('無變體且無總庫存資訊，請手動補齊')
    }

    products.push(product)
  }

  return {
    products,
    totalRows,
    totalProducts: products.length,
    totalVariants: variantCount,
    unmappedCategories: Array.from(unmappedSet),
    globalErrors: [],
    globalWarnings: [],
  }
}

function emptyReport(errors: string[]): ShoplineParseReport {
  return {
    products: [],
    totalRows: 0,
    totalProducts: 0,
    totalVariants: 0,
    unmappedCategories: [],
    globalErrors: errors,
    globalWarnings: [],
  }
}
