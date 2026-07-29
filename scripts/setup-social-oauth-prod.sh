#!/usr/bin/env bash
# Google / Apple 社群登入憑證一鍵設定 + 自我驗證（prod 專用）
# ────────────────────────────────────────────────────────────
# 程式端（auth.ts / 登入頁按鈕 / bridge）早已支援四個 provider，缺的只是 env 憑證。
# 本腳本照 setup-ecpay-logistics-prod.sh 的原則：先對 provider 官方端點驗證憑證
# （零副作用），驗過才動 .env，寫完 pm2 restart 再打自家 /api/auth/providers 驗收。
#
# 用法（在 prod 主機 /var/www/chickimmiu 下執行）：
#   scripts/setup-social-oauth-prod.sh google   <CLIENT_ID> <CLIENT_SECRET>
#   scripts/setup-social-oauth-prod.sh facebook <APP_ID> <APP_SECRET>
#   scripts/setup-social-oauth-prod.sh apple    <SERVICES_ID> <TEAM_ID> <KEY_ID> <P8檔路徑>
#   scripts/setup-social-oauth-prod.sh apple-renew        # cron 用：重簽 Apple secret
#
# 憑證怎麼申請：docs/OAUTH_GOOGLE_APPLE_SETUP.md
#
# 驗證原理（零副作用）：Google/Apple 拿憑證 + 一個假 authorization code 打官方 token
# endpoint —— 回 invalid_grant = 憑證通過驗證只是 code 是假的（預期）；
# 回 invalid_client = 憑證本身錯，中止不動 .env。
# Facebook 更直接：client_credentials grant 換 app access token，換得到 = 憑證正確。
set -euo pipefail

ENV_FILE=/var/www/chickimmiu/.env
APP=chickimmiu-nextjs
SECRETS_DIR=/var/www/chickimmiu/secrets
GEN=/var/www/chickimmiu/scripts/generate-apple-client-secret.mjs

MODE="${1:-}"

backup_env() {
  cp "$ENV_FILE" "$ENV_FILE.bak-oauth-$(date +%Y%m%d-%H%M%S)"
}

restart_and_verify() { # $1 = provider id 應出現在 /api/auth/providers
  local provider="$1"
  echo "== 重啟 + /api/auth/providers 驗收 =="
  pm2 restart "$APP" --update-env >/dev/null
  local CODE=""
  for _ in $(seq 1 30); do
    sleep 3
    CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:3000/ || true)
    [ "$CODE" = "200" ] && break
  done
  [ "$CODE" = "200" ] || { echo "❌ app 3000 沒回 200（最後=$CODE），請查 pm2 logs $APP"; exit 1; }
  local PROVIDERS
  PROVIDERS=$(curl -s --max-time 10 http://localhost:3000/api/auth/providers || true)
  if echo "$PROVIDERS" | grep -q "\"$provider\""; then
    echo "🎉 $provider 已註冊進 NextAuth（/api/auth/providers 有它）"
  else
    echo "❌ /api/auth/providers 沒看到 $provider：$(echo "$PROVIDERS" | head -c 300)"
    exit 1
  fi
}

check_token_endpoint() { # $1=url $2=client_id $3=client_secret → global TOKEN_RESULT
  TOKEN_RESULT=$(curl -s --max-time 15 -X POST "$1" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    --data-urlencode "client_id=$2" \
    --data-urlencode "client_secret=$3" \
    --data-urlencode 'grant_type=authorization_code' \
    --data-urlencode 'code=ckmu_bogus_code_for_credential_check' \
    --data-urlencode 'redirect_uri=https://pre.chickimmiu.com/api/auth/callback/dummy' || true)
}

case "$MODE" in
# ───────────────────────────── Google ─────────────────────────────
google)
  CID="${2:-}"; CSECRET="${3:-}"
  if [ -z "$CID" ]; then read -rp "Google Client ID: " CID; fi
  if [ -z "$CSECRET" ]; then read -rp "Google Client Secret: " CSECRET; fi

  [[ "$CID" == *.apps.googleusercontent.com ]] \
    || { echo "❌ Client ID 應以 .apps.googleusercontent.com 結尾：$CID"; exit 1; }
  [[ "$CSECRET" == GOCSPX-* ]] \
    || echo "⚠️ Client Secret 不是 GOCSPX- 開頭（舊制 secret 也可能有效，繼續驗證）"

  echo "== 1/3 對 Google token endpoint 驗證憑證（零副作用）=="
  check_token_endpoint 'https://oauth2.googleapis.com/token' "$CID" "$CSECRET"
  echo "   Google 回應：$(echo "$TOKEN_RESULT" | head -c 200)"
  if echo "$TOKEN_RESULT" | grep -q 'invalid_client'; then
    echo "   ❌ invalid_client —— Client ID/Secret 抄錯，.env 未變動"; exit 1
  elif echo "$TOKEN_RESULT" | grep -q 'invalid_grant\|invalid_request\|redirect_uri_mismatch'; then
    echo "   ✅ 憑證有效（client 驗證通過，假 code 被拒是預期結果）"
  else
    echo "   ⚠️ 非預期回應——保守起見中止，.env 未變動"; exit 1
  fi

  echo "== 2/3 寫入 $ENV_FILE =="
  backup_env
  sed -i '/^AUTH_GOOGLE_ID=/d;/^AUTH_GOOGLE_SECRET=/d' "$ENV_FILE"
  { echo "AUTH_GOOGLE_ID=$CID"; echo "AUTH_GOOGLE_SECRET=$CSECRET"; } >> "$ENV_FILE"
  echo "   已寫入 2 行（舊 .env 已備份）"

  restart_and_verify google
  echo "   下一步：後台「網站全域設定 → 社群登入」確認 Google 開關是開的（預設開），"
  echo "   然後真瀏覽器走一次 /login → Google 登入 → /account 驗收。"
  ;;

# ───────────────────────────── Facebook ─────────────────────────────
facebook)
  FBID="${2:-}"; FBSECRET="${3:-}"
  if [ -z "$FBID" ]; then read -rp "Facebook App ID: " FBID; fi
  if [ -z "$FBSECRET" ]; then read -rp "Facebook App Secret: " FBSECRET; fi

  [[ "$FBID" =~ ^[0-9]{10,20}$ ]] || { echo "❌ App ID 應為純數字：$FBID"; exit 1; }
  [[ "$FBSECRET" =~ ^[0-9a-f]{32}$ ]] \
    || echo "⚠️ App Secret 不是 32 碼 hex（照樣繼續驗證，錯了會被 Graph API 擋）"

  echo "== 1/3 對 Graph API 驗證憑證（client_credentials，零副作用）=="
  TOKEN_RESULT=$(curl -s --max-time 15 "https://graph.facebook.com/oauth/access_token?client_id=$FBID&client_secret=$FBSECRET&grant_type=client_credentials" || true)
  echo "   Graph API 回應：$(echo "$TOKEN_RESULT" | head -c 200)"
  if echo "$TOKEN_RESULT" | grep -q '"access_token"'; then
    echo "   ✅ 憑證有效（成功換到 app access token）"
  else
    echo "   ❌ 換不到 app access token —— App ID/Secret 抄錯，.env 未變動"; exit 1
  fi

  echo "== 2/3 寫入 $ENV_FILE =="
  backup_env
  sed -i '/^AUTH_FACEBOOK_ID=/d;/^AUTH_FACEBOOK_SECRET=/d' "$ENV_FILE"
  { echo "AUTH_FACEBOOK_ID=$FBID"; echo "AUTH_FACEBOOK_SECRET=$FBSECRET"; } >> "$ENV_FILE"
  echo "   已寫入 2 行（舊 .env 已備份）"

  restart_and_verify facebook
  echo "   提醒：App 要切成【上線模式】一般用戶才登入得了（開發模式只有 app 角色能用），"
  echo "   後台「網站全域設定 → 社群登入」確認 Facebook 開關是開的（預設開），"
  echo "   然後真瀏覽器走一次 /login → Facebook 登入 → /account 驗收。"
  ;;

# ───────────────────────────── Apple ─────────────────────────────
apple)
  SID="${2:-}"; TEAM="${3:-}"; KID="${4:-}"; P8="${5:-}"
  if [ -z "$SID" ]; then read -rp "Services ID（如 com.chickimmiu.web）: " SID; fi
  if [ -z "$TEAM" ]; then read -rp "Team ID（10 碼）: " TEAM; fi
  if [ -z "$KID" ]; then read -rp "Key ID（10 碼）: " KID; fi
  if [ -z "$P8" ]; then read -rp ".p8 私鑰檔路徑: " P8; fi

  [[ "$SID" =~ ^[a-zA-Z0-9.-]+$ ]] || { echo "❌ Services ID 格式不對：$SID"; exit 1; }
  [ -f "$P8" ] || { echo "❌ 找不到 .p8 檔：$P8"; exit 1; }

  echo "== 1/4 簽 client secret（ES256 JWT，效期 170 天）=="
  SECRET=$(node "$GEN" --key "$P8" --team-id "$TEAM" --client-id "$SID" --key-id "$KID" 2>/dev/null) \
    || { echo "❌ 簽 JWT 失敗，請檢查 .p8/Team ID/Key ID"; exit 1; }
  echo "   ✅ JWT 簽出（$(echo "$SECRET" | head -c 40)...）"

  echo "== 2/4 對 Apple token endpoint 驗證憑證（零副作用）=="
  check_token_endpoint 'https://appleid.apple.com/auth/token' "$SID" "$SECRET"
  echo "   Apple 回應：$(echo "$TOKEN_RESULT" | head -c 200)"
  if echo "$TOKEN_RESULT" | grep -q 'invalid_client'; then
    echo "   ❌ invalid_client —— Services ID/Team ID/Key ID/.p8 對不上，.env 未變動"; exit 1
  elif echo "$TOKEN_RESULT" | grep -q 'invalid_grant\|invalid_request'; then
    echo "   ✅ 憑證有效（client 驗證通過，假 code 被拒是預期結果）"
  else
    echo "   ⚠️ 非預期回應——保守起見中止，.env 未變動"; exit 1
  fi

  echo "== 3/4 收私鑰 + 寫入 $ENV_FILE =="
  mkdir -p "$SECRETS_DIR" && chmod 700 "$SECRETS_DIR"
  DEST="$SECRETS_DIR/AuthKey_$KID.p8"
  cp "$P8" "$DEST" && chmod 600 "$DEST"
  backup_env
  sed -i '/^AUTH_APPLE_ID=/d;/^AUTH_APPLE_SECRET=/d;/^APPLE_TEAM_ID=/d;/^APPLE_KEY_ID=/d;/^APPLE_P8_PATH=/d' "$ENV_FILE"
  {
    echo "AUTH_APPLE_ID=$SID"
    echo "AUTH_APPLE_SECRET=$SECRET"
    # 下面三行給 apple-renew cron 重簽用，app 本身不讀
    echo "APPLE_TEAM_ID=$TEAM"
    echo "APPLE_KEY_ID=$KID"
    echo "APPLE_P8_PATH=$DEST"
  } >> "$ENV_FILE"
  echo "   已寫入 5 行；私鑰收在 $DEST（600）"

  echo "== 4/4 裝自動續簽 cron（secret 180 天會過期）=="
  SELF=/var/www/chickimmiu/scripts/setup-social-oauth-prod.sh
  ( crontab -l 2>/dev/null | grep -v '\[ckmu-apple-secret\]' ;
    echo "20 5 1 * * $SELF apple-renew >> /var/log/ckmu-apple-secret.log 2>&1 # [ckmu-apple-secret]" ) | crontab -
  echo "   每月 1 號 05:20 重簽（170 天效期 + 月簽 = 永不過期）"

  restart_and_verify apple
  echo "   下一步：後台「網站全域設定 → 社群登入」把 Apple 開關打開（預設是關的！），"
  echo "   然後真瀏覽器走一次 /login → Apple 登入 → /account 驗收。"
  ;;

# ─────────────────────── Apple secret 續簽（cron） ───────────────────────
apple-renew)
  SID=$(grep -m1 '^AUTH_APPLE_ID=' "$ENV_FILE" | cut -d= -f2-)
  TEAM=$(grep -m1 '^APPLE_TEAM_ID=' "$ENV_FILE" | cut -d= -f2-)
  KID=$(grep -m1 '^APPLE_KEY_ID=' "$ENV_FILE" | cut -d= -f2-)
  P8=$(grep -m1 '^APPLE_P8_PATH=' "$ENV_FILE" | cut -d= -f2-)
  if [ -z "$SID" ] || [ -z "$TEAM" ] || [ -z "$KID" ] || [ ! -f "$P8" ]; then
    echo "❌ .env 缺 APPLE_* 續簽資訊或 .p8 不在（先跑一次 apple 模式完整設定）"; exit 1
  fi
  echo "[$(date -Iseconds)] 重簽 Apple client secret…"
  node "$GEN" --key "$P8" --team-id "$TEAM" --client-id "$SID" --key-id "$KID" --write-env "$ENV_FILE"
  restart_and_verify apple
  ;;

*)
  echo "用法："
  echo "  $0 google <CLIENT_ID> <CLIENT_SECRET>"
  echo "  $0 apple  <SERVICES_ID> <TEAM_ID> <KEY_ID> <P8檔路徑>"
  echo "  $0 apple-renew   # cron 重簽（apple 模式會自動安裝）"
  exit 1
  ;;
esac
