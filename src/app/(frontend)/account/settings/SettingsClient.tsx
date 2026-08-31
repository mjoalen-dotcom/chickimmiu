'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { User, Mail, Phone, Calendar, Clock, Lock, Ruler, FileText } from 'lucide-react'

export type SettingsInitial = {
  userId: string
  name: string
  email: string
  /** 無 email 社群帳號（LINE 常見）建檔時掛 placeholder → 顯示「綁定 Email」UI */
  emailIsPlaceholder: boolean
  facebookLoginAvailable: boolean
  facebookConnected: boolean
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
  const search = useSearchParams()
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

  // 綁定 Email（僅 placeholder email 帳號出現此 UI）
  const [bindEmail, setBindEmail] = useState('')
  const [bindBusy, setBindBusy] = useState(false)
  const [bindMessage, setBindMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [facebookBusy, setFacebookBusy] = useState(false)
  const [facebookMessage, setFacebookMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(() => {
    const result = search.get('facebook')
    if (result === 'linked' && initial.facebookConnected) return { kind: 'ok', text: 'Facebook 已連結到這個會員帳號。' }
    if (result === 'failed') return { kind: 'err', text: 'Facebook 連結失敗或請求已過期，請重新操作。' }
    return null
  })

  async function handleFacebookLink() {
    setFacebookBusy(true)
    setFacebookMessage(null)
    try {
      const response = await fetch('/api/auth/facebook/link', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}',
      })
      const data = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) {
        setFacebookMessage({ kind: 'err', text: data.error || '無法開始 Facebook 連結' })
        return
      }
      await signIn('facebook', { redirectTo: '/account/settings' })
    } catch {
      setFacebookMessage({ kind: 'err', text: '網路錯誤，請稍後再試' })
    } finally {
      setFacebookBusy(false)
    }
  }

  async function handleBindEmail() {
    setBindMessage(null)
    const email = bindEmail.trim().toLowerCase()
    if (!/.+@.+\..+/.test(email)) {
      setBindMessage({ kind: 'err', text: 'Email 格式不正確' })
      return
    }
    setBindBusy(true)
    try {
      const res = await fetch('/api/customers/bind-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      })
      const data = (await res.json().catch(() => ({}))) as { message?: string }
      if (!res.ok) {
        setBindMessage({ kind: 'err', text: data.message || `綁定失敗 (${res.status})` })
        return
      }
      setBindMessage({ kind: 'ok', text: 'Email 綁定成功！訂單通知將寄到這個信箱。' })
      startTransition(() => router.refresh())
    } catch {
      setBindMessage({ kind: 'err', text: '網路錯誤，請稍後再試' })
    } finally {
      setBindBusy(false)
    }
  }

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
    const res = await fetch(`/api/customers/${initial.userId}`, {
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
          {initial.emailIsPlaceholder ? (
            <div>
              <label className={labelCls}>綁定 Email（尚未設定）</label>
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-muted-foreground shrink-0" />
                <input
                  type="email"
                  value={bindEmail}
                  onChange={(e) => setBindEmail(e.target.value)}
                  placeholder="your@email.com"
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={handleBindEmail}
                  disabled={bindBusy}
                  className="shrink-0 px-4 py-3 bg-foreground text-cream-50 rounded-xl text-sm hover:bg-foreground/90 transition-colors disabled:opacity-60"
                >
                  {bindBusy ? '綁定中…' : '綁定'}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                您是以 LINE 登入且尚未設定 email；綁定後才能收到訂單通知信。
              </p>
              {bindMessage && (
                <p className={`text-xs mt-1.5 ${bindMessage.kind === 'ok' ? 'text-green-600' : 'text-red-600'}`} role="alert">
                  {bindMessage.text}
                </p>
              )}
            </div>
          ) : (
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
          )}
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

      {/* Social login connections */}
      <div className="bg-white rounded-2xl border border-cream-200 p-6 space-y-4">
        <div>
          <h3 className="font-medium">登入方式與未來體驗</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            先登入這個原會員再連結 Facebook，可保留原有訂單、點數、會員等級與收藏。
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-cream-200 px-4 py-3">
          <div>
            <div className="text-sm font-medium">Facebook</div>
            <div className="text-xs text-muted-foreground">
              {initial.facebookConnected ? '已連結' : initial.facebookLoginAvailable ? '尚未連結' : '目前尚未開放'}
            </div>
          </div>
          {initial.facebookConnected ? (
            <span className="text-xs rounded-full bg-green-50 text-green-700 border border-green-200 px-3 py-1.5">已連結</span>
          ) : initial.facebookLoginAvailable ? (
            <button type="button" onClick={handleFacebookLink} disabled={facebookBusy}
              className="px-4 py-2 rounded-xl bg-[#1877F2] text-white text-sm disabled:opacity-50">
              {facebookBusy ? '連線中…' : '連結 Facebook'}
            </button>
          ) : null}
        </div>
        {facebookMessage && (
          <p role="alert" className={`text-xs rounded-xl px-4 py-2 ${facebookMessage.kind === 'ok' ? 'text-green-700 bg-green-50 border border-green-200' : 'text-red-600 bg-red-50 border border-red-200'}`}>
            {facebookMessage.text}
          </p>
        )}
        <div className="rounded-xl bg-cream-50 px-4 py-3 text-xs text-muted-foreground leading-relaxed">
          Meta Horizon／Quest 是另一種身分授權。將來若推出空間體驗，會用同一個 CKMU 會員識別承接點數、等級與內容權益，並由您另外同意連結；現在不會先收集 VR 身分或裝置資料。
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
