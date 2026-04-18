# -*- coding: utf-8 -*-
"""
Build CKMU technical architecture PDF.
A4, Traditional Chinese via Noto Sans TC.
"""
from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

# ── Fonts ────────────────────────────────────────────────────────────────────
FONT_DIR = Path(r"C:\Windows\Fonts")
pdfmetrics.registerFont(TTFont("NotoTC", str(FONT_DIR / "NotoSansTC-VF.ttf")))
pdfmetrics.registerFont(TTFont("MSJH", str(FONT_DIR / "msjh.ttc"), subfontIndex=0))
pdfmetrics.registerFont(TTFont("MSJHBold", str(FONT_DIR / "msjhbd.ttc"), subfontIndex=0))
# Noto Sans TC is a variable font; use as both regular and bold (renders at weight 400)
pdfmetrics.registerFont(TTFont("NotoTCBold", str(FONT_DIR / "NotoSansTC-VF.ttf")))

BODY_FONT = "NotoTC"
BODY_BOLD = "MSJHBold"
MONO_FONT = "Courier"

# ── Palette (CKMU brand: cream + gold accent) ────────────────────────────────
BRAND_GOLD = colors.HexColor("#C19A5B")
BRAND_CREAM = colors.HexColor("#FDF8F3")
BRAND_DARK = colors.HexColor("#2C2C2C")
BRAND_MUTED = colors.HexColor("#6B6B6B")
BRAND_BORDER = colors.HexColor("#E5DED4")
BRAND_BG_ALT = colors.HexColor("#F8F3EC")

# ── Styles ───────────────────────────────────────────────────────────────────
_base = getSampleStyleSheet()

style_title = ParagraphStyle(
    "Title",
    parent=_base["Title"],
    fontName=BODY_BOLD,
    fontSize=22,
    leading=28,
    textColor=BRAND_DARK,
    spaceAfter=6,
)

style_subtitle = ParagraphStyle(
    "Subtitle",
    parent=_base["Normal"],
    fontName=BODY_FONT,
    fontSize=11,
    leading=16,
    textColor=BRAND_MUTED,
    spaceAfter=12,
)

style_h1 = ParagraphStyle(
    "H1",
    parent=_base["Heading1"],
    fontName=BODY_BOLD,
    fontSize=16,
    leading=22,
    textColor=BRAND_DARK,
    spaceBefore=16,
    spaceAfter=10,
    borderPadding=(0, 0, 4, 0),
)

style_h2 = ParagraphStyle(
    "H2",
    parent=_base["Heading2"],
    fontName=BODY_BOLD,
    fontSize=13,
    leading=18,
    textColor=BRAND_GOLD,
    spaceBefore=12,
    spaceAfter=6,
)

style_body = ParagraphStyle(
    "Body",
    parent=_base["Normal"],
    fontName=BODY_FONT,
    fontSize=10,
    leading=16,
    textColor=BRAND_DARK,
    alignment=TA_LEFT,
    spaceAfter=6,
)

style_muted = ParagraphStyle(
    "Muted",
    parent=style_body,
    fontSize=9,
    leading=14,
    textColor=BRAND_MUTED,
)

style_mono = ParagraphStyle(
    "Mono",
    parent=_base["Code"],
    fontName=MONO_FONT,
    fontSize=8.5,
    leading=12,
    textColor=BRAND_DARK,
    backColor=BRAND_CREAM,
    borderColor=BRAND_BORDER,
    borderWidth=0.5,
    borderPadding=8,
    leftIndent=0,
    rightIndent=0,
    spaceBefore=4,
    spaceAfter=8,
)

style_li = ParagraphStyle(
    "ListItem",
    parent=style_body,
    leftIndent=14,
    bulletIndent=2,
    spaceAfter=2,
)


# ── Helpers ──────────────────────────────────────────────────────────────────
def P(text: str, style=style_body) -> Paragraph:
    return Paragraph(text, style)


def mono_block(code: str) -> Paragraph:
    # reportlab Paragraph needs <br/> for line breaks; preserve whitespace via &nbsp;
    html = (
        code.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace(" ", "&nbsp;")
        .replace("\n", "<br/>")
    )
    return Paragraph(html, style_mono)


def kv_table(rows: list[tuple[str, str]], col1_width=4 * cm) -> Table:
    data = [[P(k, style_body), P(v, style_body)] for k, v in rows]
    t = Table(data, colWidths=[col1_width, None], hAlign="LEFT")
    t.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BACKGROUND", (0, 0), (0, -1), BRAND_BG_ALT),
                ("LINEBELOW", (0, 0), (-1, -2), 0.3, BRAND_BORDER),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return t


def section_divider():
    return Spacer(1, 6 * mm)


# ── Page templates ───────────────────────────────────────────────────────────
def on_first_page(canvas, _doc):
    canvas.saveState()
    # Top gold bar
    canvas.setFillColor(BRAND_GOLD)
    canvas.rect(0, A4[1] - 6 * mm, A4[0], 6 * mm, fill=1, stroke=0)
    # Footer
    canvas.setFont(BODY_FONT, 8)
    canvas.setFillColor(BRAND_MUTED)
    canvas.drawString(20 * mm, 12 * mm, "CHIC KIM & MIU｜靚秀國際有限公司")
    canvas.drawRightString(A4[0] - 20 * mm, 12 * mm, "2026-04-18 ｜技術架構快照")
    canvas.restoreState()


def on_later_pages(canvas, doc):
    canvas.saveState()
    canvas.setFont(BODY_FONT, 8)
    canvas.setFillColor(BRAND_MUTED)
    canvas.drawString(20 * mm, 12 * mm, "CHIC KIM & MIU｜技術架構")
    canvas.drawRightString(A4[0] - 20 * mm, 12 * mm, f"p.{doc.page}")
    # Thin gold top rule
    canvas.setStrokeColor(BRAND_GOLD)
    canvas.setLineWidth(0.6)
    canvas.line(20 * mm, A4[1] - 15 * mm, A4[0] - 20 * mm, A4[1] - 15 * mm)
    canvas.restoreState()


# ── Content ──────────────────────────────────────────────────────────────────
def build_story() -> list:
    story: list = []

    # ═══ Cover ═══════════════════════════════════════════════════════════════
    story.append(Spacer(1, 2 * cm))
    story.append(P("CHIC KIM & MIU", style_title))
    story.append(P("電商平台技術架構快照", style_title))
    story.append(P("pre.chickimmiu.com ｜ 封測期 ｜ 2026-04-18", style_subtitle))
    story.append(Spacer(1, 8 * mm))
    story.append(
        P(
            "本文件記錄當前上線到 Hetzner CPX22 的 Next.js 15.5 + Payload CMS v3 + SQLite 電商平台的技術棧、資料模型、路由、安全層、部署流程，與進行中的 PR 狀態。",
            style_muted,
        )
    )

    story.append(Spacer(1, 10 * mm))

    story.append(P("目錄", style_h2))
    toc_rows = [
        ("1", "核心技術棧"),
        ("2", "Payload Schema（Collections / Globals）"),
        ("3", "前台路由"),
        ("4", "安全層"),
        ("5", "部署與營運"),
        ("6", "Git 當前狀態"),
        ("7", "關鍵資料流"),
    ]
    toc = Table(
        [[P(n, style_body), P(t, style_body)] for n, t in toc_rows],
        colWidths=[1 * cm, None],
        hAlign="LEFT",
    )
    toc.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TEXTCOLOR", (0, 0), (0, -1), BRAND_GOLD),
                ("FONTNAME", (0, 0), (0, -1), BODY_BOLD),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(toc)

    story.append(PageBreak())

    # ═══ Section 1. Core Stack ═══════════════════════════════════════════════
    story.append(P("1. 核心技術棧", style_h1))

    stack_rows = [
        ("Runtime", "Next.js <b>15.5.15</b> + React <b>19</b>（App Router、Server Components）"),
        ("Language", "TypeScript 5.6（strict）— <font face='Courier'>tsc --noEmit</font> 0 err 是 merge 門檻"),
        ("CMS / ORM", "Payload CMS v3（schema 驅動：collection → 自動 REST / GraphQL / admin UI）"),
        (
            "Database",
            "<b>SQLite via libsql</b>（<font face='Courier'>@libsql/client</font> + <font face='Courier'>@payloadcms/db-sqlite</font>）"
            "<br/>prod 檔案 <font face='Courier'>/var/www/chickimmiu/data/chickimmiu.db</font>；<b>不是 Postgres</b>",
        ),
        (
            "Auth",
            "雙軌：NextAuth v5 beta（OAuth：Google / Facebook / LINE / Apple）"
            " + Payload 原生 cookie session（email/pw）。OAuth ↔ Payload cookie 橋接尚未完成。",
        ),
        ("Styling", "Tailwind CSS 3.4 + Radix UI + tailwind-merge + CVA + tailwindcss-animate + framer-motion"),
        ("Icons", "lucide-react"),
        (
            "State",
            "<b>Zustand</b>（cart / wishlist）+ Payload server。Cart 已從純 localStorage 升級到伺服端 Carts "
            "collection + 1s debounced syncToServer（PR #3 <font face='Courier'>f513daa</font>）",
        ),
        ("Image", "Sharp + Payload Media（型別白名單：jpeg / png / webp / gif；PR #4 砍掉 SVG）"),
        ("Payment", "綠界 ECPay（主）+ PayPal（備）+ 電子發票。ECPay callback 拆到 PR #5 另做。"),
        ("Excel", "exceljs — Shopline XLSX 匯入 / 匯出（users / products）"),
        ("Rich text", "@payloadcms/richtext-lexical + UploadFeature（admin 端）"),
    ]

    stack_data = [
        [P(k, style_body), P(v, style_body)] for k, v in stack_rows
    ]
    stack_tbl = Table(stack_data, colWidths=[3.5 * cm, None], hAlign="LEFT")
    stack_tbl.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BACKGROUND", (0, 0), (0, -1), BRAND_BG_ALT),
                ("LINEBELOW", (0, 0), (-1, -2), 0.3, BRAND_BORDER),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(stack_tbl)

    story.append(PageBreak())

    # ═══ Section 2. Schema ════════════════════════════════════════════════════
    story.append(P("2. Payload Schema", style_h1))

    story.append(P("2.1 Collections（共 35 個）", style_h2))

    coll_rows = [
        ("會員", "Users、MembershipTiers、SubscriptionPlans"),
        ("商品", "Products、Categories、ProductReviews、SizeCharts"),
        ("訂單", "Orders、Carts、Returns、Refunds、Exchanges、ShippingMethods、Invoices"),
        ("合作夥伴", "Affiliates"),
        ("內容", "BlogPosts、Pages、UGCPosts"),
        (
            "行銷",
            "PointsRedemptions、MarketingCampaigns、MessageTemplates、"
            "ABTests、MarketingExecutionLogs、FestivalTemplates、BirthdayCampaigns",
        ),
        (
            "CRM",
            "CreditScoreHistory、PointsTransactions、AutomationJourneys、"
            "AutomationLogs、CustomerServiceTickets、MemberSegments",
        ),
        ("VIP 管家", "ConciergeServiceRequests"),
        ("遊戲", "MiniGameRecords、CardBattles、GameLeaderboard"),
        ("媒體", "Media"),
        ("稽核", "LoginAttempts（PR #4，成功登入留 email / ip / UA）"),
    ]
    coll_tbl = Table(
        [[P(k, style_body), P(v, style_body)] for k, v in coll_rows],
        colWidths=[2.6 * cm, None],
        hAlign="LEFT",
    )
    coll_tbl.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BACKGROUND", (0, 0), (0, -1), BRAND_BG_ALT),
                ("LINEBELOW", (0, 0), (-1, -2), 0.3, BRAND_BORDER),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(coll_tbl)

    story.append(P("2.2 Globals（共 15 個，單例設定）", style_h2))
    global_rows = [
        ("站台", "GlobalSettings、HomepageSettings、AboutPageSettings、FAQPageSettings、PolicyPagesSettings、NavigationSettings"),
        ("點數 / 推薦", "LoyaltySettings、ReferralSettings、PointRedemptionSettings"),
        ("CRM", "CRMSettings、SegmentationSettings"),
        ("行銷", "MarketingAutomationSettings、RecommendationSettings"),
        ("營運", "InvoiceSettings、GameSettings"),
    ]
    global_tbl = Table(
        [[P(k, style_body), P(v, style_body)] for k, v in global_rows],
        colWidths=[3 * cm, None],
        hAlign="LEFT",
    )
    global_tbl.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BACKGROUND", (0, 0), (0, -1), BRAND_BG_ALT),
                ("LINEBELOW", (0, 0), (-1, -2), 0.3, BRAND_BORDER),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(global_tbl)

    story.append(PageBreak())

    # ═══ Section 3. Routes ════════════════════════════════════════════════════
    story.append(P("3. 前台路由", style_h1))

    story.append(P("3.1 公開頁（Public）", style_h2))
    story.append(
        mono_block(
            "/                          首頁\n"
            "/products                  商品列表（force-dynamic）\n"
            "/products/[slug]           PDP + AlsoBought + UGC\n"
            "/cart                      購物車（Zustand + server sync）\n"
            "/checkout                  結帳（ECPay callback 待 PR #5）\n"
            "/blog                      BlogPosts（SSG）\n"
            "/terms /privacy-policy     PolicyPagesSettings 驅動\n"
            "/games                     遊樂場入口\n"
        )
    )

    story.append(P("3.2 帳號區（Account，auth gate 於 layout）", style_h2))
    story.append(
        mono_block(
            "/login /register                auth 三連體（PR #1 bd1f5c0）\n"
            "/forgot-password /reset-password\n"
            "\n"
            "/account                        會員首頁\n"
            "  /points                       點數 + FIFO 365d 到期（Phase 5.5.4）\n"
            "  /referrals                    推薦計畫\n"
            "  /subscription                 訂閱方案（N1 378323b）\n"
            "  /wishlist                     願望清單\n"
            "  /orders /addresses /settings  PR #2 真實資料\n"
        )
    )

    story.append(P("3.3 後台與 API", style_h2))
    story.append(
        mono_block(
            "/admin                          Payload admin（BasicAuth 保護，PR #4）\n"
            "/api/users/*                    Payload REST（login / me / PATCH）\n"
            "/api/users/register             custom endpoint（繞 access.create=isAdmin）\n"
            "/api/cart                       GET/POST/DELETE（PR #3 未 merge）\n"
            "/api/shipping-settings          active shipping methods（PR #3 未 merge）\n"
            "/api/auth/[...nextauth]         NextAuth v5\n"
        )
    )

    story.append(PageBreak())

    # ═══ Section 4. Security ═════════════════════════════════════════════════
    story.append(P("4. 安全層", style_h1))
    story.append(
        P(
            "PR #4 <font face='Courier'>96b46cf</font>（chore/security-polish）導入的防護：",
            style_body,
        )
    )
    security_items = [
        "<b>HSTS</b>（僅 prod）+ <b>CSP</b>（含 ECPay / GTM / GA4 allowlist；<font face='Courier'>'unsafe-inline'</font>、<font face='Courier'>'unsafe-eval'</font> 保留給 Next 15 hydration boot script + Payload admin）",
        "<b>COOP / CORP <font face='Courier'>same-origin</font></b> + <font face='Courier'>frame-ancestors 'self'</font>",
        "<b>/admin 專屬 middleware BasicAuth</b>（<font face='Courier'>ADMIN_BASIC_USER</font> / <font face='Courier'>PW</font> env，timing-safe compare）— 可改用 Cloudflare Access",
        "<b>Users.auth</b> <font face='Courier'>maxLoginAttempts=10 / lockTime=10min</font>（Payload 內建暴力破解防禦）",
        "<b>forgotPassword</b> 品牌 email template；未設 SMTP 時 token 會 log 到 server console",
        "<b>Media 硬化</b>：白名單 MIME、8 MB / 50 MB / 10 MB 分型大小、path-traversal block（擋 <font face='Courier'>/ \\ ..</font>）",
        "<b>LoginAttempts</b> collection + afterLogin hook（僅記成功登入：email / userId / ip / UA）",
    ]
    for s in security_items:
        story.append(P(f"• {s}", style_li))

    story.append(P("已知缺口", style_h2))
    story.append(
        P(
            "• <b>Meta Pixel</b>：<font face='Courier'>connect.facebook.net</font> 不在 CSP script-src / connect-src；"
            "若 prod 啟用 <font face='Courier'>NEXT_PUBLIC_META_PIXEL_ID</font> 必須補 allowlist。",
            style_li,
        )
    )
    story.append(
        P(
            "• <b>OAuth ↔ Payload cookie 橋接</b>：NextAuth session-token 與 payload-token 為兩套獨立 cookie。"
            "OAuth 使用者進 <font face='Courier'>/account/**</font> 會被 <font face='Courier'>payload.auth()</font> 拒絕而 redirect 回 /login。",
            style_li,
        )
    )

    story.append(PageBreak())

    # ═══ Section 5. Deploy / Ops ═════════════════════════════════════════════
    story.append(P("5. 部署與營運", style_h1))

    ops_rows = [
        ("Host", "Hetzner CPX22（SIN）Ubuntu"),
        ("Process", "pm2 → <font face='Courier'>chickimmiu-nextjs</font>（<font face='Courier'>pnpm start</font>）"),
        ("Reverse", "nginx → Cloudflare（TLS、cache、WAF）"),
        ("DNS", "pre.chickimmiu.com（封測） → chickimmiu.com（正式）"),
        ("Backup", "每日 sqlite → Cloudflare R2（offsite，2026-04-18 驗證 OK）"),
        (
            "Cron",
            "GitHub Actions scheduler（<font face='Courier'>955883d</font>）呼叫 protected cron endpoints，HMAC-sig header 驗證；不依賴 host crontab",
        ),
    ]
    story.append(kv_table(ops_rows, col1_width=3 * cm))

    story.append(P("部署指令", style_h2))
    story.append(
        mono_block(
            "cd /var/www/chickimmiu\n"
            "git pull\n"
            "pnpm install --frozen-lockfile\n"
            "pnpm build\n"
            "pm2 restart chickimmiu-nextjs"
        )
    )

    story.append(P("環境變數（<font face='Courier'>.env</font> 結構，不含實值）", style_h2))
    story.append(
        mono_block(
            "DATABASE_URI=file:./data/chickimmiu.db\n"
            "PAYLOAD_SECRET=...\n"
            "NEXT_PUBLIC_SITE_URL=https://pre.chickimmiu.com\n"
            "\n"
            "NEXTAUTH_SECRET=...\n"
            "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET\n"
            "FACEBOOK_CLIENT_ID / FACEBOOK_CLIENT_SECRET\n"
            "LINE_CLIENT_ID / LINE_CLIENT_SECRET\n"
            "APPLE_CLIENT_ID / APPLE_CLIENT_SECRET\n"
            "\n"
            "ECPAY_MERCHANT_ID / ECPAY_HASH_KEY / ECPAY_HASH_IV\n"
            "INVOICE_* (ECPay 電子發票)\n"
            "\n"
            "R2_ACCESS_KEY / R2_SECRET / R2_BUCKET   # rotation pending\n"
            "ADMIN_BASIC_USER / ADMIN_BASIC_PW       # /admin middleware gate\n"
            "CRON_HMAC_SECRET                        # GitHub Actions → cron endpoints\n"
        )
    )

    story.append(PageBreak())

    # ═══ Section 6. Git status ═══════════════════════════════════════════════
    story.append(P("6. Git 當前狀態", style_h1))

    story.append(
        P(
            "<b>origin/main HEAD</b>：<font face='Courier'>c39cf89</font>（PR #1 auth + PR #2 security-polish merged）",
            style_body,
        )
    )

    story.append(P("在飛的 PR / Branch", style_h2))

    pr_rows = [
        (
            "feat/commerce-core",
            "PR #3 <font face='Courier'>f513daa</font> — 原子庫存鎖 + 伺服端 Cart + 統一 Shipping API；ECPay Task C 拆 PR #5",
        ),
        (
            "feat/cron-runner",
            "<font face='Courier'>955883d</font> — GitHub Actions cron runner；本機 working tree 還有 commerce 檔案混在此 branch",
        ),
        (
            "feat/member-account-fields",
            "本次新開（未 push）— 身體資料 +4 欄（腳長 / 胸圍 / 腰圍 / 臀圍）+ 公司發票資料 +5 欄",
        ),
        (
            "feat/line-oauth",
            "NextAuth LINE provider（A unblock 已 prod 實測）",
        ),
        (
            "feat/phase5.8-gamification",
            "Phase 5.8 遊戲化 scope（locked decisions 已寫入 GAMIFICATION_SCOPE）",
        ),
    ]
    pr_tbl = Table(
        [[P(k, style_body), P(v, style_body)] for k, v in pr_rows],
        colWidths=[5 * cm, None],
        hAlign="LEFT",
    )
    pr_tbl.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BACKGROUND", (0, 0), (0, -1), BRAND_BG_ALT),
                ("LINEBELOW", (0, 0), (-1, -2), 0.3, BRAND_BORDER),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(pr_tbl)

    story.append(P("Prod 實際運行版本", style_h2))
    story.append(
        P(
            "Prod 目前跑 <font face='Courier'>fa1db25</font>（比 <font face='Courier'>origin/main</font> 舊）。"
            "同步需 <font face='Courier'>git pull + pnpm build + pm2 restart</font>，"
            "使用者需清 browser cache 以釋放舊 immutable chunk。",
            style_body,
        )
    )

    story.append(PageBreak())

    # ═══ Section 7. Data flows ═══════════════════════════════════════════════
    story.append(P("7. 關鍵資料流", style_h1))

    story.append(P("7.1 Email / Password 註冊", style_h2))
    story.append(
        mono_block(
            "POST /api/users/register (custom endpoint, overrideAccess)\n"
            "  → Payload 建立 user\n"
            "  → sign JWT → Set-Cookie payload-token\n"
            "  → router.replace('/account')\n"
        )
    )

    story.append(P("7.2 OAuth 註冊 ／ 登入", style_h2))
    story.append(
        mono_block(
            "signIn('google', { callbackUrl })\n"
            "  → NextAuth → /api/auth/callback/google\n"
            "  → Set-Cookie next-auth.session-token\n"
            "\n"
            "/account/** server\n"
            "  → payload.auth({ headers })   讀 payload-token\n"
            "  → 找不到 → redirect /login      ← cookie 橋接缺口\n"
        )
    )

    story.append(P("7.3 Checkout 到 Order", style_h2))
    story.append(
        mono_block(
            "Cart.items → POST /api/orders\n"
            "  → Orders.beforeChange\n"
            "    · 驗證庫存\n"
            "    · atomic 扣存（req.transaction 帶到 nested product updates）\n"
            "  → ECPay redirect / callback（PR #5 補完）\n"
            "  → Orders.afterChange\n"
            "    · send email\n"
            "    · 產生 Invoice（ECPay 電子發票）\n"
            "    · 記 PointsTransactions（回饋點數 / 購物金）\n"
        )
    )

    story.append(P("7.4 FIFO 點數到期（/account/points）", style_h2))
    story.append(
        mono_block(
            "Promise.all([  ... ,\n"
            "  payload.find({\n"
            "    collection: 'points-transactions',\n"
            "    where: { user: { equals: userId },\n"
            "             createdAt: { greater_than: D-730d } },\n"
            "    pagination: false,\n"
            "    sort: 'createdAt',\n"
            "  })\n"
            "])\n"
            "\n"
            "validityDays = LoyaltySettings.pointsConfig.pointsExpiryDays  // 365\n"
            "windowDays   = max(PointRedemptionSettings.expiryNotification.reminderDays[])\n"
            "\n"
            "→ inline FIFO helper 計算近期到期點數（不讀 PointsTransactions.expiresAt）"
        )
    )

    story.append(Spacer(1, 10 * mm))
    story.append(
        P(
            "本文件為快照。架構與 PR 狀態會隨每日推進而改變，請以最新 git log 與 docs/session-prompts/ 內的交接文件為準。",
            style_muted,
        )
    )

    return story


# ── Main ─────────────────────────────────────────────────────────────────────
def main() -> None:
    out_path = Path(
        r"C:\Users\mjoal\ally-site\chickimmiu\docs\architecture\CKMU_Tech_Architecture_2026-04-18.pdf"
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(
        str(out_path),
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=22 * mm,
        bottomMargin=20 * mm,
        title="CKMU 技術架構 2026-04-18",
        author="CHIC KIM & MIU",
        subject="Technical architecture snapshot",
    )

    doc.build(
        build_story(),
        onFirstPage=on_first_page,
        onLaterPages=on_later_pages,
    )
    print(f"OK: {out_path}  ({out_path.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
