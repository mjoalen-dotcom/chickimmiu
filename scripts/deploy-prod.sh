#!/usr/bin/env bash
# Atomic-ish prod deploy for pre.chickimmiu.com.
#
# Problem it solves:
#   The ad-hoc command `cd /var/www/chickimmiu && rm -rf .next && pnpm build
#   && pm2 restart chickimmiu-nextjs` has a 1–2 minute window where the entire
#   `.next/` tree is gone — every CSS/JS/font request returns 404 and HTML
#   SSR crashes because `.next/server/app/(frontend)/**/page.js` doesn't
#   exist. Users mid-session see a broken site; Fix-1 chunk-recover can't
#   heal it because HTML itself 404s.
#
# What this script does differently:
#   1. NEVER `rm -rf .next`. Next.js writes content-hashed chunk files,
#      so new builds coexist with old ones in `.next/static/chunks/` —
#      old chunks linger harmlessly until monthly pruning cron.
#   2. Runs `pnpm payload migrate` BEFORE `pm2 restart` so the schema is
#      always ready when new code boots. Migrations are idempotent.
#   3. Post-restart health check on /, /products, /account, /cart. Any
#      non-200 aborts the script loudly so operator sees the failure.
#
# Remaining (small) windows this does NOT eliminate:
#   - pm2 restart itself is a ~1–2s blip (fork mode). For true zero-downtime
#     switch to cluster mode and use `pm2 reload`.
#   - During `pnpm build` manifests are overwritten in place; a chunk
#     request landing exactly on a half-written manifest can still fail.
#     Fix-1 chunk-recover handles these millisecond-scale races.
#
# Usage:
#   ssh root@5.223.85.14 /root/deploy-ckmu.sh
#   # or, without --frozen-lockfile (when lockfile genuinely changed):
#   ssh root@5.223.85.14 /root/deploy-ckmu.sh --update-lockfile
#
# Exit codes: 0 ok, 1 health check failed, 2 build failed, 3 migrate failed.

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/chickimmiu}"
PM2_APP="${PM2_APP:-chickimmiu-nextjs}"
HEALTH_HOST="${HEALTH_HOST:-https://pre.chickimmiu.com}"
HEALTH_PATHS=("/" "/products" "/account" "/cart")

INSTALL_FLAG="--frozen-lockfile"
if [[ "${1:-}" == "--update-lockfile" ]]; then
  INSTALL_FLAG=""
fi

log() { printf "[%(%H:%M:%S)T] %s\n" -1 "$*"; }
fail() { log "FAIL: $*"; exit "${2:-1}"; }

cd "$APP_DIR"

log "== deploy start =="
BEFORE_SHA=$(git rev-parse HEAD)
log "BEFORE HEAD: $BEFORE_SHA"

# 1. Pull latest main
log "step 1/6: git fetch + reset --hard origin/main"
git fetch origin --prune
git reset --hard origin/main
AFTER_SHA=$(git rev-parse HEAD)

if [[ "$BEFORE_SHA" == "$AFTER_SHA" ]]; then
  log "HEAD unchanged — proceeding with install+migrate+build+restart anyway"
else
  log "AFTER HEAD:  $AFTER_SHA"
  log "Commits:"
  git log --oneline "$BEFORE_SHA..$AFTER_SHA" | sed 's/^/  /'
fi

# 2. Install deps
log "step 2/6: pnpm install $INSTALL_FLAG"
# shellcheck disable=SC2086
pnpm install $INSTALL_FLAG

# 3. Run pending migrations — idempotent. Must happen BEFORE pm2 restart
#    so new code boots against a schema it expects.
log "step 3/6: pnpm payload migrate"
pnpm payload migrate || fail "payload migrate failed" 3

# 4. Build — NO `rm -rf .next`. Content-hashed chunks coexist.
log "step 4/6: pnpm build (no rm -rf, old chunks preserved)"
pnpm build || fail "pnpm build failed" 2

# 5. Restart pm2
log "step 5/6: pm2 restart $PM2_APP"
pm2 restart "$PM2_APP" --update-env
# give Node + Next + Payload time to accept traffic
sleep 4

# 6. Health check — any non-200 on the critical paths aborts
log "step 6/6: health check"
for URL in "${HEALTH_PATHS[@]}"; do
  code=""
  for attempt in 1 2 3; do
    code=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_HOST$URL" || echo "000")
    if [[ "$code" == "200" ]]; then
      log "  ok  $URL -> $code"
      break
    fi
    log "  retry $attempt/3 $URL -> $code"
    sleep 2
  done
  [[ "$code" == "200" ]] || fail "$URL returned $code after 3 attempts (HEAD is $AFTER_SHA, rollback manually if needed)"
done

# Stamp for observability / potential rollback
echo "$AFTER_SHA $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> /var/log/ckmu-deploys.log 2>/dev/null || true

log "== deploy OK: $AFTER_SHA =="
