'use client'

import { useField } from '@payloadcms/ui'
import { Eye, EyeOff } from 'lucide-react'
import React, { useState } from 'react'

interface BlogPasswordFieldProps {
  path: string
}

export default function BlogPasswordField({ path }: BlogPasswordFieldProps) {
  const { setValue, value } = useField<string | null>({ path })
  const [visible, setVisible] = useState(false)

  return (
    <div className="field-type" style={{ marginBottom: 18 }}>
      <label
        htmlFor={`${path}-input`}
        style={{ display: 'block', marginBottom: 7, fontSize: 13, fontWeight: 600 }}
      >
        文章密碼
      </label>
      <div style={{ display: 'flex', maxWidth: 460, gap: 8 }}>
        <input
          id={`${path}-input`}
          type={visible ? 'text' : 'password'}
          value={typeof value === 'string' ? value : ''}
          minLength={6}
          maxLength={128}
          autoComplete="new-password"
          placeholder="輸入 6 至 128 個字元"
          onChange={(event) => setValue(event.currentTarget.value)}
          style={{
            minWidth: 0,
            minHeight: 40,
            flex: 1,
            padding: '8px 11px',
            border: '1px solid var(--theme-elevation-250)',
            borderRadius: 6,
            background: 'var(--theme-input-bg)',
            color: 'var(--theme-text)',
          }}
        />
        <button
          type="button"
          aria-label={visible ? '隱藏密碼' : '顯示密碼'}
          title={visible ? '隱藏密碼' : '顯示密碼'}
          onClick={() => setVisible((current) => !current)}
          style={{
            width: 40,
            minHeight: 40,
            border: '1px solid var(--theme-elevation-250)',
            borderRadius: 6,
            background: 'var(--theme-bg)',
            color: 'var(--theme-text)',
            cursor: 'pointer',
          }}
        >
          {visible ? <EyeOff aria-hidden size={17} /> : <Eye aria-hidden size={17} />}
        </button>
      </div>
      <p
        style={{
          maxWidth: 620,
          margin: '7px 0 0',
          color: 'var(--theme-elevation-550)',
          fontSize: 11,
          lineHeight: 1.55,
        }}
      >
        新密碼只在這次儲存時使用，系統只保留安全雜湊。已有密碼時留白即可維持原密碼。
      </p>
    </div>
  )
}
