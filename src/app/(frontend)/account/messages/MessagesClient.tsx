'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck, Package, Coins, Tag, BookOpen, Megaphone } from 'lucide-react'

/**
 * 訊息信箱 client（2026-08-22 需求 ③）
 * ──────────────────────────────────
 * - 分類 tabs（全部 + 5 類）client 端過濾 SSR 給的最近 50 則
 * - 點一則：標已讀（樂觀更新 + 打 /api/v1/notifications/read）→ 有連結就導頁
 * - 全部已讀：all:true
 * - 未讀標示 = 深色圓點 + 粗體標題（形狀+字重雙重編碼，不只靠顏色）
 */

export type NotificationItem = {
  id: string
  category: 'order' | 'points' | 'promo' | 'blog' | 'system'
  title: string
  body: string | null
  link: string | null
  read: boolean
  createdAt: string
}

const CATEGORY_META = {
  order: { label: '訂單物流', icon: Package },
  points: { label: '點數獎勵', icon: Coins },
  promo: { label: '優惠活動', icon: Tag },
  blog: { label: '部落格互動', icon: BookOpen },
  system: { label: '系統公告', icon: Megaphone },
} as const

type TabKey = 'all' | keyof typeof CATEGORY_META

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    const now = Date.now()
    const diffMin = Math.floor((now - d.getTime()) / 60000)
    if (diffMin < 1) return '剛剛'
    if (diffMin < 60) return `${diffMin} 分鐘前`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr} 小時前`
    return d.toLocaleDateString('zh-TW')
  } catch {
    return ''
  }
}

async function postRead(payload: { ids?: string[]; all?: boolean }) {
  try {
    await fetch('/api/v1/notifications/read', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    // 離線時樂觀狀態下次重載會校正，不打擾使用者
  }
}

export default function MessagesClient({
  initialItems,
  initialUnread,
  totalDocs,
}: {
  initialItems: NotificationItem[]
  initialUnread: number
  totalDocs: number
}) {
  const router = useRouter()
  const [items, setItems] = useState(initialItems)
  const [unread, setUnread] = useState(initialUnread)
  const [tab, setTab] = useState<TabKey>('all')

  const filtered = useMemo(
    () => (tab === 'all' ? items : items.filter((i) => i.category === tab)),
    [items, tab],
  )

  const onItemClick = (item: NotificationItem) => {
    if (!item.read) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read: true } : i)))
      setUnread((n) => Math.max(0, n - 1))
      void postRead({ ids: [item.id] })
    }
    if (item.link) router.push(item.link)
  }

  const onMarkAll = () => {
    if (unread === 0) return
    setItems((prev) => prev.map((i) => ({ ...i, read: true })))
    setUnread(0)
    void postRead({ all: true })
  }

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'all', label: '全部' },
    ...Object.entries(CATEGORY_META).map(([key, meta]) => ({
      key: key as TabKey,
      label: meta.label,
    })),
  ]

  return (
    <div className="bg-white rounded-2xl border border-cream-200 overflow-hidden">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 border-b border-cream-200">
        <div className="flex items-center gap-2.5">
          <Bell size={18} className="text-gold-600" />
          <h2 className="text-lg font-serif">訊息信箱</h2>
          {unread > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-neutral-900 text-white text-[11px] font-medium">
              {unread > 99 ? '99+' : unread} 未讀
            </span>
          )}
        </div>
        <button
          onClick={onMarkAll}
          disabled={unread === 0}
          className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-foreground disabled:opacity-40 disabled:cursor-default underline underline-offset-4 transition-colors"
        >
          <CheckCheck size={14} /> 全部標為已讀
        </button>
      </div>

      {/* category tabs */}
      <div className="flex gap-2 px-6 py-3 border-b border-cream-200 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
              tab === t.key
                ? 'bg-neutral-900 text-white font-medium'
                : 'bg-cream-50 border border-cream-200 text-foreground/70 hover:border-neutral-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* list */}
      {filtered.length === 0 ? (
        <div className="py-20 text-center">
          <Bell size={28} className="mx-auto mb-4 text-neutral-300" />
          <p className="text-sm text-neutral-500">
            {tab === 'all' ? '目前沒有訊息' : `沒有「${tabs.find((t) => t.key === tab)?.label}」訊息`}
          </p>
          <p className="text-xs text-neutral-400 mt-2">
            訂單狀態、點數入帳、活動通知都會出現在這裡
          </p>
        </div>
      ) : (
        <ul>
          {filtered.map((item) => {
            const meta = CATEGORY_META[item.category] ?? CATEGORY_META.system
            const IconComp = meta.icon
            return (
              <li key={item.id} className="border-b border-cream-100 last:border-b-0">
                <button
                  onClick={() => onItemClick(item)}
                  className="w-full text-left px-6 py-4 flex gap-3.5 hover:bg-cream-50 transition-colors"
                >
                  <span className="mt-0.5 shrink-0 w-8 h-8 rounded-full bg-cream-50 border border-cream-200 flex items-center justify-center text-neutral-500">
                    <IconComp size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      {!item.read && (
                        <span className="shrink-0 w-2 h-2 rounded-full bg-neutral-900" aria-label="未讀" />
                      )}
                      <span
                        className={`text-sm truncate ${item.read ? 'text-foreground/70' : 'font-medium text-foreground'}`}
                      >
                        {item.title}
                      </span>
                    </span>
                    {item.body && (
                      <span className="block text-xs text-neutral-500 mt-1 line-clamp-2">{item.body}</span>
                    )}
                    <span className="block text-[11px] text-neutral-400 mt-1.5">
                      {meta.label} · {formatTime(item.createdAt)}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {totalDocs > initialItems.length && (
        <p className="px-6 py-3 text-[11px] text-neutral-400 border-t border-cream-200">
          僅顯示最近 {initialItems.length} 則（共 {totalDocs} 則）
        </p>
      )}
    </div>
  )
}
