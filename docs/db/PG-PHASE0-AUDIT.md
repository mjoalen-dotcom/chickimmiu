# PG-PHASE0-AUDIT.md｜SQLite → PostgreSQL 16 遷移 Phase 0 盤點（唯讀）

日期：2026-08-15｜依據：`docs/workorders/DB-PG-001.md` Prompt P1｜狀態：**盤點完成，停下等 Alan 確認**（Prompt P1 明文要求）

## 1. 版本

| 套件 | 版本 |
|---|---|
| payload | ^3.83.0 |
| @payloadcms/db-sqlite | ^3.83.0 |
| @payloadcms/db-postgres | ^3.83.0（**已安裝，尚未啟用**——package.json 早就把兩個 adapter 都裝了） |
| drizzle-orm | 0.45.2 |
| next | 15.5.15 |
| Node.js | v24.19.0（伺服器實測） |

SQLite 檔：`data/chickimmiu.db`，**39MB**（`file:./data/chickimmiu.db`，DATABASE_URI 相對路徑）。

## 2. 全表清單與筆數

實測 SQLite 檔內共 **288 張表**（含 Payload 對 array/relationship 欄位正規化出的子表），總筆數 **69,527 筆**。完整逐表清單附於本檔案末尾。

**前 10 大表**（依筆數）：

| 表名 | 筆數 | 說明 |
|---|---|---|
| `media` | 21,962 | 媒體庫（**僅 DB metadata 列，實體檔案在 R2**，見第3節） |
| `products_images` | 20,573 | 商品圖片關聯（array 子表） |
| `blog_posts_rels` | 5,335 | 部落格文章關聯表 |
| `products_variants` | 4,547 | 商品規格變體 |
| `behavior_events` | 4,405 | 行為追蹤事件 |
| `products_tags` | 3,646 | 商品標籤關聯 |
| `products_personality_types` | 2,233 | 商品人格特質關聯 |
| `daily_horoscopes` | 1,698 | 每日星座運勢 |
| `products` | 1,395 | 商品主表 |
| `payload_folders` | 1,271 | 媒體資料夾 |

多數其餘表為 0-200 筆等級，遷移量體不大，主要風險集中在上述前 10 大表的關聯完整性核對（DoD 第3項「隨機20筆products關聯抽查」正是針對 `products_images`／`products_variants`／`products_tags` 這幾張大子表）。

## 3. 媒體儲存策略

`src/payload.config.ts` 已條件式啟用 `@payloadcms/storage-s3`（R2 相容）：`r2Configured` 為真時，媒體實體檔案走 Cloudflare R2（`https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com`），Payload 的 `media` collection 只存 metadata（檔名、alt、尺寸等）。

**確認**：PG 遷移範圍**僅搬 `media` 表等 21,962 筆 metadata 列**，實體圖片檔完全不動（本來就不在 SQLite 裡）。與工單假設一致，不需要額外的檔案搬移步驟。

## 4. JSON／richText／array 型別轉換風險點

SQLite 沒有原生 JSON/richText 型別，Payload 在 SQLite adapter 下這兩種欄位都存成 TEXT（JSON 字串）；換到 PostgreSQL adapter 後，Payload 自己的 migration 會建成 `jsonb` 欄位——**型別轉換由 Payload/drizzle 的 schema 生成器負責，不需要手動處理欄位型別**，但資料搬移腳本（Prompt P2）仍需對這些欄位做「parse 後正確寫入 jsonb」而非整段字串複製，才不會變成雙重序列化。

**含 richText 欄位的 collections（8）**：`BlogPosts`、`Bundles`、`Conversations`、`MessageTemplates`、`Messages`、`Pages`、`Podcasts`、`Products`
**含 richText 欄位的 globals（3）**：`AboutPageSettings`、`FAQPageSettings`、`PolicyPagesSettings`

**含 json 欄位的 collections（25）**：`AutomationJourneys`、`AutomationLogs`、`BehaviorEvents`、`BirthdayCampaigns`、`CardBattles`、`ConciergeServiceRequests`、`Conversations`、`ConversationActivities`、`CreditScoreHistory`、`CustomerServiceTickets`、`EmailTemplates`、`Invoices`、`MarketingContentDrafts`、`MarketingExecutionLogs`、`MessageTemplates`、`Messages`、`MiniGameRecords`、`Orders`、`PromotionApplications`、`SearchConsoleKeywords`、`StyleGameRooms`、`StyleSubmissions`、`StyleVotes`、`StyleWishes`、`Users`
**含 json 欄位的 globals**：無

**含 array 欄位的 collections**：54 個（絕大多數——array 欄位在 SQLite 已經正規化成獨立子表，如上表所見的 `_variants`／`_tags`／`_rels` 等，PG 遷移對這些本身結構沒有額外風險，子表本來就是獨立 table，drizzle 定義一致即可）。

**風險最集中**：`products`（richText＋json 皆有：description 用 richText，部分設定用 json）、`Orders`（json：affiliateInfo/attribution 等巢狀結構）、`Users`（json 欄位）——這 3 個表資料量與業務關鍵度都高，Prompt P2 的「20筆深度比對」建議至少涵蓋這 3 個表各抽驗一輪，不只 products。

## 5. 記憶體與硬體現況（Hetzner CPX22）

```
Mem:  total 3.7Gi / used 948Mi / free 2.6Gi / available 2.8Gi
Swap: total 2.0Gi / used 150Mi
CPU:  2 vCPU
Disk: 75G total / 42G used / 31G available (58%)
```

pm2 行程記憶體佔用：`chickimmiu-nextjs` 73MB、`ckmu-operation-os` 39MB——現況非常輕量（低流量封測期）。PostgreSQL 16 **尚未安裝**。

**評估**：可用記憶體 2.8GB，遠高於工單 DoD 訂的 800MB 門檻，**現階段不需要升級 CPX32**。但目前的輕量佔用是封測期低流量下的快照，PG16 自己的 `shared_buffers`（Prompt P3 規劃 512MB）＋ Next.js＋PM2 三個服務同時在 4GB 機器上，於真實流量（尤其未來 www 切換後）下的實際餘裕需要 Phase 2/3 上線後現場監控一週，若吃緊再升級（Alan 已在工單原始風險表註記「月費小錢，不提前優化」）。

## 6. 結論與下一步

- 版本齊全，`@payloadcms/db-postgres` 已預先裝好，Phase 1 不需要額外裝套件。
- 表數量／筆數量體皆在可控範圍（69,527 筆，最大表 media 2.2萬筆），沒有發現異常巨量表。
- 媒體檔案本來就在 R2，PG 遷移範圍單純（只搬 DB 列）。
- richText/json 型別轉換風險點已列清單，Prompt P2 的資料搬移腳本需對這些欄位做正確的 parse-then-insert，而非字串直接複製。
- 記憶體現況充裕，不建議現在升級 CPX32。

**依 Prompt P1 明文「輸出 docs/db/PG-PHASE0-AUDIT.md，停下等我確認」——本步驟到此為止，不自動進入 Phase 1（Prompt P2 建置與資料搬移）。等 Alan 看過本報告、確認要繼續，再說「下一步」即可觸發 Phase 1。**

---

## 附錄：全表筆數清單（288 張表）

<details>
<summary>展開查看完整清單</summary>

```
ab_tests|0
ab_tests_variants|0
about_page_settings|1
about_page_settings_brand_values|6
about_page_settings_contact_cta_buttons|3
about_page_settings_legacy_gallery_images|0
about_page_settings_timeline|5
ad_audiences|0
ad_audiences_rels|0
add_on_products|3
add_on_products_rels|0
ads_catalog_settings|1
affiliates|0
affiliates_withdrawal_requests|0
automation_journeys|14
automation_journeys_steps|36
automation_logs|14
behavior_events|4405
birthday_campaigns|0
birthday_campaigns_phases_phase1_channels|0
birthday_campaigns_phases_phase2_channels|0
birthday_campaigns_phases_phase3_channels|0
birthday_campaigns_phases_phase3_recommended_products|0
birthday_campaigns_phases_phase4_channels|0
birthday_campaigns_phases_phase5_channels|0
blog_categories|19
blog_posts|104
blog_posts_article_studio_research_sources|3
blog_posts_rels|5335
blog_posts_tags|120
bundles|0
bundles_items|0
card_battles|0
categories|135
celebrity_features|18
celebrity_features_gallery_images|159
celebrity_features_social_links|1
checkout_settings|1
collectible_card_events|3
collectible_card_templates|0
collectible_cards|3
collections_page_settings|1
collections_page_settings_cards|7
collections_page_settings_cards_collection_tags_filter|9
competitor_price_records|0
competitor_price_records_flags|0
concierge_service_requests|0
concierge_service_requests_concierge_notes|0
concierge_service_requests_request_detail_attachments|0
conversation_activities|0
conversations|4
conversations_rels|0
coupon_redemptions|0
coupons|2
coupons_rels|0
credit_score_history|15
crm_settings|0
cs_settings|0
cs_settings_anti_spam_blocked_anon_ids|0
cs_settings_anti_spam_blocked_i_ps|0
cs_settings_anti_spam_blocked_keywords|0
cs_settings_business_hours_holidays|0
cs_settings_business_hours_schedule|0
cs_settings_sla_first_response_minutes|0
cs_settings_sla_resolution_hours|0
currencies|0
customer_service_tickets|1
customer_service_tickets_messages|1
daily_horoscopes|1698
email_templates|12
exchanges|0
exchanges_items|0
faq_page_settings|1
faq_page_settings_categories|6
faq_page_settings_categories_items|22
festival_templates|0
festival_templates_ab_test_variants|0
festival_templates_linked_journeys|0
festival_templates_phases|0
festival_templates_phases_channels|0
festival_templates_segment_offers|0
game_leaderboard|0
game_leaderboard_badges|0
game_settings|1
game_settings_scratch_card_prizes|0
game_settings_spin_wheel_prizes|0
gift_rules|0
gift_rules_rels|0
global_settings|1
global_settings_ai_seo_faq_for_ai|0
global_settings_app_links_features|0
global_settings_payment_enabled_methods|3
homepage_settings|1
homepage_settings_hero_banners|3
homepage_settings_quick_menu|4
homepage_settings_service_highlights|4
homepage_settings_style_journal_section_manual_posts|0
inventory_transactions|14
invoice_settings|1
invoice_settings_automation_config_notify_channels|1
invoices|3
invoices_invoice_items|3
login_attempts|146
loyalty_settings|1
loyalty_settings_recommendation_config_placements|1
marketing_automation_settings|0
marketing_automation_settings_birthday_config_tier_gifts|0
marketing_campaigns|1
marketing_campaigns_ab_test_config_split_ratio|0
marketing_campaigns_channels|0
marketing_campaigns_commerce_surfaces|5
marketing_campaigns_message_templates|0
marketing_campaigns_target_segments|0
marketing_campaigns_tier_filter|0
marketing_content_drafts|14
marketing_content_drafts_channels|17
marketing_execution_logs|0
media|21962
member_segments|14
member_segments_auto_tags|18
member_segments_history|15
membership_tiers|6
message_tags|0
message_templates|6
message_templates_credit_score_variants|0
message_templates_segment_variants|0
message_templates_tags|0
message_templates_tier_variants|0
message_templates_variables|0
messages|20
messages_attachments|0
mini_game_records|163
mkt_fest_channels|0
navigation_settings|1
navigation_settings_footer_sections|2
navigation_settings_footer_sections_links|16
navigation_settings_main_menu|8
navigation_settings_main_menu_children|11
newsletter_subscribers|0
order_settings|1
order_settings_notifications_admin_alert_emails|1
order_settings_status_flow_custom_statuses|0
orders|9
orders_gifts|0
orders_items|9
packaging_page_settings|0
packaging_page_settings_features_items|0
packaging_page_settings_process_steps|0
pages|6
pages_blocks_celebrity_grid|1
pages_blocks_countdown|0
pages_blocks_cta|5
pages_blocks_divider|4
pages_blocks_editorial_spread|2
pages_blocks_editorial_spread_rows|6
pages_blocks_faq|4
pages_blocks_faq_questions|13
pages_blocks_hero_banner|4
pages_blocks_image_gallery|2
pages_blocks_image_gallery_images|12
pages_blocks_kol_persona|0
pages_blocks_kol_persona_social_links|0
pages_blocks_lookbook_grid|0
pages_blocks_lookbook_grid_items|0
pages_blocks_lookbook_grid_items_tags|0
pages_blocks_magazine_cover|3
pages_blocks_magazine_cover_corner_labels|4
pages_blocks_product_showcase|3
pages_blocks_pull_quote|3
pages_blocks_rich_content|7
pages_blocks_testimonial|2
pages_blocks_testimonial_testimonials|6
pages_blocks_video|0
pages_rels|12
payload_folders|1271
payload_folders_folder_type|3
payload_kv|0
payload_locked_documents|3
payload_locked_documents_rels|5
payload_migrations|99
payload_preferences|119
payload_preferences_rels|119
podcasts|0
podcasts_hosts|0
podcasts_rels|0
podcasts_sources|0
podcasts_tags|0
point_redemption_settings|0
point_redemption_settings_boost_events|0
point_redemption_settings_expiry_notification_reminder_days|0
point_redemption_settings_rels|0
point_redemption_settings_ugc_testimonials_items|0
points_redemptions|2
points_redemptions_lottery_config_prizes|0
points_transactions|93
policy_pages_settings|1
policy_pages_settings_account_returns_notice_items|0
policy_pages_settings_privacy_policy_sections|8
policy_pages_settings_privacy_policy_sections_items|14
policy_pages_settings_return_policy_sections|9
policy_pages_settings_return_policy_sections_items|25
policy_pages_settings_shopping_guide_sections|4
policy_pages_settings_shopping_guide_sections_items|14
policy_pages_settings_terms_sections|8
policy_pages_settings_terms_sections_items|9
pricing_formula_settings|0
prize_pools|0
prize_pools_eligible_games|0
product_list_settings|0
product_list_settings_page_size_options|0
product_reviews|0
product_reviews_photos|0
product_view_events|137
products|1395
products_alias_slugs|0
products_collection_tags|197
products_images|20573
products_material_images|0
products_personality_types|2233
products_rels|0
products_tags|3646
products_variants|4547
promotion_applications|0
promotion_rules|1
promotion_rules_conditions_channels|0
promotion_rules_conditions_segments_not_in|1
promotion_rules_rels|0
promotion_rules_scope_exclude_tags|1
promotion_rules_scope_include_tags|0
promotion_rules_stacking_stackable_with|0
promotion_settings|0
purchase_orders|0
purchase_orders_items|0
recommendation_settings|0
referral_settings|0
refunds|0
refunds_items|0
returns|0
returns_items|0
returns_photos|0
search_console_keywords|0
segmentation_settings|0
segmentation_settings_segment_colors|0
shipping_methods|8
shipping_methods_regions|10
shipping_methods_tracking_flow|40
site_themes|5
size_charts|1
size_charts_measurements|2
size_charts_rows|2
size_charts_rows_values|4
stock_takes|0
stock_takes_items|0
style_game_rooms|0
style_game_rooms_participants|0
style_submissions|0
style_submissions_images|0
style_submissions_tags|0
style_votes|0
style_wishes|0
style_wishes_grants|0
style_wishes_reference_photos|0
subscription_plans|3
subscription_plans_dopamine_streak_milestones|12
subscription_plans_feature_list|30
tax_settings|0
tax_settings_tax_categories|0
ugc_posts|5
ugc_posts_display_locations|5
ugc_posts_hashtags|10
ugc_posts_media_items|0
ugc_posts_rels|4
user_rewards|11
user_subscriptions|3
user_subscriptions_auth_log|3
users|14
users_addresses|6
users_ai_dm_preferences_dm_history|0
users_game_activity_recent_games|0
users_invoice_profiles|0
users_notification_preferences_channels|30
users_rels|0
users_sessions|22
users_tags|0
utm_campaigns|0
wallet_transactions|7
wallet_withdrawals|0
wishlist_items|0
```

</details>
