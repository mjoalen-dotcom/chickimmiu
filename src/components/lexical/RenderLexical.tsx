/**
 * RenderLexical — server-compatible Lexical richText renderer
 * ───────────────────────────────────────────────────────────
 * 不含 'use client'，server 與 client component 皆可 import。
 * 支援 node type：text / paragraph / heading / list / listitem / link / linebreak / upload
 * 注意：此元件未來若加 hooks / event handlers，需改成 'use client'。
 *
 * Upload node 會自動判斷 mimeType 決定 <video> 或 next/image <Image>，
 * 並用 normalizeMediaUrl 處理 Payload CDN URL。
 */

import Image from 'next/image'
import { normalizeMediaUrl } from '@/lib/media-url'

interface LexicalNode {
  type: string
  text?: string
  children?: LexicalNode[]
  format?: number | string
  tag?: string
  direction?: string
  url?: string
  listType?: string
  value?: unknown
}

export function RenderLexical({ content }: { content: unknown }) {
  if (!content || typeof content !== 'object') return null
  const root = (content as { root?: LexicalNode }).root
  if (!root?.children) return null

  return <>{root.children.map((node, i) => <LexicalNodeRenderer key={i} node={node} />)}</>
}

function LexicalNodeRenderer({ node }: { node: LexicalNode }) {
  if (node.type === 'text') {
    let el: React.ReactNode = node.text || ''
    const fmt = typeof node.format === 'number' ? node.format : 0
    if (fmt & 1) el = <strong>{el}</strong>
    if (fmt & 2) el = <em>{el}</em>
    if (fmt & 8) el = <u>{el}</u>
    if (fmt & 4) el = <s>{el}</s>
    return <>{el}</>
  }

  const children = node.children?.map((child, i) => <LexicalNodeRenderer key={i} node={child} />)

  switch (node.type) {
    case 'paragraph':
      return <p className="mb-3 leading-relaxed">{children}</p>
    case 'heading': {
      const Tag = (node.tag as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6') || 'h3'
      return <Tag className="font-semibold mb-2 mt-4">{children}</Tag>
    }
    case 'list':
      return node.listType === 'number' ? (
        <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>
      ) : (
        <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>
      )
    case 'listitem':
      return <li>{children}</li>
    case 'link':
      return (
        <a href={node.url || '#'} className="text-[#C19A5B] underline" target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      )
    case 'linebreak':
      return <br />
    case 'upload': {
      const value = node.value as
        | {
            id?: string | number
            url?: string
            mimeType?: string
            filename?: string
            alt?: string
            width?: number
            height?: number
          }
        | undefined
      if (!value) return null
      const src = normalizeMediaUrl(value.url)
      if (!src) return null
      const isVideo = Boolean(value.mimeType?.startsWith('video/'))
      if (isVideo) {
        return (
          <div className="my-4 rounded-lg overflow-hidden">
            <video
              src={src}
              controls
              playsInline
              className="w-full h-auto"
              preload="metadata"
            />
          </div>
        )
      }
      const w = value.width || 1200
      const h = value.height || 800
      return (
        <div className="my-4 rounded-lg overflow-hidden">
          <Image
            src={src}
            alt={value.alt || value.filename || ''}
            width={w}
            height={h}
            className="w-full h-auto"
            sizes="(max-width: 768px) 100vw, 768px"
          />
        </div>
      )
    }
    default:
      return <>{children}</>
  }
}
