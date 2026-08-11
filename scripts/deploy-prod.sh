#!/usr/bin/env bash
# Atomic-ish prod deploy for pre.chickimmiu.com.
#
# Canonical source: this file (scripts/deploy-prod.sh in the chickimmiu repo).
# On the prod host (5.223.85.14) `/root/deploy-ckmu.sh` is a symlink to
# `/var/www/chickimmiu/scripts/deploy-prod.sh`, so every `git pull` updates
# the deploy script in lockstep with the code it deploys. To change the
# deploy logic: edit this file, open a PR, merge — next deploy runs the
# new version (the in-flight bash process keeps the old content because the
# git reset happens AFTER bash has already opened+read this file).
#
# If the symlink is missing on a fresh box / disaster recovery:
#   ln -sf /var/www/chickimmiu/scripts/deploy-prod.sh /root/deploy-ckmu.sh
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
# Exit codes: 0 ok, 1 health check failed, 2 build failed, 3 migrate failed,
#             4 generate:importmap failed, 5 nginx snippet apply failed,
#             6 another deploy already holds the lock.

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

# Single-writer lock. Two concurrent deploys used to interleave
# install/migrate/build on the same tree; the 2026-08-03 incident left a
# `payload migrate` wedged in ep_poll for 37 hours. Non-blocking on purpose:
# a second deploy should fail loudly, not queue up behind a 6-minute build.
exec 9>/var/lock/deploy-ckmu.lock
flock -n 9 || fail "another deploy is already running (/var/lock/deploy-ckmu.lock held)" 6

# Orphaned `payload/bin.js` reaper.
#
# ROOT CAUSE (traced 2026-08-11): payload/dist/index.js "Generate types on
# startup" fires `void this.bin({args:['generate:types'], log:false})` on every
# Payload init when NODE_ENV !== 'production'. It is fire-and-forget with stdio
# on /dev/null, so it detaches to PPID 1. Combined with the keep-alive interval
# our pnpm patch adds to bin.js (which only clears when start() settles), that
# child never exits — it parks in ep_poll forever and never writes
# payload-types.ts. One orphan leaked per CLI invocation; 4 had accumulated by
# 2026-08-11, the oldest 5 days old.
#
# The real fix is PAYLOAD_CLI_ENV below (NODE_ENV=production suppresses the
# spawn entirely — verified: 0 orphans after migrate). This reaper only cleans
# up strays from older deploys or from anyone running the CLI by hand.
# Matching on the full bin.js path, never `pkill -f payload`, which would
# match this script's own command line.
reap_payload_orphans() {
  local pids
  pids=$(ps -eo pid,ppid,cmd --no-headers \
    | awk '$2 == 1 && $0 ~ /node_modules\/payload\/bin\.js/ {print $1}' || true)
  if [[ -n "$pids" ]]; then
    log "  reaping orphaned payload/bin.js pids: $(echo "$pids" | tr '\n' ' ')"
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
  fi
}

# Every payload CLI call goes through this. NODE_ENV=production is the
# root-cause fix for the orphan leak above; it also skips the interactive
# "you ran in dev mode, data loss will occur" prompt entirely.
PAYLOAD_CLI_ENV=(env NODE_ENV=production)

reap_payload_orphans

log "== deploy start =="
BEFORE_SHA=$(git rev-parse HEAD)
log "BEFORE HEAD: $BEFORE_SHA"

# 0. Sync nginx upload-limit snippet so admin imports don't 413.
#    nginx default client_max_body_size 1M退 admin /api/users/import (Shopline
#    全會員匯入動輒 5-15MB)。Snippet 是冪等的：內容相同則不動 + 不 reload。
#    放在 step 1 (git pull) 前執行，避免 git reset 把 ops/nginx/ 改掉後又 reload
#    舊 snippet。
NGINX_SRC="$APP_DIR/ops/nginx/ckmu-uploads.conf"
NGINX_DEST="/etc/nginx/conf.d/ckmu-uploads.conf"
if [[ -f "$NGINX_SRC" ]]; then
  if [[ ! -f "$NGINX_DEST" ]] || ! cmp -s "$NGINX_SRC" "$NGINX_DEST"; then
    log "step 0/7: install nginx snippet $NGINX_DEST"
    cp "$NGINX_SRC" "$NGINX_DEST"
    if nginx -t > /dev/null 2>&1; then
      systemctl reload nginx
      log "  nginx reloaded"
    else
      fail "nginx -t failed after installing $NGINX_DEST" 5
    fi
  fi
fi

# 1. Pull latest main
#
# SKIP_GIT_RESET=1 mode (2026-05-11 GitHub outage workaround):
# When GitHub access is unavailable (org suspended / token revoked / outage),
# `git fetch origin` 401s and this step would either fail or wipe in-flight
# scp'd changes. Set SKIP_GIT_RESET=1 to use the current working tree as
# source — typically used together with scripts/scp-deploy.sh which pre-scps
# changed files. Restore default behavior (delete this env override usage)
# once GitHub access returns and outstanding PRs are merged.
log "step 1/7: git fetch + reset --hard origin/main"
if [[ "${SKIP_GIT_RESET:-0}" == "1" ]]; then
  log "  SKIP_GIT_RESET=1 — using current working tree as source (GitHub-outage mode)"
else
  git fetch origin --prune
  git reset --hard origin/main
fi
AFTER_SHA=$(git rev-parse HEAD)

if [[ "$BEFORE_SHA" == "$AFTER_SHA" ]]; then
  log "HEAD unchanged — proceeding with install+migrate+build+restart anyway"
else
  log "AFTER HEAD:  $AFTER_SHA"
  log "Commits:"
  git log --oneline "$BEFORE_SHA..$AFTER_SHA" | sed 's/^/  /'
fi

# 2. Install deps
log "step 2/7: pnpm install $INSTALL_FLAG"
# shellcheck disable=SC2086
pnpm install $INSTALL_FLAG

# 3. Run pending migrations — idempotent. Must happen BEFORE pm2 restart
#    so new code boots against a schema it expects.
#
#    Two known SILENT failure modes — both exit 0 with nothing applied, so
#    exit code alone is never trusted here:
#
#    a) 2026-04-21 (PR #79): in non-TTY ssh, Payload's "dev-mode dirty
#       schema, proceed? (y/N)" prompt takes the default No and the CLI
#       process.exit(0)s. `yes y |` auto-accepts the prompt.
#    b) 2026-07-28 (2f04c49): Payload's bin.js runs the whole CLI as an
#       un-awaited floating promise (`void start()`), and tsx compiles the
#       TS config off-thread. During that async startup there are moments
#       when the main thread holds zero live libuv handles; if the event
#       loop drains in such a gap — far more likely on a busy box (deploy
#       install/build, app boot) — node exits 0 before any migrate code
#       runs. Zero output, exit 0, migration skipped. Proven on prod with
#       `--trace-exit` (no exit() ever called) + a beforeExit probe (fired
#       = loop drained). Root-fixed by patches/payload@3.83.0.patch which
#       holds a keep-alive interval in bin.js; the verification below
#       remains as belt-and-braces (a payload upgrade drops the patch, and
#       mode (a) would resurface the same way).
#
#    Strategy: capture output, require the CLI's final "Done." marker, then
#    positively verify against SQLite that every migration file on disk is
#    recorded in payload_migrations. Retry up to 3 times; anything less
#    than verified success fails the deploy loudly.
log "step 3/7: pnpm payload migrate (verified, up to 3 attempts)"

DB_FILE=""
if [[ -f .env ]]; then
  DB_FILE=$(grep -E '^DATABASE_URI=' .env | tail -1 | sed -e 's/^DATABASE_URI=//' -e 's/^"//' -e 's/"$//')
  DB_FILE=${DB_FILE#file:}
fi

# Migration files present on disk but absent from payload_migrations.
# Empty output = schema verifiably up to date. When the DB isn't inspectable
# (non-SQLite URI, sqlite3 missing) we return nothing and rely on the
# "Done." marker alone.
pending_migrations() {
  if ! command -v sqlite3 >/dev/null 2>&1 || [[ -z "$DB_FILE" || ! -f "$DB_FILE" ]]; then
    return 0
  fi
  comm -23 \
    <(find src/migrations -maxdepth 1 -name '*.ts' ! -name 'index.ts' -printf '%f\n' | sed 's/\.ts$//' | sort) \
    <(sqlite3 "$DB_FILE" "SELECT name FROM payload_migrations;" 2>/dev/null | sort)
}

MIGRATE_LOG=$(mktemp)
MIGRATE_VERIFIED=0
for attempt in 1 2 3; do
  # PIPESTATUS[1] is pnpm's own exit; [0] is `yes`, which dies 141/SIGPIPE
  # by design the moment pnpm stops reading stdin. `set +e` lets us capture
  # PIPESTATUS before `-e` trips on the 141.
  set +e
  # `timeout` is the hard stop: before NODE_ENV=production was passed here the
  # CLI could park in ep_poll indefinitely (11 min on 2026-08-11, 37 h on
  # 2026-08-03) with the deploy blocked behind it and no way out but a manual
  # kill. 600s is ~30x a normal run (~1s with no pending migrations).
  yes y | "${PAYLOAD_CLI_ENV[@]}" timeout -s KILL 600 pnpm payload migrate > "$MIGRATE_LOG" 2>&1
  MIGRATE_STATUSES=("${PIPESTATUS[@]}")
  set -e
  sed 's/^/  /' "$MIGRATE_LOG"
  reap_payload_orphans
  if [[ "${MIGRATE_STATUSES[1]:-1}" -eq 137 ]]; then
    # SIGKILL from timeout. The CLI wedged — but wedging says nothing about
    # whether the schema is current, so let the DB answer instead of failing
    # blind. Empty pending list = verifiably up to date, carry on.
    if [[ -z "$(pending_migrations)" ]]; then
      log "  attempt $attempt/3: CLI wedged and was killed at 600s, but payload_migrations shows nothing pending — treating as up to date"
      MIGRATE_VERIFIED=1
      break
    fi
    log "  attempt $attempt/3: CLI wedged and was killed at 600s, migrations still pending — retrying"
    continue
  fi
  if [[ "${MIGRATE_STATUSES[1]:-1}" -ne 0 ]]; then
    # Real migration failure (SQL error etc.) — retrying won't help.
    fail "payload migrate failed (pnpm exit ${MIGRATE_STATUSES[1]:-?})" 3
  fi
  if ! grep -q 'Done\.' "$MIGRATE_LOG"; then
    log "  attempt $attempt/3: exit 0 but CLI never reached 'Done.' (silent early exit) — retrying"
    continue
  fi
  PENDING=$(pending_migrations)
  if [[ -n "$PENDING" ]]; then
    log "  attempt $attempt/3: migrate said Done but still unrecorded in payload_migrations: $(echo "$PENDING" | tr '\n' ' ')"
    continue
  fi
  MIGRATE_VERIFIED=1
  break
done
rm -f "$MIGRATE_LOG"
[[ "$MIGRATE_VERIFIED" -eq 1 ]] || fail "payload migrate did not verifiably apply after 3 attempts" 3

# 3b. Regenerate Payload admin importMap.js — MUST happen BEFORE build so
#     `next build` picks up the fresh map. Source-of-truth is the live
#     state of every collection's `admin.components.*` paths; if a PR
#     adds an admin component but its author forgot to commit a regenerated
#     importMap.js, the component source ships to prod but Payload's admin
#     runtime can't resolve it (silently renders nothing). Audit on
#     2026-04-27 caught 3 dropped components: PageTemplatePicker (#134),
#     OrderBulkShipPanel (#128), OrderExportButton (#125). Running
#     `pnpm payload generate:importmap` here makes that class of bug
#     impossible — the script always writes the canonical importMap from
#     the current source tree, regardless of what main has committed.
#     Cheap (~3-5s); safe to re-run; produces no diff if nothing changed.
log "step 3b/7: pnpm payload generate:importmap"
# Same CLI, same wedge (observed live 2026-08-11 16:27: bin.js burned its usual
# 7s of CPU doing the work, then parked in ep_poll and never exited or flushed
# output). Normal run is ~6s, so 300s is generous; two attempts because the
# wedge is intermittent, not deterministic.
IMPORTMAP_FILE='src/app/(payload)/admin/importMap.js'
IMPORTMAP_BEFORE=$(sha256sum "$IMPORTMAP_FILE" 2>/dev/null | awk '{print $1}' || echo "missing")
IMPORTMAP_OK=0
for attempt in 1 2; do
  set +e
  "${PAYLOAD_CLI_ENV[@]}" timeout -s KILL 300 pnpm payload generate:importmap
  IMPORTMAP_RC=$?
  set -e
  reap_payload_orphans
  if [[ "$IMPORTMAP_RC" -eq 0 ]]; then
    IMPORTMAP_OK=1
    break
  fi
  if [[ "$IMPORTMAP_RC" -ne 137 ]]; then
    # A genuine error (bad config, syntax error) — retrying won't help.
    fail "generate:importmap failed (exit $IMPORTMAP_RC)" 4
  fi
  log "  attempt $attempt/2: CLI wedged and was killed at 300s"
done

if [[ "$IMPORTMAP_OK" -eq 0 ]]; then
  IMPORTMAP_AFTER=$(sha256sum "$IMPORTMAP_FILE" 2>/dev/null | awk '{print $1}' || echo "missing")
  if [[ "$IMPORTMAP_BEFORE" == "$IMPORTMAP_AFTER" ]] && git diff --quiet -- "$IMPORTMAP_FILE"; then
    # The wedge left the file untouched and it still matches the commit, so we
    # ship the committed importMap. This step is a safety net, not the source
    # of truth — importMap.js is supposed to be committed with the PR that adds
    # an admin component. Aborting the whole deploy over a wedged safety net is
    # worse than shipping the committed map.
    log "  WARN: importmap 兩次都卡死，但 importMap.js 未被改動且與 commit 一致 → 以 repo 版本繼續"
    log "  WARN: 若本次有新增 admin component 而作者忘了 commit importMap.js，後台該元件會靜默不顯示，請人工確認"
  else
    fail "generate:importmap wedged and left importMap.js modified/inconsistent — 需人工檢查" 4
  fi
fi

# 4. Build — NO `rm -rf .next` (live chunks). But .next/cache (webpack
#    incremental) is build-only and CAN be cleared safely. Stale chunk-ID
#    table in .next/cache caused Cannot find module ./chunks/NNNN.js on
#    2026-04-27 (after 6 PRs accumulated without deploy). Clearing only
#    cache costs ~10-20s build time and leaves runtime chunks intact.
log "step 4/7: pnpm build (clearing .next/cache, runtime .next/server intact)"
rm -rf .next/cache
pnpm build || fail "pnpm build failed" 2

# 5. Restart pm2
log "step 5/7: pm2 restart $PM2_APP"
pm2 restart "$PM2_APP" --update-env
# give Node + Next + Payload time to accept traffic
sleep 4

# 5b. Orphan next-server guard. pm2 treekill occasionally fails to propagate
#     SIGTERM to next-server before pm2 spawns a replacement, leaving two
#     next-server processes coexisting (~1.6GB RSS each) until OOM-kill
#     takes the box down (2026-04-21 incident: 108× pm2 crash loop).
#     The newest PID is pm2's live child; anything older is orphan.
#     Pattern `^next-server \(` anchors to Next.js's own process title
#     ("next-server (v15.5.15)") so this script's own bash doesn't match
#     itself — plain `pgrep -f next-server` would self-match and kill
#     the live process.
ORPHANS=$(pgrep -f '^next-server \(' | head -n -1 || true)
if [[ -n "$ORPHANS" ]]; then
  log "  killing orphan next-server pids: $ORPHANS"
  # shellcheck disable=SC2086
  kill -9 $ORPHANS || true
fi

# 6. Health check — any non-200 on the critical paths aborts
log "step 6/7: health check"
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
