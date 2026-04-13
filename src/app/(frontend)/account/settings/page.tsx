'use client'

import { useState } from 'react'
import { User, Mail, Phone, Calendar, Lock, Link2, Shield } from 'lucide-react'

export default function SettingsPage() {
  const [form, setForm] = useState({
    name: '王小美',
    email: 'xiaomei@example.com',
    phone: '0912-345-678',
    birthday: '1995-06-15',
  })

  const socialAccounts = [
    { provider: 'Google', connected: true, label: 'xiaomei@gmail.com' },
    { provider: 'Facebook', connected: false, label: '' },
    { provider: 'LINE', connected: true, label: '王小美' },
  ]

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
              type="text" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Email</label>
            <div className="flex items-center gap-2">
              <Mail size={14} className="text-muted-foreground shrink-0" />
              <input
                type="email" value={form.email} disabled
                className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm bg-cream-50 text-muted-foreground"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">電話</label>
            <div className="flex items-center gap-2">
              <Phone size={14} className="text-muted-foreground shrink-0" />
              <input
                type="tel" value={form.phone}
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
                type="date" value={form.birthday}
                onChange={(e) => setForm({ ...form, birthday: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
              />
            </div>
          </div>
        </div>
        <button className="px-6 py-2.5 bg-foreground text-cream-50 rounded-xl text-sm hover:bg-foreground/90 transition-colors">
          儲存變更
        </button>
      </div>

      {/* Social accounts */}
      <div className="bg-white rounded-2xl border border-cream-200 p-6 space-y-4">
        <h3 className="font-medium flex items-center gap-2">
          <Link2 size={16} className="text-gold-500" />
          社群帳號綁定
        </h3>
        <div className="space-y-3">
          {socialAccounts.map((acc) => (
            <div key={acc.provider} className="flex items-center justify-between py-3 border-b border-cream-100 last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-cream-100 flex items-center justify-center text-xs font-medium">
                  {acc.provider[0]}
                </div>
                <div>
                  <p className="text-sm font-medium">{acc.provider}</p>
                  {acc.connected && <p className="text-[10px] text-muted-foreground">{acc.label}</p>}
                </div>
              </div>
              <button
                className={`px-4 py-1.5 rounded-lg text-xs transition-colors ${
                  acc.connected
                    ? 'border border-cream-200 text-muted-foreground hover:text-red-500 hover:border-red-200'
                    : 'bg-foreground text-cream-50 hover:bg-foreground/90'
                }`}
              >
                {acc.connected ? '解除綁定' : '綁定'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Password */}
      <div className="bg-white rounded-2xl border border-cream-200 p-6 space-y-4">
        <h3 className="font-medium flex items-center gap-2">
          <Lock size={16} className="text-gold-500" />
          修改密碼
        </h3>
        <div className="space-y-4 max-w-md">
          <input type="password" placeholder="目前密碼" className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40" />
          <input type="password" placeholder="新密碼（至少 8 個字元）" className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40" />
          <input type="password" placeholder="確認新密碼" className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40" />
          <button className="px-6 py-2.5 bg-foreground text-cream-50 rounded-xl text-sm hover:bg-foreground/90 transition-colors">
            更新密碼
          </button>
        </div>
      </div>

      {/* Privacy */}
      <div className="bg-white rounded-2xl border border-cream-200 p-6">
        <h3 className="font-medium flex items-center gap-2 mb-4">
          <Shield size={16} className="text-gold-500" />
          隱私與安全
        </h3>
        <button className="text-xs text-red-500 hover:underline">
          刪除帳號（不可復原）
        </button>
      </div>
    </div>
  )
}
