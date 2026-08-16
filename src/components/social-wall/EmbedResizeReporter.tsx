'use client'

import { useEffect } from 'react'

export function EmbedResizeReporter({ widgetId }: { widgetId: string }) {
  useEffect(() => {
    const report = () => {
      const height = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)
      window.parent.postMessage({ type: 'wallgather:resize', widget: widgetId, height }, '*')
    }
    report()
    const observer = new ResizeObserver(report)
    observer.observe(document.documentElement)
    window.addEventListener('load', report)
    return () => {
      observer.disconnect()
      window.removeEventListener('load', report)
    }
  }, [widgetId])

  return null
}
