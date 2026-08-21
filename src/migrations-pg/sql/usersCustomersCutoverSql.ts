/**
 * APP-API-001 步驟16-7：users → customers 正式切換 SQL（PostgreSQL）
 * ═══════════════════════════════════════════════════════════════
 * 由 20260821_170000_users_customers_cutover migration 與
 * scripts/print-cutover-sql.ts（16-6 演練用，輸出給 psql -f）共用同一份字串，
 * 保證「演練跑的」與「正式跑的」逐字相同。
 *
 * 設計要點（2026-08-21 對 pre 正式庫唯讀盤點結果）：
 *   - 只搬 role='customer'（12 筆，含 trashed 與訪客帳號）；staff（admin/partner）不搬。
 *   - ID 保留策略：customers row 沿用 users row 的數字 id，既有 FK「資料值」不用改。
 *   - 主表與 array 子表欄位用 information_schema 動態交集，避免手列 ~150 欄漂移。
 *   - FK repoint 40 條（全部原規則 ON DELETE SET NULL / ON UPDATE NO ACTION），
 *     一律 NOT VALID：既有 staff 測試資料引用（如 admin 玩遊戲的 mini_game_records
 *     180 筆、behavior_events 2,940 筆）保留原值不清洗，只對新寫入強制。
 *   - _users_customers_cutover_log 記錄搬移名單與原 trashed 狀態 → down 可精確還原
 *     （pre 上 users 3/4/5/6 本來就是 trashed customer，不能被 rollback 誤救活）。
 *   - Phase C 把 users 端的 customer rows 標記 trashed（Payload 登入/查詢自動排除），
 *     封住「同帳號雙 collection 登入」的分歧窗口；staff rows 不動。
 *
 * 已知外觀量癥（不修）：customers id 1 已被 wall-demo 佔用，與 users id 1（admin）
 * 同號 —— 舊 staff 測試 rows 的引用 repoint 後在後台會顯示成 wall-demo，僅影響
 * 歷史測試資料的顯示歸屬，無功能影響。
 */

export const CUTOVER_UP_SQL = `
-- ═══ Phase 0：搬移日誌（rollback 依據） ═══
CREATE TABLE IF NOT EXISTS _users_customers_cutover_log (
  user_id integer PRIMARY KEY,
  was_deleted boolean NOT NULL,
  moved_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO _users_customers_cutover_log (user_id, was_deleted)
SELECT id, deleted_at IS NOT NULL FROM users WHERE role = 'customer'
ON CONFLICT (user_id) DO NOTHING;

-- ═══ Phase A：資料搬移 ═══
-- A-1 主表（欄位動態交集；id 沿用；已存在的 id 跳過）。
-- Payload 對每個 collection 生成各自的 enum type（enum_users_gender vs
-- enum_customers_gender），同名欄位型別不同 → SELECT 端逐欄 ::text::目標型別 轉換。
DO $$
DECLARE
  cols text;
  sel text;
  moved integer;
BEGIN
  SELECT string_agg(quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position),
         string_agg(
           CASE WHEN c.udt_name = u.udt_name THEN quote_ident(c.column_name)
                ELSE quote_ident(c.column_name) || '::text::' || quote_ident(c.udt_name)
           END, ', ' ORDER BY c.ordinal_position)
    INTO cols, sel
    FROM information_schema.columns c
    JOIN information_schema.columns u
      ON u.table_schema = 'public' AND u.table_name = 'users'
     AND u.column_name = c.column_name
   WHERE c.table_schema = 'public' AND c.table_name = 'customers'
     AND c.column_name <> 'id';
  EXECUTE format(
    'INSERT INTO customers (id, %1$s) SELECT id, %2$s FROM users WHERE role = ''customer'' ON CONFLICT (id) DO NOTHING',
    cols, sel);
  GET DIAGNOSTICS moved = ROW_COUNT;
  RAISE NOTICE '[cutover] customers 搬入 % 筆', moved;
END $$;

-- A-2 array 子表（欄位動態交集；uuid id 衝突跳過）
DO $$
DECLARE
  pair record;
  cols text;
  sel text;
  moved integer;
BEGIN
  FOR pair IN SELECT * FROM (VALUES
    ('users_tags', 'customers_tags'),
    ('users_addresses', 'customers_addresses'),
    ('users_invoice_profiles', 'customers_invoice_profiles'),
    ('users_game_activity_recent_games', 'customers_game_activity_recent_games'),
    ('users_ai_dm_preferences_dm_history', 'customers_ai_dm_preferences_dm_history')
  ) AS t(src, dst) LOOP
    SELECT string_agg(quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position),
           string_agg(
             CASE WHEN c.udt_name = u.udt_name THEN quote_ident(c.column_name)
                  ELSE quote_ident(c.column_name) || '::text::' || quote_ident(c.udt_name)
             END, ', ' ORDER BY c.ordinal_position)
      INTO cols, sel
      FROM information_schema.columns c
      JOIN information_schema.columns u
        ON u.table_schema = 'public' AND u.table_name = pair.src
       AND u.column_name = c.column_name
     WHERE c.table_schema = 'public' AND c.table_name = pair.dst;
    EXECUTE format(
      'INSERT INTO %2$I (%1$s) SELECT %4$s FROM %3$I s WHERE s._parent_id IN (SELECT user_id FROM _users_customers_cutover_log) ON CONFLICT (id) DO NOTHING',
      cols, pair.dst, pair.src, sel);
    GET DIAGNOSTICS moved = ROW_COUNT;
    RAISE NOTICE '[cutover] % 搬入 % 筆', pair.dst, moved;
  END LOOP;
END $$;

-- A-3 users_rels → customers_rels（aiDmPreferences.interestedProducts；id 讓 serial 重生）
INSERT INTO customers_rels ("order", parent_id, path, products_id)
SELECT r."order", r.parent_id, r.path, r.products_id
  FROM users_rels r
 WHERE r.parent_id IN (SELECT user_id FROM _users_customers_cutover_log)
   AND NOT EXISTS (
     SELECT 1 FROM customers_rels cr
      WHERE cr.parent_id = r.parent_id AND cr.path = r.path
        AND cr.products_id IS NOT DISTINCT FROM r.products_id);

-- A-4 序列對齊
SELECT setval(pg_get_serial_sequence('customers', 'id'),
              GREATEST((SELECT COALESCE(MAX(id), 1) FROM customers), 1));
SELECT setval(pg_get_serial_sequence('customers_rels', 'id'),
              GREATEST((SELECT COALESCE(MAX(id), 1) FROM customers_rels), 1));

-- ═══ Phase B：FK repoint（40 條，NOT VALID — 舊 staff 測試引用保留原值） ═══
ALTER TABLE automation_logs DROP CONSTRAINT IF EXISTS automation_logs_user_id_users_id_fk;
ALTER TABLE automation_logs ADD CONSTRAINT automation_logs_user_id_customers_id_fk FOREIGN KEY (user_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE behavior_events DROP CONSTRAINT IF EXISTS behavior_events_user_id_users_id_fk;
ALTER TABLE behavior_events ADD CONSTRAINT behavior_events_user_id_customers_id_fk FOREIGN KEY (user_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE birthday_campaigns DROP CONSTRAINT IF EXISTS birthday_campaigns_target_user_id_users_id_fk;
ALTER TABLE birthday_campaigns ADD CONSTRAINT birthday_campaigns_target_user_id_customers_id_fk FOREIGN KEY (target_user_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE card_battles DROP CONSTRAINT IF EXISTS card_battles_challenger_id_users_id_fk;
ALTER TABLE card_battles ADD CONSTRAINT card_battles_challenger_id_customers_id_fk FOREIGN KEY (challenger_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE card_battles DROP CONSTRAINT IF EXISTS card_battles_opponent_id_users_id_fk;
ALTER TABLE card_battles ADD CONSTRAINT card_battles_opponent_id_customers_id_fk FOREIGN KEY (opponent_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE collectible_card_events DROP CONSTRAINT IF EXISTS collectible_card_events_from_user_id_users_id_fk;
ALTER TABLE collectible_card_events ADD CONSTRAINT collectible_card_events_from_user_id_customers_id_fk FOREIGN KEY (from_user_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE collectible_card_events DROP CONSTRAINT IF EXISTS collectible_card_events_to_user_id_users_id_fk;
ALTER TABLE collectible_card_events ADD CONSTRAINT collectible_card_events_to_user_id_customers_id_fk FOREIGN KEY (to_user_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE collectible_cards DROP CONSTRAINT IF EXISTS collectible_cards_owner_id_users_id_fk;
ALTER TABLE collectible_cards ADD CONSTRAINT collectible_cards_owner_id_customers_id_fk FOREIGN KEY (owner_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE collectible_cards DROP CONSTRAINT IF EXISTS collectible_cards_original_owner_id_users_id_fk;
ALTER TABLE collectible_cards ADD CONSTRAINT collectible_cards_original_owner_id_customers_id_fk FOREIGN KEY (original_owner_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE concierge_service_requests DROP CONSTRAINT IF EXISTS concierge_service_requests_requester_id_users_id_fk;
ALTER TABLE concierge_service_requests ADD CONSTRAINT concierge_service_requests_requester_id_customers_id_fk FOREIGN KEY (requester_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_customer_id_users_id_fk;
ALTER TABLE conversations ADD CONSTRAINT conversations_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE coupon_redemptions DROP CONSTRAINT IF EXISTS coupon_redemptions_user_id_users_id_fk;
ALTER TABLE coupon_redemptions ADD CONSTRAINT coupon_redemptions_user_id_customers_id_fk FOREIGN KEY (user_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE credit_score_history DROP CONSTRAINT IF EXISTS credit_score_history_user_id_users_id_fk;
ALTER TABLE credit_score_history ADD CONSTRAINT credit_score_history_user_id_customers_id_fk FOREIGN KEY (user_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE customer_service_tickets DROP CONSTRAINT IF EXISTS customer_service_tickets_user_id_users_id_fk;
ALTER TABLE customer_service_tickets ADD CONSTRAINT customer_service_tickets_user_id_customers_id_fk FOREIGN KEY (user_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE exchanges DROP CONSTRAINT IF EXISTS exchanges_customer_id_users_id_fk;
ALTER TABLE exchanges ADD CONSTRAINT exchanges_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE game_leaderboard DROP CONSTRAINT IF EXISTS game_leaderboard_player_id_users_id_fk;
ALTER TABLE game_leaderboard ADD CONSTRAINT game_leaderboard_player_id_customers_id_fk FOREIGN KEY (player_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_customer_id_users_id_fk;
ALTER TABLE invoices ADD CONSTRAINT invoices_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE marketing_execution_logs DROP CONSTRAINT IF EXISTS marketing_execution_logs_user_id_users_id_fk;
ALTER TABLE marketing_execution_logs ADD CONSTRAINT marketing_execution_logs_user_id_customers_id_fk FOREIGN KEY (user_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE member_segments DROP CONSTRAINT IF EXISTS member_segments_user_id_users_id_fk;
ALTER TABLE member_segments ADD CONSTRAINT member_segments_user_id_customers_id_fk FOREIGN KEY (user_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE mini_game_records DROP CONSTRAINT IF EXISTS mini_game_records_player_id_users_id_fk;
ALTER TABLE mini_game_records ADD CONSTRAINT mini_game_records_player_id_customers_id_fk FOREIGN KEY (player_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE newsletter_subscribers DROP CONSTRAINT IF EXISTS newsletter_subscribers_user_id_users_id_fk;
ALTER TABLE newsletter_subscribers ADD CONSTRAINT newsletter_subscribers_user_id_customers_id_fk FOREIGN KEY (user_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_customer_id_users_id_fk;
ALTER TABLE orders ADD CONSTRAINT orders_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE points_transactions DROP CONSTRAINT IF EXISTS points_transactions_user_id_users_id_fk;
ALTER TABLE points_transactions ADD CONSTRAINT points_transactions_user_id_customers_id_fk FOREIGN KEY (user_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE product_reviews DROP CONSTRAINT IF EXISTS product_reviews_reviewer_id_users_id_fk;
ALTER TABLE product_reviews ADD CONSTRAINT product_reviews_reviewer_id_customers_id_fk FOREIGN KEY (reviewer_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE product_view_events DROP CONSTRAINT IF EXISTS product_view_events_user_id_users_id_fk;
ALTER TABLE product_view_events ADD CONSTRAINT product_view_events_user_id_customers_id_fk FOREIGN KEY (user_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE promotion_applications DROP CONSTRAINT IF EXISTS promotion_applications_user_id_users_id_fk;
ALTER TABLE promotion_applications ADD CONSTRAINT promotion_applications_user_id_customers_id_fk FOREIGN KEY (user_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE refunds DROP CONSTRAINT IF EXISTS refunds_customer_id_users_id_fk;
ALTER TABLE refunds ADD CONSTRAINT refunds_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE returns DROP CONSTRAINT IF EXISTS returns_customer_id_users_id_fk;
ALTER TABLE returns ADD CONSTRAINT returns_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE style_game_rooms DROP CONSTRAINT IF EXISTS style_game_rooms_host_id_users_id_fk;
ALTER TABLE style_game_rooms ADD CONSTRAINT style_game_rooms_host_id_customers_id_fk FOREIGN KEY (host_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE style_game_rooms DROP CONSTRAINT IF EXISTS style_game_rooms_result_winner_id_users_id_fk;
ALTER TABLE style_game_rooms ADD CONSTRAINT style_game_rooms_result_winner_id_customers_id_fk FOREIGN KEY (result_winner_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE style_game_rooms_participants DROP CONSTRAINT IF EXISTS style_game_rooms_participants_user_id_users_id_fk;
ALTER TABLE style_game_rooms_participants ADD CONSTRAINT style_game_rooms_participants_user_id_customers_id_fk FOREIGN KEY (user_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE style_submissions DROP CONSTRAINT IF EXISTS style_submissions_player_id_users_id_fk;
ALTER TABLE style_submissions ADD CONSTRAINT style_submissions_player_id_customers_id_fk FOREIGN KEY (player_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE style_votes DROP CONSTRAINT IF EXISTS style_votes_voter_id_users_id_fk;
ALTER TABLE style_votes ADD CONSTRAINT style_votes_voter_id_customers_id_fk FOREIGN KEY (voter_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE style_wishes DROP CONSTRAINT IF EXISTS style_wishes_seeker_id_users_id_fk;
ALTER TABLE style_wishes ADD CONSTRAINT style_wishes_seeker_id_customers_id_fk FOREIGN KEY (seeker_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE style_wishes_grants DROP CONSTRAINT IF EXISTS style_wishes_grants_granter_id_users_id_fk;
ALTER TABLE style_wishes_grants ADD CONSTRAINT style_wishes_grants_granter_id_customers_id_fk FOREIGN KEY (granter_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE user_rewards DROP CONSTRAINT IF EXISTS user_rewards_user_id_users_id_fk;
ALTER TABLE user_rewards ADD CONSTRAINT user_rewards_user_id_customers_id_fk FOREIGN KEY (user_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_user_id_users_id_fk;
ALTER TABLE user_subscriptions ADD CONSTRAINT user_subscriptions_user_id_customers_id_fk FOREIGN KEY (user_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_user_id_users_id_fk;
ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_user_id_customers_id_fk FOREIGN KEY (user_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE wallet_withdrawals DROP CONSTRAINT IF EXISTS wallet_withdrawals_user_id_users_id_fk;
ALTER TABLE wallet_withdrawals ADD CONSTRAINT wallet_withdrawals_user_id_customers_id_fk FOREIGN KEY (user_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE wishlist_items DROP CONSTRAINT IF EXISTS wishlist_items_user_id_users_id_fk;
ALTER TABLE wishlist_items ADD CONSTRAINT wishlist_items_user_id_customers_id_fk FOREIGN KEY (user_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;

-- ═══ Phase C：封存 users 端的 customer rows（Payload trash — 登入/查詢自動排除） ═══
UPDATE users SET deleted_at = now()
 WHERE role = 'customer' AND deleted_at IS NULL;
`

export const CUTOVER_DOWN_SQL = `
-- ═══ 反向 Phase C：只還原「搬移前是 active」的 users rows ═══
UPDATE users u SET deleted_at = NULL
  FROM _users_customers_cutover_log l
 WHERE u.id = l.user_id AND l.was_deleted = false;

-- ═══ 反向 Phase B：FK 指回 users（NOT VALID — cutover 期間可能已寫入 customers-only id） ═══
ALTER TABLE automation_logs DROP CONSTRAINT IF EXISTS automation_logs_user_id_customers_id_fk;
ALTER TABLE automation_logs ADD CONSTRAINT automation_logs_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE behavior_events DROP CONSTRAINT IF EXISTS behavior_events_user_id_customers_id_fk;
ALTER TABLE behavior_events ADD CONSTRAINT behavior_events_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE birthday_campaigns DROP CONSTRAINT IF EXISTS birthday_campaigns_target_user_id_customers_id_fk;
ALTER TABLE birthday_campaigns ADD CONSTRAINT birthday_campaigns_target_user_id_users_id_fk FOREIGN KEY (target_user_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE card_battles DROP CONSTRAINT IF EXISTS card_battles_challenger_id_customers_id_fk;
ALTER TABLE card_battles ADD CONSTRAINT card_battles_challenger_id_users_id_fk FOREIGN KEY (challenger_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE card_battles DROP CONSTRAINT IF EXISTS card_battles_opponent_id_customers_id_fk;
ALTER TABLE card_battles ADD CONSTRAINT card_battles_opponent_id_users_id_fk FOREIGN KEY (opponent_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE collectible_card_events DROP CONSTRAINT IF EXISTS collectible_card_events_from_user_id_customers_id_fk;
ALTER TABLE collectible_card_events ADD CONSTRAINT collectible_card_events_from_user_id_users_id_fk FOREIGN KEY (from_user_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE collectible_card_events DROP CONSTRAINT IF EXISTS collectible_card_events_to_user_id_customers_id_fk;
ALTER TABLE collectible_card_events ADD CONSTRAINT collectible_card_events_to_user_id_users_id_fk FOREIGN KEY (to_user_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE collectible_cards DROP CONSTRAINT IF EXISTS collectible_cards_owner_id_customers_id_fk;
ALTER TABLE collectible_cards ADD CONSTRAINT collectible_cards_owner_id_users_id_fk FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE collectible_cards DROP CONSTRAINT IF EXISTS collectible_cards_original_owner_id_customers_id_fk;
ALTER TABLE collectible_cards ADD CONSTRAINT collectible_cards_original_owner_id_users_id_fk FOREIGN KEY (original_owner_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE concierge_service_requests DROP CONSTRAINT IF EXISTS concierge_service_requests_requester_id_customers_id_fk;
ALTER TABLE concierge_service_requests ADD CONSTRAINT concierge_service_requests_requester_id_users_id_fk FOREIGN KEY (requester_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_customer_id_customers_id_fk;
ALTER TABLE conversations ADD CONSTRAINT conversations_customer_id_users_id_fk FOREIGN KEY (customer_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE coupon_redemptions DROP CONSTRAINT IF EXISTS coupon_redemptions_user_id_customers_id_fk;
ALTER TABLE coupon_redemptions ADD CONSTRAINT coupon_redemptions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE credit_score_history DROP CONSTRAINT IF EXISTS credit_score_history_user_id_customers_id_fk;
ALTER TABLE credit_score_history ADD CONSTRAINT credit_score_history_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE customer_service_tickets DROP CONSTRAINT IF EXISTS customer_service_tickets_user_id_customers_id_fk;
ALTER TABLE customer_service_tickets ADD CONSTRAINT customer_service_tickets_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE exchanges DROP CONSTRAINT IF EXISTS exchanges_customer_id_customers_id_fk;
ALTER TABLE exchanges ADD CONSTRAINT exchanges_customer_id_users_id_fk FOREIGN KEY (customer_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE game_leaderboard DROP CONSTRAINT IF EXISTS game_leaderboard_player_id_customers_id_fk;
ALTER TABLE game_leaderboard ADD CONSTRAINT game_leaderboard_player_id_users_id_fk FOREIGN KEY (player_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_customer_id_customers_id_fk;
ALTER TABLE invoices ADD CONSTRAINT invoices_customer_id_users_id_fk FOREIGN KEY (customer_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE marketing_execution_logs DROP CONSTRAINT IF EXISTS marketing_execution_logs_user_id_customers_id_fk;
ALTER TABLE marketing_execution_logs ADD CONSTRAINT marketing_execution_logs_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE member_segments DROP CONSTRAINT IF EXISTS member_segments_user_id_customers_id_fk;
ALTER TABLE member_segments ADD CONSTRAINT member_segments_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE mini_game_records DROP CONSTRAINT IF EXISTS mini_game_records_player_id_customers_id_fk;
ALTER TABLE mini_game_records ADD CONSTRAINT mini_game_records_player_id_users_id_fk FOREIGN KEY (player_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE newsletter_subscribers DROP CONSTRAINT IF EXISTS newsletter_subscribers_user_id_customers_id_fk;
ALTER TABLE newsletter_subscribers ADD CONSTRAINT newsletter_subscribers_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_customer_id_customers_id_fk;
ALTER TABLE orders ADD CONSTRAINT orders_customer_id_users_id_fk FOREIGN KEY (customer_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE points_transactions DROP CONSTRAINT IF EXISTS points_transactions_user_id_customers_id_fk;
ALTER TABLE points_transactions ADD CONSTRAINT points_transactions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE product_reviews DROP CONSTRAINT IF EXISTS product_reviews_reviewer_id_customers_id_fk;
ALTER TABLE product_reviews ADD CONSTRAINT product_reviews_reviewer_id_users_id_fk FOREIGN KEY (reviewer_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE product_view_events DROP CONSTRAINT IF EXISTS product_view_events_user_id_customers_id_fk;
ALTER TABLE product_view_events ADD CONSTRAINT product_view_events_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE promotion_applications DROP CONSTRAINT IF EXISTS promotion_applications_user_id_customers_id_fk;
ALTER TABLE promotion_applications ADD CONSTRAINT promotion_applications_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE refunds DROP CONSTRAINT IF EXISTS refunds_customer_id_customers_id_fk;
ALTER TABLE refunds ADD CONSTRAINT refunds_customer_id_users_id_fk FOREIGN KEY (customer_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE returns DROP CONSTRAINT IF EXISTS returns_customer_id_customers_id_fk;
ALTER TABLE returns ADD CONSTRAINT returns_customer_id_users_id_fk FOREIGN KEY (customer_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE style_game_rooms DROP CONSTRAINT IF EXISTS style_game_rooms_host_id_customers_id_fk;
ALTER TABLE style_game_rooms ADD CONSTRAINT style_game_rooms_host_id_users_id_fk FOREIGN KEY (host_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE style_game_rooms DROP CONSTRAINT IF EXISTS style_game_rooms_result_winner_id_customers_id_fk;
ALTER TABLE style_game_rooms ADD CONSTRAINT style_game_rooms_result_winner_id_users_id_fk FOREIGN KEY (result_winner_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE style_game_rooms_participants DROP CONSTRAINT IF EXISTS style_game_rooms_participants_user_id_customers_id_fk;
ALTER TABLE style_game_rooms_participants ADD CONSTRAINT style_game_rooms_participants_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE style_submissions DROP CONSTRAINT IF EXISTS style_submissions_player_id_customers_id_fk;
ALTER TABLE style_submissions ADD CONSTRAINT style_submissions_player_id_users_id_fk FOREIGN KEY (player_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE style_votes DROP CONSTRAINT IF EXISTS style_votes_voter_id_customers_id_fk;
ALTER TABLE style_votes ADD CONSTRAINT style_votes_voter_id_users_id_fk FOREIGN KEY (voter_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE style_wishes DROP CONSTRAINT IF EXISTS style_wishes_seeker_id_customers_id_fk;
ALTER TABLE style_wishes ADD CONSTRAINT style_wishes_seeker_id_users_id_fk FOREIGN KEY (seeker_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE style_wishes_grants DROP CONSTRAINT IF EXISTS style_wishes_grants_granter_id_customers_id_fk;
ALTER TABLE style_wishes_grants ADD CONSTRAINT style_wishes_grants_granter_id_users_id_fk FOREIGN KEY (granter_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE user_rewards DROP CONSTRAINT IF EXISTS user_rewards_user_id_customers_id_fk;
ALTER TABLE user_rewards ADD CONSTRAINT user_rewards_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_user_id_customers_id_fk;
ALTER TABLE user_subscriptions ADD CONSTRAINT user_subscriptions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_user_id_customers_id_fk;
ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE wallet_withdrawals DROP CONSTRAINT IF EXISTS wallet_withdrawals_user_id_customers_id_fk;
ALTER TABLE wallet_withdrawals ADD CONSTRAINT wallet_withdrawals_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
ALTER TABLE wishlist_items DROP CONSTRAINT IF EXISTS wishlist_items_user_id_customers_id_fk;
ALTER TABLE wishlist_items ADD CONSTRAINT wishlist_items_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;

-- ═══ 反向 Phase A：刪除搬入的 customers rows（array 子表 / sessions 由 FK CASCADE 帶走） ═══
DELETE FROM customers_rels
 WHERE parent_id IN (SELECT user_id FROM _users_customers_cutover_log);
DELETE FROM customers
 WHERE id IN (SELECT user_id FROM _users_customers_cutover_log);

DROP TABLE IF EXISTS _users_customers_cutover_log;
`
