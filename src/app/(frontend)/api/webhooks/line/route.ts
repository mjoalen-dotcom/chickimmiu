import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { getLineConfig, getProfile, replyMessage, textMessage } from '@/lib/line/client'
import { verifyLineSignature } from '@/lib/line/verifySignature'

/**
 * LINE Messaging API webhook（repo 第一個外部 inbound webhook）
 * ------------------------------------------------------------
 * LINE Developers Console 的 webhook URL 指到這裡（單一值 — 切過來後
 * Shopline 端 LINE 功能即失效，總開關 confirm 已提示過）。
 *
 * 安全：先讀 raw text 驗 `x-line-signature`（HMAC-SHA256 base64）再 JSON.parse。
 * 缺 secret 時回 200 但不處理（LINE 會重試失敗 webhook；憑證沒配好前別累積 retry）。
 *
 * 時限：LINE 要求盡快回 200（官方建議 < 1s）— event 處理全部 fire-and-forget。
 *
 * Event 處理：
 *   message → externalId（messageId）dedup → upsert Conversation
 *             （externalThreadId = source.userId, channel='line'）→ create Message(in)
 *   follow  → 回 cs-settings.greeting.line 歡迎詞（reply token 失效 fallback push）
 *   unfollow → 對應會員 lineSubscribed = false（封鎖/移除好友後推播必失敗）
 *
 * 後台 inbox 人工回覆 UI 未做 — 進來的訊息在 admin Conversations/Messages
 * collection list 檢視（客服中心 1B-1G 另案）。
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type LineEvent = {
  type: string
  timestamp?: number
  replyToken?: string
  source?: { type?: string; userId?: string }
  message?: {
    id?: string
    type?: string
    text?: string
    stickerId?: string
    packageId?: string
  }
}

/** 純文字 → 最小 Lexical richText state（Messages.body 是 richText 欄位） */
function textToRichText(text: string): Record<string, unknown> {
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: null,
      children: [
        {
          type: 'paragraph',
          format: '',
          indent: 0,
          version: 1,
          direction: null,
          children: [{ type: 'text', version: 1, text }],
        },
      ],
    },
  }
}

/** message event 的顯示文字（非文字訊息給 placeholder，附件補抓另案） */
function messageText(msg: LineEvent['message']): string {
  if (!msg) return ''
  if (msg.type === 'text') return msg.text || ''
  const kindLabel: Record<string, string> = {
    image: '［圖片］',
    video: '［影片］',
    audio: '［語音］',
    sticker: '［貼圖］',
    file: '［檔案］',
    location: '［位置］',
  }
  return kindLabel[msg.type || ''] || `［${msg.type || '未知類型'}訊息］`
}

async function handleMessageEvent(event: LineEvent): Promise<void> {
  const payload = await getPayload({ config })
  const lineUserId = event.source?.userId
  const messageId = event.message?.id
  if (!lineUserId || !messageId) return

  // dedup：LINE webhook 可能重送同一 event
  const dup = await payload.find({
    collection: 'messages',
    where: { externalId: { equals: messageId } },
    limit: 1,
    depth: 0,
  })
  if (dup.docs.length > 0) return

  // upsert Conversation（open thread 優先；全 closed 就開新工單）
  let conversationId: string | number
  const existing = await payload.find({
    collection: 'conversations',
    where: {
      and: [
        { externalThreadId: { equals: lineUserId } },
        { channel: { equals: 'line' } },
        { status: { not_in: ['closed'] } },
      ],
    },
    limit: 1,
    depth: 0,
    sort: '-createdAt',
  })
  if (existing.docs.length > 0) {
    conversationId = existing.docs[0].id as string | number
  } else {
    // 嘗試對回會員：lineUid（Messaging API userId）優先；
    // 注意 lineId（Login OIDC sub）與 lineUid 是不同 namespace，不可互通假設
    let customerId: string | number | undefined
    try {
      const byUid = await payload.find({
        collection: 'users',
        where: { lineUid: { equals: lineUserId } },
        limit: 1,
        depth: 0,
      })
      if (byUid.docs.length > 0) customerId = byUid.docs[0].id as string | number
    } catch {
      /* 對不回就走 guest */
    }
    const profile = await getProfile(payload, lineUserId)
    const text = messageText(event.message)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conv = await (payload as any).create({
      collection: 'conversations',
      data: {
        externalThreadId: lineUserId,
        channel: 'line',
        subject: text.slice(0, 30) || 'LINE 來訊',
        status: 'open',
        ...(customerId !== undefined ? { customer: customerId } : {}),
        ...(profile?.displayName ? { guestName: profile.displayName } : {}),
      },
      overrideAccess: true,
    })
    conversationId = conv.id as string | number
  }

  const text = messageText(event.message)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (payload as any).create({
    collection: 'messages',
    data: {
      conversation: conversationId,
      direction: 'in',
      sender: 'customer',
      body: textToRichText(text),
      externalId: messageId,
      ...(event.replyToken ? { replyToExternalId: event.replyToken } : {}),
    },
    overrideAccess: true,
  })
}

async function handleFollowEvent(event: LineEvent): Promise<void> {
  const payload = await getPayload({ config })
  const lineUserId = event.source?.userId
  if (!lineUserId) return

  // 加好友 → 對應會員重新開啟 LINE 訂閱
  try {
    const byUid = await payload.find({
      collection: 'users',
      where: { lineUid: { equals: lineUserId } },
      limit: 1,
      depth: 0,
    })
    if (byUid.docs.length > 0) {
      const u = byUid.docs[0] as unknown as { id: string | number; subscriptionStatus?: Record<string, unknown> }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (payload.update as any)({
        collection: 'users',
        id: u.id,
        data: { subscriptionStatus: { ...(u.subscriptionStatus || {}), lineSubscribed: true } },
        overrideAccess: true,
      })
    }
  } catch {
    /* best-effort */
  }

  // 歡迎詞（cs-settings.greeting.line；沒設定就不回）
  try {
    const cs = (await payload.findGlobal({ slug: 'cs-settings', depth: 0 })) as unknown as {
      greeting?: { line?: string }
    }
    const greeting = (cs?.greeting?.line || '').trim()
    if (greeting && event.replyToken) {
      await replyMessage(payload, event.replyToken, [textMessage(greeting)], lineUserId)
    }
  } catch (e) {
    console.error('[webhooks/line] follow 歡迎詞發送失敗:', e instanceof Error ? e.message : String(e))
  }
}

async function handleUnfollowEvent(event: LineEvent): Promise<void> {
  const payload = await getPayload({ config })
  const lineUserId = event.source?.userId
  if (!lineUserId) return
  try {
    const byUid = await payload.find({
      collection: 'users',
      where: { lineUid: { equals: lineUserId } },
      limit: 1,
      depth: 0,
    })
    if (byUid.docs.length > 0) {
      const u = byUid.docs[0] as unknown as { id: string | number; subscriptionStatus?: Record<string, unknown> }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (payload.update as any)({
        collection: 'users',
        id: u.id,
        data: { subscriptionStatus: { ...(u.subscriptionStatus || {}), lineSubscribed: false } },
        overrideAccess: true,
      })
    }
  } catch {
    /* best-effort */
  }
}

async function processEvents(events: LineEvent[]): Promise<void> {
  for (const event of events) {
    try {
      switch (event.type) {
        case 'message':
          await handleMessageEvent(event)
          break
        case 'follow':
          await handleFollowEvent(event)
          break
        case 'unfollow':
          await handleUnfollowEvent(event)
          break
        default:
          // join / leave / postback 等先不處理
          break
      }
    } catch (e) {
      console.error(
        `[webhooks/line] event 處理失敗 (type=${event.type}):`,
        e instanceof Error ? e.message : String(e),
      )
    }
  }
}

export async function POST(request: Request) {
  // 先讀 raw body 驗章，驗過才 parse（JSON.parse 後重 stringify 驗不過）
  const rawBody = await request.text()
  const signature = request.headers.get('x-line-signature')

  const payload = await getPayload({ config })
  const cfg = await getLineConfig(payload)
  if (!cfg.secret) {
    // 憑證沒配好前回 200，避免 LINE 累積 retry；不處理任何 event（無法驗真偽）
    console.warn('[webhooks/line] 缺 channel secret，忽略 webhook（回 200）')
    return NextResponse.json({ ok: true, skipped: 'secret_not_configured' })
  }
  if (!verifyLineSignature(rawBody, signature, cfg.secret)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
  }

  let body: { events?: LineEvent[] }
  try {
    body = JSON.parse(rawBody) as { events?: LineEvent[] }
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const events = Array.isArray(body.events) ? body.events : []
  if (events.length > 0) {
    // fire-and-forget：LINE 要求 < 1s 回 200，處理丟背景
    processEvents(events).catch((e) =>
      console.error('[webhooks/line] processEvents 未捕捉錯誤:', e instanceof Error ? e.message : String(e)),
    )
  }
  return NextResponse.json({ ok: true })
}
