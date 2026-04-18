import type { PayloadRequest } from 'payload'
import ExcelJS from 'exceljs'

/**
 * CSV / Excel 匯入匯出 — 通用 endpoint 工廠
 * ------------------------------------------
 * 在各 Collection 的 endpoints 陣列中使用：
 *   endpoints: [
 *     createExportEndpoint('products', productFieldMappings),
 *     createImportEndpoint('products', productFieldMappings),
 *   ]
 *
 * 匯出網址：GET  /api/{collection}/export?format=csv|xlsx
 * 匯入網址：POST /api/{collection}/import  (multipart/form-data, field: file)
 */

export type FieldMapping = {
  key: string   // Payload 欄位名稱（支援 dot notation，例如 'seo.metaTitle'）
  label: string // CSV/Excel 欄位標頭（繁體中文）
}

/* ================================================================
   匯出 Endpoint
   ================================================================ */
export function createExportEndpoint(collectionSlug: string, fieldMappings: FieldMapping[]) {
  return {
    path: '/export',
    method: 'get' as const,
    handler: async (req: PayloadRequest) => {
      // 權限：僅 Admin
      if (!req.user || (req.user as unknown as Record<string, unknown>).role !== 'admin') {
        return Response.json({ error: '權限不足' }, { status: 403 })
      }

      const url = new URL(req.url || '', 'http://localhost')
      const format = url.searchParams.get('format') || 'csv'

      // 查詢所有資料
      const { docs } = await req.payload.find({
        collection: collectionSlug as 'users',
        limit: 0,
        pagination: false,
      })

      if (format === 'xlsx') {
        return exportXLSX(collectionSlug, docs as unknown as Record<string, unknown>[], fieldMappings)
      }
      return exportCSV(collectionSlug, docs as unknown as Record<string, unknown>[], fieldMappings)
    },
  }
}

/* ================================================================
   匯入 Endpoint
   ================================================================ */
export function createImportEndpoint(collectionSlug: string, fieldMappings: FieldMapping[]) {
  return {
    path: '/import',
    method: 'post' as const,
    handler: async (req: PayloadRequest) => {
      if (!req.user || (req.user as unknown as Record<string, unknown>).role !== 'admin') {
        return Response.json({ error: '權限不足' }, { status: 403 })
      }

      try {
        // 從 FormData 取得檔案
        const formData = await (req as unknown as Request).formData()
        const file = formData.get('file') as File | null
        if (!file) {
          return Response.json({ error: '請上傳檔案' }, { status: 400 })
        }

        const buffer = Buffer.from(await file.arrayBuffer())
        let rows: Record<string, unknown>[]

        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          rows = await parseXLSX(buffer, fieldMappings)
        } else {
          const text = new TextDecoder('utf-8').decode(buffer)
          rows = parseCSVToRows(text, fieldMappings)
        }

        if (rows.length === 0) {
          return Response.json({ error: '檔案為空或格式不正確' }, { status: 400 })
        }

        let created = 0
        let updated = 0
        const errors: string[] = []

        // 用 slug（商品）或 email（會員）作為唯一識別欄位
        const idField = collectionSlug === 'users' ? 'email' : 'slug'

        // 會員匯入（例如 Shopline 搬家）：新增的會員直接標 `_verified:true`
        // + `disableVerificationEmail:true`，不走 Payload 驗證信流程——一次匯入
        // 幾百筆會把 Resend 額度燒完、觸發發信量/投訴率鎖帳戶，且這些都是舊系統
        // 已驗證過的有效會員，不該再被當新註冊處理。
        // 現有會員 update 不動 `_verified`（保留舊狀態）。
        const isUsers = collectionSlug === 'users'

        for (let i = 0; i < rows.length; i++) {
          const data = rows[i]
          try {
            const idValue = data[idField] as string | undefined

            if (idValue) {
              const existing = await req.payload.find({
                collection: collectionSlug as 'users',
                where: { [idField]: { equals: idValue } },
                limit: 1,
              })

              if (existing.docs.length > 0) {
                await req.payload.update({
                  collection: collectionSlug as 'users',
                  id: existing.docs[0].id,
                  data,
                })
                updated++
              } else {
                await (req.payload.create as Function)({
                  collection: collectionSlug,
                  data: isUsers ? { ...data, _verified: true } : data,
                  ...(isUsers ? { disableVerificationEmail: true } : {}),
                })
                created++
              }
            } else {
              await (req.payload.create as Function)({
                collection: collectionSlug,
                data: isUsers ? { ...data, _verified: true } : data,
                ...(isUsers ? { disableVerificationEmail: true } : {}),
              })
              created++
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err)
            errors.push(`第 ${i + 2} 列：${msg}`)
          }
        }

        return Response.json({
          success: true,
          created,
          updated,
          errors,
          message: `匯入完成：${created} 筆新增、${updated} 筆更新${errors.length ? `、${errors.length} 筆錯誤` : ''}`,
        })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        return Response.json({ error: `匯入失敗：${msg}` }, { status: 500 })
      }
    },
  }
}

/* ================================================================
   CSV 工具
   ================================================================ */

function exportCSV(
  collectionSlug: string,
  docs: Record<string, unknown>[],
  fieldMappings: FieldMapping[],
): Response {
  const headers = fieldMappings.map((f) => escapeCSVField(f.label))
  const dataRows = docs.map((doc) =>
    fieldMappings.map((f) => {
      const value = getNestedValue(doc, f.key)
      if (value === null || value === undefined) return ''
      if (typeof value === 'object') return escapeCSVField(JSON.stringify(value))
      return escapeCSVField(String(value))
    }),
  )

  const csv = [headers.join(','), ...dataRows.map((r) => r.join(','))].join('\r\n')

  // 加上 BOM 讓 Excel 正確辨識 UTF-8
  const bom = '\uFEFF'
  return new Response(bom + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${collectionSlug}-export.csv"`,
    },
  })
}

function parseCSVToRows(text: string, fieldMappings: FieldMapping[]): Record<string, unknown>[] {
  const lines = parseCSVLines(text)
  if (lines.length < 2) return []

  // 標頭 → key 對應
  const labelToKey: Record<string, string> = {}
  fieldMappings.forEach((fm) => {
    labelToKey[fm.label] = fm.key
  })

  const headerLine = lines[0]
  const colKeyMap: (string | null)[] = headerLine.map((h) => labelToKey[h.trim()] || null)

  const rows: Record<string, unknown>[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (line.every((v) => !v.trim())) continue // 跳過空列

    const data: Record<string, unknown> = {}
    for (let c = 0; c < colKeyMap.length; c++) {
      const key = colKeyMap[c]
      if (!key) continue
      let value: unknown = line[c] ?? ''
      if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
        try {
          value = JSON.parse(value)
        } catch {
          /* keep string */
        }
      }
      data[key] = value
    }
    rows.push(data)
  }

  return rows
}

/** 解析 CSV 文字為二維字串陣列（處理引號、逗號、換行） */
function parseCSVLines(text: string): string[][] {
  const rows: string[][] = []
  let current = ''
  let inQuotes = false
  let row: string[] = []

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        row.push(current)
        current = ''
      } else if (char === '\n' || (char === '\r' && next === '\n')) {
        row.push(current)
        current = ''
        rows.push(row)
        row = []
        if (char === '\r') i++
      } else if (char === '\r') {
        row.push(current)
        current = ''
        rows.push(row)
        row = []
      } else {
        current += char
      }
    }
  }

  if (current || row.length > 0) {
    row.push(current)
    rows.push(row)
  }

  return rows
}

function escapeCSVField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/* ================================================================
   Excel (XLSX) 工具
   ================================================================ */

async function exportXLSX(
  collectionSlug: string,
  docs: Record<string, unknown>[],
  fieldMappings: FieldMapping[],
): Promise<Response> {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(collectionSlug)

  worksheet.columns = fieldMappings.map((f) => ({
    header: f.label,
    key: f.key,
    width: 22,
  }))

  for (const doc of docs) {
    const row: Record<string, unknown> = {}
    for (const field of fieldMappings) {
      const value = getNestedValue(doc, field.key)
      row[field.key] = typeof value === 'object' && value !== null ? JSON.stringify(value) : value
    }
    worksheet.addRow(row)
  }

  // 美化標頭列
  const headerRow = worksheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF5F0E8' }, // 品牌米白色
  }

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer())
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${collectionSlug}-export.xlsx"`,
    },
  })
}

async function parseXLSX(
  buffer: Buffer,
  fieldMappings: FieldMapping[],
): Promise<Record<string, unknown>[]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer)

  const worksheet = workbook.worksheets[0]
  if (!worksheet || worksheet.rowCount < 2) return []

  const labelToKey: Record<string, string> = {}
  fieldMappings.forEach((fm) => {
    labelToKey[fm.label] = fm.key
  })

  const headerRow = worksheet.getRow(1)
  const colKeyMap: Record<number, string> = {}
  headerRow.eachCell((cell, colNumber) => {
    const label = String(cell.value || '').trim()
    if (labelToKey[label]) {
      colKeyMap[colNumber] = labelToKey[label]
    }
  })

  const rows: Record<string, unknown>[] = []

  for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
    const row = worksheet.getRow(rowNum)
    const data: Record<string, unknown> = {}

    for (const [colStr, key] of Object.entries(colKeyMap)) {
      let value: unknown = row.getCell(Number(colStr)).value
      if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
        try {
          value = JSON.parse(value)
        } catch {
          /* keep string */
        }
      }
      data[key] = value
    }

    if (Object.values(data).every((v) => v === null || v === undefined || v === '')) continue
    rows.push(data)
  }

  return rows
}

/* ================================================================
   工具
   ================================================================ */

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as unknown as Record<string, unknown>)) {
      return (acc as unknown as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}
