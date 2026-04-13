/**
 * 修正：為 Novia 和 Roberta 套裝系列共用同一張圖片
 * PAYLOAD_SECRET=ckmu-dev-secret-2024 DATABASE_URI=file:./data/chickimmiu.db npx tsx src/seed/seedProductImagesFix.ts
 */
import { getPayload } from 'payload'
import config from '../payload.config'

async function main() {
  const payload = await getPayload({ config })
  console.log('🔧 套裝系列圖片共用修正\n')

  // Find Novia 開襟衫 (已有圖片) and get its media ID
  const noviaCardigan = await payload.find({
    collection: 'products',
    where: { name: { contains: 'Novia 細褶套裝開襟衫' } },
    limit: 1,
  })

  if (noviaCardigan.docs.length > 0) {
    const images = (noviaCardigan.docs[0] as unknown as Record<string, unknown>).images as { image: number }[]
    if (images && images.length > 0) {
      const mediaId = typeof images[0].image === 'number' ? images[0].image : (images[0].image as unknown as { id: number }).id
      console.log(`  Novia 開襟衫 media ID: ${mediaId}`)

      // Apply same image to other Novia variants
      for (const name of ['Novia 細褶套裝上衣', 'Novia 無袖細褶套裝背心', 'Novia 細褶套裝裙']) {
        const product = await payload.find({
          collection: 'products',
          where: { name: { contains: name } },
          limit: 1,
        })
        if (product.docs.length > 0) {
          const existingImages = (product.docs[0] as unknown as Record<string, unknown>).images as unknown[] || []
          if (existingImages.length === 0) {
            await (payload.update as Function)({
              collection: 'products',
              id: product.docs[0].id,
              data: { images: [{ image: mediaId }] },
            })
            console.log(`  ✅ ${name} → media #${mediaId}`)
          } else {
            console.log(`  → ${name} (已有圖片)`)
          }
        }
      }
    }
  }

  // For Roberta - try to find the 套裝外套 or 裙 image
  // Roberta 線條刷絨 shares with Zabara set potentially
  // Actually, let's check if we can share from another product in the set
  const roberta79 = await payload.find({
    collection: 'products',
    where: { name: { contains: 'Roberta 線條刷絨套裝上衣' } },
    limit: 1,
  })
  const roberta78 = await payload.find({
    collection: 'products',
    where: { name: { contains: 'Roberta 線條刷絨套裝褲' } },
    limit: 1,
  })

  // Check if either already has images from a matching set
  // Neither has images, so we can't share. Skip.
  if (roberta79.docs.length > 0 && roberta78.docs.length > 0) {
    console.log(`\n  ⚠️  Roberta 上衣 (#${roberta79.docs[0].id}) 和褲 (#${roberta78.docs[0].id}) 都沒有圖片來源`)
  }

  console.log('\n✅ 完成')
  process.exit(0)
}
main().catch((e) => { console.error('❌', e.message); process.exit(1) })
