import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { checkRateLimit } from '@/lib/rateLimit'
import { generateAiReply, isHumanHandoffRequest, type CsCategory } from '@/lib/cs/aiReply'
import { evaluateBusinessHours, type BusinessHoursConfig } from '@/lib/cs/businessHours'
import { loadKnowledgeBase } from '@/lib/cs/knowledgeBase'
import { richTextToPlain, textToRichText } from '@/lib/cs/messageBody'
import {
  CS_AI_ENABLED,
  CS_DISCLAIMER,
  CS_EXTRA_ESCALATE_KEYWORDS,
  CS_HANDOFF_MESSAGE,
  CS_HUMAN_MODE_ACK,
  CS_HUMAN_REQUEST_MESSAGE,
} from '@/lib/cs/settings'

/**
 * 站內 Web Chat 端點（客服中心 Phase 1C + 6）
 * ─────────────────────────────────────────
 * POST /api/cs/chat  客戶送一句話 → AI 回一句，兩則都落地成 Messages
 *   body.requestHuman=true → 略過 AI，直接進「留言給真人」模式
 * GET  /api/cs/chat?conversationId=  重新整理後接回同一串對話
 *
 * 留言模式（Alan 2026-09-02）：客戶不想跟機器人耗的時候，按一個鍵或直接說
 * 「我要找真人」就切過去。切過去之後 AI 在這串對話裡不再作答，只回收到回條，
 * 訊息全部留給真人客服看——讓機器人繼續搭話只會讓已經不耐煩的客戶更火。
 * 標記存在 conversations.channelMetadata.humanRequested（既有 json 欄，免動 schema）。
 *
 * 為什麼每則都寫 DB（而不是純前端記憶）：
 *   客服中心的價值在於「AI 答不出來時真人能無縫接手」。訊息不落地，
 *   轉真人時客服看不到前情，等於重問一次。
 *
 * 權限：conversations/messages 的 access 都是 isAdmin，所以本路由一律
 * overrideAccess，改由這裡自己驗擁有權（anonId cookie 或登入的 customer）。
 * 任何回傳給前端的訊息都會濾掉 internal（內部備註只給 staff）。
 */

const ANON_COOKIE = 'ckmu_cs_anon'
const ANON_MAX_AGE = 60 * 60 * 24 * 180 // 180 天
const MAX_MESSAGE_LEN = 1000
const HISTORY_LIMIT = 50

/** 對話仍可續談的狀態（已結案/垃圾訊息就開新的一串） */
const ACTIVE_STATUSES = ['open', 'pending', 'ai_handling', 'awaiting_customer'] as const

interface CsSettings {
  businessHours?: BusinessHoursConfig
  greeting?: { web?: string | null }
  antiSpam?: {
    maxMessagesPerMinute?: number | null
    blockedKeywords?: Array<{ keyword?: string | null }>
    blockedAnonIds?: Array<{ anonId?: string | null }>
    blockedIPs?: Array<{ ip?: string | null }>
  }
}

async function getSettings(payload: Awaited<ReturnType<typeof getPayload>>): Promise<CsSettings> {
  try {
    return (await payload.findGlobal({ slug: 'cs-settings', depth: 0 })) as unknown as CsSettings
  } catch {
    return {}
  }
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') || ''
}

/** 登入者必須是 customers；users（後台管理員）不當客服對話的 customer 綁定 */
async function resolveCustomer(
  payload: Awaited<ReturnType<typeof getPayload>>,
  req: NextRequest,
): Promise<{ id: string | number; name?: string; email?: string } | null> {
  try {
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || user.collection !== 'customers') return null
    const u = user as unknown as { id: string | number; name?: string; email?: string }
    return { id: u.id, name: u.name, email: u.email }
  } catch {
    return null
  }
}

/** 對話是否已經交給真人（客戶按過「轉真人客服」或講過要找真人） */
function isHumanMode(conv: Record<string, unknown> | null | undefined): boolean {
  const meta = conv?.channelMetadata
  return !!(meta && typeof meta === 'object' && (meta as Record<string, unknown>).humanRequested)
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: '無法解析請求' }, { status: 400 })
  }

  const requestHuman = body.requestHuman === true
  const message = String(body.message ?? '').trim()
  if (!message && !requestHuman) {
    return NextResponse.json({ ok: false, error: '請輸入訊息' }, { status: 400 })
  }
  if (message.length > MAX_MESSAGE_LEN) {
    return NextResponse.json(
      { ok: false, error: `訊息請控制在 ${MAX_MESSAGE_LEN} 字以內` },
      { status: 400 },
    )
  }

  const payload = await getPayload({ config })
  const settings = await getSettings(payload)
  const customer = await resolveCustomer(payload, req)

  // anonId：cookie 優先，沒有就發一個（登入客戶也留著，方便登入前後串同一段對話）
  const cookieAnon = req.cookies.get(ANON_COOKIE)?.value
  const anonId = cookieAnon || `web_${randomUUID()}`

  /* ── 防濫用 ─────────────────────────────────────────────── */
  const ip = clientIp(req)
  const blockedAnon = (settings.antiSpam?.blockedAnonIds || []).map((x) => String(x?.anonId || ''))
  const blockedIps = (settings.antiSpam?.blockedIPs || []).map((x) => String(x?.ip || ''))
  if (blockedAnon.includes(anonId) || (ip && blockedIps.includes(ip))) {
    return NextResponse.json({ ok: false, error: '目前無法使用線上客服，請改用 LINE 聯繫我們' }, { status: 403 })
  }

  const perMinute = Number(settings.antiSpam?.maxMessagesPerMinute) || 5
  const limit = checkRateLimit(`cs-chat:${anonId}`, perMinute, 60_000)
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: `訊息太快了，請 ${limit.retryAfter} 秒後再試` },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    )
  }

  const blockedKeywords = (settings.antiSpam?.blockedKeywords || [])
    .map((x) => String(x?.keyword || '').trim().toLowerCase())
    .filter(Boolean)
  const isSpam = blockedKeywords.some((k) => message.toLowerCase().includes(k))

  /* ── 取得／建立對話 ─────────────────────────────────────── */
  let conversationId: string | number | null = null
  let currentStatus = ''
  let humanMode = false
  const requestedId = body.conversationId
  if (requestedId !== undefined && requestedId !== null && String(requestedId).length) {
    try {
      const conv = (await payload.findByID({
        collection: 'conversations',
        id: requestedId as string,
        depth: 0,
        overrideAccess: true,
      })) as unknown as Record<string, unknown>
      const ownedByAnon = conv?.anonId === anonId
      const ownedByCustomer = customer != null && String(conv?.customer ?? '') === String(customer.id)
      const active = (ACTIVE_STATUSES as readonly string[]).includes(String(conv?.status))
      if ((ownedByAnon || ownedByCustomer) && active) {
        conversationId = conv.id as string | number
        currentStatus = String(conv.status)
        humanMode = isHumanMode(conv)
      }
    } catch {
      // 找不到就當作新對話
    }
  }

  if (conversationId === null) {
    const existing = await payload.find({
      collection: 'conversations',
      where: {
        and: [
          { anonId: { equals: anonId } },
          { channel: { equals: 'web' } },
          { status: { in: [...ACTIVE_STATUSES] } },
        ],
      },
      sort: '-createdAt',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.docs.length) {
      const doc = existing.docs[0] as unknown as Record<string, unknown>
      conversationId = doc.id as string | number
      currentStatus = String(doc.status)
      humanMode = isHumanMode(doc)
    }
  }

  if (conversationId === null) {
    // source 是「觸發頁面 URL」自由文字欄，不是 enum；前端把當下網址帶上來
    const pageUrl = String(body.pageUrl ?? '').trim().slice(0, 500)
    const created = await payload.create({
      collection: 'conversations',
      data: {
        channel: 'web',
        status: isSpam ? 'spam' : 'ai_handling',
        anonId,
        subject: message.slice(0, 30) || '客戶要求真人客服',
        ...(pageUrl ? { source: pageUrl } : {}),
        ...(customer ? { customer: customer.id } : {}),
        ...(customer?.name ? { guestName: customer.name } : {}),
        ...(customer?.email ? { guestEmail: customer.email } : {}),
      } as never,
      depth: 0,
      overrideAccess: true,
    })
    conversationId = created.id as string | number
    currentStatus = isSpam ? 'spam' : 'ai_handling'
  } else if (customer) {
    // 訪客中途登入 → 把 customer 補上（anonId 保留，維持同一串）
    await payload
      .update({
        collection: 'conversations',
        id: conversationId,
        data: { customer: customer.id } as never,
        depth: 0,
        overrideAccess: true,
      })
      .catch(() => null)
  }

  /* ── 落地客戶訊息 ───────────────────────────────────────── */
  if (message) {
    await payload.create({
      collection: 'messages',
      data: {
        conversation: conversationId,
        direction: 'in',
        sender: 'customer',
        body: textToRichText(message),
      } as never,
      depth: 0,
      overrideAccess: true,
    })
  }

  const res = (payloadBody: Record<string, unknown>, status = 200) => {
    const r = NextResponse.json(payloadBody, { status })
    if (!cookieAnon) {
      r.cookies.set(ANON_COOKIE, anonId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: ANON_MAX_AGE,
      })
    }
    return r
  }

  if (isSpam) {
    await payload
      .update({
        collection: 'conversations',
        id: conversationId,
        data: { status: 'spam' } as never,
        depth: 0,
        overrideAccess: true,
      })
      .catch(() => null)
    return res({
      ok: true,
      conversationId,
      reply: '訊息已收到。若您有購物相關問題，歡迎透過 LINE 官方帳號與我們聯繫。',
      escalated: false,
    })
  }

  const hours = evaluateBusinessHours(settings.businessHours)
  const offHourReply = (settings.businessHours?.offHourAutoReply || '').trim()

  /* ── 轉真人／留言模式 ───────────────────────────────────── */
  // 客戶按了「轉真人客服」，或訊息裡就寫著要找真人 → 不要再讓機器人接話。
  // 進入這個模式後，這串對話的 AI 就退場，客戶留的每句話都直接進客服待辦。
  const wantsHuman = requestHuman || (message ? isHumanHandoffRequest(message) : false)

  if (wantsHuman || humanMode) {
    const firstTime = !humanMode
    await payload
      .update({
        collection: 'conversations',
        id: conversationId,
        data: {
          status: 'open',
          unread: true,
          ...(firstTime
            ? {
                priority: 'high',
                channelMetadata: {
                  humanRequested: true,
                  humanRequestedAt: new Date().toISOString(),
                },
              }
            : {}),
        } as never,
        depth: 0,
        overrideAccess: true,
      })
      .catch((err) => {
        payload.logger.error({ err, msg: 'cs-chat: 標記轉真人失敗' })
        return null
      })

    if (firstTime) {
      // 給客服一則系統訊息，後台一眼看得出這張單是客戶自己要求真人的
      await payload
        .create({
          collection: 'messages',
          data: {
            conversation: conversationId,
            direction: 'in',
            sender: 'system',
            body: textToRichText('［客戶要求轉真人客服］'),
          } as never,
          depth: 0,
          overrideAccess: true,
        })
        .catch(() => null)
    }

    const humanReply = firstTime ? CS_HUMAN_REQUEST_MESSAGE : CS_HUMAN_MODE_ACK
    const humanText = hours.open || !offHourReply ? humanReply : `${humanReply}\n\n${offHourReply}`

    await payload.create({
      collection: 'messages',
      data: {
        conversation: conversationId,
        direction: 'out',
        sender: 'system',
        body: textToRichText(humanText),
      } as never,
      depth: 0,
      overrideAccess: true,
    })

    return res({
      ok: true,
      conversationId,
      reply: humanText,
      escalated: true,
      humanMode: true,
      businessHoursOpen: hours.open,
      disclaimer: CS_DISCLAIMER,
    })
  }

  /* ── AI 回覆 ────────────────────────────────────────────── */
  const aiEnabled = CS_AI_ENABLED

  // 前情：本串最近幾則（濾掉內部備註）
  const priorRes = await payload.find({
    collection: 'messages',
    where: { and: [{ conversation: { equals: conversationId } }, { internal: { not_equals: true } }] },
    sort: '-createdAt',
    limit: 8,
    depth: 0,
    overrideAccess: true,
  })
  const history = priorRes.docs
    .slice()
    .reverse()
    .slice(0, -1) // 去掉剛剛寫進去的這一則（已在 question 帶入）
    .map((m) => {
      const d = m as unknown as Record<string, unknown>
      return {
        role: (d.direction === 'in' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: richTextToPlain(d.body).slice(0, 300),
      }
    })
    .filter((h) => h.content)

  let reply = ''
  let escalate = true
  let escalateReason = 'AI 客服已關閉'
  let category: CsCategory = 'other'
  let aiUsed = false

  if (aiEnabled) {
    const kb = await loadKnowledgeBase()
    const result = await generateAiReply({
      question: message,
      history,
      kb,
      extraEscalateKeywords: CS_EXTRA_ESCALATE_KEYWORDS,
    })
    reply = result.reply
    escalate = result.escalate
    escalateReason = result.escalateReason || ''
    category = result.category
    aiUsed = result.source === 'ai'
  }

  if (escalate) {
    // 模型常常自己就寫了「幫您轉真人」，再接一句會變成同一句講兩遍；
    // 但「現在非營業時間」那段不能跟著被吃掉——那是客戶最需要知道的資訊，
    // 所以兩段分開判斷，只去重轉接語。
    const parts: string[] = []
    if (reply) parts.push(reply)
    if (!/真人客服|轉接客服|客服夥伴/.test(reply)) parts.push(CS_HANDOFF_MESSAGE)
    if (!hours.open && offHourReply) parts.push(offHourReply)
    reply = parts.join('\n\n')
  }

  await payload.create({
    collection: 'messages',
    data: {
      conversation: conversationId,
      direction: 'out',
      sender: 'ai',
      body: textToRichText(reply),
      aiUsed,
    } as never,
    depth: 0,
    overrideAccess: true,
  })

  // 轉真人 → open + 未讀，讓後台收件匣看得到。
  // 反向不成立：已經交給真人的對話（open/pending/awaiting_customer），
  // 就算後面某一則 AI 答得出來也不能降回 ai_handling、更不能清掉未讀，
  // 否則客服那邊會憑空少一張待辦。
  const nextStatus = escalate
    ? 'open'
    : currentStatus === 'ai_handling' || !currentStatus
      ? 'ai_handling'
      : currentStatus
  await payload
    .update({
      collection: 'conversations',
      id: conversationId,
      data: {
        status: nextStatus,
        ...(escalate ? { unread: true } : nextStatus === 'ai_handling' ? { unread: false } : {}),
        ...(category !== 'other' ? { category } : {}),
      } as never,
      depth: 0,
      overrideAccess: true,
    })
    .catch((err) => {
      payload.logger.error({ err, msg: 'cs-chat: 更新對話狀態失敗' })
      return null
    })

  return res({
    ok: true,
    conversationId,
    reply,
    escalated: escalate,
    escalateReason: escalate ? escalateReason : undefined,
    businessHoursOpen: hours.open,
    humanMode: false,
    disclaimer: CS_DISCLAIMER,
  })
}

/**
 * 開窗時呼叫：回傳前台需要的設定（開關/歡迎詞/免責）＋ 接回上次對話。
 * 設定放這裡而不是 layout 的 SSR props，是為了不在每個頁面多打一次 global 查詢。
 */
export async function GET(req: NextRequest) {
  const payload = await getPayload({ config })
  const settings = await getSettings(payload)
  const uiConfig = {
    aiEnabled: CS_AI_ENABLED,
    greeting: (settings.greeting?.web || '').trim() || undefined,
    disclaimer: CS_DISCLAIMER,
  }

  const conversationId = req.nextUrl.searchParams.get('conversationId')
  const anonId = req.cookies.get(ANON_COOKIE)?.value
  if (!conversationId || !anonId) {
    return NextResponse.json({ ok: true, config: uiConfig, conversationId: null, messages: [] })
  }

  const customer = await resolveCustomer(payload, req)

  try {
    const conv = (await payload.findByID({
      collection: 'conversations',
      id: conversationId,
      depth: 0,
      overrideAccess: true,
    })) as unknown as Record<string, unknown>

    const ownedByAnon = conv?.anonId === anonId
    const ownedByCustomer = customer != null && String(conv?.customer ?? '') === String(customer.id)
    if (!ownedByAnon && !ownedByCustomer) {
      return NextResponse.json({ ok: true, config: uiConfig, conversationId: null, messages: [] })
    }

    const msgs = await payload.find({
      collection: 'messages',
      where: {
        and: [{ conversation: { equals: conversationId } }, { internal: { not_equals: true } }],
      },
      sort: 'createdAt',
      limit: HISTORY_LIMIT,
      depth: 0,
      overrideAccess: true,
    })

    return NextResponse.json({
      ok: true,
      config: uiConfig,
      conversationId: conv.id,
      status: conv.status,
      humanMode: isHumanMode(conv),
      messages: msgs.docs.map((m) => {
        const d = m as unknown as Record<string, unknown>
        return {
          id: d.id,
          role: d.direction === 'in' ? 'user' : 'assistant',
          sender: d.sender,
          text: richTextToPlain(d.body),
          createdAt: d.createdAt,
        }
      }),
    })
  } catch {
    return NextResponse.json({ ok: true, config: uiConfig, conversationId: null, messages: [] })
  }
}
