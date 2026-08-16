const demoPosts = [
  { image: '/images/about-legacy/20.png', caption: '六月的簡約穿搭靈感，日常也能俐落有型。', likes: '2,184' },
  { image: '/images/about-legacy/36.png', caption: '把生活裡喜歡的顏色，穿成自己的節奏。', likes: '1,629' },
  { image: '/images/about-legacy/40.png', caption: '會員活動與春日選品，一次收藏。', likes: '3,071' },
  { image: '/images/about-legacy/24.png', caption: '一週衣櫥提案：柔和、自在，也保留態度。', likes: '928' },
  { image: '/images/about-legacy/32.png', caption: '新的季節，從一件真正喜歡的衣服開始。', likes: '1,347' },
  { image: '/images/about-legacy/16.png', caption: '今天的穿搭，留給今天的好心情。', likes: '2,406' },
]

export type DemoWallSettings = {
  layout: 'grid' | 'carousel'
  columns: number
  gap: number
  radius: number
  showCaption: boolean
  showStats: boolean
  theme: 'light' | 'dark' | 'sand'
}

export const defaultDemoWallSettings: DemoWallSettings = {
  layout: 'grid',
  columns: 3,
  gap: 12,
  radius: 16,
  showCaption: true,
  showStats: true,
  theme: 'light',
}

export function DemoWall({ settings = defaultDemoWallSettings }: { settings?: DemoWallSettings }) {
  return (
    <div className={`sw-widget sw-widget--${settings.theme}`}>
      <div className="sw-widget__profile">
        <div className="sw-widget__avatar">KL</div>
        <div>
          <strong>kim_lafayette</strong>
          <span>時尚・生活・旅行</span>
        </div>
        <button type="button">追蹤</button>
      </div>
      <div
        className={`sw-widget__grid sw-widget__grid--${settings.layout}`}
        style={{
          '--sw-columns': settings.columns,
          '--sw-gap': `${settings.gap}px`,
          '--sw-radius': `${settings.radius}px`,
        } as React.CSSProperties}
      >
        {demoPosts.map((post, index) => (
          <article className="sw-post" key={post.image}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.image} alt={`Instagram 示範貼文 ${index + 1}`} />
            {(settings.showCaption || settings.showStats) && (
              <div className="sw-post__overlay">
                {settings.showCaption && <p>{post.caption}</p>}
                {settings.showStats && <span>♡ {post.likes}</span>}
              </div>
            )}
          </article>
        ))}
      </div>
      <div className="sw-widget__credit">由牆聚 WallGather 提供</div>
    </div>
  )
}
