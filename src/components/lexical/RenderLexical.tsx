/**
 * RenderLexical — server-compatible Lexical richText renderer
 * ───────────────────────────────────────────────────────────
 * 不含 'use client'，server 與 client component 皆可 import。
 * 支援 node type：text / paragraph / heading / list / listitem / link / linebreak /
 *                 upload / quote / horizontalrule / block (productButton)
 * 注意：此元件未來若加 hooks / event handlers，需改成 'use client'。
 *
 * Upload node 會自動判斷 mimeType 決定 <video> 或 next/image <Image>，
 * 並用 normalizeMediaUrl 處理 Payload CDN URL。
 *
 * Block (productButton) 期望 relationship 以 depth>=1 populated；若未 populated
 * 或缺 slug 則靜默略過，不會在前台顯示空按鈕。
 */

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
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
  fields?: Record<string, unknown>
}

interface RenderOptions {
  blogSlug?: string
}

export function RenderLexical({
  content,
  blogSlug,
}: {
  content: unknown
  blogSlug?: string
}) {
  if (!content || typeof content !== 'object') return null
  const root = (content as { root?: LexicalNode }).root
  if (!root?.children) return null

  return (
    <>
      {root.children.map((node, i) => (
        <LexicalNodeRenderer key={i} node={node} options={{ blogSlug }} />
      ))}
    </>
  )
}

function LexicalNodeRenderer({
  node,
  options,
}: {
  node: LexicalNode
  options: RenderOptions
}) {
  if (node.type === 'text') {
    let el: React.ReactNode = node.text || ''
    const fmt = typeof node.format === 'number' ? node.format : 0
    if (fmt & 1) el = <strong>{el}</strong>
    if (fmt & 2) el = <em>{el}</em>
    if (fmt & 8) el = <u>{el}</u>
    if (fmt & 4) el = <s>{el}</s>
    return <>{el}</>
  }

  const children = node.children?.map((child, i) => (
    <LexicalNodeRenderer key={i} node={child} options={options} />
  ))

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
    case 'link': {
      const url = node.url || '#'
      const isExternal = /^https?:\/\//.test(url)
      return (
        <a
          href={url}
          className="text-[#C19A5B] underline"
          {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {children}
        </a>
      )
    }
    case 'linebreak':
      return <br />
    case 'quote':
      return (
        <blockquote className="border-l-4 border-gold-500 bg-cream-50 px-5 py-3 my-4 text-sm italic text-foreground/80">
          {children}
        </blockquote>
      )
    case 'horizontalrule':
      return <hr className="my-6 border-cream-200" />
    case 'block':
      return <BlockNodeRenderer node={node} options={options} />
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

function BlockNodeRenderer({
  node,
  options,
}: {
  node: LexicalNode
  options: RenderOptions
}) {
  const fields = node.fields
  if (!fields || typeof fields !== 'object') return null
  const blockType = (fields as { blockType?: string }).blockType
  if (blockType === 'productButton') {
    return <ProductButtonBlock fields={fields} blogSlug={options.blogSlug} />
  }
  return null
}

function ProductButtonBlock({
  fields,
  blogSlug,
}: {
  fields: Record<string, unknown>
  blogSlug?: string
}) {
  const product = fields.product as
    | { slug?: string; name?: string }
    | number
    | string
    | null
    | undefined
  if (!product || typeof product !== 'object') return null
  const slug = product.slug
  if (!slug) return null
  const label = ((fields.label as string) || '立即購買').trim() || '立即購買'
  const variant = (fields.variant as 'primary' | 'secondary') || 'primary'
  const fullWidth = Boolean(fields.fullWidth)

  const base =
    'inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full text-sm tracking-wide transition-colors'
  const palette =
    variant === 'primary'
      ? 'bg-gold-500 text-white hover:bg-gold-600'
      : 'bg-cream-100 text-foreground border border-cream-300 hover:bg-cream-200'
  const width = fullWidth ? 'w-full' : ''

  const ref = blogSlug ? `blog-${blogSlug}` : 'blog'
  const href = `/products/${encodeURIComponent(slug)}?ref=${encodeURIComponent(ref)}`

  return (
    <div className={`my-6 not-prose ${fullWidth ? '' : 'text-center'}`}>
      <Link href={href} className={`${base} ${palette} ${width}`} prefetch={false}>
        {label}
        <ArrowRight size={16} />
      </Link>
    </div>
  )
}
