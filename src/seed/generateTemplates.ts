/**
 * CHIC KIM & MIU — 批次上傳範本產生器
 * 產生 Excel (.xlsx) 範本供商品與分類批次匯入使用
 *
 * 執行方式：
 *   npx tsx src/seed/generateTemplates.ts
 *
 * 輸出位置：
 *   public/templates/products-upload-template.xlsx
 *   public/templates/categories-upload-template.xlsx
 */

import ExcelJS from 'exceljs'
import path from 'path'
import fs from 'fs'

// ─── 路徑 ────────────────────────────────────────────────────────────────────

const OUTPUT_DIR = path.resolve(process.cwd(), 'public/templates')

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
    console.log(`建立目錄：${OUTPUT_DIR}`)
  }
}

// ─── 品牌色彩常數 ─────────────────────────────────────────────────────────────

const COLORS = {
  gold: 'C19A5B',
  navy: '1a1f36',
  cream: 'FAFAF7',
  white: 'FFFFFF',
  lightGray: 'F2F2F2',
  midGray: 'CCCCCC',
  darkGray: '555555',
  red: 'CC3333',
  green: '2E7D32',
}

// ─── 通用格式設定 ─────────────────────────────────────────────────────────────

function applyHeaderStyle(cell: ExcelJS.Cell, isRequired = false) {
  cell.font = {
    bold: true,
    color: { argb: `FF${COLORS.white}` },
    name: 'Arial',
    size: 11,
  }
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: isRequired ? `FF${COLORS.navy}` : `FF${COLORS.gold}` },
  }
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  cell.border = {
    top: { style: 'thin', color: { argb: `FF${COLORS.gold}` } },
    bottom: { style: 'thin', color: { argb: `FF${COLORS.gold}` } },
    left: { style: 'thin', color: { argb: `FF${COLORS.gold}` } },
    right: { style: 'thin', color: { argb: `FF${COLORS.gold}` } },
  }
}

function applyDataRowStyle(row: ExcelJS.Row, rowIndex: number) {
  const bgColor = rowIndex % 2 === 0 ? `FF${COLORS.cream}` : `FF${COLORS.white}`
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: bgColor },
    }
    cell.font = { name: 'Arial', size: 10, color: { argb: `FF${COLORS.darkGray}` } }
    cell.alignment = { vertical: 'middle', wrapText: true }
    cell.border = {
      top: { style: 'hair', color: { argb: `FF${COLORS.midGray}` } },
      bottom: { style: 'hair', color: { argb: `FF${COLORS.midGray}` } },
      left: { style: 'hair', color: { argb: `FF${COLORS.midGray}` } },
      right: { style: 'hair', color: { argb: `FF${COLORS.midGray}` } },
    }
  })
}

function applyTitleRow(sheet: ExcelJS.Worksheet, title: string, colCount: number) {
  sheet.spliceRows(1, 0, [])
  const titleRow = sheet.getRow(1)
  titleRow.height = 36
  const titleCell = titleRow.getCell(1)
  titleCell.value = title
  titleCell.font = {
    bold: true,
    size: 14,
    color: { argb: `FF${COLORS.white}` },
    name: 'Arial',
  }
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: `FF${COLORS.navy}` },
  }
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.mergeCells(1, 1, 1, colCount)
}

// ─── 分類代碼參考資料 ──────────────────────────────────────────────────────────

const CATEGORY_REFS: { slug: string; name: string; parent?: string }[] = [
  { slug: 'dresses', name: '洋裝' },
  { slug: 'tops', name: '上衣' },
  { slug: 'bottoms', name: '褲裙' },
  { slug: 'outerwear', name: '外套' },
  { slug: 'accessories', name: '配件' },
  { slug: 'bags', name: '包包' },
  { slug: 'shoes', name: '鞋履' },
  { slug: 'formal-dresses', name: '正式洋裝', parent: 'dresses' },
  { slug: 'casual-dresses', name: '休閒洋裝', parent: 'dresses' },
  { slug: 'midi-dresses', name: '中長洋裝', parent: 'dresses' },
  { slug: 'maxi-dresses', name: '長洋裝', parent: 'dresses' },
  { slug: 'mini-dresses', name: '短洋裝', parent: 'dresses' },
  { slug: 'blouses', name: '女性上衣/雪紡', parent: 'tops' },
  { slug: 'knit-tops', name: '針織上衣', parent: 'tops' },
  { slug: 't-shirts', name: 'T恤', parent: 'tops' },
  { slug: 'skirts', name: '裙子', parent: 'bottoms' },
  { slug: 'pants', name: '褲子', parent: 'bottoms' },
  { slug: 'shorts', name: '短褲', parent: 'bottoms' },
  { slug: 'blazers', name: '西裝外套', parent: 'outerwear' },
  { slug: 'cardigans', name: '針織外套', parent: 'outerwear' },
  { slug: 'coats', name: '大衣', parent: 'outerwear' },
]

const COLLECTION_TAG_REFS: { value: string; label: string }[] = [
  { value: 'jin-live', label: '金老佛爺 Live' },
  { value: 'jin-style', label: '金金同款專區' },
  { value: 'host-style', label: '主播同款專區' },
  { value: 'brand-custom', label: '品牌自訂款' },
  { value: 'formal-dresses', label: '婚禮洋裝/正式洋裝' },
  { value: 'rush', label: '現貨速到 Rush' },
  { value: 'celebrity-style', label: '藝人穿搭' },
]

// ─── 商品範本範例資料 ──────────────────────────────────────────────────────────

const PRODUCT_EXAMPLES = [
  {
    name: '優雅法式蕾絲洋裝',
    slug: 'elegant-lace-dress',
    categorySlug: 'formal-dresses',
    price: 2980,
    salePrice: 2480,
    stock: 0,
    status: 'published',
    isNew: 'yes',
    isHot: 'yes',
    weight: 280,
    collectionTags: 'formal-dresses,jin-style',
    tags: '蕾絲,法式,優雅,婚禮',
    variants: JSON.stringify([
      { colorName: '黑色', colorCode: '#000000', size: 'S', sku: 'ELD-BLK-S', stock: 5 },
      { colorName: '黑色', colorCode: '#000000', size: 'M', sku: 'ELD-BLK-M', stock: 8 },
      { colorName: '白色', colorCode: '#FFFFFF', size: 'M', sku: 'ELD-WHT-M', stock: 3 },
      { colorName: '白色', colorCode: '#FFFFFF', size: 'L', sku: 'ELD-WHT-L', stock: 2 },
    ]),
    images: 'elegant-lace-dress-black-01.jpg,elegant-lace-dress-black-02.jpg,elegant-lace-dress-white-01.jpg',
  },
  {
    name: '韓系針織修身上衣',
    slug: 'korean-knit-slim-top',
    categorySlug: 'knit-tops',
    price: 1280,
    salePrice: '',
    stock: 30,
    status: 'published',
    isNew: 'no',
    isHot: 'yes',
    weight: 150,
    collectionTags: 'host-style',
    tags: '針織,韓系,修身,百搭',
    variants: '',
    images: 'korean-knit-slim-top-camel-01.jpg,korean-knit-slim-top-camel-02.jpg',
  },
  {
    name: '氣質高腰A字裙（預購款）',
    slug: 'elegant-high-waist-skirt',
    categorySlug: 'skirts',
    price: 1580,
    salePrice: '',
    stock: 0,
    status: 'draft',
    isNew: 'yes',
    isHot: 'no',
    weight: 200,
    collectionTags: 'jin-live,brand-custom',
    tags: '高腰,A字裙,氣質,預購',
    variants: JSON.stringify([
      { colorName: '卡其色', colorCode: '#C3A882', size: 'S', sku: 'EHWS-KHK-S', stock: 0 },
      { colorName: '卡其色', colorCode: '#C3A882', size: 'M', sku: 'EHWS-KHK-M', stock: 0 },
      { colorName: '深藍', colorCode: '#1a1f36', size: 'M', sku: 'EHWS-NVY-M', stock: 0 },
    ]),
    images: 'elegant-high-waist-skirt-khaki-01.jpg,elegant-high-waist-skirt-navy-01.jpg',
  },
]

// ─── 產生商品上傳範本 ─────────────────────────────────────────────────────────

async function generateProductsTemplate() {
  const workbook = new ExcelJS.Workbook()

  workbook.creator = 'CHIC KIM & MIU'
  workbook.lastModifiedBy = 'CHIC KIM & MIU System'
  workbook.created = new Date()
  workbook.modified = new Date()

  // ── 工作表 1：商品資料 ───────────────────────────────────────────────────────

  const dataSheet = workbook.addWorksheet('商品資料', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }],
    pageSetup: { orientation: 'landscape', fitToPage: true },
  })

  const columns: {
    header: string
    key: string
    width: number
    required: boolean
    note?: string
  }[] = [
    { header: '商品名稱 *', key: 'name', width: 28, required: true, note: '必填' },
    { header: '網址代碼 *', key: 'slug', width: 28, required: true, note: '必填，英文小寫加連字號' },
    { header: '分類代碼 *', key: 'categorySlug', width: 22, required: true, note: '必填，見「說明」工作表' },
    { header: '原價 *', key: 'price', width: 12, required: true, note: '必填，整數' },
    { header: '特價', key: 'salePrice', width: 12, required: false, note: '選填，空白表示無特價' },
    { header: '庫存', key: 'stock', width: 10, required: false, note: '有變體時此欄不計' },
    { header: '狀態', key: 'status', width: 14, required: false, note: 'published / draft / archived' },
    { header: '新品', key: 'isNew', width: 8, required: false, note: 'yes / no' },
    { header: '熱銷', key: 'isHot', width: 8, required: false, note: 'yes / no' },
    { header: '重量g', key: 'weight', width: 10, required: false, note: '公克，整數' },
    { header: '主題標籤', key: 'collectionTags', width: 32, required: false, note: '以逗號分隔，見「說明」工作表' },
    { header: '商品標籤', key: 'tags', width: 32, required: false, note: '以逗號分隔' },
    { header: '變體JSON', key: 'variants', width: 52, required: false, note: 'JSON 字串，見「說明」工作表' },
    { header: '圖片檔名', key: 'images', width: 52, required: false, note: '以逗號分隔，見命名規則' },
  ]

  // 設定欄寬
  dataSheet.columns = columns.map((c) => ({ key: c.key, width: c.width }))

  // 標題列（第 1 列：品牌大標）
  applyTitleRow(dataSheet, 'CHIC KIM & MIU — 商品批次上傳範本', columns.length)

  // 欄位標頭（第 2 列）
  const headerRow = dataSheet.addRow(columns.map((c) => c.header))
  headerRow.height = 28
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1)
    applyHeaderStyle(cell, col.required)
  })

  // 範例資料（第 3–5 列）
  PRODUCT_EXAMPLES.forEach((example, i) => {
    const row = dataSheet.addRow([
      example.name,
      example.slug,
      example.categorySlug,
      example.price,
      example.salePrice,
      example.stock,
      example.status,
      example.isNew,
      example.isHot,
      example.weight,
      example.collectionTags,
      example.tags,
      example.variants,
      example.images,
    ])
    row.height = 22
    applyDataRowStyle(row, i)

    // 數字格式
    row.getCell(4).numFmt = '#,##0'
    if (example.salePrice) row.getCell(5).numFmt = '#,##0'
    row.getCell(6).numFmt = '#,##0'
  })

  // 欄位附註（第 6 列）
  const noteRow = dataSheet.addRow(columns.map((c) => c.note ?? ''))
  noteRow.height = 18
  noteRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { italic: true, size: 9, color: { argb: `FF${COLORS.gold}` }, name: 'Arial' }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${COLORS.navy}` },
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  })

  // ── 工作表 2：說明 ────────────────────────────────────────────────────────────

  const infoSheet = workbook.addWorksheet('說明')
  infoSheet.columns = [
    { key: 'section', width: 22 },
    { key: 'col', width: 22 },
    { key: 'desc', width: 52 },
    { key: 'values', width: 62 },
  ]

  function addInfoTitle(text: string) {
    const row = infoSheet.addRow([text, '', '', ''])
    row.height = 28
    const cell = row.getCell(1)
    cell.value = text
    cell.font = { bold: true, size: 12, color: { argb: `FF${COLORS.white}` }, name: 'Arial' }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.navy}` } }
    infoSheet.mergeCells(row.number, 1, row.number, 4)
  }

  function addInfoHeader() {
    const row = infoSheet.addRow(['區塊', '欄位名稱', '說明', '有效值 / 範例'])
    row.height = 22
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.font = { bold: true, color: { argb: `FF${COLORS.white}` }, name: 'Arial', size: 10 }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.gold}` } }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
    })
  }

  function addInfoRow(section: string, col: string, desc: string, values: string, highlight = false) {
    const row = infoSheet.addRow([section, col, desc, values])
    row.height = 18
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: 'Arial', size: 9, color: { argb: `FF${COLORS.darkGray}` } }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: highlight ? `FFFFF9F0` : `FF${COLORS.white}` },
      }
      cell.alignment = { vertical: 'middle', wrapText: true }
      cell.border = {
        bottom: { style: 'hair', color: { argb: `FF${COLORS.midGray}` } },
        right: { style: 'hair', color: { argb: `FF${COLORS.midGray}` } },
      }
    })
  }

  // 頂部大標
  applyTitleRow(infoSheet, 'CHIC KIM & MIU — 商品上傳說明文件', 4)

  // ─ 欄位說明
  addInfoTitle('▌ 欄位說明')
  addInfoHeader()
  addInfoRow('基本資料', '商品名稱 *', '必填。商品的完整中文名稱。', '優雅法式蕾絲洋裝')
  addInfoRow('基本資料', '網址代碼 *', '必填。英文小寫加連字號，全站唯一。', 'elegant-lace-dress')
  addInfoRow('基本資料', '分類代碼 *', '必填。對應下方「分類代碼參考表」中的 slug。', 'formal-dresses')
  addInfoRow('價格', '原價 *', '必填。新台幣整數。', '2980')
  addInfoRow('價格', '特價', '選填。有特價時填入，空白表示無特價。', '2480（空白 = 無特價）')
  addInfoRow('庫存', '庫存', '若有設定「變體JSON」則此欄不計，以各變體庫存為準。', '30（整數）')
  addInfoRow('狀態', '狀態', '上架狀態。', 'published（上架）/ draft（草稿）/ archived（下架）')
  addInfoRow('標記', '新品', '是否顯示「NEW」標籤。', 'yes / no')
  addInfoRow('標記', '熱銷', '是否顯示「HOT」標籤。', 'yes / no')
  addInfoRow('物流', '重量g', '商品重量，公克為單位，用於計算運費。', '280（整數）')
  addInfoRow('分類', '主題標籤', '主題專區標籤，多個用逗號分隔，不可有空格。', 'formal-dresses,jin-style', true)
  addInfoRow('分類', '商品標籤', '商品關鍵字標籤，用於搜尋篩選，以逗號分隔。', '蕾絲,法式,優雅')
  addInfoRow('變體', '變體JSON', '請見下方「變體 JSON 格式」說明。', '（JSON 字串）', true)
  addInfoRow('圖片', '圖片檔名', '請見下方「圖片命名規則」說明。', '（以逗號分隔的檔名）', true)

  infoSheet.addRow([])

  // ─ 主題標籤參考
  addInfoTitle('▌ 主題標籤（collectionTags）參考值')
  const ctHeaderRow = infoSheet.addRow(['代碼（value）', '顯示名稱', '', ''])
  ctHeaderRow.height = 20
  ctHeaderRow.eachCell({ includeEmpty: false }, (cell) => {
    cell.font = { bold: true, color: { argb: `FF${COLORS.white}` }, name: 'Arial', size: 10 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.gold}` } }
  })
  COLLECTION_TAG_REFS.forEach((tag) => {
    const row = infoSheet.addRow([tag.value, tag.label, '', ''])
    row.height = 18
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: 'Arial', size: 9 }
      cell.border = { bottom: { style: 'hair', color: { argb: `FF${COLORS.midGray}` } } }
    })
  })

  infoSheet.addRow([])

  // ─ 分類代碼參考
  addInfoTitle('▌ 分類代碼（categorySlug）參考表')
  const catHeaderRow = infoSheet.addRow(['分類代碼（slug）', '分類名稱', '上層分類（parent）', ''])
  catHeaderRow.height = 20
  catHeaderRow.eachCell({ includeEmpty: false }, (cell) => {
    cell.font = { bold: true, color: { argb: `FF${COLORS.white}` }, name: 'Arial', size: 10 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.gold}` } }
  })
  CATEGORY_REFS.forEach((cat) => {
    const row = infoSheet.addRow([cat.slug, cat.name, cat.parent ?? '（頂層分類）', ''])
    row.height = 18
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.font = {
        name: 'Arial',
        size: 9,
        bold: !cat.parent && colNum === 1,
        color: { argb: cat.parent ? `FF${COLORS.darkGray}` : `FF${COLORS.navy}` },
      }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: cat.parent ? `FF${COLORS.white}` : `FFFFF9F0` },
      }
      cell.border = { bottom: { style: 'hair', color: { argb: `FF${COLORS.midGray}` } } }
    })
  })

  infoSheet.addRow([])

  // ─ 圖片命名規則
  addInfoTitle('▌ 圖片命名規則')
  const imgRules = [
    ['格式', '{slug}-{顏色英文}-{序號}.jpg', '例：elegant-lace-dress-black-01.jpg'],
    ['顏色英文', '使用顏色的英文名稱（小寫）', 'black / white / camel / navy / pink / red'],
    ['序號', '2 位數字，從 01 開始', '01, 02, 03 ...'],
    ['主圖', '第一張圖 (-01.jpg) 為商品主圖', ''],
    ['格式限制', '僅支援 .jpg / .png / .webp', ''],
    ['尺寸建議', '正方形 1:1，最小 800×800px，最大 2000×2000px', ''],
    ['多圖以逗號分隔', '不可有空格', 'dress-black-01.jpg,dress-black-02.jpg,dress-white-01.jpg'],
  ]
  imgRules.forEach(([label, rule, example]) => {
    const row = infoSheet.addRow([label, rule, example, ''])
    row.height = 18
    row.getCell(1).font = { bold: true, name: 'Arial', size: 9, color: { argb: `FF${COLORS.navy}` } }
    row.getCell(2).font = { name: 'Arial', size: 9 }
    row.getCell(3).font = { italic: true, name: 'Arial', size: 9, color: { argb: `FF${COLORS.gold}` } }
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = { bottom: { style: 'hair', color: { argb: `FF${COLORS.midGray}` } } }
    })
  })

  infoSheet.addRow([])

  // ─ 變體 JSON 格式
  addInfoTitle('▌ 變體 JSON 格式說明')
  const variantExample = JSON.stringify(
    [
      { colorName: '黑色', colorCode: '#000000', size: 'S', sku: 'ELD-BLK-S', stock: 5 },
      { colorName: '黑色', colorCode: '#000000', size: 'M', sku: 'ELD-BLK-M', stock: 8 },
      { colorName: '白色', colorCode: '#FFFFFF', size: 'M', sku: 'ELD-WHT-M', stock: 3 },
      { colorName: '白色', colorCode: '#FFFFFF', size: 'L', sku: 'ELD-WHT-L', stock: 2 },
    ],
    null,
    2,
  )
  const variantFields = [
    ['colorName', 'string', '必填', '顏色中文名稱，例：黑色、白色、卡其色'],
    ['colorCode', 'string', '選填', 'HEX 色碼，例：#000000（前台色票顯示用）'],
    ['size', 'string', '必填', '尺寸，例：S / M / L / XL / XXL'],
    ['sku', 'string', '必填', '倉儲編號，全站唯一，例：ELD-BLK-S'],
    ['stock', 'number', '必填', '此變體庫存數量，整數'],
    ['priceOverride', 'number', '選填', '若此變體有不同售價，填入台幣整數'],
  ]
  const vfHeader = infoSheet.addRow(['欄位', '型別', '是否必填', '說明'])
  vfHeader.height = 20
  vfHeader.eachCell({ includeEmpty: false }, (cell) => {
    cell.font = { bold: true, color: { argb: `FF${COLORS.white}` }, name: 'Arial', size: 10 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.gold}` } }
  })
  variantFields.forEach(([field, type, req, desc]) => {
    const row = infoSheet.addRow([field, type, req, desc])
    row.height = 18
    row.getCell(1).font = { bold: true, name: 'Courier New', size: 9, color: { argb: `FF${COLORS.navy}` } }
    row.getCell(3).font = {
      bold: true,
      name: 'Arial',
      size: 9,
      color: { argb: req === '必填' ? `FF${COLORS.red}` : `FF${COLORS.green}` },
    }
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = { bottom: { style: 'hair', color: { argb: `FF${COLORS.midGray}` } } }
    })
  })

  infoSheet.addRow([])
  const exRow = infoSheet.addRow(['JSON 範例：', variantExample, '', ''])
  exRow.height = 120
  exRow.getCell(1).font = { bold: true, name: 'Arial', size: 9, color: { argb: `FF${COLORS.navy}` } }
  exRow.getCell(2).font = { name: 'Courier New', size: 8, color: { argb: `FF${COLORS.darkGray}` } }
  exRow.getCell(2).alignment = { vertical: 'top', wrapText: true }

  // ─ 儲存
  const outPath = path.join(OUTPUT_DIR, 'products-upload-template.xlsx')
  await workbook.xlsx.writeFile(outPath)
  console.log(`✓ 商品範本已產生：${outPath}`)
}

// ─── 產生分類上傳範本 ─────────────────────────────────────────────────────────

async function generateCategoriesTemplate() {
  const workbook = new ExcelJS.Workbook()

  workbook.creator = 'CHIC KIM & MIU'
  workbook.created = new Date()
  workbook.modified = new Date()

  // ── 工作表 1：分類資料 ───────────────────────────────────────────────────────

  const dataSheet = workbook.addWorksheet('分類資料', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }],
  })

  const columns: { header: string; key: string; width: number; required: boolean; note: string }[] = [
    { header: '分類名稱 *', key: 'name', width: 22, required: true, note: '必填' },
    { header: '網址代碼 *', key: 'slug', width: 22, required: true, note: '必填，英文小寫加連字號，全站唯一' },
    { header: '分類說明', key: 'description', width: 40, required: false, note: '選填，顯示在分類頁上方' },
    {
      header: '上層分類代碼',
      key: 'parent',
      width: 22,
      required: false,
      note: '選填，填入父分類的 slug；留空為頂層分類',
    },
    { header: '圖片檔名', key: 'image', width: 32, required: false, note: '選填，單一圖片檔名' },
  ]

  dataSheet.columns = columns.map((c) => ({ key: c.key, width: c.width }))

  applyTitleRow(dataSheet, 'CHIC KIM & MIU — 分類批次上傳範本', columns.length)

  const headerRow = dataSheet.addRow(columns.map((c) => c.header))
  headerRow.height = 28
  columns.forEach((col, i) => {
    applyHeaderStyle(headerRow.getCell(i + 1), col.required)
  })

  // 現有分類作為範例資料
  const catExamples = [
    { name: '洋裝', slug: 'dresses', description: '各式洋裝，從日常到正式場合', parent: '', image: 'category-dresses.jpg' },
    { name: '正式洋裝', slug: 'formal-dresses', description: '婚禮、宴會、正式場合適用', parent: 'dresses', image: 'category-formal-dresses.jpg' },
    { name: '上衣', slug: 'tops', description: '女性上衣系列', parent: '', image: 'category-tops.jpg' },
    { name: '針織上衣', slug: 'knit-tops', description: '舒適百搭針織上衣', parent: 'tops', image: '' },
    { name: '外套', slug: 'outerwear', description: '輕薄到厚重各式外套', parent: '', image: 'category-outerwear.jpg' },
  ]

  catExamples.forEach((ex, i) => {
    const row = dataSheet.addRow([ex.name, ex.slug, ex.description, ex.parent, ex.image])
    row.height = 22
    applyDataRowStyle(row, i)
  })

  const noteRow = dataSheet.addRow(columns.map((c) => c.note))
  noteRow.height = 18
  noteRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { italic: true, size: 9, color: { argb: `FF${COLORS.gold}` }, name: 'Arial' }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.navy}` } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  })

  // ── 工作表 2：說明 ────────────────────────────────────────────────────────────

  const infoSheet = workbook.addWorksheet('說明')
  infoSheet.columns = [
    { key: 'col', width: 22 },
    { key: 'required', width: 12 },
    { key: 'desc', width: 52 },
    { key: 'example', width: 32 },
  ]

  applyTitleRow(infoSheet, 'CHIC KIM & MIU — 分類上傳說明', 4)

  const headerInfoRow = infoSheet.addRow(['欄位名稱', '是否必填', '說明', '範例'])
  headerInfoRow.height = 22
  headerInfoRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { bold: true, color: { argb: `FF${COLORS.white}` }, name: 'Arial', size: 10 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.gold}` } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })

  const fieldDocs = [
    ['分類名稱', '必填', '分類的顯示名稱，建議簡短易懂', '洋裝 / 上衣 / 外套'],
    ['網址代碼', '必填', '英文小寫加連字號，全站唯一，用於 URL', 'dresses / formal-dresses / knit-tops'],
    ['分類說明', '選填', '顯示在分類頁的文字說明', '各式洋裝，從日常到正式場合'],
    ['上層分類代碼', '選填', '子分類須填入父分類的 slug，頂層分類留空', 'dresses（表示此分類在洋裝之下）'],
    ['圖片檔名', '選填', '分類封面圖片，命名規則：category-{slug}.jpg', 'category-dresses.jpg'],
  ]

  fieldDocs.forEach(([col, req, desc, example], i) => {
    const row = infoSheet.addRow([col, req, desc, example])
    row.height = 22
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: 'Arial', size: 9, color: { argb: `FF${COLORS.darkGray}` } }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: i % 2 === 0 ? `FF${COLORS.cream}` : `FF${COLORS.white}` },
      }
      cell.alignment = { vertical: 'middle', wrapText: true }
      cell.border = { bottom: { style: 'hair', color: { argb: `FF${COLORS.midGray}` } } }
    })
    row.getCell(2).font = {
      bold: true,
      name: 'Arial',
      size: 9,
      color: { argb: req === '必填' ? `FF${COLORS.red}` : `FF${COLORS.green}` },
    }
  })

  infoSheet.addRow([])

  const notesTitleRow = infoSheet.addRow(['注意事項', '', '', ''])
  notesTitleRow.height = 26
  notesTitleRow.getCell(1).value = '▌ 注意事項'
  notesTitleRow.getCell(1).font = { bold: true, size: 11, color: { argb: `FF${COLORS.white}` }, name: 'Arial' }
  notesTitleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.navy}` } }
  infoSheet.mergeCells(notesTitleRow.number, 1, notesTitleRow.number, 4)

  const notes = [
    '匯入時若 slug 已存在，系統會更新該分類資料（不新增重複）。',
    '上層分類代碼（parent）必須比子分類先匯入，或已存在於資料庫中。',
    '圖片需先上傳至 Media 庫，此欄填入檔名後由系統自動關聯。',
    '建議先匯入分類範本，再匯入商品範本（商品需關聯已存在的分類）。',
  ]
  notes.forEach((note, i) => {
    const row = infoSheet.addRow([`${i + 1}. ${note}`, '', '', ''])
    row.height = 20
    infoSheet.mergeCells(row.number, 1, row.number, 4)
    row.getCell(1).font = { name: 'Arial', size: 9, color: { argb: `FF${COLORS.darkGray}` } }
    row.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: i % 2 === 0 ? `FF${COLORS.cream}` : `FF${COLORS.white}` },
    }
    row.getCell(1).alignment = { vertical: 'middle', wrapText: true }
  })

  const outPath = path.join(OUTPUT_DIR, 'categories-upload-template.xlsx')
  await workbook.xlsx.writeFile(outPath)
  console.log(`✓ 分類範本已產生：${outPath}`)
}

// ─── 主程式 ───────────────────────────────────────────────────────────────────

export async function generateTemplates() {
  console.log('CHIC KIM & MIU — 批次上傳範本產生器')
  console.log('='.repeat(50))

  ensureOutputDir()

  await generateProductsTemplate()
  await generateCategoriesTemplate()

  console.log('='.repeat(50))
  console.log(`完成！範本已輸出至：${OUTPUT_DIR}`)
  console.log('  - products-upload-template.xlsx')
  console.log('  - categories-upload-template.xlsx')
}

// 直接執行時
const isMain = process.argv[1]?.replace(/\\/g, '/').includes('generateTemplates')
if (isMain) {
  generateTemplates().catch((err) => {
    console.error('產生範本時發生錯誤：', err)
    process.exit(1)
  })
}
