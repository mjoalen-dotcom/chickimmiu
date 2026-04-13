/**
 * CHIC KIM & MIU — 網站架構與使用手冊 HTML 產生器
 * ────────────────────────────────────────────────
 * 產出：public/docs/manual.html
 * 執行：npx tsx src/seed/generateManual.ts
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const OUTPUT_DIR = path.resolve(__dirname, '../../public/docs')
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'manual.html')

function generateHTML(): string {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CHIC KIM &amp; MIU — 網站架構說明與使用手冊</title>
<style>
/* ── Google Fonts ── */
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700;900&family=Noto+Serif+TC:wght@400;700&display=swap');

/* ── CSS Variables ── */
:root {
  --cream: #F8F1E9;
  --gold: #C19A5B;
  --gold-light: #D4B882;
  --gold-dark: #A07D3F;
  --dark: #2C2C2C;
  --dark-light: #4A4A4A;
  --text: #333333;
  --text-light: #666666;
  --border: #E8DDD0;
  --bg-light: #FDFAF5;
  --white: #FFFFFF;
  --red: #C0392B;
  --green: #27AE60;
  --blue: #2980B9;
}

/* ── Reset & Base ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html { font-size: 15px; }

body {
  font-family: 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif;
  color: var(--text);
  background: var(--white);
  line-height: 1.8;
  -webkit-font-smoothing: antialiased;
}

/* ── Page Container ── */
.page {
  max-width: 210mm;
  margin: 0 auto;
  padding: 30mm 25mm;
}

/* ── Cover Page ── */
.cover {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  text-align: center;
  background: linear-gradient(180deg, var(--cream) 0%, var(--white) 100%);
  padding: 60px 40px;
}

.cover-logo {
  margin-bottom: 40px;
}

.cover-logo svg {
  width: 180px;
  height: auto;
}

.cover h1 {
  font-family: 'Noto Serif TC', serif;
  font-size: 2.4rem;
  font-weight: 700;
  color: var(--dark);
  letter-spacing: 4px;
  margin-bottom: 12px;
}

.cover .subtitle {
  font-size: 1.1rem;
  color: var(--gold);
  font-weight: 500;
  letter-spacing: 6px;
  margin-bottom: 40px;
}

.cover .doc-title {
  font-family: 'Noto Serif TC', serif;
  font-size: 1.8rem;
  color: var(--dark);
  border-top: 2px solid var(--gold);
  border-bottom: 2px solid var(--gold);
  padding: 20px 40px;
  margin-bottom: 40px;
  letter-spacing: 2px;
}

.cover .meta {
  font-size: 0.9rem;
  color: var(--text-light);
  line-height: 2;
}

.cover .meta strong {
  color: var(--dark);
}

.gold-divider {
  width: 60px;
  height: 2px;
  background: var(--gold);
  margin: 30px auto;
}

/* ── Table of Contents ── */
.toc {
  padding: 40px;
}

.toc h2 {
  font-family: 'Noto Serif TC', serif;
  font-size: 1.6rem;
  color: var(--dark);
  text-align: center;
  margin-bottom: 30px;
  letter-spacing: 4px;
}

.toc-list {
  list-style: none;
  counter-reset: toc-counter;
}

.toc-list > li {
  counter-increment: toc-counter;
  margin-bottom: 8px;
}

.toc-list > li > a {
  display: flex;
  align-items: baseline;
  text-decoration: none;
  color: var(--text);
  font-size: 1rem;
  padding: 6px 0;
  border-bottom: 1px dotted var(--border);
  transition: color 0.2s;
}

.toc-list > li > a:hover {
  color: var(--gold);
}

.toc-list > li > a::before {
  content: counter(toc-counter, decimal-leading-zero) ".";
  font-weight: 700;
  color: var(--gold);
  min-width: 40px;
  margin-right: 12px;
}

.toc-list > li > a .toc-title {
  flex: 1;
}

.toc-list > li > a .toc-page {
  color: var(--gold);
  font-weight: 500;
  margin-left: 8px;
  white-space: nowrap;
}

/* ── Section Headings ── */
.section {
  padding: 40px;
  page-break-before: always;
}

.section:first-of-type {
  page-break-before: auto;
}

.section-number {
  display: inline-block;
  background: var(--gold);
  color: var(--white);
  font-size: 0.8rem;
  font-weight: 700;
  padding: 4px 14px;
  border-radius: 20px;
  letter-spacing: 2px;
  margin-bottom: 10px;
}

h2.section-title {
  font-family: 'Noto Serif TC', serif;
  font-size: 1.6rem;
  color: var(--dark);
  margin-bottom: 8px;
  letter-spacing: 2px;
  border-bottom: 2px solid var(--gold);
  padding-bottom: 10px;
}

h3 {
  font-size: 1.15rem;
  color: var(--dark);
  margin-top: 28px;
  margin-bottom: 12px;
  padding-left: 14px;
  border-left: 3px solid var(--gold);
}

h4 {
  font-size: 1rem;
  color: var(--gold-dark);
  margin-top: 20px;
  margin-bottom: 8px;
}

p {
  margin-bottom: 12px;
  text-align: justify;
}

/* ── Tables ── */
table {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0 24px;
  font-size: 0.9rem;
}

thead th {
  background: var(--dark);
  color: var(--white);
  font-weight: 500;
  padding: 10px 12px;
  text-align: left;
  letter-spacing: 1px;
}

tbody td {
  padding: 9px 12px;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}

tbody tr:nth-child(even) {
  background: var(--bg-light);
}

tbody tr:hover {
  background: #F5EDE0;
}

/* ── Info Boxes ── */
.info-box {
  background: var(--bg-light);
  border-left: 4px solid var(--gold);
  padding: 16px 20px;
  margin: 16px 0;
  border-radius: 0 8px 8px 0;
}

.info-box.warning {
  border-left-color: var(--red);
  background: #FDF2F0;
}

.info-box.success {
  border-left-color: var(--green);
  background: #F0FDF4;
}

.info-box .box-title {
  font-weight: 700;
  font-size: 0.95rem;
  margin-bottom: 4px;
}

.info-box p {
  margin-bottom: 4px;
  font-size: 0.9rem;
}

/* ── Code blocks ── */
code {
  background: #F0EBE3;
  color: var(--dark);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.85em;
  font-family: 'Consolas', 'Monaco', monospace;
}

pre {
  background: var(--dark);
  color: #E8DDD0;
  padding: 16px 20px;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 0.85rem;
  line-height: 1.6;
  margin: 16px 0;
}

pre code {
  background: none;
  color: inherit;
  padding: 0;
}

/* ── Lists ── */
ul, ol {
  margin: 8px 0 16px 24px;
}

li {
  margin-bottom: 4px;
}

/* ── Flow diagrams ── */
.flow-diagram {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0;
  margin: 20px 0;
  font-size: 0.9rem;
}

.flow-step {
  background: var(--cream);
  border: 1px solid var(--gold);
  padding: 8px 16px;
  border-radius: 8px;
  text-align: center;
  font-weight: 500;
  min-width: 90px;
}

.flow-step.active {
  background: var(--gold);
  color: var(--white);
}

.flow-arrow {
  color: var(--gold);
  font-size: 1.2rem;
  margin: 0 4px;
  font-weight: 700;
}

/* ── Architecture Diagram ── */
.arch-diagram {
  background: var(--bg-light);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  margin: 20px 0;
  text-align: center;
  font-family: 'Consolas', monospace;
  font-size: 0.85rem;
  line-height: 1.5;
  white-space: pre;
  overflow-x: auto;
}

/* ── Badge / Tag ── */
.tag {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
  margin: 2px 4px 2px 0;
}

.tag-gold { background: #F5EDE0; color: var(--gold-dark); }
.tag-dark { background: #E8E8E8; color: var(--dark); }
.tag-green { background: #E8F8E8; color: #1B7A3D; }
.tag-red { background: #FDE8E8; color: #9B2C2C; }
.tag-blue { background: #E8F0F8; color: #1A5276; }

/* ── Tier Badges ── */
.tier-card {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-light);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 16px;
  margin: 4px;
  font-size: 0.9rem;
}

.tier-card .tier-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

/* ── Footer ── */
.page-footer {
  text-align: center;
  font-size: 0.75rem;
  color: var(--text-light);
  padding-top: 30px;
  margin-top: 40px;
  border-top: 1px solid var(--border);
}

/* ── Print Styles ── */
@media print {
  @page {
    size: A4;
    margin: 20mm 18mm;
  }

  html { font-size: 12px; }

  body {
    background: white;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page {
    max-width: none;
    padding: 0;
  }

  .cover {
    min-height: auto;
    height: 100vh;
    padding: 40px;
    page-break-after: always;
  }

  .toc {
    page-break-after: always;
  }

  .section {
    page-break-before: always;
    padding: 0;
  }

  h2.section-title, h3 {
    page-break-after: avoid;
  }

  table, .info-box, .arch-diagram {
    page-break-inside: avoid;
  }

  pre {
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  .no-print { display: none; }
}

/* ── Category tree ── */
.cat-tree {
  margin: 12px 0 20px 0;
}

.cat-tree .cat-parent {
  font-weight: 700;
  color: var(--dark);
  padding: 6px 0;
}

.cat-tree .cat-children {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-left: 24px;
  margin-bottom: 8px;
}
</style>
</head>
<body>

<!-- ════════════════════════════════════════════ -->
<!-- COVER PAGE                                  -->
<!-- ════════════════════════════════════════════ -->
<div class="cover">
  <div class="cover-logo">
    <svg viewBox="0 0 200 60" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="60" rx="4" fill="#2C2C2C"/>
      <text x="100" y="28" text-anchor="middle" fill="#C19A5B" font-family="'Noto Serif TC', serif" font-size="16" font-weight="700" letter-spacing="3">CHIC KIM &amp; MIU</text>
      <text x="100" y="46" text-anchor="middle" fill="#F8F1E9" font-family="'Noto Sans TC', sans-serif" font-size="8" letter-spacing="4">JING SHOW INTERNATIONAL</text>
    </svg>
  </div>

  <h1>CHIC KIM &amp; MIU</h1>
  <p class="subtitle">靚秀國際有限公司</p>

  <div class="doc-title">網站架構說明與使用手冊</div>

  <div class="gold-divider"></div>

  <div class="meta">
    <p><strong>文件版本：</strong>v1.0</p>
    <p><strong>更新日期：</strong>2026 年 4 月 11 日</p>
    <p><strong>適用對象：</strong>系統管理員、營運人員、合作夥伴</p>
    <p><strong>網站網址：</strong>www.ckmu.co</p>
    <p><strong>後台網址：</strong>www.ckmu.co/admin</p>
    <p><strong>機密等級：</strong>公司內部使用</p>
  </div>
</div>

<!-- ════════════════════════════════════════════ -->
<!-- TABLE OF CONTENTS                           -->
<!-- ════════════════════════════════════════════ -->
<div class="toc">
  <h2>目 錄</h2>
  <div class="gold-divider"></div>
  <ol class="toc-list">
    <li><a href="#s1"><span class="toc-title">系統總覽</span></a></li>
    <li><a href="#s2"><span class="toc-title">後台管理系統 (/admin)</span></a></li>
    <li><a href="#s3"><span class="toc-title">全域設定 (Globals)</span></a></li>
    <li><a href="#s4"><span class="toc-title">商品管理操作手冊</span></a></li>
    <li><a href="#s5"><span class="toc-title">會員系統</span></a></li>
    <li><a href="#s6"><span class="toc-title">訂單與金流</span></a></li>
    <li><a href="#s7"><span class="toc-title">行銷系統</span></a></li>
    <li><a href="#s8"><span class="toc-title">點數系統</span></a></li>
    <li><a href="#s9"><span class="toc-title">遊戲系統</span></a></li>
    <li><a href="#s10"><span class="toc-title">前台頁面架構</span></a></li>
    <li><a href="#s11"><span class="toc-title">技術維護</span></a></li>
  </ol>
</div>

<!-- ════════════════════════════════════════════ -->
<!-- SECTION 1: 系統總覽                          -->
<!-- ════════════════════════════════════════════ -->
<div class="section" id="s1">
  <span class="section-number">SECTION 01</span>
  <h2 class="section-title">系統總覽</h2>

  <h3>技術架構</h3>
  <p>CHIC KIM &amp; MIU 電商平台採用現代全端架構，以 Next.js 15 App Router 為核心框架，整合 Payload CMS v3 作為無頭內容管理系統（Headless CMS），資料庫支援 SQLite（開發環境）與 PostgreSQL（正式環境）雙模式。</p>

  <table>
    <thead>
      <tr><th>技術層</th><th>採用技術</th><th>說明</th></tr>
    </thead>
    <tbody>
      <tr><td>前端框架</td><td>Next.js 15 (App Router)</td><td>React 伺服器端元件 (RSC)、串流渲染、自動程式碼分割</td></tr>
      <tr><td>CMS</td><td>Payload CMS v3</td><td>TypeScript 優先、內建存取控制、REST + GraphQL API 雙端點</td></tr>
      <tr><td>資料庫</td><td>SQLite / PostgreSQL</td><td>開發環境使用 SQLite 零配置啟動；正式環境使用 PostgreSQL</td></tr>
      <tr><td>語言</td><td>TypeScript 5.x</td><td>全專案強型別，前後端共用型別定義</td></tr>
      <tr><td>樣式</td><td>Tailwind CSS 4</td><td>原子化 CSS，搭配品牌自訂主題色系</td></tr>
      <tr><td>套件管理</td><td>pnpm</td><td>高效能、嚴格依賴管理</td></tr>
      <tr><td>部署</td><td>Cloudflare / Vercel</td><td>邊緣運算、全球 CDN 加速</td></tr>
    </tbody>
  </table>

  <h3>前台 vs 後台架構圖</h3>
  <div class="arch-diagram">
+─────────────────────────────────────────────────────────────+
|                    www.ckmu.co (前台)                         |
|  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   |
|  | 首頁 /    |  | 商品列表  |  | 會員中心  |  | 遊戲中心  |   |
|  | 品牌形象  |  | /products |  | /account  |  | /games    |   |
|  └──────────┘  └──────────┘  └──────────┘  └──────────┘   |
|  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   |
|  | 部落格    |  | 購物車    |  | 結帳      |  | 願望清單  |   |
|  | /blog     |  | /cart     |  | /checkout |  | /wishlist |   |
|  └──────────┘  └──────────┘  └──────────┘  └──────────┘   |
+──────────────────────┬──────────────────────────────────────+
                       | REST API / GraphQL
                       v
+─────────────────────────────────────────────────────────────+
|                 Payload CMS v3 (後台核心)                     |
|  ┌──────────────────────────────────────────────────────┐   |
|  | /admin — 管理員儀表板                                  |   |
|  | 34 個 Collections + 10 個 Globals                     |   |
|  | 存取控制 (RBAC): admin / partner / customer           |   |
|  └──────────────────────────────────────────────────────┘   |
+──────────────────────┬──────────────────────────────────────+
                       |
                       v
+─────────────────────────────────────────────────────────────+
|              SQLite (Dev) / PostgreSQL (Prod)                 |
+─────────────────────────────────────────────────────────────+
  </div>

  <h3>品牌色系</h3>
  <table>
    <thead>
      <tr><th>色彩名稱</th><th>色碼</th><th>用途</th></tr>
    </thead>
    <tbody>
      <tr>
        <td><span style="display:inline-block;width:20px;height:20px;background:#F8F1E9;border:1px solid #ddd;border-radius:4px;vertical-align:middle;margin-right:8px;"></span>米白 Cream</td>
        <td><code>#F8F1E9</code></td>
        <td>頁面背景、卡片底色、柔和區塊</td>
      </tr>
      <tr>
        <td><span style="display:inline-block;width:20px;height:20px;background:#C19A5B;border-radius:4px;vertical-align:middle;margin-right:8px;"></span>金色 Gold</td>
        <td><code>#C19A5B</code></td>
        <td>品牌主色、按鈕、連結、重點文字、CTA</td>
      </tr>
      <tr>
        <td><span style="display:inline-block;width:20px;height:20px;background:#2C2C2C;border-radius:4px;vertical-align:middle;margin-right:8px;"></span>深色 Dark</td>
        <td><code>#2C2C2C</code></td>
        <td>標題文字、導航欄、頁尾背景</td>
      </tr>
    </tbody>
  </table>
</div>

<!-- ════════════════════════════════════════════ -->
<!-- SECTION 2: 後台管理系統                       -->
<!-- ════════════════════════════════════════════ -->
<div class="section" id="s2">
  <span class="section-number">SECTION 02</span>
  <h2 class="section-title">後台管理系統 (/admin)</h2>

  <h3>登入方式</h3>
  <table>
    <thead>
      <tr><th>角色</th><th>登入網址</th><th>說明</th></tr>
    </thead>
    <tbody>
      <tr><td>管理員 (admin)</td><td><code>/admin-login</code></td><td>透過專屬管理員登入頁面進入後台，登入後自動導向 <code>/admin</code> 儀表板</td></tr>
      <tr><td>合作夥伴 (partner)</td><td><code>/admin-login</code></td><td>與管理員共用登入頁面，進入後台後僅可見授權的資料區塊（如推薦的訂單）</td></tr>
      <tr><td>消費者 (customer)</td><td><code>/login</code></td><td>前台會員登入頁面，登入後導向會員中心 <code>/account</code></td></tr>
    </tbody>
  </table>

  <div class="info-box">
    <p class="box-title">安全提示</p>
    <p>管理員帳號具備所有資料的完整讀寫權限。請確保管理員密碼至少 12 字元，包含大小寫字母、數字及特殊符號。Token 有效期限為 7 天，到期後須重新登入。</p>
  </div>

  <h3>儀表板功能說明</h3>
  <p>登入後台後，您將看到 Payload CMS 儀表板。左側導航欄依據業務功能分群，右上角顯示目前登入帳號，可快速切換語言或登出。儀表板首頁顯示各 Collection 的快速存取卡片，方便直接進入管理頁面。</p>

  <h3>左側導航結構</h3>
  <p>後台左側導航按照管理群組 (admin group) 分類如下：</p>

  <h4>會員管理</h4>
  <table>
    <thead>
      <tr><th>Collection</th><th>中文名稱</th><th>功能說明</th></tr>
    </thead>
    <tbody>
      <tr><td><code>Users</code></td><td>使用者</td><td>管理所有使用者帳號（管理員、合作夥伴、一般會員），包含角色權限、點數、購物金、累計消費、地址簿、社群登入綁定等資訊。支援 CSV/Excel 批量匯入匯出。</td></tr>
      <tr><td><code>MembershipTiers</code></td><td>會員等級</td><td>設定六個等級的升級門檻（累計消費 Lifetime 與年度消費）、折扣比例、點數倍率、前台稱號。前台稱號與後台分級碼完全分離。</td></tr>
      <tr><td><code>SubscriptionPlans</code></td><td>訂閱方案</td><td>管理月費/年費訂閱方案，訂閱會員享有額外點數加成、專屬折扣與優先出貨等權益。</td></tr>
    </tbody>
  </table>

  <h4>商品管理</h4>
  <table>
    <thead>
      <tr><th>Collection</th><th>中文名稱</th><th>功能說明</th></tr>
    </thead>
    <tbody>
      <tr><td><code>Products</code></td><td>商品</td><td>商品資料管理，包含名稱、價格、特價、分類、標籤、圖片、變體（顏色 x 尺寸 x SKU）、庫存、SEO 設定、採購來源資訊。支援 CSV/Excel 匯入匯出及 Sinsang Market 匯入器。</td></tr>
      <tr><td><code>Categories</code></td><td>商品分類</td><td>多層樹狀分類管理（支援子分類），每個分類含名稱、slug、說明、圖片及上層分類關聯。</td></tr>
      <tr><td><code>ProductReviews</code></td><td>商品評價</td><td>會員對已購商品的評分與評價管理，評價獎勵點數由 LoyaltySettings 控制。</td></tr>
    </tbody>
  </table>

  <h4>訂單管理</h4>
  <table>
    <thead>
      <tr><th>Collection</th><th>中文名稱</th><th>功能說明</th></tr>
    </thead>
    <tbody>
      <tr><td><code>Orders</code></td><td>訂單</td><td>完整訂單管理，包含訂單編號 (CKM-YYYYMMDD-XXXX)、商品明細快照、金額計算、付款狀態、物流追蹤、收件資訊、超商門市資訊、推薦分潤資訊。</td></tr>
      <tr><td><code>Returns</code></td><td>退貨</td><td>退貨申請處理，記錄退貨原因、退貨商品、處理狀態與退款金額。</td></tr>
      <tr><td><code>Refunds</code></td><td>退款</td><td>退款紀錄管理，關聯訂單與退貨單，追蹤退款金流狀態。</td></tr>
      <tr><td><code>Exchanges</code></td><td>換貨</td><td>換貨申請處理，記錄換貨原因、原商品與新商品資訊、物流狀態。</td></tr>
      <tr><td><code>ShippingMethods</code></td><td>物流方式</td><td>管理可用的配送方式（7-ELEVEN/全家/黑貓宅配等）及對應運費規則。</td></tr>
      <tr><td><code>Invoices</code></td><td>發票</td><td>電子發票紀錄，整合綠界科技 (ECPay) 自動開立。</td></tr>
    </tbody>
  </table>

  <h4>合作夥伴</h4>
  <table>
    <thead>
      <tr><th>Collection</th><th>中文名稱</th><th>功能說明</th></tr>
    </thead>
    <tbody>
      <tr><td><code>Affiliates</code></td><td>合作夥伴</td><td>管理聯盟行銷合作夥伴資料、分潤比例、推薦成效追蹤。合作夥伴登入後台可查看自己推薦的訂單。</td></tr>
    </tbody>
  </table>

  <h4>內容管理</h4>
  <table>
    <thead>
      <tr><th>Collection</th><th>中文名稱</th><th>功能說明</th></tr>
    </thead>
    <tbody>
      <tr><td><code>BlogPosts</code></td><td>部落格文章</td><td>品牌部落格內容管理，支援富文本編輯、封面圖、分類、標籤、SEO 設定。</td></tr>
      <tr><td><code>Pages</code></td><td>靜態頁面</td><td>管理自訂靜態頁面（如關於我們、隱私政策、購物指南等）。</td></tr>
      <tr><td><code>UGCPosts</code></td><td>用戶生成內容</td><td>管理會員上傳的穿搭分享、開箱文等用戶生成內容。</td></tr>
    </tbody>
  </table>

  <h4>行銷活動</h4>
  <table>
    <thead>
      <tr><th>Collection</th><th>中文名稱</th><th>功能說明</th></tr>
    </thead>
    <tbody>
      <tr><td><code>PointsRedemptions</code></td><td>點數兌換</td><td>點數兌換獎品管理：實體獎品、電影票、優惠券、折扣碼、購物金、抽獎機會、加購優惠、免運券、體驗活動。</td></tr>
      <tr><td><code>MarketingCampaigns</code></td><td>行銷活動</td><td>建立與管理行銷活動，設定活動期間、目標受眾、優惠內容、追蹤成效。</td></tr>
      <tr><td><code>MessageTemplates</code></td><td>訊息模板</td><td>Email、LINE、SMS 等通知訊息模板管理，支援變數替換。</td></tr>
      <tr><td><code>ABTests</code></td><td>A/B 測試</td><td>行銷素材 A/B 測試設定與成效追蹤。</td></tr>
      <tr><td><code>MarketingExecutionLogs</code></td><td>行銷執行紀錄</td><td>記錄每次行銷活動的發送時間、對象、成效數據。</td></tr>
      <tr><td><code>FestivalTemplates</code></td><td>節慶模板</td><td>預設節慶行銷模板（農曆新年、情人節、母親節、雙11等），可快速套用。</td></tr>
      <tr><td><code>BirthdayCampaigns</code></td><td>生日行銷</td><td>會員生日自動行銷活動設定，含生日禮金、專屬折扣、點數加倍。</td></tr>
    </tbody>
  </table>

  <h4>CRM</h4>
  <table>
    <thead>
      <tr><th>Collection</th><th>中文名稱</th><th>功能說明</th></tr>
    </thead>
    <tbody>
      <tr><td><code>CreditScoreHistory</code></td><td>信用分數紀錄</td><td>會員信用分數變動歷程，記錄加分/扣分原因與時間。</td></tr>
      <tr><td><code>PointsTransactions</code></td><td>點數交易紀錄</td><td>所有點數獲取與消耗的完整紀錄。</td></tr>
      <tr><td><code>AutomationJourneys</code></td><td>自動化旅程</td><td>行銷自動化旅程設計，定義觸發條件、延遲、分支、動作。</td></tr>
      <tr><td><code>AutomationLogs</code></td><td>自動化紀錄</td><td>旅程執行紀錄，追蹤每位會員的旅程進度。</td></tr>
      <tr><td><code>CustomerServiceTickets</code></td><td>客服工單</td><td>客戶服務工單管理，支援分類、優先順序、指派、回覆追蹤。</td></tr>
      <tr><td><code>MemberSegments</code></td><td>會員分群</td><td>根據消費行為、活躍度、偏好等條件建立會員分群，用於精準行銷。</td></tr>
    </tbody>
  </table>

  <h4>VIP 管家</h4>
  <table>
    <thead>
      <tr><th>Collection</th><th>中文名稱</th><th>功能說明</th></tr>
    </thead>
    <tbody>
      <tr><td><code>ConciergeServiceRequests</code></td><td>管家服務申請</td><td>高階會員（星耀皇后、璀璨天后）專屬管家服務申請管理，包含穿搭諮詢、私人採購、專屬客服等。</td></tr>
    </tbody>
  </table>

  <h4>遊戲系統</h4>
  <table>
    <thead>
      <tr><th>Collection</th><th>中文名稱</th><th>功能說明</th></tr>
    </thead>
    <tbody>
      <tr><td><code>MiniGameRecords</code></td><td>遊戲紀錄</td><td>記錄會員參與各小遊戲的次數、獲得點數、遊玩時間等數據。</td></tr>
      <tr><td><code>CardBattles</code></td><td>卡牌對戰</td><td>抽卡片比大小遊戲的對戰房間與結果紀錄。</td></tr>
      <tr><td><code>GameLeaderboard</code></td><td>遊戲排行榜</td><td>每日/每週/每月排行榜資料，記錄各期間的排名與獎勵發放。</td></tr>
    </tbody>
  </table>

  <h4>媒體資源</h4>
  <table>
    <thead>
      <tr><th>Collection</th><th>中文名稱</th><th>功能說明</th></tr>
    </thead>
    <tbody>
      <tr><td><code>Media</code></td><td>媒體</td><td>所有上傳檔案（商品圖片、文章封面、品牌素材等）的統一管理，支援圖片壓縮與多尺寸裁切。</td></tr>
    </tbody>
  </table>
</div>

<!-- ════════════════════════════════════════════ -->
<!-- SECTION 3: 全域設定                           -->
<!-- ════════════════════════════════════════════ -->
<div class="section" id="s3">
  <span class="section-number">SECTION 03</span>
  <h2 class="section-title">全域設定 (Globals)</h2>

  <p>Globals 是全站共用的設定資料，不同於 Collections 的多筆紀錄，每個 Global 只有一份設定值。管理員可於後台左側導航最下方找到所有 Globals 項目。</p>

  <h3>GlobalSettings — 全站通用設定</h3>
  <p>控制網站的基礎設定，包括網站名稱、Logo、聯絡資訊、營業時間、社群媒體連結、SEO 預設值、Cookie 同意提示文字等。所有前台共用的參數集中於此管理。</p>

  <h3>LoyaltySettings — 忠誠度計畫設定</h3>
  <p>會員點數系統的核心設定，涵蓋以下子區塊：</p>
  <table>
    <thead>
      <tr><th>設定區塊</th><th>說明</th><th>預設值範例</th></tr>
    </thead>
    <tbody>
      <tr><td>點數基本設定</td><td>啟用開關、每消費 NT$1 獲得點數、兌換比例、有效期限、單筆折抵上限</td><td>1 點/NT$1、100 點=NT$1、365 天有效、最高折抵 30%</td></tr>
      <tr><td>等級點數倍率</td><td>各會員等級的點數倍率</td><td>銅牌 1.0x、銀牌 1.2x、金牌 1.5x、白金 2.0x、鑽石 2.5x</td></tr>
      <tr><td>每月等級贈送</td><td>各等級每月自動贈送的免費點數</td><td>銀牌 50 點、金牌 100 點、白金 200 點、鑽石 500 點</td></tr>
      <tr><td>生日禮設定</td><td>生日贈送點數、購物金、月折扣、點數加倍倍率</td><td>200 點、NT$100 購物金、10% 折扣、3 倍點數</td></tr>
      <tr><td>評價獎勵</td><td>撰寫商品評價可獲得的點數獎勵</td><td>依評價品質給予不同點數</td></tr>
    </tbody>
  </table>

  <h3>ReferralSettings — 推薦計畫設定</h3>
  <p>管理推薦碼系統的完整規則：</p>
  <ul>
    <li><strong>推薦獎勵：</strong>推薦人在被推薦人註冊時獲得 NT$50 購物金，被推薦人首消滿 NT$500 後推薦人再獲 NT$100 購物金</li>
    <li><strong>被推薦人獎勵：</strong>註冊獲得 NT$30 購物金，首消獲得 NT$50 購物金</li>
    <li><strong>等級加成：</strong>推薦獎勵依會員等級自動加成（銅牌 1.0x 至鑽石 2.0x），訂閱會員每次額外 NT$20</li>
    <li><strong>推薦連結：</strong>Cookie 有效 30 天，連結前綴 <code>/ref/</code></li>
  </ul>

  <div class="info-box warning">
    <p class="box-title">防濫用機制</p>
    <p>系統內建完整的防濫用機制：封鎖自推（相同 IP/裝置）、同 IP 最多推薦 3 次、裝置指紋偵測、同裝置推薦上限 2 次、需 Email 驗證才發獎勵、註冊後 24 小時冷卻期、每月推薦上限 50 人、短時間超過 10 次自動鎖定、可啟用人工審核佇列。</p>
  </div>

  <h3>PointRedemptionSettings — 點數消耗心理學設定</h3>
  <p>運用行為心理學原理，提升點數兌換率的精細設定：</p>
  <table>
    <thead>
      <tr><th>心理學機制</th><th>設定項目</th><th>效果</th></tr>
    </thead>
    <tbody>
      <tr><td>損失規避</td><td>到期提醒（多天數分級：一般提醒、急迫提醒、最後機會）、商城倒數計時</td><td>讓會員感受「即將失去」的緊迫感，促進兌換</td></tr>
      <tr><td>稀缺性效應</td><td>顯示剩餘數量（低於 10 顯示「即將售完」）、已兌換人數（社會認同）、熱門標籤（超過 50 人兌換顯示「熱門」）</td><td>刺激立即行動</td></tr>
      <tr><td>進度感</td><td>進度條顯示、接近可兌換獎品提示（達 80% 顯示「快達標了」）</td><td>推動會員持續消費</td></tr>
      <tr><td>即時滿足 + 不確定性</td><td>神秘禮物（100 點，最高 NT$500 價值）、幸運轉盤（50 點/次，含安慰獎 10 點）</td><td>多巴胺驅動的重複參與</td></tr>
      <tr><td>FOMO 效應</td><td>限時加倍活動（可設定 2-10 倍率、起訖時間、適用兌換品）</td><td>限時活動創造錯過恐懼</td></tr>
    </tbody>
  </table>

  <h3>RecommendationSettings — AI 推薦引擎設定</h3>
  <p>控制商品推薦演算法的參數，包括協同過濾權重、內容過濾權重、推薦結果數量、新品偏好度、熱銷偏好度、個人化程度等。管理員可微調各項權重來優化推薦效果。</p>

  <h3>CRMSettings — CRM 系統設定</h3>
  <p>信用分數系統與 AI 客服的核心參數：</p>
  <ul>
    <li><strong>信用分數系統：</strong>初始分數、各行為加減分規則、自動分級門檻</li>
    <li><strong>AI 客服設定：</strong>自動回覆啟用開關、回覆延遲時間、轉人工門檻</li>
  </ul>

  <h3>SegmentationSettings — 會員分群設定</h3>
  <p>定義會員自動分群的規則引擎參數：RFM 分析閾值（最近消費 Recency、消費頻率 Frequency、消費金額 Monetary）、活躍度判定標準、流失預警條件等。</p>

  <h3>MarketingAutomationSettings — 行銷自動化設定</h3>
  <p>控制自動化旅程引擎的全域參數：發送頻率上限、靜默期（避免過度推播）、A/B 測試自動優勝選擇門檻、觸發延遲設定、重試次數等。</p>

  <h3>InvoiceSettings — 綠界電子發票設定</h3>
  <p>整合綠界科技 (ECPay) 電子發票 API 的設定：商家編號、HashKey、HashIV、自動開立開關、發票類型預設值（個人/公司/捐贈）、愛心碼預設等。</p>

  <h3>GameSettings — 遊戲系統設定</h3>
  <p>管理所有小遊戲的全域參數，包含遊戲通用設定（啟用開關、每日全遊戲點數上限 500 點）以及各遊戲的獨立設定。詳見第 9 章遊戲系統說明。</p>
</div>

<!-- ════════════════════════════════════════════ -->
<!-- SECTION 4: 商品管理操作手冊                    -->
<!-- ════════════════════════════════════════════ -->
<div class="section" id="s4">
  <span class="section-number">SECTION 04</span>
  <h2 class="section-title">商品管理操作手冊</h2>

  <h3>新增商品步驟</h3>
  <ol>
    <li>登入後台 <code>/admin</code>，於左側導航「商品管理」下點選「Products（商品）」</li>
    <li>點擊右上角「Create New」按鈕</li>
    <li>填寫基本資訊：商品名稱（必填）、網址代碼 slug（必填，如 <code>elegant-dress</code>）、商品描述（富文本編輯器）</li>
    <li>設定價格：原價（必填）、特價（選填，留空表示無特價）</li>
    <li>選擇商品分類（必填，從下拉選單選取）</li>
    <li>新增商品標籤（選填，可加入多個自訂標籤）</li>
    <li>選擇主題專區標籤（選填，可多選：金老佛爺 Live、金金同款、主播同款、品牌自訂款、婚禮洋裝、現貨速到、藝人穿搭）</li>
    <li>上傳商品圖片（至少一張）</li>
    <li>設定商品變體（若有多種顏色/尺寸組合）</li>
    <li>填寫 SEO 設定：Meta 標題、Meta 描述、OG 圖片</li>
    <li>填寫採購來源資訊（側邊欄，僅後台人員可見）</li>
    <li>設定上架狀態為「已上架 (published)」</li>
    <li>點擊「Save」儲存</li>
  </ol>

  <h3>商品欄位完整說明</h3>
  <table>
    <thead>
      <tr><th>欄位名稱</th><th>類型</th><th>必填</th><th>說明</th></tr>
    </thead>
    <tbody>
      <tr><td>商品名稱 (name)</td><td>文字</td><td>是</td><td>商品的顯示名稱，用於前台商品列表與詳情頁</td></tr>
      <tr><td>網址代碼 (slug)</td><td>文字</td><td>是</td><td>URL 友善的唯一識別碼，例如 <code>elegant-dress</code>，用於 <code>/products/elegant-dress</code></td></tr>
      <tr><td>商品描述 (description)</td><td>富文本</td><td>否</td><td>支援粗體、斜體、超連結、清單等格式的商品詳細說明</td></tr>
      <tr><td>原價 (price)</td><td>數字</td><td>是</td><td>商品原始售價，單位新台幣 (NT$)，最小值 0</td></tr>
      <tr><td>特價 (salePrice)</td><td>數字</td><td>否</td><td>促銷特價，留空表示無特價；填入後前台會顯示原價刪除線與特價</td></tr>
      <tr><td>商品分類 (category)</td><td>關聯</td><td>是</td><td>關聯至 Categories，選擇此商品所屬的分類</td></tr>
      <tr><td>商品標籤 (tags)</td><td>陣列</td><td>否</td><td>自訂標籤清單，用於篩選與搜尋</td></tr>
      <tr><td>主題專區標籤 (collectionTags)</td><td>多選</td><td>否</td><td>金老佛爺 Live / 金金同款 / 主播同款 / 品牌自訂款 / 婚禮洋裝 / 現貨速到 / 藝人穿搭</td></tr>
      <tr><td>商品圖片 (images)</td><td>陣列</td><td>是</td><td>至少一張商品圖片，關聯至 Media</td></tr>
      <tr><td>商品變體 (variants)</td><td>陣列</td><td>否</td><td>每個變體包含：顏色名稱、色碼 (HEX)、尺寸、SKU 編號、庫存數量、此變體價格覆蓋</td></tr>
      <tr><td>總庫存 (stock)</td><td>數字</td><td>否</td><td>無變體時使用的總庫存數量；若有設定變體，以變體的庫存為準</td></tr>
      <tr><td>低庫存警示門檻 (lowStockThreshold)</td><td>數字</td><td>否</td><td>預設 5，庫存低於此數量時後台顯示警示</td></tr>
      <tr><td>低庫存警示 (isLowStock)</td><td>布林</td><td>自動</td><td>系統根據庫存與門檻自動判斷，無需手動修改</td></tr>
      <tr><td>允許預購 (allowPreOrder)</td><td>布林</td><td>否</td><td>啟用後庫存為 0 時仍可下單</td></tr>
      <tr><td>預購說明 (preOrderNote)</td><td>文字</td><td>否</td><td>僅在允許預購啟用時顯示，例如「下單 → 搭飛機中 → 清關 → 包裝 → 寄出」</td></tr>
      <tr><td>新品標記 (isNew)</td><td>布林</td><td>否</td><td>勾選後前台顯示「NEW」標籤</td></tr>
      <tr><td>熱銷標記 (isHot)</td><td>布林</td><td>否</td><td>勾選後前台顯示「HOT」標籤</td></tr>
      <tr><td>上架狀態 (status)</td><td>選擇</td><td>是</td><td>草稿 (draft) / 已上架 (published) / 已下架 (archived)</td></tr>
      <tr><td>商品重量 (weight)</td><td>數字</td><td>否</td><td>單位公克，用於運費計算</td></tr>
      <tr><td>SEO 設定 (seo)</td><td>群組</td><td>否</td><td>Meta 標題、Meta 描述、OG 圖片</td></tr>
      <tr><td>採購來源資訊 (sourcing)</td><td>群組</td><td>否</td><td>內部採購資訊（側邊欄），包含來源商品 ID、供應商名稱、位置代碼、韓元成本、台幣成本、匯率、韓文描述、布料資訊（材質、厚度、透明度、彈性、製造國）</td></tr>
    </tbody>
  </table>

  <h3>批次上傳方式</h3>
  <div class="info-box">
    <p class="box-title">Excel/CSV 批量匯入流程</p>
    <p>1. 至後台 Products 列表頁面，點擊頂部的「下載 Excel 範本」或「下載 CSV 範本」按鈕</p>
    <p>2. 用 Excel 或 Google Sheets 開啟範本，依照欄位說明填入商品資料</p>
    <p>3. 變體與標籤欄位使用 JSON 格式填寫</p>
    <p>4. 回到後台列表頁，點擊「匯入」按鈕並選擇填寫完成的檔案</p>
    <p>5. 系統會驗證資料格式，顯示匯入預覽，確認後執行匯入</p>
    <p>6. 範本下載路徑：<code>/templates/products-upload-template.xlsx</code></p>
  </div>

  <p>此外，後台還提供「Sinsang Market 匯入器」按鈕，可直接從韓國 Sinsang Market 批發平台匯入商品資料，系統會自動進行韓元轉台幣匯率換算。</p>

  <h3>圖片命名規則</h3>
  <p>為保持檔案管理的一致性，建議圖片檔名遵循以下規則：</p>
  <pre><code>{商品slug}-{顏色英文}-{編號}.jpg

範例：
elegant-dress-black-01.jpg
elegant-dress-black-02.jpg
elegant-dress-white-01.jpg
elegant-dress-white-02.jpg</code></pre>

  <h3>變體管理（顏色 x 尺寸 x SKU）</h3>
  <p>每個商品變體代表一種「顏色 + 尺寸」的組合。在商品編輯頁面的「商品變體」區塊中：</p>
  <table>
    <thead>
      <tr><th>變體欄位</th><th>說明</th><th>範例</th></tr>
    </thead>
    <tbody>
      <tr><td>顏色名稱 (colorName)</td><td>顏色的中文或英文名稱</td><td>黑色、象牙白、莫蘭迪粉</td></tr>
      <tr><td>色碼 (colorCode)</td><td>HEX 色碼，用於前台色塊顯示</td><td>#000000、#FFFFF0、#E8C4C4</td></tr>
      <tr><td>尺寸 (size)</td><td>尺寸標示</td><td>S / M / L / XL / XXL</td></tr>
      <tr><td>SKU 編號 (sku)</td><td>庫存管理用唯一編號</td><td>CKM-ED-BK-M（品牌-商品-顏色-尺寸）</td></tr>
      <tr><td>庫存數量 (stock)</td><td>此變體的庫存數量</td><td>15</td></tr>
      <tr><td>價格覆蓋 (priceOverride)</td><td>若此變體價格不同於主商品，填入覆蓋價格</td><td>1280（特殊色加價）</td></tr>
    </tbody>
  </table>

  <h3>商品分類結構</h3>
  <p>系統預設 13 個頂層分類與 36 個子分類，完整結構如下：</p>

  <div class="cat-tree">
    <div class="cat-parent">1. NEW ARRIVAL — 最新上架</div>
    <div class="cat-parent">2. 全部商品 All — 瀏覽所有商品</div>

    <div class="cat-parent">3. 主題精選</div>
    <div class="cat-children">
      <span class="tag tag-gold">外套 Outer</span>
      <span class="tag tag-gold">上衣 Top</span>
      <span class="tag tag-gold">針織 Knit</span>
      <span class="tag tag-gold">襯衫 Blouse</span>
      <span class="tag tag-gold">Bra Top</span>
    </div>

    <div class="cat-parent">4. 下著 Bottom</div>
    <div class="cat-children">
      <span class="tag tag-gold">所有褲子</span>
      <span class="tag tag-gold">長褲</span>
      <span class="tag tag-gold">短褲</span>
      <span class="tag tag-gold">螞蟻腰褲</span>
      <span class="tag tag-gold">所有裙子</span>
      <span class="tag tag-gold">中/長裙</span>
      <span class="tag tag-gold">短裙</span>
    </div>

    <div class="cat-parent">5. 連衣裙/洋裝 Dress — 約會必備洋裝</div>

    <div class="cat-parent">6. 套裝 Set</div>
    <div class="cat-children">
      <span class="tag tag-gold">正式套裝 Formal Set</span>
      <span class="tag tag-gold">休閒套裝 Casual Set</span>
    </div>

    <div class="cat-parent">7. 泳裝 Swimwear — 比基尼、連身泳裝、罩衫</div>

    <div class="cat-parent">8. 配件 Accessories</div>
    <div class="cat-children">
      <span class="tag tag-gold">鞋子</span>
      <span class="tag tag-gold">襪子</span>
      <span class="tag tag-gold">包包</span>
      <span class="tag tag-gold">眼鏡</span>
      <span class="tag tag-gold">皮帶</span>
      <span class="tag tag-gold">手錶</span>
      <span class="tag tag-gold">髮飾</span>
      <span class="tag tag-gold">帽子/圍巾</span>
      <span class="tag tag-gold">吊飾</span>
    </div>

    <div class="cat-parent">9. 飾品 Jewelry</div>
    <div class="cat-children">
      <span class="tag tag-gold">耳環</span>
      <span class="tag tag-gold">戒指</span>
      <span class="tag tag-gold">手環</span>
      <span class="tag tag-gold">項鍊</span>
      <span class="tag tag-gold">純銀</span>
    </div>

    <div class="cat-parent">10. 韓劇商品 K-Drama Products</div>
    <div class="cat-children">
      <span class="tag tag-gold">Penthouse</span>
      <span class="tag tag-gold">現正分手中</span>
      <span class="tag tag-gold">愛的迫降</span>
      <span class="tag tag-gold">夫妻的世界</span>
    </div>

    <div class="cat-parent">11. 現貨速到專區 Rush — 現貨快速出貨</div>
    <div class="cat-parent">12. 婚禮洋裝/正式洋裝 — 婚禮宴會場合</div>
    <div class="cat-parent">13. 品牌自訂款 — CHIC KIM &amp; MIU 獨家設計</div>
  </div>
</div>

<!-- ════════════════════════════════════════════ -->
<!-- SECTION 5: 會員系統                           -->
<!-- ════════════════════════════════════════════ -->
<div class="section" id="s5">
  <span class="section-number">SECTION 05</span>
  <h2 class="section-title">會員系統</h2>

  <h3>六個會員等級</h3>
  <p>CHIC KIM &amp; MIU 採用六層會員等級制度。系統內部使用英文分級碼 (tier_code) 進行資料存取，但前台所有顯示（網站、LINE、EDM、通知）一律使用中文前台稱號，絕對不會出現 bronze/silver/gold 等金屬名稱。</p>

  <table>
    <thead>
      <tr><th>等級</th><th>後台分級碼</th><th>前台稱號</th><th>點數倍率</th><th>每月贈送</th></tr>
    </thead>
    <tbody>
      <tr><td>T0</td><td><code>ordinary</code></td><td>優雅初遇者</td><td>1.0x（基礎）</td><td>0 點</td></tr>
      <tr><td>T1</td><td><code>bronze</code></td><td>曦漾仙子</td><td>1.0x</td><td>0 點</td></tr>
      <tr><td>T2</td><td><code>silver</code></td><td>優漾女神</td><td>1.2x</td><td>50 點</td></tr>
      <tr><td>T3</td><td><code>gold</code></td><td>金曦女王</td><td>1.5x</td><td>100 點</td></tr>
      <tr><td>T4</td><td><code>platinum</code></td><td>星耀皇后</td><td>2.0x</td><td>200 點</td></tr>
      <tr><td>T5</td><td><code>diamond</code></td><td>璀璨天后</td><td>2.5x</td><td>500 點</td></tr>
    </tbody>
  </table>

  <div class="info-box warning">
    <p class="box-title">重要提醒：前台稱號與後台分級碼完全分離</p>
    <p>在所有面向消費者的介面（網站、LINE 訊息、EDM 電子報、推播通知）中，一律只顯示前台稱號（如「金曦女王」），絕對不可出現 bronze / silver / gold 等金屬分級名稱。後台分級碼僅供資料庫與 API 使用。</p>
  </div>

  <p>升級門檻由 MembershipTiers Collection 設定，包含兩個條件：</p>
  <ul>
    <li><strong>累計消費 (Lifetime)：</strong>帳號建立以來的總消費金額</li>
    <li><strong>年度消費 (Annual)：</strong>近 12 個月的消費金額</li>
  </ul>
  <p>兩個條件皆需達標才會自動升級。管理員可在 MembershipTiers 中調整各等級的升級門檻、折扣比例與點數倍率。</p>

  <h3>三種使用者角色</h3>
  <table>
    <thead>
      <tr><th>角色</th><th>代碼</th><th>權限範圍</th></tr>
    </thead>
    <tbody>
      <tr><td>管理員</td><td><code>admin</code></td><td>完整的後台存取權限，可管理所有 Collections 和 Globals。可讀寫所有使用者資料、訂單、商品、設定。</td></tr>
      <tr><td>合作夥伴</td><td><code>partner</code></td><td>可登入後台但權限受限。在訂單管理中僅可查看透過自身推薦碼產生的訂單（affiliateInfo.affiliateUser 等於自身 ID）。</td></tr>
      <tr><td>消費者</td><td><code>customer</code></td><td>僅可存取前台功能。在 API 層面僅可讀取自身使用者資料與訂單。不可登入後台管理介面。</td></tr>
    </tbody>
  </table>

  <h3>信用分數系統</h3>
  <p>每位會員擁有 0-100 的信用分數，由 CRMSettings 控制自動分級規則：</p>
  <table>
    <thead>
      <tr><th>行為</th><th>分數影響</th></tr>
    </thead>
    <tbody>
      <tr><td>完成訂單並確認收貨</td><td>+2 分</td></tr>
      <tr><td>撰寫商品評價</td><td>+1 分</td></tr>
      <tr><td>推薦新會員成功</td><td>+3 分</td></tr>
      <tr><td>退貨</td><td>-5 分</td></tr>
      <tr><td>惡意退貨或疑似濫用</td><td>-15 分</td></tr>
      <tr><td>遲延付款</td><td>-3 分</td></tr>
      <tr><td>帳號閒置超過 180 天</td><td>-10 分</td></tr>
    </tbody>
  </table>
  <p>信用分數的所有變動歷程記錄在 CreditScoreHistory Collection 中，管理員可隨時查看。低信用分數的會員在系統中會被標記，可用於行銷分群排除或特殊處理。</p>

  <h3>CRM 標籤與偏好</h3>
  <p>系統自動為會員建立消費偏好標籤（如偏好品類、價格帶、活躍時段），搭配 MemberSegments 可建立精準分群，用於後續行銷活動的目標受眾篩選。</p>

  <h3>推薦碼系統</h3>
  <p>每位會員註冊後自動產生唯一推薦碼 (referralCode)，可透過推薦連結 <code>/ref/{推薦碼}</code> 分享。被推薦人點擊連結後，系統透過 Cookie（有效 30 天）追蹤推薦歸屬。推薦成功後雙方均可獲得購物金獎勵，獎勵金額依推薦人的會員等級自動加成。</p>
</div>

<!-- ════════════════════════════════════════════ -->
<!-- SECTION 6: 訂單與金流                         -->
<!-- ════════════════════════════════════════════ -->
<div class="section" id="s6">
  <span class="section-number">SECTION 06</span>
  <h2 class="section-title">訂單與金流</h2>

  <h3>訂單狀態流程</h3>
  <div class="flow-diagram">
    <div class="flow-step active">待處理<br><small>pending</small></div>
    <span class="flow-arrow">&rarr;</span>
    <div class="flow-step">處理中<br><small>processing</small></div>
    <span class="flow-arrow">&rarr;</span>
    <div class="flow-step">已出貨<br><small>shipped</small></div>
    <span class="flow-arrow">&rarr;</span>
    <div class="flow-step">已送達<br><small>delivered</small></div>
  </div>
  <p style="text-align:center; margin-top: 8px;">
    <span class="tag tag-red">已取消 cancelled</span>
    <span class="tag tag-red">已退款 refunded</span>
    <small>（可從任何階段進入）</small>
  </p>

  <h3>訂單編號格式</h3>
  <p>格式為 <code>CKM-YYYYMMDD-XXXX</code>，例如 <code>CKM-20260411-0001</code>。YYYY 為年份、MM 為月份、DD 為日期、XXXX 為當日流水號。</p>

  <h3>訂單資料結構</h3>
  <p>每筆訂單包含以下資訊：</p>
  <ul>
    <li><strong>訂購會員：</strong>關聯至 Users，記錄下單會員</li>
    <li><strong>訂購商品：</strong>陣列形式，每項商品包含商品關聯、名稱快照、變體資訊、SKU、數量、單價、小計</li>
    <li><strong>金額明細：</strong>商品小計、折扣金額、折扣原因、運費、訂單總金額</li>
    <li><strong>點數/購物金：</strong>使用點數 (pointsUsed)、使用購物金 (creditUsed)</li>
    <li><strong>收件資訊：</strong>收件人姓名、電話、郵遞區號、縣市、鄉鎮區、詳細地址</li>
    <li><strong>物流方式：</strong>配送方式、物流商代碼（711、family、tcat 等）、超商門市資訊（門市名稱、代號、地址）</li>
    <li><strong>推薦分潤：</strong>推薦人資訊、分潤比例、分潤金額</li>
  </ul>

  <h3>付款方式與狀態</h3>
  <table>
    <thead>
      <tr><th>付款方式</th><th>代碼</th><th>說明</th></tr>
    </thead>
    <tbody>
      <tr><td>綠界科技 ECPay</td><td><code>ecpay</code></td><td>信用卡、ATM 轉帳、超商代碼、超商條碼</td></tr>
      <tr><td>藍新支付 NewebPay</td><td><code>newebpay</code></td><td>信用卡、WebATM、超商代碼</td></tr>
      <tr><td>LINE Pay</td><td><code>linepay</code></td><td>LINE Pay 電子錢包</td></tr>
      <tr><td>PayPal</td><td><code>paypal</code></td><td>國際信用卡、PayPal 餘額</td></tr>
    </tbody>
  </table>

  <h4>付款狀態流程</h4>
  <div class="flow-diagram">
    <div class="flow-step active">未付款<br><small>unpaid</small></div>
    <span class="flow-arrow">&rarr;</span>
    <div class="flow-step">已付款<br><small>paid</small></div>
    <span class="flow-arrow">&rarr;</span>
    <div class="flow-step">退款中<br><small>refunding</small></div>
    <span class="flow-arrow">&rarr;</span>
    <div class="flow-step">已退款<br><small>refunded</small></div>
  </div>

  <h3>退換貨流程</h3>
  <p>退換貨流程透過三個獨立的 Collections 管理：</p>
  <ol>
    <li><strong>退貨 (Returns)：</strong>會員提出退貨申請，填寫退貨原因與退貨商品。管理員審核後安排退貨物流，收到退貨商品後進行退款。</li>
    <li><strong>退款 (Refunds)：</strong>退款紀錄關聯原訂單與退貨單，記錄退款金額、退款方式（原路退回/購物金/銀行轉帳）、退款狀態。</li>
    <li><strong>換貨 (Exchanges)：</strong>會員提出換貨申請（尺寸不合、顏色更換等），管理員審核後安排寄出新商品並回收原商品。</li>
  </ol>

  <div class="info-box">
    <p class="box-title">退換貨政策建議</p>
    <p>建議在全站設定中明確標示退換貨期限（如收貨後 7 天內）、退換貨條件（商品完整且未拆封標籤）、退貨運費承擔方（若商品瑕疵由賣方負擔、個人因素由買方負擔）。退貨行為會影響會員信用分數。</p>
  </div>

  <h3>電子發票（綠界整合）</h3>
  <p>系統整合綠界科技 (ECPay) 電子發票 API，訂單成立並完成付款後可自動開立電子發票：</p>
  <ul>
    <li><strong>個人發票：</strong>載具歸戶（手機條碼 / 自然人憑證）或捐贈（愛心碼）</li>
    <li><strong>公司發票：</strong>填入統一編號與公司名稱</li>
    <li><strong>自動開立：</strong>可在 InvoiceSettings 中設定是否於付款完成時自動開立</li>
    <li><strong>發票紀錄：</strong>所有已開立發票記錄在 Invoices Collection，含發票號碼、金額、買受人資訊、開立時間</li>
  </ul>
  <p>訂單付款完成後，系統會透過 <code>autoIssueInvoiceForOrder</code> 自動觸發發票開立流程，並將發票編號回寫至訂單紀錄。</p>
</div>

<!-- ════════════════════════════════════════════ -->
<!-- SECTION 7: 行銷系統                           -->
<!-- ════════════════════════════════════════════ -->
<div class="section" id="s7">
  <span class="section-number">SECTION 07</span>
  <h2 class="section-title">行銷系統</h2>

  <h3>行銷自動化旅程</h3>
  <p>透過 AutomationJourneys Collection 建立自動化行銷旅程，每個旅程由以下元素組成：</p>
  <ul>
    <li><strong>觸發條件 (Trigger)：</strong>會員註冊、首次購物、生日月、購物車放棄、閒置超過 N 天、升級等級等</li>
    <li><strong>延遲 (Delay)：</strong>觸發後等待指定時間再執行下一步（如等待 1 小時、3 天）</li>
    <li><strong>條件分支 (Branch)：</strong>根據會員屬性（等級、消費金額、活躍度）走不同路徑</li>
    <li><strong>動作 (Action)：</strong>發送 Email、LINE 訊息、SMS、推播通知、贈送點數、贈送優惠券</li>
  </ul>

  <p>旅程範例：購物車放棄提醒旅程</p>
  <div class="flow-diagram">
    <div class="flow-step active">放棄購物車</div>
    <span class="flow-arrow">&rarr;</span>
    <div class="flow-step">等待 1 小時</div>
    <span class="flow-arrow">&rarr;</span>
    <div class="flow-step">發送 Email<br><small>「您的商品還在等您」</small></div>
    <span class="flow-arrow">&rarr;</span>
    <div class="flow-step">等待 24 小時</div>
    <span class="flow-arrow">&rarr;</span>
    <div class="flow-step">贈送 50 點<br><small>限時優惠</small></div>
  </div>

  <p>每次旅程執行的紀錄儲存在 AutomationLogs 中，可追蹤每位會員的旅程進度與各步驟的完成狀態。</p>

  <h3>A/B 測試</h3>
  <p>透過 ABTests Collection 管理行銷素材的 A/B 測試：</p>
  <ol>
    <li>建立測試：設定測試名稱、測試類型（Email 主旨、推播內容、Landing Page 等）</li>
    <li>設定變體：建立 A 版與 B 版內容</li>
    <li>設定流量分配比例（如 50/50 或 70/30）</li>
    <li>設定成功指標（開信率、點擊率、轉換率）</li>
    <li>自動判定優勝版本（依 MarketingAutomationSettings 中的門檻設定）</li>
  </ol>

  <h3>節慶模板</h3>
  <p>FestivalTemplates Collection 提供預建的節慶行銷模板，管理員可快速套用並客製化：</p>
  <table>
    <thead>
      <tr><th>節慶</th><th>建議活動</th><th>時間</th></tr>
    </thead>
    <tbody>
      <tr><td>農曆新年</td><td>紅包抽獎、新春特賣、滿額贈</td><td>1-2 月</td></tr>
      <tr><td>情人節</td><td>甜蜜配對優惠、雙人組合價</td><td>2 月 14 日</td></tr>
      <tr><td>38 女神節</td><td>全站 88 折、女神專區</td><td>3 月 8 日</td></tr>
      <tr><td>母親節</td><td>感恩回饋、親子套裝優惠</td><td>5 月</td></tr>
      <tr><td>618 年中慶</td><td>年中大促、滿千折百</td><td>6 月 18 日</td></tr>
      <tr><td>七夕</td><td>約會穿搭特輯、點數雙倍</td><td>農曆七月七日</td></tr>
      <tr><td>雙 11</td><td>全年最大促銷、限時搶購</td><td>11 月 11 日</td></tr>
      <tr><td>雙 12</td><td>年終回饋、加碼優惠</td><td>12 月 12 日</td></tr>
      <tr><td>聖誕節</td><td>聖誕交換禮物推薦、神秘禮物包</td><td>12 月 25 日</td></tr>
    </tbody>
  </table>

  <h3>生日行銷</h3>
  <p>BirthdayCampaigns Collection 管理會員生日自動行銷，搭配 LoyaltySettings 中的生日禮設定：</p>
  <ul>
    <li>生日月自動贈送 200 點 + NT$100 購物金</li>
    <li>生日月全站享 10% 折扣</li>
    <li>生日月消費點數 3 倍</li>
    <li>生日當天發送專屬祝福 Email/LINE 訊息</li>
    <li>可針對不同等級設定差異化生日禮（如璀璨天后加贈專屬禮物）</li>
  </ul>

  <h3>推薦計畫</h3>
  <p>推薦計畫的完整設定由 ReferralSettings Global 控制（詳見第 3 章），在行銷系統中可搭配以下活動提升推薦效果：</p>
  <ul>
    <li>限時推薦加碼活動（如雙 11 期間推薦獎勵雙倍）</li>
    <li>推薦排行榜（當月推薦最多的前 10 名額外獎勵）</li>
    <li>推薦里程碑獎勵（累計推薦 5 人、10 人、20 人各有階段性獎勵）</li>
  </ul>
</div>

<!-- ════════════════════════════════════════════ -->
<!-- SECTION 8: 點數系統                           -->
<!-- ════════════════════════════════════════════ -->
<div class="section" id="s8">
  <span class="section-number">SECTION 08</span>
  <h2 class="section-title">點數系統</h2>

  <h3>點數獲取規則</h3>
  <table>
    <thead>
      <tr><th>獲取途徑</th><th>基礎點數</th><th>說明</th></tr>
    </thead>
    <tbody>
      <tr><td>消費獲點</td><td>每消費 NT$1 = 1 點</td><td>依會員等級倍率加成（最高 2.5 倍）</td></tr>
      <tr><td>每月等級贈送</td><td>0 ~ 500 點</td><td>依會員等級每月自動贈送</td></tr>
      <tr><td>生日禮</td><td>200 點 + NT$100 購物金</td><td>生日月自動贈送</td></tr>
      <tr><td>撰寫評價</td><td>依設定</td><td>完成商品評價後獲得獎勵點數</td></tr>
      <tr><td>推薦新會員</td><td>以購物金發放</td><td>推薦獎勵以購物金形式發放（詳見推薦計畫）</td></tr>
      <tr><td>每日簽到</td><td>5 ~ 50 點</td><td>第 1-6 天每天 5 點，第 7 天 50 點，連續簽到 1.5 倍</td></tr>
      <tr><td>小遊戲</td><td>依遊戲結果</td><td>每日全遊戲上限 500 點</td></tr>
      <tr><td>限時加倍活動</td><td>2x ~ 10x</td><td>特定期間內點數獲取倍率提升</td></tr>
    </tbody>
  </table>

  <h3>點數基本規則</h3>
  <ul>
    <li><strong>兌換比例：</strong>100 點 = NT$1</li>
    <li><strong>有效期限：</strong>365 天（0 表示永不過期，可在 LoyaltySettings 調整）</li>
    <li><strong>最低兌換：</strong>100 點起</li>
    <li><strong>單筆折抵上限：</strong>訂單金額的 30%（例如 NT$1,000 訂單最多折 NT$300）</li>
  </ul>

  <h3>兌換管道</h3>
  <p>PointsRedemptions Collection 管理所有可兌換的獎品，支援以下兌換類型：</p>
  <table>
    <thead>
      <tr><th>兌換類型</th><th>代碼</th><th>說明</th></tr>
    </thead>
    <tbody>
      <tr><td>實體獎品</td><td><code>physical</code></td><td>品牌周邊商品、限量贈品等實體物品</td></tr>
      <tr><td>電影票</td><td><code>movie_ticket</code></td><td>與電影院合作的電子票券</td></tr>
      <tr><td>優惠券</td><td><code>coupon</code></td><td>指定折扣優惠券，關聯優惠券代碼</td></tr>
      <tr><td>折扣碼</td><td><code>discount_code</code></td><td>通用折扣碼</td></tr>
      <tr><td>購物金</td><td><code>store_credit</code></td><td>直接轉換為購物金，可於下次消費折抵</td></tr>
      <tr><td>抽獎機會</td><td><code>lottery</code></td><td>用點數兌換抽獎券，有機會獲得大獎</td></tr>
      <tr><td>加購優惠</td><td><code>addon_deal</code></td><td>以點數解鎖指定商品的加購優惠價</td></tr>
      <tr><td>免運券</td><td><code>free_shipping</code></td><td>兌換一次免運配送資格</td></tr>
      <tr><td>體驗活動</td><td><code>experience</code></td><td>品牌活動、穿搭講座、VIP 聚會等體驗活動入場資格</td></tr>
    </tbody>
  </table>

  <p>每個兌換品可設定庫存數量（0 為無限量）、兌換限制（每人上限、每日上限、最低等級門檻）以及排序權重。</p>

  <h3>限時加倍活動</h3>
  <p>在 PointRedemptionSettings 的 boostEvents 中可建立限時加倍活動：</p>
  <ul>
    <li>設定活動名稱、倍率（2-10 倍）、起訖時間</li>
    <li>可指定適用的兌換品（留空則全部適用）</li>
    <li>活動期間前台會顯示醒目的倍率標示與倒數計時</li>
    <li>FOMO 效應設計：即將結束時加強視覺提示</li>
  </ul>

  <h3>訂閱會員加成</h3>
  <p>透過 SubscriptionPlans 訂閱方案的會員，在所有點數獲取上享有額外加成。訂閱會員在推薦計畫中也享有每次推薦額外 NT$20 購物金的加碼獎勵。</p>

  <h3>點數交易紀錄</h3>
  <p>所有點數的獲取與消耗都完整記錄在 PointsTransactions Collection 中，包含交易類型（獲得/消耗）、點數數量、關聯訂單/活動、交易時間等。會員可在前台會員中心查看自己的點數明細。</p>
</div>

<!-- ════════════════════════════════════════════ -->
<!-- SECTION 9: 遊戲系統                           -->
<!-- ════════════════════════════════════════════ -->
<div class="section" id="s9">
  <span class="section-number">SECTION 09</span>
  <h2 class="section-title">遊戲系統</h2>

  <p>遊戲中心 (<code>/games</code>) 提供多種趣味小遊戲，讓會員透過遊戲方式獲得點數，提升平台黏著度。所有遊戲參數由 GameSettings Global 統一管理，且每日全遊戲點數上限為 500 點。</p>

  <h3>每日簽到</h3>
  <table>
    <thead>
      <tr><th>項目</th><th>設定值</th></tr>
    </thead>
    <tbody>
      <tr><td>第 1-6 天簽到獎勵</td><td>每天 5 點</td></tr>
      <tr><td>第 7 天獎勵（週期獎勵）</td><td>50 點</td></tr>
      <tr><td>連續簽到超過 7 天倍率</td><td>1.5 倍</td></tr>
    </tbody>
  </table>
  <p>會員每天登入後點擊簽到按鈕即可獲得點數。連續簽到 7 天為一個週期，第 7 天可獲得 50 點大獎。超過 7 天連續簽到後，基礎獎勵以 1.5 倍計算。中斷簽到則重新計算連續天數。</p>

  <h3>幸運轉盤</h3>
  <table>
    <thead>
      <tr><th>項目</th><th>設定值</th></tr>
    </thead>
    <tbody>
      <tr><td>額外次數消耗</td><td>50 點/次</td></tr>
      <tr><td>每日上限</td><td>10 次</td></tr>
      <tr><td>獎品類型</td><td>點數、購物金、優惠券、無獎品</td></tr>
    </tbody>
  </table>

  <p>各等級每日免費次數：</p>
  <table>
    <thead>
      <tr><th>等級</th><th>ordinary</th><th>bronze</th><th>silver</th><th>gold</th><th>platinum</th><th>diamond</th></tr>
    </thead>
    <tbody>
      <tr><td>免費次數</td><td>0</td><td>1</td><td>2</td><td>3</td><td>5</td><td>10</td></tr>
    </tbody>
  </table>
  <p>轉盤獎品由管理員在 GameSettings 的「獎品設定」中配置，每個獎品設定名稱、類型、金額與機率權重。權重越高中獎機率越大。免費次數用完後，可消耗 50 點繼續遊玩。</p>

  <h3>刮刮樂</h3>
  <table>
    <thead>
      <tr><th>項目</th><th>設定值</th></tr>
    </thead>
    <tbody>
      <tr><td>額外次數消耗</td><td>30 點/次</td></tr>
      <tr><td>每日上限</td><td>5 次</td></tr>
      <tr><td>獎品類型</td><td>點數、購物金、優惠券、無獎品</td></tr>
    </tbody>
  </table>

  <p>各等級每日免費次數：</p>
  <table>
    <thead>
      <tr><th>等級</th><th>ordinary</th><th>bronze</th><th>silver</th><th>gold</th><th>platinum</th><th>diamond</th></tr>
    </thead>
    <tbody>
      <tr><td>免費次數</td><td>1</td><td>1</td><td>2</td><td>2</td><td>3</td><td>5</td></tr>
    </tbody>
  </table>
  <p>會員在螢幕上刮開覆蓋層揭曉獎品。獎品配置方式與幸運轉盤相同。</p>

  <h3>抽卡片比大小（卡牌對戰）</h3>
  <table>
    <thead>
      <tr><th>項目</th><th>設定值</th></tr>
    </thead>
    <tbody>
      <tr><td>每日對戰次數</td><td>3 次</td></tr>
      <tr><td>贏家獎勵點數</td><td>30 ~ 80 點</td></tr>
      <tr><td>輸家獎勵點數</td><td>5 ~ 15 點</td></tr>
      <tr><td>平手獎勵點數</td><td>20 ~ 40 點</td></tr>
      <tr><td>房間過期時間</td><td>24 小時</td></tr>
      <tr><td>推薦碼對戰額外獎勵</td><td>20 點</td></tr>
    </tbody>
  </table>
  <p>會員可建立對戰房間邀請朋友，或加入現有房間。雙方各抽一張牌比大小，點數大的一方獲勝。即使落敗也能獲得安慰獎點數。透過推薦碼邀請的對戰還能獲得額外 20 點獎勵。對戰紀錄儲存在 CardBattles Collection 中。</p>

  <h3>璀璨穿搭挑戰</h3>
  <table>
    <thead>
      <tr><th>項目</th><th>設定值</th></tr>
    </thead>
    <tbody>
      <tr><td>每日次數上限</td><td>5 次</td></tr>
      <tr><td>每次消耗點數</td><td>0 點（免費）</td></tr>
      <tr><td>時間限制</td><td>60 秒</td></tr>
      <tr><td>S 級獎勵</td><td>50 點</td></tr>
      <tr><td>A 級獎勵</td><td>30 點</td></tr>
      <tr><td>B 級獎勵</td><td>15 點</td></tr>
      <tr><td>C 級獎勵</td><td>5 點</td></tr>
      <tr><td>分享獎勵</td><td>10 點</td></tr>
    </tbody>
  </table>
  <p>穿搭挑戰為免費遊戲，會員在限時 60 秒內完成穿搭搭配，系統根據搭配結果評定 S/A/B/C 四個等級並給予對應點數獎勵。完成挑戰後分享至社群媒體可額外獲得 10 點。</p>

  <h3>排行榜與徽章</h3>
  <p>GameLeaderboard Collection 記錄各期間的排行榜資料：</p>
  <table>
    <thead>
      <tr><th>排行榜</th><th>重置週期</th><th>前三名獎勵</th></tr>
    </thead>
    <tbody>
      <tr><td>每日排行榜</td><td>每日 00:00</td><td>100 點</td></tr>
      <tr><td>每週排行榜</td><td>每週一 00:00</td><td>500 點</td></tr>
      <tr><td>每月排行榜</td><td>每月 1 日 00:00</td><td>2,000 點</td></tr>
    </tbody>
  </table>
  <p>排名依據會員當期從所有遊戲獲得的總點數計算。前三名於排行榜重置時自動發放額外獎勵點數。排行榜同時支援每日、每週、每月三種重置週期，可依需求開關。</p>
</div>

<!-- ════════════════════════════════════════════ -->
<!-- SECTION 10: 前台頁面架構                      -->
<!-- ════════════════════════════════════════════ -->
<div class="section" id="s10">
  <span class="section-number">SECTION 10</span>
  <h2 class="section-title">前台頁面架構</h2>

  <h3>頁面路由總覽</h3>
  <table>
    <thead>
      <tr><th>頁面</th><th>路徑</th><th>說明</th></tr>
    </thead>
    <tbody>
      <tr><td>首頁</td><td><code>/</code></td><td>品牌形象頁面，包含 Hero Banner、精選商品、新品上架、熱銷排行、品牌故事、會員權益導覽等區塊</td></tr>
      <tr><td>商品列表</td><td><code>/products</code></td><td>全部商品瀏覽頁，支援分類篩選、價格範圍、排序（最新/價格/熱銷）、搜尋功能</td></tr>
      <tr><td>商品詳情</td><td><code>/products/[slug]</code></td><td>單品詳情頁，包含圖片輪播、價格資訊、變體選擇、加入購物車、商品描述、評價列表、相關推薦</td></tr>
      <tr><td>分類頁面</td><td><code>/collections</code></td><td>商品分類總覽頁面，展示所有頂層分類</td></tr>
      <tr><td>部落格</td><td><code>/blog</code></td><td>品牌部落格列表頁，含穿搭教學、新品介紹、品牌動態等文章</td></tr>
      <tr><td>遊戲中心</td><td><code>/games</code></td><td>小遊戲集合頁面，含每日簽到、幸運轉盤、刮刮樂、卡牌對戰、穿搭挑戰入口</td></tr>
      <tr><td>購物車</td><td><code>/cart</code></td><td>購物車頁面，顯示已加入商品、數量調整、小計、優惠券輸入、點數/購物金折抵</td></tr>
      <tr><td>結帳</td><td><code>/checkout</code></td><td>結帳流程頁面，填寫收件資訊、選擇物流方式、選擇付款方式、確認訂單</td></tr>
      <tr><td>願望清單</td><td><code>/wishlist</code></td><td>我的願望清單頁面，收藏的商品列表</td></tr>
      <tr><td>會員權益</td><td><code>/membership-benefits</code></td><td>會員等級權益說明頁面，展示六個等級的權益差異</td></tr>
      <tr><td>購物指南</td><td><code>/shopping-guide</code></td><td>購物流程說明、尺寸對照、退換貨說明、運費說明</td></tr>
    </tbody>
  </table>

  <h3>會員中心 (/account)</h3>
  <p>登入後的會員個人中心，包含以下子頁面：</p>
  <table>
    <thead>
      <tr><th>子頁面</th><th>功能</th></tr>
    </thead>
    <tbody>
      <tr><td>帳戶總覽</td><td>會員等級、點數餘額、購物金餘額、近期訂單、推薦碼</td></tr>
      <tr><td>訂單記錄</td><td>歷史訂單列表、訂單狀態追蹤、物流查詢</td></tr>
      <tr><td>點數明細</td><td>點數獲取/消耗紀錄、到期點數提醒</td></tr>
      <tr><td>個人資料</td><td>修改姓名、Email、電話、生日、密碼</td></tr>
      <tr><td>地址管理</td><td>地址簿管理，新增/編輯/刪除常用地址</td></tr>
      <tr><td>願望清單</td><td>收藏的商品管理</td></tr>
      <tr><td>推薦好友</td><td>推薦碼分享、推薦成效查看</td></tr>
    </tbody>
  </table>

  <h3>登入與註冊</h3>
  <table>
    <thead>
      <tr><th>頁面</th><th>路徑</th><th>說明</th></tr>
    </thead>
    <tbody>
      <tr><td>消費者登入</td><td><code>/login</code></td><td>Email + 密碼登入，支援 Google/LINE/Facebook 社群登入</td></tr>
      <tr><td>消費者註冊</td><td><code>/register</code></td><td>填寫姓名、Email、密碼、電話、生日，可輸入推薦碼</td></tr>
      <tr><td>管理員登入</td><td><code>/admin-login</code></td><td>管理員與合作夥伴專用登入頁面，成功後導向 <code>/admin</code></td></tr>
    </tbody>
  </table>

  <h3>合作夥伴專區</h3>
  <p>路徑 <code>/partner</code>，合作夥伴登入後可查看推薦成效、分潤報表、推薦連結管理等功能。</p>
</div>

<!-- ════════════════════════════════════════════ -->
<!-- SECTION 11: 技術維護                          -->
<!-- ════════════════════════════════════════════ -->
<div class="section" id="s11">
  <span class="section-number">SECTION 11</span>
  <h2 class="section-title">技術維護</h2>

  <h3>開發環境啟動</h3>
  <pre><code># 1. 安裝依賴套件
pnpm install

# 2. 啟動開發伺服器
pnpm dev

# 開發伺服器預設運行於 http://localhost:3000
# 後台管理介面：http://localhost:3000/admin</code></pre>

  <h3>資料庫初始化</h3>
  <pre><code># 執行所有 Seed 腳本（含分類、商品、範本等初始資料）
npx tsx src/seed/run.ts

# 單獨執行分類 Seed
npx tsx src/seed/seedCategories.ts

# 單獨執行商品 Seed
npx tsx src/seed/seedProducts.ts

# 生成 Excel 範本檔案
npx tsx src/seed/generateTemplates.ts

# 生成本手冊
npx tsx src/seed/generateManual.ts</code></pre>

  <h3>範本下載路徑</h3>
  <table>
    <thead>
      <tr><th>檔案</th><th>路徑</th><th>說明</th></tr>
    </thead>
    <tbody>
      <tr><td>商品上傳範本</td><td><code>/templates/products-upload-template.xlsx</code></td><td>批次上傳商品用的 Excel 範本，含欄位說明</td></tr>
    </tbody>
  </table>

  <h3>環境變數說明</h3>
  <table>
    <thead>
      <tr><th>變數名稱</th><th>必填</th><th>說明</th></tr>
    </thead>
    <tbody>
      <tr><td><code>DATABASE_URI</code></td><td>是</td><td>資料庫連接字串。開發環境可使用 <code>file:./dev.db</code>（SQLite），正式環境使用 PostgreSQL URI</td></tr>
      <tr><td><code>PAYLOAD_SECRET</code></td><td>是</td><td>Payload CMS 的加密金鑰，用於 Token 簽署與資料加密。至少 32 字元的隨機字串</td></tr>
      <tr><td><code>NEXT_PUBLIC_SERVER_URL</code></td><td>是</td><td>網站公開 URL，例如 <code>https://www.ckmu.co</code>，用於產生絕對 URL</td></tr>
      <tr><td><code>ECPAY_MERCHANT_ID</code></td><td>否</td><td>綠界科技商家編號，電子發票功能使用</td></tr>
      <tr><td><code>ECPAY_HASH_KEY</code></td><td>否</td><td>綠界科技 HashKey</td></tr>
      <tr><td><code>ECPAY_HASH_IV</code></td><td>否</td><td>綠界科技 HashIV</td></tr>
    </tbody>
  </table>

  <div class="info-box warning">
    <p class="box-title">安全警告</p>
    <p>環境變數檔案 <code>.env</code> 包含敏感資訊（資料庫密碼、API 金鑰等），絕對不可提交至版本控制系統 (Git)。請確認 <code>.gitignore</code> 中已包含 <code>.env</code>。</p>
  </div>

  <h3>專案目錄結構</h3>
  <pre><code>chickimmiu/
  src/
    app/
      (frontend)/        # 前台頁面 (Next.js App Router)
        account/          # 會員中心
        admin-login/      # 管理員登入
        blog/             # 部落格
        cart/             # 購物車
        checkout/         # 結帳
        collections/      # 分類頁面
        games/            # 遊戲中心
        login/            # 消費者登入
        products/         # 商品頁面
        register/         # 註冊
        partner/          # 合作夥伴專區
        wishlist/         # 願望清單
    collections/          # Payload CMS Collections (34 個)
    globals/              # Payload CMS Globals (10 個)
    access/               # 存取控制函式
    endpoints/            # 自訂 API 端點 (匯入/匯出)
    lib/                  # 共用工具函式
      crm/                # CRM 信用分數邏輯
      invoice/            # 綠界發票引擎
    components/
      admin/              # 後台自訂元件
    seed/                 # Seed 腳本
  public/
    docs/                 # 文件 (含本手冊)
    templates/            # 下載範本</code></pre>

  <h3>常見維護操作</h3>
  <table>
    <thead>
      <tr><th>操作</th><th>指令</th></tr>
    </thead>
    <tbody>
      <tr><td>啟動開發伺服器</td><td><code>pnpm dev</code></td></tr>
      <tr><td>建置正式版本</td><td><code>pnpm build</code></td></tr>
      <tr><td>啟動正式伺服器</td><td><code>pnpm start</code></td></tr>
      <tr><td>資料庫遷移</td><td><code>npx payload migrate</code></td></tr>
      <tr><td>建立遷移檔</td><td><code>npx payload migrate:create</code></td></tr>
      <tr><td>TypeScript 型別檢查</td><td><code>pnpm tsc --noEmit</code></td></tr>
      <tr><td>產生 Payload 型別</td><td><code>npx payload generate:types</code></td></tr>
    </tbody>
  </table>
</div>

<!-- ════════════════════════════════════════════ -->
<!-- FOOTER                                      -->
<!-- ════════════════════════════════════════════ -->
<div class="page-footer">
  <div class="gold-divider"></div>
  <p>CHIC KIM &amp; MIU 靚秀國際有限公司 &mdash; 網站架構說明與使用手冊 v1.0</p>
  <p>本文件為公司內部使用，未經授權不得對外傳閱。</p>
  <p>&copy; 2026 CHIC KIM &amp; MIU. All rights reserved.</p>
</div>

</body>
</html>`
}

// ── Main ──

function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
    console.log(`Created directory: ${OUTPUT_DIR}`)
  }

  const html = generateHTML()
  fs.writeFileSync(OUTPUT_FILE, html, 'utf-8')

  const sizeKB = (Buffer.byteLength(html, 'utf-8') / 1024).toFixed(1)
  console.log(`\n✅ Manual generated successfully!`)
  console.log(`   File: ${OUTPUT_FILE}`)
  console.log(`   Size: ${sizeKB} KB`)
  console.log(`\n   Open in browser and press Ctrl+P to print as PDF.`)
}

main()
