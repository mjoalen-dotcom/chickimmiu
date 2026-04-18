'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { User, Mail, Phone, Calendar, Lock } from 'lucide-react'

export type SettingsInitial = {
  userId: string
  name: string
  email: string
  phone: string
  birthday: string
}

export default function SettingsClient({ initial }: { initial: SettingsInitial }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    name: initial.name,
    phone: initial.phone,
    birthday: initial.birthday,
  })
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  async function handleSave() {
    setMessage(null)
    const payload: Record<string, string | null> = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      birthday: form.birthday ? new Date(form.birthday).toISOString() : null,
    }
    const res = await fetch(`/api/users/${initial.userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      setMessage({ kind: 'err', text: `儲存失敗 (${res.status}) ${body.slice(0, 160)}` })
      return
    }
    setMessage({ kind: 'ok', text: '已儲存變更' })
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <h2 className="text-xl font-serif">帳號設定</h2>

      {/* Profile */}
      <div className="bg-white rounded-2xl border border-cream-200 p-6 space-y-5">
        <h3 className="font-medium flex items-center gap-2">
          <User size={16} className="text-gold-500" />
          基本資料
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">姓名</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Email（不可修改）</label>
            <div className="flex items-center gap-2">
              <Mail size={14} className="text-muted-foreground shrink-0" />
              <input
                type="email"
                value={initial.email}
                disabled
                className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm bg-cream-50 text-muted-foreground"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">電話</label>
            <div className="flex items-center gap-2">
              <Phone size={14} className="text-muted-foreground shrink-0" />
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">生日</label>
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-muted-foreground shrink-0" />
              <input
                type="date"
                value={form.birthday}
                onChange={(e) => setForm({ ...form, birthday: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
              />
            </div>
          </div>
        </div>
        {message && (
          <div
            className={`text-xs rounded-xl px-4 py-3 ${
              message.kind === 'ok'
                ? 'text-green-700 bg-green-50 border border-green-200'
                : 'text-red-600 bg-red-50 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}
        <button
          onClick={handleSave}
          disabled={isPending}
          className="px-6 py-2.5 bg-foreground text-cream-50 rounded-xl text-sm hover:bg-foreground/90 transition-colors disabled:opacity-50"
        >
          {isPending ? '儲存中…' : '儲存變更'}
        </button>
      </div>

      {/* Password */}
      <div className="bg-white rounded-2xl border border-cream-200 p-6 space-y-3">
        <h3 className="font-medium flex items-center gap-2">
          <Lock size={16} className="text-gold-500" />
          密碼管理
        </h3>
        <p className="text-xs text-muted-foreground">
          若需變更密碼，請使用「忘記密碼」流程，我們會寄送重設連結到您的 email 信箱。
        </p>
        <Link
          href="/forgot-password"
          className="inline-flex px-6 py-2.5 border border-cream-200 rounded-xl text-sm hover:bg-cream-50 transition-colors"
        >
          前往重設密碼
        </Link>
      </div>
    </div>
  )
}
