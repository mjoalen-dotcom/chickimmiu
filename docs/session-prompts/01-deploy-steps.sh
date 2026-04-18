#!/usr/bin/env bash
# =========================================================================
# 01 — Emergency deploy: media restore + secret rotation
# -------------------------------------------------------------------------
# 執行地點：使用者本機 (Windows Git Bash 或 WSL)
# 前置條件：
#   1. PR `fix/prod-media-secrets` 已 merge 進 main（若沒 merge，腳本 3d 會拉到新 code 但含不到本 commit 的 rebuild — 要重跑）
#   2. 已準備好 Cloudflare R2 新的 Access Key / Secret (可在跑腳本時即時產)
#   3. SSH 金鑰可登入 prod
# -------------------------------------------------------------------------
# 跑法：
#   1. 把下方 PROD_HOST 換成真正的 IP
#   2. chmod +x docs/session-prompts/01-deploy-steps.sh
#   3. ./docs/session-prompts/01-deploy-steps.sh
# =========================================================================
set -euo pipefail

# ---------------- 需填入 ----------------
PROD_HOST="root@<HETZNER_IP>"          # <-- 改這裡
PROD_PATH="/var/www/chickimmiu"
LOCAL_REPO="/c/Users/mjoal/ally-site/chickimmiu"
# ----------------------------------------

echo "==> 1) 本機打包 public/media/ ..."
cd "${LOCAL_REPO}"
if [ ! -d public/media ] || [ -z "$(ls -A public/media 2>/dev/null)" ]; then
  echo "ERROR: public/media/ 不存在或空，abort"
  exit 1
fi
MEDIA_COUNT=$(find public/media -type f | wc -l)
MEDIA_SIZE=$(du -sh public/media | cut -f1)
echo "    本機檔案: ${MEDIA_COUNT} 個，總 ${MEDIA_SIZE}"
tar czf /tmp/ckmu-media.tgz public/media/
TGZ_SIZE=$(du -sh /tmp/ckmu-media.tgz | cut -f1)
echo "    打包完成: /tmp/ckmu-media.tgz (${TGZ_SIZE})"

echo ""
echo "==> 2) scp 上傳到 prod ..."
scp /tmp/ckmu-media.tgz "${PROD_HOST}:${PROD_PATH}/ckmu-media.tgz"

echo ""
echo "==> 3) SSH 進 prod 做解壓 + 輪換 PAYLOAD_SECRET + rebuild ..."
ssh "${PROD_HOST}" bash <<REMOTE
set -euo pipefail
cd ${PROD_PATH}

echo "--- 3a) 解壓 media ---"
tar xzf ckmu-media.tgz
chown -R www-data:www-data public/media/
rm ckmu-media.tgz
REMOTE_COUNT=\$(find public/media -type f | wc -l)
echo "Prod media files: \${REMOTE_COUNT}"
if [ "\${REMOTE_COUNT}" -lt 400 ]; then
  echo "ERROR: 解壓後檔案數異常 (< 400)，abort"
  exit 1
fi

echo ""
echo "--- 3b) 輪換 PAYLOAD_SECRET ---"
NEW_SECRET=\$(openssl rand -base64 48 | tr -d '/+=' | cut -c1-48)
BACKUP_SUFFIX=\$(date +%Y%m%d-%H%M%S)
cp .env .env.backup-\${BACKUP_SUFFIX}
echo "舊 .env 備份到 .env.backup-\${BACKUP_SUFFIX}"
# 置換 PAYLOAD_SECRET；如果該 key 不存在則 append
if grep -q '^PAYLOAD_SECRET=' .env; then
  sed -i "s|^PAYLOAD_SECRET=.*|PAYLOAD_SECRET=\${NEW_SECRET}|" .env
else
  echo "PAYLOAD_SECRET=\${NEW_SECRET}" >> .env
fi
echo "新 PAYLOAD_SECRET 已寫入 .env (長度 \$(grep '^PAYLOAD_SECRET=' .env | cut -d= -f2 | wc -c))"
echo "注意：所有既有 payload-token JWT 將失效；使用者需重新登入一次"

echo ""
echo "--- 3c) R2 key 輪換提示 ---"
echo "請到 https://dash.cloudflare.com/?to=/:account/r2/api-tokens"
echo "  1. 刪除含 74d908356510... 的舊 token"
echo "  2. 建新 token（權限：Object Read & Write / 指定 bucket）"
echo "  3. 把新的 Access Key ID + Secret Access Key 填到 .env"
echo "     R2_ACCESS_KEY_ID=..."
echo "     R2_SECRET_ACCESS_KEY=..."
echo ""
read -p "完成後按 enter 繼續，若想 skip R2 rotation 先跑 media fix，Ctrl+C 後再跑一次" _

echo ""
echo "--- 3d) Git pull + install + build + restart ---"
CURRENT_PROD_SHA=\$(git rev-parse HEAD)
echo "Prod 目前 HEAD: \${CURRENT_PROD_SHA}"
git fetch origin
git checkout main
git pull --ff-only origin main
NEW_PROD_SHA=\$(git rev-parse HEAD)
echo "拉到 HEAD: \${NEW_PROD_SHA}"

# 確認拉到的 main 包含本次 security fix
if ! git log --format=%H origin/main | head -20 | grep -q "^8b124f0"; then
  echo "WARNING: main 似乎還沒包含 security fix commit 8b124f0"
  echo "         PR 是否已 merge 進 main？"
  read -p "要繼續 rebuild 嗎？(y/N) " GO
  if [ "\${GO}" != "y" ]; then
    echo "abort"
    exit 1
  fi
fi

pnpm install --frozen-lockfile
pnpm build
pm2 restart chickimmiu-nextjs
pm2 save
sleep 3

echo ""
echo "--- 3e) Smoke test ---"
echo "/ :                 \$(curl -sI http://localhost:3000/ | head -1)"
echo "/media/hero-1.webp: \$(curl -sI http://localhost:3000/media/hero-1.webp | head -1)"
echo "pm2 status:"
pm2 list | grep chickimmiu
REMOTE

echo ""
echo "==> 4) 外部驗證（使用者自行在瀏覽器確認）:"
echo "     curl -sI https://pre.chickimmiu.com/media/hero-1.webp   # 應 200"
echo "     open https://pre.chickimmiu.com/ 檢查 hero 圖有出現"
echo ""
echo "==> 5) 清 /tmp"
rm -f /tmp/ckmu-media.tgz

echo ""
echo "DONE. 若 hero 圖仍破："
echo "  - 清瀏覽器 cache (Ctrl+Shift+R)"
echo "  - ssh prod 後檢查 nginx access log: tail /var/log/nginx/access.log"
echo "  - ls -la ${PROD_PATH}/public/media/ | head"
