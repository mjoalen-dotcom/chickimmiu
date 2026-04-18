'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Plus, Edit3, Trash2, Star } from 'lucide-react'

export type AddressLite = {
  id?: string | null
  label?: string | null
  recipientName?: string | null
  phone?: string | null
  zipCode?: string | null
  city?: string | null
  district?: string | null
  address?: string | null
  isDefault?: boolean | null
}

type FormState = {
  label: string
  recipientName: string
  phone: string
  zipCode: string
  city: string
  district: string
  address: string
}

const EMPTY_FORM: FormState = {
  label: '',
  recipientName: '',
  phone: '',
  zipCode: '',
  city: '',
  district: '',
  address: '',
}

export default function AddressesClient({
  userId,
  addresses,
}: {
  userId: string
  addresses: AddressLite[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)

  async function patchAddresses(next: AddressLite[]) {
    setError(null)
    const res = await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ addresses: next }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      setError(`儲存失敗 (${res.status}) ${body.slice(0, 120)}`)
      return false
    }
    startTransition(() => router.refresh())
    return true
  }

  function resetForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  function handleEdit(addr: AddressLite) {
    setForm({
      label: addr.label ?? '',
      recipientName: addr.recipientName ?? '',
      phone: addr.phone ?? '',
      zipCode: addr.zipCode ?? '',
      city: addr.city ?? '',
      district: addr.district ?? '',
      address: addr.address ?? '',
    })
    setEditingId(addr.id ? String(addr.id) : null)
    setShowForm(true)
  }

  async function handleSubmit() {
    if (!form.recipientName.trim() || !form.phone.trim() || !form.city.trim() || !form.address.trim()) {
      setError('請填寫必填欄位（姓名 / 電話 / 縣市 / 詳細地址）')
      return
    }
    let next: AddressLite[]
    if (editingId) {
      next = addresses.map((a) =>
        a.id && String(a.id) === editingId ? { ...a, ...form } : a,
      )
    } else {
      const isDefault = addresses.length === 0
      next = [...addresses, { ...form, isDefault }]
    }
    const ok = await patchAddresses(next)
    if (ok) resetForm()
  }

  async function handleDelete(id: string) {
    const target = addresses.find((a) => a.id && String(a.id) === id)
    const wasDefault = Boolean(target?.isDefault)
    let next = addresses.filter((a) => !(a.id && String(a.id) === id))
    if (wasDefault && next.length > 0) {
      next = next.map((a, i) => ({ ...a, isDefault: i === 0 }))
    }
    await patchAddresses(next)
  }

  async function handleSetDefault(id: string) {
    const next = addresses.map((a) => ({
      ...a,
      isDefault: Boolean(a.id && String(a.id) === id),
    }))
    await patchAddresses(next)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-serif">地址管理</h2>
        <button
          onClick={() => {
            if (showForm) {
              resetForm()
            } else {
              setEditingId(null)
              setForm(EMPTY_FORM)
              setShowForm(true)
            }
          }}
          className="flex items-center gap-1.5 px-4 py-2 bg-foreground text-cream-50 rounded-xl text-xs hover:bg-foreground/90 transition-colors"
        >
          <Plus size={14} />
          {showForm ? '收合' : '新增地址'}
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-cream-200 p-6 space-y-4">
          <h3 className="font-medium text-sm">{editingId ? '編輯地址' : '新增地址'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input type="text" placeholder="地址標籤（例如：住家）" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40" />
            <input type="text" placeholder="收件人姓名 *" value={form.recipientName} onChange={(e) => setForm({ ...form, recipientName: e.target.value })}
              className="px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40" />
            <input type="tel" placeholder="聯絡電話 *" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40" />
            <input type="text" placeholder="郵遞區號" value={form.zipCode} onChange={(e) => setForm({ ...form, zipCode: e.target.value })}
              className="px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40" />
            <input type="text" placeholder="縣市 *" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40" />
            <input type="text" placeholder="鄉鎮區" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })}
              className="px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40" />
            <input type="text" placeholder="詳細地址 *" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="sm:col-span-2 px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40" />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSubmit}
              disabled={isPending}
              className="px-6 py-2.5 bg-foreground text-cream-50 rounded-xl text-sm hover:bg-foreground/90 transition-colors disabled:opacity-50"
            >
              {isPending ? '儲存中…' : editingId ? '更新' : '儲存'}
            </button>
            <button
              onClick={resetForm}
              disabled={isPending}
              className="px-6 py-2.5 border border-cream-200 rounded-xl text-sm hover:bg-cream-50 transition-colors disabled:opacity-50"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Address list */}
      {addresses.length === 0 && !showForm ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-cream-200">
          <MapPin size={48} className="mx-auto text-cream-200 mb-4" />
          <p className="text-sm text-muted-foreground">尚未新增地址</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {addresses.map((addr) => {
            const id = addr.id ? String(addr.id) : ''
            return (
              <div key={id || Math.random()} className={`bg-white rounded-2xl border p-5 ${addr.isDefault ? 'border-gold-500' : 'border-cream-200'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-cream-100 flex items-center justify-center shrink-0">
                      <MapPin size={18} className="text-gold-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{addr.label || '地址'}</span>
                        {addr.isDefault && (
                          <span className="px-2 py-0.5 bg-gold-500/10 text-gold-600 text-[10px] rounded-full">
                            預設
                          </span>
                        )}
                      </div>
                      <p className="text-sm mt-1">
                        {addr.recipientName || '—'}・{addr.phone || '—'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {addr.zipCode ?? ''} {addr.city ?? ''}{addr.district ?? ''}{addr.address ?? ''}
                      </p>
                    </div>
                  </div>
                  {id && (
                    <div className="flex items-center gap-1">
                      {!addr.isDefault && (
                        <button
                          onClick={() => handleSetDefault(id)}
                          disabled={isPending}
                          className="p-2 text-muted-foreground/50 hover:text-gold-500 transition-colors disabled:opacity-50"
                          title="設為預設"
                        >
                          <Star size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(addr)}
                        disabled={isPending}
                        className="p-2 text-muted-foreground/50 hover:text-foreground transition-colors disabled:opacity-50"
                        title="編輯"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(id)}
                        disabled={isPending}
                        className="p-2 text-muted-foreground/50 hover:text-red-500 transition-colors disabled:opacity-50"
                        title="刪除"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
