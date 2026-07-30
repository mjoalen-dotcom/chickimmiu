import { CalendarDays, Eye, MousePointer2, Timer, Users } from 'lucide-react'
import React from 'react'

import type { KimBlogAnalytics } from '@/lib/blog/kimBlogAnalytics'

const BORDER = 'var(--theme-elevation-200, #dedede)'
const MUTED = 'var(--theme-elevation-600, #666)'

function number(value: number) {
  return value.toLocaleString('zh-TW')
}

function BarRows({
  rows,
}: {
  rows: { label: string; pageviews: number }[]
}) {
  const max = Math.max(1, ...rows.map((row) => row.pageviews))

  return (
    <div style={{ display: 'grid', gap: 11 }}>
      {rows.map((row) => (
        <div
          key={row.label}
          style={{
            display: 'grid',
            gridTemplateColumns: '72px minmax(100px, 1fr) 48px',
            alignItems: 'center',
            gap: 9,
            fontSize: 12,
          }}
        >
          <span style={{ color: MUTED }}>{row.label}</span>
          <span
            style={{
              display: 'block',
              height: 7,
              overflow: 'hidden',
              background: 'var(--theme-elevation-100, #eee)',
            }}
          >
            <span
              style={{
                display: 'block',
                width: `${Math.max(row.pageviews > 0 ? 3 : 0, (row.pageviews / max) * 100)}%`,
                height: '100%',
                background: '#a25e5e',
              }}
            />
          </span>
          <strong style={{ textAlign: 'right' }}>{number(row.pageviews)}</strong>
        </div>
      ))}
    </div>
  )
}

export default function BlogAnalyticsPanel({
  analytics,
}: {
  analytics: KimBlogAnalytics
}) {
  const maxDaily = Math.max(1, ...analytics.daily.map((item) => item.pageviews))
  const metrics = [
    {
      label: '拜訪人數',
      helper: 'Visitors',
      value: analytics.totals.visitors,
      icon: Users,
    },
    {
      label: '人氣',
      helper: 'Pageviews',
      value: analytics.totals.pageviews,
      icon: Eye,
    },
    {
      label: '互動工作階段',
      helper: 'Engaged sessions',
      value: analytics.totals.engagedSessions,
      icon: MousePointer2,
    },
    {
      label: '平均閱讀時間',
      helper: 'Average dwell',
      value: analytics.totals.averageDwellSeconds,
      suffix: ' 秒',
      icon: Timer,
    },
  ]

  return (
    <section aria-labelledby="kim-blog-analytics-title" style={{ marginBottom: 36 }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div>
          <p
            style={{
              margin: '0 0 4px',
              color: '#a25e5e',
              fontSize: 11,
              fontWeight: 750,
              textTransform: 'uppercase',
            }}
          >
            Analytics
          </p>
          <h2 id="kim-blog-analytics-title" style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
            流量總覽
          </h2>
        </div>
        <span
          style={{
            display: 'inline-flex',
            minHeight: 34,
            alignItems: 'center',
            gap: 7,
            padding: '7px 10px',
            border: `1px solid ${BORDER}`,
            borderRadius: 5,
            color: MUTED,
            fontSize: 12,
          }}
        >
          <CalendarDays aria-hidden size={15} />
          過去 {analytics.days} 天
        </span>
      </div>

      {analytics.totals.pageviews === 0 ? (
        <p
          style={{
            margin: '0 0 14px',
            padding: '11px 13px',
            borderLeft: '3px solid #a25e5e',
            background: 'var(--theme-elevation-50, #fafafa)',
            color: MUTED,
            fontSize: 12,
            lineHeight: 1.7,
          }}
        >
          金老佛爺專屬匿名流量追蹤已建立；正式前台更新後開始累積，不會混入購物網站事件。
        </p>
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          borderTop: `1px solid ${BORDER}`,
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        {metrics.map((metric, index) => {
          const Icon = metric.icon
          return (
            <div
              key={metric.label}
              style={{
                minHeight: 102,
                padding: '17px 18px',
                borderLeft: index === 0 ? 'none' : `1px solid ${BORDER}`,
              }}
            >
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  color: MUTED,
                  fontSize: 12,
                }}
              >
                <Icon aria-hidden size={15} strokeWidth={1.7} />
                {metric.label}
              </span>
              <strong style={{ display: 'block', marginTop: 8, fontSize: 26, lineHeight: 1 }}>
                {number(metric.value)}
                {metric.suffix || ''}
              </strong>
              <span style={{ display: 'block', marginTop: 6, color: MUTED, fontSize: 10 }}>
                {metric.helper}
              </span>
            </div>
          )
        })}
      </div>

      <section
        aria-labelledby="traffic-chart-title"
        style={{ padding: '24px 0 27px', borderBottom: `1px solid ${BORDER}` }}
      >
        <h3 id="traffic-chart-title" style={{ margin: '0 0 18px', fontSize: 15, fontWeight: 700 }}>
          每日流量
        </h3>
        <div
          role="img"
          aria-label={`過去 ${analytics.days} 天每日瀏覽量長條圖`}
          style={{
            display: 'grid',
            height: 190,
            gridTemplateColumns: `repeat(${analytics.daily.length}, minmax(5px, 1fr))`,
            alignItems: 'end',
            gap: 3,
            borderBottom: `1px solid ${BORDER}`,
          }}
        >
          {analytics.daily.map((item) => (
            <span
              key={item.date}
              title={`${item.date}：${item.pageviews} 次瀏覽、${item.visitors} 位訪客`}
              style={{
                display: 'block',
                minHeight: item.pageviews > 0 ? 3 : 1,
                height: `${Math.max(item.pageviews > 0 ? 3 : 1, (item.pageviews / maxDaily) * 100)}%`,
                background: item.pageviews > 0 ? '#a25e5e' : 'var(--theme-elevation-100, #eee)',
              }}
            />
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 7,
            color: MUTED,
            fontSize: 10,
          }}
        >
          <span>{analytics.daily[0]?.label}</span>
          <span>{analytics.daily[Math.floor(analytics.daily.length / 2)]?.label}</span>
          <span>{analytics.daily.at(-1)?.label}</span>
        </div>
      </section>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 32,
          padding: '26px 0',
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <section aria-labelledby="weekday-title">
          <h3 id="weekday-title" style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>
            周間流量分佈
          </h3>
          <BarRows rows={analytics.weekdays} />
        </section>
        <section aria-labelledby="device-title">
          <h3 id="device-title" style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>
            裝置分佈
          </h3>
          <BarRows rows={analytics.devices} />
        </section>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 32,
          paddingTop: 26,
        }}
      >
        <section aria-labelledby="source-title">
          <h3 id="source-title" style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>
            來源網站分佈
          </h3>
          {analytics.sources.length > 0 ? (
            <BarRows rows={analytics.sources} />
          ) : (
            <p style={{ color: MUTED, fontSize: 12 }}>尚無來源資料</p>
          )}
        </section>

        <section aria-labelledby="popular-title">
          <h3 id="popular-title" style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700 }}>
            熱門文章
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <th style={{ padding: '8px 6px', textAlign: 'left', color: MUTED }}>文章</th>
                  <th style={{ padding: '8px 6px', textAlign: 'right', color: MUTED }}>人氣</th>
                  <th style={{ padding: '8px 6px', textAlign: 'right', color: MUTED }}>訪客</th>
                </tr>
              </thead>
              <tbody>
                {analytics.popularPages.length > 0 ? (
                  analytics.popularPages.map((page) => (
                    <tr key={page.path} style={{ borderBottom: `1px solid ${BORDER}` }}>
                      <td style={{ maxWidth: 300, padding: '10px 6px' }}>
                        <a
                          href={`https://blog.kimlafayette.com${page.path}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={page.title}
                          style={{
                            display: 'block',
                            overflow: 'hidden',
                            color: 'inherit',
                            fontWeight: 600,
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {page.title}
                        </a>
                      </td>
                      <td style={{ padding: '10px 6px', textAlign: 'right' }}>
                        {number(page.pageviews)}
                      </td>
                      <td style={{ padding: '10px 6px', textAlign: 'right' }}>
                        {number(page.visitors)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} style={{ padding: '14px 6px', color: MUTED }}>
                      尚無文章流量
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  )
}
