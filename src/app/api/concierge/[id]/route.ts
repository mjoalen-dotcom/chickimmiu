import { NextRequest, NextResponse } from 'next/server'
import { getPayload, type BasePayload } from 'payload'
import config from '@payload-config'
import { resolveBearerUser } from '@/lib/auth/resolveBearerUser'

/**
 * 單一管家請求 API
 * GET   /api/concierge/:id — 取得請求詳情（T5 擁有者或管理員）
 * PATCH /api/concierge/:id — 更新請求（管理員：狀態、指派、備註；T5 用戶：取消）
 *
 * APP-API-001步驟16修復：原本手動查 `apiToken` 欄位（Users/Customers皆無此
 * 欄位，永遠查無）+ cookie fallback 抓「第一個_verified:true的user」（不比對
 * token本人，形同虛設）——這支路由的身分驗證從建立以來就沒真的生效過，
 * isOwner 永遠 false（連 request.user 欄位名稱都是錯的，實際欄位叫
 * requester）。改用與同層 concierge/route.ts、v1 API 一致的
 * resolveBearerUser（Bearer/JWT）+ payload.auth（cookie）雙軌解析。
 */
async function resolveCurrentUser(
  req: NextRequest,
  payload: BasePayload,
): Promise<Record<string, unknown> | null> {
  const authHeader = req.headers.get('authorization')
  if (authHeader && /^(Bearer|JWT)\s+/i.test(authHeader)) {
    const { user } = await resolveBearerUser(req)
    if (user) return user as unknown as Record<string, unknown>
  }
  const { user } = await payload.auth({ headers: req.headers })
  return (user as unknown as Record<string, unknown>) || null
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const payload = await getPayload({ config })

    // 驗證身份
    const currentUser = await resolveCurrentUser(req, payload)

    // 取得請求
    let request: Record<string, unknown> | null = null
    try {
      const found = await payload.findByID({
        collection: 'concierge-service-requests',
        id,
        depth: 2,
      })
      request = found as unknown as Record<string, unknown>
    } catch {
      return NextResponse.json(
        { success: false, error: '找不到該管家請求' },
        { status: 404 },
      )
    }

    if (!request) {
      return NextResponse.json(
        { success: false, error: '找不到該管家請求' },
        { status: 404 },
      )
    }

    // 權限檢查：只有擁有者（T5）或管理員可以查看
    const requestUser = request.requester as string | Record<string, unknown>
    const requestUserId =
      typeof requestUser === 'string' ? requestUser : requestUser?.id
    const isOwner = currentUser && String(currentUser.id) === String(requestUserId)
    const isAdmin = currentUser && (currentUser as { role?: string }).role === 'admin'

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { success: false, error: '無權限查看此請求' },
        { status: 403 },
      )
    }

    // 組裝回應
    const concierge = request.assignedConcierge as
      | string
      | Record<string, unknown>
      | null
    const conciergeName =
      concierge && typeof concierge === 'object'
        ? (concierge.name as string) || '待指派'
        : '待指派'

    return NextResponse.json({
      success: true,
      data: {
        id: request.id,
        serviceType: request.serviceType,
        description: request.description,
        status: request.status,
        priority: request.priority,
        preferredDate: request.preferredDate,
        preferredTime: request.preferredTime,
        location: request.location,
        budget: request.budget,
        numberOfPeople: request.numberOfPeople,
        specialRequirements: request.specialRequirements,
        urgent: request.urgent,
        assignedConcierge: conciergeName,
        conciergeNotes: request.conciergeNotes,
        aiSuggestions: request.aiSuggestions,
        internalNotes: isAdmin ? request.internalNotes : undefined,
        completionDetails: request.completionDetails,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
      },
    })
  } catch (error) {
    console.error('Concierge Request GET error:', error)
    return NextResponse.json(
      { success: false, error: '伺服器錯誤' },
      { status: 500 },
    )
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await req.json()
    const payload = await getPayload({ config })

    // 驗證身份
    const currentUser = await resolveCurrentUser(req, payload)

    // 取得請求
    let existing: Record<string, unknown> | null = null
    try {
      const found = await payload.findByID({
        collection: 'concierge-service-requests',
        id,
        depth: 1,
      })
      existing = found as unknown as Record<string, unknown>
    } catch {
      return NextResponse.json(
        { success: false, error: '找不到該管家請求' },
        { status: 404 },
      )
    }

    if (!existing) {
      return NextResponse.json(
        { success: false, error: '找不到該管家請求' },
        { status: 404 },
      )
    }

    // 權限判斷
    const requestUser = existing.requester as string | Record<string, unknown>
    const requestUserId =
      typeof requestUser === 'string' ? requestUser : requestUser?.id
    const isOwner = currentUser && String(currentUser.id) === String(requestUserId)
    const isAdmin = currentUser && (currentUser as { role?: string }).role === 'admin'

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { success: false, error: '無權限修改此請求' },
        { status: 403 },
      )
    }

    const safeData: Record<string, unknown> = {}

    if (isAdmin) {
      // 管理員可更新欄位
      const adminFields = [
        'status',
        'priority',
        'assignedConcierge',
        'conciergeNotes',
        'internalNotes',
        'aiSuggestions',
        'completionDetails',
        'estimatedCost',
        'actualCost',
      ]
      for (const key of adminFields) {
        if (body[key] !== undefined) {
          safeData[key] = body[key]
        }
      }

      // 狀態變更驗證
      if (safeData.status) {
        const currentStatus = existing.status as string
        const newStatus = safeData.status as string
        const validTransitions: Record<string, string[]> = {
          submitted: ['ai_processing', 'assigned', 'cancelled'],
          ai_processing: ['assigned', 'cancelled'],
          assigned: ['in_progress', 'cancelled'],
          in_progress: ['pending_confirmation', 'completed', 'cancelled'],
          pending_confirmation: ['completed', 'in_progress', 'cancelled'],
          completed: [],
          cancelled: [],
        }

        if (!validTransitions[currentStatus]?.includes(newStatus)) {
          return NextResponse.json(
            {
              success: false,
              error: `無法從「${currentStatus}」變更為「${newStatus}」`,
            },
            { status: 400 },
          )
        }
      }
    } else if (isOwner) {
      // T5 用戶只能取消
      if (body.status === 'cancelled') {
        const currentStatus = existing.status as string
        const cancellableStatuses = [
          'submitted',
          'ai_processing',
          'assigned',
          'in_progress',
        ]

        if (!cancellableStatuses.includes(currentStatus)) {
          return NextResponse.json(
            { success: false, error: '此請求已無法取消' },
            { status: 400 },
          )
        }

        safeData.status = 'cancelled'
        safeData.cancelledBy = 'user'
        safeData.cancelledAt = new Date().toISOString()
      } else {
        return NextResponse.json(
          { success: false, error: '您只能取消請求' },
          { status: 400 },
        )
      }
    }

    if (Object.keys(safeData).length === 0) {
      return NextResponse.json(
        { success: false, error: '沒有可更新的欄位' },
        { status: 400 },
      )
    }

    const updated = await (payload.update as Function)({
      collection: 'concierge-service-requests',
      id,
      data: safeData,
    })

    return NextResponse.json({
      success: true,
      message: '管家請求已更新',
      data: {
        id: updated.id,
        status: (updated as unknown as Record<string, unknown>).status,
        updatedAt: updated.updatedAt,
        updatedFields: Object.keys(safeData),
      },
    })
  } catch (error) {
    console.error('Concierge Request PATCH error:', error)
    return NextResponse.json(
      { success: false, error: '伺服器錯誤' },
      { status: 500 },
    )
  }
}
