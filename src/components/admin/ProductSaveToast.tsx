'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useForm, useFormProcessing, useFormSubmitted } from '@payloadcms/ui'

interface ToastState {
  id: number
  kind: 'success' | 'error'
  text: string
}

function findFirstErrorMessage(fields: Record<string, unknown>): string | null {
  for (const value of Object.values(fields)) {
    if (!value || typeof value !== 'object') continue
    const fieldState = value as { errorMessage?: unknown; valid?: boolean }
    if (typeof fieldState.errorMessage === 'string' && fieldState.errorMessage.trim()) {
      return fieldState.errorMessage
    }
    if (fieldState.valid === false) {
      return '欄位驗證失敗，請檢查必填項目'
    }
  }
  return null
}

const ProductSaveToast: React.FC = () => {
  const { isValid, fields } = useForm()
  const processing = useFormProcessing()
  const submitted = useFormSubmitted()

  const [mounted, setMounted] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [phase, setPhase] = useState<'in' | 'out'>('in')

  const prevProcessingRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const errorMessage = useMemo(() => {
    if (!fields || typeof fields !== 'object') return null
    return findFirstErrorMessage(fields as Record<string, unknown>)
  }, [fields])

  useEffect(() => {
    setMounted(true)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (hideRef.current) clearTimeout(hideRef.current)
    }
  }, [])

  useEffect(() => {
    const prevProcessing = prevProcessingRef.current
    prevProcessingRef.current = processing

    // 只有在一次 submit processing 結束時才顯示提示
    if (!(submitted && prevProcessing && !processing)) return

    if (timerRef.current) clearTimeout(timerRef.current)
    if (hideRef.current) clearTimeout(hideRef.current)

    const nextToast: ToastState = isValid
      ? {
          id: Date.now(),
          kind: 'success',
          text: '✅ 商品已儲存',
        }
      : {
          id: Date.now(),
          kind: 'error',
          text: `❌ 儲存失敗：${errorMessage ?? '請檢查欄位錯誤後再試'}`,
        }

    setToast(nextToast)
    setPhase('in')

    timerRef.current = setTimeout(() => {
      setPhase('out')
    }, 1100)

    hideRef.current = setTimeout(() => {
      setToast((current) => (current?.id === nextToast.id ? null : current))
    }, 1500)
  }, [processing, submitted, isValid, errorMessage])

  if (!mounted || !toast) return null

  const bgColor =
    toast.kind === 'success'
      ? 'rgba(22, 163, 74, 0.94)'
      : 'rgba(220, 38, 38, 0.94)'

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 120,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      aria-live="polite"
    >
      <div
        style={{
          background: bgColor,
          color: '#fff',
          borderRadius: 12,
          padding: '14px 18px',
          fontSize: 16,
          fontWeight: 700,
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25)',
          opacity: phase === 'in' ? 1 : 0,
          transform: phase === 'in' ? 'translateY(0)' : 'translateY(-6px)',
          transition: 'opacity 0.35s ease, transform 0.35s ease',
          maxWidth: 'min(90vw, 560px)',
          textAlign: 'center',
        }}
      >
        {toast.text}
      </div>
    </div>,
    document.body,
  )
}

export default ProductSaveToast
