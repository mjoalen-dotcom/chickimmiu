'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useAllFormFields, useDocumentInfo, useField } from '@payloadcms/ui'
import { reduceFieldsToValues } from 'payload/shared'

import { evaluateProduct } from '@/lib/admin/productCompleteness'

const WIZARD_COUNT_KEY = 'ckmu-product-wizard-complete-count'
const WIZARD_FORCE_KEY = 'ckmu-product-wizard-force-show'
const WIZARD_FORCE_EVENT = 'ckmu-product-wizard-force-show'

type LooseRecord = Record<string, unknown>

function asRecord(value: unknown): LooseRecord {
  if (value && typeof value === 'object') return value as LooseRecord
  return {}
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function hasRelationship(value: unknown): boolean {
  if (value == null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'object') {
    const obj = value as LooseRecord
    return hasRelationship(obj.id)
  }
  return false
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function hasTagRows(value: unknown): boolean {
  if (!Array.isArray(value)) return false
  return value.some((row) => {
    if (typeof row === 'string') return row.trim().length > 0
    if (row && typeof row === 'object') return hasText((row as LooseRecord).tag)
    return false
  })
}

const ProductCreateWizard: React.FC = () => {
  const { id: docId } = useDocumentInfo()
  const isNew = docId == null || docId === ''

  const [fields] = useAllFormFields()
  const { setValue: setStatusValue } = useField<string>({ path: 'status' })

  const [mounted, setMounted] = useState(false)
  const [completedCount, setCompletedCount] = useState(0)
  const [forceShow, setForceShow] = useState(false)
  const [helperMessage, setHelperMessage] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    const count = Number(localStorage.getItem(WIZARD_COUNT_KEY) || '0')
    const forced = localStorage.getItem(WIZARD_FORCE_KEY) === '1'
    setCompletedCount(Number.isFinite(count) ? count : 0)
    setForceShow(forced)

    const onForceShow = () => {
      localStorage.setItem(WIZARD_FORCE_KEY, '1')
      setForceShow(true)
      setHelperMessage('已重新啟用建立精靈')
      window.setTimeout(() => setHelperMessage(null), 1600)
    }

    window.addEventListener(WIZARD_FORCE_EVENT, onForceShow)
    return () => {
      window.removeEventListener(WIZARD_FORCE_EVENT, onForceShow)
    }
  }, [])

  const data = useMemo(() => reduceFieldsToValues(fields, true), [fields])
  const status = useMemo(() => evaluateProduct(data), [data])

  const source = asRecord(data)

  const nameOk = hasText(source.name)
  const featuredImageOk = hasRelationship(source.featuredImage)
  const priceOk = (toNumber(source.price) ?? 0) > 0
  const variantsOk = Array.isArray(source.variants) && source.variants.length > 0
  const stockOk = (toNumber(source.stock) ?? 0) > 0
  const categoryOk = hasRelationship(source.category)
  const descriptionOk = hasText(source.description)
  const tagsOk = hasTagRows(source.tags)

  const step1Done = nameOk && featuredImageOk
  const step2Done = priceOk && (variantsOk || stockOk)

  const currentStep = !step1Done ? 1 : !step2Done ? 2 : 3
  const progress = currentStep === 1 ? 33 : currentStep === 2 ? 66 : 100

  const checklist = [
    { label: '商品名稱', ok: nameOk, missingTone: '#ef4444' },
    { label: '封面主圖', ok: featuredImageOk, missingTone: '#ef4444' },
    { label: '原價', ok: priceOk, missingTone: '#ef4444' },
    { label: '變體或庫存', ok: variantsOk || stockOk, missingTone: '#ef4444' },
    { label: '商品分類', ok: categoryOk, missingTone: '#ef4444' },
    { label: '商品描述', ok: descriptionOk, missingTone: '#d97706' },
    { label: '標籤', ok: tagsOk, missingTone: '#d97706' },
  ]
  const allChecklistDone = checklist.every((item) => item.ok)

  const shouldRender = mounted && isNew && (completedCount < 3 || forceShow)
  if (!shouldRender) return null

  const triggerSave = () => {
    const form = document.querySelector('form')
    if (form && typeof (form as HTMLFormElement).requestSubmit === 'function') {
      ;(form as HTMLFormElement).requestSubmit()
      return
    }
    const fallbackButton = document.querySelector('button[type="submit"]')
    if (fallbackButton instanceof HTMLButtonElement) {
      fallbackButton.click()
    }
  }

  const markWizardCompleted = () => {
    const next = completedCount + 1
    setCompletedCount(next)
    localStorage.setItem(WIZARD_COUNT_KEY, String(next))
    localStorage.removeItem(WIZARD_FORCE_KEY)
    setForceShow(false)
  }

  const publishNow = () => {
    if (!allChecklistDone) return
    if (!window.confirm('即將立刻上架，前台會看見此商品。確定？')) return

    setStatusValue('published')
    markWizardCompleted()
    window.setTimeout(() => {
      triggerSave()
    }, 80)
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 64,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(1100px, calc(100vw - 32px))',
        zIndex: 95,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          pointerEvents: 'auto',
          borderRadius: 12,
          border: '1px solid var(--theme-elevation-250, #d8c89f)',
          background:
            'linear-gradient(135deg, rgba(255, 248, 220, 0.98) 0%, rgba(255, 245, 204, 0.98) 100%)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.14)',
          padding: '10px 14px',
          maxHeight: 80,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div
          style={{
            width: '100%',
            height: 6,
            borderRadius: 999,
            background: 'rgba(0, 0, 0, 0.08)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #d4a373 0%, #b08968 100%)',
              transition: 'width 0.25s ease',
            }}
          />
        </div>

        {currentStep === 1 && (
          <div style={{ fontSize: 14, color: '#5b4636', fontWeight: 600 }}>
            步驟 1/3：基本資訊 — 請先填寫商品名稱與封面主圖
          </div>
        )}

        {currentStep === 2 && (
          <div style={{ fontSize: 14, color: '#5b4636', fontWeight: 600 }}>
            步驟 2/3：價格與變體 — 至少填入原價，並用「🎨 變體矩陣產生器」快速建立 SKU
          </div>
        )}

        {currentStep === 3 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              minHeight: 44,
            }}
          >
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {checklist.map((item) => (
                <span
                  key={item.label}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: item.ok ? '#15803d' : item.missingTone,
                  }}
                >
                  {item.ok ? '✅' : '⚠️'} {item.label}
                </span>
              ))}
            </div>
            {allChecklistDone && (
              <button
                type="button"
                onClick={publishNow}
                style={{
                  border: '1px solid #a16207',
                  borderRadius: 8,
                  background: '#f59e0b',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 700,
                  padding: '8px 12px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                🚀 全部填好，準備上架
              </button>
            )}
          </div>
        )}
      </div>

      {helperMessage && (
        <div
          style={{
            marginTop: 8,
            textAlign: 'center',
            fontSize: 12,
            color: 'var(--theme-elevation-800, #18181b)',
          }}
        >
          {helperMessage}
        </div>
      )}

      {currentStep === 3 && (
        <div
          style={{
            marginTop: 6,
            textAlign: 'center',
            fontSize: 11,
            color: '#6b7280',
          }}
        >
          分頁完成度：① {status.tab1.state === 'ok' ? '✅' : status.tab1.state === 'warn' ? '⚠️' : '🟡'} ・
          ② {status.tab2.state === 'ok' ? '✅' : status.tab2.state === 'warn' ? '⚠️' : '🟡'} ・
          ③ {status.tab3.state === 'ok' ? '✅' : status.tab3.state === 'warn' ? '⚠️' : '🟡'} ・
          ④ {status.tab4.state === 'ok' ? '✅' : status.tab4.state === 'warn' ? '⚠️' : '🟡'}
        </div>
      )}
    </div>
  )
}

export default ProductCreateWizard
