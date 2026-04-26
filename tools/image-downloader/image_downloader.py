#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
電商產品圖片快速下載工具 (image_downloader)
===========================================

支援的供應商網站：
  - sinsangmarket.kr      (韓國批發)
  - 1688.com / Alibaba    (中國批發)
  - chickimmiu.com        (自家後台 / Next.js _next/image 自動解包)
  - 一般 PDP 商品頁

主要能力：
  - 單一 URL / txt 清單批次處理
  - 涵蓋 lazy-load 屬性 (data-src / data-original / data-srcset / srcset / og:image / JSON-LD)
  - background-image inline style 解析
  - <a href> 直連大圖偵測（PDP 點圖看大圖常見）
  - MD5 內容去重 + Pillow 格式驗證
  - 解析度過濾 + 自動產生可讀檔名 + 主圖/細節圖分類
  - ThreadPoolExecutor 並發下載 + tqdm 進度條
  - 完整 timeout / 404 / 連線失敗錯誤處理
  - 輸出 manifest.json，可直接餵給後台上架腳本

依賴：requests / beautifulsoup4 / Pillow / tqdm / argparse (stdlib)
最低 Python：3.9（用到 list[str]、dict[str,int] 等 PEP 585 內建泛型語法）

作者：Claude × chickimmiu
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable, Optional
from urllib.parse import urljoin, urlparse, unquote, parse_qs

import requests
from bs4 import BeautifulSoup
from PIL import Image, ImageFilter, UnidentifiedImageError
from tqdm import tqdm


# ============================================================================
# 全域常數
# ============================================================================

# 真實 Chrome User-Agent，避免供應商網站封鎖 python-requests/* 字樣
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/121.0.0.0 Safari/537.36"
)

# 各家電商常見的 lazy-load 屬性（依出現頻率排序）
LAZY_LOAD_ATTRS = (
    "data-src",            # 最通用
    "data-original",       # jQuery lazyload 經典
    "data-lazy-src",       # WordPress 外掛
    "data-lazy",
    "data-srcset",         # responsive lazyload
    "data-original-src",   # Alibaba / 1688
    "data-actualsrc",      # 知乎、雪球
    "data-img",
    "data-url",
    "data-echo",           # echo.js
    "data-defer-src",
)

# 合法圖片副檔名（Pillow 全部都支援）
VALID_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"}

# 預設：HTTP timeout、並發數、最小解析度
DEFAULT_TIMEOUT = 15
DEFAULT_WORKERS = 8
DEFAULT_MIN_WIDTH = 800
DEFAULT_MIN_HEIGHT = 600

# 預設要排除的明顯垃圾（icon / logo / blank / spacer）
DEFAULT_EXCLUDE_RE = re.compile(
    r"(favicon|sprite|spacer|blank|placeholder|loading\.gif|1x1\.gif|"
    r"avatar|emoji|icon[-_./])",
    re.IGNORECASE,
)


# ============================================================================
# 資料結構
# ============================================================================

@dataclass
class ImageCandidate:
    """從 HTML 抽出來的候選圖片（尚未下載）"""
    url: str          # 絕對 URL
    alt: str = ""     # img alt / a title / 來源標籤名
    src_page: str = ""  # 來源頁面 URL（下載時當 Referer）


@dataclass
class DownloadResult:
    """成功下載並通過驗證的圖片紀錄"""
    url: str
    src_page: str
    saved_path: str
    width: int
    height: int
    size_bytes: int
    md5: str
    category: str    # main / detail / thumbnail / other
    alt: str = ""


# ============================================================================
# Network 層
# ============================================================================

def make_session(user_agent: str = DEFAULT_USER_AGENT) -> requests.Session:
    """
    建立帶有真實瀏覽器 header 的 requests.Session。
    使用 Session 可以重用 TCP 連線，多頁面下載時顯著加速。
    """
    session = requests.Session()
    session.headers.update({
        "User-Agent": user_agent,
        "Accept": (
            "text/html,application/xhtml+xml,application/xml;q=0.9,"
            "image/avif,image/webp,image/apng,*/*;q=0.8"
        ),
        # 韓國 (ko)、簡中 (zh-CN) 都加進來，部分供應商會根據 Accept-Language 換 CDN
        "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8,ko;q=0.7,zh-CN;q=0.6",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    })
    return session


def fetch_html(
    session: requests.Session,
    url: str,
    timeout: int = DEFAULT_TIMEOUT,
) -> Optional[str]:
    """
    抓取網頁 HTML；timeout / 4xx / 連線失敗都回傳 None 並印錯誤。
    用 tqdm.write 而不是 print，避免打亂進度條版面。
    """
    try:
        # 帶 Referer 自身可以提高某些 anti-bot 站的成功率
        resp = session.get(url, timeout=timeout, headers={"Referer": url})
        resp.raise_for_status()

        # 韓國站 sinsangmarket 經常不送 charset，requests 會誤判成 ISO-8859-1
        # 用 apparent_encoding 重抓編碼比較準
        if not resp.encoding or resp.encoding.lower() == "iso-8859-1":
            resp.encoding = resp.apparent_encoding

        return resp.text

    except requests.exceptions.Timeout:
        tqdm.write(f"[Timeout] {url}")
    except requests.exceptions.HTTPError as e:
        tqdm.write(f"[HTTP {e.response.status_code}] {url}")
    except requests.exceptions.ConnectionError as e:
        tqdm.write(f"[Conn] {url}: {e}")
    except requests.exceptions.RequestException as e:
        tqdm.write(f"[Network] {url}: {e}")
    return None


def fetch_image_bytes(
    session: requests.Session,
    url: str,
    referer: str,
    timeout: int = DEFAULT_TIMEOUT,
) -> Optional[bytes]:
    """
    下載圖檔 binary。Referer 對部分供應商必填（防盜連），
    例如 1688/淘寶 沒帶 Referer 會回 403。
    """
    try:
        headers = {"Referer": referer} if referer else {}
        resp = session.get(url, timeout=timeout, headers=headers, stream=True)
        resp.raise_for_status()

        # 防 HTML 404 偽裝成 200 回 HTML（常見於 CDN 失效）
        ctype = resp.headers.get("Content-Type", "").lower()
        if "html" in ctype or "json" in ctype or "text" in ctype:
            return None

        return resp.content

    except requests.exceptions.RequestException:
        # 圖片下載失敗很常見，不需要每張都印錯誤
        return None


# ============================================================================
# HTML 解析 / 圖片 URL 抽取
# ============================================================================

def parse_srcset(srcset: str) -> list[str]:
    """
    解析 srcset 屬性
    範例: "img-400.jpg 400w, img-800.jpg 800w, img-1600.jpg 2x"
    回傳所有 URL（不挑解析度，後面以 Pillow 實際 size 為準）
    """
    urls: list[str] = []
    for piece in srcset.split(","):
        piece = piece.strip()
        if not piece:
            continue
        # srcset 的每一段：URL [空白] 描述符（1x / 800w）
        urls.append(piece.split()[0])
    return urls


# inline style 的 background-image 規則
_BG_URL_RE = re.compile(
    r"background(?:-image)?\s*:\s*[^;]*url\(['\"]?([^'\")]+)['\"]?\)",
    re.IGNORECASE,
)


def unwrap_next_image_url(url: str, base_url: str) -> str:
    """
    Next.js Image Optimization proxy URL 格式：
        /_next/image?url=%2Fmedia%2Fxxx.jpg&w=1920&q=75
    我們要的是裡面那個原始 url（chickimmiu 自家後台用的就是這個）
    """
    parsed = urlparse(url)
    if "/_next/image" in parsed.path:
        qs = parse_qs(parsed.query)
        inner = qs.get("url", [None])[0]
        if inner:
            return urljoin(base_url, unquote(inner))
    return url


def _walk_json_for_images(node) -> Iterable[str]:
    """
    遞迴掃 JSON-LD 取出所有 image 欄位
    schema.org Product 通常是 { image: ["url1", "url2"] } 或 { image: "url" }
    """
    if isinstance(node, dict):
        for k, v in node.items():
            if k.lower() == "image":
                if isinstance(v, str):
                    yield v
                elif isinstance(v, list):
                    for x in v:
                        if isinstance(x, str):
                            yield x
                        elif isinstance(x, dict) and isinstance(x.get("url"), str):
                            yield x["url"]
                elif isinstance(v, dict) and isinstance(v.get("url"), str):
                    yield v["url"]
            else:
                # 不是 image key 也要繼續往下找（巢狀結構）
                yield from _walk_json_for_images(v)
    elif isinstance(node, list):
        for item in node:
            yield from _walk_json_for_images(item)


def extract_image_urls(html: str, base_url: str) -> list[ImageCandidate]:
    """
    從 HTML 萃取所有候選圖片 URL（含 lazy-load）
    依出現順序回傳，並做 URL 級去重
    """
    soup = BeautifulSoup(html, "html.parser")
    seen: set[str] = set()
    out: list[ImageCandidate] = []

    def add(raw: str, alt: str = ""):
        """共用：清洗 → 絕對化 → Next.js 解包 → 去重 → append"""
        if not raw:
            return
        raw = raw.strip()
        # 過濾 inline base64、anchor、JS 偽協定
        if raw.startswith(("data:", "javascript:", "#", "mailto:")):
            return
        abs_url = urljoin(base_url, raw)
        abs_url = unwrap_next_image_url(abs_url, base_url)
        if abs_url in seen:
            return
        seen.add(abs_url)
        out.append(ImageCandidate(url=abs_url, alt=alt or "", src_page=base_url))

    # ----- 1. 標準 <img> + 各種 lazy-load 屬性 -----
    for img in soup.find_all("img"):
        alt = (img.get("alt") or "").strip()
        if img.get("src"):
            add(img["src"], alt)
        if img.get("srcset"):
            for u in parse_srcset(img["srcset"]):
                add(u, alt)
        for attr in LAZY_LOAD_ATTRS:
            val = img.get(attr)
            if not val:
                continue
            if "srcset" in attr:
                for u in parse_srcset(val):
                    add(u, alt)
            else:
                add(val, alt)

    # ----- 2. <picture><source srcset> -----
    for source in soup.find_all("source"):
        srcset = source.get("srcset") or source.get("data-srcset")
        if srcset:
            for u in parse_srcset(srcset):
                add(u, "")

    # ----- 3. inline style background-image（部分電商主圖用 div 包） -----
    for tag in soup.find_all(style=True):
        for m in _BG_URL_RE.findall(tag["style"]):
            add(m, "")

    # ----- 4. <a href> 直連圖檔（PDP 點圖看大圖） -----
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        ext = os.path.splitext(urlparse(href).path)[1].lower()
        if ext in VALID_IMAGE_EXTS:
            add(href, (a.get("title") or "").strip())

    # ----- 5. <meta property="og:image">（PDP 主圖通常在這） -----
    for prop in ("og:image", "og:image:url", "og:image:secure_url"):
        for meta in soup.find_all("meta", attrs={"property": prop}):
            if meta.get("content"):
                add(meta["content"], "og_image")
    for meta in soup.find_all("meta", attrs={"name": "twitter:image"}):
        if meta.get("content"):
            add(meta["content"], "twitter_image")

    # ----- 6. JSON-LD Product schema（電商 SEO 規範常見） -----
    for script in soup.find_all("script", type="application/ld+json"):
        text = script.string or script.get_text() or ""
        try:
            data = json.loads(text)
        except Exception:
            continue  # JSON-LD 寫壞是常事，跳過
        for img_url in _walk_json_for_images(data):
            add(img_url, "json_ld")

    return out


# ============================================================================
# 檔名處理 / 啟發式分類
# ============================================================================

# Windows 與 Linux 共通的不合法檔名字元
_UNSAFE_FN_RE = re.compile(r'[\\/:*?"<>|\r\n\t]+')


def sanitize_filename(name: str, max_len: int = 80) -> str:
    """清掉 Windows 不能用的字元 + 開頭結尾的點和空白"""
    name = _UNSAFE_FN_RE.sub("_", name).strip(" ._")
    return name[:max_len]


def derive_filename(url: str, alt: str, idx: int) -> str:
    """
    產生候選檔名的優先順序：
      1. URL path 最後一段（含副檔名）
      2. img 的 alt 文字
      3. image_<idx 4位>.jpg
    """
    parsed = urlparse(url)
    raw = unquote(os.path.basename(parsed.path))
    base, ext = os.path.splitext(raw)
    base = sanitize_filename(base)
    ext = ext.lower() if ext.lower() in VALID_IMAGE_EXTS else ""

    if base and ext:
        return f"{base}{ext}"
    if alt:
        cleaned = sanitize_filename(alt)
        if cleaned:
            return f"{cleaned}{ext or '.jpg'}"
    return f"image_{idx:04d}{ext or '.jpg'}"


def classify_image(width: int, height: int, filename: str, alt: str) -> str:
    """
    粗略分類：main / detail / thumbnail / other
    純啟發式，後台上架時可再人工調整。

    規則：
      1. 檔名 / alt 有明確關鍵字 → 直接歸類
      2. 否則用 aspect ratio：
           接近正方 / 4:3 / 3:4 + 寬度 ≥ 600 → main
           直幅長條 (aspect < 0.7) → detail（韓貨細節長圖）
           寬橫條 (aspect > 2.5) → detail（橫向 banner）
    """
    text = f"{filename} {alt}".lower()

    # 1. 顯式關鍵字
    for kw in ("thumb", "thumbnail", "small", "mini"):
        if kw in text:
            return "thumbnail"
    for kw in ("detail", "describ", "desc_", "info", "spec", "size_chart", "size-chart"):
        if kw in text:
            return "detail"
    for kw in ("main", "primary", "cover", "hero", "og_image", "og-image", "twitter_image"):
        if kw in text:
            return "main"

    # 2. aspect ratio fallback
    if height == 0:
        return "other"
    aspect = width / height
    if aspect < 0.7:
        return "detail"          # 直幅長條 = 細節圖
    if 0.7 <= aspect <= 1.4 and width >= 600:
        return "main"            # 正方 / 直立商品照
    if aspect > 2.5:
        return "detail"          # 橫向 banner / 對比圖
    return "other"


# ============================================================================
# 圖片驗證 / 增強 / 存檔
# ============================================================================

def validate_and_open(content: bytes) -> Optional[Image.Image]:
    """
    用 Pillow 驗證 bytes 是不是合法圖。
    Image.open 是 lazy 的，需要呼叫 .load() 強制 decode 才會抓到損壞檔。
    """
    try:
        img = Image.open(io.BytesIO(content))
        img.load()
        return img
    except (UnidentifiedImageError, OSError, ValueError):
        return None


def enhance_image(
    img: Image.Image,
    *,
    sharpen: bool = False,
    upscale_to: Optional[int] = None,
) -> Image.Image:
    """
    輕度增強：
      - sharpen   : UnsharpMask（半徑 1.2、強度 120%、threshold 2）
      - upscale_to: 短邊放大到指定 px（LANCZOS 雙三次插值）

    注意：這裡只做基本影像處理，**無法**移除浮水印。
    浮水印移除需要：
      - OpenCV inpaint（規則式，效果有限）
      - AI 模型（lama-cleaner / IOPaint，需要顯卡）
    請自行另外處理，建議流程在 README 「實戰建議」一節有寫。
    """
    if upscale_to:
        w, h = img.size
        short = min(w, h)
        if short < upscale_to:
            ratio = upscale_to / short
            new_size = (int(w * ratio), int(h * ratio))
            img = img.resize(new_size, Image.LANCZOS)

    if sharpen:
        img = img.filter(
            ImageFilter.UnsharpMask(radius=1.2, percent=120, threshold=2)
        )
    return img


def save_image(img: Image.Image, save_path: Path, quality: int = 92) -> int:
    """
    存檔。JPEG 走 progressive + optimize，PNG 走 optimize，WEBP 用最高壓縮 method=6。
    回傳實際檔案大小（bytes）。
    """
    save_path.parent.mkdir(parents=True, exist_ok=True)
    fmt = (img.format or save_path.suffix.lstrip(".")).upper()

    if fmt in ("JPG", "JPEG"):
        # JPEG 不支援 alpha，要轉 RGB
        if img.mode in ("RGBA", "P", "LA"):
            bg = Image.new("RGB", img.size, (255, 255, 255))
            if img.mode == "RGBA":
                bg.paste(img, mask=img.split()[3])
            else:
                bg.paste(img.convert("RGBA"), mask=img.convert("RGBA").split()[3])
            img = bg
        img.save(save_path, "JPEG", quality=quality, optimize=True, progressive=True)
    elif fmt == "PNG":
        img.save(save_path, "PNG", optimize=True)
    elif fmt == "WEBP":
        img.save(save_path, "WEBP", quality=quality, method=6)
    else:
        img.save(save_path)

    return save_path.stat().st_size


# ============================================================================
# 主流程：單一頁面的下載 pipeline
# ============================================================================

def process_page(
    page_url: str,
    out_dir: Path,
    session: requests.Session,
    *,
    min_width: int,
    min_height: int,
    workers: int,
    timeout: int,
    sharpen: bool,
    upscale_to: Optional[int],
    seen_md5: set[str],
    exclude_re: Optional[re.Pattern] = None,
    show_progress: bool = True,
) -> list[DownloadResult]:
    """
    處理單一頁面：
      1. 抓 HTML
      2. 抽出所有候選 URL
      3. 過濾掉 exclude pattern
      4. 並發下載 → MD5 去重 → Pillow 驗證 → 解析度過濾
      5. 增強 → 存到頁面專屬子資料夾
    """
    html = fetch_html(session, page_url, timeout=timeout)
    if not html:
        return []

    candidates = extract_image_urls(html, page_url)

    # 過濾明顯垃圾
    if exclude_re is not None:
        candidates = [c for c in candidates if not exclude_re.search(c.url)]

    if not candidates:
        tqdm.write(f"[Empty] {page_url} 沒有抽到任何符合的圖片")
        return []

    # 為每個頁面建立獨立子資料夾，避免不同頁面同名圖檔互相覆蓋
    page_slug = sanitize_filename(
        urlparse(page_url).path.strip("/").replace("/", "_") or "root",
        60,
    ) or "root"
    page_dir = out_dir / page_slug

    results: list[DownloadResult] = []
    bar = tqdm(
        total=len(candidates),
        desc=page_slug[:30],
        unit="img",
        disable=not show_progress,
    )

    def worker(idx_cand: tuple[int, ImageCandidate]) -> Optional[DownloadResult]:
        """單一圖片的完整處理流程"""
        idx, cand = idx_cand

        # 1. 下載 binary
        content = fetch_image_bytes(
            session, cand.url, referer=cand.src_page, timeout=timeout
        )
        if not content:
            return None

        # 2. MD5 去重（跨頁全域，靠外層共享 set）
        md5 = hashlib.md5(content).hexdigest()
        if md5 in seen_md5:
            return None

        # 3. Pillow 驗證
        img = validate_and_open(content)
        if img is None:
            return None

        # 4. 解析度過濾
        w, h = img.size
        if w < min_width or h < min_height:
            return None

        # 5. 輕度增強
        img2 = enhance_image(img, sharpen=sharpen, upscale_to=upscale_to)

        # 6. 產檔名 + 同名衝突處理
        filename = derive_filename(cand.url, cand.alt, idx)
        save_path = page_dir / filename
        if save_path.exists():
            stem, ext = os.path.splitext(filename)
            save_path = page_dir / f"{stem}_{md5[:6]}{ext}"

        # 7. 存檔
        size = save_image(img2, save_path)
        seen_md5.add(md5)

        return DownloadResult(
            url=cand.url,
            src_page=cand.src_page,
            saved_path=str(save_path),
            width=img2.width,
            height=img2.height,
            size_bytes=size,
            md5=md5,
            category=classify_image(img2.width, img2.height, filename, cand.alt),
            alt=cand.alt,
        )

    # 8. 並發跑
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futures = {ex.submit(worker, (i, c)): c for i, c in enumerate(candidates)}
        for fut in as_completed(futures):
            try:
                r = fut.result()
                if r:
                    results.append(r)
            except Exception as e:
                tqdm.write(f"[Worker Error] {e}")
            finally:
                bar.update(1)
    bar.close()

    return results


# ============================================================================
# CLI
# ============================================================================

def read_url_list(path: Path) -> list[str]:
    """從 txt 讀 URL 清單。每行一個，# 開頭視為註解，空行略過"""
    urls: list[str] = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        urls.append(line)
    return urls


def write_manifest(results: list[DownloadResult], path: Path) -> None:
    """
    輸出 manifest.json。
    可以直接餵給後台上架腳本，例如 POST /api/media（chickimmiu Payload）
    """
    by_cat: dict[str, int] = {}
    for r in results:
        by_cat[r.category] = by_cat.get(r.category, 0) + 1

    payload = {
        "total": len(results),
        "by_category": by_cat,
        "items": [asdict(r) for r in results],
    }
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="電商產品圖片快速下載工具（sinsangmarket / Alibaba / chickimmiu 通用）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
範例：
  # 單一商品頁
  python image_downloader.py -u https://sinsangmarket.kr/item/12345

  # 從 txt 批次（每行一個 URL）
  python image_downloader.py -f urls.txt -o downloads/

  # 高解析度模式（最小 1200x1200 + 銳利化）
  python image_downloader.py -u <URL> --min-width 1200 --min-height 1200 --sharpen

  # 短邊放大到 1600px（原圖太小時補解析度）
  python image_downloader.py -u <URL> --upscale 1600

  # 自家後台抓圖（自動解開 Next.js _next/image proxy）
  python image_downloader.py -u https://www.chickimmiu.com/products/<slug>

提示：
  - sinsangmarket.kr 需要登入才能看大圖，請先在瀏覽器登入後從 DevTools 拷 cookie
    透過 --user-agent 與 cookie header 的方式請見 README。
  - 1688/淘寶 必須帶 Referer，工具預設已帶；若仍 403 請降低 --workers 至 2-3。
""",
    )

    src = p.add_mutually_exclusive_group(required=True)
    src.add_argument("-u", "--url", help="單一商品頁 URL")
    src.add_argument("-f", "--file", type=Path, help="URL 清單 txt（每行一個）")

    p.add_argument(
        "-o", "--output", type=Path, default=Path("downloads"),
        help="輸出資料夾（預設 ./downloads）",
    )
    p.add_argument(
        "--min-width", type=int, default=DEFAULT_MIN_WIDTH,
        help=f"最小寬度 px（預設 {DEFAULT_MIN_WIDTH}）",
    )
    p.add_argument(
        "--min-height", type=int, default=DEFAULT_MIN_HEIGHT,
        help=f"最小高度 px（預設 {DEFAULT_MIN_HEIGHT}）",
    )
    p.add_argument(
        "-w", "--workers", type=int, default=DEFAULT_WORKERS,
        help=f"並發下載數（預設 {DEFAULT_WORKERS}，被擋就降到 2-3）",
    )
    p.add_argument(
        "-t", "--timeout", type=int, default=DEFAULT_TIMEOUT,
        help=f"HTTP timeout 秒（預設 {DEFAULT_TIMEOUT}）",
    )
    p.add_argument(
        "--user-agent", default=DEFAULT_USER_AGENT,
        help="自訂 User-Agent（預設 Chrome 121 Windows）",
    )
    p.add_argument(
        "--sharpen", action="store_true",
        help="開啟輕度銳利化（UnsharpMask）",
    )
    p.add_argument(
        "--upscale", type=int, default=0,
        help="把短邊放大到此像素（0=關閉；建議只在原圖 <1000px 時使用）",
    )
    p.add_argument(
        "--exclude", default=None,
        help="排除 URL 的 regex（預設過濾 favicon/sprite/icon 等垃圾，傳 'none' 關閉）",
    )
    p.add_argument(
        "--no-progress", action="store_true",
        help="不顯示 tqdm 進度條",
    )
    p.add_argument(
        "--no-manifest", action="store_true",
        help="不寫 manifest.json",
    )
    return p


def main(argv: Optional[list[str]] = None) -> int:
    args = build_parser().parse_args(argv)

    # 收集 URL
    if args.url:
        urls = [args.url]
    else:
        if not args.file.exists():
            print(f"[Error] 找不到 URL 清單：{args.file}", file=sys.stderr)
            return 1
        urls = read_url_list(args.file)
        if not urls:
            print(f"[Error] {args.file} 沒有有效 URL", file=sys.stderr)
            return 1

    # 解析 exclude pattern
    if args.exclude is None:
        exclude_re = DEFAULT_EXCLUDE_RE
    elif args.exclude.lower() == "none":
        exclude_re = None
    else:
        exclude_re = re.compile(args.exclude, re.IGNORECASE)

    args.output.mkdir(parents=True, exist_ok=True)
    session = make_session(args.user_agent)
    seen_md5: set[str] = set()
    all_results: list[DownloadResult] = []

    print(f"[Start] 共 {len(urls)} 個頁面 -> {args.output.resolve()}")
    for i, url in enumerate(urls, 1):
        print(f"\n[{i}/{len(urls)}] {url}")
        rs = process_page(
            url,
            args.output,
            session,
            min_width=args.min_width,
            min_height=args.min_height,
            workers=args.workers,
            timeout=args.timeout,
            sharpen=args.sharpen,
            upscale_to=args.upscale or None,
            seen_md5=seen_md5,
            exclude_re=exclude_re,
            show_progress=not args.no_progress,
        )
        all_results.extend(rs)
        print(f"   下載 {len(rs)} 張（去重後）")

    # 統計
    by_cat: dict[str, int] = {}
    for r in all_results:
        by_cat[r.category] = by_cat.get(r.category, 0) + 1
    print(f"\n[Done] 總計 {len(all_results)} 張，分類分佈：{by_cat}")

    if not args.no_manifest and all_results:
        manifest_path = args.output / "manifest.json"
        write_manifest(all_results, manifest_path)
        print(f"[Manifest] {manifest_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
