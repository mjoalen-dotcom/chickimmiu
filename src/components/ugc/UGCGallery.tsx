'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, MessageCircle, ShoppingBag, Instagram, X, Play } from 'lucide-react'

/**
 * UGC 社群內容展示元件
 * 支援版型：格狀/瀑布/幻燈片/精選動態/導購櫥窗/導購影音
 */

interface UGCItem {
  id: string
  authorName: string
  authorHandle: string
  authorAvatar?: string
  platform: 'instagram' | 'facebook' | 'tiktok'
  contentType: 'image' | 'video' | 'carousel' | 'reel'
  image: string
  caption?: string
  likes: number
  comments: number
  externalUrl?: string
  taggedProducts?: { slug: string; name: string; price: number; image: string }[]
}

// Demo data
const DEMO_UGC: UGCItem[] = [
  {
    id: '1',
    authorName: 'Mia Style',
    authorHandle: '@mia_style_tw',
    platform: 'instagram',
    contentType: 'image',
    image: 'https://shoplineimg.com/559df3efe37ec64e9f000092/69c140b9f04a564933f21f59/1500x.webp?source_format=png',
    caption: '今天穿 @chickimmiu 的蕾絲洋裝去參加閨蜜婚禮',
    likes: 342,
    comments: 28,
    taggedProducts: [{ slug: 'serene-elegant-lace-layered-dress', name: 'Serene 名媛蕾絲洋裝', price: 2980, image: 'https://shoplineimg.com/559df3efe37ec64e9f000092/69c140b9f04a564933f21f59/1500x.webp?source_format=png' }],
  },
  {
    id: '2',
    authorName: 'KK Fashion',
    authorHandle: '@kk.fashion',
    platform: 'instagram',
    contentType: 'image',
    image: 'https://shoplineimg.com/559df3efe37ec64e9f000092/69aea7b58f3bc8e1bdf32201/1500x.webp?source_format=png',
    caption: '約會穿搭 OOTD',
    likes: 218,
    comments: 15,
    taggedProducts: [{ slug: 'amelia-elegant-tulle-button-dress', name: 'Amelia 疊紗洋裝', price: 2680, image: 'https://shoplineimg.com/559df3efe37ec64e9f000092/69aea7b58f3bc8e1bdf32201/1500x.webp?source_format=png' }],
  },
  {
    id: '3',
    authorName: 'Lin 穿搭日記',
    authorHandle: '@lin.daily',
    platform: 'instagram',
    contentType: 'image',
    image: 'https://shoplineimg.com/559df3efe37ec64e9f000092/69c1521fa96d6491182ab509/1500x.webp?source_format=png',
    caption: '上班穿搭 直筒褲超顯瘦！',
    likes: 156,
    comments: 12,
    taggedProducts: [{ slug: 'ant-waist-urban-straight-pants', name: '螞蟻腰修身直筒褲', price: 1480, image: 'https://shoplineimg.com/559df3efe37ec64e9f000092/69c1521fa96d6491182ab509/1500x.webp?source_format=png' }],
  },
  {
    id: '4',
    authorName: 'Summer Girl',
    authorHandle: '@summer.girl.tw',
    platform: 'instagram',
    contentType: 'image',
    image: 'https://shoplineimg.com/559df3efe37ec64e9f000092/69b8e8ecf7cad647346583b3/1500x.webp?source_format=png',
    caption: '氣質洋裝 怎麼穿都美',
    likes: 289,
    comments: 22,
    taggedProducts: [{ slug: 'quincy-elegant-wrap-slit-dress', name: 'Quincy 裹身洋裝', price: 2680, image: 'https://shoplineimg.com/559df3efe37ec64e9f000092/69b8e8ecf7cad647346583b3/1500x.webp?source_format=png' }],
  },
  {
    id: '5',
    authorName: 'Amy Chen',
    authorHandle: '@amychen.style',
    platform: 'instagram',
    contentType: 'image',
    image: 'https://shoplineimg.com/559df3efe37ec64e9f000092/69bd18487d7f9fb65f0f78b4/1500x.webp?source_format=png',
    caption: 'Y2K 風回歸！墨鏡是穿搭加分神器',
    likes: 198,
    comments: 9,
    taggedProducts: [{ slug: 'y2k-oval-sunglasses', name: 'Y2K橢圓墨鏡', price: 780, image: 'https://shoplineimg.com/559df3efe37ec64e9f000092/69bd18487d7f9fb65f0f78b4/1500x.webp?source_format=png' }],
  },
  {
    id: '6',
    authorName: 'Chloe W',
    authorHandle: '@chloe.wardrobe',
    platform: 'instagram',
    contentType: 'image',
    image: 'https://shoplineimg.com/559df3efe37ec64e9f000092/69aeddfa41bba89465778780/1500x.webp?source_format=png',
    caption: '時髦墨鏡穿搭分享',
    likes: 167,
    comments: 11,
    taggedProducts: [{ slug: 'trendy-multicolor-oval-sunglasses', name: '時髦多色墨鏡', price: 780, image: 'https://shoplineimg.com/559df3efe37ec64e9f000092/69aeddfa41bba89465778780/1500x.webp?source_format=png' }],
  },
]

type LayoutType = 'grid' | 'masonry' | 'carousel' | 'shoppable_gallery'

interface Props {
  layout?: LayoutType
  maxItems?: number
  showHeader?: boolean
  title?: string
}

export function UGCGallery({ layout = 'grid', maxItems = 6, showHeader = true, title = '穿搭靈感' }: Props) {
  const [selectedItem, setSelectedItem] = useState<UGCItem | null>(null)
  const items = DEMO_UGC.slice(0, maxItems)

  return (
    <section>
      {showHeader && (
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs tracking-[0.3em] text-gold-500 mb-2">STYLE INSPIRATION</p>
            <h2 className="text-2xl md:text-3xl font-serif">{title}</h2>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Instagram size={14} />
            #chickimmiu
          </div>
        </div>
      )}

      {/* Grid layout */}
      {layout === 'grid' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          {items.map((item) => (
            <UGCCard key={item.id} item={item} onClick={() => setSelectedItem(item)} />
          ))}
        </div>
      )}

      {/* Masonry layout */}
      {layout === 'masonry' && (
        <div className="columns-2 md:columns-3 gap-3 md:gap-4 space-y-3 md:space-y-4">
          {items.map((item, i) => (
            <div key={item.id} className={i % 3 === 0 ? 'break-inside-avoid' : 'break-inside-avoid'}>
              <UGCCard item={item} onClick={() => setSelectedItem(item)} aspectRatio={i % 3 === 0 ? '4/5' : '3/4'} />
            </div>
          ))}
        </div>
      )}

      {/* Shoppable gallery */}
      {layout === 'shoppable_gallery' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          {items.map((item) => (
            <div key={item.id} className="group">
              <UGCCard item={item} onClick={() => setSelectedItem(item)} />
              {item.taggedProducts && item.taggedProducts.length > 0 && (
                <div className="mt-2 flex items-center gap-2 px-1">
                  <ShoppingBag size={12} className="text-gold-500" />
                  <Link
                    href={`/products/${item.taggedProducts[0].slug}`}
                    className="text-xs text-foreground/70 hover:text-gold-600 truncate transition-colors"
                  >
                    {item.taggedProducts[0].name} — NT$ {item.taggedProducts[0].price.toLocaleString()}
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Carousel layout */}
      {layout === 'carousel' && (
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
          {items.map((item) => (
            <div key={item.id} className="min-w-[240px] md:min-w-[280px] snap-start">
              <UGCCard item={item} onClick={() => setSelectedItem(item)} />
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={() => setSelectedItem(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl overflow-hidden max-w-lg w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative aspect-square">
                <Image
                  src={selectedItem.image}
                  alt={selectedItem.authorName}
                  fill
                  className="object-cover"
                  unoptimized
                />
                <button
                  onClick={() => setSelectedItem(null)}
                  className="absolute top-3 right-3 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-cream-200 flex items-center justify-center text-xs font-medium">
                    {selectedItem.authorName.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{selectedItem.authorName}</p>
                    <p className="text-xs text-muted-foreground">{selectedItem.authorHandle}</p>
                  </div>
                </div>
                {selectedItem.caption && (
                  <p className="text-sm text-foreground/80 mb-3">{selectedItem.caption}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                  <span className="flex items-center gap-1"><Heart size={12} /> {selectedItem.likes}</span>
                  <span className="flex items-center gap-1"><MessageCircle size={12} /> {selectedItem.comments}</span>
                </div>

                {/* Tagged products */}
                {selectedItem.taggedProducts && selectedItem.taggedProducts.length > 0 && (
                  <div className="border-t border-cream-200 pt-3">
                    <p className="text-xs text-muted-foreground mb-2">穿搭商品</p>
                    {selectedItem.taggedProducts.map((p) => (
                      <Link
                        key={p.slug}
                        href={`/products/${p.slug}`}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-cream-50 transition-colors"
                      >
                        <div className="w-12 h-12 rounded-lg overflow-hidden relative shrink-0 border border-cream-200">
                          <Image src={p.image} alt={p.name} fill className="object-cover" sizes="48px" unoptimized />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{p.name}</p>
                          <p className="text-xs text-gold-600">NT$ {p.price.toLocaleString()}</p>
                        </div>
                        <ShoppingBag size={16} className="text-gold-500 shrink-0" />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

function UGCCard({ item, onClick, aspectRatio = '1/1' }: { item: UGCItem; onClick: () => void; aspectRatio?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative rounded-xl overflow-hidden border border-cream-200 w-full text-left"
      style={{ aspectRatio }}
    >
      <Image
        src={item.image}
        alt={item.authorName}
        fill
        className="object-cover group-hover:scale-105 transition-transform duration-500"
        sizes="(max-width: 768px) 50vw, 33vw"
        unoptimized
      />
      {/* Overlay on hover */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
        <div className="flex items-center gap-4 text-white text-sm">
          <span className="flex items-center gap-1"><Heart size={16} /> {item.likes}</span>
          <span className="flex items-center gap-1"><MessageCircle size={16} /> {item.comments}</span>
        </div>
      </div>
      {/* Video indicator */}
      {(item.contentType === 'video' || item.contentType === 'reel') && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center">
          <Play size={12} className="text-white ml-0.5" />
        </div>
      )}
      {/* Product tag indicator */}
      {item.taggedProducts && item.taggedProducts.length > 0 && (
        <div className="absolute bottom-2 left-2">
          <ShoppingBag size={14} className="text-white drop-shadow-lg" />
        </div>
      )}
    </button>
  )
}
