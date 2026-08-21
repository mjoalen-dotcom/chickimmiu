# 步驟16-7 部署 Runbook — line-bc-migration 全量上 pre（含 users→customers 切換）

> 前提：Alan 回覆「確認遷移」後執行。branch `de441ad` 已推 hetzner（非 main ref）。
> 演練（16-6）已於 2026-08-21 在 Hetzner scratch DB（pg_dump 正式庫全量複本）完成：
> up → 斷言 → down → 斷言 → re-up 全綠。詳見 migration 檔 doc comment 與 commit de441ad。

## 這次部署一次帶上的內容

1. App 遷移需求全項（A-1/A-2/A-3+LINE、B-1/2/5/6、D-1~4）— commit `70f2a1f`
2. B 等級門檻改讀 membership-tiers + C 公開暱稱 — commit `0a38ecf`
3. hetzner/main 全部（favicon/社群牆/OOM build 修/blog 修…）— merge `7546059`
4. **users→customers 正式切換**（migration `20260821_170000`）— commit `de441ad`
5. PG migrations 新增三支：ops_actions（若 pre 未跑過）、customer nickname、cutover

## 執行步驟（依序，全程 SSH root@5.223.85.14）

```bash
# 0. 備份（必做）
sudo -u postgres pg_dump ckmu | gzip > /root/backup-ckmu-pre-cutover-$(date +%Y%m%d-%H%M).sql.gz

# 1. payload_migrations 追蹤表完整性檢查（08-17 教訓）
sudo -u postgres psql -d ckmu -c "SELECT name FROM payload_migrations ORDER BY id DESC LIMIT 8"
#    必須看到 20260816_023522_pg_baseline 與後續 p0b/p0c 各支；缺 baseline 就先補 INSERT

# 2. 本機把 branch 推成 main（deploy 腳本抓 main）
#    （在 Windows repo）git push hetzner line-bc-migration:main

# 3. 部署（deploy-ckmu.sh 內含 fetch/reset/migrate/build/PM2 restart）
/root/deploy-ckmu.sh
#    migrate 階段會依序跑 social_wall（已套用會跳過）→ ops_actions → nickname → cutover

# 4. Health checks（腳本內建 4 項外，另加）
curl -s https://pre.chickimmiu.com/ -o /dev/null -w '%{http_code}\n'          # 200
sudo -u postgres psql -d ckmu -Atc "SELECT COUNT(*) FROM customers"            # 13
sudo -u postgres psql -d ckmu -Atc "SELECT COUNT(*) FROM users WHERE role='customer' AND deleted_at IS NULL"  # 0
```

## 部署後驗證（App 遷移需求相關）

- `GET /api/games`（登入態）：configs.daily_checkin 帶 5/50/1.5；spin_wheel freePerTier.ordinary=1；dailyPointsCap 存在
- `GET /api/app/leaderboard`：200、姓名遮罩、無 userId
- `GET /api/app/points/transactions`：200、只回本人
- 會員 email 登入（customers）→ /account 點數/等級正常
- 後台 /admin：customers 列表 13 筆；users 列表剩 staff 4 筆（customer rows 進垃圾桶）

## 回滾

```bash
# 快速回滾（migration 層）：
cd /var/www/chickimmiu && NODE_ENV=production pnpm payload migrate:down   # 跑 cutover 的 down（精確還原 trash 狀態）
# 或整庫還原：
# gunzip -c /root/backup-ckmu-pre-cutover-<ts>.sql.gz | sudo -u postgres psql ckmu_restore ...（照既有還原 runbook）
# 程式回滾：git reset --hard <前一個 main sha> + deploy-ckmu.sh
```

## 已知注意事項

- **會員 session 全部失效**（customers_sessions 不搬）— 12 位封測會員需重新登入；App 同理。
- staff 測試舊資料的引用（admin 玩的遊戲紀錄 180 筆、behavior_events 2,940 筆等 12 個欄位）
  保留原值（FK NOT VALID）；其中指向 id 1/7/9 的在後台會顯示成 wall-demo 顧客（id 1 撞號），
  僅歷史測試資料外觀，無功能影響。
- 部署後 game-settings 即為權威：簽到 5 點/第7天50/倍率1.5、刮刮樂每日 5 次、穿搭挑戰 5 次、
  轉盤一般會員 1 次（已依 Alan 8/21 拍板設定）。要調整直接改後台即生效。
- App 端 `/api/users/*` 端點：customers 拆分後 `/api/users/login` 只服務 staff。App 既有
  Email 登入請改打 `/api/customers/login`（回應格式相同）— 已在給 App 團隊的回覆文件註記。
