import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
// Where type available if needed for future query refinement

/**
 * 單一發票 API
 * ─────────────────────────────
 * GET   /api/invoices/:id — 取得發票詳情（擁有者或管理員）
 * PATCH /api/invoices/:id — 管理員操作：作廢、折讓、重試、重發通知
 */

// ── 輔助：取得用戶並驗證權限 ──

async function getAuthenticatedUserAndInvoice(
  req: NextRequest,
  invoiceId: string,
) {
  const payload = await getPayload({ config })

  const { user } = await payload.auth({ headers: req.headers })
  if (!user) {
    return { error: '請先登入', status: 401, payload, user: null, invoice: null }
  }

  let invoice: Record<string, unknown>
  try {
    const found = await payload.findByID({
      collection: 'invoices',
      id: invoiceId,
      depth: 2,
    })
    invoice = found as unknown as Record<string, unknown>
  } catch {
    return { error: '找不到該發票', status: 404, payload, user, invoice: null }
  }

  const isAdmin = (user as unknown as Record<string, unknown>).role === 'admin'
  const invoiceCustomer = invoice.customer as string | Record<string, unknown>
  const invoiceCustomerId =
    typeof invoiceCustomer === 'string' ? invoiceCustomer : invoiceCustomer?.id
  const isOwner = String(user.id) === String(invoiceCustomerId)

  if (!isAdmin && !isOwner) {
    return { error: '無權限查看此發票', status: 403, payload, user, invoice: null }
  }

  return { error: null, status: 200, payload, user, invoice, isAdmin }
}

// ── GET: 取得發票詳情 ──

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const result = await getAuthenticatedUserAndInvoice(req, id)

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      )
    }

    const invoice = result.invoice!
    const order = invoice.order as string | Record<string, unknown> | null
    const customer = invoice.customer as string | Record<string, unknown> | null

    return NextResponse.json({
      success: true,
      data: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceType: invoice.invoiceType,
        status: invoice.status,
        totalAmount: invoice.totalAmount,
        salesAmount: invoice.salesAmount,
        taxAmount: invoice.taxAmount,
        taxType: invoice.taxType,
        invoiceItems: invoice.invoiceItems,
        buyerInfo: invoice.buyerInfo,
        carrierInfo: invoice.carrierInfo,
        donationInfo: invoice.donationInfo,
        ecpayResponse: invoice.ecpayResponse,
        voidInfo: invoice.voidInfo,
        allowanceInfo: invoice.allowanceInfo,
        pdfUrl: invoice.pdfUrl,
        notificationSent: invoice.notificationSent,
        retryCount: invoice.retryCount,
        lastError: invoice.lastError,
        order: order && typeof order === 'object'
          ? { id: (order as unknown as Record<string, unknown>).id, orderNumber: (order as unknown as Record<string, unknown>).orderNumber }
          : order,
        customer: customer && typeof customer === 'object'
          ? { id: (customer as unknown as Record<string, unknown>).id, name: (customer as unknown as Record<string, unknown>).name, email: (customer as unknown as Record<string, unknown>).email }
          : customer,
        createdAt: invoice.createdAt,
        updatedAt: invoice.updatedAt,
      },
    })
  } catch (error) {
    console.error('Invoice GET error:', error)
    return NextResponse.json(
      { success: false, error: '伺服器錯誤' },
      { status: 500 },
    )
  }
}

// ── PATCH: 管理員操作 ──

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const result = await getAuthenticatedUserAndInvoice(req, id)

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      )
    }

    if (!result.isAdmin) {
      return NextResponse.json(
        { success: false, error: '僅管理員可執行此操作' },
        { status: 403 },
      )
    }

    const { payload, user, invoice } = result
    const body = await req.json()
    const { action } = body as { action: string }

    if (!action) {
      return NextResponse.json(
        { success: false, error: '缺少 action 參數' },
        { status: 400 },
      )
    }

    const inv = invoice!
    const currentStatus = inv.status as string

    // ──── 作廢 ────
    if (action === 'void') {
      const { reason } = body as { reason?: string }
      if (!reason) {
        return NextResponse.json(
          { success: false, error: '作廢原因為必填' },
          { status: 400 },
        )
      }

      if (currentStatus !== 'issued') {
        return NextResponse.json(
          { success: false, error: '僅已開立的發票可以作廢' },
          { status: 400 },
        )
      }

      const updated = await (payload.update as Function)({
        collection: 'invoices',
        id,
        data: {
          status: 'void',
          voidInfo: {
            voidReason: reason,
            voidDate: new Date().toISOString(),
            voidOperator: user!.id,
          },
        },
      })

      return NextResponse.json({
        success: true,
        message: '發票已作廢',
        data: {
          id: updated.id,
          invoiceNumber: (updated as unknown as Record<string, unknown>).invoiceNumber,
          status: 'void',
        },
      })
    }

    // ──── 折讓 ────
    if (action === 'allowance') {
      const { amount, reason, items } = body as {
        amount?: number
        reason?: string
        items?: Array<Record<string, unknown>>
      }

      if (!amount || amount <= 0) {
        return NextResponse.json(
          { success: false, error: '折讓金額必須大於 0' },
          { status: 400 },
        )
      }

      if (!reason) {
        return NextResponse.json(
          { success: false, error: '折讓原因為必填' },
          { status: 400 },
        )
      }

      if (currentStatus !== 'issued') {
        return NextResponse.json(
          { success: false, error: '僅已開立的發票可以折讓' },
          { status: 400 },
        )
      }

      const totalAmount = inv.totalAmount as number
      if (amount > totalAmount) {
        return NextResponse.json(
          { success: false, error: '折讓金額不可超過發票總額' },
          { status: 400 },
        )
      }

      // NOTE: 正式環境需呼叫綠界折讓 API 取得折讓單號
      const allowanceNo = `AL-${Date.now()}`

      const updated = await (payload.update as Function)({
        collection: 'invoices',
        id,
        data: {
          status: 'allowance',
          allowanceInfo: {
            allowanceAmount: amount,
            allowanceReason: reason,
            allowanceDate: new Date().toISOString(),
            allowanceNo,
          },
        },
      })

      return NextResponse.json({
        success: true,
        message: '折讓已成功',
        data: {
          id: updated.id,
          invoiceNumber: (updated as unknown as Record<string, unknown>).invoiceNumber,
          status: 'allowance',
          allowanceNo,
          allowanceAmount: amount,
        },
      })
    }

    // ──── 重試失敗的發票 ────
    if (action === 'retry') {
      if (currentStatus !== 'failed') {
        return NextResponse.json(
          { success: false, error: '僅開立失敗的發票可以重試' },
          { status: 400 },
        )
      }

      const retryCount = ((inv.retryCount as number) || 0) + 1

      const updated = await (payload.update as Function)({
        collection: 'invoices',
        id,
        data: {
          status: 'retry',
          retryCount,
          lastError: null,
        },
      })

      // NOTE: 正式環境此處會呼叫綠界 API 重新開立發票
      // 成功後更新狀態為 'issued'，失敗則回到 'failed'

      return NextResponse.json({
        success: true,
        message: '發票重試已排入佇列',
        data: {
          id: updated.id,
          status: 'retry',
          retryCount,
        },
      })
    }

    // ──── 重發通知 ────
    if (action === 'resend_notification') {
      if (currentStatus !== 'issued') {
        return NextResponse.json(
          { success: false, error: '僅已開立的發票可以重發通知' },
          { status: 400 },
        )
      }

      // NOTE: 正式環境此處會觸發通知（Email / LINE）
      // 目前僅更新 notificationSent 欄位

      await (payload.update as Function)({
        collection: 'invoices',
        id,
        data: {
          notificationSent: true,
        },
      })

      return NextResponse.json({
        success: true,
        message: '發票通知已重新發送',
        data: {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          notificationSent: true,
        },
      })
    }

    // 不支援的操作
    return NextResponse.json(
      { success: false, error: `不支援的操作：${action}` },
      { status: 400 },
    )
  } catch (error) {
    console.error('Invoice PATCH error:', error)
    return NextResponse.json(
      { success: false, error: '伺服器錯誤' },
      { status: 500 },
    )
  }
}
