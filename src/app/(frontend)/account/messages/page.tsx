import type { Metadata } from 'next'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import MessagesClient, { type NotificationItem } from './MessagesClient'

export const metadata: Metadata = {
  title: '訊息信箱',
  robots: { index: false, follow: false },
}

/**
 * /account/messages — 會員訊息信箱（2026-08-22 需求 ③）
 * ────────────────────────────────────────────────────
 * SSR 撈最近 50 則 + 未讀數；分類篩選、標已讀在 client 端
 * （打 /api/v1/notifications/read，與 App 同一組端點）。
 */
export default async function MessagesPage() {
  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user } = await payload.auth({ headers: headersList })
  if (!user || user.collection !== 'customers') {
    redirect('/login?redirect=/account/messages')
  }

  const [list, unread] = await Promise.all([
    payload.find({
      collection: 'notifications',
      where: { recipient: { equals: user.id } },
      sort: '-createdAt',
      limit: 50,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'notifications',
      where: {
        and: [{ recipient: { equals: user.id } }, { readAt: { exists: false } }],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    }),
  ])

  const items: NotificationItem[] = list.docs.map((d) => {
    const n = d as unknown as Record<string, unknown>
    return {
      id: String(n.id),
      category: String(n.category ?? 'system') as NotificationItem['category'],
      title: String(n.title ?? ''),
      body: (n.body as string | null) ?? null,
      link: (n.link as string | null) ?? null,
      read: Boolean(n.readAt),
      createdAt: String(n.createdAt ?? ''),
    }
  })

  return (
    <MessagesClient
      initialItems={items}
      initialUnread={unread.totalDocs}
      totalDocs={list.totalDocs}
    />
  )
}
