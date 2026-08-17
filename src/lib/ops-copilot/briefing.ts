/**
 * Ops Copilot — 營運日報
 * ─────────────────────────────────────
 * 流程：
 *   1. collectSignals()          純程式掃描，算出所有數字
 *   2. expireStaleProposals()    把 7 天沒人理的提案標成過期（避免拿舊數字執行）
 *   3. enrichDrafts()            需要文案的行動（DM）用 Groq 量產文案
 *   4. persistProposals()        把行動草稿寫成 pending 提案（同參數已存在則跳過）
 *   5. narrate()                 Claude 把訊號寫成「結論先行」的三句話
 *
 * LLM 只做第 5 步。第 1 步的數字原封不動送進 prompt 當事實，
 * 而且 prompt 明文禁止模型產生任何 metrics 裡沒有的數字。
 */

import { getActionType } from './actions'
import { generateBulkText, generateText } from './llm'
import { collectSignals } from './signals'
import type { ActionDraft, OpsBriefing, OpsSignal, PayloadLike } from './types'

const PROPOSAL_TTL_DAYS = 7
const MAX_PROPOSALS_PER_RUN = 12

const NARRATOR_SYSTEM = `你是 CHIC KIM & MIU（韓系女裝電商）的營運分析助理，對象是創辦人 Alan。

輸出規則（違反任何一條都算失敗）：
1. 繁體中文、台灣用語。
2. 結論先行：第一句就講今天最該處理的一件事。
3. 全文 3–5 句，不分段、不用條列、不用 emoji、不加標題。
4. **只能使用我提供的 metrics 裡出現過的數字。** 不准推估、不准四捨五入成別的數、
   不准出現任何我沒給你的金額、百分比或件數。沒有數字支撐的判斷就用文字講，不要編數字。
5. 不要重述訊號標題，要講「這代表什麼、為什麼該先處理它」。
6. 語氣是已經看過報表的營運主管，不是客服。不要問「需要我做什麼嗎」。`

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

/** 同一個行動的識別鍵：類型 + 參數。用來擋掉每天重複產生一模一樣的提案。 */
function draftKey(draft: ActionDraft): string {
  return `${draft.type}:${JSON.stringify(draft.input, Object.keys(draft.input).sort())}`
}

/** 把超過 TTL 還沒人處理的 pending 提案標成過期 */
async function expireStaleProposals(payload: PayloadLike): Promise<number> {
  const cutoff = new Date(Date.now() - PROPOSAL_TTL_DAYS * 86_400_000).toISOString()
  const stale = await payload.find({
    collection: 'ops-actions',
    where: {
      and: [{ status: { equals: 'pending' } }, { createdAt: { less_than: cutoff } }],
    },
    limit: 100,
    depth: 0,
  })
  for (const doc of stale.docs) {
    await payload.update({
      collection: 'ops-actions',
      id: doc.id as string | number,
      data: {
        status: 'expired',
        error: `超過 ${PROPOSAL_TTL_DAYS} 天未處理，數字已可能過時，請重新產生日報。`,
      },
    })
  }
  return stale.docs.length
}

/**
 * 補齊需要文案的行動草稿。
 * 目前只有 send_member_dm —— 掃描器只給 {userId, intent}，這裡補 subject / body。
 * Groq 掛掉就退回模板，不讓日報整份失敗。
 */
async function enrichDrafts(
  payload: PayloadLike,
  drafts: ActionDraft[],
): Promise<ActionDraft[]> {
  const out: ActionDraft[] = []

  for (const draft of drafts) {
    if (draft.type !== 'send_member_dm') {
      out.push(draft)
      continue
    }

    const userId = draft.input.userId
    const user = userId != null
      ? await payload.findByID({ collection: 'users', id: userId as string | number, depth: 1 })
      : null
    if (!user) continue

    const name = str(user.name) || '貴賓'
    const tier = user.memberTier as Record<string, unknown> | null
    const tierName = str(tier?.frontName as string) || '會員'
    const spend = Math.round(num(user.lifetimeSpend))
    const lastOrder = str(user.lastOrderDate).slice(0, 10)

    let subject = `${name}，好久不見了`
    let body =
      `${name} 您好，\n\n` +
      `距離您上次購買（${lastOrder}）已經有一段時間了。` +
      `身為我們的${tierName}，這次回來我們想給您一點小心意。\n\n` +
      `新一季的韓系選品已經上架，歡迎回來看看。\n\n` +
      `CHIC KIM & MIU`

    try {
      const raw = await generateBulkText({
        system:
          '你是 CHIC KIM & MIU（韓系女裝電商）的 CRM 文案。繁體中文台灣用語，語氣親切但不諂媚，' +
          '不用 emoji、不誇大、不承諾任何我沒告訴你的折扣或贈品。' +
          '嚴格輸出 JSON：{"subject":"...","body":"..."}，不要加 markdown 圍欄。' +
          'subject 20 字內，body 120–200 字。',
        prompt:
          `寫一封回購喚回信。收件人：${name}，會員等級：${tierName}，` +
          `累計消費 ${spend} 元，上次購買日 ${lastOrder}。` +
          `目的是喚回，不要提任何具體折扣數字。`,
        maxTokens: 800,
      })
      const parsed = JSON.parse(raw.replace(/^```(?:json)?|```$/g, '').trim()) as {
        subject?: string
        body?: string
      }
      if (parsed.subject && parsed.body) {
        subject = parsed.subject
        body = parsed.body
      }
    } catch (err) {
      console.warn('[ops-copilot] DM 文案生成失敗，退回模板：', err)
    }

    out.push({
      ...draft,
      summary: `寄回購 DM 給 ${name}（${tierName}，累計 $${spend}）`,
      input: { userId, subject, body },
    })
  }

  return out
}

/** 把草稿寫成 pending 提案；同參數的 pending 已存在就跳過 */
async function persistProposals(
  payload: PayloadLike,
  signals: OpsSignal[],
): Promise<Array<string | number>> {
  const existing = await payload.find({
    collection: 'ops-actions',
    where: { status: { equals: 'pending' } },
    limit: 200,
    depth: 0,
  })
  const seen = new Set(
    existing.docs.map((d) =>
      draftKey({
        type: d.actionType as ActionDraft['type'],
        summary: '',
        input: (d.input as Record<string, unknown>) ?? {},
      }),
    ),
  )

  const ids: Array<string | number> = []

  for (const signal of signals) {
    const drafts = await enrichDrafts(payload, signal.suggestedActions ?? [])

    for (const draft of drafts) {
      if (ids.length >= MAX_PROPOSALS_PER_RUN) return ids

      const actionType = getActionType(draft.type)
      if (!actionType) continue

      const errors = actionType.validate(draft.input)
      if (errors.length > 0) {
        console.warn(`[ops-copilot] 跳過無效提案 ${draft.type}：${errors.join('; ')}`)
        continue
      }

      const key = draftKey(draft)
      if (seen.has(key)) continue
      seen.add(key)

      let preview
      try {
        preview = await actionType.preview(payload, draft.input)
      } catch (err) {
        console.warn(`[ops-copilot] preview 失敗 ${draft.type}：`, err)
        continue
      }
      // 預覽時就已經被擋下的（例如調價幅度超過上限）不值得排進待辦
      if (preview.blockers?.length) continue

      const doc = await payload.create({
        collection: 'ops-actions',
        data: {
          summary: draft.summary,
          actionType: draft.type,
          risk: actionType.risk,
          status: 'pending',
          input: draft.input,
          sourceSignalId: signal.id,
          previewSnapshot: preview,
        },
      })
      ids.push(doc.id as string | number)
    }
  }

  return ids
}

/** 程式版摘要 —— LLM 不可用時的 fallback，永遠不會產生假數字 */
function fallbackHeadline(signals: OpsSignal[]): string {
  if (signals.length === 0) return '目前沒有偵測到需要處理的營運訊號。'
  const critical = signals.filter((s) => s.severity === 'critical')
  const lead = critical[0] ?? signals[0]
  const rest = signals.length - 1
  return (
    `最該先處理的是「${lead.title}」。` +
    (critical.length > 1 ? `另外還有 ${critical.length - 1} 項同樣被列為緊急。` : '') +
    (rest > 0 ? `本次共偵測到 ${signals.length} 項訊號。` : '') +
    '（AI 敘述暫時不可用，以上為系統自動摘要。）'
  )
}

async function narrate(signals: OpsSignal[]): Promise<{ text: string; degraded: boolean }> {
  if (signals.length === 0) {
    return { text: '今天沒有偵測到需要處理的營運訊號。', degraded: false }
  }

  const facts = signals
    .map((s) => {
      const metrics = Object.entries(s.metrics)
        .map(([k, v]) => `    ${k}: ${v}`)
        .join('\n')
      return `- [${s.severity}] ${s.title}\n${metrics}`
    })
    .join('\n')

  try {
    const text = await generateText({
      system: NARRATOR_SYSTEM,
      prompt: `以下是今天掃描到的營運訊號與實際數字：\n\n${facts}\n\n請依規則寫出摘要。`,
      maxTokens: 4000,
    })
    if (!text) return { text: fallbackHeadline(signals), degraded: true }
    return { text, degraded: false }
  } catch (err) {
    console.error('[ops-copilot] 日報敘述生成失敗：', err)
    return { text: fallbackHeadline(signals), degraded: true }
  }
}

/**
 * 產生一份完整日報。
 * @param persist  false = 只看不寫（純預覽，不建立提案、不標過期）
 */
export async function generateBriefing(
  payload: PayloadLike,
  opts: { persist?: boolean } = {},
): Promise<OpsBriefing> {
  const persist = opts.persist !== false

  const { signals } = await collectSignals(payload)

  let proposedActionIds: Array<string | number> = []
  if (persist) {
    await expireStaleProposals(payload)
    proposedActionIds = await persistProposals(payload, signals)
  }

  const { text, degraded } = await narrate(signals)

  return {
    generatedAt: new Date().toISOString(),
    headline: text,
    signals,
    proposedActionIds,
    degraded,
  }
}
