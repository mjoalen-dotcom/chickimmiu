import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * 發票 PDF / HTML 產生器
 * ─────────────────────────────
 * 載入發票資料 + 品牌設定，產生專業的 A4 發票 HTML 或 PDF Buffer
 */

// ── 型別（Payload 回傳為 unknown，手動定義） ──

interface InvoiceItem {
  itemName: string
  itemCount: number
  itemWord: string
  itemPrice: number
  itemAmount: number
  itemTaxType?: string
}

interface InvoiceDoc {
  id: string
  invoiceNumber?: string
  invoiceType: string
  status: string
  totalAmount: number
  salesAmount?: number
  taxAmount?: number
  taxType?: string
  createdAt: string
  invoiceItems: InvoiceItem[]
  buyerInfo: {
    buyerName?: string
    buyerEmail: string
    buyerPhone?: string
    buyerUBN?: string
    buyerCompanyName?: string
    buyerAddress?: string
  }
  carrierInfo?: {
    carrierType?: string
    carrierNumber?: string
  }
  donationInfo?: {
    loveCode?: string
  }
  ecpayResponse?: {
    invoiceNo?: string
    invoiceDate?: string
    randomNumber?: string
    barCode?: string
    qrCodeLeft?: string
    qrCodeRight?: string
  }
  order?: string | { id: string; orderNumber?: string }
  customer?: string | { id: string; name?: string }
}

interface InvoiceSettings {
  sellerInfo?: {
    sellerUBN?: string
    sellerName?: string
    sellerAddress?: string
    sellerPhone?: string
    sellerEmail?: string
  }
  brandingConfig?: {
    invoiceLogo?: string | { url?: string }
    footerText?: string
  }
}

// ── 發票類型中文對照 ──
const INVOICE_TYPE_LABELS: Record<string, string> = {
  b2c_personal: '二聯式（個人）',
  b2c_carrier: '二聯式（載具）',
  b2b: '三聯式（公司）',
  donation: '捐贈發票',
}

const STATUS_LABELS: Record<string, string> = {
  pending: '待開立',
  issued: '已開立',
  void: '已作廢',
  allowance: '已折讓',
  failed: '開立失敗',
  retry: '重試中',
}

const CARRIER_TYPE_LABELS: Record<string, string> = {
  none: '不使用載具',
  phone_barcode: '手機條碼',
  natural_cert: '自然人憑證',
  ecpay_member: '綠界會員載具',
}

// ── 輔助函式 ──

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}/${m}/${day}`
}

function formatCurrency(amount: number | undefined): string {
  if (amount === undefined || amount === null) return 'NT$ 0'
  return `NT$ ${amount.toLocaleString('zh-TW')}`
}

function escapeHtml(str: string | undefined): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ══════════════════════════════════════════════════════════
// ── 產生發票 HTML 模板（用於 PDF 轉換或直接顯示） ──
// ══════════════════════════════════════════════════════════

export async function generateInvoiceHtml(invoiceId: string): Promise<string> {
  const payload = await getPayload({ config })

  // 載入發票資料
  const invoiceRaw = await payload.findByID({
    collection: 'invoices',
    id: invoiceId,
    depth: 2,
  })
  const invoice = invoiceRaw as unknown as InvoiceDoc

  // 載入品牌設定
  const settingsRaw = await payload.findGlobal({ slug: 'invoice-settings' })
  const settings = settingsRaw as unknown as InvoiceSettings

  const seller = settings.sellerInfo || {}
  const branding = settings.brandingConfig || {}

  // Logo URL
  let logoUrl = ''
  if (branding.invoiceLogo) {
    if (typeof branding.invoiceLogo === 'object' && branding.invoiceLogo.url) {
      logoUrl = branding.invoiceLogo.url
    }
  }

  const footerText =
    branding.footerText || '感謝您的購買！CHIC KIM & MIU 靚秀國際有限公司'

  // 訂單編號
  const orderNumber =
    invoice.order && typeof invoice.order === 'object'
      ? (invoice.order as { orderNumber?: string }).orderNumber || String(invoice.order.id)
      : String(invoice.order || '-')

  // 發票日期（優先使用綠界回傳日期）
  const invoiceDate =
    invoice.ecpayResponse?.invoiceDate || formatDate(invoice.createdAt)
  const invoiceNumber = invoice.invoiceNumber || '（待開立）'
  const randomNumber = invoice.ecpayResponse?.randomNumber || '-'

  // 品項
  const items: InvoiceItem[] = invoice.invoiceItems || []

  // 金額
  const totalAmount = invoice.totalAmount || 0
  const salesAmount =
    invoice.salesAmount ?? Math.round(totalAmount / 1.05)
  const taxAmount = invoice.taxAmount ?? totalAmount - salesAmount

  // 載具資訊
  const carrierType = invoice.carrierInfo?.carrierType || 'none'
  const carrierNumber = invoice.carrierInfo?.carrierNumber || ''

  // 捐贈碼
  const loveCode = invoice.donationInfo?.loveCode || ''

  // 條碼 / QR Code
  const barCode = invoice.ecpayResponse?.barCode || ''
  const qrCodeLeft = invoice.ecpayResponse?.qrCodeLeft || ''
  const qrCodeRight = invoice.ecpayResponse?.qrCodeRight || ''

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>電子發票 ${escapeHtml(invoiceNumber)}</title>
  <style>
    /* ── 全域重置 & A4 排版 ── */
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Microsoft JhengHei', 'PingFang TC', 'Noto Sans TC', sans-serif;
      font-size: 13px;
      color: #2c2c2c;
      background: #f5f0e8;
      padding: 20px;
    }
    .invoice-container {
      max-width: 800px;
      margin: 0 auto;
      background: #fffdf7;
      border: 1px solid #d4c9a8;
      border-radius: 4px;
      overflow: hidden;
    }

    /* ── 頂部品牌區 ── */
    .brand-header {
      background: linear-gradient(135deg, #c9a96e 0%, #e8d5a3 50%, #c9a96e 100%);
      padding: 24px 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .brand-header .logo img {
      max-height: 60px;
      max-width: 240px;
    }
    .brand-header .logo-text {
      font-size: 22px;
      font-weight: 700;
      color: #3a2e1a;
      letter-spacing: 2px;
    }
    .brand-header .invoice-title {
      font-size: 20px;
      font-weight: 700;
      color: #3a2e1a;
    }

    /* ── 發票基本資訊 ── */
    .invoice-meta {
      padding: 20px 32px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      border-bottom: 1px solid #e8dcc4;
    }
    .meta-item { display: flex; gap: 8px; }
    .meta-label {
      font-weight: 600;
      color: #8b7748;
      min-width: 100px;
      white-space: nowrap;
    }
    .meta-value { color: #2c2c2c; }
    .status-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }
    .status-issued { background: #d4edda; color: #155724; }
    .status-void { background: #f8d7da; color: #721c24; }
    .status-pending { background: #fff3cd; color: #856404; }
    .status-failed { background: #f8d7da; color: #721c24; }
    .status-allowance { background: #cce5ff; color: #004085; }
    .status-retry { background: #fff3cd; color: #856404; }

    /* ── 買賣方資訊 ── */
    .parties {
      padding: 16px 32px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      border-bottom: 1px solid #e8dcc4;
    }
    .party h3 {
      font-size: 14px;
      color: #c9a96e;
      margin-bottom: 8px;
      border-bottom: 1px solid #e8dcc4;
      padding-bottom: 4px;
    }
    .party p { margin: 3px 0; font-size: 12.5px; line-height: 1.6; }
    .party .label { color: #8b7748; font-weight: 600; }

    /* ── 品項表格 ── */
    .items-section { padding: 16px 32px; }
    .items-section h3 {
      font-size: 14px;
      color: #c9a96e;
      margin-bottom: 10px;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
    }
    .items-table th {
      background: #f0e8d0;
      color: #5a4a2a;
      font-size: 12px;
      font-weight: 600;
      padding: 8px 12px;
      text-align: left;
      border-bottom: 2px solid #c9a96e;
    }
    .items-table th:nth-child(n+3) { text-align: right; }
    .items-table td {
      padding: 8px 12px;
      border-bottom: 1px solid #ede6d4;
      font-size: 12.5px;
    }
    .items-table td:nth-child(n+3) { text-align: right; }
    .items-table tr:last-child td { border-bottom: none; }

    /* ── 金額摘要 ── */
    .amount-summary {
      padding: 16px 32px;
      border-top: 1px solid #e8dcc4;
      display: flex;
      justify-content: flex-end;
    }
    .amount-table {
      width: 280px;
      border-collapse: collapse;
    }
    .amount-table td {
      padding: 5px 12px;
      font-size: 13px;
    }
    .amount-table td:first-child {
      text-align: right;
      color: #8b7748;
      font-weight: 600;
    }
    .amount-table td:last-child { text-align: right; }
    .amount-table .total-row td {
      font-size: 16px;
      font-weight: 700;
      color: #3a2e1a;
      border-top: 2px solid #c9a96e;
      padding-top: 8px;
    }

    /* ── 載具 / 捐贈 / 條碼 ── */
    .extra-info {
      padding: 12px 32px;
      border-top: 1px solid #e8dcc4;
      font-size: 12px;
      color: #6b5e3e;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .barcode-section {
      padding: 16px 32px;
      border-top: 1px solid #e8dcc4;
      text-align: center;
    }
    .barcode-placeholder {
      display: inline-block;
      padding: 8px 16px;
      background: #f8f4ea;
      border: 1px dashed #c9a96e;
      border-radius: 4px;
      font-size: 11px;
      color: #8b7748;
      margin: 4px;
    }

    /* ── 頁尾 ── */
    .invoice-footer {
      background: linear-gradient(135deg, #c9a96e 0%, #e8d5a3 50%, #c9a96e 100%);
      padding: 14px 32px;
      text-align: center;
      font-size: 12px;
      color: #3a2e1a;
      letter-spacing: 1px;
    }

    @media print {
      body { background: #fff; padding: 0; }
      .invoice-container { border: none; border-radius: 0; }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <!-- 品牌頂部 -->
    <div class="brand-header">
      <div class="logo">
        ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="CHIC KIM &amp; MIU" />` : '<span class="logo-text">CHIC KIM &amp; MIU</span>'}
      </div>
      <div class="invoice-title">電子發票</div>
    </div>

    <!-- 發票基本資訊 -->
    <div class="invoice-meta">
      <div class="meta-item">
        <span class="meta-label">發票號碼</span>
        <span class="meta-value">${escapeHtml(invoiceNumber)}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">發票日期</span>
        <span class="meta-value">${escapeHtml(invoiceDate)}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">隨機碼</span>
        <span class="meta-value">${escapeHtml(randomNumber)}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">發票類型</span>
        <span class="meta-value">${escapeHtml(INVOICE_TYPE_LABELS[invoice.invoiceType] || invoice.invoiceType)}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">訂單編號</span>
        <span class="meta-value">${escapeHtml(orderNumber)}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">狀態</span>
        <span class="meta-value">
          <span class="status-badge status-${invoice.status}">${escapeHtml(STATUS_LABELS[invoice.status] || invoice.status)}</span>
        </span>
      </div>
    </div>

    <!-- 買賣方資訊 -->
    <div class="parties">
      <div class="party">
        <h3>賣方資訊</h3>
        <p><span class="label">公司名稱：</span>${escapeHtml(seller.sellerName)}</p>
        <p><span class="label">統一編號：</span>${escapeHtml(seller.sellerUBN)}</p>
        <p><span class="label">地址：</span>${escapeHtml(seller.sellerAddress)}</p>
        ${seller.sellerPhone ? `<p><span class="label">電話：</span>${escapeHtml(seller.sellerPhone)}</p>` : ''}
      </div>
      <div class="party">
        <h3>買方資訊</h3>
        <p><span class="label">姓名：</span>${escapeHtml(invoice.buyerInfo?.buyerName)}</p>
        <p><span class="label">Email：</span>${escapeHtml(invoice.buyerInfo?.buyerEmail)}</p>
        ${invoice.buyerInfo?.buyerPhone ? `<p><span class="label">電話：</span>${escapeHtml(invoice.buyerInfo.buyerPhone)}</p>` : ''}
        ${invoice.buyerInfo?.buyerUBN ? `<p><span class="label">統一編號：</span>${escapeHtml(invoice.buyerInfo.buyerUBN)}</p>` : ''}
        ${invoice.buyerInfo?.buyerCompanyName ? `<p><span class="label">公司名稱：</span>${escapeHtml(invoice.buyerInfo.buyerCompanyName)}</p>` : ''}
        ${invoice.buyerInfo?.buyerAddress ? `<p><span class="label">地址：</span>${escapeHtml(invoice.buyerInfo.buyerAddress)}</p>` : ''}
      </div>
    </div>

    <!-- 品項明細 -->
    <div class="items-section">
      <h3>發票品項</h3>
      <table class="items-table">
        <thead>
          <tr>
            <th style="width:40px">#</th>
            <th>品名</th>
            <th>數量</th>
            <th>單位</th>
            <th>單價</th>
            <th>小計</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td>${escapeHtml(item.itemName)}</td>
            <td style="text-align:right">${item.itemCount}</td>
            <td style="text-align:right">${escapeHtml(item.itemWord || '件')}</td>
            <td style="text-align:right">${formatCurrency(item.itemPrice)}</td>
            <td style="text-align:right">${formatCurrency(item.itemAmount)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <!-- 金額摘要 -->
    <div class="amount-summary">
      <table class="amount-table">
        <tr>
          <td>銷售額（未稅）</td>
          <td>${formatCurrency(salesAmount)}</td>
        </tr>
        <tr>
          <td>稅額（5%）</td>
          <td>${formatCurrency(taxAmount)}</td>
        </tr>
        <tr class="total-row">
          <td>發票金額</td>
          <td>${formatCurrency(totalAmount)}</td>
        </tr>
      </table>
    </div>

    <!-- 載具 / 捐贈資訊 -->
    ${carrierType !== 'none' || loveCode ? `
    <div class="extra-info">
      ${carrierType !== 'none' ? `<div><strong>載具類型：</strong>${escapeHtml(CARRIER_TYPE_LABELS[carrierType] || carrierType)}</div>` : ''}
      ${carrierNumber ? `<div><strong>載具號碼：</strong>${escapeHtml(carrierNumber)}</div>` : ''}
      ${loveCode ? `<div><strong>捐贈碼（愛心碼）：</strong>${escapeHtml(loveCode)}</div>` : ''}
    </div>` : ''}

    <!-- 條碼區域 -->
    ${barCode || qrCodeLeft || qrCodeRight ? `
    <div class="barcode-section">
      ${barCode ? `<div class="barcode-placeholder">一維條碼：${escapeHtml(barCode)}</div>` : ''}
      <div style="margin-top:8px">
        ${qrCodeLeft ? `<span class="barcode-placeholder">QR Code 左：${escapeHtml(qrCodeLeft.substring(0, 30))}...</span>` : ''}
        ${qrCodeRight ? `<span class="barcode-placeholder">QR Code 右：${escapeHtml(qrCodeRight.substring(0, 30))}...</span>` : ''}
      </div>
    </div>` : `
    <div class="barcode-section">
      <div class="barcode-placeholder">一維條碼區域（發票開立後由系統產生）</div>
      <div style="margin-top:8px">
        <span class="barcode-placeholder">QR Code 左</span>
        <span class="barcode-placeholder">QR Code 右</span>
      </div>
    </div>`}

    <!-- 頁尾 -->
    <div class="invoice-footer">
      ${escapeHtml(footerText)}
    </div>
  </div>
</body>
</html>`
}

// ══════════════════════════════════════════════════════════
// ── 產生發票 PDF Buffer（使用 HTML 模板） ──
// ══════════════════════════════════════════════════════════

/**
 * 產生發票 PDF Buffer
 *
 * NOTE: 正式環境建議整合 puppeteer / playwright 或
 *       呼叫外部 HTML-to-PDF 微服務（如 Gotenberg）來產生真正的 PDF 檔案。
 *       目前先以 HTML 內容包裝為 Buffer 回傳，前端可直接以 text/html 顯示或列印。
 *
 * 生產環境升級範例：
 * ```
 * import puppeteer from 'puppeteer'
 * const browser = await puppeteer.launch({ args: ['--no-sandbox'] })
 * const page = await browser.newPage()
 * await page.setContent(html, { waitUntil: 'networkidle0' })
 * const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true })
 * await browser.close()
 * return Buffer.from(pdfBuffer)
 * ```
 */
export async function generateInvoicePdf(invoiceId: string): Promise<Buffer> {
  const html = await generateInvoiceHtml(invoiceId)
  return Buffer.from(html, 'utf-8')
}
