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
 *   3. Sidebar 9 個 group 在 toggle button 左側加 lucide 圖示
 *      （透過 mask-image，自動跟著 currentColor 走主題色）。
 *   4. 色弱無障礙（2026-07-30 使用者要求）：全後台邊線加深。色弱使用者靠
 *      「明度對比」而非色相分辨界線，Payload 預設 elevation-100~200 的淺灰
 *      邊線幾乎看不見。三管齊下：
 *      a) 把 --theme-elevation-150/200 兩級（幾乎只被拿來當 border）改成
 *         中灰 — 38 個自訂 admin 元件的 inline 邊線一次全部生效；
 *      b) 原生元素（input / card / table / pill …）直接上 !important
 *         border-color（!important 才蓋得過元件 inline style）；
 *      c) Dashboard.tsx 的 BORDER 常數同步加深（該檔自成一套色票）。
 */

// Lucide static SVG paths (24x24, no stroke color → mask-image 取 currentColor)。
// 來源：https://lucide.dev — 對 `LayoutDashboard` `ShoppingBag` 等 icon
// 直接 export-svg 取裡面的 children paths。
const lucideMask = (paths: string) =>
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E${paths.replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E').replace(/"/g, "'")}%3C/svg%3E")`

const ICON_DASHBOARD = lucideMask(
  "<rect width='7' height='9' x='3' y='3' rx='1'/><rect width='7' height='5' x='14' y='3' rx='1'/><rect width='7' height='9' x='14' y='12' rx='1'/><rect width='7' height='5' x='3' y='16' rx='1'/>",
)
const ICON_FEATHER = lucideMask(
  "<path d='M12.67 19a2 2 0 0 0 1.416-.588l6.154-6.172a6 6 0 0 0-8.49-8.49L5.586 9.914A2 2 0 0 0 5 11.328V18a1 1 0 0 0 1 1z'/><path d='M16 8 2 22'/><path d='M17.5 15H9'/>",
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
    /* ── Blocks/Collapsible 區塊標題列高度修正 ──────────────────────
       blocks 欄位（如 Pages 的「頁面區塊」）每個區塊用 collapsible 呈現，
       其 .collapsible__toggle-wrap 預設 line-height 過小，標題列被擠壓、
       「01 富文字區塊…」之類的列看起來空間不足/重疊。拉到 30px 即正常。 */
    .collapsible__toggle-wrap { line-height: 30px !important; }

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

    /* ── 色弱無障礙：邊線全面加深 ─────────────────────────────────
       只動邊線相關色，不動主要背景。150/200 兩級在本專案幾乎只作
       border 用（僅 2 處背景：進度條軌道 / chip，變深無妨）；深淺主題
       都蓋掉 — 中灰在亮暗底上都有足夠明度對比。 */
    html[data-theme='light'], html[data-theme='dark'] {
      --theme-elevation-150: #a9a9a9;
      --theme-elevation-200: #8f8f8f;
    }

    /* 表單控件：邊線加深；聚焦時外框加粗更易定位 */
    .field-type input, .field-type textarea, .field-type select,
    input[type='text'], input[type='email'], input[type='password'],
    input[type='number'], input[type='search'], textarea, select {
      border-color: var(--theme-elevation-400, #9a9a9a) !important;
    }
    .field-type input:focus-visible, .field-type textarea:focus-visible,
    .field-type select:focus-visible {
      outline: 2px solid var(--theme-elevation-600, #6b6b6b) !important;
      outline-offset: 1px;
    }
    .react-select .rs__control, [class*='react-select'] [class*='control'] {
      border-color: var(--theme-elevation-400, #9a9a9a) !important;
    }

    /* 卡片 / 折疊區塊 / 次要按鈕 / pill：外框加深 */
    .card, .collapsible__toggle-wrap, .btn--style-secondary, .pill,
    .checkbox-input__input {
      border-color: var(--theme-elevation-400, #9a9a9a) !important;
    }

    /* 列表表格：行分隔線 + 表頭底線加深 */
    .table th { border-bottom: 2px solid var(--theme-elevation-400, #9a9a9a) !important; }
    .table td { border-bottom: 1px solid var(--theme-elevation-300, #b0b0b0) !important; }

    /* 分頁籤底線 / 一般分隔線 */
    .tabs-field__tabs, hr {
      border-color: var(--theme-elevation-300, #b0b0b0) !important;
    }

    /* Sidebar：group 標題底下加分隔線，群組界線一目了然 */
    .nav-group__toggle {
      border-bottom: 1px solid var(--theme-elevation-250, #bdbdbd);
    }

    /* Ⓚ + ① ~ ⑦ Payload 原生 group — 用 group label 子字串匹配 */
    .nav-group[class*="金老佛爺"] > .nav-group__toggle::before { -webkit-mask-image: ${ICON_FEATHER}; mask-image: ${ICON_FEATHER}; }
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
