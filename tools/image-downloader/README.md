# 電商產品圖片快速下載工具

一套給賣家「上架前快速備齊產品圖」用的 Python CLI。針對 **sinsangmarket.kr（韓國批發）**、**Alibaba / 1688（中國批發）**、**chickimmiu.com（自家後台）** 等供應商做了專門優化，但同樣適用一般電商 PDP。

---

## 為什麼需要這支工具？

賣家上架一支新品的真實工作量：

1. 從供應商網站下載 30-80 張產品圖 → 手動點圖另存其實 1 小時起跳
2. 篩選掉小圖、icon、廣告版位、佔位圖
3. 重複圖片去重（同一張原圖在不同 lazy-load 屬性出現過 N 次）
4. 分類成「主圖 vs 細節圖」餵給後台
5. 提升解析度 / 銳利化（很多韓貨原圖只有 600px）

這支工具一行指令做完前 4 件事，第 5 件做基本的；剩下浮水印移除等高階處理請看下方〈進階：浮水印與銳利化〉一節。

---

## 安裝

```bash
# Python 3.9+
cd tools/image-downloader
python -m venv .venv

# Windows PowerShell
.venv\Scripts\Activate.ps1
# Windows CMD / Git Bash
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

---

## 快速開始

### 抓單一商品頁

```bash
python image_downloader.py -u https://sinsangmarket.kr/item/12345
```

預設行為：
- 輸出到 `./downloads/<page-slug>/`
- 過濾掉 < 800x600 的小圖
- MD5 去重
- 8 個並發
- 寫 `downloads/manifest.json`（含每張圖的 url / 路徑 / 解析度 / md5 / 分類）

### 從 txt 批次抓

`urls.txt`：
```
# 第一波春夏新品
https://sinsangmarket.kr/item/100001
https://sinsangmarket.kr/item/100002
https://sinsangmarket.kr/item/100003

# 配件
https://detail.1688.com/offer/700123456789.html
```

```bash
python image_downloader.py -f urls.txt -o downloads/2026-spring/
```

### 抓自家 chickimmiu PDP

工具會自動解開 Next.js 的 `/_next/image?url=...&w=1920&q=75` proxy URL，抓到原始檔。

```bash
python image_downloader.py -u https://www.chickimmiu.com/products/<slug>
```

---

## 完整參數

| 參數 | 預設 | 說明 |
|---|---|---|
| `-u, --url` | — | 單一頁 URL（與 -f 二選一） |
| `-f, --file` | — | URL 清單 txt（每行一個，# 註解） |
| `-o, --output` | `./downloads` | 輸出資料夾 |
| `--min-width` | 800 | 最小寬度 px |
| `--min-height` | 600 | 最小高度 px |
| `-w, --workers` | 8 | 並發下載數，被擋就降到 2-3 |
| `-t, --timeout` | 15 | HTTP timeout（秒） |
| `--user-agent` | Chrome 121 Win | 自訂 UA |
| `--sharpen` | off | UnsharpMask 銳利化 |
| `--upscale N` | 0 | 短邊放大到 N px（LANCZOS） |
| `--exclude` | favicon/sprite/icon/... | 排除 URL 的 regex；傳 `none` 關閉 |
| `--no-progress` | off | 關閉進度條 |
| `--no-manifest` | off | 不寫 manifest.json |

---

## 實戰範例

### 1. sinsangmarket.kr（韓國批發）

需要先在瀏覽器登入，否則只能看 thumbnail。登入後在 DevTools → Application → Cookies 拷 cookie，然後用環境變數帶入：

```python
# 在 image_downloader.py 的 make_session() 加：
session.headers["Cookie"] = os.environ.get("SINSANG_COOKIE", "")
```

或更簡單：直接在 CLI 加一個 `--cookie` 參數（自己改 5 行程式）。

韓貨細節圖通常是直幅長條（aspect < 0.7），分類器會自動歸為 `detail`。

```bash
SINSANG_COOKIE="JSESSIONID=...; loginToken=..." \
  python image_downloader.py -u https://sinsangmarket.kr/item/12345 \
    --min-width 1000 --sharpen
```

### 2. 1688 / Alibaba

1688 主圖一張可能多到 2-3MB，加上每張多解析度版本，**務必降低並發**：

```bash
python image_downloader.py -u https://detail.1688.com/offer/700123456789.html \
  --workers 3 \
  --min-width 800 \
  --exclude "(favicon|q60|q30|180x180|220x220)"
```

備註：1688 的 CDN 會在 URL 加尺寸後綴（`...jpg_b.jpg` 或 `...jpg_400x400.jpg`）。如果想改成抓最大原圖，可以改 `extract_image_urls`，把 URL 的 `_(\d+x\d+|b|m|t)` 後綴 strip 掉。

### 3. chickimmiu.com（自家後台）

工具自動解 `_next/image` proxy。配合 manifest.json 可以快速 audit 自家某個 PDP 用了哪些 media：

```bash
python image_downloader.py -u https://www.chickimmiu.com/products/example \
  -o audit/example/
cat audit/example/manifest.json | jq '.items | map({url, category, width, height})'
```

---

## 圖片自動分類

manifest.json 每張圖會帶 `category`：

| 分類 | 規則 |
|---|---|
| `main` | 檔名/alt 含 main/cover/og_image，**或** aspect 0.7-1.4 + 寬度 ≥ 600 |
| `detail` | 檔名/alt 含 detail/desc/spec/info，**或** aspect < 0.7（直幅長條），**或** aspect > 2.5（橫向 banner） |
| `thumbnail` | 檔名/alt 含 thumb/small/mini/icon |
| `other` | 其他 |

純啟發式，不會 100% 準。建議流程：

1. 工具下載完，看 `manifest.json` 的 `by_category` 統計
2. 用 `jq` / Excel 讀進來，人工調 5-10 張的分類
3. 餵給後台上架腳本

---

## 整合 chickimmiu 後台（兩條路線都已備好）

兩條路線都已經實作完成 — **離線批次** 用 [`upload_to_payload.py`](upload_to_payload.py)，**線上一鍵** 用 Payload endpoint [`POST /api/media/import-from-supplier`](../../src/endpoints/importFromSupplier.ts)。看你工作流程選一條即可。

### 路線 A：離線批次（先抓再傳）

適合：一次處理一整批（例如季度新品 50-100 支）、本機跑、要看每張圖再決定要不要傳。

```bash
# Step 1：先用 image_downloader.py 把圖下載到本機
python image_downloader.py -f urls.txt -o downloads/2026-spring/ --sharpen

# Step 2：人工掃一眼 downloads/，挑掉不要的
# Step 3：批次上傳到 Payload Media（會跑 Media.beforeChange MIME / size 驗證）
python upload_to_payload.py \
  --base-url https://www.chickimmiu.com \
  --email admin@chickimmiu.com \
  --password '****' \
  --manifest downloads/2026-spring/manifest.json \
  --categories main,detail
```

`upload_to_payload.py` 會：
- 登入拿 JWT → 後續用 `Authorization: JWT <token>` 走 `/api/media`
- 一次傳一張，每張帶 `alt`（必填）+ `folder`（自動從來源頁推 slug）
- 寫 `uploaded.json` 紀錄 `{local_path: {id, filename, url, ...}}`，**斷點續傳**
- 失敗自動重試 3 次（exponential backoff 1s / 3s / 7s）
- 401 / 403 / 413 各別處理；單張失敗不擋整批

`uploaded.json` 範例：

```json
{
  "downloads/2026-spring/sinsang_item_12345/main_001.jpg": {
    "id": "abc123",
    "filename": "main_001.jpg",
    "url": "/media/main_001.jpg",
    "alt": "藍色洋裝正面",
    "folder": "sinsang_item_12345",
    "category": "main",
    "src_url": "https://sinsangmarket.kr/.../main_001.jpg"
  }
}
```

之後在 Payload admin 建商品時，把這些 media id 接到 `Products.images[*].image` 即可（或寫進階腳本一鍵把整支商品建起來）。

#### 先 dry-run 確認要傳什麼

```bash
python upload_to_payload.py \
  --base-url ... --email ... --password ... \
  --manifest downloads/manifest.json \
  --dry-run
```

#### 給每批加批次代號當 folder 前綴

```bash
python upload_to_payload.py \
  --folder-prefix SS25 \
  ...
# folder 會變成 SS25-sinsang_item_12345
```

---

### 路線 B：線上一鍵（後台 endpoint）

適合：上架小編貼一條 URL 就直接入庫；不需要本機裝 Python；走自家伺服器網路（如果伺服器離供應商更近就比本機跑快）。

**Endpoint**：`POST /api/media/import-from-supplier`
**權限**：必須 admin（防 customer 帳號爬任意網站當代理）
**安全**：DNS lookup 後擋 private IP（防 SSRF 打內網 / metadata service）；8MB / 圖；50 張上限。

#### Request

```bash
# 從後台 admin tab DevTools console（已登入）：
fetch('/api/media/import-from-supplier', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://sinsangmarket.kr/item/12345',
    minWidth: 800,
    minHeight: 600,
    maxImages: 30,
    folder: 'SS25-001',           // 可省略，會用 URL slug 自動推
    categories: ['main', 'detail'],  // 預設值，可省略
    dryRun: false,
  })
}).then(r => r.json()).then(console.log)
```

或 curl（先用 `/api/users/login` 拿 token）：

```bash
TOKEN=$(curl -s -X POST https://www.chickimmiu.com/api/users/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@...","password":"***"}' | jq -r .token)

curl -X POST https://www.chickimmiu.com/api/media/import-from-supplier \
  -H "Authorization: JWT $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://sinsangmarket.kr/item/12345","maxImages":30}'
```

#### Response（成功）

```json
{
  "success": true,
  "folder": "item_12345",
  "total_candidates": 47,
  "total_downloaded": 28,
  "total_after_category_filter": 22,
  "created": 22,
  "failed": 0,
  "items": [
    {
      "id": "abc123",
      "filename": "main_001.jpg",
      "url": "/media/main_001.jpg",
      "width": 1200,
      "height": 1500,
      "category": "main",
      "src_url": "https://sinsangmarket.kr/.../main_001.jpg"
    }
    // ...
  ]
}
```

#### Response（錯誤）

| status | error | 說明 |
|---|---|---|
| 400 | `url_required` | body 沒帶 url |
| 400 | `unsafe_url` (`reason: private_ip / protocol_not_allowed / dns_failed / invalid_url`) | SSRF 防護擋下 |
| 403 | `forbidden` | 非 admin |
| 502 | `fetch_failed` / `fetch_error` | 抓 HTML 失敗 |
| 200 | `total_candidates: 0` | 抽不到任何圖（多半是 SPA 動態載入） |

#### dry-run

`{ ..., "dryRun": true }` → 跑完整 pipeline（fetch + extract + download + 驗證 + 分類）但 **不寫入 Media**。回的 items 會帶 size_bytes / category / mime，方便先看清楚要不要正式跑。

#### 加上 admin UI（建議下一步）

可以做個 Payload custom view 直接在後台側欄掛「從供應商匯入」按鈕，按下後跳 modal 接受 URL 輸入，呼叫這條 endpoint。Payload v3 admin component pattern 在 `src/components/admin/` 已有現成範例（HelpView / MemberAnalyticsView 等）。

---

## 進階：浮水印與銳利化

> 「修正圖片解析度或能重繪圖片，避免浮水印與不清晰的圖片」

這個需求要分成兩件事：

### 解析度與銳利化（本工具直接支援）

```bash
# 短邊放大到 1600px + 銳利化
python image_downloader.py -u <URL> --upscale 1600 --sharpen
```

- `--upscale` 用 Pillow LANCZOS 雙三次插值，**不會**真的補回細節，只是讓圖在後台展示時不會糊。
- `--sharpen` 用 UnsharpMask（半徑 1.2、強度 120%、threshold 2），對輕微模糊的縮圖很有效。

### 浮水印移除（**本工具不支援**）

Pillow 沒有 inpainting，硬算的話會留下明顯痕跡。請自行另接以下方案：

| 方案 | 適用情境 | 安裝 |
|---|---|---|
| **OpenCV `cv2.inpaint`** | 浮水印位置固定（例如固定在右下角的 logo） | `pip install opencv-python` |
| **IOPaint / lama-cleaner** | 任意位置浮水印，AI 模型，效果最好 | `pip install iopaint`，需要 GPU 較佳 |
| **rembg + 重貼背景** | 純色背景商品 | `pip install rembg` |

建議流程：

1. 先用本工具下載原圖
2. 跑一輪 IOPaint，輸出到 `downloads_clean/`
3. 用 `manifest.json` 的路徑對應寫一個 hook 腳本同步覆蓋

---

## 打包成單一 exe（PyInstaller）

```bash
pip install pyinstaller
pyinstaller --onefile --name image-downloader \
  --collect-all PIL \
  --collect-all bs4 \
  image_downloader.py
```

完成後 `dist/image-downloader.exe` 可以丟給上架小編，不需要他們裝 Python。**注意**：第一次啟動會慢（約 3-5 秒解壓 PyInstaller bundle），這是 onefile 模式正常現象；要更快可改 `--onedir`。

Windows Defender 偶爾會把 PyInstaller 打包後的 exe 標 false positive，可加 `--upx-dir` 或 code-sign 解決。

---

## 未來擴充

### Streamlit 網頁版（最快路線）

`app.py`：

```python
import streamlit as st
from image_downloader import process_page, make_session
import tempfile, pathlib

st.title("CKMU 產品圖下載器")
url = st.text_input("商品頁 URL")
min_w = st.slider("最小寬度", 400, 2000, 800)

if st.button("開始抓圖"):
    with tempfile.TemporaryDirectory() as tmp:
        results = process_page(
            url, pathlib.Path(tmp), make_session(),
            min_width=min_w, min_height=600,
            workers=4, timeout=15,
            sharpen=False, upscale_to=None,
            seen_md5=set(), show_progress=False,
        )
        st.success(f"下載 {len(results)} 張")
        for r in results:
            st.image(r.saved_path, caption=f"{r.category} | {r.width}×{r.height}")
```

`streamlit run app.py` 就有網頁版。

### 桌面 GUI（PySide6）

可以參考 `D:\project-dev\quant_agent\` 的 PySide6 七分頁架構（如果你有那個專案的話）。把 `process_page` 包成 `QThread` 即可，UI 只要 URL 輸入框 + 進度條 + 圖片預覽 grid。

### 整合到 Payload admin（已完成 — 見上方〈整合 chickimmiu 後台〉路線 B）

`POST /api/media/import-from-supplier` 已實作完成，在 [`src/endpoints/importFromSupplier.ts`](../../src/endpoints/importFromSupplier.ts)，註冊在 Media collection。後續要做的是 admin UI（按鈕 + modal），可以仿 `src/components/admin/HelpView` 的 pattern。

---

## 常見問題

### Q1. 跑出來 `[Empty] xxx 沒有抽到任何圖片`

可能原因：
1. **JS 動態載入**：requests + BeautifulSoup 看不到 SPA 渲染後的 DOM。改用 Playwright / Selenium。
2. **需要登入**：sinsangmarket.kr 沒登入只給 thumbnail。請帶 cookie。
3. **Anti-bot**：1688 對 python-requests UA 直接擋。本工具預設帶 Chrome UA 應該沒事，若仍被擋請改用住宅 IP。

### Q2. 大量 `[HTTP 403]`

降低 `--workers` 到 2-3，部分 CDN 對短時間內同 IP 的並發請求很敏感。

### Q3. Pillow 報 `cannot identify image file`

供應商給了 WebP/AVIF 但 Pillow 沒裝完整：
```bash
pip install --upgrade Pillow
```

### Q4. Windows 檔名編碼亂碼

Python 3.9+ 在 Windows 預設 UTF-8 模式下沒問題；如果有問題可在啟動時設環境變數：
```bash
set PYTHONUTF8=1
```

### Q5. 同一張圖出現好幾次

工具有兩層去重：URL 級（解析時）+ MD5 級（下載後）。如果還是出現重複，可能是 CDN 對同一張圖回了輕微差異的版本（壓縮率 / metadata 差幾 byte），這種情況可以接 `imagehash` 庫做感知雜湊去重，本工具沒做是為了保持依賴最小化。

---

## 已知限制

- **沒有 JS 渲染**：純 requests，動態網站抓不到。SPA 站請用 Playwright 改寫。
- **不做反 anti-bot**：沒有 IP 輪替、沒有 2captcha、沒有 puppeteer-stealth。需要這些請外接付費服務。
- **浮水印移除靠你自己接**：本工具只負責下載 + 基本增強。
- **單機效能**：用 ThreadPool，I/O bound 沒問題，但 CPU bound 的 image processing（upscale + sharpen 大批）會卡。要批次 100+ 張請考慮 multiprocess 改寫。

---

## License

MIT

---

## Changelog

- **v0.2.0**（2026-04-26）
  - 新增 `upload_to_payload.py`：讀 manifest.json 批次上傳 Payload Media，斷點續傳 + 自動重試。
  - 新增 Payload endpoint `POST /api/media/import-from-supplier`：admin 貼 URL 一鍵抓圖入庫，內建 SSRF 防護 + sharp 驗證 + dryRun 模式。Node 原生實作（無 Python runtime 依賴），註冊在 [`src/collections/Media.ts`](../../src/collections/Media.ts)。
- **v0.1.0**（2026-04-26）初版：lazy-load 抽取 + MD5 去重 + Pillow 驗證 + 並發下載 + 啟發式分類 + manifest.json 輸出。
