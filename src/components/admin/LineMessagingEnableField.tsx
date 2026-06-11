'use client'

import React from 'react'
import { useField } from '@payloadcms/ui'

/**
 * LINE Messaging 總開關（CRMSettings.notificationChannels.lineMessagingEnabled）
 * ----------------------------------------------------------------------------
 * 沿用 Shopline 的 Messaging API channel（webhook URL 是單一值）— 打開本開關
 * 並把 webhook 切到本站後，Shopline 端的 LINE 推播/客服立即失效。
 * 所以勾選時跳 confirm 讓管理員確認後果（user 拍板的流程：按下開啟 → 提示會
 * 造成過去舊的無法使用 → 同意後直接取代）。
 *
 * MUST be 'use client' — Payload v3 admin.components.Field inside a group
 * silently empties the form's render-fields if the component is async/RSC.
 */

const CONFIRM_TEXT =
  '⚠️ 確定要啟用本站的 LINE 推播嗎？\n\n' +
  '本站沿用 Shopline 的 LINE Messaging API channel。啟用後：\n' +
  '• 本站開始主動發送 LINE 訊息（訂單通知 / 行銷推播 / 客服自動回覆）\n' +
  '• 將 LINE Developers Console 的 webhook 切到本站後，Shopline 的 LINE 功能（推播、客服對話）會立即失效且無法並行\n\n' +
  '按「確定」代表你同意以本站取代 Shopline 的 LINE 功能。'

interface Props {
  path: string
  field?: { label?: string | Record<string, string>; admin?: { description?: string } }
}

const LineMessagingEnableField: React.FC<Props> = ({ path, field }) => {
  const { value, setValue } = useField<boolean>({ path })
  const checked = value === true

  const label =
    typeof field?.label === 'string'
      ? field.label
      : field?.label && typeof field.label === 'object'
        ? field.label['zh-TW'] || field.label['en'] || '啟用 LINE 推播（本站接管）'
        : '啟用 LINE 推播（本站接管）'

  function handleToggle(next: boolean) {
    if (next && !window.confirm(CONFIRM_TEXT)) return // 取消 = 不開
    setValue(next)
  }

  return (
    <div className="field-type" style={{ marginBottom: 16 }}>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => handleToggle(e.target.checked)}
          style={{ marginTop: 2 }}
        />
        <span>
          <span style={{ fontSize: 13, fontWeight: 500, display: 'block' }}>{label}</span>
          <span style={{ fontSize: 11, color: 'var(--theme-elevation-500, #71717a)', display: 'block', marginTop: 2 }}>
            {field?.admin?.description ||
              '預設關閉。開啟 = 本站開始發送 LINE 訊息；webhook 切到本站後 Shopline 的 LINE 功能會失效（開啟時會再次確認）。'}
          </span>
          {checked && (
            <span style={{ fontSize: 11, color: 'var(--theme-warning-600, #b45309)', display: 'block', marginTop: 4 }}>
              ⚠️ 已啟用 — 本站接管 LINE 推播中（記得把 LINE Developers Console 的 webhook 指到
              /api/webhooks/line，Shopline 端隨即失效）
            </span>
          )}
        </span>
      </label>
    </div>
  )
}

export default LineMessagingEnableField
