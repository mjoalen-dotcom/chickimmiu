import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { generateInvoicePdf } from '@/lib/invoice/invoicePdfGenerator'

/**
 * 發票 PDF 下載 API
 * ─────────────────────────────
 * GET /api/invoices/:id/pdf — 下載發票 PDF（HTML 格式，可列印）
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const payload = await getPayload({ config })

    // 驗證登入
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json(
        { success: false, error: '請先登入' },
        { status: 401 },
      )
    }

    // 載入發票
    let invoice: Record<string, unknown>
    try {
      const found = await payload.findByID({
        collection: 'invoices',
        id,
        depth: 1,
      })
      invoice = found as unknown as Record<string, unknown>
    } catch {
      return NextResponse.json(
        { success: false, error: '找不到該發票' },
        { status: 404 },
      )
    }

    // 權限檢查：擁有者或管理員
    const isAdmin = (user as unknown as Record<string, unknown>).role === 'admin'
    const invoiceCustomer = invoice.customer as string | Record<string, unknown>
    const invoiceCustomerId =
      typeof invoiceCustomer === 'string' ? invoiceCustomer : invoiceCustomer?.id
    const isOwner = String(user.id) === String(invoiceCustomerId)

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { success: false, error: '無權限下載此發票' },
        { status: 403 },
      )
    }

    // 產生 PDF Buffer（目前為 HTML 內容）
    const pdfBuffer = await generateInvoicePdf(id)

    // 檔名
    const invoiceNumber = (invoice.invoiceNumber as string) || id
    const filename = `invoice-${invoiceNumber}.pdf`

    // NOTE: 目前回傳 HTML 格式（Content-Type: text/html）以確保瀏覽器可正確顯示。
    // 當整合 puppeteer 等工具產生真正的 PDF 後，改為 application/pdf。
    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    console.error('Invoice PDF GET error:', error)
    return NextResponse.json(
      { success: false, error: '產生發票 PDF 時發生錯誤' },
      { status: 500 },
    )
  }
}
