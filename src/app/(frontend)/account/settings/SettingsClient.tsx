'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { User, Mail, Phone, Calendar, Clock, Lock, Ruler, FileText } from 'lucide-react'

export type SettingsInitial = {
  userId: string
  name: string
  email: string
  phone: string
  birthday: string
  birthTime: string
  bodyProfile: {
    height: string
    weight: string
    footLength: string
    bust: string
    waist: string
    hips: string
  }
  invoiceInfo: {
    invoiceTitle: string
    taxId: string
    invoiceAddress: string
    invoiceContactName: string
    invoicePhone: string
  }
}

/** '' → null；非空且為有限數字 → number；否則 null（讓 DB 清空） */
function numOrNull(v: string): number | null {
  const t = v.trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** '' → null；否則 trim 後的 string */
function strOrNull(v: string): string | null {
  const t = v.trim()
  return t === '' ? null : t
}

export default function SettingsClient({ initial }: { initial: SettingsInitial }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [form, setForm] = useState({
    name: initial.name,
    phone: initial.phone,
    birthday: initial.birthday,
    birthTime: initial.birthTime,
  })
  const [body, setBody] = useState({ ...initial.bodyProfile })
  const [invoice, setInvoice] = useState({ ...initial.invoiceInfo })

  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  async function handleSave() {
    setMessage(null)
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      phone: strOrNull(form.phone),
      birthday: form.birthday ? new Date(form.birthday).toISOString() : null,
      birthTime:
        form.birthTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(form.birthTime)
          ? form.birthTime
          : null,
      bodyProfile: {
        height: numOrNull(body.height),
        weight: numOrNull(body.weight),
        footLength: numOrNull(body.footLength),
        bust: numOrNull(body.bust),
        waist: numOrNull(body.waist),
        hips: numOrNull(body.hips),
      },
      invoiceInfo: {
        invoiceTitle: strOrNull(invoice.invoiceTitle),
        taxId: strOrNull(invoice.taxId),
        invoiceAddress: strOrNull(invoice.invoiceAddress),
        invoiceContactName: strOrNull(invoice.invoiceContactName),
        invoicePhone: strOrNull(invoice.invoicePhone),
      },
    }
    const res = await fetch(`/api/users/${initial.userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const bodyText = await res.text().catch(() => '')
      setMessage({ kind: 'err', text: `儲存失敗 (${res.status}) ${bodyText.slice(0, 160)}` })
      return
    }
    setMessage({ kind: 'ok', text: '已儲存變更' })
    startTransition(() => router.refresh())
  }

  const inputCls =
    'w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40'
  const labelCls = 'text-xs text-muted-foreground mb-1.5 block'

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
            <label className={labelCls}>姓名</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Email（不可修改）</label>
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
            <label className={labelCls}>電話</label>
            <div className="flex items-center gap-2">
              <Phone size={14} className="text-muted-foreground shrink-0" />
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>生日</label>
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-muted-foreground shrink-0" />
              <input
                type="date"
                value={form.birthday}
                onChange={(e) => setForm({ ...form, birthday: e.target.value })}
                max={new Date().toISOString().slice(0, 10)}
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>
              出生時間（選填，更精準的星座推算用）
            </label>
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-muted-foreground shrink-0" />
              <input
                type="time"
                value={form.birthTime}
                onChange={(e) => setForm({ ...form, birthTime: e.target.value })}
                className={inputCls}
                placeholder="HH:mm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 身體資料（AI 尺寸推薦用） */}
      <div className="bg-white rounded-2xl border border-cream-200 p-6 space-y-5">
        <div className="flex items-start gap-2">
          <Ruler size={16} className="text-gold-500 mt-1 shrink-0" />
          <div>
            <h3 className="font-medium">身體資料</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              提供身體尺寸讓我們為您推薦最合身的款式與尺碼。資料僅用於 AI 尺寸建議，不會對外公開。
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>身高（cm）</label>
            <input
              type="number"
              inputMode="decimal"
              min={100}
              max={250}
              value={body.height}
              onChange={(e) => setBody({ ...body, height: e.target.value })}
              className={inputCls}
              placeholder="例如 160"
            />
          </div>
          <div>
            <label className={labelCls}>體重（kg）</label>
            <input
              type="number"
              inputMode="decimal"
              min={30}
              max={200}
              value={body.weight}
              onChange={(e) => setBody({ ...body, weight: e.target.value })}
              className={inputCls}
              placeholder="例如 50"
            />
          </div>
          <div>
            <label className={labelCls}>腳長（cm）</label>
            <input
              type="number"
              inputMode="decimal"
              min={15}
              max={35}
              value={body.footLength}
              onChange={(e) => setBody({ ...body, footLength: e.target.value })}
              className={inputCls}
              placeholder="例如 23.5"
            />
          </div>
          <div>
            <label className={labelCls}>胸圍（cm）</label>
            <input
              type="number"
              inputMode="decimal"
              min={50}
              max={160}
              value={body.bust}
              onChange={(e) => setBody({ ...body, bust: e.target.value })}
              className={inputCls}
              placeholder="例如 84"
            />
          </div>
          <div>
            <label className={labelCls}>腰圍（cm）</label>
            <input
              type="number"
              inputMode="decimal"
              min={40}
              max={160}
              value={body.waist}
              onChange={(e) => setBody({ ...body, waist: e.target.value })}
              className={inputCls}
              placeholder="例如 62"
            />
          </div>
          <div>
            <label className={labelCls}>臀圍（cm）</label>
            <input
              type="number"
              inputMode="decimal"
              min={50}
              max={170}
              value={body.hips}
              onChange={(e) => setBody({ ...body, hips: e.target.value })}
              className={inputCls}
              placeholder="例如 90"
            />
          </div>
        </div>
      </div>

      {/* 公司發票資料 */}
      <div className="bg-white rounded-2xl border border-cream-200 p-6 space-y-5">
        <div className="flex items-start gap-2">
          <FileText size={16} className="text-gold-500 mt-1 shrink-0" />
          <div>
            <h3 className="font-medium">公司發票資料</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              三聯式發票抬頭、統編等資料，結帳時可一鍵套用，免重複填寫。
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelCls}>發票抬頭</label>
            <input
              type="text"
              value={invoice.invoiceTitle}
              onChange={(e) => setInvoice({ ...invoice, invoiceTitle: e.target.value })}
              className={inputCls}
              placeholder="公司全名"
            />
          </div>
          <div>
            <label className={labelCls}>統一編號</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={8}
              value={invoice.taxId}
              onChange={(e) =>
                setInvoice({
                  ...invoice,
                  taxId: e.target.value.replace(/\D/g, '').slice(0, 8),
                })
              }
              className={inputCls}
              placeholder="8 碼數字"
            />
          </div>
          <div>
            <label className={labelCls}>聯絡人</label>
            <input
              type="text"
              value={invoice.invoiceContactName}
              onChange={(e) => setInvoice({ ...invoice, invoiceContactName: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>發票寄送地址（紙本三聯式用，電子發票可留空）</label>
            <input
              type="text"
              value={invoice.invoiceAddress}
              onChange={(e) => setInvoice({ ...invoice, invoiceAddress: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>聯絡電話</label>
            <input
              type="tel"
              value={invoice.invoicePhone}
              onChange={(e) => setInvoice({ ...invoice, invoicePhone: e.target.value })}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* Save action + message — 共用一個 handleSave 送全部 sections */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="text-xs text-muted-foreground">所有區段變更會一起儲存。</div>
        <div className="flex flex-col sm:items-end gap-2">
          {message && (
            <div
              className={`text-xs rounded-xl px-4 py-2 ${
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
