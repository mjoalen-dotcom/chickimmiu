'use client'

import React, { useState } from 'react'
import { useDocumentInfo } from '@payloadcms/ui'

const WIZARD_FORCE_KEY = 'ckmu-product-wizard-force-show'
const WIZARD_FORCE_EVENT = 'ckmu-product-wizard-force-show'

const ProductWizardLauncher: React.FC = () => {
  const { id: docId } = useDocumentInfo()
  const isNew = docId == null || docId === ''
  const [message, setMessage] = useState<string | null>(null)

  const showWizard = () => {
    localStorage.setItem(WIZARD_FORCE_KEY, '1')
    window.dispatchEvent(new Event(WIZARD_FORCE_EVENT))
    setMessage(isNew ? '已重新顯示建立精靈' : '已啟用，下次新建商品會顯示精靈')
    window.setTimeout(() => setMessage(null), 1600)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <button
        type="button"
        onClick={showWizard}
        style={{
          border: '1px solid var(--theme-elevation-250, #c9c9cf)',
          borderRadius: 6,
          background: 'var(--theme-elevation-50, #fafafa)',
          color: 'var(--theme-text, #171717)',
          fontSize: 12,
          fontWeight: 600,
          padding: '6px 10px',
          cursor: 'pointer',
          width: 'fit-content',
        }}
      >
        再次顯示精靈
      </button>
      {message && (
        <div style={{ fontSize: 11, color: 'var(--theme-elevation-700, #3f3f46)' }}>{message}</div>
      )}
    </div>
  )
}

export default ProductWizardLauncher
