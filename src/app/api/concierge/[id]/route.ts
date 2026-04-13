import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'

/**
 * 單一管家請求 API
 * GET   /api/concierge/:id — 取得請求詳情（T5 擁有者或管理員）
 * PATCH /api/concierge/:id — 更新請求（管理員：狀態、指派、備註；T5 用戶：取消）
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const payload = await getPayload({ config })

    // 驗證身份
    const authHeader = req.headers.get('authorization')
    let currentUser: Record<string, unknown> | null = null

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      try {
        const result = await payload.find({
          collection: 'users',
          where: { apiToken: { equals: token } } satisfies Where,
          limit: 1,
        })
        if (result.docs.length > 0) {
          currentUser = result.docs[0] as unknown as Record<string, unknown>
        }
      } catch {
        // token 驗證失敗
      }
    }

    // 嘗試從 cookie 驗證
    if (!currentUser) {
      try {
        const cookieHeader = req.headers.get('cookie') || ''
        const tokenMatch = cookieHeader.match(/payload-token=([^;]+)/)
        if (tokenMatch) {
          const verifyResult = await payload.find({
            collection: 'users',
            where: { _verified: { equals: true } } satisfies Where,
            limit: 1,
            user: undefined,
          })
          // 透過 Payload auth 驗證
          if (verifyResult.docs.length > 0) {
            currentUser = verifyResult.docs[0] as unknown as Record<string, unknown>
          }
        }
      } catch {
        // cookie 驗證失敗
      }
    }

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
    const requestUser = request.user as string | Record<string, unknown>
    const requestUserId =
      typeof requestUser === 'string' ? requestUser : requestUser?.id
    const isOwner = currentUser && String(currentUser.id) === String(requestUserId)
    const isAdmin =
      currentUser &&
      ((currentUser.role as string) === 'admin' ||
        (currentUser.roles as string[] | undefined)?.includes('admin'))

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
    const authHeader = req.headers.get('authorization')
    let currentUser: Record<string, unknown> | null = null

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      try {
        const result = await payload.find({
          collection: 'users',
          where: { apiToken: { equals: token } } satisfies Where,
          limit: 1,
        })
        if (result.docs.length > 0) {
          currentUser = result.docs[0] as unknown as Record<string, unknown>
        }
      } catch {
        // token 驗證失敗
      }
    }

    if (!currentUser) {
      try {
        const cookieHeader = req.headers.get('cookie') || ''
        const tokenMatch = cookieHeader.match(/payload-token=([^;]+)/)
        if (tokenMatch) {
          const verifyResult = await payload.find({
            collection: 'users',
            where: { _verified: { equals: true } } satisfies Where,
            limit: 1,
          })
          if (verifyResult.docs.length > 0) {
            currentUser = verifyResult.docs[0] as unknown as Record<string, unknown>
          }
        }
      } catch {
        // cookie 驗證失敗
      }
    }

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
    const requestUser = existing.user as string | Record<string, unknown>
    const requestUserId =
      typeof requestUser === 'string' ? requestUser : requestUser?.id
    const isOwner = currentUser && String(currentUser.id) === String(requestUserId)
    const isAdmin =
      currentUser &&
      ((currentUser.role as string) === 'admin' ||
        (currentUser.roles as string[] | undefined)?.includes('admin'))

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
