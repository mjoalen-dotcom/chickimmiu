import Link from 'next/link'

type SocialWallNavProps = {
  compact?: boolean
}

export function SocialWallNav({ compact = false }: SocialWallNavProps) {
  return (
    <header className={`sw-nav ${compact ? 'sw-nav--compact' : ''}`}>
      <Link className="sw-brand" href="/social-wall" aria-label="牆聚首頁">
        <span className="sw-brand__mark" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
        <span>
          <strong>牆聚</strong>
          <small>WallGather</small>
        </span>
      </Link>

      <nav className="sw-nav__links" aria-label="主要導覽">
        <Link href="/social-wall#features">功能</Link>
        <Link href="/social-wall#pricing">方案</Link>
        <Link href="/social-wall#faq">常見問題</Link>
      </nav>

      <div className="sw-nav__actions">
        <Link className="sw-link-button" href="/login?redirect=/social-wall/dashboard">
          登入
        </Link>
        <Link className="sw-button sw-button--small" href="/social-wall/studio">
          免費試做
        </Link>
      </div>
    </header>
  )
}
