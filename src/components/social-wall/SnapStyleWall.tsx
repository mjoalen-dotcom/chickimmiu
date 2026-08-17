'use client'

import React, { useRef } from 'react'

import type { KimWallFeed } from '@/lib/social-wall/kim-wall-feed'

type SnapStyleWallProps = {
  feed: KimWallFeed
  theme?: 'light' | 'sand' | 'dark'
}

export function SnapStyleWall({ feed, theme = 'light' }: SnapStyleWallProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const hasItems = feed.items.length > 0

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
              <a
                className="sw-snap-wall__item"
                data-media-type={item.mediaType}
                href={item.permalink}
                key={item.id}
                rel="noopener noreferrer"
                role="listitem"
                target="_blank"
                title={item.caption || '查看貼文'}
              >
                {/* The image URLs are supplied by the owned server-side feed resolver. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={item.caption ? item.caption.slice(0, 90) : 'Kim Lafayette 貼文'}
                  decoding="async"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  src={item.thumbnailUrl || item.mediaUrl}
                />
                {item.mediaType === 'VIDEO' ? (
                  <span aria-label="影片" className="sw-snap-wall__media-badge" role="img">▶</span>
                ) : null}
                {item.mediaType === 'CAROUSEL_ALBUM' ? (
                  <span aria-label="多張相片" className="sw-snap-wall__media-badge" role="img">▦</span>
                ) : null}
              </a>
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
