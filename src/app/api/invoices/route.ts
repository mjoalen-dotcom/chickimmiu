import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'

/**
 * 發票列表 & 手動開立 API
 * ─────────────────────────────
 * GET  /api/invoices — 列表（使用者查自己、管理員查全部），支援篩選 & 分頁
 * POST /api/invoices — 手動為訂單開立發票
 */

// ── GET: 發票列表 ──

export async function GET(req: NextRequest) {
  try {
    const payload = await getPayload({ config })

    // 驗證登入
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json(
        { success: false, error: '請先登入' },
        { status: 401 },
      )
    }

    const { searchParams } = req.nextUrl
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
    const status = searchParams.get('status')
    const invoiceType = searchParams.get('invoiceType')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const sortBy = searchParams.get('sortBy') || '-createdAt'

    // 建構查詢條件
    const where: Where = {}

    // 非管理員僅能查看自己的發票
    const isAdmin = (user as unknown as Record<string, unknown>).role === 'admin'
    if (!isAdmin) {
      where.customer = { equals: user.id }
    }

    // 狀態篩選
    if (status) {
      where.status = { equals: status }
    }

    // 發票類型篩選
    if (invoiceType) {
      where.invoiceType = { equals: invoiceType }
    }

    // 日期範圍篩選
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, unknown> = {}
      if (dateFrom) dateFilter.greater_than_equal = dateFrom
      if (dateTo) dateFilter.less_than_equal = dateTo
      where.createdAt = dateFilter
    }

    const result = await payload.find({
      collection: 'invoices',
      where,
      page,
      limit,
      sort: sortBy,
      depth: 1,
    })

    const invoices = result.docs.map((doc) => {
      const d = doc as unknown as Record<string, unknown>
      const order = d.order as string | Record<string, unknown> | null
      const customer = d.customer as string | Record<string, unknown> | null
      return {
        id: d.id,
        invoiceNumber: d.invoiceNumber,
        invoiceType: d.invoiceType,
        status: d.status,
        totalAmount: d.totalAmount,
        orderNumber:
          order && typeof order === 'object'
            ? (order as unknown as Record<string, unknown>).orderNumber || order.id
            : order,
        customerName:
          customer && typeof customer === 'object'
            ? (customer as unknown as Record<string, unknown>).name || '-'
            : '-',
        createdAt: d.createdAt,
      }
    })

    return NextResponse.json({
      success: true,
      data: invoices,
      meta: {
        page: result.page,
        totalPages: result.totalPages,
        totalDocs: result.totalDocs,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
      },
    })
  } catch (error) {
    console.error('Invoices GET error:', error)
    return NextResponse.json(
      { success: false, error: '伺服器錯誤' },
      { status: 500 },
    )
  }
}

// ── POST: 手動開立發票 ──

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config })

    // 驗證登入（需管理員權限）
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json(
        { success: false, error: '請先登入' },
        { status: 401 },
      )
    }

    const isAdmin = (user as unknown as Record<string, unknown>).role === 'admin'
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: '僅管理員可手動開立發票' },
        { status: 403 },
      )
    }

    const body = await req.json()
    const {
      orderId,
      invoiceType,
      carrierType,
      carrierNumber,
      loveCode,
      buyerUBN,
      buyerCompanyName,
    } = body as {
      orderId: string
      invoiceType: string
      carrierType?: string
      carrierNumber?: string
      loveCode?: string
      buyerUBN?: string
      buyerCompanyName?: string
    }

    if (!orderId || !invoiceType) {
      return NextResponse.json(
        { success: false, error: '缺少必要欄位：orderId、invoiceType' },
        { status: 400 },
      )
    }

    // 驗證訂單存在
    let order: Record<string, unknown>
    try {
      const found = await payload.findByID({ collection: 'orders', id: orderId, depth: 1 })
      order = found as unknown as Record<string, unknown>
    } catch {
      return NextResponse.json(
        { success: false, error: '找不到該訂單' },
        { status: 404 },
      )
    }

    // 檢查是否已開立發票
    const existingInvoice = await payload.find({
      collection: 'invoices',
      where: {
        order: { equals: orderId },
        status: { not_equals: 'void' },
      } satisfies Where,
      limit: 1,
    })

    if (existingInvoice.docs.length > 0) {
      return NextResponse.json(
        { success: false, error: '此訂單已有有效發票，如需重開請先作廢現有發票' },
        { status: 409 },
      )
    }

    // 取得訂單品項與金額（從訂單資料組裝）
    const orderItems = (order.items as unknown as Array<Record<string, unknown>>) || []
    const totalAmount = (order.totalAmount as number) || (order.total as number) || 0
    const salesAmount = Math.round(totalAmount / 1.05)
    const taxAmount = totalAmount - salesAmount

    // 組裝發票品項
    const invoiceItems = orderItems.map((item) => {
      const product = item.product as unknown as Record<string, unknown> | string
      const productName =
        product && typeof product === 'object'
          ? (product.title as string) || (product.name as string) || '商品'
          : '商品'
      const qty = (item.quantity as number) || 1
      const price = (item.price as number) || (item.unitPrice as number) || 0
      return {
        itemName: productName,
        itemCount: qty,
        itemWord: '件',
        itemPrice: price,
        itemTaxType: 'taxable' as const,
        itemAmount: qty * price,
      }
    })

    // 若沒有品項資料，建立一筆總項
    if (invoiceItems.length === 0) {
      invoiceItems.push({
        itemName: '商品合計',
        itemCount: 1,
        itemWord: '式',
        itemPrice: totalAmount,
        itemTaxType: 'taxable' as const,
        itemAmount: totalAmount,
      })
    }

    // 取得買方資訊
    const customerId =
      typeof order.customer === 'object'
        ? (order.customer as unknown as Record<string, unknown>).id
        : order.customer || order.user
    const customerDoc = customerId
      ? await payload.findByID({ collection: 'users', id: String(customerId) }).catch(() => null)
      : null
    const customerData = customerDoc as unknown as Record<string, unknown> | null

    const buyerEmail =
      (customerData?.email as string) ||
      (order.email as string) ||
      'unknown@example.com'
    const buyerName =
      (customerData?.name as string) || (order.customerName as string) || ''
    const buyerPhone =
      (customerData?.phone as string) || (order.phone as string) || ''

    // 建立發票
    const invoice = await (payload.create as Function)({
      collection: 'invoices',
      data: {
        order: orderId as unknown as number,
        customer: (customerId || user.id) as unknown as number,
        invoiceType: invoiceType as 'b2c_personal' | 'b2c_carrier' | 'b2b' | 'donation',
        status: 'pending' as const,
        totalAmount,
        salesAmount,
        taxAmount,
        taxType: 'taxable',
        invoiceItems,
        buyerInfo: {
          buyerName,
          buyerEmail,
          buyerPhone,
          buyerUBN: buyerUBN || undefined,
          buyerCompanyName: buyerCompanyName || undefined,
        },
        carrierInfo: {
          carrierType: (carrierType || 'none') as 'none' | 'phone_barcode' | 'natural_cert' | 'ecpay_member',
          carrierNumber: carrierNumber || undefined,
        },
        donationInfo: {
          loveCode: loveCode || undefined,
        },
      },
    })

    return NextResponse.json(
      {
        success: true,
        message: '發票已建立（待開立）',
        data: {
          id: invoice.id,
          status: 'pending',
          totalAmount,
          invoiceType,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Invoices POST error:', error)
    return NextResponse.json(
      { success: false, error: '伺服器錯誤' },
      { status: 500 },
    )
  }
}
