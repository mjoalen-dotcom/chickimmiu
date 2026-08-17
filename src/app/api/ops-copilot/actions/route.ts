/**
 * GET /api/ops-copilot/actions?status=pending
 * ─────────────────────────────────────
 * 列出行動提案。預設只回 pending（待辦清單）。
 * 只給 admin。
 */

import { NextResponse } from 'next/server'

import { requireAdmin } from '../_auth'

export const dynamic = 'force-dynamic'

const ALLOWED_STATUS = ['pending', 'executed', 'failed', 'rejected', 'expired']

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const status = new URL(req.url).searchParams.get('status') || 'pending'
  if (!ALLOWED_STATUS.includes(status)) {
    return NextResponse.json({ error: `status 必須是 ${ALLOWED_STATUS.join('/')}` }, { status: 400 })
  }

  const res = await auth.payload.find({
    collection: 'ops-actions',
    where: { status: { equals: status } },
    sort: '-createdAt',
    limit: 50,
    depth: 0,
  })

  return NextResponse.json({
    status,
    total: res.totalDocs,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    actions: res.docs.map((d: any) => ({
      id: d.id,
      summary: d.summary,
      actionType: d.actionType,
      risk: d.risk,
      status: d.status,
      sourceSignalId: d.sourceSignalId,
      preview: d.previewSnapshot,
      resultMessage: d.resultMessage,
      error: d.error,
      createdAt: d.createdAt,
      decidedAt: d.decidedAt,
    })),
  })
}
