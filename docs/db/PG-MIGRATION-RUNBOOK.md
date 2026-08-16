# PG-MIGRATION-RUNBOOK.md｜SQLite → PostgreSQL 16 遷移交接文件

版本 v1.0｜2026-08-16｜DB-PG-001 步驟14+15 定稿｜交接標準：沒參與過這次遷移的工程師照本文件能獨立完成還原/回滾

## 1. 現況總覽

- **pre.chickimmiu.com 自 2026-08-16 04:39 起正式跑在 PostgreSQL 16 上**，不再是 SQLite。
- 資料庫：`ckmu`（Hetzner 同機 PostgreSQL 16.14，`/var/lib/postgresql/16/main`）
- App 執行期連線帳號：`ckmu_app`（最小權限，擁有全部 287 張表的 owner 權限，**不是** superuser）
- 舊 SQLite 檔已凍結唯讀封存：`/var/www/chickimmiu/data/chickimmiu.db.frozen-20260816`（chmod 444）
- 切換當下的額外備份（跟上面內容一致，時間戳更精確）：`data/chickimmiu.db.pre-pg-cutover-20260816`

## 2. 連線資訊位置

| 用途 | 位置 |
|---|---|
| App 正式連線（`ckmu_app`） | `/var/www/chickimmiu/.env` 的 `DATABASE_URI` |
| 一次性遷移/管理工具用（`postgres` superuser） | `.env` 的 `DATABASE_URI_PG_REHEARSAL`（歷史命名，實際上現在是 superuser 連線字串，非「rehearsal」用途——**步驟15收尾後應考慮改名或移除**，見§7待辦） |
| PG 系統設定 | `/etc/postgresql/16/main/postgresql.conf`（tuning 見§4）、`/etc/postgresql/16/main/pg_hba.conf`（存取控制，見§5） |
| 每夜備份腳本 | `/root/backup-chickimmiu.sh`（repo 內對應副本：`ops/backup-chickimmiu.sh`，**改動後記得同步兩邊**，這支腳本沒有自動部署機制） |

**帳號設計原則**：`ckmu_app` 只給 app 用（日常 CRUD，owner 權限但不是 superuser，設不了 `session_replication_role` 這類系統層級參數）；`postgres` superuser 只給人工介入/批次維運工具用，永遠不要把 superuser 連線字串放進 app 的 `DATABASE_URI`。

## 3. 每夜自動備份

- 排程：`crontab -l`（root）→ `0 19 * * * /root/backup-chickimmiu.sh >> /var/log/chickimmiu-backup.log 2>&1`（每天 UTC 19:00）
- 備份內容：`pg_dump`（custom format `-F c`）+ gzip
- 保留：本機 `/var/backups/chickimmiu/` 7 天；R2 bucket `chickimmiu-backups`（`rclone` remote名 `r2`）14 天
- 檔名格式：`chickimmiu-pg-YYYYMMDD-HHMMSS.dump.gz`
- 手動立即跑一次：`/root/backup-chickimmiu.sh`（有 flock 鎖，跟排程並發跑會自動跳過不衝突）
- 同一支腳本也負責 media（`public/media/`）增量同步到 R2，跟 DB 備份無關但共用同一支腳本/排程

## 4. PG 調參現況（4GB 機 / Hetzner CPX22）

```
max_connections = 40      # 預設100，降到40省連線overhead記憶體，留給shared_buffers/work_mem
shared_buffers = 512MB    # 預設128MB
work_mem = 16MB           # 預設4MB
```

改這些設定：編輯 `/etc/postgresql/16/main/postgresql.conf` → `systemctl restart postgresql@16-main`（`max_connections`／`shared_buffers` 改動需要重啟；`work_mem` 理論上可 reload 但這次是隨其他兩項一起重啟套用）。改動前的原始設定備份在 `/etc/postgresql/16/main/postgresql.conf.bak-pre-tuning-20260816`。

⚠️ PG 重啟會讓 app 現有連線斷線重連（Payload/pg pool 通常自動重試，但重啟瞬間可能有極短暫的連線錯誤），跟前台使用者體感無關的維運操作建議選離峰執行。

## 5. 還原演練（Restore Drill）——本文件寫成當下已實測成功一次

**目的**：確認備份檔真的可還原，不是只有「備份腳本跑完沒報錯」這種表面驗證。

```bash
# 1. 建一個乾淨的臨時資料庫
su - postgres -c "psql -c \"CREATE DATABASE ckmu_restore_test OWNER ckmu_app;\""

# 2. 解壓縮任一份備份（本機 /var/backups/chickimmiu/ 或先從 R2 下載）
gunzip -k /var/backups/chickimmiu/chickimmiu-pg-<TIMESTAMP>.dump.gz -c > /tmp/restore-test.dump

# 3. 還原進臨時資料庫（用 postgres superuser，臨時資料庫不影響正式 ckmu）
PGPASSWORD='<postgres role 密碼>' pg_restore -h 127.0.0.1 -U postgres \
  -d ckmu_restore_test /tmp/restore-test.dump

# 4. 抽查：表數、關鍵表筆數、任一筆具體資料內容
psql -h 127.0.0.1 -U postgres -d ckmu_restore_test \
  -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"
psql -h 127.0.0.1 -U postgres -d ckmu_restore_test \
  -c "SELECT COUNT(*) FROM products;"

# 5. 清理
su - postgres -c "psql -c \"DROP DATABASE ckmu_restore_test;\""
rm -f /tmp/restore-test.dump
```

2026-08-16 實測結果：287 張表、products=1395／media=21962／orders=9／users=14，逐筆抽查 id=156 商品名稱正確，與正式庫完全一致。

## 6. 回滾演練（Rollback Drill）——本文件寫成當下已實測成功一次（雙向）

**適用情境**：PG 出現無法排除的問題，需要暫時切回 SQLite 頂著，或單純定期驗證回滾管道還活著。

```bash
# 1. 停 app（避免切換過程中寫入不一致）
pm2 stop chickimmiu-nextjs

# 2. 改 .env 的 DATABASE_URI 指回凍結的 SQLite 檔
#    （手動編輯，或用下面的 python3 one-liner 精準替換，避免 sed 對特殊字元的跳脫問題）
cd /var/www/chickimmiu
python3 -c "
with open('.env') as f: c = f.read()
c = c.replace(
    'DATABASE_URI=postgres://ckmu_app:<PASSWORD>@127.0.0.1:5432/ckmu',
    'DATABASE_URI=file:./data/chickimmiu.db.frozen-20260816'
)
with open('.env','w') as f: f.write(c)
"

# 3. 重啟 app —— 🔥 一定要帶 --update-env，否則不會重讀新的 DATABASE_URI
#    （只憑 HTTP 200 無法證明真的切換成功，尤其兩邊資料長得一樣時；
#     用 pg_stat_activity 有沒有 ckmu_app 連線才是真正的證據）
pm2 restart chickimmiu-nextjs --update-env

# 4. 驗證：網站正常 + PG 端已無 ckmu_app 連線
curl -s -o /dev/null -w '%{http_code}\n' https://pre.chickimmiu.com/
psql -h 127.0.0.1 -U postgres -d ckmu -c \
  "SELECT pid, usename, state FROM pg_stat_activity WHERE usename='ckmu_app';"
# 應該回 0 rows —— 沒有連線代表真的切回 SQLite了

# 5. 切回 PG（如果只是演練，不是真的要回滾）
python3 -c "
with open('.env') as f: c = f.read()
c = c.replace(
    'DATABASE_URI=file:./data/chickimmiu.db.frozen-20260816',
    'DATABASE_URI=postgres://ckmu_app:<PASSWORD>@127.0.0.1:5432/ckmu'
)
with open('.env','w') as f: f.write(c)
"
pm2 restart chickimmiu-nextjs --update-env
# 驗證 pg_stat_activity 又出現 ckmu_app 連線
```

2026-08-16 實測結果：停機窗口共約 49 秒（05:02:08 停 PM2 → 05:02:57 確認切回 PG 成功），雙向切換皆正常，資料完整（products count 對回 1395）。

⚠️ **回滾的資料時間點限制**：`chickimmiu.db.frozen-20260816` 是切換那一刻（2026-08-16 04:35 前後）的快照。真的發生需要回滾的情境時，**任何 2026-08-16 04:35 之後寫進 PG 的資料，回滾到這份 SQLite 快照都不會有**——回滾是「暫時頂著、接受資料倒退到切換那一刻」的最後手段，不是無損的雙向同步。

## 7. 已知遺留事項 / 待辦

- `DATABASE_URI_PG_REHEARSAL` 這個環境變數命名上已經不準確（現在存的是 superuser 連線字串，不是「rehearsal」專用），建議之後整理 `.env` 時考慮改名成更清楚的名字（例如 `DATABASE_URI_PG_ADMIN`）或直接移除，改成需要時再手動指定。
- `chickimmiu.db.frozen-20260816`／`chickimmiu.db.pre-pg-cutover-20260816` 兩份內容幾乎一致（只差幾分鐘的時間點），長期保留有點浪費空間（各約39-40MB，非急迫問題），可以考慮之後只留一份。
- SQLite 遷移相關的一次性腳本（`scripts/migrate-sqlite-to-pg.ts`、`scripts/dump-products-for-diff.ts`）遷移完成後理論上不會再用到，但保留在 repo 裡作為未來如果需要類似遷移操作時的參考範本（含兩個踩過的真bug修法，見下方§8）。

## 8. 這次遷移踩過的坑（給未來類似操作的人參考）

1. **TRUNCATE ... CASCADE 不能跟同迴圈的 INSERT 混用**：多表批次搬資料時，要先把全部表的 TRUNCATE 獨立一輪跑完，再統一進 INSERT 階段，不然後面表的 CASCADE 會事後波及已經插入過的較早的表。「插入當下」的 count 對帳可能是假象，要在全部流程跑完後再重新獨立覆核一次。
2. **pg driver（node-postgres）對 JS Array 參數的特殊處理**：JSON 陣列欄位如果在 JS 端 `JSON.parse()` 後把陣列直接當參數傳給 `pg`，會被序列化成 Postgres array literal 語法而非 JSON，PG 回 `invalid input syntax for type json`。應該保留原始字串直接傳，讓 PG 自己 cast。
3. **`session_replication_role` 需要 superuser 權限**：app 專用帳號（最小權限設計）無法執行這個指令，批次遷移工具要另外用 superuser 連線，不要因為這個需求就把 app 的正式連線也升級成 superuser。
4. **`pm2 restart` 不帶 `--update-env` 不會重讀 `.env` 新值**：任何涉及環境變數變更（尤其 `DATABASE_URI` 這種決定連去哪裡的關鍵變數）的重啟，一律要帶 `--update-env`。光看 HTTP 200 不能證明真的切換成功——如果切換前後資料看起來一樣，這個假象特別容易騙過人，要查目標系統自己的連線證據（`pg_stat_activity`）才是可靠驗證。

*v1.0 完*
