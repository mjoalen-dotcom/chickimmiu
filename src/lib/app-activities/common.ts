import { NextResponse } from 'next/server'
import type { BasePayload, TypedUser } from 'payload'

import { resolveApiUser } from '../auth/resolveApiUser'
import { publicDisplayName } from '../games/leaderboardData'

/**
 * App 專屬活動端點的共用層
 * ═══════════════════════
 * 工單 2026-08-25 共通規則 #5：錯誤回應要帶可辨識的錯誤碼（App 轉為固定文案顯示，
 * 不直接呈現伺服器內容）。所有端點一律走這裡的 fail()，形狀固定為
 *   { success: false, code: 'XXX', error: '中文說明', ...extra }
 */

type LooseRecord = Record<string, unknown>

/** 全域錯誤碼（App 依 code 切文案；新增請同步告知 App 團隊） */
export const CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  BAD_REQUEST: 'BAD_REQUEST',
  ACTIVITY_INACTIVE: 'ACTIVITY_INACTIVE',
  ALREADY_CLAIMED: 'ALREADY_CLAIMED',
  NOT_FOUND: 'NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  MILESTONE_NOT_FOUND: 'MILESTONE_NOT_FOUND',
  STEPS_NOT_ENOUGH: 'STEPS_NOT_ENOUGH',
  DATE_NOT_TODAY: 'DATE_NOT_TODAY',
  CONTENT_TOO_SHORT: 'CONTENT_TOO_SHORT',
  CONTENT_TOO_LONG: 'CONTENT_TOO_LONG',
  BANNED_WORD: 'BANNED_WORD',
  PHOTO_REQUIRED: 'PHOTO_REQUIRED',
  TOO_MANY_PHOTOS: 'TOO_MANY_PHOTOS',
  INVALID_MEDIA: 'INVALID_MEDIA',
  INVALID_ARTICLE: 'INVALID_ARTICLE',
  INVALID_ORDER_NUMBER: 'INVALID_ORDER_NUMBER',
  ORDER_NUMBER_TAKEN: 'ORDER_NUMBER_TAKEN',
  FUTURE_PURCHASE_DATE: 'FUTURE_PURCHASE_DATE',
  EDIT_WINDOW_CLOSED: 'EDIT_WINDOW_CLOSED',
  ALREADY_REPORTED: 'ALREADY_REPORTED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

export type ActivityCode = (typeof CODES)[keyof typeof CODES]

export function fail(
  status: number,
  code: ActivityCode,
  error: string,
  extra?: LooseRecord,
): NextResponse {
  return NextResponse.json({ success: false, code, error, ...(extra || {}) }, { status })
}

export function ok(data: LooseRecord, extra?: LooseRecord): NextResponse {
  return NextResponse.json({ success: true, data, ...(extra || {}) })
}

/** 取登入會員；未登入回 null（呼叫端用 fail(401, UNAUTHORIZED) 回應） */
export async function requireCustomer(
  headers: Headers,
): Promise<{ payload: BasePayload; user: TypedUser } | { payload: BasePayload; user: null }> {
  const { payload, user } = await resolveApiUser(headers)
  return { payload, user } as never
}

// ── 活動設定 ────────────────────────────────────────────

export interface TravelReadCfg {
  isActive: boolean
  pointsPerArticle: number
}
export interface GroupBuyCfg {
  isActive: boolean
  sharePoints: number
  featuredPoints: number
  minContentLength: number
  maxImages: number
  editableHours: number
  bannedWords: string[]
}
export interface StepCfg {
  isActive: boolean
  dailyMilestones: Array<{ steps: number; points: number }>
  weeklyMilestone: { steps: number; points: number }
}

export interface ActivitySettings {
  travelRead: TravelReadCfg
  groupBuyShare: GroupBuyCfg
  stepChallenge: StepCfg
}

const num = (v: unknown, d: number) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : d
}

export async function getActivitySettings(payload: BasePayload): Promise<ActivitySettings> {
  const raw = (await payload.findGlobal({
    slug: 'app-activity-settings',
    depth: 0,
  })) as unknown as LooseRecord
  const t = (raw.travelRead as LooseRecord) || {}
  const g = (raw.groupBuyShare as LooseRecord) || {}
  const s = (raw.stepChallenge as LooseRecord) || {}
  const wm = (s.weeklyMilestone as LooseRecord) || {}

  return {
    travelRead: {
      isActive: t.isActive !== false,
      pointsPerArticle: Math.max(0, Math.floor(num(t.pointsPerArticle, 1))),
    },
    groupBuyShare: {
      isActive: g.isActive !== false,
      sharePoints: Math.max(0, Math.floor(num(g.sharePoints, 0))),
      featuredPoints: Math.max(0, Math.floor(num(g.featuredPoints, 0))),
      minContentLength: Math.max(0, Math.floor(num(g.minContentLength, 0))),
      maxImages: Math.max(1, Math.floor(num(g.maxImages, 5))),
      editableHours: Math.max(0, num(g.editableHours, 24)),
      bannedWords: Array.isArray(g.bannedWords)
        ? (g.bannedWords as LooseRecord[])
            .map((r) => String(r?.word || '').trim())
            .filter(Boolean)
        : [],
    },
    stepChallenge: {
      isActive: s.isActive !== false,
      dailyMilestones: Array.isArray(s.dailyMilestones)
        ? (s.dailyMilestones as LooseRecord[])
            .map((r) => ({
              steps: Math.floor(num(r?.steps, 0)),
              points: Math.max(0, Math.floor(num(r?.points, 0))),
            }))
            .filter((m) => m.steps > 0)
            .sort((a, b) => a.steps - b.steps)
        : [],
      weeklyMilestone: {
        steps: Math.floor(num(wm.steps, 0)),
        points: Math.max(0, Math.floor(num(wm.points, 0))),
      },
    },
  }
}

// ── Asia/Taipei 日期 / 週次 ─────────────────────────────

/** 今日 YYYY-MM-DD（Asia/Taipei，00:00 換日） */
export function tpeToday(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/**
 * ISO 週次 YYYY_Www（Asia/Taipei）。
 * ISO-8601：週一為一週之始，含當年第一個星期四的那週為第 1 週。
 */
export function tpeWeekId(date: Date = new Date()): string {
  const ymd = tpeToday(date)
  const [y, m, d] = ymd.split('-').map(Number)
  // 用 UTC 當純日期容器做 ISO 週運算（不涉時區轉換，兩端都是 date-only）
  const dt = new Date(Date.UTC(y, m - 1, d))
  const dayNum = dt.getUTCDay() || 7 // 週一=1 … 週日=7
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum) // 移到該週的星期四
  const isoYear = dt.getUTCFullYear()
  const yearStart = new Date(Date.UTC(isoYear, 0, 1))
  const week = Math.ceil(((dt.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${isoYear}_W${String(week).padStart(2, '0')}`
}

/** 某週次涵蓋的 7 個 YYYY-MM-DD（用於加總當週每日步數） */
export function datesOfWeek(weekId: string): string[] {
  const m = /^(\d{4})_W(\d{2})$/.exec(weekId)
  if (!m) return []
  const isoYear = Number(m[1])
  const week = Number(m[2])
  // ISO 第 1 週的星期一
  const jan4 = new Date(Date.UTC(isoYear, 0, 4))
  const jan4Day = jan4.getUTCDay() || 7
  const week1Monday = new Date(jan4)
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1))
  const monday = new Date(week1Monday)
  monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setUTCDate(monday.getUTCDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

// ── 團購分享的文字處理 ──────────────────────────────────

/**
 * 訂單編號正規化：去頭尾空白 → 全形英數轉半形 → 轉大寫。
 * 正規化後長度需 4–40（呼叫端檢查）。
 */
export function normalizeOrderNumber(raw: string): string {
  return raw
    .trim()
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, '')
    .trim()
    .toUpperCase()
}

/** 命中關鍵字過濾清單就回傳該詞（不分大小寫），否則 null */
export function hitBannedWord(content: string, bannedWords: string[]): string | null {
  const lower = content.toLowerCase()
  for (const w of bannedWords) {
    if (w && lower.includes(w.toLowerCase())) return w
  }
  return null
}

/**
 * 分享牆的公開作者資訊。
 * 工單指定：顯示名稱取 nickname，未設定時回遮罩姓名，**不可回 name**；頭像取 avatar。
 */
export function publicAuthor(user: unknown): { id: number | string | null; name: string; avatarUrl: string | null } {
  if (!user || typeof user !== 'object') return { id: null, name: '會員', avatarUrl: null }
  const u = user as LooseRecord
  const avatar = u.avatar as LooseRecord | null | undefined
  return {
    id: (u.id as number | string) ?? null,
    name: publicDisplayName(
      u.nickname as string | null | undefined,
      (u.name as string | null) ?? null,
      (u.email as string | null) ?? null,
    ),
    avatarUrl: (avatar && typeof avatar === 'object' ? (avatar.url as string) : null) ?? null,
  }
}
