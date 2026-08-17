/**
 * 活動稽核軌跡寫入（CHIC Commerce OS P0-C §6.2）
 * ───────────────────────────────────────────────
 * 由 MarketingCampaigns.afterChange 呼叫，把「誰在什麼時候把活動打開/關掉/
 * 改預算/核准」寫進 campaign-activities。
 *
 * 只記「會花錢或改變曝光」的欄位，不做全欄位 diff——全欄位 diff 會被文案
 * 微調洗版，真正重要的狀態轉換反而被淹沒。
 */
import type { Payload, PayloadRequest } from 'payload'

import { statusLabel } from './campaignLifecycle'

type Doc = Record<string, unknown>

const relId = (v: unknown): string | null => {
  if (v == null) return null
  if (typeof v === 'object') {
    const id = (v as Record<string, unknown>).id
    return id == null ? null : String(id)
  }
  return String(v)
}

/** 受監控欄位：路徑 → 人話標籤 */
const WATCHED: Array<{ path: string[]; label: string }> = [
  { path: ['commerce', 'budgetCap'], label: '活動總預算上限' },
  { path: ['commerce', 'killSwitch'], label: 'Kill Switch' },
  { path: ['commerce', 'enabled'], label: '啟用商務活動' },
  { path: ['commerce', 'surfaces'], label: '曝光版位' },
  { path: ['schedule', 'startDate'], label: '開始時間' },
  { path: ['schedule', 'endDate'], label: '結束時間' },
]

function pick(doc: Doc | undefined, path: string[]): unknown {
  let cur: unknown = doc
  for (const k of path) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[k]
  }
  return cur
}

const norm = (v: unknown): string => {
  if (v == null) return ''
  if (Array.isArray(v)) return JSON.stringify([...v].map(String).sort())
  return JSON.stringify(v)
}

export async function recordCampaignActivity(args: {
  payload: Payload
  req: PayloadRequest
  doc: Doc
  previousDoc?: Doc
  operation: 'create' | 'update'
}): Promise<void> {
  const { payload, req, doc, previousDoc, operation } = args
  const actorId = (req.user as Record<string, unknown> | null | undefined)?.id ?? null

  const fromStatus = operation === 'create' ? null : ((previousDoc?.status as string) ?? null)
  const toStatus = (doc.status as string) ?? null
  const statusChanged = fromStatus !== toStatus

  // 受監控欄位差異
  const changes: Record<string, { from: unknown; to: unknown; label: string }> = {}
  if (operation === 'update') {
    for (const w of WATCHED) {
      const before = pick(previousDoc, w.path)
      const after = pick(doc, w.path)
      if (norm(before) !== norm(after)) {
        changes[w.path.join('.')] = { from: before ?? null, to: after ?? null, label: w.label }
      }
    }
  }

  const prevApprover = relId(pick(previousDoc, ['commerce', 'approval', 'approvedBy']))
  const nextApprover = relId(pick(doc, ['commerce', 'approval', 'approvedBy']))
  const approvalChanged = operation === 'update' && prevApprover !== nextApprover && nextApprover != null

  // 建立時只有在「不是單純草稿」才值得記；一般 draft 建立不寫，避免噪音
  if (operation === 'create' && toStatus === 'draft' && Object.keys(changes).length === 0) return
  if (!statusChanged && !approvalChanged && Object.keys(changes).length === 0) return

  // 分類：狀態 > kill switch > 核准 > 預算 > 其他
  let type: string = 'settings_change'
  if (statusChanged) type = 'status_change'
  else if ('commerce.killSwitch' in changes) type = 'kill_switch'
  else if (approvalChanged) type = 'approval'
  else if ('commerce.budgetCap' in changes) type = 'budget_change'

  const isOverride = Boolean(doc.statusOverride) && statusChanged
  const name = String(doc.campaignName ?? doc.id ?? '')

  let summary: string
  if (operation === 'create') summary = `建立活動「${name}」（${statusLabel(String(toStatus))}）`
  else if (statusChanged) {
    summary =
      `「${name}」狀態：${statusLabel(String(fromStatus))} → ${statusLabel(String(toStatus))}` +
      (isOverride ? '（強制覆寫）' : '')
  } else {
    const labels = Object.values(changes).map((c) => c.label)
    if (approvalChanged) labels.unshift('核准人')
    summary = `「${name}」變更：${labels.join('、') || '設定'}`
  }

  await payload.create({
    collection: 'campaign-activities',
    data: {
      campaign: doc.id as number | string,
      type,
      actor: actorId,
      fromStatus,
      toStatus,
      isOverride,
      summary,
      reason: isOverride ? String(doc.statusOverrideReason ?? '') : undefined,
      changes: Object.keys(changes).length > 0 ? changes : undefined,
    } as never,
    overrideAccess: true,
  })
}
