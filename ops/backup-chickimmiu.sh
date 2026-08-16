#!/usr/bin/env bash
# /root/backup-chickimmiu.sh
# CHIC KIM & MIU prod daily backup
# - DB: PostgreSQL pg_dump（custom format）+ gzip，本機 7 天保留，R2 14 天保留
#   （2026-08-16 DB-PG-001 步驟14切換到 PostgreSQL 之後，SQLite 已不再是
#   即時資料來源，改備 PG。舊 SQLite 檔已改名 .frozen-YYYYMMDD 唯讀封存，
#   本腳本不再對它做例行備份——它不會再變動，備份一次凍結快照即可，
#   已存在 data/chickimmiu.db.pre-pg-cutover-20260816）
# - Media: incremental object copy to R2; overwritten versions kept for 30 days
# - Legacy full-media tarballs remain on R2 for their original 14 day retention
# Cron: 0 19 * * * /root/backup-chickimmiu.sh >> /var/log/chickimmiu-backup.log 2>&1
#
# 2026-07-27 retention redesign:
# - local retention 30d -> 7d (server slim-down; R2 is the long-term copy)
# - `rclone sync` -> `rclone copy` for DB backups: sync mirrors deletions, so a
#   short local retention would silently shorten R2 history too. copy never
#   deletes; R2 gets its own independent 30d prune below.
#
# 2026-08-16 DB-PG-001 步驟15：DB 備份改 PostgreSQL pg_dump（原 SQLite
# `.backup` 段落移除——SQLite 已凍結不再變動，不需要每夜重複備份同一份
# 靜態檔案）。PG 用 `ckmu_app`（app 專用帳號，非遷移工具用的 postgres
# superuser——備份不需要 superuser 權限，pg_dump 對自己擁有的表就夠）。
# 保留天數依 Prompt P3 規定：本機 7 天、R2 14 天（比 SQLite 時期的 R2 30
# 天短，PG 官方 workorder 明文只要 14 天）。

set -euo pipefail

# ─── Config ───
PG_DUMP_URI="${PG_DUMP_URI:-postgres://ckmu_app:wcwdEwf6Ub2oRidNxvJXYzRapfEltV@127.0.0.1:5432/ckmu}"
MEDIA_DIR="/var/www/chickimmiu/public/media"
BACKUP_DIR="/var/backups/chickimmiu"
DB_LOCAL_RETENTION_DAYS=7
DB_R2_RETENTION_DAYS=14
MEDIA_R2_RETENTION_DAYS=14
MEDIA_HISTORY_RETENTION_DAYS=30
R2_REMOTE="r2:chickimmiu-backups"
R2_MEDIA_CURRENT="$R2_REMOTE/media-current"
R2_MEDIA_HISTORY="$R2_REMOTE/media-history"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
LOG_PREFIX="[$(date -Iseconds)]"
LOCK_FILE="/run/lock/chickimmiu-backup.lock"

# Avoid overlapping a manual run with cron, or two slow backup runs with each
# other. The lock is released automatically when the script exits.
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "$LOG_PREFIX Another backup run holds $LOCK_FILE; exiting without changes."
  exit 0
fi

mkdir -p "$BACKUP_DIR"

# ─── 1. PostgreSQL backup (local + R2) ───
# custom format（-F c）：比純文字 SQL dump 更小、還原更彈性（可選擇性
# 還原單一表、支援 pg_restore --jobs 平行還原），gzip 再壓一層。
DB_BACKUP="$BACKUP_DIR/chickimmiu-pg-$TIMESTAMP.dump"
echo "$LOG_PREFIX Backing up PostgreSQL → $DB_BACKUP"
if pg_dump "$PG_DUMP_URI" -F c -f "$DB_BACKUP" 2>&1 | sed "s|^|$LOG_PREFIX   |"; then
  gzip "$DB_BACKUP"
  echo "$LOG_PREFIX   size: $(du -h "$DB_BACKUP.gz" | cut -f1)"
else
  echo "$LOG_PREFIX ERROR: pg_dump failed" >&2
  exit 1
fi

# ─── 2. Media: incremental copy to R2 ───
# `copy` never removes a destination object. Existing files are compared before
# upload, so unchanged media is not retransmitted. If a path is overwritten,
# `--backup-dir` first preserves the previous R2 object in a dated directory.
if [ -d "$MEDIA_DIR" ] && command -v rclone >/dev/null 2>&1; then
  echo "$LOG_PREFIX Incremental media copy → $R2_MEDIA_CURRENT/"
  rclone copy "$MEDIA_DIR/" "$R2_MEDIA_CURRENT/" \
    --backup-dir "$R2_MEDIA_HISTORY/$TIMESTAMP/" \
    --fast-list --checkers 64 --transfers 32 \
    --stats 30s --stats-one-line --stats-log-level NOTICE \
    --log-level NOTICE 2>&1 | sed "s|^|$LOG_PREFIX   |"
  echo "$LOG_PREFIX   incremental media copy done"
elif [ -d "$MEDIA_DIR" ]; then
  echo "$LOG_PREFIX WARN: rclone not installed — media NOT backed up"
fi

# ─── 3. Copy DB backups to R2 (copy = never deletes remote) ───
if command -v rclone >/dev/null 2>&1; then
  rclone copy "$BACKUP_DIR/" "$R2_REMOTE/" \
    --include "chickimmiu-pg-*.dump.gz" \
    --max-depth 1 \
    --transfers 2 --checksum 2>&1 | sed "s|^|$LOG_PREFIX   |"
fi

# ─── 4. Prune local DB backups (short retention; R2 keeps the history) ───
PRUNED=$(find "$BACKUP_DIR" -name 'chickimmiu-pg-*.dump.gz' -mtime +$DB_LOCAL_RETENTION_DAYS -delete -print 2>/dev/null | wc -l)
echo "$LOG_PREFIX Pruned $PRUNED local DB backups older than $DB_LOCAL_RETENTION_DAYS days"

# ─── 5. Prune old DB backups on R2 (independent retention) ───
if command -v rclone >/dev/null 2>&1; then
  rclone delete "$R2_REMOTE/" \
    --include "chickimmiu-pg-*.dump.gz" \
    --max-depth 1 \
    --min-age "${DB_R2_RETENTION_DAYS}d" 2>&1 | sed "s|^|$LOG_PREFIX   |"
  echo "$LOG_PREFIX Pruned R2 DB backups older than $DB_R2_RETENTION_DAYS days"
fi

# ─── 6. Prune old media tarballs on R2 ───
# These are the legacy full snapshots created before the incremental migration.
if command -v rclone >/dev/null 2>&1; then
  rclone delete "$R2_REMOTE/" \
    --include "media-*.tar.gz" \
    --max-depth 1 \
    --min-age "${MEDIA_R2_RETENTION_DAYS}d" 2>&1 | sed "s|^|$LOG_PREFIX   |"
  echo "$LOG_PREFIX Pruned R2 media tarballs older than $MEDIA_R2_RETENTION_DAYS days"
fi

# ─── 7. Prune overwritten media versions on R2 ───
if command -v rclone >/dev/null 2>&1; then
  rclone delete "$R2_MEDIA_HISTORY/" \
    --min-age "${MEDIA_HISTORY_RETENTION_DAYS}d" 2>&1 | sed "s|^|$LOG_PREFIX   |"
  echo "$LOG_PREFIX Pruned R2 media history older than $MEDIA_HISTORY_RETENTION_DAYS days"
fi

echo "$LOG_PREFIX Backup complete."
