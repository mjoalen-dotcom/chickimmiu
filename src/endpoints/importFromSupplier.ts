import type { Endpoint, PayloadRequest } from 'payload'
import { createHash } from 'crypto'
import { lookup } from 'dns/promises'
import sharp from 'sharp'

/**
 * POST /api/media/import-from-supplier
 * ─────────────────────────────────────
 * 給後台管理員用的「貼供應商 URL 一鍵抓圖入庫」endpoint。
 *
 * 對應的 Python 工具：tools/image-downloader/image_downloader.py
 * 這裡是 Node 重寫版（去 Python runtime 依賴），用 native fetch + sharp + 正則 HTML parser。
 *
 * Body:
 *   {
 *     url: string,                                  // 必填，供應商 PDP URL
 *     minWidth?: number,         (default 800)
 *     minHeight?: number,        (default 600)
 *     maxImages?: number,        (default 50, hard cap 100)
 *     folder?: string,           (default 自動由 URL slug 推)
 *     categories?: string[],     (default ['main','detail'])
 *     dryRun?: boolean           (default false — 開啟只回 plan 不入庫)
 *   }
 *
 * 安全：
 *   - 僅 role=admin 可呼叫（防 customer 用後台爬任意網站當代理）
 *   - 僅 http/https；DNS 解析後擋 private IP（10/172.16/192.168/169.254/loopback/fc/fe80）
 *     防 SSRF 打 prod 內網（Hetzner 同機 LAN 或 metadata service）
 *   - 8MB / 圖（與 Media.ts beforeChange 對齊）
 *   - 50 張上限（避免單請求把伺服器 RAM 打爆）
 *   - 圖片下載仍走 Media.access.create → Media.beforeChange MIME 白名單
 *
 * 注意：
 *   - 純 regex 抽 HTML，動態 SPA 抓不到。要支援 JS 渲染請外接 Playwright。
 *   - 沒做 retry；單張失敗就 skip 不擋整批。
 */

// ============================================================================
// 常數
// ============================================================================

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'

const LAZY_ATTRS = [
  'data-src',
  'data-original',
  'data-lazy-src',
  'data-lazy',
  'data-srcset',
  'data-original-src',
  'data-actualsrc',
  'data-img',
  'data-url',
  'data-echo',
  'data-defer-src',
] as const

const VALID_EXTS = /\.(jpe?g|png|webp|gif)(\?|$)/i

const DEFAULT_EXCLUDE_RE =
  /(favicon|sprite|spacer|blank|placeholder|loading\.gif|1x1\.gif|avatar|emoji|icon[-_./])/i

const FORMAT_TO_MIME: Record<string, string> = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
}

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

const HTML_TIMEOUT_MS = 30_000
const IMAGE_TIMEOUT_MS = 20_000
const MAX_IMAGE_BYTES = 8 * 1024 * 1024 // 對齊 Media.ts beforeChange
const MAX_IMAGES_HARD_CAP = 100
const DOWNLOAD_CONCURRENCY = 4

// ============================================================================
// SSRF 防護
// ============================================================================

/** 判斷 IP 是否為私有 / loopback / link-local（v4 + v6） */
function isPrivateIp(ip: string): boolean {
  const v = ip.toLowerCase()
  // IPv4
  if (v === '127.0.0.1' || v === '0.0.0.0') return true
  if (v.startsWith('10.')) return true
  if (v.startsWith('192.168.')) return true
  if (v.startsWith('169.254.')) return true // link-local + AWS metadata
  const m = v.match(/^172\.(\d+)\./)
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true
  // IPv6
  if (v === '::1' || v === '::') return true
  if (v.startsWith('fe80:')) return true // link-local
  if (v.startsWith('fc') || v.startsWith('fd')) return true // unique local
  // IPv4-mapped IPv6
  const m6 = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (m6) return isPrivateIp(m6[1])
  return false
}

async function assertSafeUrl(raw: string): Promise<{ ok: true; url: URL } | { ok: false; reason: string }> {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return { ok: false, reason: 'invalid_url' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'protocol_not_allowed' }
  }
  // hostname 直接是 IP 也要擋
  try {
    const { address } = await lookup(parsed.hostname)
    if (isPrivateIp(address)) {
      return { ok: false, reason: 'private_ip' }
    }
  } catch {
    return { ok: false, reason: 'dns_failed' }
  }
  return { ok: true, url: parsed }
}

// ============================================================================
// HTML 解析（正則版）
// ============================================================================

type Candidate = { url: string; alt: string }

function parseSrcset(s: string): string[] {
  return s
    .split(',')
    .map((p) => p.trim().split(/\s+/)[0])
    .filter(Boolean)
}

function unwrapNextImage(absUrl: string, baseUrl: string): string {
  if (!absUrl.includes('/_next/image')) return absUrl
  try {
    const u = new URL(absUrl)
    const inner = u.searchParams.get('url')
    if (inner) return new URL(decodeURIComponent(inner), baseUrl).toString()
  } catch {
    // fall through
  }
  return absUrl
}

function* walkJsonForImages(node: unknown): Generator<string> {
  if (Array.isArray(node)) {
    for (const x of node) yield* walkJsonForImages(x)
    return
  }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k.toLowerCase() === 'image') {
        if (typeof v === 'string') yield v
        else if (Array.isArray(v)) {
          for (const x of v) {
            if (typeof x === 'string') yield x
            else if (x && typeof x === 'object' && typeof (x as { url?: unknown }).url === 'string')
              yield (x as { url: string }).url
          }
        } else if (v && typeof v === 'object' && typeof (v as { url?: unknown }).url === 'string') {
          yield (v as { url: string }).url
        }
      } else {
        yield* walkJsonForImages(v)
      }
    }
  }
}

function extractImageUrls(html: string, baseUrl: string): Candidate[] {
  const seen = new Set<string>()
  const out: Candidate[] = []

  const add = (raw: string, alt: string) => {
    if (!raw) return
    const trimmed = raw.trim()
    if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('javascript:')) return
    let abs: string
    try {
      abs = new URL(trimmed, baseUrl).toString()
    } catch {
      return
    }
    abs = unwrapNextImage(abs, baseUrl)
    if (seen.has(abs)) return
    seen.add(abs)
    out.push({ url: abs, alt: (alt || '').slice(0, 200) })
  }

  // ---- <img> + src + lazy attrs + srcset ----
  const imgRe = /<img\b([^>]*)>/gi
  let m: RegExpExecArray | null
  while ((m = imgRe.exec(html))) {
    const attrs = m[1]
    const altMatch = attrs.match(/\balt\s*=\s*["']([^"']*)["']/i)
    const alt = (altMatch?.[1] || '').trim()

    const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i)
    if (srcMatch) add(srcMatch[1], alt)

    for (const lazy of LAZY_ATTRS) {
      // 屬性名含 - 要 escape；但 LAZY_ATTRS 都是字面字元，直接拼字串 regex 安全
      const re = new RegExp(`\\b${lazy}\\s*=\\s*["']([^"']+)["']`, 'i')
      const v = attrs.match(re)?.[1]
      if (!v) continue
      if (lazy.includes('srcset')) {
        for (const u of parseSrcset(v)) add(u, alt)
      } else {
        add(v, alt)
      }
    }

    const srcset = attrs.match(/\bsrcset\s*=\s*["']([^"']+)["']/i)?.[1]
    if (srcset) for (const u of parseSrcset(srcset)) add(u, alt)
  }

  // ---- <source srcset>（picture） ----
  const sourceRe = /<source\b([^>]*)>/gi
  while ((m = sourceRe.exec(html))) {
    const attrs = m[1]
    const v = attrs.match(/\b(?:data-)?srcset\s*=\s*["']([^"']+)["']/i)?.[1]
    if (v) for (const u of parseSrcset(v)) add(u, '')
  }

  // ---- og:image / twitter:image ----
  const ogRe =
    /<meta\b[^>]*\bproperty\s*=\s*["']og:image(?::url|:secure_url)?["'][^>]*\bcontent\s*=\s*["']([^"']+)["']/gi
  while ((m = ogRe.exec(html))) add(m[1], 'og_image')
  const ogRe2 =
    /<meta\b[^>]*\bcontent\s*=\s*["']([^"']+)["'][^>]*\bproperty\s*=\s*["']og:image(?::url|:secure_url)?["']/gi
  while ((m = ogRe2.exec(html))) add(m[1], 'og_image')
  const twRe =
    /<meta\b[^>]*\bname\s*=\s*["']twitter:image["'][^>]*\bcontent\s*=\s*["']([^"']+)["']/gi
  while ((m = twRe.exec(html))) add(m[1], 'twitter_image')

  // ---- <a href> 直連大圖 ----
  const aRe = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi
  while ((m = aRe.exec(html))) {
    if (VALID_EXTS.test(m[1])) add(m[1], '')
  }

  // ---- inline background-image ----
  const bgRe = /background(?:-image)?\s*:\s*[^;"']*url\(['"]?([^'")]+)['"]?\)/gi
  while ((m = bgRe.exec(html))) add(m[1], '')

  // ---- JSON-LD ----
  const ldRe =
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  while ((m = ldRe.exec(html))) {
    try {
      const data = JSON.parse(m[1].trim())
      for (const u of walkJsonForImages(data)) add(u, 'json_ld')
    } catch {
      // JSON-LD 寫壞跳過
    }
  }

  return out
}

// ============================================================================
// 啟發式分類（與 Python 版規則對齊）
// ============================================================================

function classifyImage(width: number, height: number, urlOrName: string, alt: string): string {
  const text = `${urlOrName} ${alt}`.toLowerCase()
  if (/(thumb|thumbnail|small|mini)/.test(text)) return 'thumbnail'
  if (/(detail|describ|desc_|info|spec|size_chart|size-chart)/.test(text)) return 'detail'
  if (/(main|primary|cover|hero|og_image|og-image|twitter_image)/.test(text)) return 'main'
  if (height === 0) return 'other'
  const aspect = width / height
  if (aspect < 0.7) return 'detail'
  if (aspect >= 0.7 && aspect <= 1.4 && width >= 600) return 'main'
  if (aspect > 2.5) return 'detail'
  return 'other'
}

// ============================================================================
// 檔名 / slug
// ============================================================================

const UNSAFE_FN_RE = /[\\/:*?"<>|\r\n\t]+/g

function sanitizeFilename(name: string, maxLen = 80): string {
  return name.replace(UNSAFE_FN_RE, '_').replace(/^[\s._]+|[\s._]+$/g, '').slice(0, maxLen)
}

function deriveFilenameStem(url: string, alt: string, idx: number): string {
  try {
    const parsed = new URL(url)
    const last = decodeURIComponent(parsed.pathname.split('/').pop() || '')
    const stem = last.replace(/\.[^./]+$/, '')
    const cleaned = sanitizeFilename(stem)
    if (cleaned) return cleaned
  } catch {
    // ignore
  }
  if (alt) {
    const cleaned = sanitizeFilename(alt)
    if (cleaned) return cleaned
  }
  return `image_${String(idx).padStart(4, '0')}`
}

function derivePageSlug(url: string): string {
  try {
    const u = new URL(url)
    const path = u.pathname.replace(/^\/+|\/+$/g, '').replace(/\//g, '_')
    return sanitizeFilename(path || u.hostname, 60) || u.hostname
  } catch {
    return 'supplier'
  }
}

// ============================================================================
// Endpoint
// ============================================================================

type ImportBody = {
  url?: string
  minWidth?: number
  minHeight?: number
  maxImages?: number
  folder?: string
  categories?: string[]
  dryRun?: boolean
}

type DownloadedImage = {
  cand: Candidate
  buffer: Buffer
  mime: string
  width: number
  height: number
  md5: string
  category: string
}

export const importFromSupplierEndpoint: Endpoint = {
  path: '/import-from-supplier',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    // ---- 1. 權限：admin only ----
    const role = (req.user as unknown as { role?: string } | undefined)?.role
    if (!req.user || role !== 'admin') {
      return Response.json(
        { error: 'forbidden', message: '僅後台管理員可使用此功能' },
        { status: 403 },
      )
    }

    // ---- 2. body ----
    let body: ImportBody | undefined
    try {
      body = (await req.json?.()) as ImportBody | undefined
    } catch {
      return Response.json({ error: 'invalid_json' }, { status: 400 })
    }

    const supplierUrl = (body?.url || '').trim()
    if (!supplierUrl) {
      return Response.json({ error: 'url_required', message: '請提供供應商商品頁 URL' }, { status: 400 })
    }

    const minWidth = Math.max(0, body?.minWidth ?? 800)
    const minHeight = Math.max(0, body?.minHeight ?? 600)
    const maxImages = Math.min(Math.max(1, body?.maxImages ?? 50), MAX_IMAGES_HARD_CAP)
    const dryRun = Boolean(body?.dryRun)
    const categoryFilter = new Set(
      Array.isArray(body?.categories) && body!.categories!.length > 0
        ? body!.categories!
        : ['main', 'detail'],
    )

    // ---- 3. SSRF check ----
    const safety = await assertSafeUrl(supplierUrl)
    if (!safety.ok) {
      return Response.json(
        { error: 'unsafe_url', reason: safety.reason, message: '此 URL 不允許（協定、私有 IP 或 DNS 失敗）' },
        { status: 400 },
      )
    }

    const folder = sanitizeFilename(body?.folder || '', 60) || derivePageSlug(supplierUrl)

    // ---- 4. 抓 HTML ----
    let html: string
    try {
      const resp = await fetch(supplierUrl, {
        headers: {
          'User-Agent': BROWSER_UA,
          'Accept':
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8,ko;q=0.7',
          Referer: supplierUrl,
        },
        signal: AbortSignal.timeout(HTML_TIMEOUT_MS),
        redirect: 'follow',
      })
      if (!resp.ok) {
        return Response.json(
          { error: 'fetch_failed', upstream_status: resp.status },
          { status: 502 },
        )
      }
      html = await resp.text()
    } catch (e) {
      return Response.json(
        { error: 'fetch_error', message: (e as Error).message },
        { status: 502 },
      )
    }

    // ---- 5. 抽 URL + 過濾垃圾 ----
    const candidates = extractImageUrls(html, supplierUrl).filter(
      (c) => !DEFAULT_EXCLUDE_RE.test(c.url),
    )
    if (candidates.length === 0) {
      return Response.json({
        success: true,
        total_candidates: 0,
        created: 0,
        message: '此頁面沒有抽到任何圖片（可能是 SPA 動態載入）',
      })
    }

    // ---- 6. 並發下載 + sharp 驗證 + MD5 去重 ----
    const seenMd5 = new Set<string>()
    const downloaded: DownloadedImage[] = []
    const queue = [...candidates]

    const downloadOne = async (cand: Candidate, idx: number): Promise<void> => {
      try {
        const r = await fetch(cand.url, {
          headers: {
            'User-Agent': BROWSER_UA,
            Referer: supplierUrl,
          },
          signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
          redirect: 'follow',
        })
        if (!r.ok) return
        const ct = (r.headers.get('content-type') || '').toLowerCase()
        if (ct.includes('html') || ct.includes('json') || ct.includes('text')) return

        const ab = await r.arrayBuffer()
        if (ab.byteLength > MAX_IMAGE_BYTES) return
        const buffer = Buffer.from(ab)

        const md5 = createHash('md5').update(buffer).digest('hex')
        if (seenMd5.has(md5)) return

        // sharp 驗證 + 拿尺寸
        let meta: sharp.Metadata
        try {
          meta = await sharp(buffer).metadata()
        } catch {
          return
        }
        const w = meta.width || 0
        const h = meta.height || 0
        if (w < minWidth || h < minHeight) return
        const mime = FORMAT_TO_MIME[String(meta.format || '').toLowerCase()]
        if (!mime) return

        seenMd5.add(md5)
        downloaded.push({
          cand,
          buffer,
          mime,
          width: w,
          height: h,
          md5,
          category: classifyImage(w, h, cand.url, cand.alt),
        })
      } catch {
        // 單張失敗就跳過
      }
      void idx
    }

    // 簡易 N-worker fan-out
    let cursor = 0
    await Promise.all(
      Array.from({ length: DOWNLOAD_CONCURRENCY }, async () => {
        while (cursor < queue.length && downloaded.length < maxImages) {
          const i = cursor++
          await downloadOne(queue[i], i)
        }
      }),
    )

    // ---- 7. 套分類 filter ----
    const filtered = downloaded.filter((d) => categoryFilter.has(d.category))

    // ---- 8. dry-run ----
    if (dryRun) {
      const byCat: Record<string, number> = {}
      for (const d of downloaded) byCat[d.category] = (byCat[d.category] || 0) + 1
      return Response.json({
        success: true,
        dryRun: true,
        folder,
        total_candidates: candidates.length,
        total_downloaded: downloaded.length,
        total_after_category_filter: filtered.length,
        by_category: byCat,
        items: filtered.map((d) => ({
          url: d.cand.url,
          alt: d.cand.alt,
          width: d.width,
          height: d.height,
          mime: d.mime,
          size_bytes: d.buffer.length,
          category: d.category,
        })),
      })
    }

    // ---- 9. 走 Payload local API 上傳到 Media ----
    type CreatedItem = {
      id: string | number
      filename?: string
      url?: string
      width: number
      height: number
      category: string
      src_url: string
    }
    const created: CreatedItem[] = []
    const errors: { url: string; error: string }[] = []

    for (let i = 0; i < filtered.length; i++) {
      const d = filtered[i]
      const stem = deriveFilenameStem(d.cand.url, d.cand.alt, i)
      const ext = MIME_TO_EXT[d.mime] || 'jpg'
      const filename = `${stem}.${ext}`

      try {
        // Payload v3 local API 接受 file param；會走 Media beforeChange hook 再驗一次
        // overrideAccess:false → 跑 access.create = Boolean(user) 驗證
        const doc = (await req.payload.create({
          collection: 'media',
          data: {
            alt: d.cand.alt || stem,
            folder,
          },
          file: {
            name: filename,
            data: d.buffer,
            mimetype: d.mime,
            size: d.buffer.length,
          },
          user: req.user,
          req,
          overrideAccess: false,
        } as Parameters<typeof req.payload.create>[0])) as unknown as {
          id: string | number
          filename?: string
          url?: string
        }

        created.push({
          id: doc.id,
          filename: doc.filename,
          url: doc.url,
          width: d.width,
          height: d.height,
          category: d.category,
          src_url: d.cand.url,
        })
      } catch (e) {
        errors.push({ url: d.cand.url, error: (e as Error).message })
      }
    }

    return Response.json({
      success: true,
      folder,
      total_candidates: candidates.length,
      total_downloaded: downloaded.length,
      total_after_category_filter: filtered.length,
      created: created.length,
      failed: errors.length,
      items: created,
      errorDetails: errors,
    })
  },
}
