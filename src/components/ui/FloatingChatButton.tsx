'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, X } from 'lucide-react'

type Props = {
  lineOaUrl?: string | null
  metaPageId?: string | null
  enableLine?: boolean
  enableMessenger?: boolean
}

/**
 * 右下角浮動客服按鈕
 * props 由 (frontend)/layout.tsx 從 GlobalSettings 取得並傳入
 */
export function FloatingChatButton({
  lineOaUrl,
  metaPageId,
  enableLine = true,
  enableMessenger = true,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)

  if (!enableLine && !enableMessenger) return null

  return (
    <div data-component="floating-chat" className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.9 }}
            className="bg-white rounded-2xl shadow-2xl border border-cream-200 p-5 w-64"
          >
            <p className="text-sm font-medium text-foreground mb-1">需要幫助嗎？</p>
            <p className="text-xs text-muted-foreground mb-4">
              歡迎透過以下方式聯繫我們的客服團隊
            </p>
            <div className="space-y-2">
              {enableLine && (
                <a
                  href={lineOaUrl || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#06C755] text-white text-sm hover:opacity-90 transition-opacity"
                >
                  <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
                  LINE 客服
                </a>
              )}
              {enableMessenger && metaPageId && (
                <a
                  href={`https://m.me/${metaPageId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#0084FF] text-white text-sm hover:opacity-90 transition-opacity"
                >
                  <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 4.975 0 11.111c0 3.497 1.745 6.616 4.472 8.652V24l4.086-2.242c1.09.301 2.246.465 3.442.465 6.627 0 12-4.975 12-11.111C24 4.975 18.627 0 12 0zm1.193 14.963l-3.056-3.259-5.963 3.259L10.732 8.2l3.131 3.259L19.752 8.2l-6.559 6.763z"/></svg>
                  Messenger 客服
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full bg-gold-500 text-white shadow-lg hover:bg-gold-600 transition-colors flex items-center justify-center"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="聯絡客服"
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </motion.button>
    </div>
  )
}
