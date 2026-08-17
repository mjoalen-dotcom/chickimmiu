/**
 * 活動生命週期狀態機（CHIC Commerce OS P0-C §6.2）
 * ─────────────────────────────────────────────────
 * 工作單定義 draft → review → approved → scheduled → active → paused → ended
 * → archived，但稽核發現這只是「宣告」：MarketingCampaigns 只有一個檢查預算/
 * 核准的 hook，**沒有任何轉換驗證**——後台下拉一點就能把 active 拉回 draft、
 * 或把 ended 直接拉回 active，歷史狀態毫無約束力。
 *
 * 這裡把它變成真的規則。設計取捨：
 *   - 預設嚴格：只允許表定轉換。
 *   - 但保留**有紀錄的逃生門**：勾 `statusOverride` + 填原因即可任意轉換，
 *     稽核軌跡會標記 isOverride=true。完全不給逃生門的話，狀態設錯就只能
 *     改 DB，那會逼出更糟的繞道行為。
 */

export type CampaignStatus =
  | 'draft'
  | 'review'
  | 'approved'
  | 'scheduled'
  | 'active'
  | 'paused'
  | 'ended'
  | 'completed'
  | 'cancelled'
  | 'archived'

/**
 * 允許的轉換。原則：
 * - 往前推進要照順序（不可跳過核准直接上線）
 * - 退回上一步是允許的（送審被打回、排程前反悔）
 * - cancelled 幾乎隨時可達（叫停永遠要能做）
 * - archived 是終點；ended/completed/cancelled 之後只能封存
 */
export const ALLOWED_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  draft: ['review', 'cancelled', 'archived'],
  review: ['approved', 'draft', 'cancelled'],
  approved: ['scheduled', 'review', 'cancelled'],
  scheduled: ['active', 'paused', 'approved', 'cancelled'],
  active: ['paused', 'ended', 'completed', 'cancelled'],
  paused: ['active', 'ended', 'cancelled'],
  ended: ['completed', 'archived'],
  completed: ['archived'],
  cancelled: ['archived'],
  archived: [],
}

const LABELS: Record<CampaignStatus, string> = {
  draft: '草稿',
  review: '送審中',
  approved: '已核准',
  scheduled: '已排程',
  active: '進行中',
  paused: '已暫停',
  ended: '已結束',
  completed: '已完成',
  cancelled: '已取消',
  archived: '已封存',
}

export function statusLabel(s: string): string {
  return LABELS[s as CampaignStatus] ?? s
}

export interface TransitionCheck {
  allowed: boolean
  /** 不允許時的人話說明（直接當 error message 用） */
  message?: string
}

export function checkTransition(
  from: string | null | undefined,
  to: string | null | undefined,
): TransitionCheck {
  if (!to) return { allowed: true }
  // 新建：只能從 draft 起手（避免直接建一個 active 活動繞過整條核准鏈）
  if (!from) {
    if (to === 'draft') return { allowed: true }
    return {
      allowed: false,
      message: `新活動只能以「${LABELS.draft}」建立，不可直接建成「${statusLabel(to)}」——請建好後依序送審、核准再上線。`,
    }
  }
  if (from === to) return { allowed: true }

  const allowedNext = ALLOWED_TRANSITIONS[from as CampaignStatus]
  if (!allowedNext) {
    return { allowed: false, message: `未知的原狀態「${from}」，無法驗證轉換。` }
  }
  if (allowedNext.includes(to as CampaignStatus)) return { allowed: true }

  const options = allowedNext.length
    ? allowedNext.map(statusLabel).join('、')
    : '（終點狀態，不可再轉換）'
  return {
    allowed: false,
    message:
      `不允許從「${statusLabel(from)}」直接轉為「${statusLabel(to)}」。` +
      `目前可轉換為：${options}。` +
      `確實需要例外處理時，請勾選「強制覆寫狀態」並在「覆寫原因」說明，該次操作會被記錄在活動操作記錄中。`,
  }
}
