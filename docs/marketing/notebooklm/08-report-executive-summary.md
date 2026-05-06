# 韓國女裝市場研究 — 執行摘要（Executive Summary）

> **預期讀者**：5 分鐘讀完，掌握決策點
> **完整版**：13K 字研究報告 → `docs/marketing/2026-05-04-korean-fashion-market-research.md`

---

## TL;DR — 5 句話結論

1. **chickimmiu 不是在跟 PAZZO 競爭** — 真正對手是 Lulu's / W.Korea / Healer / MEIER.Q（4 家「KOL × 韓國代購 × 中價位」的同象限對手）
2. **甜蜜點在「左上象限」** — 純韓代購 × 高單價 × 強 KOL 個人 IP；金老佛爺 22 年部落客資產是這 4 家都沒有的
3. **2025 韓國最大成長軌是 office athleisure** — Andar / XEXYMIX 都在做運動風 → 上班通勤延伸
4. **最大未開發機會：Marithé François Girbaud KR 代理** — 5 年成長 500 倍但台灣零佈局
5. **立刻可動 4 個 Quick Win** — 已產出全部 launch kit，無等待，本週可動

---

## 4 切角研究 — 一頁總覽

| 切角 | 對 chickimmiu 角色 | 1 個 takeaway |
|------|------------------|--------------|
| 韓國本土平台 | UX / 平台模式參考 | 學 29CM 雜誌風 PDP + Zigzag onboarding 問卷 |
| 韓國品牌 | 選品 / 代理機會 | 爭取 **Marithé KR**（爆量但台灣零佈局） |
| 台灣競品 | **直接競爭** | 死守左上象限，對標 Lulu's / W.Korea / Healer |
| 韓國 SNS | 行銷 + 視覺 | 開 `@chickimmiu_snap` UGC 街拍 + Matin Kim fan-driven loop |

---

## 競爭格局矩陣（記住這張圖）

```
                           高單價 (>NT 1500)
                                ↑
  W.Korea (神褲 + 院線)          |    PAZZO (集團 + 楊丞琳代言)
  Lulu's (22 年老字號)           |    MEIER.Q (UR LIVING 集團)
  Healer (品牌敘事)              |    LOVFEE (KOL + 設櫃)
                                |  ★ chickimmiu (個人 IP + 韓國精選)
                                |
  純代購  ←─────────────────────┼─────────────────────→  自有設計
                                |
  IG 個體代購 / Yeogi.kr         |    Queen Shop / OB 嚴選
                                |    MIUSTAR / FW美衣（百元蝦皮）
                                ↓
                           低單價 (<NT 800)
```

**關鍵洞察**：
- **左上象限缺主導者** — Lulu's / W.Korea / Healer 三家分食，但無一具備金老佛爺級個人 IP
- **右上象限 PAZZO 主導但非韓系** — chickimmiu 不需正面對抗
- **左下右下都是紅海** — 不要進

---

## 規模對比一張表

| 對象 | 規模指標 | 重要性給 chickimmiu |
|------|---------|------------------|
| Musinsa | 2025 GMV 5 兆韓元（韓國時尚一哥） | 學 SNAP 街拍 + PB 模式 |
| Ably | MAU 8.33M（女裝最大） | 學 AI 個人化 onboarding |
| 29CM | AOV 23 萬韓元（精品最高） | 學雜誌風 PDP |
| Marithé KR | 5 年成長 500× | **爭取台灣代理** |
| Matin Kim | 海外營收 +121% | 學 fan-driven loop |
| Mardi Mercredi | 已在台北東區設旗艦 | 競品 + 借鑑單一花卉 logo 策略 |
| Lulu's 露露絲 | IG 141K / 22 年 | **chickimmiu 最直接對手** |
| W.Korea | 神褲 16 萬件 | 學單一 hero SKU 故事化 |
| PAZZO | IG 305K / 集團 32.6 億 NT | 量級太大，不正面剛 |

---

## 4 個 Quick Win — 已 100% 備好可動

### Quick Win 1：`@chickimmiu_snap` UGC 街拍（本週）
- **靈感**：Musinsa Snap 模式（11.8 萬粉）
- **Launch kit**：[D1-chickimmiu-snap-launch-kit.md](../quick-wins/D1-chickimmiu-snap-launch-kit.md)
- **內容含**：bio 文案、6 個 highlight 規劃、投稿規則 IG 公告、第一週 7 天發文計畫、主帳號 reel + 5 則限動文案、後台整合兩階段方案、第一個月 KPI、風險注意事項
- **時程**：本週開帳 → 第一週累積 9 張投稿 → 上線 9 連格 feed

### Quick Win 2：PDP 三種徽章 + 「韓星同款」filter（程式已 commit）
- **靈感**：W.Korea 神褲 social proof + Matin Kim 韓星同款標籤
- **程式變更**：commit `96d370a` 已 commit
  - Schema：`totalSold` field + `collectionTags` 加 `korean-celebrity` + `koreanCelebrityRef` group
  - PDP：4 種新徽章（`✦ 售出 50+/100+/300+/500+/1000+`、`★ 韓星同款`、`✿ 金老佛爺已穿`）
  - Collection page：`★ 韓星同款` + `✿ 金老佛爺已穿` filter tabs
  - Migration：`20260504_100000_add_total_sold_and_korean_celebrity.ts`（PRAGMA 冪等）
- **Deploy 步驟**：在主 dev 環境跑 `pnpm payload generate:types && yes y | pnpm payload migrate && pnpm build`

### Quick Win 3：IG「下季想看什麼？」carousel poll（本月）
- **靈感**：Matin Kim fan-driven design loop
- **Launch kit**：[D3-ig-poll-carousel.md](../quick-wins/D3-ig-poll-carousel.md)
- **內容含**：10 張 carousel 完整文案、設計 brief（Korean Cozy Beige 色票 + 字體建議）、發文時機建議、後續 30 天行動計畫（Day 1-30）、IG live「開盲盒」計畫、留言回應模板、A/B 測試建議、6 個月延伸玩法
- **時程**：建議每月第 1 個週四 19:00-21:00 發文

### Quick Win 4：Marithé KR 代理洽談（6 個月）
- **靈感**：韓國 5 年成長 500 倍 + 台灣零佈局 = 先發者紅利
- **Launch kit**：[D4-marithe-pitch-brief.md](../quick-wins/D4-marithe-pitch-brief.md)
- **內容含**：品牌背景 brief（為什麼是先發者紅利）、對口怎麼找（Layer Co. + LinkedIn + 韓國 buyer agent）、第一封 email 中英韓三版、Pitch Deck 10 頁結構、條件談判參考點（MOQ / 折扣 / 獨家權利金 / 年度成長 commitment / Marketing 分擔 / RPM）、預估時程（M1 寄信 → M5-6 上線）、關鍵風險點、Plan B 備案、9 個你需要決定的關鍵點
- **時程**：M1 寄第一封 email → M2 視訊會議 → M3 NDA → M4 親訪 + MOU → M5-6 商品上線

---

## 90 天行動清單（從研究萃取）

### 立即（1-2 週）
- [ ] 開立 IG 帳號 `@chickimmiu_snap`（用 D1 launch kit）
- [ ] PDP 加「累積售出 X 件」徽章（D2 程式已 commit，跑 migrate + deploy）
- [ ] 「韓星同款」標籤過濾器上線（同 D2）
- [ ] IG 主帳號發第一則「下季想看什麼？」carousel poll（用 D3 內容）

### 1 個月內
- [ ] 選 1 位中型台灣 micro KOL 開始 3 個月「品牌 muse」合作
- [ ] PDP 雜誌風改版測試 — 至少 3 件 hero SKU（學 29CM）
- [ ] 寄出 Marithé KR 第一封 email（用 D4 brief）

### 1 季內
- [ ] 第一個「fan-driven capsule」實驗（IG poll → live → 預售）
- [ ] 蝦皮二店啟動鏡像主站熱賣前 50 SKU
- [ ] 註冊冷啟動 onboarding 問卷（4-5 題）首頁客製化

### 6-12 個月內
- [ ] Marithé KR 代理 / 試單上線
- [ ] 規劃 1 個「配件 hero piece」打 IG（學 Stand Oil）
- [ ] 考慮台北東區 / 信義 showroom 自取點（學 Healer）
- [ ] office athleisure 線測試（學 Andar）

### 1-2 年內
- [ ] 台中 / 新竹首間實體門市（沿 Lulu's 路徑）
- [ ] 「CKMU Original」自有設計線啟動（30-40% 自有毛利目標）
- [ ] 跨品類延伸（美妝 / 配件 / 居家），延長 LTV

---

## 規避清單 — 絕不要做的 5 件事

1. ❌ **不跟 PAZZO / Queen Shop 比量** — 量級差太大，浪費資源
2. ❌ **不跟 MIUSTAR / GRASS ROOM / FW美衣比百元蝦皮直播** — 在那裡只會被淹沒
3. ❌ **不要與 SHEIN / Temu 比低價** — Brandi 已申請企業重整證明這條路不通
4. ❌ **不要做純 marketplace（無 PB / 無自有設計）** — 純開放平台模式毛利不夠
5. ❌ **不要忽視 30+ 女性** — Zigzag 2026 把客群推向 30s 因 ARPU 高、回購率穩

---

## 風險矩陣

| 風險 | 影響 | 機率 | 對策 |
|------|------|------|------|
| Marithé 代理被別家先簽 | 高 | 中 | 立刻寄第一封 email；金老佛爺 IP 是差異化武器 |
| 韓國代購匯率波動 | 中 | 高 | 自有設計線「CKMU Original」延伸，30-40% 毛利分散風險 |
| 中國跨境（SHEIN/Temu）擠壓 | 高 | 高 | 走「品牌策展 + 設計師敘事」路線，避開低價戰 |
| Lulu's / W.Korea 升級個人 IP | 中 | 低 | 持續強化金老佛爺內容輸出頻率 + 月飛韓國 vlog |
| 台灣消費者轉向韓國平台直購（Naver / Coupang）| 中 | 中 | 強調「中文客服 + 退換貨 + 信任感 + 速度」 |

---

## 給董事會 / 投資人的單頁簡報結構

如果你要把這份研究做成 8-10 張 board deck，建議結構：

1. 市場機會 — 台灣女裝電商市場規模 + 韓系品類佔比
2. 競爭格局 — 4 象限矩陣 + chickimmiu 占位
3. 真正的對手 — 4 家同象限對手對標
4. 我們的差異化 — 金老佛爺 22 年 IP + 月飛韓國 + 完整 LTV 系統
5. 4 個 Quick Win — 已備好 launch kit、無等待
6. Marithé 代理機會 — 5 年 500× 但台灣零佈局
7. 90 天 / 1 年 / 2 年 roadmap
8. 風險與對策
9. 資金需求 / KPI
10. Q&A

→ 這個結構版本可進 [01-slides.html](01-slides.html) 看互動 deck

---

**研究完成時間**：2026-05-04
**研究覆蓋**：80+ 對象、80+ 來源、4 切角獨立 agent 並行
**完整可讀文件**：[2026-05-04-korean-fashion-market-research.md](../2026-05-04-korean-fashion-market-research.md)
