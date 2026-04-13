'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Calendar, CheckCircle, Gift, Coins } from 'lucide-react'

const REWARDS = [
  { day: 1, points: 5, label: '5 點' },
  { day: 2, points: 5, label: '5 點' },
  { day: 3, points: 10, label: '10 點' },
  { day: 4, points: 10, label: '10 點' },
  { day: 5, points: 15, label: '15 點' },
  { day: 6, points: 20, label: '20 點' },
  { day: 7, points: 50, label: '50 點 + NT$10 購物金', bonus: true },
]

interface DailyCheckInProps {
  open: boolean
  onClose: () => void
}

export function DailyCheckIn({ open, onClose }: DailyCheckInProps) {
  // Demo: simulate check-in state via localStorage
  const [checkedDays, setCheckedDays] = useState<number[]>([])

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('ckm-checkin') || '[]')
      setCheckedDays(stored)
    } catch { /* ignore */ }
  }, [])
  const [justChecked, setJustChecked] = useState(false)

  const todayIndex = useMemo(() => {
    // Continuous check-in: next unchecked day
    return checkedDays.length
  }, [checkedDays])

  const handleCheckIn = () => {
    if (todayIndex >= 7 || justChecked) return
    const newChecked = [...checkedDays, todayIndex]
    setCheckedDays(newChecked)
    setJustChecked(true)
    localStorage.setItem('ckm-checkin', JSON.stringify(newChecked))

    const reward = REWARDS[todayIndex]
    console.log('[DailyCheckIn] Day', todayIndex + 1, 'reward:', reward)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl z-10"
      >
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-cream-100 flex items-center justify-center hover:bg-cream-200">
          <X size={16} />
        </button>

        <div className="text-center mb-6">
          <p className="text-xs tracking-[0.3em] text-gold-500 mb-1">DAILY CHECK-IN</p>
          <h2 className="text-xl font-serif">每日簽到</h2>
          <p className="text-xs text-muted-foreground mt-1">
            連續簽到 7 天可獲得豐厚獎勵
          </p>
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-2 mb-6">
          {REWARDS.map((reward, i) => {
            const isChecked = checkedDays.includes(i)
            const isToday = i === todayIndex && !justChecked
            const isFuture = i > todayIndex

            return (
              <div
                key={i}
                className={`aspect-square rounded-xl flex flex-col items-center justify-center text-center border-2 transition-all ${
                  isChecked
                    ? 'bg-gold-500/10 border-gold-500'
                    : isToday
                      ? 'border-gold-500 bg-gold-500/5 animate-pulse'
                      : 'border-cream-200 bg-cream-50'
                }`}
              >
                {isChecked ? (
                  <CheckCircle size={16} className="text-gold-500 mb-0.5" />
                ) : reward.bonus ? (
                  <Gift size={16} className={`mb-0.5 ${isFuture ? 'text-cream-300' : 'text-gold-500'}`} />
                ) : (
                  <Coins size={14} className={`mb-0.5 ${isFuture ? 'text-cream-300' : 'text-gold-500'}`} />
                )}
                <span className={`text-[9px] font-medium ${isFuture ? 'text-muted-foreground/40' : ''}`}>
                  Day {i + 1}
                </span>
                <span className={`text-[8px] ${isChecked ? 'text-gold-600' : 'text-muted-foreground'}`}>
                  +{reward.points}
                </span>
              </div>
            )
          })}
        </div>

        {/* Check-in button */}
        {justChecked ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center p-4 bg-gold-500/10 rounded-xl mb-4"
          >
            <p className="text-sm font-medium">
              簽到成功！獲得{' '}
              <span className="text-gold-600">{REWARDS[todayIndex - 1]?.label || REWARDS[0].label}</span>
            </p>
          </motion.div>
        ) : (
          <button
            onClick={handleCheckIn}
            disabled={todayIndex >= 7}
            className="w-full py-3.5 bg-gold-500 text-white rounded-xl text-sm tracking-wide hover:bg-gold-600 transition-colors disabled:opacity-50"
          >
            {todayIndex >= 7 ? '本週已全部簽到' : `簽到 Day ${todayIndex + 1}`}
          </button>
        )}

        <p className="text-[10px] text-center text-muted-foreground mt-3">
          連續簽到 7 天額外獲得 NT$10 購物金獎勵
        </p>
      </motion.div>
    </div>
  )
}
