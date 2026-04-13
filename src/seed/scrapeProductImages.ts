/**
 * CHIC KIM & MIU — 商品圖片下載腳本
 * ──────────────────────────────────────
 * 從 www.chickimmiu.com 批次下載商品圖片，存入 /public/products/
 * 之後可透過 Payload CMS Media 集合匯入
 *
 * 使用方式：
 *   npx tsx src/seed/scrapeProductImages.ts
 *
 * 注意：此腳本需要網路連線，且 Shopline 使用動態渲染
 *       建議使用 Chrome 瀏覽器工具手動抓取圖片 URL
 *       或使用 MCP Chrome 工具自動化
 */

import fs from 'fs'
import path from 'path'
import https from 'https'
import http from 'http'

const OUTPUT_DIR = path.resolve(process.cwd(), 'public/products')

/** 確保輸出目錄存在 */
function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

/** 下載圖片 */
function downloadImage(url: string, filepath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    client.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        // Follow redirect
        const redirectUrl = res.headers.location
        if (redirectUrl) {
          downloadImage(redirectUrl, filepath).then(resolve).catch(reject)
          return
        }
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`))
        return
      }
      const ws = fs.createWriteStream(filepath)
      res.pipe(ws)
      ws.on('finish', () => { ws.close(); resolve() })
      ws.on('error', reject)
    }).on('error', reject)
  })
}

/**
 * 商品圖片 URL 清單
 * 從 www.chickimmiu.com 的 Shopline CDN 收集
 * 格式：shoplineimg.com/{store_id}/{product_image_id}/600x.webp
 *
 * TODO: 使用 Chrome MCP 工具自動抓取各商品頁的圖片 URL
 * 暫時提供一組範例圖片 URL，管理員可手動從後台上傳
 */
const PRODUCT_IMAGES: Record<string, string[]> = {
  // 範例 — 請用實際的 Shopline CDN URL 取代
  // 'product-slug': ['https://shoplineimg.com/...', '...'],
}

async function main() {
  console.log('╔══════════════════════════════════════════╗')
  console.log('║   CHIC KIM & MIU — 商品圖片下載工具     ║')
  console.log('╚══════════════════════════════════════════╝')
  console.log()

  ensureDir(OUTPUT_DIR)

  const slugs = Object.keys(PRODUCT_IMAGES)
  if (slugs.length === 0) {
    console.log('⚠️  PRODUCT_IMAGES 目前為空。')
    console.log('   請先使用 Chrome 工具從 www.chickimmiu.com 收集商品圖片 URL，')
    console.log('   或直接在 Payload CMS 後台手動上傳商品圖片。')
    console.log()
    console.log('   後台路徑：/admin/collections/products → 編輯商品 → 商品圖片')
    console.log()
    console.log('   提示：商品列表頁的圖片 URL 格式通常為：')
    console.log('   https://shoplineimg.com/{store_id}/{image_id}/600x.webp')
    return
  }

  let downloaded = 0
  let failed = 0

  for (const slug of slugs) {
    const urls = PRODUCT_IMAGES[slug]
    const slugDir = path.join(OUTPUT_DIR, slug)
    ensureDir(slugDir)

    for (let i = 0; i < urls.length; i++) {
      const ext = urls[i].includes('.webp') ? 'webp' : urls[i].includes('.png') ? 'png' : 'jpg'
      const filename = `${slug}-${i + 1}.${ext}`
      const filepath = path.join(slugDir, filename)

      if (fs.existsSync(filepath)) {
        console.log(`  → ${filename} (已存在)`)
        continue
      }

      try {
        await downloadImage(urls[i], filepath)
        console.log(`  ✓ ${filename}`)
        downloaded++
      } catch (err) {
        console.error(`  ✗ ${filename}:`, err)
        failed++
      }
    }
  }

  console.log()
  console.log(`✅ 下載完成！成功 ${downloaded} 張，失敗 ${failed} 張`)
  console.log(`📁 圖片位置：${OUTPUT_DIR}`)
}

main().catch(console.error)
