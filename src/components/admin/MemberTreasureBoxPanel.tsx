'use client'

/**
 * MemberTreasureBoxPanel
 * ──────────────────────
 * 會員編輯頁的「寶物箱 & 點數紀錄」Tab 內容。
 * 讓管理員一眼看到該會員目前擁有哪些獎項（UserRewards）+ 所有點數獲得/兌換流水（PointsTransactions）。
 *
 * 讀 Payload REST API（cookie-based auth 自動跟）：
 *   GET /api/user-rewards?where[user][equals]=<id>&limit=200&sort=-createdAt
 *   GET /api/points-transactions?where[user][equals]=<id>&limit=200&sort=-createdAt
 *
 * 新建會員時 (id 為空) 顯示提示「請先存檔」。
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useDocumentInfo } from '@payloadcms/ui'

type RewardState = 'unused' | 'pending_attach' | 'shipped' | 'consumed' | 'expired'

type RewardRow = {
  id: string | number
  rewardType: string
  displayName: string
  state: RewardState
  amount?: number | null
  couponCode?: string | null
  expiresAt?: string | null
  shippedAt?: string | null
  consumedAt?: string | null
  requiresPhysicalShipping?: boolean | null
  attachedToOrder?: { id: string | number; orderNumber?: string } | string | number | null
  createdAt: string
}

type TxnType = 'earn' | 'redeem' | 'expire' | 'admin_adjust' | 'refund_deduct'

type TxnRow = {
  id: string | number
  type: TxnType
  amount: number
  balance?: number | null
  source?: string | null
  description?: string | null
  relatedOrder?: { id: string | number; orderNumber?: string } | string | number | null
  expiresAt?: string | null
  createdAt: string
}

const REWARD_TYPE_LABEL: Record<string, string> = {
  free_shipping_coupon: '免運券',
  movie_ticket_physical: '電影券（實體）',
  movie_ticket_digital: '電影券（電子）',
  coupon: '優惠券',
  gift_physical: '贈品（實體）',
  badge: '徽章',
}

const REWARD_STATE_LABEL: Record<RewardState, string> = {
  unused: '未使用',
  pending_attach: '預定隨單寄出',
  shipped: '已寄出',
  consumed: '已使用',
  expired: '已過期',
}

const REWARD_STATE_COLOR: Record<RewardState, { bg: string; fg: string }> = {
  unused: { bg: '#dcfce7', fg: '#166534' },
  pending_attach: { bg: '#fef3c7', fg: '#92400e' },
  shipped: { bg: '#dbeafe', fg: '#1e40af' },
  consumed: { bg: '#e5e7eb', fg: '#374151' },
  expired: { bg: '#fee2e2', fg: '#991b1b' },
}

const TXN_TYPE_LABEL: Record<TxnType, string> = {
  earn: '獲得',
  redeem: '兌換',
  expire: '過期',
  admin_adjust: '管理員調整',
  refund_deduct: '退款扣回',
}

const TXN_SOURCE_LABEL: Record<string, string> = {
  purchase: '購買',
  review: '評價',
  referral: '推薦',
  birthday: '生日',
  monthly_bonus: '月度獎勵',
  game: '遊戲',
  redemption: '兌換',
  order_refund: '訂單退款',
  admin: '管理員',
  points_expiry: '點數過期',
  welcome: '歡迎禮',
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

const badge = (bg: string, fg: string): React.CSSProperties => ({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 500,
  background: bg,
  color: fg,
  whiteSpace: 'nowrap',
})

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

function fmtDate(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('zh-TW', { hour12: false })
}

function fmtOrderRef(
  ref: { id: string | number; orderNumber?: string } | string | number | null | undefined,
): string {
  if (!ref) return '—'
  if (typeof ref === 'object') return ref.orderNumber || String(ref.id)
  return String(ref)
}

function effectiveRewardState(r: RewardRow): RewardState {
  if (
    r.state === 'unused' &&
    r.expiresAt &&
    new Date(r.expiresAt).getTime() < Date.now()
  ) {
    return 'expired'
  }
  return r.state
}

const MemberTreasureBoxPanel: React.FC = () => {
  const { id } = useDocumentInfo()
  const [rewards, setRewards] = useState<RewardRow[] | null>(null)
  const [txns, setTxns] = useState<TxnRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [rRes, tRes] = await Promise.all([
        fetch(
          `/api/user-rewards?where[user][equals]=${encodeURIComponent(String(id))}&limit=200&sort=-createdAt&depth=1`,
          { credentials: 'include' },
        ),
        fetch(
          `/api/points-transactions?where[user][equals]=${encodeURIComponent(String(id))}&limit=200&sort=-createdAt&depth=1`,
          { credentials: 'include' },
        ),
      ])
      if (!rRes.ok) throw new Error(`寶物箱讀取失敗 (${rRes.status})`)
      if (!tRes.ok) throw new Error(`點數流水讀取失敗 (${tRes.status})`)
      const rJson = (await rRes.json()) as { docs: RewardRow[] }
      const tJson = (await tRes.json()) as { docs: TxnRow[] }
      setRewards(rJson.docs || [])
      setTxns(tJson.docs || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '讀取失敗')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const rewardSummary = useMemo(() => {
    const base = { total: 0, unused: 0, pending: 0, shipped: 0, consumed: 0, expired: 0 }
    if (!rewards) return base
    for (const r of rewards) {
      base.total += 1
      const s = effectiveRewardState(r)
      if (s === 'unused') base.unused += 1
      else if (s === 'pending_attach') base.pending += 1
      else if (s === 'shipped') base.shipped += 1
      else if (s === 'consumed') base.consumed += 1
      else if (s === 'expired') base.expired += 1
    }
    return base
  }, [rewards])

  const txnSummary = useMemo(() => {
    const base = { earn: 0, redeem: 0, expire: 0, adjust: 0, refundDeduct: 0 }
    if (!txns) return base
    for (const t of txns) {
      const amt = Number(t.amount) || 0
      if (t.type === 'earn') base.earn += amt
      else if (t.type === 'redeem') base.redeem += Math.abs(amt)
      else if (t.type === 'expire') base.expire += Math.abs(amt)
      else if (t.type === 'admin_adjust') base.adjust += amt
      else if (t.type === 'refund_deduct') base.refundDeduct += Math.abs(amt)
    }
    return base
  }, [txns])

  if (!id) {
    return (
      <div style={panel}>
        <h4 style={h4}>寶物箱 & 點數紀錄</h4>
        <p style={hint}>此會員尚未存檔。請先儲存後，相關獎項與點數紀錄會顯示於此。</p>
      </div>
    )
  }

  return (
    <div>
      {/* 寶物箱 */}
      <div style={panel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={h4}>🎁 寶物箱（獎項庫存）</h4>
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
        <p style={hint}>
          會員所擁有的獎項（免運券、電影券、優惠券、實體贈品、徽章）。自動排除已直接入帳的點數/購物金。
        </p>

        <div style={summaryGrid}>
          <div style={summaryCard}>
            <div style={summaryLabel}>總件數</div>
            <div style={summaryValue}>{rewardSummary.total}</div>
          </div>
          <div style={summaryCard}>
            <div style={summaryLabel}>可用</div>
            <div style={{ ...summaryValue, color: '#16a34a' }}>{rewardSummary.unused}</div>
          </div>
          <div style={summaryCard}>
            <div style={summaryLabel}>待隨單寄出</div>
            <div style={{ ...summaryValue, color: '#d97706' }}>{rewardSummary.pending}</div>
          </div>
          <div style={summaryCard}>
            <div style={summaryLabel}>已寄出</div>
            <div style={{ ...summaryValue, color: '#2563eb' }}>{rewardSummary.shipped}</div>
          </div>
          <div style={summaryCard}>
            <div style={summaryLabel}>已使用</div>
            <div style={summaryValue}>{rewardSummary.consumed}</div>
          </div>
          <div style={summaryCard}>
            <div style={summaryLabel}>已過期</div>
            <div style={{ ...summaryValue, color: '#dc2626' }}>{rewardSummary.expired}</div>
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: '8px 12px',
              background: '#fee2e2',
              color: '#991b1b',
              borderRadius: 4,
              marginBottom: 12,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {rewards && rewards.length === 0 && (
          <p style={{ ...hint, marginBottom: 0 }}>此會員目前沒有任何寶物箱獎項。</p>
        )}

        {rewards && rewards.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>取得時間</th>
                  <th style={th}>獎項類型</th>
                  <th style={th}>名稱</th>
                  <th style={th}>數量/面額</th>
                  <th style={th}>狀態</th>
                  <th style={th}>過期時間</th>
                  <th style={th}>兌換碼</th>
                  <th style={th}>附隨訂單</th>
                </tr>
              </thead>
              <tbody>
                {rewards.map((r) => {
                  const s = effectiveRewardState(r)
                  const color = REWARD_STATE_COLOR[s]
                  return (
                    <tr key={String(r.id)}>
                      <td style={td}>{fmtDate(r.createdAt)}</td>
                      <td style={td}>{REWARD_TYPE_LABEL[r.rewardType] || r.rewardType}</td>
                      <td style={td}>{r.displayName}</td>
                      <td style={td}>{r.amount ?? '—'}</td>
                      <td style={td}>
                        <span style={badge(color.bg, color.fg)}>{REWARD_STATE_LABEL[s]}</span>
                      </td>
                      <td style={td}>{fmtDate(r.expiresAt)}</td>
                      <td style={td}>
                        {r.couponCode ? (
                          <code
                            style={{
                              fontSize: 12,
                              padding: '1px 6px',
                              background: 'var(--theme-elevation-100, #f4f4f5)',
                              borderRadius: 3,
                            }}
                          >
                            {r.couponCode}
                          </code>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={td}>{fmtOrderRef(r.attachedToOrder)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 點數流水 */}
      <div style={panel}>
        <h4 style={h4}>💰 點數異動紀錄（獲得 / 兌換 / 過期 / 調整）</h4>
        <p style={hint}>依建立時間倒序，最多 200 筆。正數為獲得、負數為扣除。</p>

        <div style={summaryGrid}>
          <div style={summaryCard}>
            <div style={summaryLabel}>累計獲得</div>
            <div style={{ ...summaryValue, color: '#16a34a' }}>+{txnSummary.earn}</div>
          </div>
          <div style={summaryCard}>
            <div style={summaryLabel}>累計兌換</div>
            <div style={{ ...summaryValue, color: '#dc2626' }}>-{txnSummary.redeem}</div>
          </div>
          <div style={summaryCard}>
            <div style={summaryLabel}>累計過期</div>
            <div style={{ ...summaryValue, color: '#dc2626' }}>-{txnSummary.expire}</div>
          </div>
          <div style={summaryCard}>
            <div style={summaryLabel}>管理員調整</div>
            <div style={summaryValue}>
              {txnSummary.adjust >= 0 ? `+${txnSummary.adjust}` : txnSummary.adjust}
            </div>
          </div>
          <div style={summaryCard}>
            <div style={summaryLabel}>退款扣回</div>
            <div style={{ ...summaryValue, color: '#dc2626' }}>-{txnSummary.refundDeduct}</div>
          </div>
        </div>

        {txns && txns.length === 0 && (
          <p style={{ ...hint, marginBottom: 0 }}>此會員目前沒有任何點數異動紀錄。</p>
        )}

        {txns && txns.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>時間</th>
                  <th style={th}>類型</th>
                  <th style={th}>來源</th>
                  <th style={th}>數量</th>
                  <th style={th}>異動後餘額</th>
                  <th style={th}>說明</th>
                  <th style={th}>相關訂單</th>
                  <th style={th}>過期時間</th>
                </tr>
              </thead>
              <tbody>
                {txns.map((t) => {
                  const amt = Number(t.amount) || 0
                  const isPositive = amt > 0
                  const amtColor = isPositive ? '#16a34a' : amt < 0 ? '#dc2626' : undefined
                  return (
                    <tr key={String(t.id)}>
                      <td style={td}>{fmtDate(t.createdAt)}</td>
                      <td style={td}>
                        <span
                          style={badge(
                            t.type === 'earn'
                              ? '#dcfce7'
                              : t.type === 'redeem'
                                ? '#fee2e2'
                                : t.type === 'expire'
                                  ? '#e5e7eb'
                                  : t.type === 'admin_adjust'
                                    ? '#dbeafe'
                                    : '#fef3c7',
                            t.type === 'earn'
                              ? '#166534'
                              : t.type === 'redeem'
                                ? '#991b1b'
                                : t.type === 'expire'
                                  ? '#374151'
                                  : t.type === 'admin_adjust'
                                    ? '#1e40af'
                                    : '#92400e',
                          )}
                        >
                          {TXN_TYPE_LABEL[t.type] || t.type}
                        </span>
                      </td>
                      <td style={td}>
                        {t.source ? TXN_SOURCE_LABEL[t.source] || t.source : '—'}
                      </td>
                      <td style={{ ...td, fontWeight: 600, color: amtColor }}>
                        {isPositive ? `+${amt}` : amt}
                      </td>
                      <td style={td}>{t.balance ?? '—'}</td>
                      <td style={td}>{t.description || '—'}</td>
                      <td style={td}>{fmtOrderRef(t.relatedOrder)}</td>
                      <td style={td}>{fmtDate(t.expiresAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default MemberTreasureBoxPanel
