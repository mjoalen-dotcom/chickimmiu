'use client'

import { useEffect, useRef } from 'react'

export function EmbedDemoMount() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const script = document.createElement('script')
    script.async = true
    script.src = '/embed.js'
    script.dataset.widget = 'kim-lafayette-demo'
    mount.appendChild(script)

    return () => {
      mount.replaceChildren()
    }
  }, [])

  return <div className="sw-embed-demo__mount" ref={mountRef} />
}
