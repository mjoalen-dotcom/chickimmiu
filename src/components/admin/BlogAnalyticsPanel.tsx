import {
  Activity,
  CalendarDays,
  Clock3,
  Eye,
  Globe2,
  MessageCircle,
  MousePointerClick,
  ShieldCheck,
  ShoppingBag,
  ThumbsUp,
  Users,
} from 'lucide-react'
import React from 'react'

import type { KimBlogAnalytics } from '@/lib/blog/kimBlogAnalytics'

const CHART_COLORS = [
  '#dc6b32',
  '#2b7a78',
  '#3e6e9c',
  '#c45f78',
  '#8a6b3f',
  '#6b7280',
]

type BreakdownRow = {
  label: string
  pageviews: number
  visitors?: number
}

function number(value: number) {
  return value.toLocaleString('zh-TW')
}

function duration(value: number) {
  if (value < 60) return `${number(value)} 秒`
  const minutes = Math.floor(value / 60)
  const seconds = value % 60
  return `${minutes} 分 ${seconds} 秒`
}

function generatedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Taipei',
  }).format(date)
}

function LineChart({
  rows,
}: {
  rows: KimBlogAnalytics['daily']
}) {
  const width = 960
  const height = 292
  const left = 48
  const right = 18
  const top = 18
  const bottom = 38
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const max = Math.max(
    1,
    ...rows.flatMap((row) => [row.pageviews, row.visitors]),
  )
  const x = (index: number) =>
    left + (rows.length <= 1 ? 0 : (index / (rows.length - 1)) * plotWidth)
  const y = (value: number) => top + plotHeight - (value / max) * plotHeight
  const path = (key: 'pageviews' | 'visitors') =>
    rows
      .map((row, index) => {
        const command = index === 0 ? 'M' : 'L'
        return `${command}${x(index).toFixed(1)},${y(row[key]).toFixed(1)}`
      })
      .join(' ')
  const pageviewPath = path('pageviews')
  const visitorPath = path('visitors')
  const areaPath = rows.length
    ? `${pageviewPath} L${x(rows.length - 1).toFixed(1)},${(
        top + plotHeight
      ).toFixed(1)} L${left},${(top + plotHeight).toFixed(1)} Z`
    : ''
  const labelIndexes = [...new Set([0, Math.floor(rows.length / 2), rows.length - 1])]

  return (
    <div className="kim-analytics-chart-scroll">
      <svg
        aria-label={`過去 ${rows.length} 天每日訪客與瀏覽量趨勢`}
        className="kim-analytics-line-chart"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        <title>每日訪客與瀏覽量趨勢</title>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const chartY = top + plotHeight - plotHeight * ratio
          return (
            <g key={ratio}>
              <line
                className="kim-analytics-grid-line"
                x1={left}
                x2={width - right}
                y1={chartY}
                y2={chartY}
              />
              <text
                className="kim-analytics-axis-label"
                textAnchor="end"
                x={left - 10}
                y={chartY + 4}
              >
                {number(Math.round(max * ratio))}
              </text>
            </g>
          )
        })}
        {areaPath ? (
          <path d={areaPath} fill="#dc6b32" fillOpacity="0.12" />
        ) : null}
        {pageviewPath ? (
          <path
            className="kim-analytics-series kim-analytics-series--pageviews"
            d={pageviewPath}
          />
        ) : null}
        {visitorPath ? (
          <path
            className="kim-analytics-series kim-analytics-series--visitors"
            d={visitorPath}
          />
        ) : null}
        {rows.map((row, index) => (
          <g key={row.date}>
            <circle
              className="kim-analytics-point kim-analytics-point--pageviews"
              cx={x(index)}
              cy={y(row.pageviews)}
              r="2.7"
            >
              <title>
                {row.date}：{number(row.pageviews)} 次瀏覽
              </title>
            </circle>
            <circle
              className="kim-analytics-point kim-analytics-point--visitors"
              cx={x(index)}
              cy={y(row.visitors)}
              r="2.5"
            >
              <title>
                {row.date}：{number(row.visitors)} 位訪客
              </title>
            </circle>
          </g>
        ))}
        {labelIndexes.map((index) => {
          const row = rows[index]
          if (!row) return null
          return (
            <text
              className="kim-analytics-axis-label"
              key={row.date}
              textAnchor={
                index === 0
                  ? 'start'
                  : index === rows.length - 1
                    ? 'end'
                    : 'middle'
              }
              x={x(index)}
              y={height - 10}
            >
              {row.label}
            </text>
          )
        })}
      </svg>
    </div>
  )
}

function BarRows({
  rows,
  empty = '尚無資料',
}: {
  rows: BreakdownRow[]
  empty?: string
}) {
  const visibleRows = rows.filter((row) => row.pageviews > 0)
  const max = Math.max(1, ...visibleRows.map((row) => row.pageviews))

  if (visibleRows.length === 0) {
    return <p className="kim-analytics-empty">{empty}</p>
  }

  return (
    <div className="kim-analytics-bars">
      {visibleRows.map((row) => (
        <div className="kim-analytics-bar-row" key={row.label}>
          <span className="kim-analytics-bar-label" title={row.label}>
            {row.label}
          </span>
          <span className="kim-analytics-bar-track">
            <span
              className="kim-analytics-bar-fill"
              style={{
                width: `${Math.max(3, (row.pageviews / max) * 100)}%`,
              }}
            />
          </span>
          <strong>{number(row.pageviews)}</strong>
        </div>
      ))}
    </div>
  )
}

function HourlyChart({
  rows,
}: {
  rows: KimBlogAnalytics['hourly']
}) {
  const width = 600
  const height = 180
  const left = 10
  const right = 10
  const top = 14
  const bottom = 28
  const plotHeight = height - top - bottom
  const max = Math.max(1, ...rows.map((row) => row.pageviews))
  const x = (index: number) =>
    left + (index / Math.max(1, rows.length - 1)) * (width - left - right)
  const y = (value: number) => top + plotHeight - (value / max) * plotHeight
  const line = rows
    .map(
      (row, index) =>
        `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(
          row.pageviews,
        ).toFixed(1)}`,
    )
    .join(' ')
  const area = rows.length
    ? `${line} L${x(rows.length - 1)},${top + plotHeight} L${left},${
        top + plotHeight
      } Z`
    : ''

  return (
    <svg
      aria-label="每小時瀏覽量趨勢"
      className="kim-analytics-hourly-chart"
      role="img"
      viewBox={`0 0 ${width} ${height}`}
    >
      <title>每小時瀏覽量趨勢</title>
      <line
        className="kim-analytics-grid-line"
        x1={left}
        x2={width - right}
        y1={top + plotHeight}
        y2={top + plotHeight}
      />
      {area ? <path d={area} fill="#2b7a78" fillOpacity="0.12" /> : null}
      {line ? (
        <path
          className="kim-analytics-series kim-analytics-series--visitors"
          d={line}
        />
      ) : null}
      {rows.map((row, index) =>
        row.pageviews > 0 ? (
          <circle
            className="kim-analytics-point kim-analytics-point--visitors"
            cx={x(index)}
            cy={y(row.pageviews)}
            key={row.hour}
            r="2.7"
          >
            <title>
              {row.label}：{number(row.pageviews)} 次瀏覽
            </title>
          </circle>
        ) : null,
      )}
      {[0, 6, 12, 18, 23].map((hour) => (
        <text
          className="kim-analytics-axis-label"
          key={hour}
          textAnchor={hour === 0 ? 'start' : hour === 23 ? 'end' : 'middle'}
          x={x(hour)}
          y={height - 7}
        >
          {String(hour).padStart(2, '0')}:00
        </text>
      ))}
    </svg>
  )
}

function DonutBreakdown({
  rows,
  title,
}: {
  rows: BreakdownRow[]
  title: string
}) {
  const visibleRows = rows.filter((row) => row.pageviews > 0).slice(0, 6)
  const total = visibleRows.reduce((sum, row) => sum + row.pageviews, 0)
  let offset = 0
  const segments = visibleRows.map((row, index) => {
    const start = offset
    const end = offset + (row.pageviews / Math.max(1, total)) * 360
    offset = end
    return `${CHART_COLORS[index % CHART_COLORS.length]} ${start}deg ${end}deg`
  })

  return (
    <section className="kim-analytics-card" aria-label={title}>
      <h3>{title}</h3>
      {total > 0 ? (
        <div className="kim-analytics-donut-layout">
          <div
            aria-label={`${title}，共 ${number(total)} 次瀏覽`}
            className="kim-analytics-donut"
            role="img"
            style={{ background: `conic-gradient(${segments.join(', ')})` }}
          >
            <span>
              <strong>{number(total)}</strong>
              <small>瀏覽</small>
            </span>
          </div>
          <ol className="kim-analytics-legend">
            {visibleRows.map((row, index) => (
              <li key={row.label}>
                <i
                  aria-hidden
                  style={{
                    backgroundColor:
                      CHART_COLORS[index % CHART_COLORS.length],
                  }}
                />
                <span title={row.label}>{row.label}</span>
                <strong>
                  {Math.round((row.pageviews / total) * 100)}%
                </strong>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <p className="kim-analytics-empty">尚無資料</p>
      )}
    </section>
  )
}

function TrafficHeatmap({
  rows,
}: {
  rows: KimBlogAnalytics['heatmap']
}) {
  const order = [
    { dayIndex: 1, label: '週一' },
    { dayIndex: 2, label: '週二' },
    { dayIndex: 3, label: '週三' },
    { dayIndex: 4, label: '週四' },
    { dayIndex: 5, label: '週五' },
    { dayIndex: 6, label: '週六' },
    { dayIndex: 0, label: '週日' },
  ]
  const values = new Map(
    rows.map((row) => [`${row.dayIndex}:${row.hour}`, row.pageviews]),
  )
  const max = Math.max(1, ...rows.map((row) => row.pageviews))

  return (
    <div
      aria-label="星期與小時流量熱度圖"
      className="kim-analytics-heatmap-scroll"
      role="img"
    >
      <div className="kim-analytics-heatmap">
        {order.map((day) => (
          <React.Fragment key={day.dayIndex}>
            <span className="kim-analytics-heatmap-day">{day.label}</span>
            {Array.from({ length: 24 }, (_, hour) => {
              const value = values.get(`${day.dayIndex}:${hour}`) || 0
              const strength = value === 0 ? 0.04 : 0.2 + (value / max) * 0.8
              return (
                <span
                  className="kim-analytics-heatmap-cell"
                  key={hour}
                  style={{
                    backgroundColor: `rgba(220, 107, 50, ${strength.toFixed(
                      2,
                    )})`,
                  }}
                  title={`${day.label} ${String(hour).padStart(
                    2,
                    '0',
                  )}:00：${number(value)} 次瀏覽`}
                />
              )
            })}
          </React.Fragment>
        ))}
        <span />
        {Array.from({ length: 24 }, (_, hour) => (
          <span className="kim-analytics-heatmap-hour" key={hour}>
            {hour % 3 === 0 ? String(hour).padStart(2, '0') : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function BlogAnalyticsPanel({
  analytics,
}: {
  analytics: KimBlogAnalytics
}) {
  const groupBuyClickTotal = analytics.groupBuyClicks.reduce(
    (sum, row) => sum + row.clicks,
    0,
  )
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
      label: '互動',
      helper: 'Engagements',
      value: analytics.totals.interactions,
      icon: MousePointerClick,
    },
    {
      label: '按讚',
      helper: 'Likes',
      value: analytics.totals.likes,
      icon: ThumbsUp,
    },
    {
      label: '留言',
      helper: 'Comments',
      value: analytics.totals.comments,
      icon: MessageCircle,
    },
  ]
  const dataSource =
    analytics.source === 'ga4'
      ? `GA4 · ${analytics.hostName || 'blog.kimlafayette.com'}`
      : '站內匿名流量'
  const errorTitle = analytics.ga4Error
    ? 'GA4 暫時無法讀取，已自動切換為站內匿名流量。'
    : null

  return (
    <section
      aria-labelledby="kim-blog-analytics-title"
      className="kim-analytics"
    >
      <header className="kim-analytics-header">
        <div>
          <p className="kim-analytics-eyebrow">Analytics Overview</p>
          <h2 id="kim-blog-analytics-title">部落格流量儀表板</h2>
        </div>
        <div className="kim-analytics-header-actions">
          <span
            className={`kim-analytics-source ${
              analytics.source === 'ga4'
                ? 'kim-analytics-source--live'
                : 'kim-analytics-source--fallback'
            }`}
            title={
              analytics.source === 'ga4'
                ? `GA4 資源 ${analytics.propertyId || ''}`
                : undefined
            }
          >
            {analytics.source === 'ga4' ? (
              <ShieldCheck aria-hidden size={15} />
            ) : (
              <Activity aria-hidden size={15} />
            )}
            {dataSource}
          </span>
          <nav aria-label="分析日期範圍" className="kim-analytics-range">
            <CalendarDays aria-hidden size={15} />
            {[7, 30, 90].map((days) => (
              <a
                aria-current={analytics.days === days ? 'page' : undefined}
                className={analytics.days === days ? 'is-active' : undefined}
                href={`/admin/blog-studio?days=${days}`}
                key={days}
              >
                {days} 天
              </a>
            ))}
          </nav>
        </div>
      </header>

      {errorTitle ? (
        <p className="kim-analytics-notice kim-analytics-notice--warning">
          {errorTitle}
        </p>
      ) : !analytics.configured ? (
        <p className="kim-analytics-notice">
          GA4 尚未連線，目前顯示金老佛爺部落格的站內匿名流量。
        </p>
      ) : null}

      <div className="kim-analytics-metrics">
        {metrics.map((metric) => {
          const Icon = metric.icon
          return (
            <article key={metric.label}>
              <span className="kim-analytics-metric-label">
                <Icon aria-hidden size={17} strokeWidth={1.8} />
                {metric.label}
              </span>
              <strong>{number(metric.value)}</strong>
              <small>{metric.helper}</small>
            </article>
          )
        })}
      </div>

      <div className="kim-analytics-meta">
        <span>
          <Clock3 aria-hidden size={15} />
          平均閱讀時間
          <strong>{duration(analytics.totals.averageDwellSeconds)}</strong>
        </span>
        <span>
          <Activity aria-hidden size={15} />
          互動工作階段
          <strong>{number(analytics.totals.engagedSessions)}</strong>
        </span>
        <span>
          <ShoppingBag aria-hidden size={15} />
          團購按鈕
          <strong>{number(groupBuyClickTotal)} 次點擊</strong>
        </span>
        <span>
          更新時間
          <strong>{generatedAt(analytics.generatedAt)}</strong>
        </span>
      </div>

      <section className="kim-analytics-card kim-analytics-card--wide">
        <div className="kim-analytics-section-heading">
          <div>
            <p>Daily traffic</p>
            <h3>每日流量趨勢</h3>
          </div>
          <div className="kim-analytics-chart-legend">
            <span>
              <i className="is-pageviews" />
              人氣
            </span>
            <span>
              <i className="is-visitors" />
              訪客
            </span>
          </div>
        </div>
        <LineChart rows={analytics.daily} />
      </section>

      <div className="kim-analytics-two-column">
        <section className="kim-analytics-card">
          <div className="kim-analytics-section-heading">
            <div>
              <p>Weekly</p>
              <h3>周間流量分佈</h3>
            </div>
          </div>
          <BarRows rows={analytics.weekdays} />
        </section>
        <section className="kim-analytics-card">
          <div className="kim-analytics-section-heading">
            <div>
              <p>Hourly</p>
              <h3>時段流量分佈</h3>
            </div>
          </div>
          <HourlyChart rows={analytics.hourly} />
        </section>
      </div>

      <section className="kim-analytics-card kim-analytics-card--wide kim-analytics-card--table">
        <div className="kim-analytics-section-heading">
          <div>
            <p>Group-buy conversion</p>
            <h3>團購按鈕點擊成效</h3>
          </div>
          <ShoppingBag aria-hidden size={18} />
        </div>
        <div className="kim-analytics-table-wrap">
          <table>
            <thead>
              <tr>
                <th>文章</th>
                <th>購買頁面</th>
                <th className="is-number">點擊次數</th>
                <th className="is-number">不重複訪客</th>
              </tr>
            </thead>
            <tbody>
              {analytics.groupBuyClicks.length > 0 ? (
                analytics.groupBuyClicks.map((row) => (
                  <tr key={row.slug}>
                    <td className="kim-analytics-title-cell">
                      <a
                        href={`https://blog.kimlafayette.com/blog/${encodeURIComponent(row.slug)}/`}
                        rel="noopener noreferrer"
                        target="_blank"
                        title={row.title}
                      >
                        {row.title}
                      </a>
                    </td>
                    <td>
                      {row.targetUrl ? (
                        <a
                          href={row.targetUrl}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          開啟購買頁面
                        </a>
                      ) : (
                        '未記錄'
                      )}
                    </td>
                    <td className="is-number">{number(row.clicks)}</td>
                    <td className="is-number">{number(row.visitors)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="kim-analytics-empty-cell" colSpan={4}>
                    此期間尚無團購按鈕點擊
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="kim-analytics-card kim-analytics-card--wide">
        <div className="kim-analytics-section-heading">
          <div>
            <p>Traffic heatmap</p>
            <h3>星期與時段熱度</h3>
          </div>
          <span className="kim-analytics-heatmap-scale">
            低
            <i />
            <i />
            <i />
            <i />
            高
          </span>
        </div>
        <TrafficHeatmap rows={analytics.heatmap} />
      </section>

      <div className="kim-analytics-three-column">
        <DonutBreakdown rows={analytics.devices} title="裝置分佈" />
        <DonutBreakdown
          rows={analytics.operatingSystems}
          title="作業系統分佈"
        />
        <DonutBreakdown rows={analytics.browsers} title="瀏覽器分佈" />
      </div>

      <div className="kim-analytics-two-column">
        <section className="kim-analytics-card">
          <div className="kim-analytics-section-heading">
            <div>
              <p>Acquisition</p>
              <h3>來源網站分佈</h3>
            </div>
          </div>
          <BarRows rows={analytics.sources} empty="尚無來源資料" />
        </section>
        <section className="kim-analytics-card">
          <div className="kim-analytics-section-heading">
            <div>
              <p>Geography</p>
              <h3>國家／地區分佈</h3>
            </div>
            <Globe2 aria-hidden size={18} />
          </div>
          <BarRows rows={analytics.countries} empty="尚無地區資料" />
        </section>
      </div>

      <div className="kim-analytics-two-column">
        <section className="kim-analytics-card kim-analytics-card--table">
          <div className="kim-analytics-section-heading">
            <div>
              <p>Cities</p>
              <h3>熱門城市</h3>
            </div>
          </div>
          <div className="kim-analytics-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>城市</th>
                  <th>國家／地區</th>
                  <th className="is-number">人氣</th>
                  <th className="is-number">訪客</th>
                </tr>
              </thead>
              <tbody>
                {analytics.cities.length > 0 ? (
                  analytics.cities.map((city) => (
                    <tr key={`${city.country}:${city.city}`}>
                      <td>{city.city}</td>
                      <td>{city.country}</td>
                      <td className="is-number">{number(city.pageviews)}</td>
                      <td className="is-number">{number(city.visitors)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="kim-analytics-empty-cell" colSpan={4}>
                      尚無城市資料
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="kim-analytics-card kim-analytics-card--table">
          <div className="kim-analytics-section-heading">
            <div>
              <p>Content</p>
              <h3>熱門文章</h3>
            </div>
          </div>
          <div className="kim-analytics-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>文章</th>
                  <th className="is-number">人氣</th>
                  <th className="is-number">訪客</th>
                </tr>
              </thead>
              <tbody>
                {analytics.popularPages.length > 0 ? (
                  analytics.popularPages.map((page) => (
                    <tr key={page.path}>
                      <td className="kim-analytics-title-cell">
                        <a
                          href={`https://blog.kimlafayette.com${page.path}`}
                          rel="noopener noreferrer"
                          target="_blank"
                          title={page.title}
                        >
                          {page.title}
                        </a>
                      </td>
                      <td className="is-number">{number(page.pageviews)}</td>
                      <td className="is-number">{number(page.visitors)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="kim-analytics-empty-cell" colSpan={3}>
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
