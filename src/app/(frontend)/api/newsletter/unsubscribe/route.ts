import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * GET /api/newsletter/unsubscribe?token=<unsubscribeToken>
 * ───────────────────────────────────────────────────────
 * 電子報內「取消訂閱」連結。以每位訂閱者唯一的 unsubscribeToken 比對，
 * 無需登入即可退訂（符合 CAN-SPAM / 個資法一鍵退訂要求）。回傳簡單 HTML 頁。
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function htmlPage(title: string, message: string, ok: boolean): Response {
  const body = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>${title}｜CHIC KIM & MIU</title>
  <style>
    body{margin:0;font-family:system-ui,-apple-system,"PingFang TC","Microsoft JhengHei",sans-serif;background:#faf8f3;color:#1a1a1a;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
    .card{max-width:460px;width:100%;background:#fff;border:1px solid #ece5d8;border-radius:20px;padding:40px 32px;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.04)}
    .badge{font-size:11px;letter-spacing:.3em;color:#b8995a;margin-bottom:12px}
    h1{font-size:20px;margin:0 0 12px;font-weight:600}
    p{font-size:14px;color:#666;line-height:1.7;margin:0 0 24px}
    a{display:inline-block;padding:12px 28px;background:#1a1a1a;color:#faf8f3;border-radius:999px;text-decoration:none;font-size:13px;letter-spacing:.05em}
    .icon{font-size:40px;margin-bottom:8px}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${ok ? '✓' : '⚠'}</div>
    <div class="badge">CHIC KIM &amp; MIU</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="/">回到首頁</a>
  </div>
</body>
</html>`
  return new Response(body, {
    status: ok ? 200 : 400,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

export async function GET(req: NextRequest) {
  try {
    const token = String(req.nextUrl.searchParams.get('token') || '').trim()
    if (!token) {
      return htmlPage('連結無效', '退訂連結缺少必要參數，請從電子報內的連結重新點擊。', false)
    }

    const payload = await getPayload({ config })
    const res = await payload.find({
      collection: 'newsletter-subscribers',
      where: { unsubscribeToken: { equals: token } },
      limit: 1,
      depth: 0,
    })

    if (res.totalDocs === 0) {
      return htmlPage('連結無效', '找不到對應的訂閱記錄，可能您已退訂或連結已失效。', false)
    }

    const doc = res.docs[0]!
    if (doc.status !== 'unsubscribed') {
      await payload.update({
        collection: 'newsletter-subscribers',
        id: String(doc.id),
        data: { status: 'unsubscribed', unsubscribedAt: new Date().toISOString() },
      })
    }

    return htmlPage(
      '已取消訂閱',
      '您已成功取消訂閱 CHIC KIM & MIU 電子報，將不再收到行銷郵件。期待未來再相見。',
      true,
    )
  } catch (error) {
    console.error('[newsletter/unsubscribe GET] error:', error)
    return htmlPage('系統錯誤', '處理退訂時發生問題，請稍後再試或聯絡客服。', false)
  }
}
