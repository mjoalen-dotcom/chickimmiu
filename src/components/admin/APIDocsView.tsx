import React from 'react'
import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps, SanitizedCollectionConfig, SanitizedGlobalConfig } from 'payload'

/**
 * APIDocsView — /admin/api-docs
 * ─────────────────────────────
 * 給 APP / 第三方串接工程師看的 REST 端點目錄。
 *
 * Payload v3 自動把每個 collection 暴露在 `/api/{slug}` (list/create) +
 * `/api/{slug}/{id}` (read/update/delete)；每個 global 暴露在 `/api/globals/{slug}`。
 * 這個 view 從 sanitized config 讀出所有 collection / global，產出表格 + 範例 curl，
 * 工程師可以直接照抄。
 *
 * 比起手寫 OpenAPI yaml 的好處：
 *   - 永遠跟 collections 同步（新增 collection 自動入表）
 *   - 不用維護額外檔案
 *   - 不需要拉 swagger-ui / redoc 加 bundle
 *
 * Auth 方式（兩條都列出來給工程師選）：
 *   - Cookie session（瀏覽器 / 已登入後台後叫 fetch）
 *   - Bearer JWT (`Authorization: JWT <token>`，從 /api/customers/login 取得)
 *
 * 入口：
 *   - URL: /admin/api-docs（直連）
 *   - Sidebar: ⑦ 系統工具 → REST API 文件（CKMUSystemToolsNavGroup 第 2 條）
 *
 * 對應 src/payload.config.ts admin.components.views.apiDocs。
 */
const APIDocsView: React.FC<AdminViewServerProps> = async ({
  initPageResult,
  params,
  searchParams,
}) => {
  const user = initPageResult.req.user
  const isAdmin = Boolean(user && (user as { role?: string }).role === 'admin')

  if (!isAdmin) {
    return (
      <DefaultTemplate
        i18n={initPageResult.req.i18n}
        locale={initPageResult.locale}
        params={params}
        payload={initPageResult.req.payload}
        permissions={initPageResult.permissions}
        searchParams={searchParams}
        user={initPageResult.req.user || undefined}
        visibleEntities={initPageResult.visibleEntities}
      >
        <div style={{ padding: 32 }}>
          <p>需要管理員權限。</p>
        </div>
      </DefaultTemplate>
    )
  }

  const payload = initPageResult.req.payload
  const collections = (payload.config.collections as SanitizedCollectionConfig[]) || []
  const globals = (payload.config.globals as SanitizedGlobalConfig[]) || []
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://chickimmiu.com'

  // 過濾掉 admin.hidden 的 collection（例：payload-folders、payload-locked-documents）
  const visibleCollections = collections
    .filter((c) => {
      const hidden = (c.admin as { hidden?: boolean | (() => boolean) } | undefined)?.hidden
      return typeof hidden === 'function' ? false : !hidden
    })
    .sort((a, b) => a.slug.localeCompare(b.slug))

  const visibleGlobals = globals
    .filter((g) => {
      const hidden = (g.admin as { hidden?: boolean | (() => boolean) } | undefined)?.hidden
      return typeof hidden === 'function' ? false : !hidden
    })
    .sort((a, b) => a.slug.localeCompare(b.slug))

  // ── styles ──
  const card: React.CSSProperties = {
    border: '1px solid var(--theme-elevation-150, #e4e4e7)',
    borderRadius: 12,
    padding: 24,
    marginBottom: 16,
    background: 'var(--theme-elevation-0, #fff)',
  }
  const codeBlock: React.CSSProperties = {
    background: 'var(--theme-elevation-100, #f6f6f7)',
    border: '1px solid var(--theme-elevation-150, #e4e4e7)',
    borderRadius: 6,
    padding: 12,
    fontFamily: 'ui-monospace, "SFMono-Regular", "Cascadia Mono", Consolas, monospace',
    fontSize: 12,
    lineHeight: 1.6,
    overflow: 'auto',
    margin: '8px 0 12px',
    whiteSpace: 'pre',
  }
  const inlineCode: React.CSSProperties = {
    background: 'var(--theme-elevation-100, #f6f6f7)',
    padding: '1px 6px',
    borderRadius: 4,
    fontFamily: 'ui-monospace, "SFMono-Regular", Consolas, monospace',
    fontSize: 12,
  }
  const th: React.CSSProperties = {
    textAlign: 'left',
    padding: '8px 10px',
    fontSize: 12,
    fontWeight: 600,
    background: 'var(--theme-elevation-50, #fafafa)',
    borderBottom: '1px solid var(--theme-elevation-150, #e4e4e7)',
    position: 'sticky',
    top: 0,
  }
  const td: React.CSSProperties = {
    padding: '8px 10px',
    fontSize: 13,
    borderBottom: '1px solid var(--theme-elevation-100, #f0f0f0)',
    verticalAlign: 'top',
  }

  return (
    <DefaultTemplate
      i18n={initPageResult.req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={initPageResult.req.payload}
      permissions={initPageResult.permissions}
      searchParams={searchParams}
      user={initPageResult.req.user || undefined}
      visibleEntities={initPageResult.visibleEntities}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 32px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, marginBottom: 4 }}>
          🔌 REST API 文件
        </h1>
        <p
          style={{
            margin: 0,
            marginBottom: 24,
            color: 'var(--theme-elevation-600, #666)',
            fontSize: 14,
          }}
        >
          給 CKMU APP / 第三方串接工程師的 REST 端點目錄（從 Payload config 自動產生）。
          Base URL：<code style={inlineCode}>{baseUrl}</code>
        </p>

        {/* ── 認證 ── */}
        <section style={card}>
          <h2 style={{ margin: 0, marginBottom: 12, fontSize: 18, fontWeight: 600 }}>
            🔐 認證
          </h2>
          <p style={{ marginTop: 0, fontSize: 13 }}>
            兩種方式都會通：
          </p>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: '8px 0 4px' }}>
            1. Bearer JWT（推薦給 APP / server-to-server）
          </h3>
          <pre style={codeBlock}>
{`# 1. 登入取 token
curl -X POST '${baseUrl}/api/customers/login' \\
  -H 'Content-Type: application/json' \\
  -d '{"email":"user@example.com","password":"<PASSWORD>"}'
# 回應：{ "user": {...}, "token": "<JWT>", "exp": ... }

# 2. 後續請求帶 Authorization header
curl '${baseUrl}/api/products?limit=10' \\
  -H 'Authorization: JWT <JWT>'`}
          </pre>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: '12px 0 4px' }}>
            2. Cookie session（瀏覽器 fetch / 已登入後台後叫）
          </h3>
          <pre style={codeBlock}>
{`fetch('/api/products', { credentials: 'include' })
  .then(r => r.json())`}
          </pre>
        </section>

        {/* ── 通用 query 參數 ── */}
        <section style={card}>
          <h2 style={{ margin: 0, marginBottom: 12, fontSize: 18, fontWeight: 600 }}>
            🔍 List 端點通用 query 參數
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={th}>參數</th>
                <th style={th}>說明</th>
                <th style={th}>範例</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={td}>
                  <code style={inlineCode}>limit</code>
                </td>
                <td style={td}>每頁筆數（預設 10，max 100）</td>
                <td style={td}>
                  <code style={inlineCode}>?limit=50</code>
                </td>
              </tr>
              <tr>
                <td style={td}>
                  <code style={inlineCode}>page</code>
                </td>
                <td style={td}>頁碼（從 1 開始）</td>
                <td style={td}>
                  <code style={inlineCode}>?page=2</code>
                </td>
              </tr>
              <tr>
                <td style={td}>
                  <code style={inlineCode}>sort</code>
                </td>
                <td style={td}>排序欄位（前綴 - 為遞減）</td>
                <td style={td}>
                  <code style={inlineCode}>?sort=-createdAt</code>
                </td>
              </tr>
              <tr>
                <td style={td}>
                  <code style={inlineCode}>where[field][operator]</code>
                </td>
                <td style={td}>
                  欄位篩選；operator: equals / not_equals / greater_than / less_than / in / contains
                </td>
                <td style={td}>
                  <code style={inlineCode}>?where[status][equals]=published</code>
                </td>
              </tr>
              <tr>
                <td style={td}>
                  <code style={inlineCode}>depth</code>
                </td>
                <td style={td}>關聯展開深度（預設 1，0 = 只回 ID，max 10）</td>
                <td style={td}>
                  <code style={inlineCode}>?depth=2</code>
                </td>
              </tr>
              <tr>
                <td style={td}>
                  <code style={inlineCode}>locale</code>
                </td>
                <td style={td}>本站尚未啟用 i18n field locale，留空即可</td>
                <td style={td}>—</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* ── Collections ── */}
        <section style={card}>
          <h2 style={{ margin: 0, marginBottom: 12, fontSize: 18, fontWeight: 600 }}>
            📦 Collections（{visibleCollections.length}）
          </h2>
          <p style={{ marginTop: 0, fontSize: 13, color: 'var(--theme-elevation-600, #666)' }}>
            每個 collection 對應一張 DB 表，自動暴露 5 個 REST 端點。
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={th}>Slug（中文 label）</th>
                  <th style={th}>List / Create</th>
                  <th style={th}>Read / Update / Delete</th>
                  <th style={th}>Group</th>
                </tr>
              </thead>
              <tbody>
                {visibleCollections.map((c) => {
                  const label = getCollectionLabel(c)
                  const group = getCollectionGroup(c)
                  return (
                    <tr key={c.slug}>
                      <td style={td}>
                        <code style={inlineCode}>{c.slug}</code>
                        {label && (
                          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--theme-elevation-600, #666)' }}>
                            {label}
                          </div>
                        )}
                      </td>
                      <td style={td}>
                        <code style={inlineCode}>GET /api/{c.slug}</code>
                        <br />
                        <code style={inlineCode}>POST /api/{c.slug}</code>
                      </td>
                      <td style={td}>
                        <code style={inlineCode}>GET /api/{c.slug}/:id</code>
                        <br />
                        <code style={inlineCode}>PATCH /api/{c.slug}/:id</code>
                        <br />
                        <code style={inlineCode}>DELETE /api/{c.slug}/:id</code>
                      </td>
                      <td style={td}>{group || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Globals ── */}
        <section style={card}>
          <h2 style={{ margin: 0, marginBottom: 12, fontSize: 18, fontWeight: 600 }}>
            ⚙️ Globals（{visibleGlobals.length}）
          </h2>
          <p style={{ marginTop: 0, fontSize: 13, color: 'var(--theme-elevation-600, #666)' }}>
            Global 是單例設定（公告 bar / 首頁版面 / 稅率 ...），只有 GET / POST 兩個端點。
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={th}>Slug（中文 label）</th>
                  <th style={th}>Read / Update</th>
                  <th style={th}>Group</th>
                </tr>
              </thead>
              <tbody>
                {visibleGlobals.map((g) => {
                  const label = getGlobalLabel(g)
                  const group = getGlobalGroup(g)
                  return (
                    <tr key={g.slug}>
                      <td style={td}>
                        <code style={inlineCode}>{g.slug}</code>
                        {label && (
                          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--theme-elevation-600, #666)' }}>
                            {label}
                          </div>
                        )}
                      </td>
                      <td style={td}>
                        <code style={inlineCode}>GET /api/globals/{g.slug}</code>
                        <br />
                        <code style={inlineCode}>POST /api/globals/{g.slug}</code>
                      </td>
                      <td style={td}>{group || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── 常用範例 ── */}
        <section style={card}>
          <h2 style={{ margin: 0, marginBottom: 12, fontSize: 18, fontWeight: 600 }}>
            💡 常用範例
          </h2>

          <h3 style={{ fontSize: 14, fontWeight: 600, margin: '8px 0 4px' }}>列已上架商品（前 20 筆，按更新時間倒序）</h3>
          <pre style={codeBlock}>
{`curl '${baseUrl}/api/products?where[status][equals]=published&limit=20&sort=-updatedAt&depth=2'`}
          </pre>

          <h3 style={{ fontSize: 14, fontWeight: 600, margin: '12px 0 4px' }}>取單一商品 by slug</h3>
          <pre style={codeBlock}>
{`curl '${baseUrl}/api/products?where[slug][equals]=my-product-slug&limit=1&depth=2'`}
          </pre>

          <h3 style={{ fontSize: 14, fontWeight: 600, margin: '12px 0 4px' }}>取目前使用者（需 cookie / JWT）</h3>
          <pre style={codeBlock}>
{`curl '${baseUrl}/api/customers/me' \\
  -H 'Authorization: JWT <JWT>'`}
          </pre>

          <h3 style={{ fontSize: 14, fontWeight: 600, margin: '12px 0 4px' }}>讀導覽設定（公告 bar / 主選單 / 頁尾）</h3>
          <pre style={codeBlock}>
{`curl '${baseUrl}/api/globals/navigation-settings?depth=2'`}
          </pre>

          <h3 style={{ fontSize: 14, fontWeight: 600, margin: '12px 0 4px' }}>建立會員（公開端點）</h3>
          <pre style={codeBlock}>
{`curl -X POST '${baseUrl}/api/customers/register' \\
  -H 'Content-Type: application/json' \\
  -d '{"email":"new@example.com","password":"<PW>","name":"小明"}'`}
          </pre>
        </section>

        <p style={{ marginTop: 24, fontSize: 12, color: 'var(--theme-elevation-500, #888)' }}>
          欄位 schema 細節可直接從個別 collection 的 admin 編輯頁查看。
          產品 / Order / User 等核心 collection 的 webhook 還沒架，目前僅支援 polling。
        </p>
      </div>
    </DefaultTemplate>
  )
}

// ──────────────────────────────────────────────
// Helpers — extract human-readable label / group
// ──────────────────────────────────────────────

function getCollectionLabel(c: SanitizedCollectionConfig): string | null {
  const label = c.labels?.plural
  if (typeof label === 'string') return label
  if (label && typeof label === 'object') {
    const zh = (label as Record<string, string>).zh || (label as Record<string, string>)['zh-TW']
    if (zh) return zh
    const first = Object.values(label)[0]
    return typeof first === 'string' ? first : null
  }
  return null
}

function getGlobalLabel(g: SanitizedGlobalConfig): string | null {
  const label = g.label
  if (typeof label === 'string') return label
  if (label && typeof label === 'object') {
    const zh = (label as Record<string, string>).zh || (label as Record<string, string>)['zh-TW']
    if (zh) return zh
    const first = Object.values(label)[0]
    return typeof first === 'string' ? first : null
  }
  return null
}

function getCollectionGroup(c: SanitizedCollectionConfig): string | null {
  const group = (c.admin as { group?: string | Record<string, string> } | undefined)?.group
  if (typeof group === 'string') return group
  if (group && typeof group === 'object') {
    const zh = group.zh || group['zh-TW']
    if (zh) return zh
    const first = Object.values(group)[0]
    return typeof first === 'string' ? first : null
  }
  return null
}

function getGlobalGroup(g: SanitizedGlobalConfig): string | null {
  const group = (g.admin as { group?: string | Record<string, string> } | undefined)?.group
  if (typeof group === 'string') return group
  if (group && typeof group === 'object') {
    const zh = group.zh || group['zh-TW']
    if (zh) return zh
    const first = Object.values(group)[0]
    return typeof first === 'string' ? first : null
  }
  return null
}

export default APIDocsView
