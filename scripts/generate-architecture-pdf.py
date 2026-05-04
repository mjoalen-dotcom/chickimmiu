#!/usr/bin/env python3
"""
Generate the pre.chickimmiu.com comprehensive architecture PDF.

v2 — 2026-05-04 audit refresh：
- 補上自 2026-04-21 PDF 後 63 個 commit 帶來的新 Collections / Globals /
  Migrations / Routes / Modules
- 為 Collections / Globals / Routes / Migrations / Roadmap 補上完成度狀態欄
- 新增章節：內容生態、廣告追蹤、客服中心 v1、個性化系統、後台 Admin 體驗

Status semantics（用於本文件）：
- 完成   = schema + hooks/邏輯就緒 + 前/後台串通 + 有 seed 或實際資料流
- 施工中 = 部分就緒，仍缺 seed / hooks / UI / 串接
- 規劃中 = 僅 schema scaffold 或 handoff 文件（未動工）
- 已棄用 = collection 仍在但被新版取代
"""

import os
import subprocess
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle, KeepTogether
)

# ---------------------------------------------------------------------------
# Font registration (Traditional Chinese)
# ---------------------------------------------------------------------------

FONT = 'CJK'
FONT_BOLD = 'CJK-Bold'


def register_cjk_fonts():
    global FONT, FONT_BOLD
    fonts = 'C:/Windows/Fonts'
    reg_candidates = [
        (os.path.join(fonts, 'msjh.ttc'), 0),
        (os.path.join(fonts, 'mingliu.ttc'), 0),
        (os.path.join(fonts, 'simsun.ttc'), 0),
    ]
    bold_candidates = [
        (os.path.join(fonts, 'msjhbd.ttc'), 0),
    ]

    ok = False
    for path, idx in reg_candidates:
        if not os.path.exists(path):
            continue
        try:
            kwargs = {'subfontIndex': idx} if idx is not None else {}
            pdfmetrics.registerFont(TTFont('CJK', path, **kwargs))
            ok = True
            print(f'[font] regular -> {path}')
            break
        except Exception as exc:
            print(f'[font] skip regular {path}: {exc}')
    if not ok:
        from reportlab.pdfbase.cidfonts import UnicodeCIDFont
        pdfmetrics.registerFont(UnicodeCIDFont('MSung-Light'))
        FONT = 'MSung-Light'
        print('[font] regular -> MSung-Light (CID fallback)')

    ok = False
    for path, idx in bold_candidates:
        if not os.path.exists(path):
            continue
        try:
            kwargs = {'subfontIndex': idx} if idx is not None else {}
            pdfmetrics.registerFont(TTFont('CJK-Bold', path, **kwargs))
            ok = True
            print(f'[font] bold    -> {path}')
            break
        except Exception:
            pass
    if not ok:
        FONT_BOLD = FONT


register_cjk_fonts()

# ---------------------------------------------------------------------------
# Color tokens
# ---------------------------------------------------------------------------

NAVY = colors.HexColor('#1e3a5f')
ACCENT = colors.HexColor('#b8860b')
SUBTLE = colors.HexColor('#f5f2eb')
BORDER = colors.HexColor('#d9d2c0')
INK = colors.HexColor('#1a1a1a')
MUTE = colors.HexColor('#666666')
GREEN = colors.HexColor('#2d8a3e')
ORANGE = colors.HexColor('#c97a14')
GRAY = colors.HexColor('#777777')
RED = colors.HexColor('#9c2828')


def style(name, font=None, size=10, leading=None, alignment=0,
          space_before=0, space_after=4, left_indent=0, text_color=INK):
    return ParagraphStyle(
        name=name,
        fontName=font or FONT,
        fontSize=size,
        leading=leading or size * 1.4,
        alignment=alignment,
        spaceBefore=space_before,
        spaceAfter=space_after,
        leftIndent=left_indent,
        textColor=text_color,
        wordWrap='CJK',
    )


ST_COVER_TITLE = style('CoverTitle', font=FONT_BOLD, size=30, alignment=1,
                       space_after=14, text_color=NAVY)
ST_COVER_SUB = style('CoverSub', size=15, alignment=1, text_color=MUTE,
                     space_after=6)
ST_COVER_META = style('CoverMeta', size=10, alignment=1, text_color=MUTE)
ST_H1 = style('H1', font=FONT_BOLD, size=18, space_before=18, space_after=10,
              text_color=NAVY)
ST_H2 = style('H2', font=FONT_BOLD, size=13, space_before=10, space_after=6,
              text_color=NAVY)
ST_H3 = style('H3', font=FONT_BOLD, size=11, space_before=6, space_after=4,
              text_color=colors.HexColor('#2a2a2a'))
ST_BODY = style('Body', size=10, leading=14, space_after=6)
ST_BODY_BOLD = style('BodyBold', font=FONT_BOLD, size=10, leading=14)
ST_NOTE = style('Note', size=9, leading=12, text_color=MUTE, left_indent=10,
                space_after=4)
ST_CELL = style('Cell', size=8.3, leading=11)
ST_CELL_BOLD = style('CellBold', font=FONT_BOLD, size=8.3, leading=11)
ST_CELL_MONO = style('CellMono', size=7.8, leading=10,
                     text_color=colors.HexColor('#222222'))
ST_TOC = style('TOC', size=10.5, leading=15, space_after=3)
ST_TOC_H1 = style('TOCH1', font=FONT_BOLD, size=11, leading=15, space_after=3)


def P(text, s=ST_CELL):
    return Paragraph(str(text), s)


def B(text):
    return P(text, ST_CELL_BOLD)


def M(text):
    return P(text, ST_CELL_MONO)


_STATUS_COLOR = {
    '完成': GREEN,
    '施工中': ORANGE,
    '規劃中': GRAY,
    '已棄用': RED,
    '已收尾': GREEN,
    '部分': ORANGE,
}


def S(label):
    color = _STATUS_COLOR.get(label, INK)
    s = ParagraphStyle(
        name=f'Status-{label}',
        fontName=FONT_BOLD,
        fontSize=8.3,
        leading=11,
        alignment=1,
        textColor=color,
        wordWrap='CJK',
    )
    return Paragraph(label, s)


# ---------------------------------------------------------------------------
# Table helper
# ---------------------------------------------------------------------------

BASE_TABLE_STYLE = TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), NAVY),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
    ('FONTNAME', (0, 0), (-1, 0), FONT_BOLD),
    ('FONTSIZE', (0, 0), (-1, 0), 9),
    ('LEADING', (0, 0), (-1, 0), 12),
    ('ALIGN', (0, 0), (-1, 0), 'LEFT'),
    ('LEFTPADDING', (0, 0), (-1, -1), 5),
    ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ('TOPPADDING', (0, 0), (-1, -1), 4),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ('GRID', (0, 0), (-1, -1), 0.3, BORDER),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, SUBTLE]),
    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
])


def make_table(rows, col_widths, header=True):
    data = []
    if header:
        data.append([P(c, ST_CELL_BOLD) if not hasattr(c, 'style') else c
                     for c in rows[0]])
        body = rows[1:]
    else:
        body = rows
    for r in body:
        data.append([c if hasattr(c, 'style') else P(c) for c in r])
    t = Table(data, colWidths=col_widths, repeatRows=1 if header else 0)
    t.setStyle(BASE_TABLE_STYLE)
    return t


PAGE_MARGIN = 18 * mm
CONTENT_W = A4[0] - 2 * PAGE_MARGIN


def on_page(canvas, doc):
    canvas.saveState()
    page = doc.page
    if page > 1:
        canvas.setFont(FONT, 8)
        canvas.setFillColor(MUTE)
        canvas.drawString(PAGE_MARGIN,
                          10 * mm,
                          'pre.chickimmiu.com 架構與技術文件 v2')
        canvas.drawRightString(A4[0] - PAGE_MARGIN,
                               10 * mm,
                               f'{page}')
        canvas.setStrokeColor(BORDER)
        canvas.setLineWidth(0.3)
        canvas.line(PAGE_MARGIN, 13 * mm, A4[0] - PAGE_MARGIN, 13 * mm)
    canvas.restoreState()


def git_sha():
    try:
        out = subprocess.check_output(
            ['git', 'rev-parse', '--short=10', 'HEAD'],
            stderr=subprocess.DEVNULL).decode().strip()
        return out
    except Exception:
        return 'unknown'


# ---------------------------------------------------------------------------
# Content datasets
# ---------------------------------------------------------------------------

# Collections — tuple = (slug, 中文名, status, 用途)
COLLECTIONS = [
    # ① 訂單與物流
    ('orders', '訂單', '完成',
     '原子庫存扣減；訂單編號自動產生；面交地址；CSV/Excel 匯出（PR #125）；批量發貨（PR #128）'),
    ('returns', '退貨單', '完成', 'reason / condition / tracking；user 僅見自己'),
    ('exchanges', '換貨單', '完成', '同退貨 workflow；新舊商品雙 ref'),
    ('refunds', '退款紀錄', '完成', '金額/方式/狀態；可關聯 return / exchange'),
    ('shipping-methods', '運送方式', '完成',
     '8 種：宅配 / 7-11 / 全家 / 萊爾富 / 新竹 / 門市取貨 / 面交；滿額免運'),
    ('invoices', '電子發票', '完成', 'ECPay 開立/作廢/折讓；二聯/三聯/捐贈；自動寄送 PDF'),
    # ② 商品管理
    ('products', '商品', '完成',
     '變體 SKU；原子庫存；MBTI 推薦；韓星代言（PR #154）；總銷量統計（PR #154）'),
    ('categories', '商品分類', '完成', '多層樹狀；Shopline 風格拖曳管理（PR #90）'),
    ('size-charts', '尺寸對照表', '完成', 'chest / waist / length cm；商品關聯'),
    ('site-themes', '站台主題', '完成',
     'PR #119：7 色系 + 4 hero variants + Canva 風格 picker；setActiveTheme 可切換'),
    # ③ 會員與 CRM
    ('users', '使用者', '完成',
     '會員 / 員工 / 合作夥伴；身體量測 schema 完備；UI 待補；'
     '生日 / 出生時間（PR #102 #103）；MBTI64 profile；wishlist / addresses'),
    ('membership-tiers', '會員等級', '完成', '6 層；男女稱號分離（frontNameMale）'),
    ('membership-tier-descriptions', '等級權益描述', '完成', '前台展示文案'),
    ('points-transactions', '點數異動', '完成', '正負異動；FIFO 365 天到期'),
    ('points-redemptions', '點數兌換紀錄', '完成',
     'Phase 5.5.4 接通實體商品兌換 (PR #109) end-to-end'),
    ('user-rewards', '使用者獎勵', '完成', '遊戲/活動 item；claim 狀態'),
    ('credit-score-history', '信用分數歷史', '完成', '準時付款 / 退貨率 / chargeback 加權'),
    ('member-segments', '會員分群', '完成', 'RFM / tier / 行為；cron 排程更新'),
    ('subscription-plans', '訂閱方案', '完成', 'Spark / VIP / Diamond'),
    ('affiliates', '合作夥伴', '完成', 'Influencer / commission / withdraw'),
    ('concierge-service-requests', 'VIP 管家服務', '完成',
     '前台 /account/concierge 為 demo 資料'),
    ('login-attempts', '登入嘗試', '完成', '成功登入 audit；失敗由 Payload 鎖定'),
    # ④ 行銷推廣
    ('coupons', '優惠券', '完成', 'code 唯一；usageLimit + perUser；afterChange 累計'),
    ('coupon-redemptions', '優惠券兌換紀錄', '完成', '每次使用記錄'),
    ('marketing-campaigns', '行銷活動', '完成', 'campaign 統括'),
    ('marketing-execution-logs', '行銷執行日誌', '完成',
     '發送紀錄 / open / click rate（被自動化流程寫入）'),
    ('automation-journeys', '自動化旅程', '完成',
     '14 預定義流程（PR #132）seed：註冊/首購/升等/生日/棄車...'),
    ('automation-logs', '自動化執行日誌', '完成', '每次觸發紀錄；成功/失敗/重試'),
    ('birthday-campaigns', '生日活動', '完成', '生日月自動觸發'),
    ('festival-templates', '節慶活動範本', '完成', '七夕 / 聖誕 / 跨年'),
    ('message-templates', '訊息範本', '施工中', 'EDM/SMS/LINE/Push 結構在；缺管理 UI 與測試'),
    ('add-on-products', '加購商品', '完成', '結帳加購；isAddOn=true'),
    ('bundles', '商品組合', '施工中', 'PDP /bundles/[slug] 完整；admin builder UI 待補'),
    ('gift-rules', '禮物規則', '完成', '滿額贈；replaceGifts() 動態更新'),
    ('ab-tests', 'A/B 測試', '規劃中', 'schema scaffold；測試引擎未實作'),
    ('product-view-events', '商品瀏覽事件', '完成',
     'PR #158：UTM 來源 / utm_*/referrer / 30 秒去重；訂單歸因用'),
    ('utm-campaigns', 'UTM 活動', '完成',
     'PR #158：slug 中心化；後台報表 + UTM Builder'),
    # ⑤ 互動體驗（遊戲化）
    ('mini-game-records', '小遊戲紀錄', '完成',
     '輪盤/翻牌/連消/抽獎/簽到/MBTI 等；dailyQuota'),
    ('card-battles', '卡牌對戰紀錄', '完成', 'player1 vs player2'),
    ('game-leaderboard', '遊戲排行榜', '完成', '週/月/年快取；cron 驅動'),
    ('collectible-cards', '造型卡實例', '完成',
     '4 種 mint 途徑 / 5 種 status；transfer/burn/craft API（PR #84）'),
    ('collectible-card-templates', '造型卡藍圖', '完成', 'common / limited 上限'),
    ('collectible-card-events', '卡片事件日誌', '完成', '可追溯 mint/burn/transfer/craft'),
    ('style-submissions', '穿搭作品', '完成',
     '8 種 UGC 遊戲共用：pk/relay/challenge/co-create/blind-box/queen-vote/team/wish'),
    ('style-game-rooms', '穿搭遊戲房間', '完成', '房間類遊戲容器'),
    ('style-votes', '穿搭投票', '完成', 'voter → target submission'),
    ('style-wishes', '穿搭許願', '完成', 'wisher 許願；多 submission 回應'),
    ('daily-horoscopes', '每日星座運勢', '完成',
     'PR #101：Groq LLM lazy 生成 + seed fallback；/account 顯示穿搭推薦'),
    # ⑥ 內容與頁面
    ('pages', 'CMS 頁面', '完成',
     'Lexical + magazine blocks（PR #138）；5 quick-start templates（PR #134）'),
    ('blog-posts', '部落格文章', '完成', '品牌故事 / 教學 / 季節文'),
    ('podcasts', 'Podcast', '完成',
     'PR #157：episode + audio player + show notes + related products'),
    ('media', '媒體資源', '完成',
     '顯式白名單 [jpeg/png/webp/gif]；payload-folders 樹狀瀏覽（PR #126/137/141）；'
     'alt 自動填（PR #129）'),
    ('product-reviews', '商品評價', '完成', '需購買驗證；helpful votes'),
    ('ugc-posts', '外部社群 UGC', '完成', 'IG / TikTok 聚合'),
    # ⑦ 客服中心 v1
    ('conversations', '對話', '完成',
     'CS Phase 1A 基礎 schema（PR #149）：CS-YYYY-NNNNN 編號；SLA / priority / assignee'),
    ('messages', '對話訊息', '完成', '隸屬 conversation；雙向訊息歷史'),
    ('message-tags', '對話標籤', '完成', '分類 tag；color；filter 用'),
    ('conversation-activities', '對話活動日誌', '完成', '指派 / 升級 / 結案 audit'),
    ('customer-service-tickets', '客服工單 v0', '已棄用',
     'admin.hidden；資料保留；由 Conversations 取代'),
]

# Globals
GLOBALS = [
    ('global-settings', '全站設定', '完成',
     'logo / SEO / GA / GTM / Pixel / Cookie 同意 / emailAuth / 支付開關 / 客服資訊'),
    ('navigation-settings', '導航', '完成', 'Header main nav / footer'),
    ('homepage-settings', '首頁', '完成', 'Hero / featured / seasonal / newsletter'),
    ('about-page-settings', 'About', '完成',
     '品牌故事 / 願景 / 創辦人 / 團隊 / gallery（lightbox PR #105）'),
    ('faq-page-settings', 'FAQ', '完成', 'Q&A 集合 + 分類'),
    ('policy-pages-settings', '政策頁面', '完成', '隱私 / 條款 / 退貨 / 運費'),
    ('checkout-settings', '結帳', '完成', 'COD 手續費 / 最低金額 / 禮物包裝'),
    ('order-settings', '訂單', '完成', '訂單編號格式 / 自動確認 / 取消時限'),
    ('tax-settings', '稅率', '完成', '台灣 5%；計稅前/後切換'),
    ('invoice-settings', '電子發票', '完成', 'ECPay 特店資訊 / 自動開立'),
    ('loyalty-settings', '忠誠度計畫', '完成', '點數倍率 / 各等級 / 生日禮 / 評價獎勵'),
    ('point-redemption-settings', '兌換心理學', '完成', '到期提醒 / 限時加倍 / 稀缺'),
    ('referral-settings', '推薦計畫', '完成', '獎勵額度 / 防濫用'),
    ('recommendation-settings', 'AI 推薦引擎', '完成',
     '三階段（瀏覽/購物車/購後）權重；hook NOP（/products force-dynamic）'),
    ('crm-settings', 'CRM 系統', '完成', '信用分數權重 / AI 路由'),
    ('segmentation-settings', '會員分群', '完成', 'RFM 權重 / 分群門檻 / 排程頻率'),
    ('marketing-automation-settings', '行銷自動化', '完成', '通道優先 / A/B 流量'),
    ('game-settings', '遊戲系統', '完成', '各遊戲免費次數 / 獎勵池 / 排行榜重置'),
    ('ads-catalog-settings', '廣告商品目錄', '完成',
     'PR #150：Meta Catalog + Google Shopping feed 設定；fallback 預設值'),
    ('customer-service-settings', '客服系統', '完成',
     'PR #149：營業時間 / SLA 規則 / AI 提示詞'),
]

# Migrations — full list, latest first sort
MIGRATIONS = [
    # 2026-05 新增
    ('20260504_163000_add_podcasts', 'Podcasts collection + audio schema', '新'),
    ('20260504_150000_add_mbti64_occasion', 'MBTI64 4 occasion 細分', '新'),
    ('20260504_140000_add_redemption_max_discount', '點數兌換上限', '新'),
    ('20260504_120000_add_mbti_quiz', 'MBTI 28 題 + 4 lifestyle 欄位', '新'),
    ('20260504_100000_add_total_sold_and_korean_celebrity',
     '銷量統計 + 韓星代言欄位', '新'),
    # 2026-04 後半新增
    ('20260429_180000_add_utm_attribution',
     'ProductViewEvents + UTMCampaigns + Orders.attribution + Users.firstTouch', '新'),
    ('20260429_120000_add_ads_catalog', 'AdsCatalogSettings global', '新'),
    ('20260428_074640_add_customer_service_v1',
     'Conversations + Messages + MessageTags + ConversationActivities + Settings', '新'),
    ('20260427_220000_add_pages_magazine_blocks', 'Pages magazine blocks', '新'),
    ('20260427_180000_enable_payload_folders', 'payload-folders 啟用', '新'),
    ('20260427_100000_add_site_themes', 'SiteThemes collection + 4 hero variants', '新'),
    ('20260426_140000_add_points_mall_shipping',
     'Points mall 物流 / fulfillment 欄位', '新'),
    ('20260426_130000_add_users_birth_time', 'Users.birthTime / birthDate', '新'),
    ('20260426_120000_add_daily_horoscopes', 'DailyHoroscopes collection', '新'),
    # 既有
    ('20260422_200000_fix_policy_returns_notice_title', 'PolicyPagesSettings 小修', '舊'),
    ('20260422_100000_add_coupons', 'Coupons + CouponRedemptions', '舊'),
    ('20260422_000000_add_promo_trio', 'AddOnProducts + Bundles + GiftRules', '舊'),
    ('20260421_200000_add_checkout_order_settings',
     'CheckoutSettings + OrderSettings', '舊'),
    ('20260421_120000_add_collectible_cards', 'CollectibleCard 三件套', '舊'),
    ('20260421_100000_add_tax', 'TaxSettings global', '舊'),
    ('20260420_200000_add_about_vision_and_gallery',
     'AboutPageSettings.vision + gallery', '舊'),
    ('20260420_140000_add_global_settings_payment_cod_and_email_auth',
     'emailAuth + 支付開關', '舊'),
    ('20260420_130000_add_style_wishes', 'StyleWishes', '舊'),
    ('20260420_120000_add_style_votes', 'StyleVotes', '舊'),
    ('20260420_110000_add_style_game_rooms', 'StyleGameRooms', '舊'),
    ('20260420_100000_add_style_submissions', 'StyleSubmissions', '舊'),
    ('20260419_235500_add_membership_tier_descriptions', '等級詳細描述', '舊'),
    ('20260419_230000_add_orders_gifts', 'Orders.giftInfo + GiftRules', '舊'),
    ('20260419_210000_add_user_rewards', 'UserRewards collection', '舊'),
    ('20260419_200000_add_invoice_profiles', 'Invoices.profile B2C/B2B', '舊'),
    ('20260419_180000_add_cod_fee', 'codFeePercentage', '舊'),
    ('20260419_110000_add_media_folder', 'Media folder 結構', '舊'),
    ('20260419_100000_add_email_verification', '_verified + email verify', '舊'),
    ('20260418_230000_add_body_and_invoice_fields',
     'Users 身體量測 / 發票欄位', '舊'),
    ('20260418_220000_add_login_attempts', 'LoginAttempts collection', '舊'),
    ('20260417_100000_add_stored_value_balance', 'storedValueBalance', '舊'),
    ('20260416_193835_add_daily_checkin_streak', 'dailyCheckinStreak', '舊'),
    ('20260416_140000_add_gender_and_male_tier_name',
     'gender + frontNameMale', '舊'),
    ('20260415_112142_add_size_charts', 'SizeCharts collection', '舊'),
]

# Frontend routes — (path, purpose, status, dynamic)
FRONT_ROUTES = [
    ('/', '首頁（hero / featured / newsletter）', '完成', 'static'),
    ('/about', '品牌故事 + 願景 + gallery（lightbox）', '完成', 'static'),
    ('/contact', '聯絡表單', '完成', 'static'),
    ('/terms', '服務條款', '完成', 'static'),
    ('/privacy-policy', '隱私權政策', '完成', 'static'),
    ('/return-policy', '退貨政策', '完成', 'static'),
    ('/shopping-guide', '購物指南', '完成', 'static'),
    ('/size-guide', '尺寸指南', '完成', 'static'),
    ('/packaging', '包裝資訊', '完成', 'static'),
    ('/membership-benefits', '會員權益', '完成', 'static'),
    ('/credit-score', '信用分數頁', '完成', 'dynamic'),
    ('/faq', '常見問題', '完成', 'static'),
    ('/products', '商品列表（過濾僅顯示啟用分類）', '完成', 'force-dynamic'),
    ('/products/[slug]', '商品詳情（PDP）', '完成', 'force-dynamic'),
    ('/bundles', '組合商品列表', '完成', 'static'),
    ('/bundles/[slug]', '組合商品詳情', '完成', 'dynamic'),
    ('/collections', '主題集合', '完成', 'static'),
    ('/collections/[slug]', '集合詳情', '完成', 'dynamic'),
    ('/pages/[slug]', 'CMS 動態頁', '完成', 'dynamic'),
    ('/blog', '部落格列表', '完成', 'static'),
    ('/blog/[slug]', '部落格文章', '完成', 'dynamic'),
    ('/podcast', 'Podcast 列表', '完成', 'dynamic'),
    ('/podcast/[slug]', 'Podcast 單集', '完成', 'dynamic'),
    ('/cart', '購物車', '完成', 'dynamic'),
    ('/checkout', '結帳（含面交 / COD）', '完成', 'dynamic'),
    ('/checkout/success/[orderId]', '訂單成功頁', '完成', 'dynamic'),
    ('/wishlist', '收藏清單（公開 legacy）', '完成', 'dynamic'),
    ('/account', '會員儀表板（horoscope / 為你挑選）', '完成', 'dynamic'),
    ('/account/orders', '訂單列表', '完成', 'dynamic'),
    ('/account/orders/[id]', '訂單詳情', '完成', 'dynamic'),
    ('/account/subscription', '訂閱管理', '完成', 'dynamic'),
    ('/account/returns', '退貨列表', '完成', 'dynamic'),
    ('/account/returns/new', '申請退貨', '完成', 'dynamic'),
    ('/account/exchanges/new', '申請換貨', '完成', 'dynamic'),
    ('/account/addresses', '地址簿', '完成', 'dynamic'),
    ('/account/points', '點數中心（FIFO + 物品兌換）', '完成', 'dynamic'),
    ('/account/invoices', '電子發票', '完成', 'dynamic'),
    ('/account/reviews', '我的評價', '完成', 'dynamic'),
    ('/account/wishlist', '收藏管理', '完成', 'dynamic'),
    ('/account/referrals', '推薦好友', '完成', 'dynamic'),
    ('/account/cards', '造型卡（NFT）', '完成', 'dynamic'),
    ('/account/treasure', '勳章 & 寶物', '完成', 'dynamic'),
    ('/account/personality', 'MBTI64 個性穿搭分析', '完成', 'dynamic'),
    ('/account/settings', '帳號設定（生日 / 出生時間）', '完成', 'dynamic'),
    ('/account/segments', '會員分群', '完成', 'dynamic'),
    ('/account/analytics', '購買分析', '施工中', 'dynamic'),
    ('/account/marketing', '行銷偏好', '施工中', 'dynamic'),
    ('/account/concierge', 'VIP 禮賓', '施工中', 'dynamic'),
    ('/account/crm-dashboard', 'CRM 儀表板', '施工中', 'dynamic'),
    ('/games', '遊戲中心首頁', '完成', 'static'),
    ('/games/[slug]', '單一遊戲（動態）', '完成', 'dynamic'),
    ('/games/daily-checkin', '每日簽到', '完成', 'dynamic'),
    ('/games/spin-wheel', '幸運轉盤', '完成', 'dynamic'),
    ('/games/scratch-card', '刮刮樂', '完成', 'dynamic'),
    ('/games/card-battle', '卡牌對戰', '完成', 'dynamic'),
    ('/games/mbti-style', 'MBTI 個性穿搭測驗', '完成', 'dynamic'),
    ('/partner', '合作夥伴首頁', '完成', 'static'),
    ('/partner/earnings', '收益查詢', '完成', 'dynamic'),
    ('/partner/referrals', '推薦統計', '完成', 'dynamic'),
    ('/partner/withdraw', '提現管理', '完成', 'dynamic'),
    ('/login', '登入（Email/pw + OAuth）', '完成', 'static'),
    ('/register', '註冊（含生日 / 條款）', '完成', 'static'),
    ('/forgot-password', '忘記密碼', '完成', 'static'),
    ('/reset-password', '重設密碼', '完成', 'dynamic'),
    ('/verify-email', 'Email 驗證', '完成', 'dynamic'),
    ('/admin-login', '管理員登入', '完成', 'static'),
    ('/preview/templates/[id]', 'Pages 樣板預覽（admin only）', '完成', 'dynamic'),
    ('/diag', '系統診斷', '完成', 'dynamic'),
]

# API routes — (path, method, purpose, status)
API_ROUTES = [
    ('/api/auth/[...nextauth]', 'GET/POST', 'NextAuth v5（Google/Facebook/LINE/Apple）', '完成'),
    ('/api/auth/bridge', 'GET',
     'OAuth → Payload cookie 橋接；loop guard / stale JWE 清理 / sessions record（PR #95/#107/#108）',
     '完成'),
    ('/api/account/avatar', 'POST/DELETE', '頭像上傳/清除；MIME 白名單 8MB', '完成'),
    ('/api/cart/add-ons', 'POST', '加購品項', '完成'),
    ('/api/cart/apply-coupon', 'POST', '套用優惠券', '完成'),
    ('/api/cart/gifts', 'POST', '贈品兌換', '完成'),
    ('/api/checkout-settings', 'GET', '前台結帳設定 + 支付選項', '完成'),
    ('/api/payment-settings', 'GET', '金流方案（ECPay / LINE Pay）', '完成'),
    ('/api/shipping-settings', 'GET', '運送方式 + 運費（single source）', '完成'),
    ('/api/contact', 'POST', '聯絡表單', '完成'),
    ('/api/exchanges', 'POST', '換貨申請', '完成'),
    ('/api/returns', 'POST', '退貨申請', '完成'),
    ('/api/user-rewards/consume', 'POST', '兌換獎勵 / 扣點', '完成'),
    ('/api/admin/orders/bulk-ship', 'POST', '批量發貨（PR #128）', '完成'),
    ('/api/admin/orders/export', 'GET', '訂單 CSV/Excel 匯出（PR #125）', '完成'),
    ('/api/horoscope/today', 'GET',
     '今日星座運勢 + 穿搭推薦（Groq LLM + seed fallback）（PR #101）', '完成'),
    ('/api/games/mbti/play', 'POST',
     'MBTI 28 題 + 4 lifestyle → mbtiProfile + 商品推薦（PR #154）', '完成'),
    ('/api/games/mbti/suggest-product-types', 'GET', 'MBTI 推商品分類', '完成'),
    ('/api/utm/track', 'POST',
     '商品瀏覽事件 + UTM 來源（30s 去重 + Cloudflare header）（PR #158）', '完成'),
    ('/api/feeds/meta.xml', 'GET', 'Meta Catalog 商品目錄 feed（PR #150）', '完成'),
    ('/api/feeds/google.xml', 'GET', 'Google Shopping 商品目錄 feed（PR #150）', '完成'),
    ('/api/audit/schema', 'GET', '審計用 schema 健檢（Bearer auth）（PR #99/#100）', '完成'),
    ('/api/cron/auto-cancel-orders', 'POST', '逾期未付款訂單', '完成'),
    ('/api/cron/expire-points', 'POST', '點數過期', '完成'),
    ('/api/cron/segments', 'POST', '會員分群重算', '完成'),
    ('/api/cron/automations', 'POST', '行銷自動化觸發（每 5 分）', '完成'),
    ('/api/cron/streak-decay', 'POST', '簽到 streak 衰減', '完成'),
    ('/api/cron/annual-tier-reset', 'POST', '會員等級年度重置', '完成'),
    ('/api/graphql', 'POST', 'Payload GraphQL', '完成'),
    ('/api/[...slug]', '*', 'Payload REST catch-all', '完成'),
    ('/api/ecpay/aio-checkout', 'POST', 'ECPay AioCheckOut 表單提交', '規劃中'),
    ('/api/ecpay/callback', 'POST', 'ECPay 付款結果 callback', '規劃中'),
]

PAYLOAD_ENDPOINTS = [
    ('/api/users/register', 'POST',
     '客戶自助註冊（overrideAccess 繞 isAdmin）；含生日 / 出生時間'),
    ('/api/users/logout', 'POST', '冪等清 payload-token cookie'),
    ('/api/users/export', 'POST', 'Excel 匯出會員'),
    ('/api/users/import', 'POST', 'Excel 匯入會員'),
    ('/api/users/member-analytics', 'POST', 'LTV / RFM / cohort 聚合'),
    ('/api/users/repeat-purchase-analytics', 'POST', '重購率分析'),
    ('/api/categories/category-tree-reorder', 'POST',
     '分類樹拖曳後批次儲存 parent + sortOrder'),
    ('/api/products/revalidate-all', 'POST', '手動觸發 ISR 重建'),
    ('/api/shopline/import-xlsx', 'POST', 'Shopline 商品批次匯入'),
    ('/api/shopline/seed-categories', 'POST', 'Shopline 分類同步'),
    ('/api/media/import-from-url', 'POST',
     '供應商圖片匯入工具（PR #111）：URL → media collection'),
]


# ---------------------------------------------------------------------------
# Build sections
# ---------------------------------------------------------------------------

def cover(story, sha):
    story.append(Spacer(1, 60 * mm))
    story.append(Paragraph('PRE.CHICKIMMIU.COM', ST_COVER_TITLE))
    story.append(Paragraph('完整架構與技術文件 v2', ST_COVER_SUB))
    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph('台灣時尚女裝電商 · Next.js 15 + Payload CMS v3', ST_COVER_META))
    story.append(Paragraph('含完成度狀態盤點：完成 / 施工中 / 規劃中', ST_COVER_META))
    story.append(Spacer(1, 50 * mm))
    story.append(Paragraph(f'文件日期：{datetime.now().strftime("%Y-%m-%d")}',
                           ST_COVER_META))
    story.append(Paragraph(f'對應 git SHA：{sha}（main 分支）', ST_COVER_META))
    story.append(Paragraph(
        '上線狀態：封測中 · Stage 1–5 完成 · Stage 6 大部份完成 · '
        '客服中心 / 廣告系統 / ECPay 進行中', ST_COVER_META))
    story.append(PageBreak())


def toc(story):
    story.append(Paragraph('目錄', ST_H1))
    items = [
        ('1', '專案概覽（含本次更新摘要）'),
        ('2', '技術棧'),
        ('3', '部署架構'),
        ('4', '資料模型 — Collections（含完成度）'),
        ('5', '資料模型 — Globals（含完成度）'),
        ('6', 'Migration 歷史'),
        ('7', '後端 API 路由'),
        ('8', 'Payload 自訂 Endpoints'),
        ('9', '前台路由（含完成度）'),
        ('10', '認證流程'),
        ('11', '商務流程（購物車 → 結帳 → 訂單）'),
        ('12', '促銷、會員與遊戲化'),
        ('13', '內容生態（Pages 模板 / SiteThemes / Podcasts）'),
        ('14', '廣告與行銷追蹤（Pixel / CAPI / Catalog / UTM）'),
        ('15', '客服中心 v1（CS Phase 1A）'),
        ('16', '個性化系統（MBTI / Horoscope / AI）'),
        ('17', '後台 Admin 體驗（8-group sidebar / 中文化 / nav jitter）'),
        ('18', '安全強化'),
        ('19', '營運與監控'),
        ('20', '已知議題與 Roadmap（v2 大量更新）'),
        ('21', '附錄：關鍵資訊索引'),
    ]
    rows = []
    for num, title in items:
        rows.append([P(num, ST_TOC_H1), P(title, ST_TOC)])
    t = Table(rows, colWidths=[15 * mm, CONTENT_W - 15 * mm])
    t.setStyle(TableStyle([
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
    ]))
    story.append(t)
    story.append(PageBreak())


def section_overview(story):
    story.append(Paragraph('1. 專案概覽', ST_H1))
    story.append(Paragraph(
        'chickimmiu（CHIC KIM & MIU）為台灣原生女裝設計品牌；'
        'pre.chickimmiu.com 為官方電商前導站（pre-launch / closed beta）。'
        '本站持續以「越完整越好」原則推進，封測期間 schema-first 設計，'
        '功能模組以 PR 為單位平行迭代。',
        ST_BODY))

    story.append(Paragraph('1.1 v2 文件更新摘要（自 2026-04-21 起 63 個 commits）', ST_H2))
    story.append(Paragraph(
        '<b>新增 collections（10）：</b>SiteThemes、Podcasts、DailyHoroscopes、'
        'Conversations、Messages、MessageTags、ConversationActivities、'
        'ProductViewEvents、UTMCampaigns，加上 payload-folders 變為可見 collection。',
        ST_BODY))
    story.append(Paragraph(
        '<b>新增 globals（2）：</b>AdsCatalogSettings、CustomerServiceSettings。',
        ST_BODY))
    story.append(Paragraph(
        '<b>新增 migrations（14）：</b>含 daily horoscopes / users birth time / '
        'site themes / payload folders / magazine blocks / customer service v1 / '
        'ads catalog / utm attribution / mbti quiz / mbti64 occasion / '
        'redemption max discount / podcasts。',
        ST_BODY))
    story.append(Paragraph(
        '<b>新增大功能模組：</b>個性化（MBTI 28 題 + MBTI64 + 每日星座運勢）、'
        '廣告系統（Meta Catalog / Pixel + CAPI / UTM 歸因）、客服中心 v1 schema、'
        'Podcast、Pages 5 quick-start templates、SiteThemes 主題切換、'
        'Points-mall 實體商品兌換 end-to-end、Bulk ship 與 CSV/Excel 匯出。',
        ST_BODY))
    story.append(Paragraph(
        '<b>後台 Admin 大改造：</b>從 18 group → 8 group sidebar、'
        '23 collections 中文化、lucide icons、nav scroll-persist N2.4、'
        'demo seed 一鍵產資料、Pages template picker。',
        ST_BODY))
    story.append(Paragraph(
        '<b>已知議題大量收尾：</b>P0 header 登入狀態 + 登出按鈕（PR #127）、'
        'P1 OAuth bridge redirect / loop / stale JWE（PR #95/#107/#108）、'
        'P2 SMTP（Resend adapter）、P4 Apple Sign In code 就位（待 Dev Program）。',
        ST_BODY))

    story.append(Paragraph('1.2 6-Stage Roadmap 現況', ST_H2))
    roadmap = [
        ['階段', '主題', '狀態'],
        ['Stage 1', '基礎商城（商品 / 購物車 / 結帳 / 訂單）', S('完成')],
        ['Stage 2', '會員系統（auth / tiers / points / addresses）', S('完成')],
        ['Stage 3', '行銷（coupons / referral / automation）', S('完成')],
        ['Stage 4', '遊戲化（mini-games / cards / leaderboard / MBTI）', S('完成')],
        ['Stage 5', 'CMS + 後台強化 + 分類樹 UI + 促銷三件套', S('完成')],
        ['Stage 6', 'Email 驗證 / OAuth 收尾 / 身體量測 UI', S('部分')],
    ]
    story.append(make_table(roadmap, [25 * mm, CONTENT_W - 55 * mm, 30 * mm]))
    story.append(Paragraph(
        'Stage 6 子項：<b>Email 驗證</b> 完成（Resend adapter）、'
        '<b>OAuth 收尾</b> 完成、<b>身體量測 UI</b> 規劃中（schema 已完備）。',
        ST_NOTE))

    story.append(Paragraph('1.3 關鍵 URL 與主機', ST_H2))
    urls = [
        ['類型', '位置'],
        ['Production', 'https://pre.chickimmiu.com'],
        ['Admin', 'https://pre.chickimmiu.com/admin（BasicAuth 閘）'],
        ['Source', 'GitHub: mjoalen-dotcom/chickimmiu（main 分支）'],
        ['Prod Host', 'Hetzner CPX22 SIN · 5.223.85.14'],
        ['Deploy', 'ssh root@5.223.85.14 /root/deploy-ckmu.sh（PR #139 強化）'],
    ]
    story.append(make_table(urls, [30 * mm, CONTENT_W - 30 * mm]))
    story.append(PageBreak())


def section_tech_stack(story):
    story.append(Paragraph('2. 技術棧', ST_H1))
    rows = [
        ['層級', '套件', '版本', '角色'],
        ['Framework', 'Next.js', '15.5.15', 'App Router · SSR/SSG · ISR · Middleware'],
        ['', 'React', '19.0.0', 'Client Components + Server Components'],
        ['CMS', 'Payload', '3.83.0', 'Collections / Globals / Auth / Admin UI'],
        ['', '@payloadcms/db-sqlite', '3.83.0', 'DB adapter'],
        ['', '@payloadcms/richtext-lexical', '3.83.0', 'Lexical 富文本 + magazine blocks'],
        ['Auth', 'next-auth', '5.0.0-beta.25',
         'OAuth（Google / Facebook / LINE / Apple）+ JWE'],
        ['Email', '@payloadcms/email-resend', '—', 'Resend adapter；prod 需設 RESEND_API_KEY'],
        ['State', 'zustand', '5.0.12', 'cart / wishlist；LocalStorage 持久化'],
        ['Styling', 'tailwindcss', '3.4.14', 'Utility-first'],
        ['', 'lucide-react', '—', '8-group sidebar icons + UI 圖示'],
        ['Animation', 'framer-motion', '11.11.0', '頁面與元件動畫'],
        ['Imaging', 'sharp', '0.33.5', '圖像處理 pipeline'],
        ['Audio', 'react audio player（Podcasts）', '—', 'Podcast 單集播放器'],
        ['LLM', 'Groq SDK', '—',
         '/api/horoscope/today 文案生成；fallback 至 seed'],
        ['Data I/O', 'exceljs', '4.4.0', 'Shopline / 會員 / 訂單 Excel'],
    ]
    story.append(make_table(rows,
        [25 * mm, 42 * mm, 25 * mm, CONTENT_W - 92 * mm]))
    story.append(Paragraph('Node 執行環境需求：≥ 18.20.2', ST_NOTE))
    story.append(Paragraph(
        '資料庫：<b>SQLite 本機檔</b>（<i>data/chickimmiu.db</i>，每日 R2 備份）。',
        ST_NOTE))
    story.append(PageBreak())


def section_deploy(story):
    story.append(Paragraph('3. 部署架構', ST_H1))
    story.append(Paragraph(
        '單機 VPS + pm2 fork mode；nginx 反向代理；SQLite 與應用程式同機；'
        'PR #139 重新同步 deploy-prod.sh 並把 .next/cache 清理 baked 進腳本。',
        ST_BODY))

    rows = [
        ['項目', '規格'],
        ['雲端供應商', 'Hetzner'],
        ['機型', 'CPX22（2 vCPU / 4 GB RAM / 40 GB NVMe）'],
        ['地區', '新加坡 (SIN)'],
        ['IP', '5.223.85.14'],
        ['反向代理', 'nginx（TLS · HTTP/2 · gzip · security headers passthrough）'],
        ['Process', 'pm2 chickimmiu-nextjs · max_memory_restart 1500M'],
        ['Swap', '2 GB（OOM 事件 2026-04-21 後加設）'],
        ['DB', 'SQLite /var/www/chickimmiu/data/chickimmiu.db'],
        ['媒體', 'public/media/ 本機 + R2 日備份'],
    ]
    story.append(make_table(rows, [35 * mm, CONTENT_W - 35 * mm]))

    story.append(Paragraph('3.1 部署腳本流程（v2 強化）', ST_H2))
    steps = [
        ['步驟', '指令', '備註'],
        ['1', 'git fetch origin --prune && git reset --hard origin/main',
         '紀錄 SHA 供 rollback'],
        ['2', 'pnpm install --frozen-lockfile', '鎖定版本'],
        ['3', 'rm -rf .next/cache', 'PR #139 加：清舊 chunk / 圖片快取防 stale'],
        ['4', 'yes y | pnpm payload migrate',
         '以 yes 餵 Payload dev-mode prompt；PIPESTATUS 判 exit'],
        ['5', 'pnpm build', '不刪整個 .next（content-hash 共存）'],
        ['6', 'pm2 restart chickimmiu-nextjs --update-env',
         '等 4 秒 → 清 orphan next-server'],
        ['7', 'curl / /products /account /cart',
         '3 次 / 2 秒間隔；任一 non-200 abort'],
    ]
    story.append(make_table(steps, [12 * mm, 78 * mm, CONTENT_W - 90 * mm]))
    story.append(Paragraph(
        'Exit codes：0 成功 · 1 健康檢查失敗 · 2 build 失敗 · 3 migrate 失敗。',
        ST_NOTE))
    story.append(Paragraph(
        '<b>備份：</b>每日 cron → sqlite3 .backup + media tar.gz → R2 bucket（30 天輪替）；'
        '本機保留 7 天於 /var/backups/。',
        ST_BODY))
    story.append(PageBreak())


def section_collections(story):
    story.append(Paragraph('4. 資料模型 — Collections', ST_H1))
    story.append(Paragraph(
        f'共 {len(COLLECTIONS)} 個 collections。'
        '本表按後台 sidebar 8-group 順序排列：'
        '① 訂單與物流 → ② 商品 → ③ 會員與 CRM → ④ 行銷 → ⑤ 互動體驗 → '
        '⑥ 內容與頁面 → ⑦ 客服中心 v1。',
        ST_BODY))
    story.append(Paragraph(
        '<b>狀態說明：</b><font color="#2d8a3e"><b>完成</b></font> = schema + hooks + '
        '前/後台串通；<font color="#c97a14"><b>施工中</b></font> = 部分缺 seed/UI/串接；'
        '<font color="#777777"><b>規劃中</b></font> = scaffold；'
        '<font color="#9c2828"><b>已棄用</b></font> = 由新版取代。',
        ST_NOTE))

    rows = [['Slug', '中文名', '狀態', '用途']]
    for slug, cn, status, desc in COLLECTIONS:
        rows.append([M(slug), B(cn), S(status), P(desc)])
    story.append(make_table(rows,
        [38 * mm, 24 * mm, 16 * mm, CONTENT_W - 78 * mm]))
    story.append(PageBreak())


def section_globals(story):
    story.append(Paragraph('5. 資料模型 — Globals', ST_H1))
    story.append(Paragraph(
        f'共 {len(GLOBALS)} 個 globals。新增者：AdsCatalogSettings（PR #150）、'
        'CustomerServiceSettings（PR #149）。', ST_BODY))
    rows = [['Slug', '中文名', '狀態', '用途']]
    for slug, cn, status, desc in GLOBALS:
        rows.append([M(slug), B(cn), S(status), P(desc)])
    story.append(make_table(rows,
        [50 * mm, 26 * mm, 16 * mm, CONTENT_W - 92 * mm]))
    story.append(PageBreak())


def section_migrations(story):
    story.append(Paragraph('6. Migration 歷史', ST_H1))
    new_count = sum(1 for _, _, t in MIGRATIONS if t == '新')
    story.append(Paragraph(
        f'共 {len(MIGRATIONS)} 支 migration（v2 較 v1 新增 {new_count} 支）。'
        '採 PRAGMA 冪等 pattern；無 pending 未跑。',
        ST_BODY))
    rows = [['Migration', '加了什麼', '版本']]
    for name, desc, tag in MIGRATIONS:
        tag_style = ParagraphStyle(
            name=f'TagS-{tag}',
            fontName=FONT_BOLD, fontSize=8.3, leading=11,
            alignment=1,
            textColor=GREEN if tag == '新' else MUTE,
        )
        rows.append([M(name), P(desc), Paragraph(tag, tag_style)])
    story.append(make_table(rows, [82 * mm, CONTENT_W - 100 * mm, 18 * mm]))
    story.append(PageBreak())


def section_api(story):
    story.append(Paragraph('7. 後端 API 路由', ST_H1))
    rows = [['路徑', '方法', '用途', '狀態']]
    for path, method, purpose, status in API_ROUTES:
        rows.append([M(path), M(method), P(purpose), S(status)])
    story.append(make_table(rows,
        [50 * mm, 18 * mm, CONTENT_W - 84 * mm, 16 * mm]))
    story.append(PageBreak())


def section_payload_endpoints(story):
    story.append(Paragraph('8. Payload 自訂 Endpoints', ST_H1))
    story.append(Paragraph(
        '定義於 <i>src/endpoints/\\*.ts</i>，註冊到對應 Collection.endpoints；'
        '可用 <i>overrideAccess</i> 繞過預設 access control。',
        ST_BODY))
    rows = [['路徑', '方法', '用途']]
    for path, method, purpose in PAYLOAD_ENDPOINTS:
        rows.append([M(path), M(method), P(purpose)])
    story.append(make_table(rows, [78 * mm, 18 * mm, CONTENT_W - 96 * mm]))
    story.append(PageBreak())


def section_frontend(story):
    story.append(Paragraph('9. 前台路由', ST_H1))
    story.append(Paragraph(
        f'共 {len(FRONT_ROUTES)} 個頁面路由。注意 /account/{{analytics, marketing, '
        'concierge, crm-dashboard}} 仍在施工 — 頁面渲染 demo 資料。其餘已串通真實 Payload。',
        ST_BODY))
    rows = [['路徑', '用途', '狀態', '動態']]
    for path, purpose, status, dyn in FRONT_ROUTES:
        rows.append([M(path), P(purpose), S(status), M(dyn)])
    story.append(make_table(rows,
        [50 * mm, CONTENT_W - 100 * mm, 18 * mm, 32 * mm]))
    story.append(PageBreak())


def section_auth(story):
    story.append(Paragraph('10. 認證流程', ST_H1))
    story.append(Paragraph(
        '混用 Payload 原生 auth 與 NextAuth v5 OAuth；OAuth 登入後經 bridge route '
        '交換 Payload token。經過 PR #95 / #107 / #108 三輪修補，bridge 已穩定。',
        ST_BODY))

    story.append(Paragraph('10.1 Email / 密碼流（Payload 原生）', ST_H2))
    story.append(Paragraph(
        '<b>登入：</b>POST <i>/api/users/login</i> → <i>payload-token</i> cookie。', ST_BODY))
    story.append(Paragraph(
        '<b>註冊：</b>POST <i>/api/users/register</i>（自訂 endpoint，含生日 / 出生時間）。'
        'GlobalSettings.emailAuth.requireEmailVerification 控制驗證流。',
        ST_BODY))
    story.append(Paragraph(
        '<b>忘記密碼：</b>Resend adapter 寄 CKMU 品牌 reset email；'
        '前端統一成功訊息防 enumeration。',
        ST_BODY))
    story.append(Paragraph(
        '<b>暴力破解防護：</b>Users.auth.maxLoginAttempts=10 + lockTime=10 min。',
        ST_BODY))

    story.append(Paragraph('10.2 OAuth 流（NextAuth + Bridge v3）', ST_H2))
    flow = [
        ['#', '步驟'],
        ['1', '用戶按 Google / Facebook / LINE / Apple 登入'],
        ['2', '/api/auth/signin → NextAuth 導 provider'],
        ['3', 'NextAuth signIn callback：upsert Payload Users（socialLogins.{provider}Id）'],
        ['4', 'NextAuth 寫 session（next-auth.session-token cookie）'],
        ['5', '/account/** layout 偵測：NextAuth ✓ Payload ✗ → /api/auth/bridge'],
        ['6', 'bridge route：resolveBaseUrl + getFieldsToSign + jwtSign → '
              'set payload-token on REDIRECT response（PR #95 修法，非 cookies()）'],
        ['7', '寫入 user.sessions 紀錄 + 把 sid 簽進 JWT（PR #108）'],
        ['8', 'Loop guard 防無限重導；stale JWE 會清掉 NextAuth cookie + 給登入錯誤訊息（PR #107）'],
    ]
    story.append(make_table(flow, [12 * mm, CONTENT_W - 12 * mm]))
    story.append(Paragraph(
        '<b>歷史踩坑：</b>Next 15 redirect response 的 cookies()。set 不會生效 → 必須直接寫 '
        'response.headers[\'Set-Cookie\']；NextAuth callback 內 cookies().set 也是靜默失效。',
        ST_NOTE))

    story.append(Paragraph('10.3 Session 策略', ST_H2))
    rows = [
        ['機制', 'Cookie 名', '型式', '屬性'],
        ['NextAuth', 'next-auth.session-token', 'JWE',
         'httpOnly · SameSite=Lax · Secure (prod)'],
        ['Payload', 'payload-token', 'JWT (含 sid)',
         'httpOnly · SameSite=Lax · Secure (prod)'],
    ]
    story.append(make_table(rows, [24 * mm, 44 * mm, 38 * mm, CONTENT_W - 106 * mm]))
    story.append(PageBreak())


def section_commerce(story):
    story.append(Paragraph('11. 商務流程', ST_H1))

    story.append(Paragraph('11.1 購物車（Cart）', ST_H2))
    story.append(Paragraph(
        '客戶端 Zustand cartStore（LocalStorage 持久化，skipHydration）；'
        '登入後 1 秒 debounce 同步至伺服端 Carts 列。Item 型別擴充 19D 三件套：'
        'bundleRef / isGift / isAddOn / giftRuleRef。',
        ST_BODY))

    story.append(Paragraph('11.2 結帳（Checkout）', ST_H2))
    story.append(Paragraph(
        '結帳頁從 /api/shipping-settings、/api/checkout-settings、'
        '/api/payment-settings 三 API 取設定。Carrier 7 種：宅配 / 7-11 / 全家 / 萊爾富 / '
        '新竹 / 門市取貨 / 面交（地點 + 時段格式化字串）。',
        ST_BODY))
    story.append(Paragraph(
        '<b>金流：</b>ECPay 信用卡 / ATM / 超商代碼 / COD（cash 或 cash_meetup）。'
        '<font color="#c97a14">ECPay 真正 callback / aio-checkout 路由仍規劃中</font>'
        '（見 §15 已知議題與 docs/session-prompts/23-ecpay-payment.md handoff）。',
        ST_BODY))

    story.append(Paragraph('11.3 訂單與原子庫存', ST_H2))
    story.append(Paragraph(
        'POST /api/orders → Orders.beforeChange 驗 stock ≥ qty；同 req 傳遞給 nested '
        'product update 確保 transaction 整體 rollback。afterChange 僅 side effects：'
        '信用分數 / 自動化流程 / 卡片 mint / UTM 歸因落庫。',
        ST_BODY))
    story.append(Paragraph(
        '<b>限制：</b>SQLite 單進程安全；多進程或 Postgres 遷移時需 SELECT FOR UPDATE 或樂觀鎖。',
        ST_NOTE))

    story.append(Paragraph('11.4 退換貨與退款', ST_H2))
    story.append(Paragraph(
        '/account/returns/new 與 /account/exchanges/new 發起；returns / exchanges 收單，'
        'refunds 連動。後台 bulk-ship panel（PR #128）支援統一 / CSV 兩種模式 + 自動寄物流通知信。',
        ST_BODY))
    story.append(PageBreak())


def section_promo_member_game(story):
    story.append(Paragraph('12. 促銷、會員與遊戲化', ST_H1))

    story.append(Paragraph('12.1 會員等級（6 層）', ST_H2))
    tier_rows = [
        ['Slug', '前台稱號（女 / 男）', '點數倍率'],
        ['ordinary', '優雅初遇者 / 翩翩紳士', '1.0x'],
        ['bronze', '曦漾仙子 / 溫雅學者', '1.2x'],
        ['silver', '幻綺公主 / 雋永騎士', '1.4x'],
        ['gold', '璀璨女神 / 金曜貴公子', '1.6x'],
        ['platinum', '星耀侯爵夫人 / 星耀侯爵', '2.0x'],
        ['diamond', '璀璨女王 / 璀璨國王', '2.5x'],
    ]
    story.append(make_table(tier_rows, [22 * mm, CONTENT_W - 52 * mm, 30 * mm]))

    story.append(Paragraph('12.2 點數系統 + 實體商品兌換（PR #109）', ST_H2))
    story.append(Paragraph(
        '<b>FIFO 365 天：</b>/account/points 依 createdAt + validityDays 推導到期；'
        '不用 expiresAt 欄位。',
        ST_BODY))
    story.append(Paragraph(
        '<b>實體商品兌換：</b>後台選 product → /api/v1/points 扣點 → '
        'user-rewards 記錄 → fulfillment 隨訂單出貨。'
        '結帳時可用點數抵扣（PR #109 加 redemption max discount 上限欄位）。',
        ST_BODY))

    story.append(Paragraph('12.3 推薦計畫', ST_H2))
    story.append(Paragraph(
        '推薦碼 referralCode；首購雙方獎勵；防濫用：同 IP / 24h 上限。',
        ST_BODY))

    story.append(Paragraph('12.4 促銷三件套（19D）', ST_H2))
    story.append(Paragraph(
        '<b>Bundles</b> 主+附贈組合（PDP 完成、admin builder 待補）；'
        '<b>GiftRules</b> 滿額贈（replaceGifts 動態更新）；'
        '<b>AddOnProducts</b> 結帳加購小物。',
        ST_BODY))

    story.append(Paragraph('12.5 遊戲化系統（已擴增）', ST_H2))
    story.append(Paragraph(
        '<b>遊戲：</b>SpinWheel / BlindBox / ScratchCard / CardBattle / DailyCheckin / '
        'FashionChallenge / StylePK / CoCreate / MovieLottery / QueenVote / '
        'WeeklyChallenge / TeamStyle / StyleRelay / <b>MBTI 個性穿搭測驗（PR #154）</b> '
        '= 14+ 款。免費次數由 GameSettings 控制。',
        ST_BODY))
    story.append(Paragraph(
        '<b>造型卡：</b>CollectibleCardTemplates → CollectibleCards → '
        'CollectibleCardEvents 三層；transfer / burn / craft API + action bar + '
        '/account/cards 連結（PR #84）。',
        ST_BODY))
    story.append(Paragraph(
        '<b>排行榜：</b>game-leaderboard 快取週/月/年；cron 驅動。',
        ST_BODY))
    story.append(PageBreak())


def section_content_ecosystem(story):
    story.append(Paragraph('13. 內容生態（Pages 模板 / SiteThemes / Podcasts）', ST_H1))
    story.append(Paragraph(
        '本章節為 v2 新增。整理近兩週新增 / 大改的內容與媒體相關功能。',
        ST_BODY))

    story.append(Paragraph('13.1 Pages 5 quick-start templates（PR #134）', ST_H2))
    story.append(Paragraph(
        '5 款雜誌風樣板：Fashion Magazine / Vogue / Luxury / KOL / Cosmopolitan。'
        '後台 /admin 編輯 Pages 時用 PageTemplatePicker 一鍵套用，'
        '前台用 RenderLexical + magazine blocks 渲染（PR #138）。'
        '預覽路由 /preview/templates/[id]（admin-only redirect，PR #146）。',
        ST_BODY))

    story.append(Paragraph('13.2 SiteThemes 主題系統（PR #119）', ST_H2))
    story.append(Paragraph(
        'SiteThemes collection + setActiveTheme 切換 + Canva 風格 color picker。'
        '7 預設色系，4 hero variants，每日 revalidate；前台動態套用。',
        ST_BODY))

    story.append(Paragraph('13.3 Podcasts（PR #157）', ST_H2))
    story.append(Paragraph(
        'Podcasts collection + 前台 /podcast 列表 + /podcast/[slug] 單集（audio player + '
        'show notes + related products）。Migration 20260504_163000。',
        ST_BODY))

    story.append(Paragraph('13.4 媒體資源強化', ST_H2))
    rows = [
        ['項目', 'PR', '狀態'],
        ['payload-folders 啟用 + 樹狀瀏覽', '#126 / #137 / #141', S('完成')],
        ['上傳 alt 自動填（從檔名）', '#129', S('完成')],
        ['供應商圖片匯入（Python CLI + Payload endpoint）', '#111 / #130', S('完成')],
        ['MIME 顯式白名單 [jpeg/png/webp/gif]', '#4', S('完成')],
        ['媒體資料夾 nav link → tree browser', '#141', S('完成')],
    ]
    story.append(make_table(rows, [76 * mm, 36 * mm, CONTENT_W - 112 * mm]))
    story.append(PageBreak())


def section_ads_marketing(story):
    story.append(Paragraph('14. 廣告與行銷追蹤', ST_H1))
    story.append(Paragraph(
        '本章節為 v2 新增。整理 PR-A / PR-B / PR-C 三大廣告系統元件。',
        ST_BODY))

    story.append(Paragraph('14.1 PR-A 商品目錄 feed（PR #150）', ST_H2))
    story.append(Paragraph(
        '<b>Endpoints：</b>/api/feeds/meta.xml + /api/feeds/google.xml — '
        '即時生成商品 catalog，支援變體 SKU 展開、價格、庫存、圖片、分類映射。'
        '<b>AdsCatalogSettings</b> global 控制 fallback 預設值（品牌 / 預設運費 / GTIN 規則）。',
        ST_BODY))

    story.append(Paragraph('14.2 PR-B UTM 商品歸因（PR #158）', ST_H2))
    story.append(Paragraph(
        '<b>新 collections：</b>ProductViewEvents（每次 PDP 瀏覽 + UTM 來源）、'
        'UTMCampaigns（slug 中心化）。'
        '<b>新欄位：</b>Orders.attribution、Users.firstTouchAttribution。'
        '<b>API：</b>POST /api/utm/track（30s 去重 + Cloudflare header IP fallback）。'
        '<b>後台報表：</b>各 utm_source/medium/campaign 的瀏覽 → 加入購物車 → 下單漏斗。'
        '<b>UTM Builder：</b>後台工具一鍵生成 UTM 連結。',
        ST_BODY))

    story.append(Paragraph('14.3 PR-C Meta Pixel + CAPI 雙線去重（PR #153）', ST_H2))
    story.append(Paragraph(
        '<b>Pixel（client-side）：</b>GTMScript.tsx 注入 fbq init + PageView。'
        'event_id 由 client 生成 → 與 server CAPI 共用做去重。',
        ST_BODY))
    story.append(Paragraph(
        '<b>CAPI（server-side）：</b>sendServerPurchaseEvent helper 已寫；'
        '<font color="#c97a14">prod 仍 dead code</font>，因 META_CAPI_ACCESS_TOKEN 未發 '
        '（員工角色缺 BM Admin 或 System User mint 權限）。',
        ST_BODY))

    story.append(Paragraph('14.4 prod 環境憑證盤點', ST_H2))
    rows = [
        ['類型', 'ID / 狀態', '備註'],
        ['Business Manager', '2137781379827397', '已抓'],
        ['Ad Account', 'act_441158936893428', '已抓'],
        ['Pixel ID', '210263407374946', '已抓'],
        ['Commerce Account', '783798852869998', '已抓'],
        ['System User', '61574030394578', '已抓'],
        ['CAPI Access Token', S('施工中'), '員工角色 + Shopline gateway 用著，pending'],
        ['Meta Catalog（產品上架後）', S('規劃中'), '產品確定後新建'],
        ['GMC（Google Merchant Center）', S('規劃中'), 'chrome-mcp-bridge profile 未登 Google'],
    ]
    story.append(make_table(rows, [44 * mm, 50 * mm, CONTENT_W - 94 * mm]))
    story.append(Paragraph(
        '下個 session 走 docs/session-prompts/29-meta-ads-credentials-handoff.md 起 PR-C。',
        ST_NOTE))
    story.append(PageBreak())


def section_customer_service(story):
    story.append(Paragraph('15. 客服中心 v1（CS Phase 1A）', ST_H1))
    story.append(Paragraph(
        'PR #149 補上 Phase 1A 基礎 schema（10-phase / ~40 PR 整合計畫的第一步）。'
        '舊版 customer-service-tickets v0 標 admin.hidden 保留資料但不再寫入。',
        ST_BODY))

    story.append(Paragraph('15.1 Phase 1A 完成項', ST_H2))
    rows = [
        ['Collection / Global', '用途', '狀態'],
        ['conversations', '對話容器；CS-YYYY-NNNNN 編號；priority/SLA/assignee', S('完成')],
        ['messages', '對話訊息；雙向歷史', S('完成')],
        ['message-tags', '分類 tag；color；filter', S('完成')],
        ['conversation-activities', '指派 / 升級 / 結案 audit log', S('完成')],
        ['customer-service-settings', '營業時間 / SLA 規則 / AI 提示詞', S('完成')],
        ['customer-service-tickets (v0)', '舊資料保留', S('已棄用')],
    ]
    story.append(make_table(rows,
        [54 * mm, CONTENT_W - 76 * mm, 22 * mm]))

    story.append(Paragraph('15.2 後續 Phase 規劃（待動工）', ST_H2))
    rows = [
        ['Phase', '主題', '狀態'],
        ['1B', 'Webhook 介接 LINE OA / FB Messenger', S('規劃中')],
        ['2', '前台聊天視窗 + 工單列表 UI', S('規劃中')],
        ['3', 'Inbox 後台介面（指派 / 標籤 / 篩選）', S('規劃中')],
        ['4', 'SLA 追蹤 + auto-escalation', S('規劃中')],
        ['5', '範本回覆 + macros', S('規劃中')],
        ['6', 'AI 自動回覆（Groq / OpenAI）', S('規劃中')],
        ['7', '通報與儀表板', S('規劃中')],
        ['8', 'CSAT 滿意度追蹤', S('規劃中')],
        ['9', '通路橋接（Email / IG DM）', S('規劃中')],
        ['10', '跨部門協作（Engineering / Marketing handoff）', S('規劃中')],
    ]
    story.append(make_table(rows, [16 * mm, CONTENT_W - 38 * mm, 22 * mm]))
    story.append(Paragraph(
        'spec：<i>docs/session-prompts/26-customer-service-phase1a.md</i>。',
        ST_NOTE))
    story.append(PageBreak())


def section_personalization(story):
    story.append(Paragraph('16. 個性化系統（MBTI / Horoscope / AI）', ST_H1))
    story.append(Paragraph(
        '本章節為 v2 新增。三大個性化模組已上線：MBTI 雙系統、每日星座運勢、AI 推薦引擎。',
        ST_BODY))

    story.append(Paragraph('16.1 MBTI 個性穿搭（PR #154 + #156）', ST_H2))
    story.append(Paragraph(
        '<b>遊戲入口：</b>/games/mbti-style — 28 題標準 MBTI + 4 題 lifestyle，'
        '計算 16 型 + 個人 lifestyle 特徵，存入 Users.mbtiProfile。',
        ST_BODY))
    story.append(Paragraph(
        '<b>進階分析：</b>/account/personality — MBTI64（4 occasion × 16 型 = 64 種細分），'
        '3 mode tabs（per-personality / lucky-daily / break-self），server prefetch products。',
        ST_BODY))
    story.append(Paragraph(
        '<b>API：</b>/api/games/mbti/play（POST 答案）、'
        '/api/games/mbti/suggest-product-types（GET 推商品分類）。',
        ST_BODY))

    story.append(Paragraph('16.2 每日星座運勢（PR #101）', ST_H2))
    story.append(Paragraph(
        '<b>API：</b>/api/horoscope/today — Groq LLM lazy 生成今日運勢 + 穿搭推薦；'
        'fallback 至 DailyHoroscopes seed。<b>顯示位置：</b>/account 頁面 HoroscopeBlock；'
        '商品圖片可點（PR #112 修）。',
        ST_BODY))

    story.append(Paragraph('16.3 推薦引擎', ST_H2))
    story.append(Paragraph(
        '<b>RecommendationSettings global：</b>三階段（瀏覽 / 購物車 / 購後）權重；'
        'collaborative-filtering / content-based / trending 三策略混合。'
        '前台 /products 已 force-dynamic，hook NOP；'
        'AlsoBoughtSection 仍以歷史訂單共現（PR #88 wiring）。',
        ST_BODY))

    story.append(Paragraph('16.4 AI 尺寸推薦（既有）', ST_H2))
    story.append(Paragraph(
        'PDP 內建 AISizeRecommender（PR #113 加 id/name + label htmlFor）— '
        '依使用者身高 / 體重 / 體型偏好推薦尺寸；身體量測 schema 已備但完整 UI 仍規劃中。',
        ST_BODY))
    story.append(PageBreak())


def section_admin_ux(story):
    story.append(Paragraph('17. 後台 Admin 體驗', ST_H1))
    story.append(Paragraph(
        '本章節為 v2 新增。近兩週對 Payload admin 做了大規模 UX 改造（PR #114–148）。',
        ST_BODY))

    story.append(Paragraph('17.1 8-group sidebar（PR #142–147）', ST_H2))
    rows = [
        ['Group', '名稱', '主要 collections'],
        ['⓪', '數據儀表（自訂 client component）',
         '營運總覽 / 會員分群 / 重購分析 / 使用說明'],
        ['①', '訂單與物流',
         'orders / returns / exchanges / refunds / shipping-methods / invoices'],
        ['②', '商品管理', 'products / categories / size-charts / site-themes'],
        ['③', '會員與 CRM',
         'users / membership-tiers / points-* / user-rewards / credit-score / segments / subscription / affiliates / concierge / login-attempts'],
        ['④', '行銷推廣',
         'coupons / marketing-campaigns / automation-* / birthday / festival / message-templates / add-on / bundles / gift-rules / ab-tests / utm / product-views'],
        ['⑤', '互動體驗',
         'mini-games / card-battles / leaderboard / collectible-* / style-* / daily-horoscopes'],
        ['⑥', '內容與頁面',
         'pages / blog-posts / podcasts / media / payload-folders / product-reviews / ugc-posts'],
        ['⑦', '客服中心 v1',
         'conversations / messages / message-tags / conversation-activities'],
    ]
    story.append(make_table(rows, [10 * mm, 50 * mm, CONTENT_W - 60 * mm]))
    story.append(Paragraph(
        '機制：①②③④⑤⑥⑦ 圓圈數字前綴強制 sidebar 排序（Payload 預設按字母）；'
        'lucide SVG mask-image 圖標跟隨 light/dark 主題。',
        ST_NOTE))

    story.append(Paragraph('17.2 中文化（PR #145）', ST_H2))
    story.append(Paragraph(
        '23 個 collections 加 labels.singular / labels.plural 中文（如 Users → 會員、'
        'Orders → 訂單、Products → 商品）。',
        ST_BODY))

    story.append(Paragraph('17.3 新後台元件清單', ST_H2))
    rows = [
        ['元件', 'PR', '用途'],
        ['CKMUDashboardNavGroup', '#147', '⓪ 數據儀表 client component'],
        ['OrderExportButton', '#125', '訂單 CSV/Excel 匯出（28 欄位）'],
        ['OrderBulkShipPanel', '#128', '批量發貨；統一 / CSV 兩種模式'],
        ['PageTemplatePicker', '#134', '5 款雜誌風樣板選擇器'],
        ['Preview /preview/templates/[id]', '#146', 'admin-only 樣板預覽'],
        ['payload-folders 樹狀瀏覽', '#137 / #141', '媒體資料夾視覺管理'],
        ['ProductsUsageNotice', '#148', '商品列表頁 6 工具說明卡'],
        ['ImportExportButtons', '舊', '會員 / 商品匯入匯出'],
        ('ShoplineImporter', '舊', 'Shopline XLSX 商品匯入'),
        ('ImageMigrationPanel', '舊', '舊圖批次遷移到 Payload media'),
        ('AdminLoginEmailDropdown', '#127', 'Header 顯示登入 email + 登出按鈕'),
        ('Demo seed buttons', '#114', '5 collections 一鍵示範資料'),
        ('CategoryTreeView', '#90', 'Shopline 風格拖曳分類管理'),
    ]
    story.append(make_table(rows,
        [54 * mm, 22 * mm, CONTENT_W - 76 * mm]))

    story.append(Paragraph('17.4 Nav scroll-persist N2.4（PR #133）', ST_H2))
    story.append(Paragraph(
        '前後共四代修法：N2.1 scrollbar-gutter / N2.2 sessionStorage / '
        'N2.3 selector + re-attach / <b>N2.4 polling + MutationObserver + saveBlockedUntil</b>。'
        '最後一代解決 Payload 800–1500ms 才置換 aside DOM 的非同步時序問題。',
        ST_BODY))
    story.append(PageBreak())


def section_security(story):
    story.append(Paragraph('18. 安全強化', ST_H1))
    story.append(Paragraph(
        '2026-04-18 PR #4 security-polish 一次補強；2026-04-25 PR #96 補 Meta Pixel CSP；'
        'PR #99 / #100 加 audit endpoint。',
        ST_BODY))

    story.append(Paragraph('18.1 HTTP 安全 Header', ST_H2))
    rows = [
        ['Header', '值', '生效'],
        ['Strict-Transport-Security',
         'max-age=63072000; includeSubDomains; preload', 'prod only'],
        ['X-Content-Type-Options', 'nosniff', 'all'],
        ['X-Frame-Options', 'SAMEORIGIN (html) / DENY (api)', 'all'],
        ['Referrer-Policy', 'strict-origin-when-cross-origin', 'all'],
        ['Permissions-Policy', 'geolocation=() microphone=() camera=()', 'all'],
        ['Cross-Origin-Opener-Policy', 'same-origin', 'all'],
        ['Cross-Origin-Resource-Policy', 'same-origin', 'all'],
    ]
    story.append(make_table(rows, [60 * mm, CONTENT_W - 85 * mm, 25 * mm]))

    story.append(Paragraph('18.2 CSP（PR #4 + #96 加入 Meta）', ST_H2))
    story.append(Paragraph(
        "default-src 'self'；script-src 'self' 'unsafe-inline' 'unsafe-eval' "
        "+ *.googletagmanager.com + connect.facebook.net + *.facebook.com（PR #96）；"
        "img-src + shoplineimg.com / r2 / gravatar / facebook.com；"
        "connect-src + google-analytics / ecpay / line-pay / newebpay / "
        "connect.facebook.net；frame-src + ecpay；form-action + ecpay。",
        ST_BODY))

    story.append(Paragraph('18.3 上傳過濾與認證防護', ST_H2))
    story.append(Paragraph(
        '<b>Media：</b>顯式白名單 [jpeg/png/webp/gif]；beforeChange 驗大小（avatar 8MB / '
        '一般 10MB / 大圖 50MB）；filename path traversal 擋 / \\ ..',
        ST_BODY))
    story.append(Paragraph(
        '<b>Users.auth：</b>maxLoginAttempts=10 + lockTime=10 min；LoginAttempts collection '
        '記錄成功登入。<b>Admin BasicAuth：</b>middleware 啟用 ADMIN_BASIC_USER+PW；'
        'timing-safe 等長比對。',
        ST_BODY))

    story.append(Paragraph('18.4 Audit endpoint（PR #99 / #100）', ST_H2))
    story.append(Paragraph(
        '/api/audit/schema：Bearer auth 用，dump collection schema + counts，'
        '便於封測期 schema sanity check。',
        ST_BODY))
    story.append(PageBreak())


def section_ops(story):
    story.append(Paragraph('19. 營運與監控', ST_H1))

    story.append(Paragraph('19.1 Cron 任務', ST_H2))
    rows = [
        ['路徑', '頻率', '功能'],
        ['/api/cron/auto-cancel-orders', '每小時', '未付款訂單逾時取消'],
        ['/api/cron/expire-points', '每日', '點數過期'],
        ['/api/cron/segments', '每日', '會員分群重算（RFM）'],
        ['/api/cron/automations', '每 5 分', '行銷自動化事件觸發'],
        ['/api/cron/streak-decay', '每日', '簽到 streak 衰減'],
        ['/api/cron/annual-tier-reset', '每年 1/1', '會員等級年度重置'],
    ]
    story.append(make_table(rows, [58 * mm, 22 * mm, CONTENT_W - 80 * mm]))

    story.append(Paragraph('19.2 OOM 與進程管理', ST_H2))
    story.append(Paragraph(
        'pm2 max_memory_restart 1500M + 2GB swap + deploy 末段清 orphan next-server。',
        ST_BODY))

    story.append(Paragraph('19.3 Boot Beacon + 錯誤回報', ST_H2))
    story.append(Paragraph(
        'Layout 內注入 inline script：4 秒內未 mount 則送 /api/boot-errors；prod only。'
        '歷史教訓：template literal 不放含 / 的 regex literal（用 indexOf 替代）。',
        ST_BODY))

    story.append(Paragraph('19.4 Webpack chunk recovery', ST_H2))
    story.append(Paragraph(
        'isChunkErr regex 涵蓋 reading \'call\' 與 \'call\' of undefined；'
        'URL 加 ?_r=base36-ts cache-buster + 30 秒 cooldown。Prod 因 content-hashed '
        'filename 自動 heal。',
        ST_BODY))
    story.append(PageBreak())


def section_roadmap(story):
    story.append(Paragraph('20. 已知議題與 Roadmap', ST_H1))

    story.append(Paragraph('20.1 v1 議題現況（多數已收尾）', ST_H2))
    rows = [
        ['v1 P', '議題', '現況', 'PR'],
        ['P0', 'Header 登入後沒切「已登入」 / 沒登出按鈕', S('已收尾'), '#127'],
        ['P0', '客戶 /login Email/pw 按鈕無 onClick', S('已收尾'), '#1'],
        ['P0', '無 /forgot-password 流程', S('已收尾'), '#1'],
        ['P0', '/account/** 無 auth gate', S('已收尾'), '#2'],
        ['P0', '/account/{orders, addresses, settings} 硬寫 demo', S('已收尾'),
         '多 PR'],
        ['P1', 'OAuth /account/points redirect 偶發', S('已收尾'),
         '#95 / #107 / #108'],
        ['P1', 'LINE login loop / scratch card 3-icon / points history', S('已收尾'), '#104'],
        ['P1', 'Cart bug 未診斷', S('完成'),
         '#32 已修 hydration stuck fiber'],
        ['P2', 'SMTP / forgot-password token 只 log console', S('已收尾'),
         'Resend adapter'],
        ['P2', 'COD / 貨到付款 UI 與 ECPay callback 串接', S('施工中'), '見 20.2'],
        ['P3', 'Subscription / RecommendationSettings hook NOP', S('規劃中'),
         '低影響'],
        ['P4', 'Apple Sign In OAuth', S('施工中'),
         'code 在 src/auth.ts 等 Dev Program'],
        ['P4', 'CSP 未列 connect.facebook.net', S('已收尾'), '#96'],
    ]
    story.append(make_table(rows,
        [12 * mm, CONTENT_W - 56 * mm, 24 * mm, 20 * mm]))

    story.append(Paragraph('20.2 v2 新增 / 進行中議題', ST_H2))
    rows = [
        ['v2 P', '議題', '狀態', '備註'],
        ['P0', 'ECPay 真正 callback / aio-checkout 路由', S('規劃中'),
         'PR #97 handoff；schema 完備但 form submit + result handler 未做'],
        ['P0', 'Meta CAPI server-side event 上線', S('施工中'),
         'sendServerPurchaseEvent dead code；待 prod CAPI token'],
        ['P1', 'GMC（Google Merchant Center）連接', S('規劃中'),
         'chrome-mcp-bridge profile 未登 Google'],
        ['P1', 'Meta Catalog 商品上架', S('規劃中'), '產品確定後新建'],
        ['P1', '客服中心 Phase 1B–10', S('規劃中'),
         '10 phase ~40 PR；spec 在 docs/session-prompts/26'],
        ['P1', '身體量測 UI（/account/measurements）', S('規劃中'),
         'schema 完備，前台未實作'],
        ['P2', 'Bundles admin builder UI', S('施工中'),
         'PDP /bundles/[slug] 已完成；後台手動建組合不便'],
        ['P2', 'A/B 測試引擎', S('規劃中'), 'collection 是 scaffold'],
        ['P2', 'MessageTemplates 管理 UI + 測試', S('施工中'),
         'schema 在；缺 admin 編輯 + preview'],
        ['P3', '/account/{analytics, marketing, concierge, crm-dashboard}',
         S('施工中'), '渲染 demo 資料；待接 Payload 真實聚合'],
        ['P3', 'WalletTransactions 流水帳 + 退現 UI', S('規劃中'),
         'storedValueBalance 目前是純數字'],
        ['P4', 'AI 虛擬試穿', S('規劃中'),
         '長期願景；點數 / 購物金 / 儲值金扣費'],
    ]
    story.append(make_table(rows,
        [12 * mm, CONTENT_W - 76 * mm, 24 * mm, 40 * mm]))

    story.append(Paragraph('20.3 Inventory / Fulfillment 餘項（Session 25）', ST_H2))
    rows = [
        ['子項', '主題', '狀態'],
        ['25A', '庫存預警 + safety stock 設定', S('規劃中')],
        ['25B', 'Fulfillment 工作流（pick / pack / ship）', S('完成')],
        ['25C', 'Backorder 管理', S('規劃中')],
        ['25D', 'Inventory adjustment 紀錄', S('完成')],
        ['25E', '多倉位（warehouse）支援', S('規劃中')],
    ]
    story.append(make_table(rows, [16 * mm, CONTENT_W - 38 * mm, 22 * mm]))
    story.append(PageBreak())


def section_appendix(story):
    story.append(Paragraph('21. 附錄：關鍵資訊索引', ST_H1))

    story.append(Paragraph('21.1 近期重要 PR（v2 新增）', ST_H2))
    prs = [
        ['PR', '主題'],
        ['#158', 'PR-B UTM 商品歸因（捕獲 / 落庫 / 報表 / Builder）'],
        ['#157', 'Podcasts collection + 前台 + audio player'],
        ['#156', '兌換獎品 + MBTI64 + 7 款社交遊戲收尾'],
        ['#155', '韓國女裝市場研究 + 4 quick wins'],
        ['#154', 'MBTI 個性穿搭測驗 (15 款)'],
        ['#153', 'PR-C Meta Pixel + CAPI 雙線去重'],
        ['#150', 'PR-A 商品目錄 feed for Meta + Google Shopping'],
        ['#149', '客服中心 Phase 1A foundation schema'],
        ['#148', 'products list 使用說明 panel'],
        ['#147', '⓪ 數據儀表 group + 8 lucide icons in sidebar'],
        ['#146', 'admin template preview /preview/templates/[id]'],
        ['#145', '23 collections 中文 labels'],
        ['#144 / #143', 'Sidebar 8-group 排序（重排陣列 + ①-⑦ 前綴）'],
        ['#142', '18 group → 8 group 重組'],
        ['#138 / #134', 'Pages magazine blocks + 5 quick-start templates'],
        ['#137 / #126', 'payload-folders 啟用 + 樹狀瀏覽'],
        ['#133 / #131 / #123 / #120', 'Nav scroll-persist N2.4'],
        ['#132', 'Automation Journeys 14 seed'],
        ['#128', 'Bulk ship admin panel'],
        ['#127', 'Header 顯示登入 email + 登出按鈕'],
        ['#125', 'Orders CSV/Excel export'],
        ['#119', 'SiteThemes + 4 hero variants + Canva picker'],
        ['#114', 'Demo seed for 5 collections'],
        ['#111 / #130', 'Supplier image importer（Python CLI）'],
        ['#109', 'Points-mall 實體商品兌換 end-to-end'],
        ['#108 / #107 / #95', 'OAuth bridge 三輪修補'],
        ['#101', 'Daily zodiac fortune + outfit recommendation'],
        ['#96', 'CSP 加 Meta Pixel + Messenger'],
        ['#84', 'Cards transfer / burn / craft API'],
    ]
    story.append(make_table(prs, [22 * mm, CONTENT_W - 22 * mm]))

    story.append(Paragraph('21.2 Handoff / 文件索引', ST_H2))
    docs = [
        ['文件', '用途'],
        ['docs/ROADMAP.md', 'canonical 5-phase roadmap'],
        ['docs/session-prompts/23-ecpay-payment.md', 'ECPay handoff'],
        ['docs/session-prompts/25*.md', 'Inventory / Fulfillment 5 sub-prompts'],
        ['docs/session-prompts/26-customer-service-phase1a.md', '客服 Phase 1A spec'],
        ['docs/session-prompts/29-meta-ads-credentials-handoff.md',
         'Meta Ads credentials → PR-C 起點'],
        ['docs/admin-cloudflare-access.md', 'CF Access 替代 BasicAuth'],
        ['HANDOFF_*.md（多份）', '歷次 session 收尾'],
        ['QA_REPORT_2026-04-18.md / 2026-04-24', '封測 QA 掃描'],
    ]
    story.append(make_table(docs, [82 * mm, CONTENT_W - 82 * mm]))

    story.append(Paragraph('21.3 運維常用指令', ST_H2))
    ops = [
        ['情境', '指令'],
        ['部署', 'ssh root@5.223.85.14 /root/deploy-ckmu.sh'],
        ['只跑 migration', 'ssh root@5.223.85.14 cd /var/www/chickimmiu \\&\\& yes y | pnpm payload migrate'],
        ['看 app log', 'ssh root@5.223.85.14 pm2 logs chickimmiu-nextjs --lines 200'],
        ['重啟 app',
         'ssh root@5.223.85.14 pm2 restart chickimmiu-nextjs --update-env'],
        ['本機 build', 'pnpm build'],
        ['本機 type check', 'pnpm tsc --noEmit'],
        ['Demo 一鍵 seed', '後台 /admin → ⓪ 數據儀表 → demo seed buttons'],
    ]
    story.append(make_table(ops, [38 * mm, CONTENT_W - 38 * mm]))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    sha = git_sha()
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'docs'))
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, 'pre-chickimmiu-architecture.pdf')

    doc = SimpleDocTemplate(
        out_path, pagesize=A4,
        leftMargin=PAGE_MARGIN, rightMargin=PAGE_MARGIN,
        topMargin=18 * mm, bottomMargin=18 * mm,
        title='pre.chickimmiu.com 架構與技術文件 v2',
        author='chickimmiu 工程團隊',
    )

    story = []
    cover(story, sha)
    toc(story)
    section_overview(story)
    section_tech_stack(story)
    section_deploy(story)
    section_collections(story)
    section_globals(story)
    section_migrations(story)
    section_api(story)
    section_payload_endpoints(story)
    section_frontend(story)
    section_auth(story)
    section_commerce(story)
    section_promo_member_game(story)
    section_content_ecosystem(story)
    section_ads_marketing(story)
    section_customer_service(story)
    section_personalization(story)
    section_admin_ux(story)
    section_security(story)
    section_ops(story)
    section_roadmap(story)
    section_appendix(story)

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print(f'[pdf] wrote {out_path}')
    print(f'[pdf] size: {os.path.getsize(out_path) / 1024:.1f} KB')


if __name__ == '__main__':
    main()
