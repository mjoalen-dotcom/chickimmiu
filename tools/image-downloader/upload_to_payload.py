#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Manifest → Payload Media 批次上傳器
====================================

讀取 image_downloader.py 產生的 manifest.json，把圖片批次 POST 到
chickimmiu Payload 的 `/api/media` endpoint。

使用流程：
    1. 先跑 image_downloader.py 下載 + 產 manifest.json
    2. 再跑這支：
        python upload_to_payload.py \\
            --base-url https://www.chickimmiu.com \\
            --email admin@example.com \\
            --password ******* \\
            --manifest downloads/manifest.json \\
            --categories main,detail

特性：
    - 登入一次拿 JWT token，後續用 Authorization: JWT <token>
    - 每張圖以 multipart 上傳，附帶 alt（required）+ folder（自動分組）
    - 支援 --dry-run 只列要傳什麼
    - 寫 uploaded.json 紀錄 {local_path: {id, filename, ...}}
       重跑時自動 skip 已上傳，可斷點續傳
    - 預設只傳 main + detail，跳過 thumbnail / other
    - 失敗自動重試 3 次（exponential backoff）
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import sys
import time
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import requests
from tqdm import tqdm


# ============================================================================
# 常數
# ============================================================================

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/121.0.0.0 Safari/537.36"
)

# Payload Media 的 MIME 白名單（Media.ts 對齊）
ALLOWED_MIMES = {
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "video/mp4", "application/pdf",
}

# 重試策略
MAX_RETRIES = 3
RETRY_BACKOFF = (1, 3, 7)  # 第 1/2/3 次重試前等的秒數


# ============================================================================
# Payload API client
# ============================================================================

class PayloadClient:
    """
    最小化的 Payload v3 REST client，只做這支工具會用到的事。
    Token 有效期由 Payload 控制（預設 7200 秒），長批次跑超過要重新 login。
    """

    def __init__(self, base_url: str, user_agent: str = DEFAULT_USER_AGENT):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": user_agent,
            "Accept": "application/json",
        })
        self.token: Optional[str] = None

    def login(self, email: str, password: str) -> dict:
        """POST /api/users/login → 拿 JWT 並寫進預設 header"""
        resp = self.session.post(
            f"{self.base_url}/api/users/login",
            json={"email": email, "password": password},
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        token = data.get("token")
        if not token:
            raise RuntimeError(f"login 沒拿到 token；回應：{data}")
        self.token = token
        # Payload 認 Authorization: JWT 也認 cookie，這裡用 header 比較單純
        self.session.headers["Authorization"] = f"JWT {token}"
        return data.get("user", {})

    def upload_media(
        self,
        file_path: Path,
        alt: str,
        folder: Optional[str] = None,
        caption: Optional[str] = None,
        timeout: int = 60,
    ) -> dict:
        """
        POST /api/media — multipart 上傳
        Payload v3 接受 `_payload` 欄位放 JSON metadata，`file` 欄位放檔案。
        """
        mime, _ = mimetypes.guess_type(str(file_path))
        if mime not in ALLOWED_MIMES:
            raise ValueError(f"不支援的 MIME：{mime}（允許：{sorted(ALLOWED_MIMES)}）")

        meta: dict = {"alt": alt}
        if folder:
            meta["folder"] = folder
        if caption:
            meta["caption"] = caption

        # 檔案太大 Payload 會回 413；這裡就先擋 8MB（圖片上限）
        size = file_path.stat().st_size
        if mime.startswith("image/") and size > 8 * 1024 * 1024:
            raise ValueError(f"圖片超過 8MB（{size / 1024 / 1024:.1f}MB）")

        with file_path.open("rb") as f:
            files = {"file": (file_path.name, f, mime)}
            data = {"_payload": json.dumps(meta, ensure_ascii=False)}
            resp = self.session.post(
                f"{self.base_url}/api/media",
                files=files,
                data=data,
                timeout=timeout,
            )

        # 401 → token 失效；403 → 帳號權限不足；413 → 檔案過大
        if resp.status_code == 401:
            raise PermissionError("token 失效或未登入")
        if resp.status_code == 403:
            raise PermissionError("此帳號不能上傳 media（檢查 access.create）")
        resp.raise_for_status()

        body = resp.json()
        # Payload v3 create 回 { doc: {...}, message }
        return body.get("doc") or body


# ============================================================================
# 主流程
# ============================================================================

def load_manifest(path: Path) -> dict:
    if not path.exists():
        raise SystemExit(f"[Error] 找不到 manifest：{path}")
    return json.loads(path.read_text(encoding="utf-8"))


def load_uploaded(path: Path) -> dict[str, dict]:
    """讀已上傳紀錄；用於斷點續傳"""
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {}


def save_uploaded(path: Path, data: dict[str, dict]) -> None:
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def derive_alt(item: dict) -> str:
    """
    Media.alt 是 required。優先順序：
      1. manifest 紀錄的 alt
      2. URL 最後一段檔名（去副檔名）
      3. 'image'
    """
    alt = (item.get("alt") or "").strip()
    if alt:
        return alt[:200]  # Payload text 預設不限長度，給個合理上限
    raw = item.get("url", "") or item.get("saved_path", "")
    stem = Path(urlparse(raw).path or raw).stem
    return stem or "image"


def derive_folder(item: dict, manifest_dir: Path) -> str:
    """
    把每個來源頁的圖片歸到同一個資料夾，方便後台 filter。
    例如 saved_path = downloads/sinsang_item_12345/main_001.jpg
       → folder = sinsang_item_12345
    """
    saved = Path(item.get("saved_path", ""))
    try:
        rel = saved.resolve().relative_to(manifest_dir.resolve())
        # 第一層子資料夾就是頁面 slug
        return rel.parts[0] if len(rel.parts) > 1 else manifest_dir.name
    except (ValueError, OSError):
        return manifest_dir.name


def upload_with_retry(
    client: PayloadClient,
    file_path: Path,
    alt: str,
    folder: str,
    caption: Optional[str] = None,
) -> Optional[dict]:
    """有重試的單張上傳；最終失敗回 None"""
    last_err: Optional[Exception] = None
    for attempt in range(MAX_RETRIES + 1):
        try:
            return client.upload_media(file_path, alt=alt, folder=folder, caption=caption)
        except (PermissionError, ValueError) as e:
            # 權限 / 檔案問題重試也沒用
            tqdm.write(f"[Skip] {file_path.name}: {e}")
            return None
        except (requests.exceptions.RequestException, RuntimeError) as e:
            last_err = e
            if attempt < MAX_RETRIES:
                wait = RETRY_BACKOFF[attempt]
                tqdm.write(f"[Retry {attempt + 1}/{MAX_RETRIES}] {file_path.name}: {e}（{wait}s）")
                time.sleep(wait)
            else:
                tqdm.write(f"[Fail] {file_path.name}: {e}")
    return None


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="把 image_downloader 的 manifest.json 批次上傳到 chickimmiu Payload",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("--base-url", required=True,
                   help="Payload 基底 URL，例如 https://www.chickimmiu.com 或 http://localhost:3000")
    p.add_argument("--email", required=True, help="Payload 帳號 email")
    p.add_argument("--password", required=True, help="Payload 帳號密碼")
    p.add_argument("--manifest", type=Path, required=True,
                   help="image_downloader.py 產生的 manifest.json 路徑")
    p.add_argument("--categories", default="main,detail",
                   help="只上傳這些分類（逗號分隔，預設 main,detail；填 'all' 全傳）")
    p.add_argument("--folder-prefix", default="",
                   help="folder 欄位前綴（例如批次代號 SS25-001）")
    p.add_argument("--uploaded-log", type=Path, default=None,
                   help="已上傳紀錄路徑（預設與 manifest 同資料夾的 uploaded.json）")
    p.add_argument("--dry-run", action="store_true",
                   help="只列要上傳什麼，不實際傳")
    p.add_argument("--timeout", type=int, default=60, help="上傳 timeout 秒（預設 60）")
    return p


def main(argv: Optional[list[str]] = None) -> int:
    args = build_parser().parse_args(argv)

    manifest = load_manifest(args.manifest)
    items = manifest.get("items") or []
    if not items:
        print("[Error] manifest 沒有 items", file=sys.stderr)
        return 1

    # 分類過濾
    if args.categories.lower() == "all":
        category_filter: Optional[set[str]] = None
    else:
        category_filter = {c.strip() for c in args.categories.split(",") if c.strip()}
    if category_filter is not None:
        items = [it for it in items if it.get("category") in category_filter]

    if not items:
        print(f"[Empty] 沒有任何符合 categories={args.categories} 的 item")
        return 0

    # 已上傳紀錄
    uploaded_log = args.uploaded_log or args.manifest.parent / "uploaded.json"
    uploaded = load_uploaded(uploaded_log)
    pending = [it for it in items if it["saved_path"] not in uploaded]
    skipped_already = len(items) - len(pending)

    print(f"[Plan] 總 {len(items)} | 已上傳 {skipped_already} | 待上傳 {len(pending)}")

    if args.dry_run:
        print("\n[Dry-run] 將上傳的檔案：")
        for it in pending:
            print(f"  {it['category']:9} {it['saved_path']} (alt={derive_alt(it)!r})")
        return 0

    if not pending:
        print("[Done] 沒有新的檔案要上傳")
        return 0

    # 登入
    client = PayloadClient(args.base_url)
    try:
        user = client.login(args.email, args.password)
        print(f"[Login] 成功，user.id={user.get('id')} role={user.get('role')}")
    except requests.exceptions.HTTPError as e:
        print(f"[Login Failed] {e.response.status_code}: {e.response.text[:200]}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"[Login Failed] {e}", file=sys.stderr)
        return 1

    # 批次上傳
    bar = tqdm(total=len(pending), desc="upload", unit="img")
    success = 0
    failed = 0

    for it in pending:
        local_path = Path(it["saved_path"])
        if not local_path.exists():
            tqdm.write(f"[Missing] {local_path}")
            failed += 1
            bar.update(1)
            continue

        folder = derive_folder(it, args.manifest.parent)
        if args.folder_prefix:
            folder = f"{args.folder_prefix}-{folder}"

        result = upload_with_retry(
            client,
            local_path,
            alt=derive_alt(it),
            folder=folder,
            caption=None,
        )

        if result and result.get("id") is not None:
            uploaded[str(local_path)] = {
                "id": result["id"],
                "filename": result.get("filename"),
                "url": result.get("url"),
                "alt": result.get("alt"),
                "folder": folder,
                "category": it.get("category"),
                "src_url": it.get("url"),
            }
            # 每張都 flush，避免中途 crash 丟進度
            save_uploaded(uploaded_log, uploaded)
            success += 1
        else:
            failed += 1

        bar.update(1)

    bar.close()
    print(f"\n[Done] 成功 {success} / 失敗 {failed} → {uploaded_log}")
    print(f"  下一步：把 uploaded.json 餵給商品上架腳本，連到 Products.images[*].image")
    return 0 if failed == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
