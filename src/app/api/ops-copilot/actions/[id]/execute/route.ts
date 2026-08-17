/**
 * POST /api/ops-copilot/actions/[id]/execute
 * ─────────────────────────────────────
 * **這是整套系統唯一真的會改資料的端點。**
 *
 * Body：{ decision: 'execute' | 'reject', confirm?: boolean, note?: string }
 *   · decision:'reject' → 只把提案標成已駁回
 *   · decision:'execute' → 依序跑：
 *       1. admin 認證（requireAdmin）
 *       2. 狀態必須是 pending（已定案的不給重跑）
 *       3. validate(input) 重跑
 *       4. preview() 重跑 —— blockers 非空就擋（提案到現在資料可能被改過）
 *       5. risk='high' 必須帶 confirm:true
 *       6. execute()
 *   任何一步失敗都寫進 ops-actions 的 error 欄位，狀態轉 failed。
 *
 * LLM 永遠碰不到這條路徑：它拿不到 admin cookie，也沒有任何工具指向這裡。
 */

import { NextResponse } from 'next/server'

import { getActionType } from '@/lib/ops-copilot/actions'
import { requireAdmin } from '../../../_auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params

  let body: { decision?: string; confirm?: boolean; note?: string }
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  const decision = body.decision === 'reject' ? 'reject' : 'execute'

  const doc = await auth.payload.findByID({ collection: 'ops-actions', id, depth: 0 })
  if (!doc) return NextResponse.json({ error: '找不到提案' }, { status: 404 })

  if (doc.status !== 'pending') {
    return NextResponse.json(
      { error: `提案狀態為「${doc.status}」，只有待核准的提案可以處理` },
      { status: 409 },
    )
  }

  const stamp = new Date().toISOString()

  // ── 駁回 ────────────────────────────────────────────
  if (decision === 'reject') {
    await auth.payload.update({
      collection: 'ops-actions',
      id,
      data: {
        status: 'rejected',
        decidedBy: auth.userId,
        decidedAt: stamp,
        adminNote: body.note || `由 ${auth.userName} 駁回`,
      },
    })
    return NextResponse.json({ ok: true, status: 'rejected' })
  }

  // ── 執行 ────────────────────────────────────────────
  const actionType = getActionType(String(doc.actionType))
  if (!actionType) {
    return NextResponse.json({ error: `未知的行動類型：${doc.actionType}` }, { status: 400 })
  }

  const input = (doc.input as Record<string, unknown>) ?? {}

  const fail = async (message: string, status = 400) => {
    await auth.payload.update({
      collection: 'ops-actions',
      id,
      data: {
        status: 'failed',
        error: message,
        decidedBy: auth.userId,
        decidedAt: stamp,
      },
    })
    return NextResponse.json({ ok: false, status: 'failed', error: message }, { status })
  }

  const errors = actionType.validate(input)
  if (errors.length > 0) return fail(`參數驗證失敗：${errors.join('；')}`)

  // 提案到核准之間可能隔了幾小時，資料早就變了 —— 重跑一次 preview 才知道現在還能不能做。
  let preview
  try {
    preview = await actionType.preview(auth.payload, input)
  } catch (err) {
    return fail(`重新預覽失敗：${err instanceof Error ? err.message : String(err)}`, 500)
  }
  if (preview.blockers?.length) {
    return fail(`目前無法執行：${preview.blockers.join('；')}`, 409)
  }

  if (actionType.risk === 'high' && body.confirm !== true) {
    return NextResponse.json(
      { error: '高風險行動需要二次確認（body 要帶 confirm: true）', preview },
      { status: 428 },
    )
  }

  try {
    const result = await actionType.execute(auth.payload, input, auth.userId)

    await auth.payload.update({
      collection: 'ops-actions',
      id,
      data: {
        status: result.ok ? 'executed' : 'failed',
        resultMessage: result.message,
        affected: result.affected ?? [],
        error: result.ok ? undefined : result.message,
        decidedBy: auth.userId,
        decidedAt: stamp,
        adminNote: body.note || `由 ${auth.userName} 核准執行`,
      },
    })

    return NextResponse.json({
      ok: result.ok,
      status: result.ok ? 'executed' : 'failed',
      message: result.message,
      affected: result.affected ?? [],
    })
  } catch (err) {
    return fail(`執行時發生例外：${err instanceof Error ? err.message : String(err)}`, 500)
  }
}
