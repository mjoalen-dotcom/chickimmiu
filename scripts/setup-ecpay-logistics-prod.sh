#!/usr/bin/env bash
# 綠界「物流模組」正式憑證一鍵設定 + 自我驗證（prod 專用）
# ────────────────────────────────────────────────────────
# 用法（在 prod 主機上，或本機透過 ssh）：
#   /var/www/chickimmiu/scripts/setup-ecpay-logistics-prod.sh <物流MerchantID> <HashKey> <HashIV>
#   （不帶參數會互動式詢問）
#
# 三個值從綠界廠商後台抄：物流管理相關頁或「系統開發管理 → 系統介接設定」
# 的物流介接資訊（物流模組憑證與金流是不同組——2026-07-29 已實測：
# 金流 3018203 的 HashKey/IV 打物流 API 回「CheckMacValue驗證錯誤」）。
#
# 流程：
#   1. 先拿輸入的憑證打綠界【正式站】查詢 API（查一筆不存在的單，無副作用）：
#      回「找不到訂單」= 憑證有效；回「CheckMacValue驗證錯誤」= 值抄錯，直接中止，
#      .env 一個字都不會動。
#   2. 備份 .env → 移除舊 ECPAY_LOGISTICS_* → 寫入新值 + ECPAY_LOGISTICS_ENV=production
#   3. pm2 restart → 等 app 起來 → 打自家 /api/logistics/ecpay/map 驗證
#      action=logistics.ecpay.com.tw、MerchantID=你的、sandbox=false
set -euo pipefail

ENV_FILE=/var/www/chickimmiu/.env
APP=chickimmiu-nextjs

MID="${1:-}"; KEY="${2:-}"; IV="${3:-}"
if [ -z "$MID" ]; then read -rp "物流 MerchantID: " MID; fi
if [ -z "$KEY" ]; then read -rp "物流 HashKey: " KEY; fi
if [ -z "$IV" ];  then read -rp "物流 HashIV: " IV; fi

[[ "$MID" =~ ^[0-9]{6,10}$ ]] || { echo "❌ MerchantID 格式不對（應為 6~10 碼數字）：$MID"; exit 1; }
[[ "$KEY" =~ ^[A-Za-z0-9]{8,}$ ]] || { echo "❌ HashKey 格式不對（英數 8 碼以上）"; exit 1; }
[[ "$IV"  =~ ^[A-Za-z0-9]{8,}$ ]] || { echo "❌ HashIV 格式不對（英數 8 碼以上）"; exit 1; }

echo "== 1/3 對綠界正式站驗證憑證（無副作用查詢）=="
VERIFY_OUT=$(MID="$MID" KEY="$KEY" IV="$IV" node - <<'EOF'
const crypto = require('crypto')
const { MID, KEY, IV } = process.env
const enc = (s) => encodeURIComponent(s)
  .replace(/%2D/gi,'-').replace(/%5F/gi,'_').replace(/%2E/gi,'.')
  .replace(/%21/gi,'!').replace(/%2A/gi,'*').replace(/%28/gi,'(')
  .replace(/%29/gi,')').replace(/%20/gi,'+').toLowerCase()
const p = { MerchantID: MID, AllPayLogisticsID: '999999999', TimeStamp: String(Math.floor(Date.now()/1000)) }
const raw = `HashKey=${KEY}&` + Object.keys(p).sort((a,b)=>a.toLowerCase().localeCompare(b.toLowerCase())).map(k=>`${k}=${p[k]}`).join('&') + `&HashIV=${IV}`
p.CheckMacValue = crypto.createHash('md5').update(enc(raw),'utf8').digest('hex').toUpperCase()
fetch('https://logistics.ecpay.com.tw/Helper/QueryLogisticsTradeInfo/V5', {
  method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
  body: new URLSearchParams(p).toString(),
}).then(r=>r.text()).then(t=>console.log(t.trim().slice(0,200)))
EOF
)
echo "   綠界回應：$VERIFY_OUT"
case "$VERIFY_OUT" in
  *找不到訂單*|*查無*)
    echo "   ✅ 憑證有效（驗章通過，查無此單是預期結果）" ;;
  *CheckMacValue*)
    echo "   ❌ CheckMacValue 驗證錯誤 —— HashKey/HashIV 抄錯或不是物流那組，.env 未變動"; exit 1 ;;
  *)
    echo "   ⚠️ 非預期回應——保守起見中止，.env 未變動。回應全文：$VERIFY_OUT"; exit 1 ;;
esac

echo "== 2/3 寫入 $ENV_FILE =="
cp "$ENV_FILE" "$ENV_FILE.bak-logistics-$(date +%Y%m%d-%H%M%S)"
sed -i '/^ECPAY_LOGISTICS_/d' "$ENV_FILE"
{
  echo "ECPAY_LOGISTICS_MERCHANT_ID=$MID"
  echo "ECPAY_LOGISTICS_HASH_KEY=$KEY"
  echo "ECPAY_LOGISTICS_HASH_IV=$IV"
  echo "ECPAY_LOGISTICS_ENV=production"
} >> "$ENV_FILE"
echo "   已寫入 4 行（舊 .env 已備份）"

echo "== 3/3 重啟 + 自家端點驗證 =="
pm2 restart "$APP" --update-env >/dev/null
for i in $(seq 1 30); do
  sleep 3
  CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:3000/ || true)
  [ "$CODE" = "200" ] && break
done
[ "${CODE:-}" = "200" ] || { echo "❌ app 3000 沒回 200（最後=$CODE），請查 pm2 logs $APP"; exit 1; }

MAP=$(curl -s --max-time 15 -X POST http://localhost:3000/api/logistics/ecpay/map \
  -H 'Content-Type: application/json' -d '{"carrier":"family"}')
echo "   map 回應：$(echo "$MAP" | head -c 220)"
if echo "$MAP" | grep -q 'https://logistics.ecpay.com.tw/Express/map' \
   && echo "$MAP" | grep -q "\"MerchantID\":\"$MID\"" \
   && echo "$MAP" | grep -q '"sandbox":false'; then
  echo ""
  echo "🎉 物流正式憑證生效：地圖走正式站、MerchantID=$MID、sandbox=false"
  echo "   下一步：後台訂單設定填「超商託運寄件人」真手機 +「宅配託運寄件人」四欄，"
  echo "   然後對真實超商訂單跑「超商發號」即完成端到端驗證。"
else
  echo "❌ map 端點驗證未過（上面回應不含正式站/MerchantID/sandbox:false），請回報"
  exit 1
fi
