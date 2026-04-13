'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Gift, Flame } from 'lucide-react'

interface Props { settings: Record<string, unknown> }

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

export function DailyCheckinGame({ settings }: Props) {
  const [checkedIn, setCheckedIn] = useState(false)
  const [streak, setStreak] = useState(3) // demo
  const [todayPoints, setTodayPoints] = useState(0)

  const day1to6 = (settings.day1to6Points as number) || 5
  const day7Bonus = (settings.day7BonusPoints as number) || 50

  const handleCheckin = async () => {
    // TODO: call performDailyCheckin server action
    setCheckedIn(true)
    setStreak((s) => s + 1)
    setTodayPoints(day1to6)
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Streak display */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 text-orange-600 text-sm mb-4">
          <Flame size={16} />
          連續簽到 {streak} 天
        </div>
      </div>

      {/* Weekly grid */}
      <div className="bg-white rounded-2xl border border-cream-200 p-6 mb-6">
        <h3 className="text-sm font-medium mb-4 text-center">本週簽到進度</h3>
        <div className="grid grid-cols-7 gap-2">
          {WEEKDAYS.map((day, i) => {
            const isPast = i < streak % 7
            const isToday = i === streak % 7
            const isDay7 = i === 6
            return (
              <div key={day} className="text-center">
                <p className="text-[10px] text-muted-foreground mb-1.5">週{day}</p>
                <motion.div
                  initial={false}
                  animate={isPast ? { scale: [1, 1.2, 1] } : {}}
                  className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center text-sm ${
                    isPast
                      ? 'bg-gold-500 text-white'
                      : isToday
                        ? checkedIn
                          ? 'bg-green-500 text-white'
                          : 'bg-gold-500/10 border-2 border-dashed border-gold-400 text-gold-600'
                        : 'bg-cream-100 text-cream-300'
                  }`}
                >
                  {isPast || (isToday && checkedIn) ? (
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

      {/* Check-in button */}
      {checkedIn ? (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center py-6 bg-green-50 rounded-2xl border border-green-200"
        >
          <p className="text-3xl mb-2">✅</p>
          <p className="text-lg font-serif mb-1">今日簽到成功！</p>
          <p className="text-sm text-green-600">獲得 {todayPoints} 點，連續 {streak} 天</p>
        </motion.div>
      ) : (
        <button
          onClick={handleCheckin}
          className="w-full py-4 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-2xl text-lg font-serif tracking-wider hover:shadow-lg transition-shadow"
        >
          立即簽到
        </button>
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
