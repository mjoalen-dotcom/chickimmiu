'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Gift, Flame, AlertTriangle, Sparkles } from 'lucide-react'

interface Props { settings: Record<string, unknown> }

interface CheckinState {
  totalCheckIns: number
  consecutiveCheckIns: number
  lastCheckInDate: string
  alreadyCheckedToday: boolean
}

interface CheckinResponseStreak {
  totalCheckIns: number
  consecutiveCheckIns: number
  lastCheckInDate: string
  streakReset: boolean
  streakBonus: boolean
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

export function DailyCheckinGame({ settings }: Props) {
  const day1to6 = (settings.day1to6Points as number) || 10
  const day7Bonus = (settings.day7BonusPoints as number) || 50

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [streak, setStreak] = useState(0)
  const [totalCheckIns, setTotalCheckIns] = useState(0)
  const [alreadyCheckedToday, setAlreadyCheckedToday] = useState(false)
  const [todayPoints, setTodayPoints] = useState(0)
  const [justCheckedIn, setJustCheckedIn] = useState(false)
  const [streakReset, setStreakReset] = useState(false)
  const [streakBonus, setStreakBonus] = useState(false)
  const [previousStreakBeforeReset, setPreviousStreakBeforeReset] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')

  // ── 1. 初始化：GET /api/games 拿 checkinState ──
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/games', { credentials: 'include' })
        const body = await res.json()
        if (cancelled) return
        if (!res.ok || !body?.success) {
          setErrorMsg(body?.error || '讀取簽到狀態失敗')
          return
        }
        const state = body.data?.checkinState as CheckinState | undefined
        if (state) {
          setStreak(state.consecutiveCheckIns || 0)
          setTotalCheckIns(state.totalCheckIns || 0)
          setAlreadyCheckedToday(Boolean(state.alreadyCheckedToday))
        }
      } catch (err) {
        if (!cancelled) setErrorMsg('網路錯誤，請稍後再試')
        console.error('checkin init failed', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // ── 2. 送出簽到 ──
  const handleCheckin = async () => {
    if (submitting || alreadyCheckedToday) return
    setSubmitting(true)
    setErrorMsg('')
    const prevStreak = streak
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'checkin' }),
      })
      const body = await res.json()
      if (!res.ok || !body?.success) {
        const msg = body?.error || '簽到失敗'
        setErrorMsg(msg)
        if (msg.includes('今日已簽到')) {
          setAlreadyCheckedToday(true)
        }
        return
      }
      const streakData = body.data?.streak as CheckinResponseStreak | undefined
      const prize = body.data?.prize as { amount?: number } | undefined
      if (streakData) {
        setStreak(streakData.consecutiveCheckIns)
        setTotalCheckIns(streakData.totalCheckIns)
        setStreakReset(streakData.streakReset)
        setStreakBonus(streakData.streakBonus)
        if (streakData.streakReset) setPreviousStreakBeforeReset(prevStreak)
      }
      setTodayPoints(prize?.amount ?? day1to6)
      setAlreadyCheckedToday(true)
      setJustCheckedIn(true)
    } catch (err) {
      console.error('checkin submit failed', err)
      setErrorMsg('網路錯誤，請稍後再試')
    } finally {
      setSubmitting(false)
    }
  }

  // 週進度：以 streak % 7 顯示這週第幾天（0→未開始 / 1..7）
  const dayOfWeekIdx = streak === 0 ? -1 : ((streak - 1) % 7)

  return (
    <div className="max-w-lg mx-auto">
      {/* Streak display */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 text-orange-600 text-sm mb-2">
          <Flame size={16} />
          連續簽到 {streak} 天
        </div>
        {totalCheckIns > 0 && (
          <p className="text-xs text-muted-foreground">累計簽到 {totalCheckIns} 次</p>
        )}
      </div>

      {/* Streak reset banner — 此次簽到被判定中斷 */}
      <AnimatePresence>
        {justCheckedIn && streakReset && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800"
          >
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <p>
              您中斷了連續簽到
              {previousStreakBeforeReset > 0 ? `（原本 ${previousStreakBeforeReset} 天）` : ''}
              ，從 Day 1 重新開始。
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Weekly grid */}
      <div className="bg-white rounded-2xl border border-cream-200 p-6 mb-6">
        <h3 className="text-sm font-medium mb-4 text-center">本週簽到進度</h3>
        <div className="grid grid-cols-7 gap-2">
          {WEEKDAYS.map((day, i) => {
            const isPast = dayOfWeekIdx >= 0 && i < dayOfWeekIdx
            const isToday = dayOfWeekIdx >= 0 && i === dayOfWeekIdx && alreadyCheckedToday
            const isTargetToday = dayOfWeekIdx < 0 ? i === 0 : i === (dayOfWeekIdx + (alreadyCheckedToday ? 1 : 0)) % 7 && !alreadyCheckedToday
            const isDay7 = i === 6
            return (
              <div key={day} className="text-center">
                <p className="text-[10px] text-muted-foreground mb-1.5">週{day}</p>
                <motion.div
                  initial={false}
                  animate={isPast || isToday ? { scale: [1, 1.15, 1] } : {}}
                  className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center text-sm ${
                    isPast || isToday
                      ? 'bg-gold-500 text-white'
                      : isTargetToday
                        ? 'bg-gold-500/10 border-2 border-dashed border-gold-400 text-gold-600'
                        : 'bg-cream-100 text-cream-300'
                  }`}
                >
                  {isPast || isToday ? (
                    <Check size={18} />
                  ) : isDay7 ? (
                    <Gift size={16} />
                  ) : (
                    <span className="text-xs">{isDay7 ? day7Bonus : day1to6}</span>
                  )}
                </motion.div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {isDay7 ? `${day7Bonus}pt` : `${day1to6}pt`}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* 簽到成功 bonus 動畫 */}
      <AnimatePresence>
        {justCheckedIn && streakBonus && (
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mb-4 text-center py-4 bg-gradient-to-r from-amber-100 to-orange-100 rounded-2xl border border-amber-300"
          >
            <Sparkles className="inline mr-1 text-amber-600" size={18} />
            <span className="font-serif text-amber-700">
              連續 7 天達成！獎勵 {todayPoints} 點
            </span>
            <Sparkles className="inline ml-1 text-amber-600" size={18} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Check-in button / already-checked state */}
      {loading ? (
        <div className="w-full py-4 bg-cream-100 rounded-2xl text-center text-sm text-muted-foreground">
          載入中…
        </div>
      ) : alreadyCheckedToday ? (
        <motion.div
          initial={justCheckedIn ? { scale: 0.8, opacity: 0 } : false}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center py-6 bg-green-50 rounded-2xl border border-green-200"
        >
          <p className="text-3xl mb-2">✅</p>
          <p className="text-lg font-serif mb-1">
            {justCheckedIn ? '今日簽到成功！' : '今日已完成簽到'}
          </p>
          <p className="text-sm text-green-600">
            {justCheckedIn
              ? `獲得 ${todayPoints} 點，連續 ${streak} 天`
              : `連續 ${streak} 天，明天再來`}
          </p>
        </motion.div>
      ) : (
        <button
          onClick={handleCheckin}
          disabled={submitting}
          className="w-full py-4 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-2xl text-lg font-serif tracking-wider hover:shadow-lg transition-shadow disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? '簽到中…' : '立即簽到'}
        </button>
      )}

      {/* 錯誤訊息 */}
      {errorMsg && !alreadyCheckedToday && (
        <p className="mt-3 text-center text-sm text-red-500">{errorMsg}</p>
      )}

      {/* Streak milestones */}
      <div className="mt-6 bg-white rounded-2xl border border-cream-200 p-5">
        <h4 className="text-sm font-medium mb-3">連續簽到獎勵</h4>
        <div className="space-y-2">
          {[
            { days: 7, reward: `${day7Bonus} 點 + 驚喜禮` },
            { days: 14, reward: `${day7Bonus * 2} 點 + 95折券` },
            { days: 30, reward: `${day7Bonus * 5} 點 + 免運券` },
          ].map((m) => (
            <div key={m.days} className="flex items-center justify-between text-xs">
              <span className={streak >= m.days ? 'text-gold-600 font-medium' : 'text-muted-foreground'}>
                連續 {m.days} 天
              </span>
              <span className={streak >= m.days ? 'text-gold-600' : 'text-muted-foreground'}>
                {m.reward}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
