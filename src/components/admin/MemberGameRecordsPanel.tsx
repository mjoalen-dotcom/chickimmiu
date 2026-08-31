'use client'

/**
 * MemberGameRecordsPanel
 * ──────────────────────
 * 會員編輯頁的「遊樂場活動記錄」內容。
 *
 * 取代舊的 customers.gameActivity group — 那組 readOnly 欄位全站沒有任何寫入點，
 * 永遠顯示 0 / 空白，看起來像「沒有正確紀錄」。真實資料一直在 mini-game-records。
 *
 * 讀 Payload REST API（cookie-based auth 自動跟）：
 *   GET /api/mini-game-records?where[player][equals]=<id>&limit=200&sort=-createdAt
 *
 * mini-game-records.player relationTo 是 customers，所以只在 customers 編輯頁有意義；
 * 其他 collection（如後台員工 users）顯示指引而不是空表格。
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useDocumentInfo } from '@payloadcms/ui'

type GameRow = {
  id: string | number
  gameType: string
  result?: {
    outcome?: string | null
    prizeType?: string | null
    prizeAmount?: number | null
    prizeDescription?: string | null
    couponCode?: string | null
  } | null
  pointsSpent?: number | null
  status?: string | null
  createdAt: string
}

const GAME_TYPE_LABEL: Record<string, string> = {
  spin_wheel: '轉盤抽獎',
  scratch_card: '刮刮樂',
  daily_checkin: '每日簽到',
  movie_lottery: '電影抽獎',
  fashion_challenge: '穿搭挑戰',
  card_battle: '抽卡片比大小',
  style_pk: '穿搭 PK',
  style_relay: '穿搭接龍',
  weekly_challenge: '每週挑戰',
  co_create: '好友共創',
  blind_box: '穿搭盲盒',
  queen_vote: '女王投票',
  team_style: '團體穿搭房',
  wish_pool: '穿搭許願池',
  mbti_quiz: 'MBTI 個性測驗',
  leaderboard_daily: '[系統] 每日排行榜',
  leaderboard_weekly: '[系統] 每週排行榜',
  leaderboard_monthly: '[系統] 每月排行榜',
  leaderboard_all_time: '[系統] 全時段排行榜',
  leaderboard_daily_bonus: '[系統] 每日排行榜獎勵',
  leaderboard_weekly_bonus: '[系統] 每週排行榜獎勵',
  leaderboard_monthly_bonus: '[系統] 每月排行榜獎勵',
}

const OUTCOME_LABEL: Record<string, string> = {
  win: '贏',
  lose: '輸',
  draw: '平手',
  completed: '完成',
}

const PRIZE_TYPE_LABEL: Record<string, string> = {
  points: '點數',
  credit: '購物金',
  coupon: '優惠券',
  badge: '徽章',
  movie_ticket: '電影票',
  free_shipping: '免運券',
  physical_gift: '實體贈品',
  none: '無',
}

function fmtDate(raw?: string | null): string {
  if (!raw) return '—'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('zh-TW', { hour12: false })
}

const MemberGameRecordsPanel: React.FC = () => {
  const { id, collectionSlug } = useDocumentInfo()
  const [rows, setRows] = useState<GameRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isCustomer = collectionSlug === 'customers'

  const load = useCallback(async () => {
    if (!id || !isCustomer) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/mini-game-records?where[player][equals]=${encodeURIComponent(String(id))}&limit=200&sort=-createdAt&depth=0`,
        { credentials: 'include' },
      )
      if (!res.ok) throw new Error(`遊戲紀錄讀取失敗 (${res.status})`)
      const json = (await res.json()) as { docs: GameRow[] }
      setRows(json.docs || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '讀取失敗')
    } finally {
      setLoading(false)
    }
  }, [id, isCustomer])

  useEffect(() => {
    load()
  }, [load])

  const summary = useMemo(() => {
    const base = { total: 0, pointsSpent: 0, pointsWon: 0, creditWon: 0, favorite: '—' }
    if (!rows || rows.length === 0) return base
    const byType = new Map<string, number>()
    for (const r of rows) {
      base.total += 1
      base.pointsSpent += Number(r.pointsSpent) || 0
      const prizeType = r.result?.prizeType
      const amount = Number(r.result?.prizeAmount) || 0
      if (prizeType === 'points') base.pointsWon += amount
      else if (prizeType === 'credit') base.creditWon += amount
      byType.set(r.gameType, (byType.get(r.gameType) || 0) + 1)
    }
    let top = ''
    let topCount = 0
    for (const [type, count] of byType) {
      if (count > topCount) {
        top = type
        topCount = count
      }
    }
    if (top) base.favorite = `${GAME_TYPE_LABEL[top] || top}（${topCount} 次）`
    return base
  }, [rows])

  if (!isCustomer) {
    return (
      <div style={panel}>
        <h4 style={h4}>🎮 遊樂場活動記錄</h4>
        <p style={{ ...hint, marginBottom: 0 }}>
          遊戲紀錄（mini-game-records）掛在「顧客」collection 上。這裡是後台員工帳號，
          不會有遊樂場活動。請到「顧客」中開啟對應的會員資料查看。
        </p>
      </div>
    )
  }

  if (!id) {
    return (
      <div style={panel}>
        <h4 style={h4}>🎮 遊樂場活動記錄</h4>
        <p style={{ ...hint, marginBottom: 0 }}>此會員尚未存檔。請先儲存後，遊戲紀錄會顯示於此。</p>
      </div>
    )
  }

  return (
    <div style={panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={h4}>🎮 遊樂場活動記錄</h4>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          style={{
            fontSize: 12,
            padding: '4px 10px',
            border: '1px solid var(--theme-elevation-200, #d4d4d8)',
            borderRadius: 4,
            background: 'var(--theme-elevation-0, #fff)',
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading ? '讀取中…' : '重新整理'}
        </button>
      </div>
      <p style={hint}>依建立時間倒序，最多 200 筆。資料來源：迷你遊戲紀錄（mini-game-records）。</p>

      {error && (
        <p style={{ ...hint, color: '#dc2626', marginBottom: 12 }} role="alert">
          {error}
        </p>
      )}

      <div style={summaryGrid}>
        <div style={summaryCard}>
          <div style={summaryLabel}>總遊戲次數</div>
          <div style={summaryValue}>{summary.total}</div>
        </div>
        <div style={summaryCard}>
          <div style={summaryLabel}>消耗點數</div>
          <div style={{ ...summaryValue, color: '#dc2626' }}>-{summary.pointsSpent}</div>
        </div>
        <div style={summaryCard}>
          <div style={summaryLabel}>贏得點數</div>
          <div style={{ ...summaryValue, color: '#16a34a' }}>+{summary.pointsWon}</div>
        </div>
        <div style={summaryCard}>
          <div style={summaryLabel}>贏得購物金</div>
          <div style={{ ...summaryValue, color: '#16a34a' }}>+{summary.creditWon}</div>
        </div>
        <div style={summaryCard}>
          <div style={summaryLabel}>最常玩的遊戲</div>
          <div style={{ ...summaryValue, fontSize: 14 }}>{summary.favorite}</div>
        </div>
      </div>

      {rows && rows.length === 0 && (
        <p style={{ ...hint, marginBottom: 0 }}>此會員目前沒有任何遊樂場活動紀錄。</p>
      )}

      {rows && rows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>時間</th>
                <th style={th}>遊戲</th>
                <th style={th}>結果</th>
                <th style={th}>獎品</th>
                <th style={th}>消耗點數</th>
                <th style={th}>優惠券代碼</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const prizeType = r.result?.prizeType
                const amount = Number(r.result?.prizeAmount) || 0
                const prizeLabel =
                  !prizeType || prizeType === 'none'
                    ? '—'
                    : `${PRIZE_TYPE_LABEL[prizeType] || prizeType}${amount ? ` × ${amount}` : ''}${
                        r.result?.prizeDescription ? `（${r.result.prizeDescription}）` : ''
                      }`
                return (
                  <tr key={String(r.id)}>
                    <td style={td}>{fmtDate(r.createdAt)}</td>
                    <td style={td}>{GAME_TYPE_LABEL[r.gameType] || r.gameType}</td>
                    <td style={td}>
                      {r.result?.outcome
                        ? OUTCOME_LABEL[r.result.outcome] || r.result.outcome
                        : '—'}
                    </td>
                    <td style={td}>{prizeLabel}</td>
                    <td style={td}>{Number(r.pointsSpent) || 0}</td>
                    <td style={td}>
                      {r.result?.couponCode ? (
                        <code
                          style={{
                            fontSize: 12,
                            padding: '1px 5px',
                            borderRadius: 3,
                            background: 'var(--theme-elevation-100, #f4f4f5)',
                          }}
                        >
                          {r.result.couponCode}
                        </code>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const panel: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150, #e4e4e7)',
  borderRadius: 8,
  padding: 16,
  margin: '12px 0 24px',
  background: 'var(--theme-elevation-50, #fafafa)',
}
const h4: React.CSSProperties = {
  margin: 0,
  marginBottom: 6,
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--theme-elevation-900, #111)',
}
const hint: React.CSSProperties = {
  margin: 0,
  marginBottom: 12,
  fontSize: 12,
  color: 'var(--theme-elevation-600, #666)',
}
const table: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
  background: 'var(--theme-elevation-0, #fff)',
  border: '1px solid var(--theme-elevation-150, #e4e4e7)',
  borderRadius: 6,
  overflow: 'hidden',
}
const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  borderBottom: '1px solid var(--theme-elevation-150, #e4e4e7)',
  background: 'var(--theme-elevation-100, #f4f4f5)',
  fontWeight: 600,
  color: 'var(--theme-elevation-800, #18181b)',
  whiteSpace: 'nowrap',
}
const td: React.CSSProperties = {
  padding: '8px 10px',
  borderBottom: '1px solid var(--theme-elevation-100, #f4f4f5)',
  verticalAlign: 'top',
}
const summaryGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: 8,
  marginBottom: 16,
}
const summaryCard: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150, #e4e4e7)',
  borderRadius: 6,
  padding: '10px 12px',
  background: 'var(--theme-elevation-0, #fff)',
}
const summaryLabel: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--theme-elevation-600, #666)',
  marginBottom: 4,
}
const summaryValue: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  color: 'var(--theme-elevation-900, #111)',
}

export default MemberGameRecordsPanel
