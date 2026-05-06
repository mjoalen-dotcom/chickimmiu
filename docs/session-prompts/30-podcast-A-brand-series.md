# Session 30 — Podcast 計畫 A：chickimmiu 品牌 podcast 系列

> **Scope**：規劃並啟動 chickimmiu 自有 podcast 內容系列（每週/雙週 1 集）。
> **跟 B/C/D/E 的關係**：A 是「內容戰略」、B 是「自動化 pipeline」、C 是「admin 工具」、D 是「前台聽 page」、E 是「升級到 ElevenLabs/Suno」。本 session 只做 A。
> **建議獨立 session 處理**（內容導向工作，跟 codebase 改動分離）。

---

## 必讀 prerequisite

1. [docs/research/dongdaemun-2026/REVIEW_for_marketing_lead.md](../research/dongdaemun-2026/REVIEW_for_marketing_lead.md) — chickimmiu 行銷主軸
2. [docs/research/dongdaemun-2026/dongdaemun-podcast.m4a](../research/dongdaemun-2026/dongdaemun-podcast.m4a) — NotebookLM podcast sample（聽完評估 vibe）
3. [docs/research/dongdaemun-2026/Q4-D2C策略.md](../research/dongdaemun-2026/Q4-D2C策略.md) — 韓國 D2C 內容公式

---

## 目標 deliverables

1. **節目命名 + 定位**（建議 3 個候選名 + 1 句 tagline）
   - 範例：`chickimmiu 韓系穿衣間` / `chic chat：韓國時尚情報` / `首爾→台灣 5 分鐘`
   - Tagline 要對標：跟 Pazzo / Meier.Q 的風格區隔開

2. **內容結構**（每集模板）
   - 開場 30 秒（固定 jingle + intro）
   - 主題敘事 8-10 分鐘
   - 商品延伸 2-3 分鐘（鬥推 1-3 件當期 SKU）
   - 結尾 CTA 30 秒（IG / LINE / 站上 podcast page）
   - **總長 12-15 分鐘**（通勤剛好）

3. **第一季 8 集主題清單**（2026-Q3）
   - E01: 「東大門 2026 結構轉型 — 為什麼夜市批發崩了？」
   - E02: 「Sinsang Market 開戶實錄：第一次跨境採購 vlog」
   - E03: 「廣州 commerce 殺進來，chickimmiu 怎麼定位？」
   - E04: 「韓系 SS26 趨勢預告：5 個必買單品」
   - E05: 「AI 替我們省了 NT$80k/月：chickimmiu 工具實戰」
   - E06: 「客戶故事 #01：從 Pazzo 跳槽 chickimmiu 的 Sara」
   - E07: 「直播帶貨抄韓國 Live Commerce 的 5 件事」
   - E08: 「Q3 回顧 + Q4 展望：客單帶往上推的決策」

4. **製作流程版本化**
   - **MVP（用 NotebookLM 直生）**：每集 30 min 自動 + 30 min 手動 review = 1 hr/集
   - **進階（升級 E）**：NotebookLM 文字稿 → ElevenLabs 配音 → Suno BGM = 2-4 hr/集

5. **發布通路**
   - chickimmiu 站上 podcast page（D 完成後接）
   - Spotify for Podcasters（免費）
   - Apple Podcasts Connect（免費，需 RSS feed）
   - IG Reels audio（每集挑 1 分鐘高潮片段）
   - YouTube（音檔 + 靜態封面影片，月度增點觀看）
   - LINE 群預告（VIP）

6. **KPI（每季 review）**
   - 訂閱數（Spotify + Apple）
   - 平均完播率（目標 60%+）
   - 推 chickimmiu 站流量（UTM `?ref=podcast-{episode}`）
   - 直接帶單成交（如果 PDP CTA 接好）

7. **第一集 production plan**
   - 主題：建議 E04「韓系 SS26 趨勢預告：5 個必買單品」（最容易賣貨、低風險試水）
   - Sources：用既有 NotebookLM notebook 99e84848 的 Q4-D2C 策略 + Q5 AI 工具
   - Timeline：W1 寫腳本 / W2 配音 / W3 上線 / W4 review

---

## 上手指令

```bash
# 在新 Claude Code session 跑
cd C:/Users/mjoal/ally-site/chickimmiu
# Read REVIEW_for_marketing_lead.md, dongdaemun-podcast.m4a, Q4 策略
# 先輸出：3 個節目名候選 + tagline + 8 集主題清單 (2-3 行/集) + 第一集 detailed outline
```

完成後寫進 `docs/research/podcast/season1-plan.md`、開 PR 或交回主 session。

## 預估時間

- Discovery（聽 sample + 讀 review）：30-45 min
- 結構 + 主題清單：60-90 min
- 第一集 outline：60-90 min
- **Total ≈ 2.5-3.5 hr**
