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
 */
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

    /* ── HelpNavLink hover/focus（對應使用者 D 議題） ──────────── */
    .ckmu-help-nav-link:hover,
    .ckmu-help-nav-link:focus-visible {
      background: var(--theme-elevation-100, rgba(255,255,255,0.06)) !important;
      border-color: var(--theme-elevation-150, rgba(255,255,255,0.1)) !important;
      color: var(--theme-elevation-900, #fff) !important;
      outline: none;
    }
  `
  return <style dangerouslySetInnerHTML={{ __html: css }} />
}
