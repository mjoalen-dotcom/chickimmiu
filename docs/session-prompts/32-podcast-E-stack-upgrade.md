# Session 32 — Podcast 計畫 E：升級版 podcast stack（ElevenLabs + Suno + 後製）

> **Scope**：把 podcast 製作品質從 NotebookLM 預設（AI host 流暢但語氣固定）升級到「真人感主持 + 配樂 + 後製」level。
> **跟 A/B/C/D 的關係**：E 是「品質升級」。A 是內容戰略、B 是 NotebookLM pipeline、C/D 是上架。E 在 A/B 跑通後再做（先看內容反應、再決定要不要投錢升級）。
> **建議獨立 session 處理**（外部工具整合 + 創意製作，跟 chickimmiu codebase 隔離）。
> **前置條件**：A、B 已完成 + 至少 4 集 NotebookLM 版 podcast 上線收 KPI 數據。

---

## 必讀 prerequisite

1. NotebookLM podcast sample：[docs/research/dongdaemun-2026/dongdaemun-podcast.m4a](../research/dongdaemun-2026/dongdaemun-podcast.m4a)
2. 第一季企劃（A 完成後）：`docs/research/podcast/season1-plan.md`
3. NotebookLM pipeline（B 完成後）：`D:\project-dev\podcast-pipeline\`
4. ElevenLabs 中文模型限制：https://elevenlabs.io/docs（評估 zh-TW 是否原生支援）

---

## 必達需求

把每集 podcast 從「NotebookLM AI host 對談」升級成「2 個真人聲主持人 + 開場 jingle + BGM + 後製剪接」。

## 工具 stack

| 工具 | 用途 | 月費 / 每分鐘成本 |
| --- | --- | --- |
| **NotebookLM**（保留）| 出文字稿 + sources + show notes | 免費 |
| **ElevenLabs**（新）| 中文 TTS（2 個主持聲音 voice clone）| US$22/月 starter，~22k chars/月 |
| **Suno** 或 **Mubert**（新）| AI 配樂（韓系都會 vibe BGM + intro jingle）| Suno US$10/月 |
| **DaVinci Resolve**（免費）或 **Audacity**（新）| 剪接 / 對話銜接 / 配樂淡入淡出 | 免費 |
| **FFmpeg**（已裝）| 自動化批次處理 | 免費 |

**月費總計約 US$32（≈ NT$1000）**，跟 NotebookLM 免費版相比、品質可拉到「中型品牌 podcast」level。

## 流程（每集 2-4 hr）

1. **NotebookLM 出 transcript**（30 min，自動）
   - 用 B pipeline 跑、拿 transcript（從 podcast 反推或從 report.md 改）
   - 重寫成「2 主持人對話形式」（手動 30-60 min，這是創意活）

2. **ElevenLabs 配音**（30-60 min）
   - 預先 voice clone 2 個主持人（一次性、20-30 min 樣本錄音）
   - 把 transcript 切段、各自跑 TTS
   - 輸出：2 軌 mp3 / wav

3. **Suno 配樂**（15-30 min）
   - 開場 jingle（10-15 秒、固定每集用）
   - 主題 BGM（segments 之間 fade）
   - 結尾 CTA 配樂（韓劇 OP-style）

4. **DaVinci / Audacity 剪接**（30-60 min）
   - 兩主持對話排序 + 適度間隔
   - BGM 淡入淡出
   - 整體響度標準化（-16 LUFS for podcast）

5. **FFmpeg 輸出**（5 min）
   - m4a 256kbps stereo
   - 加 ID3 metadata（episode num、title、cover）

## Voice clone 注意事項

- ElevenLabs 中文支援度：Multilingual v2 model 支援 zh-TW，**但需要至少 1 分鐘乾淨樣本**（建議錄 3-5 分鐘給更高保真度）
- 如果要用「真人」聲音 clone：**必須有當事人書面授權**（避免聲音肖像權問題）
- 替代：用 ElevenLabs 內建 voice library 挑現成中文聲音、不做 clone

## 主持人 persona（建議）

| 主持 | Persona | 聲音設定 |
| --- | --- | --- |
| **Mia** | chickimmiu 主理人視角，產業洞察 | 30-35 歲女聲、語速中、語氣專業帶溫度 |
| **Jay** | 對談嘉賓，提問引導 | 25-30 歲男聲、語速稍快、好奇 / 互動感 |

## 範例：第一集（E04 韓系 SS26 趨勢預告）製作 timeline

- D1 早上：跑 B pipeline 拿 NotebookLM podcast m4a + report.md（30 min）
- D1 下午：手動改寫成 2 主持對話（90 min）
- D2 早上：ElevenLabs 配音 + Suno 配樂（90 min）
- D2 下午：DaVinci 剪接 + 響度標準化 + 輸出 m4a（90 min）
- D2 晚上：上架到 chickimmiu podcast page（B/C 完成後可以）+ Spotify + Apple

**Total ≈ 4-5 hr 第一集（後續每集穩定後 2-3 hr）**

## Deliverables

1. **品牌 sound kit**：開場 jingle、3 個 BGM 變體（節奏 / 節奏快 / 慢）、結尾 sting
2. **2 個主持人 voice clone**（ElevenLabs 帳號 + voice ID）
3. **第一集升級版**（E04 重做版本，跟 NotebookLM 版 A/B 對比）
4. **製作 SOP**（流程文件 + Premiere/DaVinci 模板專案檔）
5. **每集成本 / 時間 tracker**（spreadsheet）
6. **品質對比 demo**：NotebookLM 版 vs ElevenLabs 版 各 30 秒並排播

## A/B 測試 plan

**目的**：驗證升級後品質提升是否帶得起聽眾增長 / 完播率。

- E04（A 版）：NotebookLM 直生
- E04（E 版）：ElevenLabs 升級
- 同時上架，標 v1 / v2 + tracking
- 30 天看：完播率、訂閱增長、推 chickimmiu 站流量
- **判斷標準**：E 版完播率 +20%+ 才值得繼續投產（時間成本是 NotebookLM 版 4-6 倍）

## 預估時間

- Setup（帳號 + voice clone + sound kit）：4-6 hr 一次性
- 第一集製作：4-5 hr
- 第二集起穩定：2-3 hr/集
- **首月 total ≈ 12-18 hr** 含 setup
- **後續穩定 ≈ 8-12 hr/月**（4 集）
