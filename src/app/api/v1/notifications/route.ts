import { NextRequest, NextResponse } from 'next/server'
import type { Where } from 'payload'

import { resolveApiUser } from '@/lib/auth/resolveApiUser'

/**
 * 會員通知信箱 API（2026-08-22 需求 ③）
 *   GET /api/v1/notifications — 自己的通知列表 + 未讀數
 *     query: category=order|points|promo|blog|system（可省略）
 *            unread=1（只看未讀）
 *            limit（1–50，預設 20）、page（預設 1）
 *
 * 認證：payload.auth 原生同時吃 cookie（網站）與 Authorization: Bearer（App），
 * 一組端點雙端共用。僅限 customers collection 身分 — users(admin) 的 id 與
 * customers 的 id 是不同號碼空間，混用會撈到別人的信。
 */

const CATEGORIES = ['order', 'points', 'promo', 'blog', 'system'] as const

export async function GET(req: NextRequest) {
  try {
    const { payload, user } = await resolveApiUser(req.headers)
    if (!user) {
      return NextResponse.json({ success: false, error: '請先登入' }, { status: 401 })
    }
    if (user.collection !== 'customers') {
      return NextResponse.json({ success: false, error: '僅限會員帳號' }, { status: 403 })
    }

    const sp = req.nextUrl.searchParams
    const category = sp.get('category')
    const unreadOnly = sp.get('unread') === '1' || sp.get('unread') === 'true'
    const limit = Math.min(50, Math.max(1, Number(sp.get('limit')) || 20))
    const page = Math.max(1, Number(sp.get('page')) || 1)

    const and: Where[] = [{ recipient: { equals: user.id } }]
    if (category && (CATEGORIES as readonly string[]).includes(category)) {
      and.push({ category: { equals: category } })
    }
    if (unreadOnly) {
      and.push({ readAt: { exists: false } })
    }

    const [list, unread] = await Promise.all([
      payload.find({
        collection: 'notifications',
        where: { and },
        sort: '-createdAt',
        limit,
        page,
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

    return NextResponse.json({
      success: true,
      data: {
        docs: list.docs.map((d) => {
          const n = d as unknown as Record<string, unknown>
          return {
            id: n.id,
            category: n.category,
            title: n.title,
            body: n.body ?? null,
            link: n.link ?? null,
            readAt: n.readAt ?? null,
            createdAt: n.createdAt,
          }
        }),
        totalDocs: list.totalDocs,
        page: list.page,
        totalPages: list.totalPages,
        unreadCount: unread.totalDocs,
      },
    })
  } catch (error) {
    console.error('[notifications GET] error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
