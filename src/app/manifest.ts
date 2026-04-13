import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CHIC KIM & MIU｜韓系質感女裝',
    short_name: 'CHIC KIM & MIU',
    description: '融合高級極簡優雅與韓系可愛活力的台灣女裝品牌',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#FAFAF7',
    theme_color: '#C19A5B',
    orientation: 'portrait-primary',
    categories: ['shopping', 'fashion', 'lifestyle'],
    lang: 'zh-Hant-TW',
    dir: 'ltr',
    icons: [
      { src: '/images/logo-icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
