# Session 31 — Podcast 計畫 B：NotebookLM 自動化 pipeline script

> **Scope**：寫一個 CLI 腳本，餵題目 + sources（URL 或檔案）→ 自動跑 NotebookLM research + 生 podcast + 下載 + 命名歸檔 + 寄信通知。
> **跟 A/C/D/E 的關係**：B 是 enabler。A 用 B 來生新集數；C/D 可以選擇人工生再上傳，但 B 讓「每週固定產出」變成 1 行指令。
> **建議獨立 session 處理**（純腳本工作，跟 chickimmiu codebase 改動分離；可放 `scripts/podcast/` 或外部 repo）。

---

## 必讀 prerequisite

1. NotebookLM auth env-var bug + CDP cookie workaround：[memory feedback_notebooklm_env_var_bug.md](C:/Users/mjoal/.claude/projects/C--Users-mjoal-ally-site-chickimmiu/memory/feedback_notebooklm_env_var_bug.md)
2. NotebookLM CLI flat 結構：`python -m notebooklm` --help（基於 v0.3.4）
3. 既有東大門研究 notebook 範例：id `99e84848-4cb8-49c5-8426-9d031c882a19`
4. Gmail 寄信 workflow（**user 要求所有寄信走這條，別只建草稿**）：[memory reference_gmail_send_workflow.md](C:/Users/mjoal/.claude/projects/C--Users-mjoal-ally-site-chickimmiu/memory/reference_gmail_send_workflow.md)

---

## 必達需求

```bash
# 目標 CLI usage:
podcast-gen \
  --title "東大門 2026 SS 趨勢預告" \
  --sources "https://url1.com,https://url2.com" \
  --queries "Q1.txt" \
  --episode-num 4 \
  --notify-email mjoalen@gmail.com
```

腳本流程（input → output 全自動）：

1. **Auth**：先 `unset NOTEBOOKLM_AUTH_JSON`、檢查 storage_state.json 還能用，過期則 fail-fast 提示「請手動 cookie dump（見 memory）」
2. **Notebook**：建新 notebook（標題：`{title} (E{episode_num})`）
3. **Sources**：
   - 如果有 `--sources URL list` → 逐一 add-source
   - 如果有 `--queries` 文字檔 → 跑 `source add-research --mode deep --import-all`
   - Fallback：自動跑 1 輪 deep research with `--query {title}`
4. **Generate audio**：`generate audio --format deep-dive --length default`、語言用 zh_Hant、instructions 從 `--instructions` flag 帶或 default「為台灣女裝電商行銷團隊製作 12-15 min podcast」
5. **Generate report + slides**（同 podcast，多 modal 同時生）
6. **Wait + download**：用 `artifact wait` block、下載 m4a + report.md + slides.pdf
7. **歸檔**：放到 `docs/research/podcast/E{episode_num}-{slug}/`
8. **Manifest**：寫 `manifest.json`（episode_num, title, notebook_id, generated_at, audio_path, duration, file_size）
9. **Notify**：用 Gmail MCP 寄信給 `--notify-email`，附 manifest summary + 檔案路徑 + 直接 link
10. **Exit**：成功 0、auth fail 2、generate fail 3、download fail 4

## Tech stack 建議

- Python 3.13（已 venv 過）
- `notebooklm-py` 0.3.4（已裝；改 `auth.py:46` 已記在 memory）
- `googleapis` Node lib for Gmail（已裝；reuse `C:\Users\mjoal\Desktop\stocks-2026-04\send-email.mjs` pattern）
- `ffprobe` for audio metadata（已裝在 `%LOCALAPPDATA%\Microsoft\WinGet\Links\`）

## Repo 位置選擇

**選項 A（建議）**：`scripts/podcast-pipeline/` 在 chickimmiu repo
- 優點：跟 chickimmiu 一起 versioned
- 缺點：scripts/ 跟 main app 沒直接關係、會干擾 PR review

**選項 B**：`D:\project-dev\podcast-pipeline\` 獨立 repo
- 優點：乾淨、可開源
- 缺點：另一 repo 要管

→ **建議 B**，跟 [chrome-mcp-bridge](C:/Users/mjoal/.claude/projects/C--Users-mjoal-ally-site-chickimmiu/memory/project_chrome_mcp_bridge.md) 同樣模式（獨立 D:\project-dev 下、git init 但無 remote）。

## 進階（V2）

- **排程**：用 cron / Windows Task Scheduler 每週日 04:00 自動跑、生上週新貨 podcast
- **內容 source 自動拉**：fetch chickimmiu admin `/api/products?createdAt[gte]=last_week` 拿 SKU + URL list
- **多語**：加 `--lang zh_Hant|zh_Hans|en` flag
- **GitHub Actions**：放 GHA cron job，全 cloud 自動產出（要解決 NotebookLM session 在 cloud 怎麼存的問題）

## Deliverables

1. `podcast-pipeline/cli.py` 主程式
2. `podcast-pipeline/notebooklm_auth.py` auth helper（包 `unset` + CDP fallback）
3. `podcast-pipeline/notify.py` Gmail 通知
4. `podcast-pipeline/README.md` 含 install + usage + troubleshoot
5. `podcast-pipeline/example.sh` 跑東大門 E04 sample
6. `podcast-pipeline/.gitignore`（cookies, temp downloads）

## 預估時間

- Setup + auth handling：1 hr
- 主腳本 + flags：2 hr
- Gmail 通知 + 歸檔：1 hr
- README + sample run + debug：2 hr
- **Total ≈ 半天**

## 完成後

回報主 session：腳本路徑 + 第一個 sample run 的 manifest + 1 個已生成的 episode 路徑。
