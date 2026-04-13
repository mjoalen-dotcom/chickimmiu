'use client'

import { useState } from 'react'
import { MapPin, Plus, Edit3, Trash2, Star } from 'lucide-react'

type AddressType = 'home' | 'convenience_store'

interface Address {
  id: string
  label: string
  type: AddressType
  recipientName: string
  phone: string
  city: string
  district: string
  zipCode: string
  address: string
  // 超商取貨專用
  storeName?: string
  storeId?: string
  storeCarrier?: string // 711, family, hilife, ok
  isDefault: boolean
}

// Demo data
const INITIAL_ADDRESSES: Address[] = [
  {
    id: '1',
    label: '住家',
    type: 'home',
    recipientName: '王小美',
    phone: '0912-345-678',
    city: '台北市',
    district: '大安區',
    zipCode: '106',
    address: '忠孝東路四段100號5樓',
    isDefault: true,
  },
  {
    id: '2',
    label: '公司',
    type: 'home',
    recipientName: '王小美',
    phone: '0912-345-678',
    city: '台北市',
    district: '信義區',
    zipCode: '110',
    address: '松仁路100號10樓',
    isDefault: false,
  },
  {
    id: '3',
    label: '7-ELEVEN 取貨',
    type: 'convenience_store',
    recipientName: '王小美',
    phone: '0912-345-678',
    city: '',
    district: '',
    zipCode: '',
    address: '台北市大安區忠孝東路四段50號',
    storeName: '忠孝門市',
    storeId: '991234',
    storeCarrier: '711',
    isDefault: false,
  },
]

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>(INITIAL_ADDRESSES)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [form, setForm] = useState({
    label: '',
    type: 'home' as AddressType,
    recipientName: '',
    phone: '',
    city: '',
    district: '',
    zipCode: '',
    address: '',
  })

  const handleSetDefault = (id: string) => {
    setAddresses((prev) =>
      prev.map((a) => ({ ...a, isDefault: a.id === id })),
    )
  }

  const handleDelete = (id: string) => {
    setAddresses((prev) => prev.filter((a) => a.id !== id))
  }

  const handleSubmit = () => {
    if (editingId) {
      setAddresses((prev) =>
        prev.map((a) =>
          a.id === editingId ? { ...a, ...form } : a,
        ),
      )
    } else {
      setAddresses((prev) => [
        ...prev,
        { ...form, id: Date.now().toString(), isDefault: prev.length === 0 },
      ])
    }
    setShowForm(false)
    setEditingId(null)
    setForm({ label: '', type: 'home', recipientName: '', phone: '', city: '', district: '', zipCode: '', address: '' })
  }

  const handleEdit = (addr: Address) => {
    setForm({
      label: addr.label,
      type: addr.type,
      recipientName: addr.recipientName,
      phone: addr.phone,
      city: addr.city,
      district: addr.district,
      zipCode: addr.zipCode,
      address: addr.address,
    })
    setEditingId(addr.id)
    setShowForm(true)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-serif">地址管理</h2>
        <button
          onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ label: '', type: 'home', recipientName: '', phone: '', city: '', district: '', zipCode: '', address: '' }) }}
          className="flex items-center gap-1.5 px-4 py-2 bg-foreground text-cream-50 rounded-xl text-xs hover:bg-foreground/90 transition-colors"
        >
          <Plus size={14} />
          新增地址
        </button>
      </div>

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
            <button onClick={handleSubmit} className="px-6 py-2.5 bg-foreground text-cream-50 rounded-xl text-sm hover:bg-foreground/90 transition-colors">
              {editingId ? '更新' : '儲存'}
            </button>
            <button onClick={() => { setShowForm(false); setEditingId(null) }} className="px-6 py-2.5 border border-cream-200 rounded-xl text-sm hover:bg-cream-50 transition-colors">
              取消
            </button>
          </div>
        </div>
      )}

      {/* Address list */}
      <div className="grid gap-4">
        {addresses.map((addr) => (
          <div key={addr.id} className={`bg-white rounded-2xl border p-5 ${addr.isDefault ? 'border-gold-500' : 'border-cream-200'}`}>
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
                  <p className="text-sm mt-1">{addr.recipientName}・{addr.phone}</p>
                  {addr.type === 'convenience_store' ? (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      🏪 {addr.storeCarrier === '711' ? '7-ELEVEN' : addr.storeCarrier === 'family' ? '全家' : addr.storeCarrier === 'hilife' ? '萊爾富' : 'OK mart'}
                      ・{addr.storeName}（{addr.storeId}）
                      <br />{addr.address}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {addr.zipCode} {addr.city}{addr.district}{addr.address}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {!addr.isDefault && (
                  <button onClick={() => handleSetDefault(addr.id)} className="p-2 text-muted-foreground/50 hover:text-gold-500 transition-colors" title="設為預設">
                    <Star size={14} />
                  </button>
                )}
                <button onClick={() => handleEdit(addr)} className="p-2 text-muted-foreground/50 hover:text-foreground transition-colors" title="編輯">
                  <Edit3 size={14} />
                </button>
                <button onClick={() => handleDelete(addr.id)} className="p-2 text-muted-foreground/50 hover:text-red-500 transition-colors" title="刪除">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
