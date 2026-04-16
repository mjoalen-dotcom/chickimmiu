import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`size_charts_measurements\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`key\` text NOT NULL,
  	\`label\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`size_charts\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`size_charts_measurements_order_idx\` ON \`size_charts_measurements\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`size_charts_measurements_parent_id_idx\` ON \`size_charts_measurements\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`size_charts_rows_values\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`key\` text NOT NULL,
  	\`value\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`size_charts_rows\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`size_charts_rows_values_order_idx\` ON \`size_charts_rows_values\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`size_charts_rows_values_parent_id_idx\` ON \`size_charts_rows_values\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`size_charts_rows\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`size\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`size_charts\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`size_charts_rows_order_idx\` ON \`size_charts_rows\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`size_charts_rows_parent_id_idx\` ON \`size_charts_rows\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`size_charts\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`slug\` text NOT NULL,
  	\`category\` text DEFAULT 'top',
  	\`unit\` text DEFAULT 'cm',
  	\`note\` text,
  	\`is_active\` integer DEFAULT true,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`size_charts_slug_idx\` ON \`size_charts\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`size_charts_updated_at_idx\` ON \`size_charts\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`size_charts_created_at_idx\` ON \`size_charts\` (\`created_at\`);`)
  await db.run(sql`ALTER TABLE \`products_images\` ADD \`caption\` text;`)
  await db.run(sql`ALTER TABLE \`products_variants\` ADD \`color_swatch_id\` integer REFERENCES media(id);`)
  await db.run(sql`CREATE INDEX \`products_variants_color_swatch_idx\` ON \`products_variants\` (\`color_swatch_id\`);`)
  await db.run(sql`ALTER TABLE \`products\` ADD \`product_sku\` text;`)
  await db.run(sql`ALTER TABLE \`products\` ADD \`brand\` text DEFAULT 'CHIC KIM & MIU';`)
  await db.run(sql`ALTER TABLE \`products\` ADD \`product_origin\` text;`)
  await db.run(sql`ALTER TABLE \`products\` ADD \`short_description\` text;`)
  await db.run(sql`ALTER TABLE \`products\` ADD \`featured_image_id\` integer REFERENCES media(id);`)
  await db.run(sql`ALTER TABLE \`products\` ADD \`size_chart_id\` integer REFERENCES size_charts(id);`)
  await db.run(sql`ALTER TABLE \`products\` ADD \`material\` text;`)
  await db.run(sql`ALTER TABLE \`products\` ADD \`care_instructions\` text;`)
  await db.run(sql`ALTER TABLE \`products\` ADD \`model_info_height\` text;`)
  await db.run(sql`ALTER TABLE \`products\` ADD \`model_info_weight\` text;`)
  await db.run(sql`ALTER TABLE \`products\` ADD \`model_info_wearing_size\` text;`)
  await db.run(sql`ALTER TABLE \`products\` ADD \`model_info_body_shape\` text;`)
  await db.run(sql`ALTER TABLE \`products\` ADD \`styling_tips\` text;`)
  await db.run(sql`CREATE INDEX \`products_featured_image_idx\` ON \`products\` (\`featured_image_id\`);`)
  await db.run(sql`CREATE INDEX \`products_size_chart_idx\` ON \`products\` (\`size_chart_id\`);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`size_charts_id\` integer REFERENCES size_charts(id);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_size_charts_id_idx\` ON \`payload_locked_documents_rels\` (\`size_charts_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`size_charts_measurements\`;`)
  await db.run(sql`DROP TABLE \`size_charts_rows_values\`;`)
  await db.run(sql`DROP TABLE \`size_charts_rows\`;`)
  await db.run(sql`DROP TABLE \`size_charts\`;`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_products_variants\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`color_name\` text NOT NULL,
  	\`color_code\` text,
  	\`size\` text NOT NULL,
  	\`sku\` text NOT NULL,
  	\`stock\` numeric DEFAULT 0 NOT NULL,
  	\`price_override\` numeric,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_products_variants\`("_order", "_parent_id", "id", "color_name", "color_code", "size", "sku", "stock", "price_override") SELECT "_order", "_parent_id", "id", "color_name", "color_code", "size", "sku", "stock", "price_override" FROM \`products_variants\`;`)
  await db.run(sql`DROP TABLE \`products_variants\`;`)
  await db.run(sql`ALTER TABLE \`__new_products_variants\` RENAME TO \`products_variants\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`products_variants_order_idx\` ON \`products_variants\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_variants_parent_id_idx\` ON \`products_variants\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`__new_products\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`slug\` text NOT NULL,
  	\`description\` text,
  	\`price\` numeric NOT NULL,
  	\`sale_price\` numeric,
  	\`category_id\` integer NOT NULL,
  	\`stock\` numeric DEFAULT 0,
  	\`low_stock_threshold\` numeric DEFAULT 5,
  	\`is_low_stock\` integer DEFAULT false,
  	\`allow_pre_order\` integer DEFAULT false,
  	\`pre_order_note\` text,
  	\`is_new\` integer DEFAULT false,
  	\`is_hot\` integer DEFAULT false,
  	\`status\` text DEFAULT 'draft' NOT NULL,
  	\`weight\` numeric,
  	\`seo_meta_title\` text,
  	\`seo_meta_description\` text,
  	\`seo_meta_image_id\` integer,
  	\`sourcing_source_id\` text,
  	\`sourcing_supplier_name\` text,
  	\`sourcing_supplier_location\` text,
  	\`sourcing_cost_k_r_w\` numeric,
  	\`sourcing_cost_t_w_d\` numeric,
  	\`sourcing_exchange_rate\` numeric,
  	\`sourcing_original_description\` text,
  	\`sourcing_fabric_info_material\` text,
  	\`sourcing_fabric_info_thickness\` text,
  	\`sourcing_fabric_info_transparency\` text,
  	\`sourcing_fabric_info_elasticity\` text,
  	\`sourcing_fabric_info_made_in\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`category_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`seo_meta_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`INSERT INTO \`__new_products\`("id", "name", "slug", "description", "price", "sale_price", "category_id", "stock", "low_stock_threshold", "is_low_stock", "allow_pre_order", "pre_order_note", "is_new", "is_hot", "status", "weight", "seo_meta_title", "seo_meta_description", "seo_meta_image_id", "sourcing_source_id", "sourcing_supplier_name", "sourcing_supplier_location", "sourcing_cost_k_r_w", "sourcing_cost_t_w_d", "sourcing_exchange_rate", "sourcing_original_description", "sourcing_fabric_info_material", "sourcing_fabric_info_thickness", "sourcing_fabric_info_transparency", "sourcing_fabric_info_elasticity", "sourcing_fabric_info_made_in", "updated_at", "created_at") SELECT "id", "name", "slug", "description", "price", "sale_price", "category_id", "stock", "low_stock_threshold", "is_low_stock", "allow_pre_order", "pre_order_note", "is_new", "is_hot", "status", "weight", "seo_meta_title", "seo_meta_description", "seo_meta_image_id", "sourcing_source_id", "sourcing_supplier_name", "sourcing_supplier_location", "sourcing_cost_k_r_w", "sourcing_cost_t_w_d", "sourcing_exchange_rate", "sourcing_original_description", "sourcing_fabric_info_material", "sourcing_fabric_info_thickness", "sourcing_fabric_info_transparency", "sourcing_fabric_info_elasticity", "sourcing_fabric_info_made_in", "updated_at", "created_at" FROM \`products\`;`)
  await db.run(sql`DROP TABLE \`products\`;`)
  await db.run(sql`ALTER TABLE \`__new_products\` RENAME TO \`products\`;`)
  await db.run(sql`CREATE UNIQUE INDEX \`products_slug_idx\` ON \`products\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`products_category_idx\` ON \`products\` (\`category_id\`);`)
  await db.run(sql`CREATE INDEX \`products_seo_seo_meta_image_idx\` ON \`products\` (\`seo_meta_image_id\`);`)
  await db.run(sql`CREATE INDEX \`products_updated_at_idx\` ON \`products\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`products_created_at_idx\` ON \`products\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`__new_payload_locked_documents_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	\`media_id\` integer,
  	\`categories_id\` integer,
  	\`membership_tiers_id\` integer,
  	\`subscription_plans_id\` integer,
  	\`products_id\` integer,
  	\`product_reviews_id\` integer,
  	\`orders_id\` integer,
  	\`returns_id\` integer,
  	\`refunds_id\` integer,
  	\`exchanges_id\` integer,
  	\`shipping_methods_id\` integer,
  	\`affiliates_id\` integer,
  	\`blog_posts_id\` integer,
  	\`pages_id\` integer,
  	\`ugc_posts_id\` integer,
  	\`points_redemptions_id\` integer,
  	\`credit_score_history_id\` integer,
  	\`points_transactions_id\` integer,
  	\`automation_journeys_id\` integer,
  	\`automation_logs_id\` integer,
  	\`customer_service_tickets_id\` integer,
  	\`member_segments_id\` integer,
  	\`marketing_campaigns_id\` integer,
  	\`message_templates_id\` integer,
  	\`ab_tests_id\` integer,
  	\`marketing_execution_logs_id\` integer,
  	\`festival_templates_id\` integer,
  	\`birthday_campaigns_id\` integer,
  	\`concierge_service_requests_id\` integer,
  	\`invoices_id\` integer,
  	\`mini_game_records_id\` integer,
  	\`card_battles_id\` integer,
  	\`game_leaderboard_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`categories_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`membership_tiers_id\`) REFERENCES \`membership_tiers\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`subscription_plans_id\`) REFERENCES \`subscription_plans\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`products_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`product_reviews_id\`) REFERENCES \`product_reviews\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`orders_id\`) REFERENCES \`orders\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`returns_id\`) REFERENCES \`returns\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`refunds_id\`) REFERENCES \`refunds\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`exchanges_id\`) REFERENCES \`exchanges\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`shipping_methods_id\`) REFERENCES \`shipping_methods\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`affiliates_id\`) REFERENCES \`affiliates\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`blog_posts_id\`) REFERENCES \`blog_posts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`pages_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`ugc_posts_id\`) REFERENCES \`ugc_posts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`points_redemptions_id\`) REFERENCES \`points_redemptions\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`credit_score_history_id\`) REFERENCES \`credit_score_history\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`points_transactions_id\`) REFERENCES \`points_transactions\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`automation_journeys_id\`) REFERENCES \`automation_journeys\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`automation_logs_id\`) REFERENCES \`automation_logs\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`customer_service_tickets_id\`) REFERENCES \`customer_service_tickets\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`member_segments_id\`) REFERENCES \`member_segments\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`marketing_campaigns_id\`) REFERENCES \`marketing_campaigns\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`message_templates_id\`) REFERENCES \`message_templates\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`ab_tests_id\`) REFERENCES \`ab_tests\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`marketing_execution_logs_id\`) REFERENCES \`marketing_execution_logs\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`festival_templates_id\`) REFERENCES \`festival_templates\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`birthday_campaigns_id\`) REFERENCES \`birthday_campaigns\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`concierge_service_requests_id\`) REFERENCES \`concierge_service_requests\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`invoices_id\`) REFERENCES \`invoices\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`mini_game_records_id\`) REFERENCES \`mini_game_records\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`card_battles_id\`) REFERENCES \`card_battles\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`game_leaderboard_id\`) REFERENCES \`game_leaderboard\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_payload_locked_documents_rels\`("id", "order", "parent_id", "path", "users_id", "media_id", "categories_id", "membership_tiers_id", "subscription_plans_id", "products_id", "product_reviews_id", "orders_id", "returns_id", "refunds_id", "exchanges_id", "shipping_methods_id", "affiliates_id", "blog_posts_id", "pages_id", "ugc_posts_id", "points_redemptions_id", "credit_score_history_id", "points_transactions_id", "automation_journeys_id", "automation_logs_id", "customer_service_tickets_id", "member_segments_id", "marketing_campaigns_id", "message_templates_id", "ab_tests_id", "marketing_execution_logs_id", "festival_templates_id", "birthday_campaigns_id", "concierge_service_requests_id", "invoices_id", "mini_game_records_id", "card_battles_id", "game_leaderboard_id") SELECT "id", "order", "parent_id", "path", "users_id", "media_id", "categories_id", "membership_tiers_id", "subscription_plans_id", "products_id", "product_reviews_id", "orders_id", "returns_id", "refunds_id", "exchanges_id", "shipping_methods_id", "affiliates_id", "blog_posts_id", "pages_id", "ugc_posts_id", "points_redemptions_id", "credit_score_history_id", "points_transactions_id", "automation_journeys_id", "automation_logs_id", "customer_service_tickets_id", "member_segments_id", "marketing_campaigns_id", "message_templates_id", "ab_tests_id", "marketing_execution_logs_id", "festival_templates_id", "birthday_campaigns_id", "concierge_service_requests_id", "invoices_id", "mini_game_records_id", "card_battles_id", "game_leaderboard_id" FROM \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new_payload_locked_documents_rels\` RENAME TO \`payload_locked_documents_rels\`;`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_media_id_idx\` ON \`payload_locked_documents_rels\` (\`media_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_categories_id_idx\` ON \`payload_locked_documents_rels\` (\`categories_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_membership_tiers_id_idx\` ON \`payload_locked_documents_rels\` (\`membership_tiers_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_subscription_plans_id_idx\` ON \`payload_locked_documents_rels\` (\`subscription_plans_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_products_id_idx\` ON \`payload_locked_documents_rels\` (\`products_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_product_reviews_id_idx\` ON \`payload_locked_documents_rels\` (\`product_reviews_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_orders_id_idx\` ON \`payload_locked_documents_rels\` (\`orders_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_returns_id_idx\` ON \`payload_locked_documents_rels\` (\`returns_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_refunds_id_idx\` ON \`payload_locked_documents_rels\` (\`refunds_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_exchanges_id_idx\` ON \`payload_locked_documents_rels\` (\`exchanges_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_shipping_methods_id_idx\` ON \`payload_locked_documents_rels\` (\`shipping_methods_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_affiliates_id_idx\` ON \`payload_locked_documents_rels\` (\`affiliates_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_blog_posts_id_idx\` ON \`payload_locked_documents_rels\` (\`blog_posts_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_pages_id_idx\` ON \`payload_locked_documents_rels\` (\`pages_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_ugc_posts_id_idx\` ON \`payload_locked_documents_rels\` (\`ugc_posts_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_points_redemptions_id_idx\` ON \`payload_locked_documents_rels\` (\`points_redemptions_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_credit_score_history_id_idx\` ON \`payload_locked_documents_rels\` (\`credit_score_history_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_points_transactions_id_idx\` ON \`payload_locked_documents_rels\` (\`points_transactions_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_automation_journeys_id_idx\` ON \`payload_locked_documents_rels\` (\`automation_journeys_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_automation_logs_id_idx\` ON \`payload_locked_documents_rels\` (\`automation_logs_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_customer_service_tickets_i_idx\` ON \`payload_locked_documents_rels\` (\`customer_service_tickets_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_member_segments_id_idx\` ON \`payload_locked_documents_rels\` (\`member_segments_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_marketing_campaigns_id_idx\` ON \`payload_locked_documents_rels\` (\`marketing_campaigns_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_message_templates_id_idx\` ON \`payload_locked_documents_rels\` (\`message_templates_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_ab_tests_id_idx\` ON \`payload_locked_documents_rels\` (\`ab_tests_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_marketing_execution_logs_i_idx\` ON \`payload_locked_documents_rels\` (\`marketing_execution_logs_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_festival_templates_id_idx\` ON \`payload_locked_documents_rels\` (\`festival_templates_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_birthday_campaigns_id_idx\` ON \`payload_locked_documents_rels\` (\`birthday_campaigns_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_concierge_service_requests_idx\` ON \`payload_locked_documents_rels\` (\`concierge_service_requests_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_invoices_id_idx\` ON \`payload_locked_documents_rels\` (\`invoices_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_mini_game_records_id_idx\` ON \`payload_locked_documents_rels\` (\`mini_game_records_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_card_battles_id_idx\` ON \`payload_locked_documents_rels\` (\`card_battles_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_game_leaderboard_id_idx\` ON \`payload_locked_documents_rels\` (\`game_leaderboard_id\`);`)
  await db.run(sql`ALTER TABLE \`products_images\` DROP COLUMN \`caption\`;`)
}
