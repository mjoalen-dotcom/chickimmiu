/**
 * 全商品圖片遷移腳本
 * ─────────────────────
 * 從 Shopline CDN 下載所有商品的封面圖片（主圖 + 懸停圖），上傳到 Payload Media 並關聯到商品
 *
 * 資料來源：舊 Shopline 站 (chickimmiu.com) 商品列表頁抓取
 * 每個商品有 2 張圖：主圖 + 懸停圖（hover image）
 *
 * 使用方式：
 *   PAYLOAD_SECRET=xxx DATABASE_URI=file:./data/chickimmiu.db npx tsx src/seed/migrateAllImages.ts
 */

import { getPayload } from 'payload'
import config from '../payload.config'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import https from 'https'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Shopline CDN base URLs (try multiple patterns)
const SHOPLINE_CDN = 'https://img.shoplineapp.com/media/image_clips'
const SHOPLINE_IMG = 'https://shoplineimg.com/559df3efe37ec64e9f000092'

// All 72 products scraped from old Shopline site (2025-04-12)
// Format: { name, imageIds: [mainImage, hoverImage] }
const SHOPLINE_PRODUCTS: { name: string; imageIds: string[] }[] = [
  // ── Batch 1: Products 0-23 ──
  { name: 'Dream 拼接絲緞蝴蝶結洋裝', imageIds: ['69d3d8324c5226e1bcda99eb', '69d3d834828ea777b6089da8'] },
  { name: 'Colette 修身提腰氣質洋裝', imageIds: ['69d3d850293e6404cf30e5ce', '69d3d8532ed9293b08d956e5'] },
  { name: 'Estelle 小香珍珠洋裝', imageIds: ['69d3d83b4ef225a55ea202e5', '69d3d83cc4629c2430bbc582'] },
  { name: 'Myrca 精緻短版西裝外套', imageIds: ['69d3d8d557f177d12573967d', '69d3d8d369b9a15339a950c8'] },
  { name: 'Myrca 優雅百摺褲裙', imageIds: ['69d3d8dfa610233fa6be2386', '69d3d8de293e64fd5d30e7a0'] },
  { name: 'Bertha 都會金釦翻領襯衫', imageIds: ['69d3e0b795013e15481a46c5', '69d3e0bbedb962b2be6c1fa3'] },
  { name: 'Aria 天絲流光垂墜襯衫', imageIds: ['69d3e09495013e3cbc1a3e98', '69d3e0904c5226311bda89d3'] },
  { name: 'Zenith 絲光優雅襯衫', imageIds: ['69d3dfcfa88bd56a7b620342', '69d3dfd35165895b2faa943c'] },
  { name: 'Janice 復古塗層鉛筆裙', imageIds: ['69d3df895b0a4341a091a6df', '69d3df928c3b4a0de50b6dd0'] },
  { name: 'Candace 俐落直筒五分褲', imageIds: ['69d4638ebc52f133a4538558', '69d4638190e66d38d2b03281'] },
  { name: 'Beck 寬腰帶打摺五分褲', imageIds: ['69d463563b4cba2d37b300b7', '69d46359a20dbe3ebf3f83a1'] },
  { name: 'Amelia 優雅疊紗包釦洋裝', imageIds: ['69ca4f60043ccd59ea96d5db', '69ca4f60c197c703a90697a0'] },
  { name: 'Yuna 氣質收腰雙排釦洋裝', imageIds: ['69ca51927d644d009eac3783', '69ca51965ca5ac99b01cb72f'] },
  { name: 'Miriam 優雅高腰寬褲西裝套裝', imageIds: ['69ca5266dd7f90b1732e8a5d', '69ca5279fa50a4bbf5114f63'] },
  { name: 'Willow 氣質方領雪紡上衣', imageIds: ['69ca533f5984db6c457ee57d', '69ca533faaade9f2e73e1b7a'] },
  { name: 'Irene 名媛風珍珠釦上衣', imageIds: ['69ca53a3584149d3b5f646f9', '69ca53abb38656b0d0ff1aa8'] },
  { name: 'Irene 極簡高腰直筒長裙', imageIds: ['69ca55b9c7e397e97314c4c2', '69ca55bcce36af0f607302f5'] },
  { name: 'Abigail 粉色心機長腿微喇叭牛仔褲', imageIds: ['69ca6b8881937eaad3fab791', '69ca6b88e4759e2c0f559e94'] },
  { name: 'Vion 雙層荷葉雪紡短裙', imageIds: ['69ca49b21eab2a80d195903b', '69ca49b29ce030d057e361a6'] },
  { name: 'Vion 飄帶雪紡修身上衣', imageIds: ['69ca496f008b97dc5a65d688', '69ca496f37bdbcd0b021e023'] },
  { name: 'Urie 輕柔連帽薄針織上衣', imageIds: ['69ca4860d25c4eae03e5ca75', '69ca48601704187fd0d86312'] },
  { name: '流線金屬長鍊', imageIds: ['69ca49ea88d181856a9e5fb9', '69ca49ea8e92278421df2b39'] },
  { name: '復古風橢圓造型眼鏡', imageIds: ['69ca47fb9253ac5f950cdc99', '69ca47fbf8a326c430f22328'] },
  { name: '知性圓框造型眼鏡', imageIds: ['69ca480c50fbc9fc3b3ab4f9', '69ca480c84b29ea8fd1b8bc9'] },

  // ── Batch 2: Products 24-47 ──
  { name: 'Vera 浪漫飄逸水手領洋裝', imageIds: ['69c13e34cb219e2846d68f35', '69c13e491747d150cec0ba8a'] },
  { name: 'Serene 名媛蕾絲層次洋裝', imageIds: ['69c140b9f04a564933f21f59', '69c140b01044d4080d640ad8'] },
  { name: 'Tara 專業感假兩件洋裝', imageIds: ['69c14280fe108164e9837a66', '69c142806034076557ff84fe'] },
  { name: 'Sierra 假兩件雪紡針織襯衫', imageIds: ['69c146e7cf9ab231afb2541d', '69c146feb51bfa5a0a1c642c'] },
  { name: 'Trisha 珍珠曲線層次擺襯衫', imageIds: ['69c1478a2a3a33619837f874', '69c147d41747d17d8cc0b646'] },
  { name: 'Zeline 愛心刺繡寬鬆丹寧褲', imageIds: ['69c14ceaba076d02b8f6c7ab', '69c14cdb63cad36ad0b21437'] },
  { name: '螞蟻腰修身線條寬管西裝褲', imageIds: ['69c14f3531bca7a037d363d1', '69c14f5299c073584a241372'] },
  { name: '螞蟻腰都會修身直筒褲', imageIds: ['69c1521fa96d6491182ab509', '69c152284271a3982e1daac8'] },
  { name: 'Helen 純棉抓皺層次長裙', imageIds: ['69c105d35546138b4aaf3fdc', '69c105d3b2f1dfb7674add79'] },
  { name: 'Ginny 高腰收腹傘裙', imageIds: ['69c1063d31f868a179663a58', '69c1063d2cfa307bcfbdb375'] },
  { name: 'Rosa 溫柔荷葉邊直條襯衫', imageIds: ['69c1067644107cc54b468f82', '69c106763c0701c25f03512d'] },
  { name: 'Mielle 浪漫仙女絲巾', imageIds: ['69c106bdd2895bbcbeb64054', '69c106a92480477fde7b4ef6'] },
  { name: '古著風洞石項鏈', imageIds: ['69c1070caaf4c85cd754a0da', '69c1070ca8d8078616d33ba0'] },
  { name: 'Peyton 珠光蕾絲背心', imageIds: ['69bcdf2417003f4d965684ce', '69bcdf2584cad833df4618f6'] },
  { name: 'Rhea 精緻襯衫領層次洋裝', imageIds: ['69b80e451fd6dd3e35d8c8a6', '69b80e35b676d089e97a254d'] },
  { name: 'Quincy 氣質裹身微開衩洋裝', imageIds: ['69b80d28d1831137f627ccce', '69b80d1ed1831137f627ccc6'] },
  { name: 'Odette 優雅傘擺襯衫', imageIds: ['69b80c147a38d17216b8ca1b', '69b80c1ccc9cbc46cbca62bf'] },
  { name: 'Fiona 知性高腰打褶傘裙', imageIds: ['69b80921fe3042e80a619dbc', '69b8092bf08fc11c1b89d697'] },
  { name: 'Yves 極修身微喇叭西裝褲', imageIds: ['69b806d067a76d376e7f561b', '69b8068e407021000c29e8fb'] },
  { name: 'Lydia 都會氣質風衣外套', imageIds: ['69b804f4bc5c054961ffc715', '69b80505f618d10c36ecac4e'] },
  { name: '率性牛皮皮帶', imageIds: ['69b7c7750e8b85b679c1a122', '69b7c775950b57af723e2dda'] },
  { name: 'Xenia 顯瘦直筒牛仔褲', imageIds: ['69b7c7a9022cd8561d73898c', '69b7c7a9951a6e898cc3ab23'] },
  { name: 'Elena 氣質緞面魚尾裙', imageIds: ['69b7c7e85f01ccedd1437eaa', '69b7c7e85f01cc0da1437a6a'] },
  { name: 'Dasha 浪漫雕花紗裙', imageIds: ['69b7c86c630c31b20919a376', '69b7c86d0a9a059b94b3b607'] },

  // ── Batch 3: Products 48-71 ──
  { name: 'Nadia 垂墜感素色上衣', imageIds: ['69b7c8b31e8c488bc7f9df0b', '69b7c8b37a38d19d59b8cb48'] },
  { name: 'Minni 羊駝毛柔霧薄針織', imageIds: ['69b7c90fff4aed9170f7ab3f', '69b7c90ffb0a203b3d03c19f'] },
  { name: '粗獷鏡面開口戒', imageIds: ['69b80435883bd693aa0220bd', '69b804403aacc43b77c7889a'] },
  { name: '雙水滴Y字長項鏈', imageIds: ['69b8031ca6cf95b699f24c96', '69b80326c4c1547d199893d2'] },
  { name: 'Penelope 名媛風粗花呢洋裝', imageIds: ['69aeccd4162aa337a2d43094', '69aecd18fa617d5ff371eb42'] },
  { name: 'Olivia 優雅V領珍珠花釦洋裝', imageIds: ['69aed02b2783b88d61513c16', '69aed04c748206a51fbf403c'] },
  { name: 'Trinity 淺洗直筒牛仔褲', imageIds: ['69ae9688e20bb08c2dc5e5fd', '69ae968808098a03deb735a9'] },
  { name: 'Elena 掛脖修身羊毛背心', imageIds: ['69ae977a803528dbe6aa7de0', '69ae977a2c8ce746f6e0b36d'] },
  { name: 'Lesley 法式翻領針織上衣', imageIds: ['69ae982fb78f7e9f60c5f2d4', '69ae982f038c8d55c4b368bd'] },
  { name: 'Fanny 柔膚兩件式造型上衣', imageIds: ['69ae97e456bbd098e3dedf17', '69ae97e4ef3917c656098259'] },
  { name: 'Karly 簡約翻領短版夾克', imageIds: ['69ae9794aaffcdcea8668357', '69ae979408098ac42db74012'] },
  { name: 'Ingrid 率性立領風衣夾克', imageIds: ['69ae9699f67d2fbe5027b432', '69ae969976edc1ce6fbf3128'] },
  // Product 60 had empty name - skip
  { name: 'Grace 蕾絲拼接V領背心', imageIds: ['69a9039849bb61c04ddac1ca', '69a9039b4db1f9447890acc1'] },
  { name: 'Allie 文青格紋蛋糕裙', imageIds: ['69a904bfd9c58d57c5e13bc9', '69a904bf81a95433911cd285'] },
  { name: 'Carla 個性風花邊直筒裙', imageIds: ['69aeda4aff750d1ce79b820f', '69aeda0a08098abc47b736de'] },
  { name: 'Bridget 層次抽繩蛋糕裙', imageIds: ['69aed8f156bbd04effdee107', '69aed8f1e3f4c2d8f1ffabc8'] },
  { name: 'Y2K個性橢圓墨鏡', imageIds: ['69bd18487d7f9fb65f0f78b4', '69aedc3456bbd05fe2dedeb1'] },
  { name: '時髦多色橢圓墨鏡', imageIds: ['69aeddfa41bba89465778780', '69aea7b58f3bc8e1bdf32201'] },
  { name: '極簡圓珠長項鍊', imageIds: ['69a55780cbfeafa804acdfcb', '69a55780bca3186df585f231'] },
  { name: '簡約墨水滴項鍊', imageIds: ['69a557f3459e8d6037a15f9b', '69a557f30e0a91d7747b759e'] },
  { name: '刺繡徽章棒球帽', imageIds: ['69a63ba3c099d88d0f90da30', '69a034a4321f340012d07ea3'] },
  // Products 70-71 had empty/incomplete names - skip
]

function downloadImage(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath)
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location
        if (redirectUrl) {
          file.close()
          try { fs.unlinkSync(destPath) } catch {}
          return downloadImage(redirectUrl, destPath).then(resolve).catch(reject)
        }
      }
      if (response.statusCode !== 200) {
        file.close()
        try { fs.unlinkSync(destPath) } catch {}
        return reject(new Error(`HTTP ${response.statusCode} for ${url}`))
      }
      response.pipe(file)
      file.on('finish', () => { file.close(); resolve() })
    }).on('error', (err) => {
      file.close()
      try { fs.unlinkSync(destPath) } catch {}
      reject(err)
    })
  })
}

async function main() {
  const payload = await getPayload({ config })
  const tmpDir = path.resolve(__dirname, '../../tmp-images')
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })

  console.log(`🖼️  開始遷移 ${SHOPLINE_PRODUCTS.length} 個商品的圖片...\n`)

  let successCount = 0
  let skipCount = 0
  let failCount = 0

  for (const item of SHOPLINE_PRODUCTS) {
    if (!item.name) {
      skipCount++
      continue
    }

    // Find matching product by name (first keyword)
    const keyword = item.name.split(' ')[0]
    let productDoc = null

    // Try exact name match first
    const exact = await payload.find({
      collection: 'products',
      where: { name: { contains: item.name } },
      limit: 1,
      depth: 1,
    })

    if (exact.docs.length > 0) {
      productDoc = exact.docs[0]
    } else {
      // Try first keyword
      const byKeyword = await payload.find({
        collection: 'products',
        where: { name: { contains: keyword } },
        limit: 5,
        depth: 1,
      })
      // Pick the best match
      if (byKeyword.docs.length === 1) {
        productDoc = byKeyword.docs[0]
      } else if (byKeyword.docs.length > 1) {
        // Try to find the one with the most name overlap
        const bestMatch = byKeyword.docs.find(d => {
          const dName = (d as unknown as Record<string, unknown>).name as string
          return dName.includes(item.name.split(' ').slice(0, 2).join(' '))
        })
        productDoc = bestMatch || byKeyword.docs[0]
      }
    }

    if (!productDoc) {
      console.log(`  ⚠️  找不到商品: "${item.name}" (keyword: ${keyword})`)
      failCount++
      continue
    }

    const existingImages = ((productDoc as unknown as Record<string, unknown>).images as unknown[]) || []
    if (existingImages.length >= 2) {
      console.log(`  → ${productDoc.name || item.name} (已有 ${existingImages.length} 張圖片，跳過)`)
      skipCount++
      continue
    }
    // If product has 1 image, only add the second (hover) image
    const imageIdsToDownload = existingImages.length === 1 ? item.imageIds.slice(1) : item.imageIds

    const mediaIds: number[] = []
    const slug = ((productDoc as unknown as Record<string, unknown>).slug as string) || 'product'

    for (const imgId of imageIdsToDownload) {
      // Try multiple CDN URL patterns
      const urls = [
        `${SHOPLINE_CDN}/${imgId}/original.png`,
        `${SHOPLINE_IMG}/${imgId}/800x.webp?source_format=png`,
        `${SHOPLINE_IMG}/${imgId}/1296x.webp?source_format=png`,
      ]

      let uploaded = false
      for (const imgUrl of urls) {
        const ext = imgUrl.includes('.webp') ? 'webp' : 'png'
        const tmpFile = path.join(tmpDir, `${imgId}.${ext}`)

        try {
          console.log(`  📥 下載: ${item.name} (${imgId.substring(0, 8)}...) [${ext}]`)
          await downloadImage(imgUrl, tmpFile)

          const stats = fs.statSync(tmpFile)
          if (stats.size < 1000) {
            console.log(`  ⚠️  圖片太小 (${stats.size} bytes)，嘗試其他 URL`)
            try { fs.unlinkSync(tmpFile) } catch {}
            continue
          }

          const media = await (payload.create as Function)({
            collection: 'media',
            data: {
              alt: item.name,
              caption: item.name,
            },
            file: {
              data: fs.readFileSync(tmpFile),
              mimetype: ext === 'webp' ? 'image/webp' : 'image/png',
              name: `${slug}-${imgId.substring(0, 8)}.${ext}`,
              size: stats.size,
            },
          })

          mediaIds.push(media.id)
          console.log(`  ✅ 已上傳: media ID ${media.id} (${(stats.size / 1024).toFixed(0)} KB)`)
          try { fs.unlinkSync(tmpFile) } catch {}
          uploaded = true
          break // Success, skip other URL patterns
        } catch (err: unknown) {
          console.log(`  ⚠️  ${ext} 失敗: ${(err as Error).message.substring(0, 60)}`)
          try { fs.unlinkSync(tmpFile) } catch {}
        }
      }

      if (!uploaded) {
        console.log(`  ❌ 所有 URL 都失敗: ${imgId}`)
      }
    }

    if (mediaIds.length > 0) {
      try {
        // Preserve existing images and append new ones
        const existingMediaIds = existingImages.map((img: unknown) => {
          const imgObj = img as Record<string, unknown>
          const imgField = imgObj.image
          return typeof imgField === 'number' ? imgField : (imgField as Record<string, unknown>)?.id as number
        }).filter(Boolean)

        const allImages = [...existingMediaIds, ...mediaIds].map(id => ({ image: id }))

        await (payload.update as Function)({
          collection: 'products',
          id: productDoc.id,
          data: { images: allImages },
        })
        console.log(`  🔗 已關聯 ${mediaIds.length} 張新圖片到: ${productDoc.name || item.name} (共 ${allImages.length} 張)\n`)
        successCount++
      } catch (err: unknown) {
        console.log(`  ❌ 關聯失敗: ${(err as Error).message}\n`)
        failCount++
      }
    } else {
      failCount++
    }
  }

  // Cleanup
  try { fs.rmSync(tmpDir, { recursive: true }) } catch {}

  console.log(`\n${'═'.repeat(50)}`)
  console.log(`✅ 完成！`)
  console.log(`  成功: ${successCount}`)
  console.log(`  跳過: ${skipCount} (已有圖片或無名稱)`)
  console.log(`  失敗: ${failCount}`)
  console.log(`${'═'.repeat(50)}`)

  process.exit(0)
}

main().catch((e) => {
  console.error('❌ 腳本錯誤:', e.message)
  process.exit(1)
})
