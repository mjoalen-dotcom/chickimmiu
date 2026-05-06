#!/usr/bin/env node
/**
 * scripts/pack-image-downloader.mjs
 * ----------------------------------
 * 把 tools/image-downloader/ 打包成 public/downloads/image-downloader.zip。
 * 後台 /admin/help 頁面的「下載供應商圖片下載工具」連結會指到這個檔。
 *
 * 用法：
 *   node scripts/pack-image-downloader.mjs
 *
 * 何時要重跑：
 *   - 通常不用手動跑 — `.githooks/pre-commit` 偵測到 tools/image-downloader/
 *     有改動會自動跑這個腳本並把產出 zip 加進 commit。
 *   - 想單獨打包做測試、或 hook 被 SKIP_IMAGE_DOWNLOADER_PACK=1 / --no-verify 跳過時，
 *     再手動跑這支。
 *
 * 跨平台：
 *   - Windows：用內建 PowerShell Compress-Archive（不用裝額外工具）
 *   - macOS / Linux：用 zip CLI（macOS 內建；Linux 多數發行版預裝或 apt install zip）
 */

import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, existsSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const SRC = resolve(ROOT, 'tools', 'image-downloader')
const OUT_DIR = resolve(ROOT, 'public', 'downloads')
const OUT_FILE = resolve(OUT_DIR, 'image-downloader.zip')

if (!existsSync(SRC)) {
  console.error(`[pack] source not found: ${SRC}`)
  process.exit(1)
}

mkdirSync(OUT_DIR, { recursive: true })
if (existsSync(OUT_FILE)) rmSync(OUT_FILE)

console.log(`[pack] src: ${SRC}`)
console.log(`[pack] out: ${OUT_FILE}`)

const isWindows = process.platform === 'win32'

let result
if (isWindows) {
  // PowerShell Compress-Archive
  // -Path '<dir>\*' 把檔案放在 zip 根（沒有外層 image-downloader/ folder），
  // 讓使用者下載解壓得到一個跟 zip 同名的資料夾就好（多數解壓工具會這樣處理）
  const psCmd = `Compress-Archive -Path '${SRC.replace(/'/g, "''")}\\*' -DestinationPath '${OUT_FILE.replace(/'/g, "''")}' -Force`
  result = spawnSync('powershell.exe', ['-NoProfile', '-Command', psCmd], {
    stdio: 'inherit',
  })
} else {
  // 一般 unix：zip 命令必裝
  // -r 遞迴；-x 排除 .pyc 與 __pycache__
  result = spawnSync(
    'zip',
    ['-r', OUT_FILE, '.', '-x', '*.pyc', '__pycache__/*', '*/.DS_Store'],
    { cwd: SRC, stdio: 'inherit' },
  )
}

if (result.status !== 0) {
  console.error(`[pack] FAILED with status ${result.status}`)
  if (result.error) console.error(result.error.message)
  process.exit(result.status ?? 1)
}

const size = statSync(OUT_FILE).size
console.log(`[pack] done — ${(size / 1024).toFixed(1)} KB`)
