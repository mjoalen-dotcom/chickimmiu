'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Camera, Loader2, Trash2, User } from 'lucide-react'

type Props = {
  currentAvatarUrl: string | null
  displayName: string
}

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'
const MAX_BYTES = 8 * 1024 * 1024

export default function AccountAvatarUpload({ currentAvatarUrl, displayName }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)

    if (file.size > MAX_BYTES) {
      setError('檔案超過 8MB 上限')
      e.target.value = ''
      return
    }
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
      setError('僅支援 JPG / PNG / WebP / GIF')
      e.target.value = ''
      return
    }

    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/account/avatar', { method: 'POST', body: form })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string }
        setError(data.message ?? '上傳失敗，請稍後再試')
      } else {
        router.refresh()
      }
    } catch {
      setError('上傳失敗，請檢查網路連線')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleRemove() {
    if (!currentAvatarUrl) return
    if (!confirm('確定要移除目前的頭像嗎？')) return
    setError(null)
    setUploading(true)
    try {
      const res = await fetch('/api/account/avatar', { method: 'DELETE' })
      if (!res.ok) {
        setError('移除失敗')
      } else {
        router.refresh()
      }
    } catch {
      setError('移除失敗，請檢查網路連線')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl p-6 border border-cream-200 flex items-center gap-5">
      <div className="relative shrink-0">
        <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-cream-200 bg-cream-100 flex items-center justify-center">
          {currentAvatarUrl ? (
            <Image
              src={currentAvatarUrl}
              alt={`${displayName} 的頭像`}
              width={80}
              height={80}
              className="w-full h-full object-cover"
              unoptimized
            />
          ) : (
            <User size={32} className="text-cream-300" />
          )}
        </div>
        {uploading && (
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
            <Loader2 size={22} className="text-white animate-spin" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium mb-0.5">{displayName}</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          支援 JPG / PNG / WebP / GIF，檔案大小 ≤ 8MB，
          <br className="hidden md:inline" />
          建議正方形、尺寸 400×400 以上。
        </p>
        {error && (
          <p className="text-[11px] text-red-600 mt-1.5">{error}</p>
        )}
        <div className="flex items-center gap-2 mt-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full bg-gold-500 text-white hover:bg-gold-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Camera size={12} />
            {currentAvatarUrl ? '更換頭像' : '上傳頭像'}
          </button>
          {currentAvatarUrl && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border border-cream-200 text-muted-foreground hover:bg-cream-50 hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 size={12} />
              移除
            </button>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
