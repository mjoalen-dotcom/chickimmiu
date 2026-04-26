#!/usr/bin/env node
/**
 * scripts/install-git-hooks.mjs
 * ------------------------------
 * 由 package.json 的 `prepare` script 觸發。
 *
 * 把 git 的 hooksPath 指向 .githooks/，讓本 repo 的所有 commit / push
 * 自動跑 .githooks/ 底下的 hook（目前有 pre-commit 自動 regen
 * public/downloads/image-downloader.zip）。
 *
 * 安全：
 *   - 不在 git checkout 內就 skip（例如 npm 把這支當依賴解壓到 tarball）
 *   - 沒裝 git 就 skip（不擋 install）
 *   - 只動 local config (.git/config)，不動 user/global
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

// 不在 git repo（例如下載成 zip 解壓的場景）→ skip
if (!existsSync('.git')) {
  process.exit(0)
}

const r = spawnSync('git', ['config', 'core.hooksPath', '.githooks'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  encoding: 'utf8',
})

if (r.error) {
  // git 不在 PATH 上 → 警告但不擋 install
  console.warn('[prepare] git not available, skipping hooksPath setup:', r.error.message)
  process.exit(0)
}

if (r.status !== 0) {
  console.warn('[prepare] git config failed:', r.stderr?.trim() || `exit ${r.status}`)
  process.exit(0)
}

// 安靜成功
