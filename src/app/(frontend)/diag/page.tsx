/**
 * /diag — iPad / Safari 隱私診斷頁
 * ────────────────────────────────
 * 用途：當使用者回報「iPad 白屏」時，請他們在 iPad Safari 直接打開
 *   https://testshop.ckmu.co/diag
 * 截圖回傳。這個頁面：
 * 1. 不依賴 layout.tsx 的任何 client provider（自己一個簡化版）。
 *    所以即使 SessionProvider / GTM / framer-motion 之類在主站炸掉，
 *    /diag 還是會渲染。
 * 2. 純 client component，所有檢測都在 browser 端做。
 * 3. 把 window.__ckmuPriv（layout 注入的 polyfill diagnostic）讀出來
 *    並顯示，讓我們知道 iOS Safari 的 storage 是不是被擋住，以及
 *    polyfill 有沒有成功接管。
 * 4. 印出 navigator.userAgent / navigator.cookieEnabled 等資訊。
 *
 * 此頁面刻意 inline 樣式、不使用 Tailwind class、不 import 任何
 * 共用元件，以避免外部 chunk crash 連帶讓診斷頁也壞掉。
 */
import { DiagClient } from './DiagClient'

export const dynamic = 'force-dynamic'

export default function DiagPage() {
  return <DiagClient />
}
