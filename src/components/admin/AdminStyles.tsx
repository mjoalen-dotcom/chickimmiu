import React from 'react'

/**
 * AdminStyles — 後台全域 CSS 微調，透過 admin.components.beforeNavLinks 注入。
 *
 * 雖然掛在 sidebar，但 <style> 在 DOM 任何位置都全域生效。單純 CSS 不產生
 * runtime 額外負擔，也不需要 client component。
 *
 * 處理項目：
 *   1. Breadcrumb：AdminIcon 跟第一個 `/` 分隔符擠在一起、被右側控制區色塊
 *      蓋住。加左側間距 + 加大分隔符左右 margin。
 *   2. 使用說明 hover 樣式：配合 HelpNavLink.tsx 的 .ckmu-help-nav-link class。
 *   3. Sidebar 8 個 group 在 toggle button 左側加 lucide 圖示
 *      （透過 mask-image，自動跟著 currentColor 走主題色）。
 */

// Lucide static SVG paths (24x24, no stroke color → mask-image 取 currentColor)。
// 來源：https://lucide.dev — 對 `LayoutDashboard` `ShoppingBag` 等 icon
// 直接 export-svg 取裡面的 children paths。
const lucideMask = (paths: string) =>
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E${paths.replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E').replace(/"/g, "'")}%3C/svg%3E")`

const ICON_DASHBOARD = lucideMask(
  "<rect width='7' height='9' x='3' y='3' rx='1'/><rect width='7' height='5' x='14' y='3' rx='1'/><rect width='7' height='9' x='14' y='12' rx='1'/><rect width='7' height='5' x='3' y='16' rx='1'/>",
)
const ICON_ORDERS = lucideMask(
  "<path d='M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z'/><path d='M3 6h18'/><path d='M16 10a4 4 0 0 1-8 0'/>",
)
const ICON_PRODUCTS = lucideMask(
  "<path d='M16.5 9.4 7.55 4.24'/><path d='M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z'/><path d='M3.27 6.96 12 12.01l8.73-5.05'/><path d='M12 22.08V12'/>",
)
const ICON_USERS = lucideMask(
  "<path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2'/><circle cx='9' cy='7' r='4'/><path d='M22 21v-2a4 4 0 0 0-3-3.87'/><path d='M16 3.13a4 4 0 0 1 0 7.75'/>",
)
const ICON_MARKETING = lucideMask(
  "<path d='m3 11 18-5v12L3 14v-3z'/><path d='M11.6 16.8a3 3 0 1 1-5.8-1.6'/>",
)
const ICON_GAMEPAD = lucideMask(
  "<line x1='6' x2='10' y1='11' y2='11'/><line x1='8' x2='8' y1='9' y2='13'/><line x1='15' x2='15.01' y1='12' y2='12'/><line x1='18' x2='18.01' y1='10' y2='10'/><path d='M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z'/>",
)
const ICON_TEMPLATE = lucideMask(
  "<rect width='18' height='7' x='3' y='3' rx='1'/><rect width='9' height='7' x='3' y='14' rx='1'/><rect width='5' height='7' x='16' y='14' rx='1'/>",
)
const ICON_SETTINGS = lucideMask(
  "<path d='M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z'/><circle cx='12' cy='12' r='3'/>",
)

export default function AdminStyles() {
  const css = `
    /* ── Breadcrumb 推右 + 分隔符留白（對應使用者 B 議題） ───────── */
    .step-nav { margin-left: 16px; }
    .step-nav__separator,
    [class*="stepNav"] [class*="separator"] { margin: 0 10px !important; }
    .step-nav a,
    .step-nav span { white-space: nowrap; }

    /* 若 Payload 用 CSS module hashed class，退一步用 attribute selector */
    header [class*="step-nav"] { margin-left: 16px; }

    /* ── HelpNavLink hover/focus（legacy；保留以防舊 cache） ────── */
    .ckmu-help-nav-link:hover,
    .ckmu-help-nav-link:focus-visible {
      background: var(--theme-elevation-100, rgba(255,255,255,0.06)) !important;
      border-color: var(--theme-elevation-150, rgba(255,255,255,0.1)) !important;
      color: var(--theme-elevation-900, #fff) !important;
      outline: none;
    }

    /* ── Sidebar group icons：每個 .nav-group__toggle 左側加 lucide 圖示 ─── */
    .nav-group__toggle::before {
      content: '';
      display: inline-block;
      width: 18px;
      height: 18px;
      margin-right: 8px;
      vertical-align: -3px;
      background-color: currentColor;
      -webkit-mask-size: contain;
      mask-size: contain;
      -webkit-mask-repeat: no-repeat;
      mask-repeat: no-repeat;
      -webkit-mask-position: center;
      mask-position: center;
      opacity: 0.85;
    }

    /* ⓪ 數據儀表 — 自訂 group，固定 class */
    .ckmu-dashboard-group > .nav-group__toggle::before { -webkit-mask-image: ${ICON_DASHBOARD}; mask-image: ${ICON_DASHBOARD}; }

    /* ① ~ ⑦ Payload 原生 group — 用 group label 子字串匹配 */
    .nav-group[class*="① 訂單"] > .nav-group__toggle::before { -webkit-mask-image: ${ICON_ORDERS}; mask-image: ${ICON_ORDERS}; }
    .nav-group[class*="② 商品"] > .nav-group__toggle::before { -webkit-mask-image: ${ICON_PRODUCTS}; mask-image: ${ICON_PRODUCTS}; }
    .nav-group[class*="③ 會員"] > .nav-group__toggle::before { -webkit-mask-image: ${ICON_USERS}; mask-image: ${ICON_USERS}; }
    .nav-group[class*="④ 行銷"] > .nav-group__toggle::before { -webkit-mask-image: ${ICON_MARKETING}; mask-image: ${ICON_MARKETING}; }
    .nav-group[class*="⑤ 互動"] > .nav-group__toggle::before { -webkit-mask-image: ${ICON_GAMEPAD}; mask-image: ${ICON_GAMEPAD}; }
    .nav-group[class*="⑥ 內容"] > .nav-group__toggle::before { -webkit-mask-image: ${ICON_TEMPLATE}; mask-image: ${ICON_TEMPLATE}; }
    .nav-group[class*="⑦ 系統"] > .nav-group__toggle::before { -webkit-mask-image: ${ICON_SETTINGS}; mask-image: ${ICON_SETTINGS}; }
  `
  return <style dangerouslySetInnerHTML={{ __html: css }} />
}
