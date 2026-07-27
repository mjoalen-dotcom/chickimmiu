import type { Payload, RequiredDataFromCollectionSlug } from 'payload'
import {
  emailWrapper,
  ntd,
  renderAddress,
  renderItemsTable,
  renderTracking,
  orderAccountUrl,
  adminOrderUrl,
} from './_shared'

/**
 * Email 模板渲染引擎 — 後台可編輯模板系統的核心
 * ──────────────────────────────────────────────
 * 設計原則（零退化）：
 *   - 各 sender 先呼叫 renderEmailFromTemplate(payload, eventKey, vars)
 *   - 有「啟用中」模板 → 用模板（subject/headline/bodyHtml 都跑 {{變數}} 合併，
 *     再用 emailWrapper 套品牌外框）
 *   - 無模板 / 已停用 / 出錯 → 回 null，caller fallback 到現有 hardcoded HTML
 *
 * ⚠️ 本檔**只** import ./_shared（型別 + helper），不 import @payload-config，
 *    避免 payload.config → Users/Orders → sender → renderFromTemplate → config
 *    的模組循環。payload 實例一律由 caller 傳入。
 *
 * 變數合併與 src/lib/marketing/personalizedContent.ts 的 replaceTemplateVariables
 * 同語意（{{key}}，含前後空白容忍），此處內聯避免拉進 marketing 模組圖。
 */

// ══════════════════════════════════════════════════════════
// 事件鍵 + 中文標籤
// ══════════════════════════════════════════════════════════

export const EMAIL_EVENT_KEYS = [
  'welcome',
  'order_confirmation',
  'payment_received',
  'order_shipped',
  'order_delivered',
  'order_cancelled',
  'order_refunded',
  'admin_new_order',
  'auth_verify',
  'auth_forgot_password',
] as const

export type EmailEventKey = (typeof EMAIL_EVENT_KEYS)[number]

export const EMAIL_EVENT_LABELS: Record<EmailEventKey, string> = {
  welcome: '會員歡迎信',
  order_confirmation: '訂單確認信',
  payment_received: '付款完成信',
  order_shipped: '出貨通知信',
  order_delivered: '送達通知信',
  order_cancelled: '訂單取消信',
  order_refunded: '退款通知信',
  admin_new_order: '後台新單提醒（寄給管理員）',
  auth_verify: 'Email 驗證信',
  auth_forgot_password: '重設密碼信',
}

/** 每個事件可用的 {{變數}}（給後台參考用，含純量與「已 render 區塊」） */
export const EMAIL_EVENT_VARIABLES: Record<EmailEventKey, Array<{ name: string; desc: string }>> = {
  welcome: [
    { name: 'customerName', desc: '會員姓名' },
    { name: 'accountUrl', desc: '會員中心連結' },
    { name: 'rewardBlock', desc: '註冊禮區塊（已 render；無則空）' },
  ],
  order_confirmation: [
    { name: 'customerName', desc: '會員姓名' },
    { name: 'orderNumber', desc: '訂單編號' },
    { name: 'statusLine', desc: '訂單狀態句（依付款狀態動態：已付款寫「已收到付款」；未付現金單寫「已成立+收款提示」）' },
    { name: 'total', desc: '應付總額（已格式化 NT$）' },
    { name: 'itemsTable', desc: '商品明細表（已 render）' },
    { name: 'summaryTable', desc: '金額明細（小計/折扣/運費/總額，已 render）' },
    { name: 'paymentLine', desc: '付款方式列（已 render；無則空）' },
    { name: 'addressBlock', desc: '配送資訊（已 render）' },
    { name: 'noteBlock', desc: '顧客備註區塊（已 render；無則空）' },
    { name: 'orderButton', desc: '「查看訂單」按鈕（已 render）' },
  ],
  payment_received: [
    { name: 'customerName', desc: '會員姓名' },
    { name: 'orderNumber', desc: '訂單編號' },
    { name: 'total', desc: '已付總額（已格式化 NT$）' },
    { name: 'paymentLine', desc: '付款方式列（已 render；無則空）' },
    { name: 'orderButton', desc: '「查看訂單」按鈕（已 render）' },
  ],
  order_shipped: [
    { name: 'customerName', desc: '會員姓名' },
    { name: 'orderNumber', desc: '訂單編號' },
    { name: 'itemCount', desc: '商品件數' },
    { name: 'total', desc: '訂單金額（已格式化 NT$）' },
    { name: 'trackingBlock', desc: '物流追蹤區塊（已 render；無則空）' },
    { name: 'addressBlock', desc: '配送資訊（已 render）' },
    { name: 'orderButton', desc: '「查看訂單」按鈕（已 render）' },
  ],
  order_delivered: [
    { name: 'customerName', desc: '會員姓名' },
    { name: 'orderNumber', desc: '訂單編號' },
    { name: 'itemCount', desc: '商品件數' },
    { name: 'orderButton', desc: '「查看訂單 / 評價」按鈕（已 render）' },
  ],
  order_cancelled: [
    { name: 'customerName', desc: '會員姓名' },
    { name: 'orderNumber', desc: '訂單編號' },
    { name: 'itemCount', desc: '商品件數' },
    { name: 'total', desc: '訂單金額（已格式化 NT$）' },
    { name: 'cancelReasonBlock', desc: '取消原因區塊（已 render；無則空）' },
    { name: 'refundNoteBlock', desc: '退還資源區塊（已 render；無則空）' },
    { name: 'orderButton', desc: '「查看訂單」按鈕（已 render）' },
  ],
  order_refunded: [
    { name: 'customerName', desc: '會員姓名' },
    { name: 'orderNumber', desc: '訂單編號' },
    { name: 'refundAmount', desc: '退款金額（已格式化 NT$）' },
    { name: 'refundTarget', desc: '退款去向文字' },
    { name: 'orderButton', desc: '「查看訂單」按鈕（已 render）' },
  ],
  admin_new_order: [
    { name: 'orderNumber', desc: '訂單編號' },
    { name: 'customerName', desc: '顧客姓名' },
    { name: 'customerEmail', desc: '顧客 email' },
    { name: 'itemCount', desc: '件數' },
    { name: 'subtotal', desc: '商品小計（已格式化）' },
    { name: 'total', desc: '訂單金額（已格式化）' },
    { name: 'paymentLabel', desc: '付款方式' },
    { name: 'paymentStatus', desc: '付款狀態' },
    { name: 'shippingLabel', desc: '配送方式' },
    { name: 'addrLine', desc: '地址（單行）' },
    { name: 'itemsListBlock', desc: '商品清單（已 render）' },
    { name: 'noteBlock', desc: '顧客備註區塊（已 render；無則空）' },
    { name: 'adminOrderButton', desc: '「開啟後台訂單」按鈕（已 render）' },
  ],
  auth_verify: [
    { name: 'customerName', desc: '會員姓名' },
    { name: 'verifyUrl', desc: 'Email 驗證連結' },
  ],
  auth_forgot_password: [
    { name: 'customerName', desc: '會員姓名' },
    { name: 'resetUrl', desc: '重設密碼連結' },
  ],
}

// ══════════════════════════════════════════════════════════
// 預設模板（= 各 sender 現有內層 content 抽出，把結構化段落換成 {{區塊}}）
// 一進後台就是現有設計、可微調。enabled 預設 true → seed 後即接管，
// 但因忠實重現現有 HTML，輸出與舊版一致（零退化）。
// ══════════════════════════════════════════════════════════

export interface EmailTemplateDefault {
  name: string
  subject: string
  preheader: string
  headline: string
  bodyHtml: string
}

export const DEFAULT_EMAIL_TEMPLATES: Record<EmailEventKey, EmailTemplateDefault> = {
  welcome: {
    name: '會員歡迎信',
    subject: '【CHIC KIM & MIU】歡迎加入，{{customerName}}',
    preheader: '歡迎加入 CHIC KIM & MIU，您的時尚旅程開始了',
    headline: '歡迎加入 CHIC KIM & MIU',
    bodyHtml: `    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">{{customerName}} 您好，</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">
      歡迎成為 CHIC KIM &amp; MIU 會員！我們為您準備了來自韓國設計的優雅選品，
      以及會員專屬的點數、優惠與生日禮。期待陪您探索每一季的風格。
    </p>

    {{rewardBlock}}

    <div style="text-align:center;margin:24px 0 8px">
      <a href="{{accountUrl}}" style="display:inline-block;background:#c9a961;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px">前往會員中心</a>
    </div>

    <p style="font-size:12px;color:#999;line-height:1.6;margin:16px 0 0;padding-top:16px;border-top:1px solid #eee">
      您可在「我的帳戶」管理訂單、收藏、地址與通知偏好。
    </p>`,
  },
  order_confirmation: {
    name: '訂單確認信',
    subject: '【CHIC KIM & MIU】訂單確認 {{orderNumber}}',
    preheader: '您的訂單 {{orderNumber}} 已成立，明細請見內文',
    headline: '訂單已確認',
    bodyHtml: `    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">{{customerName}} 您好，</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">
      感謝您於 CHIC KIM &amp; MIU 訂購，訂單 <strong>{{orderNumber}}</strong> {{statusLine}}。<br/>
      以下為您的訂單明細，請核對是否正確：
    </p>

    {{itemsTable}}

    {{summaryTable}}

    {{paymentLine}}

    {{addressBlock}}

    {{noteBlock}}

    {{orderButton}}`,
  },
  payment_received: {
    name: '付款完成信',
    subject: '【CHIC KIM & MIU】已收到付款 {{orderNumber}}',
    preheader: '訂單 {{orderNumber}} 付款完成，我們將盡快為您安排出貨',
    headline: '付款完成',
    bodyHtml: `    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">{{customerName}} 您好，</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">
      我們已收到您訂單 <strong>{{orderNumber}}</strong> 的付款
      <strong style="color:#c9a961">{{total}}</strong>，將盡快為您安排出貨。<br/>
      出貨後會再以 Email 通知您物流資訊。
    </p>

    {{paymentLine}}

    {{orderButton}}

    <p style="font-size:12px;color:#999;line-height:1.6;margin:16px 0 0;padding-top:16px;border-top:1px solid #eee">
      點數與會員回饋已同步入帳，可在「我的帳戶」查看。
    </p>`,
  },
  order_shipped: {
    name: '出貨通知信',
    subject: '【CHIC KIM & MIU】訂單已出貨 {{orderNumber}}',
    preheader: '您於 {{orderNumber}} 訂購的 {{itemCount}} 件商品已出貨',
    headline: '您的訂單已出貨',
    bodyHtml: `    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">{{customerName}} 您好，</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">
      您的訂單 <strong>{{orderNumber}}</strong> 已出貨，共 {{itemCount}} 件商品將由物流送達。<br/>
      請留意配送時間，並備妥收件準備。
    </p>

    {{trackingBlock}}

    {{addressBlock}}

    <div style="margin:16px 0;padding:12px 16px;background:#fafafa;border-radius:8px;font-size:13px;color:#666">
      訂單金額：<strong style="color:#c9a961">{{total}}</strong>
    </div>

    {{orderButton}}

    <p style="font-size:12px;color:#999;line-height:1.6;margin:16px 0 0;padding-top:16px;border-top:1px solid #eee">
      若商品有任何損壞或瑕疵，請在簽收後 7 日內透過「我的帳戶 &gt; 我的訂單」申請退換貨。
    </p>`,
  },
  order_delivered: {
    name: '送達通知信',
    subject: '【CHIC KIM & MIU】訂單已送達 {{orderNumber}}',
    preheader: '您於 {{orderNumber}} 訂購的商品已送達',
    headline: '您的訂單已送達',
    bodyHtml: `    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">{{customerName}} 您好，</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">
      您的訂單 <strong>{{orderNumber}}</strong>（{{itemCount}} 件商品）已完成配送。<br/>
      希望您喜歡這次的選品！若方便，歡迎到訂單頁留下穿搭評價，分享給其他會員。
    </p>

    {{orderButton}}

    <p style="font-size:12px;color:#999;line-height:1.6;margin:16px 0 0;padding-top:16px;border-top:1px solid #eee">
      如商品有任何瑕疵，請在簽收後 7 日內透過「我的帳戶 &gt; 我的訂單」申請退換貨。
    </p>`,
  },
  order_cancelled: {
    name: '訂單取消信',
    subject: '【CHIC KIM & MIU】訂單已取消 {{orderNumber}}',
    preheader: '您於 {{orderNumber}} 訂購的訂單已取消',
    headline: '訂單已取消',
    bodyHtml: `    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">{{customerName}} 您好，</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">
      您的訂單 <strong>{{orderNumber}}</strong>（{{itemCount}} 件商品・{{total}}）已取消處理。
    </p>

    {{cancelReasonBlock}}

    {{refundNoteBlock}}

    <p style="font-size:14px;line-height:1.6;margin:16px 0">
      若此次取消並非您本人操作，請立即與客服聯繫。造成不便敬請見諒。
    </p>

    {{orderButton}}`,
  },
  order_refunded: {
    name: '退款通知信',
    subject: '【CHIC KIM & MIU】退款已處理 {{orderNumber}}',
    preheader: '您於 {{orderNumber}} 的退款 {{refundAmount}} 已處理',
    headline: '退款已處理',
    bodyHtml: `    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">{{customerName}} 您好，</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">
      您的訂單 <strong>{{orderNumber}}</strong> 退款已處理完成。
    </p>

    <div style="background:#fff8e7;padding:16px;border-radius:8px;margin:16px 0">
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:14px;margin-bottom:8px">
        <span style="color:#666">退款金額</span>
        <span style="font-size:20px;font-weight:600;color:#c9a961">{{refundAmount}}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:13px;color:#666">
        <span>退款至</span>
        <span>{{refundTarget}}</span>
      </div>
    </div>

    <p style="font-size:13px;color:#666;line-height:1.6;margin:16px 0">
      信用卡退款約需 <strong>5-10 個工作日</strong> 顯示於帳單；ATM / 電子錢包約 <strong>1-3 個工作日</strong>。購物金則即時入帳。
    </p>

    <p style="font-size:14px;line-height:1.6;margin:16px 0">
      若超過預期時間仍未收到退款，請透過客服中心協助查詢。感謝您的支持。
    </p>

    {{orderButton}}`,
  },
  admin_new_order: {
    name: '後台新單提醒',
    subject: '[新單] {{orderNumber}} · {{total}} · {{customerName}}',
    preheader: '{{customerName}} 剛下一張 {{total}} 訂單',
    headline: '新訂單通知',
    bodyHtml: `    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">收到一筆新訂單，請盡快處理。</p>

    <div style="background:#fafafa;padding:16px;border-radius:8px;margin:16px 0;font-size:14px;line-height:1.8">
      <div><strong style="color:#c9a961">{{orderNumber}}</strong></div>
      <div style="margin-top:8px">
        顧客：{{customerName}} {{customerEmail}}<br/>
        件數：{{itemCount}} 件<br/>
        商品小計：{{subtotal}}<br/>
        訂單金額：<strong style="color:#c9a961">{{total}}</strong><br/>
        付款：{{paymentLabel}}（{{paymentStatus}}）<br/>
        配送：{{shippingLabel}}<br/>
        地址：{{addrLine}}
      </div>
    </div>

    {{itemsListBlock}}

    {{noteBlock}}

    {{adminOrderButton}}`,
  },
  auth_verify: {
    name: 'Email 驗證信',
    subject: 'CHIC KIM & MIU｜請驗證您的 Email',
    preheader: '請點擊連結完成 Email 驗證',
    headline: '歡迎加入 CHIC KIM & MIU',
    bodyHtml: `    <p style="margin:0 0 16px;font-size:14px;line-height:1.7">{{customerName}}，您好</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.7">
      感謝您註冊 CHIC KIM &amp; MIU 會員。請點以下按鈕或連結完成 email 驗證，驗證後即可登入帳號享受會員專屬優惠：
    </p>
    <div style="text-align:center;margin:24px 0">
      <a href="{{verifyUrl}}" style="display:inline-block;padding:12px 28px;background:#c9a961;color:#fff;border-radius:999px;text-decoration:none;font-size:14px">驗證 Email</a>
    </div>
    <p style="margin:0 0 8px;font-size:12px;color:#6B6B6B;line-height:1.6">連結無法點擊請複製：</p>
    <p style="margin:0 0 16px;font-size:12px;word-break:break-all;color:#6B6B6B">{{verifyUrl}}</p>
    <p style="margin:16px 0 0;font-size:12px;color:#6B6B6B;line-height:1.6">若您未申請註冊，請忽略此信。</p>`,
  },
  auth_forgot_password: {
    name: '重設密碼信',
    subject: 'CHIC KIM & MIU｜重設密碼請求',
    preheader: '我們收到您的重設密碼請求',
    headline: '重設密碼',
    bodyHtml: `    <p style="margin:0 0 16px;font-size:14px;line-height:1.7">{{customerName}}，您好</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.7">
      我們收到您的重設密碼請求。請點以下按鈕或連結在 1 小時內完成重設：
    </p>
    <div style="text-align:center;margin:24px 0">
      <a href="{{resetUrl}}" style="display:inline-block;padding:12px 28px;background:#c9a961;color:#fff;border-radius:999px;text-decoration:none;font-size:14px">重設密碼</a>
    </div>
    <p style="margin:0 0 8px;font-size:12px;color:#6B6B6B;line-height:1.6">連結無法點擊請複製：</p>
    <p style="margin:0 0 16px;font-size:12px;word-break:break-all;color:#6B6B6B">{{resetUrl}}</p>
    <p style="margin:16px 0 0;font-size:12px;color:#6B6B6B;line-height:1.6">若您未發起此請求，請忽略此信，您的密碼不會改變。</p>`,
  },
}

// ══════════════════════════════════════════════════════════
// 變數合併（{{key}}，與 personalizedContent.replaceTemplateVariables 同語意）
// ══════════════════════════════════════════════════════════

function replaceVars(template: string, vars: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(vars)) {
    const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g')
    result = result.replace(pattern, value ?? '')
  }
  // 清掉未提供的 {{未知變數}} 殘留（避免寄出帶 {{x}} 字面）
  result = result.replace(/\{\{\s*[\w.]+\s*\}\}/g, '')
  return result
}

// ══════════════════════════════════════════════════════════
// 核心：載入啟用中模板 → 合併 → emailWrapper
// ══════════════════════════════════════════════════════════

export interface RenderedEmail {
  subject: string
  html: string
}

export interface EmailTemplateParts {
  subject?: string
  preheader?: string
  headline?: string
  bodyHtml?: string
}

/**
 * 用一組模板欄位 + vars 合併成 { subject, html }（html 已套 emailWrapper 外框）。
 * 給 renderEmailFromTemplate / renderDefaultTemplate / 後台預覽（含停用模板）共用。
 */
export function renderTemplateParts(
  parts: EmailTemplateParts,
  vars: Record<string, string>,
): RenderedEmail {
  const subject = replaceVars(String(parts.subject || ''), vars)
  const headline = replaceVars(String(parts.headline || ''), vars)
  const preheader = replaceVars(String(parts.preheader || ''), vars)
  const content = replaceVars(String(parts.bodyHtml || ''), vars)
  return { subject, html: emailWrapper({ headline, preheader, content }) }
}

/**
 * 依事件鍵載入啟用中模板並用 vars 合併。
 * 無模板 / 已停用 / 出錯 → 回 null（caller fallback 到現有 hardcoded HTML）。
 */
export async function renderEmailFromTemplate(
  payload: Payload,
  eventKey: EmailEventKey,
  vars: Record<string, string>,
): Promise<RenderedEmail | null> {
  try {
    const res = await payload.find({
      collection: 'email-templates',
      where: { eventKey: { equals: eventKey }, enabled: { equals: true } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const tpl = res.docs?.[0] as EmailTemplateParts | undefined
    if (!tpl || !tpl.bodyHtml) return null
    return renderTemplateParts(tpl, vars)
  } catch (err) {
    console.error(`[renderEmailFromTemplate] ${eventKey} 失敗，fallback:`, err)
    return null
  }
}

/**
 * 直接用「預設模板」+ vars 渲染（不查 DB）。給預覽 / fallback 用。
 */
export function renderDefaultTemplate(
  eventKey: EmailEventKey,
  vars: Record<string, string>,
): RenderedEmail {
  return renderTemplateParts(DEFAULT_EMAIL_TEMPLATES[eventKey], vars)
}

// ══════════════════════════════════════════════════════════
// 懶 seed：補齊缺少的事件預設模板（冪等；已存在的 eventKey 不動）
// ══════════════════════════════════════════════════════════

/**
 * 確保 9 種事件各有一筆模板列。已存在的 eventKey 略過（不覆蓋 admin 編輯）。
 * 回傳本次新建的 eventKey 清單。後台預覽 view 進入時呼叫，prod 無需手動 seed。
 */
export async function ensureDefaultEmailTemplates(payload: Payload): Promise<EmailEventKey[]> {
  const created: EmailEventKey[] = []
  for (const eventKey of EMAIL_EVENT_KEYS) {
    try {
      const existing = await payload.find({
        collection: 'email-templates',
        where: { eventKey: { equals: eventKey } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (existing.totalDocs > 0) continue
      const def = DEFAULT_EMAIL_TEMPLATES[eventKey]
      await payload.create({
        collection: 'email-templates',
        data: {
          name: def.name,
          eventKey,
          enabled: true,
          subject: def.subject,
          preheader: def.preheader,
          headline: def.headline,
          bodyHtml: def.bodyHtml,
          previewSample: buildScalarSample(eventKey),
        } as unknown as RequiredDataFromCollectionSlug<'email-templates'>,
        overrideAccess: true,
      })
      created.push(eventKey)
    } catch (err) {
      console.error(`[ensureDefaultEmailTemplates] seed ${eventKey} 失敗:`, err)
    }
  }
  return created
}

// ══════════════════════════════════════════════════════════
// 預覽樣本：建立完整 vars（純量 + 已 render 區塊），給後台預覽 / 測試寄送
// ══════════════════════════════════════════════════════════

const SAMPLE_ITEMS = [
  { productName: '韓系針織開衫', variant: '駝色 / M', quantity: 1, subtotal: 1880 },
  { productName: '高腰百褶長裙', variant: '酒紅 / S', quantity: 2, subtotal: 2360 },
]
const SAMPLE_ADDRESS = {
  recipientName: '王小美',
  phone: '0912-345-678',
  zipCode: '106',
  city: '台北市',
  district: '大安區',
  address: '忠孝東路四段 1 號 5 樓',
}
const SAMPLE_SHIPPING = {
  methodName: '宅配到府',
  estimatedDays: '2-3 個工作日',
  trackingNumber: 'CKMU-SAMPLE-0001',
  trackingUrl: 'https://example.com/track/CKMU-SAMPLE-0001',
}

/** 純量樣本（存進 previewSample / 後台可改） */
function buildScalarSample(eventKey: EmailEventKey): Record<string, string> {
  const base: Record<string, string> = {
    customerName: '王小美',
    orderNumber: 'CKMU20260609001',
    total: ntd(4240),
    itemCount: '3',
  }
  switch (eventKey) {
    case 'welcome':
      return { customerName: base.customerName }
    case 'payment_received':
      return { customerName: base.customerName, orderNumber: base.orderNumber, total: base.total }
    case 'order_refunded':
      return { customerName: base.customerName, orderNumber: base.orderNumber, refundAmount: ntd(4240), refundTarget: '原付款帳戶 (信用卡)' }
    case 'admin_new_order':
      return {
        ...base,
        customerEmail: '&lt;wang@example.com&gt;',
        subtotal: ntd(4240),
        paymentLabel: '綠界科技 ECPay',
        paymentStatus: 'paid',
        shippingLabel: '宅配到府',
        addrLine: '台北市大安區 忠孝東路四段 1 號 5 樓',
      }
    case 'auth_verify':
      return { customerName: base.customerName }
    case 'auth_forgot_password':
      return { customerName: base.customerName }
    default:
      return base
  }
}

/**
 * 建立完整預覽 vars：純量樣本 + 用 _shared helper 即時 render 的區塊。
 * 後台 previewSample（純量覆寫）可疊加在這之上。
 */
export function buildSampleVars(eventKey: EmailEventKey): Record<string, string> {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://pre.chickimmiu.com').replace(/\/$/, '')
  const scalar = buildScalarSample(eventKey)
  const orderButton = `<div style="text-align:center;margin:24px 0 8px"><a href="${orderAccountUrl(1)}" style="display:inline-block;background:#c9a961;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px">查看訂單</a></div>`

  switch (eventKey) {
    case 'welcome':
      return {
        ...scalar,
        accountUrl: `${siteUrl}/account`,
        rewardBlock: `<div style="background:#fff8e7;padding:14px 16px;border-radius:8px;margin:16px 0;font-size:13px;line-height:1.8"><div style="color:#666;margin-bottom:6px">新會員見面禮已入帳：</div><div>• 點數 100 點</div><div>• 購物金 NT$ 100</div></div>`,
      }
    case 'order_confirmation':
      return {
        ...scalar,
        statusLine: '已成立！我們將盡快安排出貨，商品送達時再以現金付款給配送員即可',
        itemsTable: renderItemsTable(SAMPLE_ITEMS),
        summaryTable: `<div style="margin:16px 0;padding:12px 0;border-top:1px solid #eee;font-size:14px"><div style="display:flex;justify-content:space-between;margin:4px 0"><span>商品小計</span><span>${ntd(4240)}</span></div><div style="display:flex;justify-content:space-between;margin:8px 0 0;padding-top:8px;border-top:1px solid #eee;font-weight:600;font-size:16px"><span>應付總額</span><span style="color:#c9a961">${ntd(4240)}</span></div></div>`,
        paymentLine: `<div style="font-size:13px;color:#666;margin:8px 0">付款方式：綠界科技 ECPay</div>`,
        addressBlock: renderAddress(SAMPLE_ADDRESS, SAMPLE_SHIPPING),
        noteBlock: '',
        orderButton,
      }
    case 'payment_received':
      return {
        ...scalar,
        paymentLine: `<div style="font-size:13px;color:#666;margin:8px 0">付款方式：綠界科技 ECPay</div>`,
        orderButton,
      }
    case 'order_shipped':
      return {
        ...scalar,
        trackingBlock: renderTracking(SAMPLE_SHIPPING),
        addressBlock: renderAddress(SAMPLE_ADDRESS, SAMPLE_SHIPPING),
        orderButton,
      }
    case 'order_delivered':
      return { ...scalar, orderButton }
    case 'order_cancelled':
      return {
        ...scalar,
        cancelReasonBlock: `<div style="background:#fafafa;padding:12px 16px;border-radius:8px;margin:16px 0;font-size:13px;color:#666"><strong>取消原因：</strong> 顧客申請取消</div>`,
        refundNoteBlock: `<div style="background:#fff8e7;padding:14px 16px;border-radius:8px;margin:16px 0;font-size:13px;line-height:1.8"><div style="color:#666;margin-bottom:6px">已使用資源將退還至您的帳戶：</div><div>• 點數 50 點</div></div>`,
        orderButton,
      }
    case 'order_refunded':
      return { ...scalar, orderButton }
    case 'admin_new_order':
      return {
        ...scalar,
        itemsListBlock: `<div style="margin:16px 0"><div style="font-size:13px;color:#666;margin-bottom:6px">商品清單：</div><ul style="margin:0;padding:0 0 0 18px"><li style="margin:4px 0;font-size:13px;color:#555">韓系針織開衫 x1 · ${ntd(1880)}</li><li style="margin:4px 0;font-size:13px;color:#555">高腰百褶長裙 x2 · ${ntd(2360)}</li></ul></div>`,
        noteBlock: '',
        adminOrderButton: `<div style="text-align:center;margin:24px 0 8px"><a href="${adminOrderUrl(1)}" style="display:inline-block;background:#c9a961;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px">開啟後台訂單</a></div>`,
      }
    case 'auth_verify':
      return { ...scalar, verifyUrl: `${siteUrl}/verify-email?token=SAMPLE_TOKEN` }
    case 'auth_forgot_password':
      return { ...scalar, resetUrl: `${siteUrl}/reset-password?token=SAMPLE_TOKEN` }
    default:
      return scalar
  }
}
