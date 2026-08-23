import type { Metadata } from 'next'
import { headers } from 'next/headers'

import { DemoWall, defaultDemoWallSettings } from '@/components/social-wall/DemoWall'
import { EmbedResizeReporter } from '@/components/social-wall/EmbedResizeReporter'
import { SnapStyleWall } from '@/components/social-wall/SnapStyleWall'
import { normalizeWidgetHost } from '@/lib/social-wall/domain-policy'
import { verifyEmbedToken, SOCIAL_WALL_DEVELOPMENT_SECRET } from '@/lib/social-wall/embed-token'
import { loadKimWallFeed } from '@/lib/social-wall/kim-wall-feed'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '社群牆嵌入元件',
  robots: { index: false, follow: false },
}

type EmbedPageProps = {
  params: Promise<{ publicId: string }>
  searchParams: Promise<{ token?: string; host?: string; preview?: string; theme?: 'light' | 'sand' | 'dark' }>
}

export default async function SocialWallEmbedPage({ params, searchParams }: EmbedPageProps) {
  const { publicId } = await params
  const query = await searchParams
  const requestHeaders = await headers()
  const isLocalPreview = process.env.NODE_ENV !== 'production' && query.preview === '1'
  const signingSecret = process.env.SOCIAL_WALL_EMBED_SECRET || (process.env.NODE_ENV !== 'production' ? SOCIAL_WALL_DEVELOPMENT_SECRET : '')
  let authorized = isLocalPreview

  if (!authorized && query.token && query.host && signingSecret) {
    try {
      verifyEmbedToken({
        token: query.token,
        secret: signingSecret,
        expectedWidgetId: publicId,
        expectedHost: query.host,
        now: Math.floor(Date.now() / 1000),
      })
      const referrer = requestHeaders.get('referer')
      if (process.env.NODE_ENV === 'production' && (!referrer || normalizeWidgetHost(referrer) !== normalizeWidgetHost(query.host))) {
        throw new Error('embed_referrer_mismatch')
      }
      authorized = true
    } catch {
      authorized = false
    }
  }

  if (!authorized) {
    return <main className="sw-embed-error"><strong>此社群牆無法載入</strong><span>請確認網域授權或重新取得嵌入碼。</span></main>
  }

  const theme = query.theme ?? 'light'
  const wall =
    publicId === 'kim-lafayette-demo' ? (
      <SnapStyleWall feed={await loadKimWallFeed()} theme={theme} widgetId={publicId} />
    ) : (
      <DemoWall settings={{ ...defaultDemoWallSettings, theme }} />
    )

  return (
    <main className="sw-embed-root">
      <EmbedResizeReporter widgetId={publicId} />
      {wall}
    </main>
  )
}
