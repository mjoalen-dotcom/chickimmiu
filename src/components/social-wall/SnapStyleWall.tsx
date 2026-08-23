'use client'

import { Check, Copy, ExternalLink, Facebook, Share2 } from 'lucide-react'
import React, { useRef, useState } from 'react'

import type { KimWallFeed } from '@/lib/social-wall/kim-wall-feed'

type SnapStyleWallProps = {
  feed: KimWallFeed
  theme?: 'light' | 'sand' | 'dark'
  widgetId?: string
}

type ShareNetwork = 'facebook' | 'line' | 'x' | 'copy' | 'native'

function shareUrl(network: Exclude<ShareNetwork, 'copy' | 'native'>, permalink: string, caption: string) {
  const url = encodeURIComponent(permalink)
  const text = encodeURIComponent(caption || '分享這則貼文')
  if (network === 'facebook') return `https://www.facebook.com/sharer/sharer.php?u=${url}`
  if (network === 'line') return `https://social-plugins.line.me/lineit/share?url=${url}`
  return `https://twitter.com/intent/tweet?url=${url}&text=${text}`
}

export function SnapStyleWall({ feed, theme = 'light', widgetId = 'kim-lafayette-demo' }: SnapStyleWallProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const hasItems = feed.items.length > 0

  const reportInteraction = (action: ShareNetwork | 'open', itemId: string) => {
    window.parent?.postMessage({ type: 'wallgather:interaction', widget: widgetId, action, itemId }, '*')
  }

  const share = async (network: ShareNetwork, item: KimWallFeed['items'][number]) => {
    reportInteraction(network, item.id)
    if (network === 'native' && navigator.share) {
      try {
        await navigator.share({ title: item.caption || 'Kim Lafayette 貼文', text: item.caption, url: item.permalink })
        return
      } catch {
        return
      }
    }
    if (network === 'copy' || network === 'native') {
      try {
        await navigator.clipboard.writeText(item.permalink)
        setCopiedId(item.id)
        window.setTimeout(() => setCopiedId((current) => current === item.id ? null : current), 1800)
      } catch {
        window.prompt('複製這個分享連結', item.permalink)
      }
      return
    }
    window.open(shareUrl(network, item.permalink, item.caption || ''), '_blank', 'noopener,noreferrer,width=720,height=620')
  }

  const move = (direction: -1 | 1) => {
    const viewport = viewportRef.current
    if (!viewport) return
    viewport.scrollBy({
      behavior: 'smooth',
      left: direction * Math.max(180, Math.round(viewport.clientWidth * 0.82)),
    })
  }

  return (
    <section
      className={`sw-snap-wall sw-snap-wall--${theme}`}
      data-wall-layout="snap-compact"
      data-wall-source={feed.source}
      data-wall-empty={hasItems ? undefined : 'true'}
      aria-label="Kim Lafayette 社群貼文牆"
    >
      {hasItems ? (
        <div className="sw-snap-wall__viewport" ref={viewportRef}>
          <div className="sw-snap-wall__track" role="list">
            {feed.items.map((item) => (
              <article
                className="sw-snap-wall__item"
                data-media-type={item.mediaType}
                key={item.id}
                role="listitem"
              >
                <a className="sw-snap-wall__post-link" href={item.permalink} onClick={() => reportInteraction('open', item.id)} rel="noopener noreferrer" target="_blank" title={item.caption || '查看貼文'}>
                  {/* The image URLs are supplied by the owned server-side feed resolver. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt={item.caption ? item.caption.slice(0, 90) : 'Kim Lafayette 貼文'} decoding="async" loading="lazy" referrerPolicy="no-referrer" src={item.thumbnailUrl || item.mediaUrl} />
                </a>
                {item.mediaType === 'VIDEO' ? (
                  <span aria-label="影片" className="sw-snap-wall__media-badge" role="img">▶</span>
                ) : null}
                {item.mediaType === 'CAROUSEL_ALBUM' ? (
                  <span aria-label="多張相片" className="sw-snap-wall__media-badge" role="img">▦</span>
                ) : null}
                <div className="sw-snap-wall__share" aria-label="分享貼文">
                  <button aria-label="使用裝置分享" onClick={() => void share('native', item)} title="分享" type="button"><Share2 /></button>
                  <button aria-label="分享到 Facebook" onClick={() => void share('facebook', item)} title="Facebook" type="button"><Facebook /></button>
                  <button aria-label="分享到 LINE" className="sw-snap-wall__share-text" onClick={() => void share('line', item)} title="LINE" type="button">LINE</button>
                  <button aria-label="分享到 X" className="sw-snap-wall__share-text" onClick={() => void share('x', item)} title="X" type="button">X</button>
                  <button aria-label="複製貼文連結" onClick={() => void share('copy', item)} title="複製連結" type="button">{copiedId === item.id ? <Check /> : <Copy />}</button>
                  <a aria-label="開啟原始貼文" href={item.permalink} onClick={() => reportInteraction('open', item.id)} rel="noopener noreferrer" target="_blank" title="開啟貼文"><ExternalLink /></a>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <p className="sw-snap-wall__empty">{feed.sourceLabel}</p>
      )}

      <footer className="sw-snap-wall__footer">
        <div className="sw-snap-wall__source">
          <a href={feed.profileUrl} rel="noopener noreferrer" target="_blank">
            @{feed.handle}
          </a>
          <span title={feed.sourceLabel}>{feed.sourceLabel}</span>
        </div>
        <div className="sw-snap-wall__controls" aria-label="貼文切換">
          <button aria-label="上一組貼文" disabled={!hasItems} onClick={() => move(-1)} type="button">←</button>
          <button aria-label="下一組貼文" disabled={!hasItems} onClick={() => move(1)} type="button">→</button>
        </div>
        <small>WallGather</small>
      </footer>
    </section>
  )
}
