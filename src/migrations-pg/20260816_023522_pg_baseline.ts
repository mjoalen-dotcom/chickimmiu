import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."mkt_fest_channels" AS ENUM('line', 'email', 'sms', 'push', 'in_app_popup', 'edm');
  CREATE TYPE "public"."enum_blog_posts_article_studio_research_sources_provider" AS ENUM('official', 'wikipedia', 'wikidata', 'manual');
  CREATE TYPE "public"."enum_blog_posts_category" AS ENUM('styling', 'new-arrivals', 'brand-story', 'promotions', 'trends', 'fashion', 'beauty', 'shopping', 'food', 'lifestyle', 'parenting', 'travel', 'kpop-boy-groups', 'kpop-girl-groups');
  CREATE TYPE "public"."enum_blog_posts_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_blog_posts_visibility" AS ENUM('public', 'unlisted', 'password');
  CREATE TYPE "public"."enum_blog_posts_article_studio_template_key" AS ENUM('fashion', 'kpop-boy-group', 'kpop-girl-group');
  CREATE TYPE "public"."enum_blog_categories_site" AS ENUM('store', 'kim');
  CREATE TYPE "public"."enum_blog_categories_value" AS ENUM('styling', 'new-arrivals', 'brand-story', 'promotions', 'trends', 'fashion', 'beauty', 'shopping', 'food', 'lifestyle', 'parenting', 'travel', 'kpop-boy-groups', 'kpop-girl-groups');
  CREATE TYPE "public"."enum_orders_status" AS ENUM('pending', 'processing', 'shipped', 'delivered', 'returned', 'cancelled', 'refunded');
  CREATE TYPE "public"."enum_orders_payment_method" AS ENUM('paypal', 'ecpay', 'newebpay', 'linepay', 'cash_cod', 'cash_meetup');
  CREATE TYPE "public"."enum_orders_payment_status" AS ENUM('unpaid', 'paid', 'refunding', 'refunded');
  CREATE TYPE "public"."enum_orders_affiliate_info_commission_status" AS ENUM('pending', 'confirmed', 'paid', 'cancelled');
  CREATE TYPE "public"."enum_invoices_invoice_items_item_tax_type" AS ENUM('taxable', 'zero_tax', 'tax_free');
  CREATE TYPE "public"."enum_invoices_invoice_type" AS ENUM('b2c_personal', 'b2c_carrier', 'b2b', 'donation');
  CREATE TYPE "public"."enum_invoices_status" AS ENUM('pending', 'issued', 'void', 'allowance', 'failed', 'retry');
  CREATE TYPE "public"."enum_invoices_carrier_info_carrier_type" AS ENUM('none', 'phone_barcode', 'natural_cert', 'ecpay_member');
  CREATE TYPE "public"."enum_invoices_tax_type" AS ENUM('taxable', 'zero_tax', 'mixed');
  CREATE TYPE "public"."enum_returns_items_reason" AS ENUM('defective', 'wrong_size', 'color_mismatch', 'wrong_item', 'not_wanted', 'other');
  CREATE TYPE "public"."enum_returns_status" AS ENUM('pending', 'approved', 'returning', 'received', 'refunded', 'rejected', 'cancelled');
  CREATE TYPE "public"."enum_returns_refund_method" AS ENUM('original', 'credit', 'bank_transfer');
  CREATE TYPE "public"."enum_exchanges_items_reason" AS ENUM('wrong_size', 'color_mismatch', 'defective', 'other');
  CREATE TYPE "public"."enum_exchanges_status" AS ENUM('pending', 'approved', 'returning', 'received', 'shipped', 'completed', 'rejected');
  CREATE TYPE "public"."enum_refunds_type" AS ENUM('full', 'partial', 'allowance', 'defect_compensation');
  CREATE TYPE "public"."enum_refunds_reason" AS ENUM('customer_cancel', 'defective', 'not_as_described', 'shipping_issue', 'duplicate_order', 'price_adjustment', 'other');
  CREATE TYPE "public"."enum_refunds_refund_method" AS ENUM('original_payment', 'store_credit', 'bank_transfer');
  CREATE TYPE "public"."enum_refunds_status" AS ENUM('pending', 'approved', 'processing', 'refunded', 'rejected');
  CREATE TYPE "public"."enum_shipping_methods_regions" AS ENUM('taiwan', 'offshore', 'international');
  CREATE TYPE "public"."enum_shipping_methods_carrier" AS ENUM('hct', 'tcat', '711', 'family', 'hilife', 'ok', 'post', 'meetup', 'dhl', 'fedex', 'other');
  CREATE TYPE "public"."enum_products_alias_slugs_source" AS ENUM('manual', 'shopline', 'csv', 'other');
  CREATE TYPE "public"."enum_products_collection_tags" AS ENUM('jin-live', 'jin-style', 'host-style', 'brand-custom', 'formal-dresses', 'rush', 'celebrity-style', 'korean-celebrity');
  CREATE TYPE "public"."enum_products_images_category" AS ENUM('cover', 'front', 'back', 'side', 'detail', 'model', 'styling', 'size_chart', 'other');
  CREATE TYPE "public"."enum_products_personality_types" AS ENUM('INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP');
  CREATE TYPE "public"."enum_products_status" AS ENUM('draft', 'published', 'archived');
  CREATE TYPE "public"."enum_products_image_migration_status" AS ENUM('pending', 'in_progress', 'done', 'failed', 'skipped');
  CREATE TYPE "public"."enum_products_auto_pricing_cost_currency_code" AS ENUM('KRW', 'JPY', 'USD', 'CNY');
  CREATE TYPE "public"."enum_products_tax_category" AS ENUM('standard', 'reduced', 'exempt', 'zero_rated');
  CREATE TYPE "public"."enum_products_ads_gender" AS ENUM('female', 'male', 'unisex');
  CREATE TYPE "public"."enum_products_ads_age_group" AS ENUM('adult', 'teen', 'kids', 'toddler', 'infant', 'newborn');
  CREATE TYPE "public"."enum_products_ads_condition" AS ENUM('new', 'refurbished', 'used');
  CREATE TYPE "public"."enum_categories_level" AS ENUM('1', '2', '3');
  CREATE TYPE "public"."enum_size_charts_category" AS ENUM('top', 'bottom', 'dress', 'outerwear', 'jumpsuit', 'swimwear', 'innerwear', 'accessory', 'other');
  CREATE TYPE "public"."enum_size_charts_unit" AS ENUM('cm', 'inch');
  CREATE TYPE "public"."enum_product_reviews_status" AS ENUM('pending', 'approved', 'rejected');
  CREATE TYPE "public"."enum_inventory_transactions_type" AS ENUM('purchase_in', 'sale_out', 'return_in', 'stocktake', 'adjust', 'transfer');
  CREATE TYPE "public"."enum_purchase_orders_status" AS ENUM('draft', 'ordered', 'received', 'cancelled');
  CREATE TYPE "public"."enum_stock_takes_status" AS ENUM('draft', 'completed', 'cancelled');
  CREATE TYPE "public"."enum_users_notification_preferences_channels" AS ENUM('web', 'line', 'fb', 'ig', 'email', 'phone', 'web_form');
  CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'operator', 'partner', 'customer');
  CREATE TYPE "public"."enum_users_gender" AS ENUM('female', 'male', 'other');
  CREATE TYPE "public"."enum_users_signup_source" AS ENUM('shopline', 'organic', 'line', 'facebook', 'google', 'referral', 'admin');
  CREATE TYPE "public"."enum_users_credit_status" AS ENUM('excellent', 'normal', 'watchlist', 'warning', 'blacklist', 'suspended');
  CREATE TYPE "public"."enum_users_service_level" AS ENUM('standard', 'priority', 'vip');
  CREATE TYPE "public"."enum_users_body_profile_body_shape" AS ENUM('petite', 'standard', 'curvy', 'pear', 'apple', 'hourglass', 'athletic');
  CREATE TYPE "public"."enum_users_mbti_profile_mbti_type" AS ENUM('INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP');
  CREATE TYPE "public"."enum_users_mbti_profile_primary_occasion" AS ENUM('urban', 'vacation', 'party', 'cozy');
  CREATE TYPE "public"."enum_users_ai_dm_preferences_dm_channel" AS ENUM('email', 'line', 'sms', 'all');
  CREATE TYPE "public"."enum_member_segments_current_segment" AS ENUM('VIP1', 'VIP2', 'POT1', 'REG1', 'REG2', 'RISK1', 'RISK2', 'NEW1', 'SLP1', 'BLK1');
  CREATE TYPE "public"."enum_user_subscriptions_status" AS ENUM('pending', 'active', 'cancelled', 'expired');
  CREATE TYPE "public"."enum_user_subscriptions_billing_cycle" AS ENUM('monthly', 'yearly');
  CREATE TYPE "public"."enum_points_transactions_type" AS ENUM('earn', 'redeem', 'expire', 'admin_adjust', 'refund_deduct');
  CREATE TYPE "public"."enum_points_transactions_source" AS ENUM('purchase', 'review', 'referral', 'birthday', 'monthly_bonus', 'game', 'redemption', 'order_refund', 'admin', 'points_expiry', 'welcome', 'tier_upgrade', 'card_burn', 'kim_blog_read');
  CREATE TYPE "public"."enum_points_redemptions_type" AS ENUM('physical', 'movie_ticket', 'coupon', 'discount_code', 'store_credit', 'lottery', 'addon_deal', 'free_shipping', 'experience', 'styling', 'charity', 'mystery');
  CREATE TYPE "public"."enum_points_redemptions_coupon_config_discount_type" AS ENUM('fixed', 'percentage', 'free_shipping');
  CREATE TYPE "public"."enum_points_redemptions_physical_config_reward_type_override" AS ENUM('gift_physical', 'movie_ticket_physical');
  CREATE TYPE "public"."enum_user_rewards_reward_type" AS ENUM('free_shipping_coupon', 'movie_ticket_physical', 'movie_ticket_digital', 'coupon', 'gift_physical', 'badge', 'voucher');
  CREATE TYPE "public"."enum_user_rewards_state" AS ENUM('unused', 'pending_attach', 'shipped', 'consumed', 'expired');
  CREATE TYPE "public"."enum_credit_score_history_reason" AS ENUM('purchase', 'on_time_delivery', 'good_review', 'photo_review', 'referral_success', 'first_register', 'first_purchase', 'birthday_bonus', 'subscriber_bonus', 'return_general', 'return_no_reason', 'return_malicious', 'return_rate_penalty', 'abandoned_cart', 'malicious_cancel', 'admin_adjustment', 'monthly_decay', 'good_customer_reward');
  CREATE TYPE "public"."enum_wallet_transactions_wallet" AS ENUM('shoppingCredit', 'storedValue');
  CREATE TYPE "public"."enum_wallet_transactions_type" AS ENUM('earn', 'spend', 'redeem', 'refund', 'withdraw', 'withdraw_refund', 'expire', 'admin_adjust');
  CREATE TYPE "public"."enum_wallet_transactions_source" AS ENUM('signup', 'redemption', 'game', 'birthday', 'referral', 'subscription', 'order', 'order_refund', 'topup', 'withdrawal', 'withdrawal_refund', 'admin', 'other');
  CREATE TYPE "public"."enum_wallet_withdrawals_status" AS ENUM('pending', 'approved', 'paid', 'rejected', 'cancelled');
  CREATE TYPE "public"."enum_conversations_channel" AS ENUM('web', 'line', 'fb', 'ig', 'email', 'phone', 'web_form');
  CREATE TYPE "public"."enum_conversations_status" AS ENUM('open', 'pending', 'resolved', 'closed', 'ai_handling', 'awaiting_customer', 'spam');
  CREATE TYPE "public"."enum_conversations_priority" AS ENUM('low', 'normal', 'high', 'urgent');
  CREATE TYPE "public"."enum_conversations_category" AS ENUM('order_inquiry', 'shipping_status', 'return_exchange', 'size_advice', 'points_inquiry', 'credit_score', 'product_recommendation', 'coupon_inquiry', 'tier_upgrade', 'complaint', 'meetup', 'other');
  CREATE TYPE "public"."enum_conversations_sentiment" AS ENUM('positive', 'neutral', 'negative', 'angry');
  CREATE TYPE "public"."enum_messages_attachments_kind" AS ENUM('image', 'video', 'audio', 'sticker', 'file', 'location');
  CREATE TYPE "public"."enum_messages_direction" AS ENUM('in', 'out');
  CREATE TYPE "public"."enum_messages_sender" AS ENUM('customer', 'staff', 'ai', 'system');
  CREATE TYPE "public"."enum_message_tags_color" AS ENUM('gray', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink');
  CREATE TYPE "public"."enum_conversation_activities_actor_type" AS ENUM('staff', 'customer', 'ai', 'system', 'webhook');
  CREATE TYPE "public"."enum_conversation_activities_type" AS ENUM('conversation_opened', 'field_changed', 'assignment_changed', 'status_changed', 'tag_added', 'tag_removed', 'conversations_merged', 'conversation_split', 'message_edited', 'message_deleted', 'escalated', 'sla_breached', 'ai_replied', 'csat_submitted', 'reopened');
  CREATE TYPE "public"."enum_product_view_events_device_type" AS ENUM('mobile', 'tablet', 'desktop', 'other');
  CREATE TYPE "public"."enum_behavior_events_event_type" AS ENUM('pageview', 'product_view', 'click', 'search', 'add_to_cart', 'remove_from_cart', 'wishlist_add', 'wishlist_remove', 'checkout_start', 'purchase', 'scroll', 'dwell', 'campaign_exposed', 'campaign_clicked', 'campaign_eligible', 'campaign_ineligible', 'progress_viewed', 'reward_unlocked', 'promotion_applied', 'promotion_rejected');
  CREATE TYPE "public"."enum_behavior_events_device_type" AS ENUM('mobile', 'tablet', 'desktop', 'other');
  CREATE TYPE "public"."enum_behavior_events_surface" AS ENUM('home', 'plp', 'pdp', 'cart', 'checkout', 'member', 'complete', 'other');
  CREATE TYPE "public"."enum_coupons_discount_type" AS ENUM('percentage', 'fixed', 'free_shipping');
  CREATE TYPE "public"."enum_gift_rules_trigger_type" AS ENUM('min_amount', 'product_in_cart');
  CREATE TYPE "public"."enum_marketing_campaigns_target_segments" AS ENUM('VIP1', 'VIP2', 'POT1', 'REG1', 'REG2', 'RISK1', 'RISK2', 'NEW1', 'SLP1', 'BLK1', 'all');
  CREATE TYPE "public"."enum_marketing_campaigns_tier_filter" AS ENUM('ordinary', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'all');
  CREATE TYPE "public"."enum_marketing_campaigns_channels" AS ENUM('line', 'email', 'sms', 'push', 'in_app_popup', 'edm');
  CREATE TYPE "public"."enum_marketing_campaigns_message_templates_channel" AS ENUM('line', 'email', 'sms', 'push', 'in_app_popup', 'edm');
  CREATE TYPE "public"."enum_marketing_campaigns_commerce_surfaces" AS ENUM('home', 'plp', 'pdp', 'cart', 'checkout', 'member', 'complete');
  CREATE TYPE "public"."enum_marketing_campaigns_campaign_type" AS ENUM('flash_sale', 'festival', 'new_product_launch', 'membership_upgrade', 'clearance', 'ugc_contest', 'referral_boost', 'loyalty_event', 'seasonal', 'custom');
  CREATE TYPE "public"."enum_marketing_campaigns_status" AS ENUM('draft', 'review', 'approved', 'scheduled', 'active', 'paused', 'ended', 'completed', 'cancelled', 'archived');
  CREATE TYPE "public"."enum_marketing_campaigns_ab_test_config_winner_metric" AS ENUM('open_rate', 'click_rate', 'conversion_rate', 'revenue');
  CREATE TYPE "public"."enum_marketing_campaigns_commerce_objective" AS ENUM('conversion', 'aov', 'clearance', 'repurchase', 'activation', 'kol', 'discovery');
  CREATE TYPE "public"."enum_promotion_rules_conditions_segments_not_in" AS ENUM('VIP1', 'VIP2', 'POT1', 'REG1', 'REG2', 'RISK1', 'RISK2', 'NEW1', 'SLP1', 'BLK1');
  CREATE TYPE "public"."enum_promotion_rules_conditions_channels" AS ENUM('web', 'app', 'line');
  CREATE TYPE "public"."enum_promotion_rules_stacking_stackable_with" AS ENUM('item_promo', 'order_promo', 'shipping', 'coupon', 'member_tier');
  CREATE TYPE "public"."enum_promotion_rules_status" AS ENUM('draft', 'active', 'disabled');
  CREATE TYPE "public"."enum_promotion_rules_benefit_class" AS ENUM('item_promo', 'order_promo', 'shipping');
  CREATE TYPE "public"."enum_promotion_rules_effect_effect_type" AS ENUM('fixed_discount_per_group', 'percent_discount_per_group', 'percent_discount_nth_unit', 'order_fixed_discount', 'order_percent_discount', 'free_shipping', 'gift_item', 'points_multiplier', 'grant_reward');
  CREATE TYPE "public"."enum_promotion_rules_effect_repeat_mode" AS ENUM('once_per_order', 'every_full_group');
  CREATE TYPE "public"."enum_promotion_rules_effect_unit_selection" AS ENUM('cheapest_first', 'most_expensive_first');
  CREATE TYPE "public"."enum_promotion_applications_source" AS ENUM('campaign_rule', 'coupon');
  CREATE TYPE "public"."enum_promotion_applications_status" AS ENUM('applied', 'reversed');
  CREATE TYPE "public"."enum_festival_templates_phases_channels" AS ENUM('line', 'email', 'sms', 'push', 'in_app_popup', 'edm');
  CREATE TYPE "public"."enum_festival_templates_phases_phase_type" AS ENUM('warmup', 'peak', 'followup');
  CREATE TYPE "public"."enum_festival_templates_segment_offers_segment" AS ENUM('VIP1', 'VIP2', 'POT1', 'REG1', 'REG2', 'RISK1', 'RISK2', 'NEW1', 'SLP1', 'BLK1', 'default');
  CREATE TYPE "public"."enum_festival_templates_segment_offers_discount_type" AS ENUM('percentage', 'fixed', 'points_multiplier', 'free_shipping', 'gift');
  CREATE TYPE "public"."enum_festival_templates_festival_type" AS ENUM('valentines', 'mothers_day', 'womens_day', 'dragon_boat', 'mid_autumn', 'double_eleven', 'black_friday', 'christmas_newyear', 'birthday_month', 'seasonal_launch', 'custom');
  CREATE TYPE "public"."enum_festival_templates_ai_recommendation_strategy" AS ENUM('trending', 'personalized', 'bestseller', 'complementary');
  CREATE TYPE "public"."enum_birthday_campaigns_phases_phase1_channels" AS ENUM('line', 'email', 'push', 'in_app_popup');
  CREATE TYPE "public"."enum_birthday_campaigns_phases_phase2_channels" AS ENUM('line', 'email', 'push', 'in_app_popup');
  CREATE TYPE "public"."enum_birthday_campaigns_phases_phase3_channels" AS ENUM('line', 'email', 'push', 'in_app_popup');
  CREATE TYPE "public"."enum_birthday_campaigns_phases_phase4_channels" AS ENUM('line', 'email', 'push', 'in_app_popup');
  CREATE TYPE "public"."enum_birthday_campaigns_phases_phase5_channels" AS ENUM('line', 'email', 'push', 'in_app_popup');
  CREATE TYPE "public"."enum_birthday_campaigns_status" AS ENUM('scheduled', 'phase1_preview', 'phase2_greeting', 'phase3_midmonth', 'phase4_countdown', 'phase5_followup', 'completed', 'cancelled');
  CREATE TYPE "public"."enum_birthday_campaigns_phases_phase1_status" AS ENUM('pending', 'sent', 'skipped');
  CREATE TYPE "public"."enum_birthday_campaigns_phases_phase2_status" AS ENUM('pending', 'sent', 'skipped');
  CREATE TYPE "public"."enum_birthday_campaigns_phases_phase3_status" AS ENUM('pending', 'sent', 'skipped');
  CREATE TYPE "public"."enum_birthday_campaigns_phases_phase4_status" AS ENUM('pending', 'sent', 'skipped');
  CREATE TYPE "public"."enum_birthday_campaigns_phases_phase5_status" AS ENUM('pending', 'sent', 'skipped');
  CREATE TYPE "public"."enum_automation_journeys_steps_action" AS ENUM('send_line', 'send_email', 'send_sms', 'wait', 'condition_check', 'add_tag', 'remove_tag', 'update_field', 'assign_coupon');
  CREATE TYPE "public"."enum_automation_journeys_trigger_type" AS ENUM('event', 'schedule', 'condition');
  CREATE TYPE "public"."enum_automation_journeys_trigger_event" AS ENUM('user_registered', 'first_purchase', 'order_placed', 'cart_abandoned', 'tier_upgraded', 'tier_gap_reminder', 'dormant_30d', 'dormant_45d', 'dormant_60d', 'birthday_month', 'new_product_launch', 'vip_care', 'points_expiring', 'credit_score_changed', 'credit_low_60', 'credit_low_30', 'consecutive_returns', 'good_customer');
  CREATE TYPE "public"."enum_automation_logs_status" AS ENUM('triggered', 'in_progress', 'completed', 'failed', 'skipped');
  CREATE TYPE "public"."enum_ab_tests_status" AS ENUM('draft', 'running', 'completed', 'cancelled');
  CREATE TYPE "public"."enum_ab_tests_winner_metric" AS ENUM('open_rate', 'click_rate', 'conversion_rate', 'revenue');
  CREATE TYPE "public"."enum_marketing_execution_logs_channel" AS ENUM('line', 'email', 'sms', 'push', 'in_app_popup', 'edm');
  CREATE TYPE "public"."enum_marketing_execution_logs_status" AS ENUM('pending', 'sent', 'delivered', 'opened', 'clicked', 'converted', 'bounced', 'failed', 'unsubscribed');
  CREATE TYPE "public"."enum_message_templates_variables_variable_type" AS ENUM('user_name', 'tier_front_name', 'credit_score', 'points_balance', 'segment_label', 'product_name', 'discount_code', 'custom');
  CREATE TYPE "public"."enum_message_templates_segment_variants_segment" AS ENUM('VIP1', 'VIP2', 'POT1', 'REG1', 'REG2', 'RISK1', 'RISK2', 'NEW1', 'SLP1', 'BLK1', 'default');
  CREATE TYPE "public"."enum_message_templates_tier_variants_tier_code" AS ENUM('ordinary', 'bronze', 'silver', 'gold', 'platinum', 'diamond');
  CREATE TYPE "public"."enum_message_templates_channel" AS ENUM('line', 'email', 'sms', 'push', 'in_app_popup', 'edm');
  CREATE TYPE "public"."enum_message_templates_category" AS ENUM('promotional', 'transactional', 'lifecycle', 'festival', 'credit_score', 'tier_upgrade', 'points_reminder', 'welcome', 'winback', 'custom');
  CREATE TYPE "public"."enum_email_templates_event_key" AS ENUM('welcome', 'order_confirmation', 'payment_received', 'order_shipped', 'order_delivered', 'order_cancelled', 'order_refunded', 'subscription_receipt', 'subscription_cancelled', 'admin_new_order', 'auth_verify', 'auth_forgot_password');
  CREATE TYPE "public"."enum_newsletter_subscribers_status" AS ENUM('subscribed', 'unsubscribed');
  CREATE TYPE "public"."enum_newsletter_subscribers_source" AS ENUM('homepage', 'footer', 'checkout', 'popup', 'import', 'kim-blog', 'other');
  CREATE TYPE "public"."enum_utm_campaigns_source" AS ENUM('facebook', 'instagram', 'google', 'line', 'youtube', 'tiktok', 'email', 'sms', 'direct', 'affiliate', 'other');
  CREATE TYPE "public"."enum_utm_campaigns_medium" AS ENUM('cpc', 'cpm', 'social', 'email', 'sms', 'referral', 'organic', 'display', 'influencer', 'other');
  CREATE TYPE "public"."enum_utm_campaigns_status" AS ENUM('planning', 'active', 'paused', 'ended');
  CREATE TYPE "public"."enum_ad_audiences_type" AS ENUM('viewers', 'cart_abandoners', 'purchasers', 'product_specific');
  CREATE TYPE "public"."enum_ad_audiences_sync_status" AS ENUM('idle', 'pending', 'synced', 'error');
  CREATE TYPE "public"."enum_search_console_keywords_source" AS ENUM('gsc', 'manual', 'site_search');
  CREATE TYPE "public"."enum_search_console_keywords_intent" AS ENUM('product', 'styling', 'care', 'brand', 'lifestyle', 'unknown');
  CREATE TYPE "public"."enum_search_console_keywords_status" AS ENUM('new', 'reviewing', 'applied', 'ignored');
  CREATE TYPE "public"."enum_competitor_price_records_flags" AS ENUM('high_margin', 'low_risk', 'live_suitable', 'ad_suitable', 'reorder_candidate', 'watchlist');
  CREATE TYPE "public"."enum_competitor_price_records_platform" AS ENUM('sinsang', 'naver', 'zigzag', 'ably', 'shopline', 'other');
  CREATE TYPE "public"."enum_competitor_price_records_status" AS ENUM('new', 'reviewed', 'purchased', 'rejected');
  CREATE TYPE "public"."enum_marketing_content_drafts_channels" AS ENUM('blog', 'product_page', 'email', 'reels', 'shorts', 'line', 'internal');
  CREATE TYPE "public"."enum_marketing_content_drafts_type" AS ENUM('seo_product_meta', 'product_faq', 'weekly_article', 'short_video_script', 'email_lifecycle', 'ops_summary', 'customer_reply', 'restock_advice', 'purchase_recommendation');
  CREATE TYPE "public"."enum_marketing_content_drafts_status" AS ENUM('draft', 'review', 'approved', 'scheduled', 'published', 'archived');
  CREATE TYPE "public"."enum_marketing_content_drafts_target_segment" AS ENUM('all', 'new_customer', 'repeat_customer', 'vip', 'dormant', 'internal');
  CREATE TYPE "public"."enum_customer_service_tickets_messages_sender" AS ENUM('customer', 'ai', 'agent');
  CREATE TYPE "public"."enum_customer_service_tickets_channel" AS ENUM('ai_chat', 'line', 'email', 'phone', 'web_form');
  CREATE TYPE "public"."enum_customer_service_tickets_status" AS ENUM('open', 'ai_handling', 'pending_human', 'human_handling', 'resolved', 'closed');
  CREATE TYPE "public"."enum_customer_service_tickets_priority" AS ENUM('low', 'normal', 'high', 'urgent');
  CREATE TYPE "public"."enum_customer_service_tickets_category" AS ENUM('order_inquiry', 'shipping_status', 'return_exchange', 'size_advice', 'points_inquiry', 'credit_score', 'product_recommendation', 'coupon_inquiry', 'tier_upgrade', 'complaint', 'other');
  CREATE TYPE "public"."enum_customer_service_tickets_sentiment" AS ENUM('positive', 'neutral', 'negative', 'angry');
  CREATE TYPE "public"."enum_concierge_service_requests_concierge_notes_note_type" AS ENUM('update', 'internal', 'customer_facing');
  CREATE TYPE "public"."enum_concierge_service_requests_service_type" AS ENUM('fashion_styling', 'size_consultation', 'custom_order', 'restaurant_booking', 'michelin_booking', 'event_tickets', 'flower_cake_gift', 'hotel_travel', 'private_event', 'beauty_wellness', 'driver_service', 'other');
  CREATE TYPE "public"."enum_concierge_service_requests_priority" AS ENUM('urgent', 'high', 'normal', 'low');
  CREATE TYPE "public"."enum_concierge_service_requests_status" AS ENUM('submitted', 'ai_processing', 'assigned', 'in_progress', 'pending_confirmation', 'completed', 'cancelled');
  CREATE TYPE "public"."enum_affiliates_withdrawal_requests_status" AS ENUM('pending', 'approved', 'paid', 'rejected');
  CREATE TYPE "public"."enum_affiliates_status" AS ENUM('active', 'inactive', 'suspended');
  CREATE TYPE "public"."enum_ugc_posts_display_locations" AS ENUM('homepage', 'product_page', 'campaign_page', 'ugc_gallery');
  CREATE TYPE "public"."enum_ugc_posts_platform" AS ENUM('instagram', 'facebook', 'tiktok', 'youtube', 'manual');
  CREATE TYPE "public"."enum_ugc_posts_source_type" AS ENUM('brand_post', 'user_tag', 'user_mention', 'manual_import');
  CREATE TYPE "public"."enum_ugc_posts_content_type" AS ENUM('image', 'video', 'carousel', 'reel');
  CREATE TYPE "public"."enum_ugc_posts_status" AS ENUM('pending', 'approved', 'hidden', 'rejected');
  CREATE TYPE "public"."enum_ugc_posts_display_layout" AS ENUM('grid', 'masonry', 'carousel', 'featured_feed', 'shoppable_gallery', 'shoppable_video');
  CREATE TYPE "public"."enum_prize_pools_eligible_games" AS ENUM('spin_wheel', 'scratch_card', 'movie_lottery', 'fashion_challenge', 'card_battle', 'style_pk', 'style_relay', 'weekly_challenge', 'co_create', 'blind_box', 'queen_vote', 'team_style', 'wish_pool');
  CREATE TYPE "public"."enum_prize_pools_prize_type" AS ENUM('points', 'credit', 'coupon', 'movie_ticket', 'free_shipping', 'physical_gift', 'badge', 'none');
  CREATE TYPE "public"."enum_prize_pools_delivery_method" AS ENUM('instant_credit', 'digital_coupon', 'physical_shipping', 'manual_contact');
  CREATE TYPE "public"."enum_mini_game_records_game_type" AS ENUM('spin_wheel', 'scratch_card', 'daily_checkin', 'movie_lottery', 'fashion_challenge', 'card_battle', 'style_pk', 'style_relay', 'weekly_challenge', 'co_create', 'blind_box', 'queen_vote', 'team_style', 'wish_pool', 'mbti_quiz', 'leaderboard_daily', 'leaderboard_weekly', 'leaderboard_monthly', 'leaderboard_all_time', 'leaderboard_daily_bonus', 'leaderboard_weekly_bonus', 'leaderboard_monthly_bonus');
  CREATE TYPE "public"."enum_mini_game_records_result_outcome" AS ENUM('win', 'lose', 'draw', 'completed');
  CREATE TYPE "public"."enum_mini_game_records_result_prize_type" AS ENUM('points', 'credit', 'coupon', 'badge', 'movie_ticket', 'free_shipping', 'physical_gift', 'none');
  CREATE TYPE "public"."enum_mini_game_records_status" AS ENUM('active', 'completed', 'expired', 'cancelled');
  CREATE TYPE "public"."enum_card_battles_status" AS ENUM('waiting', 'in_progress', 'completed', 'expired', 'cancelled');
  CREATE TYPE "public"."enum_card_battles_challenger_card_suit" AS ENUM('spades', 'hearts', 'diamonds', 'clubs');
  CREATE TYPE "public"."enum_card_battles_opponent_card_suit" AS ENUM('spades', 'hearts', 'diamonds', 'clubs');
  CREATE TYPE "public"."enum_card_battles_result_winner" AS ENUM('challenger', 'opponent', 'draw');
  CREATE TYPE "public"."enum_card_battles_result_challenger_prize_type" AS ENUM('points', 'coupon');
  CREATE TYPE "public"."enum_card_battles_result_opponent_prize_type" AS ENUM('points', 'coupon');
  CREATE TYPE "public"."enum_game_leaderboard_badges_badge_type" AS ENUM('achievement', 'streak', 'seasonal', 'special');
  CREATE TYPE "public"."enum_game_leaderboard_period" AS ENUM('daily', 'weekly', 'monthly', 'all_time');
  CREATE TYPE "public"."enum_collectible_cards_card_type" AS ENUM('common', 'limited');
  CREATE TYPE "public"."enum_collectible_cards_status" AS ENUM('active', 'burned', 'revoked', 'transferred-out');
  CREATE TYPE "public"."enum_collectible_cards_minted_via" AS ENUM('purchase', 'points-shop', 'craft');
  CREATE TYPE "public"."enum_collectible_card_events_action" AS ENUM('mint', 'transfer', 'burn', 'craft-consume', 'craft-result', 'revoke');
  CREATE TYPE "public"."enum_style_submissions_game_type" AS ENUM('style_pk', 'style_relay', 'weekly_challenge', 'co_create', 'blind_box', 'queen_vote', 'team_style', 'wish_pool');
  CREATE TYPE "public"."enum_style_submissions_status" AS ENUM('draft', 'submitted', 'approved', 'hidden', 'winner', 'disqualified');
  CREATE TYPE "public"."enum_style_game_rooms_participants_role" AS ENUM('host', 'member', 'spectator');
  CREATE TYPE "public"."enum_style_game_rooms_participants_status" AS ENUM('active', 'left', 'kicked');
  CREATE TYPE "public"."enum_style_game_rooms_game_type" AS ENUM('style_pk', 'co_create', 'blind_box', 'team_style');
  CREATE TYPE "public"."enum_style_game_rooms_visibility" AS ENUM('private', 'friends', 'public');
  CREATE TYPE "public"."enum_style_game_rooms_status" AS ENUM('waiting', 'active', 'voting', 'settled', 'expired', 'cancelled');
  CREATE TYPE "public"."enum_style_votes_vote_type" AS ENUM('pk_pick', 'like', 'star', 'score');
  CREATE TYPE "public"."enum_style_wishes_status" AS ENUM('open', 'granted', 'closed', 'expired');
  CREATE TYPE "public"."enum_daily_horoscopes_zodiac_sign" AS ENUM('aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces');
  CREATE TYPE "public"."enum_daily_horoscopes_gender" AS ENUM('female', 'male');
  CREATE TYPE "public"."enum_daily_horoscopes_generated_by" AS ENUM('seed', 'groq', 'admin');
  CREATE TYPE "public"."enum_pages_blocks_magazine_cover_layout" AS ENUM('banner', 'split-left', 'split-right', 'left', 'center', 'bottom');
  CREATE TYPE "public"."enum_pages_blocks_magazine_cover_theme" AS ENUM('light', 'dark', 'gold');
  CREATE TYPE "public"."enum_pages_blocks_magazine_cover_object_position" AS ENUM('center', 'top', 'bottom', 'left', 'right');
  CREATE TYPE "public"."enum_pages_blocks_pull_quote_font" AS ENUM('serif', 'sans');
  CREATE TYPE "public"."enum_pages_blocks_pull_quote_alignment" AS ENUM('left', 'center', 'right');
  CREATE TYPE "public"."enum_pages_blocks_editorial_spread_rows_image_position" AS ENUM('left', 'right', 'top', 'full');
  CREATE TYPE "public"."enum_pages_blocks_editorial_spread_rows_background" AS ENUM('cream', 'white', 'dark', 'blush');
  CREATE TYPE "public"."enum_pages_blocks_lookbook_grid_columns" AS ENUM('2', '3', '4');
  CREATE TYPE "public"."enum_pages_blocks_celebrity_grid_columns" AS ENUM('3', '4', '5');
  CREATE TYPE "public"."enum_pages_blocks_kol_persona_social_links_platform" AS ENUM('instagram', 'youtube', 'facebook', 'threads', 'tiktok', 'line', 'website');
  CREATE TYPE "public"."enum_pages_blocks_image_gallery_layout" AS ENUM('grid', 'carousel', 'masonry');
  CREATE TYPE "public"."enum_pages_blocks_product_showcase_display_style" AS ENUM('grid', 'carousel');
  CREATE TYPE "public"."enum_pages_blocks_cta_style" AS ENUM('primary', 'secondary', 'dark');
  CREATE TYPE "public"."enum_pages_blocks_divider_style" AS ENUM('line', 'space', 'ornament');
  CREATE TYPE "public"."enum_pages_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_celebrity_features_social_links_platform" AS ENUM('instagram', 'facebook', 'youtube', 'tiktok', 'threads', 'line', 'website');
  CREATE TYPE "public"."enum_celebrity_features_link_type" AS ENUM('pdp', 'url', 'none');
  CREATE TYPE "public"."enum_celebrity_features_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_podcasts_category" AS ENUM('new-arrivals', 'trends', 'sourcing', 'marketing', 'customer-stories', 'brand-story');
  CREATE TYPE "public"."enum_podcasts_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_site_themes_season" AS ENUM('spring', 'summer', 'autumn', 'winter', 'event', 'default');
  CREATE TYPE "public"."enum_site_themes_serif_font" AS ENUM('noto-serif-tc');
  CREATE TYPE "public"."enum_site_themes_sans_font" AS ENUM('noto-sans-tc');
  CREATE TYPE "public"."enum_site_themes_hero_layout" AS ENUM('split', 'editorial', 'cinematic', 'magazine');
  CREATE TYPE "public"."enum_media_usage_rights_license_kind" AS ENUM('owned', 'explicit-permission', 'official-promo', 'public-domain', 'cc0', 'cc-by', 'cc-by-sa', 'cc-by-nc', 'unknown');
  CREATE TYPE "public"."enum_payload_folders_folder_type" AS ENUM('media');
  CREATE TYPE "public"."enum_order_settings_home_shipping_temperature" AS ENUM('0001', '0002', '0003');
  CREATE TYPE "public"."enum_order_settings_home_shipping_specification" AS ENUM('0001', '0002', '0003', '0004');
  CREATE TYPE "public"."enum_invoice_settings_automation_config_notify_channels" AS ENUM('email', 'line');
  CREATE TYPE "public"."enum_invoice_settings_ecpay_config_environment" AS ENUM('test', 'production');
  CREATE TYPE "public"."enum_invoice_settings_default_config_default_invoice_type" AS ENUM('b2c_personal', 'b2c_carrier', 'b2b', 'donation');
  CREATE TYPE "public"."enum_invoice_settings_default_config_default_tax_type" AS ENUM('taxable', 'zero_tax');
  CREATE TYPE "public"."enum_tax_settings_invoice_breakdown_rounding_mode" AS ENUM('round_half_up', 'round_down', 'round_up');
  CREATE TYPE "public"."loy_place_location" AS ENUM('homepage', 'product_page', 'cart', 'checkout', 'thank_you', 'popup', 'email');
  CREATE TYPE "public"."loy_place_strategy" AS ENUM('also_bought', 'similar', 'trending', 'personalized', 'hybrid');
  CREATE TYPE "public"."pts_remind_urgency" AS ENUM('normal', 'urgent', 'critical');
  CREATE TYPE "public"."enum_cs_settings_business_hours_schedule_day_of_week" AS ENUM('1', '2', '3', '4', '5', '6', '0');
  CREATE TYPE "public"."enum_cs_settings_sla_first_response_minutes_channel" AS ENUM('web', 'line', 'fb', 'ig', 'email', 'phone', 'web_form');
  CREATE TYPE "public"."enum_cs_settings_sla_first_response_minutes_priority" AS ENUM('low', 'normal', 'high', 'urgent');
  CREATE TYPE "public"."enum_cs_settings_sla_resolution_hours_priority" AS ENUM('low', 'normal', 'high', 'urgent');
  CREATE TYPE "public"."enum_cs_settings_sla_breach_action" AS ENUM('notify_assignee', 'escalate', 'notify_supervisor');
  CREATE TYPE "public"."enum_cs_settings_auto_assign_mode" AS ENUM('none', 'round_robin', 'keyword', 'tier');
  CREATE TYPE "public"."mkt_bday_tier_code" AS ENUM('ordinary', 'bronze', 'silver', 'gold', 'platinum', 'diamond');
  CREATE TYPE "public"."mkt_email_provider" AS ENUM('resend', 'ses', 'sendgrid');
  CREATE TYPE "public"."mkt_sms_provider" AS ENUM('twilio', 'mitake');
  CREATE TYPE "public"."mkt_edm_provider" AS ENUM('mailchimp', 'sendgrid');
  CREATE TYPE "public"."mkt_win_metric" AS ENUM('open_rate', 'click_rate', 'conversion_rate', 'revenue');
  CREATE TYPE "public"."rec_bundle_disc_type" AS ENUM('third_item_off', 'threshold_off', 'gift_with_purchase');
  CREATE TYPE "public"."enum_ads_catalog_settings_defaults_default_gender" AS ENUM('female', 'male', 'unisex');
  CREATE TYPE "public"."enum_ads_catalog_settings_defaults_default_age_group" AS ENUM('adult', 'teen', 'kids', 'toddler', 'infant', 'newborn');
  CREATE TYPE "public"."enum_ads_catalog_settings_defaults_default_condition" AS ENUM('new', 'refurbished', 'used');
  CREATE TYPE "public"."enum_ads_catalog_settings_defaults_default_locale" AS ENUM('zh_TW', 'zh_HK', 'zh_CN', 'en_US', 'ja_JP');
  CREATE TYPE "public"."enum_game_settings_spin_wheel_prizes_prize_type" AS ENUM('points', 'credit', 'coupon', 'movie_ticket', 'free_shipping', 'none');
  CREATE TYPE "public"."enum_game_settings_scratch_card_prizes_prize_type" AS ENUM('points', 'credit', 'coupon', 'movie_ticket', 'free_shipping', 'none');
  CREATE TYPE "public"."enum_navigation_settings_announcement_bar_style" AS ENUM('default', 'festive', 'promo');
  CREATE TYPE "public"."enum_homepage_settings_quick_menu_icon" AS ENUM('Sparkles', 'Crown', 'Gamepad2', 'Gift', 'Users', 'ShoppingBag', 'Heart', 'Tag', 'Flame', 'Star');
  CREATE TYPE "public"."enum_homepage_settings_service_highlights_icon" AS ENUM('Truck', 'RefreshCw', 'Shield', 'Sparkles', 'Heart', 'Package', 'Clock', 'Globe');
  CREATE TYPE "public"."enum_homepage_settings_hero_layout_override" AS ENUM('inherit', 'split', 'editorial', 'cinematic', 'magazine');
  CREATE TYPE "public"."enum_homepage_settings_style_journal_section_mode" AS ENUM('auto', 'manual');
  CREATE TYPE "public"."enum_collections_page_settings_cards_collection_tags_filter" AS ENUM('jin-live', 'jin-style', 'host-style', 'brand-custom', 'formal-dresses', 'rush', 'celebrity-style', 'korean-celebrity');
  CREATE TYPE "public"."enum_collections_page_settings_cards_span" AS ENUM('normal', 'wide', 'tall', 'large');
  CREATE TYPE "public"."enum_product_list_settings_default_sort" AS ENUM('newest', 'price-asc', 'price-desc', 'popular');
  CREATE TYPE "public"."enum_about_page_settings_brand_values_icon" AS ENUM('sparkles', 'globe', 'heart', 'users', 'shield', 'truck', 'star', 'gift', 'gem', 'trophy');
  CREATE TYPE "public"."enum_about_page_settings_contact_cta_buttons_style" AS ENUM('line', 'outline');
  CREATE TYPE "public"."enum_faq_page_settings_categories_icon" AS ENUM('shopping-bag', 'truck', 'rotate-ccw', 'credit-card', 'star', 'gift', 'help-circle', 'message-circle', 'package', 'tag');
  CREATE TYPE "public"."enum_packaging_page_settings_features_items_icon" AS ENUM('Sparkles', 'ShieldCheck', 'Leaf', 'Gift', 'Package', 'Recycle', 'Heart', 'Star');
  CREATE TYPE "public"."enum_global_settings_payment_enabled_methods" AS ENUM('paypal', 'ecpay', 'newebpay', 'linepay', 'applepay', 'googlepay', 'cash_cod', 'cash_meetup');
  CREATE TYPE "public"."enum_global_settings_ai_seo_ai_crawler_policy" AS ENUM('allow_all', 'products_blog_only', 'block_all');
  CREATE TYPE "public"."enum_pricing_formula_settings_currency_code" AS ENUM('KRW', 'JPY', 'USD', 'CNY');
  CREATE TYPE "public"."enum_pricing_formula_settings_profit_mode" AS ENUM('percent_only', 'fixed_only', 'whichever_higher');
  CREATE TABLE "blog_posts_article_studio_research_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"url" varchar NOT NULL,
  	"provider" "enum_blog_posts_article_studio_research_sources_provider" DEFAULT 'manual'
  );
  
  CREATE TABLE "blog_posts_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tag" varchar NOT NULL
  );
  
  CREATE TABLE "blog_posts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"excerpt" varchar,
  	"excerpt_cta_enabled" boolean DEFAULT false,
  	"excerpt_cta_label" varchar DEFAULT '立即購買',
  	"excerpt_cta_url" varchar,
  	"content" jsonb NOT NULL,
  	"featured_image_id" integer,
  	"published_at" timestamp(3) with time zone,
  	"view_count" numeric DEFAULT 0,
  	"author_id" integer NOT NULL,
  	"publish_to_kim_lafayette" boolean DEFAULT false,
  	"category" "enum_blog_posts_category",
  	"status" "enum_blog_posts_status" DEFAULT 'draft' NOT NULL,
  	"visibility" "enum_blog_posts_visibility" DEFAULT 'public' NOT NULL,
  	"access_password_hash" varchar,
  	"featured" boolean DEFAULT false,
  	"hero_video_id" integer,
  	"hero_audio_id" integer,
  	"lyrics" varchar,
  	"media_credit" varchar,
  	"article_studio_generated_by_studio" boolean DEFAULT false,
  	"article_studio_template_key" "enum_blog_posts_article_studio_template_key",
  	"article_studio_research_checked_at" timestamp(3) with time zone,
  	"article_studio_takedown_email" varchar DEFAULT 'service@chickimmiu.com',
  	"article_studio_rights_notice" varchar DEFAULT '本文圖片用於團體介紹與宣傳資訊整理，圖片權利歸原權利人所有。如您為權利人並認為使用不妥，請來信告知，我們將儘速確認並下架。',
  	"source_url" varchar,
  	"seo_meta_title" varchar,
  	"seo_meta_description" varchar,
  	"seo_meta_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "blog_posts_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  CREATE TABLE "blog_categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"site" "enum_blog_categories_site" DEFAULT 'store' NOT NULL,
  	"name" varchar NOT NULL,
  	"value" "enum_blog_categories_value" NOT NULL,
  	"slug" varchar,
  	"description" varchar,
  	"display_order" numeric DEFAULT 0,
  	"seo_meta_title" varchar,
  	"seo_meta_description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "orders_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"product_id" integer NOT NULL,
  	"product_name" varchar NOT NULL,
  	"variant" varchar,
  	"sku" varchar,
  	"quantity" numeric NOT NULL,
  	"unit_price" numeric NOT NULL,
  	"subtotal" numeric NOT NULL,
  	"bundle_ref_id" integer,
  	"is_gift" boolean DEFAULT false,
  	"is_add_on" boolean DEFAULT false,
  	"gift_rule_ref_id" integer,
  	"add_on_rule_ref_id" integer
  );
  
  CREATE TABLE "orders_gifts" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"reward_id" integer NOT NULL,
  	"reward_type" varchar,
  	"display_name" varchar,
  	"amount" numeric
  );
  
  CREATE TABLE "orders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order_number" varchar NOT NULL,
  	"customer_id" integer NOT NULL,
  	"guest_email" varchar,
  	"subtotal" numeric NOT NULL,
  	"subtotal_before_discount" numeric DEFAULT 0,
  	"discount_amount" numeric DEFAULT 0,
  	"discount_reason" varchar,
  	"coupon_code" varchar,
  	"coupon_id" integer,
  	"applied_coupons" jsonb,
  	"promotion_quote_id" varchar,
  	"promotion_pricing_version" varchar,
  	"promotion_server_enforced" boolean DEFAULT false,
  	"promotion_quote_hash" varchar,
  	"promotion_discount_total" numeric DEFAULT 0,
  	"promotion_shipping_discount_total" numeric DEFAULT 0,
  	"promotion_applied_promotion_snapshots" jsonb,
  	"promotion_reward_intents" jsonb,
  	"shipping_fee" numeric DEFAULT 0 NOT NULL,
  	"total" numeric NOT NULL,
  	"tax_amount" numeric DEFAULT 0,
  	"tax_rate" numeric DEFAULT 5,
  	"subtotal_excluding_tax" numeric DEFAULT 0,
  	"shipping_tax_amount" numeric DEFAULT 0,
  	"points_used" numeric DEFAULT 0,
  	"credit_used" numeric DEFAULT 0,
  	"status" "enum_orders_status" DEFAULT 'pending' NOT NULL,
  	"payment_method" "enum_orders_payment_method",
  	"cod_fee" numeric DEFAULT 0,
  	"payment_status" "enum_orders_payment_status" DEFAULT 'unpaid' NOT NULL,
  	"payment_transaction_id" varchar,
  	"shipping_address_recipient_name" varchar NOT NULL,
  	"shipping_address_phone" varchar NOT NULL,
  	"shipping_address_zip_code" varchar,
  	"shipping_address_city" varchar NOT NULL,
  	"shipping_address_district" varchar,
  	"shipping_address_address" varchar NOT NULL,
  	"shipping_method_method_id" integer,
  	"shipping_method_method_name" varchar,
  	"shipping_method_carrier" varchar,
  	"shipping_method_convenience_store_store_name" varchar,
  	"shipping_method_convenience_store_store_id" varchar,
  	"shipping_method_convenience_store_store_address" varchar,
  	"shipping_method_estimated_days" varchar,
  	"shipping_method_ecpay_logistics_id" varchar,
  	"shipping_method_cvs_payment_no" varchar,
  	"shipping_method_cvs_validation_no" varchar,
  	"shipping_method_logistics_status" varchar,
  	"shipping_method_return_logistics_id" varchar,
  	"shipping_method_return_logistics_status" varchar,
  	"tracking_number" varchar,
  	"affiliate_info_referral_code" varchar,
  	"affiliate_info_affiliate_user_id" integer,
  	"affiliate_info_commission_rate" numeric,
  	"affiliate_info_commission_amount" numeric,
  	"affiliate_info_commission_status" "enum_orders_affiliate_info_commission_status" DEFAULT 'pending',
  	"attribution_first_touch_utm_source" varchar,
  	"attribution_first_touch_utm_medium" varchar,
  	"attribution_first_touch_utm_campaign" varchar,
  	"attribution_first_touch_utm_term" varchar,
  	"attribution_first_touch_utm_content" varchar,
  	"attribution_first_touch_referrer" varchar,
  	"attribution_first_touch_captured_at" timestamp(3) with time zone,
  	"attribution_last_touch_utm_source" varchar,
  	"attribution_last_touch_utm_medium" varchar,
  	"attribution_last_touch_utm_campaign" varchar,
  	"attribution_last_touch_utm_term" varchar,
  	"attribution_last_touch_utm_content" varchar,
  	"attribution_last_touch_referrer" varchar,
  	"attribution_last_touch_captured_at" timestamp(3) with time zone,
  	"customer_note" varchar,
  	"admin_note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "invoices_invoice_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"item_name" varchar NOT NULL,
  	"item_count" numeric NOT NULL,
  	"item_word" varchar DEFAULT '件',
  	"item_price" numeric NOT NULL,
  	"item_tax_type" "enum_invoices_invoice_items_item_tax_type" DEFAULT 'taxable',
  	"item_amount" numeric NOT NULL
  );
  
  CREATE TABLE "invoices" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"invoice_number" varchar,
  	"order_id" integer NOT NULL,
  	"customer_id" integer NOT NULL,
  	"invoice_type" "enum_invoices_invoice_type" NOT NULL,
  	"status" "enum_invoices_status" DEFAULT 'pending' NOT NULL,
  	"carrier_info_carrier_type" "enum_invoices_carrier_info_carrier_type" DEFAULT 'none',
  	"carrier_info_carrier_number" varchar,
  	"donation_info_love_code" varchar,
  	"buyer_info_buyer_name" varchar,
  	"buyer_info_buyer_email" varchar NOT NULL,
  	"buyer_info_buyer_phone" varchar,
  	"buyer_info_buyer_u_b_n" varchar,
  	"buyer_info_buyer_company_name" varchar,
  	"buyer_info_buyer_address" varchar,
  	"total_amount" numeric NOT NULL,
  	"sales_amount" numeric,
  	"tax_amount" numeric,
  	"tax_type" "enum_invoices_tax_type" DEFAULT 'taxable',
  	"tax_breakdown_standard_taxable" numeric DEFAULT 0,
  	"tax_breakdown_standard_tax" numeric DEFAULT 0,
  	"tax_breakdown_zero_rated_sales" numeric DEFAULT 0,
  	"tax_breakdown_exempt_sales" numeric DEFAULT 0,
  	"ecpay_response_invoice_no" varchar,
  	"ecpay_response_invoice_date" varchar,
  	"ecpay_response_random_number" varchar,
  	"ecpay_response_bar_code" varchar,
  	"ecpay_response_qr_code_left" varchar,
  	"ecpay_response_qr_code_right" varchar,
  	"ecpay_response_invoice_trans_no" varchar,
  	"ecpay_response_rtn_code" varchar,
  	"ecpay_response_rtn_msg" varchar,
  	"ecpay_response_raw_response" jsonb,
  	"void_info_void_reason" varchar,
  	"void_info_void_date" timestamp(3) with time zone,
  	"void_info_void_operator_id" integer,
  	"allowance_info_allowance_amount" numeric,
  	"allowance_info_allowance_reason" varchar,
  	"allowance_info_allowance_date" timestamp(3) with time zone,
  	"allowance_info_allowance_no" varchar,
  	"pdf_url" varchar,
  	"notification_sent" boolean DEFAULT false,
  	"retry_count" numeric DEFAULT 0,
  	"last_error" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "returns_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"product_id" integer NOT NULL,
  	"variant" varchar,
  	"quantity" numeric NOT NULL,
  	"reason" "enum_returns_items_reason" NOT NULL,
  	"reason_detail" varchar
  );
  
  CREATE TABLE "returns_photos" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL
  );
  
  CREATE TABLE "returns" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"return_number" varchar NOT NULL,
  	"order_id" integer NOT NULL,
  	"customer_id" integer NOT NULL,
  	"status" "enum_returns_status" DEFAULT 'pending',
  	"refund_amount" numeric,
  	"refund_method" "enum_returns_refund_method",
  	"admin_note" varchar,
  	"tracking_number" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "exchanges_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"product_id" integer NOT NULL,
  	"original_variant" varchar NOT NULL,
  	"new_variant" varchar NOT NULL,
  	"quantity" numeric NOT NULL,
  	"reason" "enum_exchanges_items_reason" NOT NULL
  );
  
  CREATE TABLE "exchanges" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"exchange_number" varchar NOT NULL,
  	"order_id" integer NOT NULL,
  	"customer_id" integer NOT NULL,
  	"status" "enum_exchanges_status" DEFAULT 'pending',
  	"price_difference" numeric DEFAULT 0,
  	"new_tracking_number" varchar,
  	"admin_note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "refunds_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"product_id" integer NOT NULL,
  	"variant" varchar,
  	"quantity" numeric NOT NULL,
  	"unit_price" numeric NOT NULL,
  	"refund_amount" numeric NOT NULL
  );
  
  CREATE TABLE "refunds" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"refund_number" varchar NOT NULL,
  	"order_id" integer NOT NULL,
  	"customer_id" integer NOT NULL,
  	"return_request_id" integer,
  	"type" "enum_refunds_type" NOT NULL,
  	"amount" numeric NOT NULL,
  	"reason" "enum_refunds_reason" NOT NULL,
  	"reason_detail" varchar,
  	"refund_method" "enum_refunds_refund_method" NOT NULL,
  	"status" "enum_refunds_status" DEFAULT 'pending',
  	"processed_at" timestamp(3) with time zone,
  	"transaction_id" varchar,
  	"admin_note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "shipping_methods_regions" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_shipping_methods_regions",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "shipping_methods_tracking_flow" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"step" varchar NOT NULL,
  	"description" varchar,
  	"icon" varchar
  );
  
  CREATE TABLE "shipping_methods" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"carrier" "enum_shipping_methods_carrier" NOT NULL,
  	"description" varchar,
  	"base_fee" numeric DEFAULT 60 NOT NULL,
  	"free_shipping_threshold" numeric DEFAULT 1000,
  	"estimated_days" varchar,
  	"max_weight" numeric,
  	"is_active" boolean DEFAULT true,
  	"sort_order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "products_alias_slugs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"slug" varchar NOT NULL,
  	"source" "enum_products_alias_slugs_source" DEFAULT 'manual'
  );
  
  CREATE TABLE "products_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tag" varchar NOT NULL
  );
  
  CREATE TABLE "products_collection_tags" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_products_collection_tags",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "products_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL,
  	"category" "enum_products_images_category" DEFAULT 'detail',
  	"caption" varchar
  );
  
  CREATE TABLE "products_variants" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"color_name" varchar NOT NULL,
  	"color_code" varchar,
  	"color_swatch_id" integer,
  	"size" varchar NOT NULL,
  	"sku" varchar NOT NULL,
  	"stock" numeric DEFAULT 0 NOT NULL,
  	"price_override" numeric,
  	"cost_override" numeric,
  	"gtin" varchar
  );
  
  CREATE TABLE "products_material_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL,
  	"caption" varchar
  );
  
  CREATE TABLE "products_personality_types" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_products_personality_types",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "products" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"status" "enum_products_status" DEFAULT 'draft' NOT NULL,
  	"publish_at" timestamp(3) with time zone,
  	"unpublish_at" timestamp(3) with time zone,
  	"is_new" boolean DEFAULT false,
  	"is_hot" boolean DEFAULT false,
  	"product_sku" varchar,
  	"is_low_stock" boolean DEFAULT false,
  	"total_sold" numeric DEFAULT 0,
  	"sourcing_source_id" varchar,
  	"sourcing_supplier_name" varchar,
  	"sourcing_supplier_location" varchar,
  	"sourcing_cost_k_r_w" numeric,
  	"sourcing_cost_t_w_d" numeric,
  	"sourcing_exchange_rate" numeric,
  	"sourcing_original_description" varchar,
  	"sourcing_fabric_info_material" varchar,
  	"sourcing_fabric_info_thickness" varchar,
  	"sourcing_fabric_info_transparency" varchar,
  	"sourcing_fabric_info_elasticity" varchar,
  	"sourcing_fabric_info_made_in" varchar,
  	"image_migration_status" "enum_products_image_migration_status" DEFAULT 'pending',
  	"image_migration_last_attempt_at" timestamp(3) with time zone,
  	"image_migration_last_error" varchar,
  	"image_migration_processed_count" numeric DEFAULT 0,
  	"image_migration_total_count" numeric DEFAULT 0,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"brand" varchar DEFAULT 'CHIC KIM & MIU',
  	"product_origin" varchar,
  	"description" jsonb,
  	"short_description" varchar,
  	"auto_pricing_use_auto_pricing" boolean DEFAULT false,
  	"auto_pricing_cost_amount" numeric,
  	"auto_pricing_cost_currency_code" "enum_products_auto_pricing_cost_currency_code" DEFAULT 'KRW',
  	"price" numeric NOT NULL,
  	"sale_price" numeric,
  	"cost" numeric,
  	"tax_category" "enum_products_tax_category" DEFAULT 'standard',
  	"category_id" integer NOT NULL,
  	"korean_celebrity_ref_celebrity_name" varchar,
  	"korean_celebrity_ref_drama_or_show" varchar,
  	"korean_celebrity_ref_source_brand" varchar,
  	"weight" numeric,
  	"dimensions_length" numeric,
  	"dimensions_width" numeric,
  	"dimensions_height" numeric,
  	"purchase_limit" numeric DEFAULT 0,
  	"featured_image_id" integer,
  	"intro_video_id" integer,
  	"stock" numeric DEFAULT 0,
  	"low_stock_threshold" numeric DEFAULT 5,
  	"size_chart_id" integer,
  	"allow_pre_order" boolean DEFAULT false,
  	"pre_order_note" varchar,
  	"material" varchar,
  	"material_description" varchar,
  	"care_instructions" varchar,
  	"model_info_height" varchar,
  	"model_info_weight" varchar,
  	"model_info_wearing_size" varchar,
  	"model_info_body_shape" varchar,
  	"styling_tips" varchar,
  	"seo_meta_title" varchar,
  	"seo_meta_description" varchar,
  	"seo_meta_image_id" integer,
  	"exclude_from_ads_catalog" boolean DEFAULT false,
  	"ads_gender" "enum_products_ads_gender" DEFAULT 'female',
  	"ads_age_group" "enum_products_ads_age_group" DEFAULT 'adult',
  	"ads_condition" "enum_products_ads_condition" DEFAULT 'new',
  	"google_product_category" varchar,
  	"product_type" varchar,
  	"gtin" varchar,
  	"mpn" varchar,
  	"hs_code" varchar,
  	"ads_title_override" varchar,
  	"ads_description_override" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "products_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer
  );
  
  CREATE TABLE "categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"parent_id" integer,
  	"level" "enum_categories_level" DEFAULT '1',
  	"sort_order" numeric DEFAULT 0,
  	"description" varchar,
  	"image_id" integer,
  	"icon" varchar,
  	"is_active" boolean DEFAULT true,
  	"product_count" numeric DEFAULT 0,
  	"seo_meta_title" varchar,
  	"seo_meta_description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "size_charts_measurements" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"label" varchar NOT NULL
  );
  
  CREATE TABLE "size_charts_rows_values" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"value" varchar NOT NULL
  );
  
  CREATE TABLE "size_charts_rows" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"size" varchar NOT NULL
  );
  
  CREATE TABLE "size_charts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"category" "enum_size_charts_category" DEFAULT 'top',
  	"unit" "enum_size_charts_unit" DEFAULT 'cm',
  	"note" varchar,
  	"is_active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "product_reviews_photos" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL
  );
  
  CREATE TABLE "product_reviews" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"product_id" integer NOT NULL,
  	"reviewer_id" integer NOT NULL,
  	"rating" numeric NOT NULL,
  	"title" varchar,
  	"content" varchar NOT NULL,
  	"status" "enum_product_reviews_status" DEFAULT 'pending',
  	"admin_note" varchar,
  	"order_info_order_id" varchar,
  	"order_info_variant" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "inventory_transactions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"product_id" integer NOT NULL,
  	"sku" varchar,
  	"type" "enum_inventory_transactions_type" NOT NULL,
  	"quantity_delta" numeric NOT NULL,
  	"balance_after" numeric,
  	"related_order_id" integer,
  	"related_purchase_order_id" integer,
  	"related_stock_take_id" integer,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "purchase_orders_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"product_id" integer NOT NULL,
  	"sku" varchar,
  	"quantity" numeric NOT NULL,
  	"unit_cost" numeric
  );
  
  CREATE TABLE "purchase_orders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"po_number" varchar,
  	"status" "enum_purchase_orders_status" DEFAULT 'draft' NOT NULL,
  	"supplier_name" varchar,
  	"expected_date" timestamp(3) with time zone,
  	"total_cost" numeric,
  	"received_date" timestamp(3) with time zone,
  	"stock_applied" boolean DEFAULT false,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "stock_takes_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"product_id" integer NOT NULL,
  	"sku" varchar,
  	"system_qty" numeric,
  	"counted_qty" numeric NOT NULL
  );
  
  CREATE TABLE "stock_takes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"status" "enum_stock_takes_status" DEFAULT 'draft' NOT NULL,
  	"applied" boolean DEFAULT false,
  	"completed_at" timestamp(3) with time zone,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "users_invoice_profiles" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"profile_name" varchar NOT NULL,
  	"invoice_title" varchar NOT NULL,
  	"tax_id" varchar,
  	"invoice_contact_name" varchar,
  	"invoice_phone" varchar,
  	"invoice_address" varchar,
  	"note" varchar
  );
  
  CREATE TABLE "users_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tag" varchar NOT NULL
  );
  
  CREATE TABLE "users_addresses" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"recipient_name" varchar NOT NULL,
  	"phone" varchar NOT NULL,
  	"zip_code" varchar,
  	"city" varchar NOT NULL,
  	"district" varchar,
  	"address" varchar NOT NULL,
  	"is_default" boolean DEFAULT false
  );
  
  CREATE TABLE "users_game_activity_recent_games" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"game_name" varchar,
  	"result" varchar,
  	"reward" varchar,
  	"played_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "users_ai_dm_preferences_dm_history" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"channel" varchar,
  	"subject" varchar,
  	"status" varchar,
  	"sent_at" timestamp(3) with time zone,
  	"opened_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "users_notification_preferences_channels" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_users_notification_preferences_channels",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"phone" varchar,
  	"role" "enum_users_role" DEFAULT 'customer' NOT NULL,
  	"is_guest" boolean DEFAULT false,
  	"birthday" timestamp(3) with time zone,
  	"birth_time" varchar,
  	"gender" "enum_users_gender",
  	"avatar_id" integer,
  	"invoice_info_invoice_title" varchar,
  	"invoice_info_tax_id" varchar,
  	"invoice_info_invoice_address" varchar,
  	"invoice_info_invoice_contact_name" varchar,
  	"invoice_info_invoice_phone" varchar,
  	"shopline_customer_id" varchar,
  	"signup_source" "enum_users_signup_source",
  	"admin_permissions_can_manage_products" boolean DEFAULT true,
  	"admin_permissions_can_manage_orders" boolean DEFAULT true,
  	"admin_permissions_can_manage_users" boolean DEFAULT true,
  	"admin_permissions_can_manage_marketing" boolean DEFAULT true,
  	"admin_permissions_can_manage_finance" boolean DEFAULT false,
  	"admin_permissions_can_manage_settings" boolean DEFAULT false,
  	"admin_permissions_can_manage_content" boolean DEFAULT true,
  	"admin_permissions_can_manage_c_r_m" boolean DEFAULT false,
  	"member_tier_id" integer,
  	"points" numeric DEFAULT 0,
  	"shopping_credit" numeric DEFAULT 0,
  	"total_spent" numeric DEFAULT 0,
  	"stored_value_balance" numeric DEFAULT 0,
  	"total_check_ins" numeric DEFAULT 0,
  	"consecutive_check_ins" numeric DEFAULT 0,
  	"last_check_in_date" varchar,
  	"subscription_status_email_subscribed" boolean DEFAULT true,
  	"subscription_status_sms_subscribed" boolean DEFAULT false,
  	"subscription_status_line_subscribed" boolean DEFAULT false,
  	"subscription_status_unsubscribed_at" timestamp(3) with time zone,
  	"membership_active_plan_id" integer,
  	"membership_active_subscription_id" integer,
  	"membership_valid_until" timestamp(3) with time zone,
  	"membership_streak_months" numeric DEFAULT 0,
  	"referral_code" varchar,
  	"referred_by_id" integer,
  	"registration_referral_rewarded" boolean DEFAULT false,
  	"credit_score" numeric DEFAULT 100,
  	"credit_status" "enum_users_credit_status" DEFAULT 'excellent',
  	"service_level" "enum_users_service_level" DEFAULT 'standard',
  	"is_blacklisted" boolean DEFAULT false,
  	"is_suspended" boolean DEFAULT false,
  	"blacklist_reason" varchar,
  	"vip_owner_id" integer,
  	"crm_note" varchar,
  	"preferred_category" varchar,
  	"preferred_size" varchar,
  	"preferred_color" varchar,
  	"body_profile_height" numeric,
  	"body_profile_weight" numeric,
  	"body_profile_body_shape" "enum_users_body_profile_body_shape",
  	"body_profile_preferred_sizes" varchar,
  	"body_profile_foot_length" numeric,
  	"body_profile_bust" numeric,
  	"body_profile_waist" numeric,
  	"body_profile_hips" numeric,
  	"social_logins_google_id" varchar,
  	"social_logins_facebook_id" varchar,
  	"social_logins_line_id" varchar,
  	"social_logins_apple_id" varchar,
  	"line_uid" varchar,
  	"annual_spend" numeric DEFAULT 0,
  	"lifetime_spend" numeric DEFAULT 0,
  	"order_count" numeric DEFAULT 0,
  	"last_order_date" timestamp(3) with time zone,
  	"last_login_date" timestamp(3) with time zone,
  	"order_history_note" varchar,
  	"first_touch_attribution_utm_source" varchar,
  	"first_touch_attribution_utm_medium" varchar,
  	"first_touch_attribution_utm_campaign" varchar,
  	"first_touch_attribution_utm_term" varchar,
  	"first_touch_attribution_utm_content" varchar,
  	"first_touch_attribution_referrer" varchar,
  	"first_touch_attribution_landing_path" varchar,
  	"first_touch_attribution_captured_at" timestamp(3) with time zone,
  	"mbti_profile_mbti_type" "enum_users_mbti_profile_mbti_type",
  	"mbti_profile_mbti_taken_at" timestamp(3) with time zone,
  	"mbti_profile_mbti_scores" jsonb,
  	"mbti_profile_primary_occasion" "enum_users_mbti_profile_primary_occasion",
  	"mbti_profile_occasion_scores" jsonb,
  	"game_activity_total_games_played" numeric DEFAULT 0,
  	"game_activity_total_points_won" numeric DEFAULT 0,
  	"game_activity_favorite_game" varchar,
  	"game_terms_acceptance_accepted_at" timestamp(3) with time zone,
  	"game_terms_acceptance_accepted_version" varchar,
  	"game_terms_acceptance_adult_confirmed" boolean DEFAULT false,
  	"game_terms_acceptance_acceptance_ip" varchar,
  	"ai_dm_preferences_last_dm_sent_at" timestamp(3) with time zone,
  	"ai_dm_preferences_dm_channel" "enum_users_ai_dm_preferences_dm_channel" DEFAULT 'email',
  	"notification_preferences_bell_in_admin" boolean DEFAULT true,
  	"notification_preferences_email_digest" boolean DEFAULT false,
  	"notification_preferences_email_digest_time" varchar DEFAULT '09:00',
  	"notification_preferences_quiet_hours_start" varchar,
  	"notification_preferences_quiet_hours_end" varchar,
  	"notification_preferences_mobile_push_token" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"_verified" boolean,
  	"_verificationtoken" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "users_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"products_id" integer
  );
  
  CREATE TABLE "membership_tiers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"front_name" varchar NOT NULL,
  	"front_name_male" varchar,
  	"front_subtitle" varchar,
  	"tagline" varchar,
  	"benefits_description" varchar,
  	"level" numeric NOT NULL,
  	"min_spent" numeric DEFAULT 0 NOT NULL,
  	"annual_spent_threshold" numeric DEFAULT 0,
  	"next_tier_slug" varchar,
  	"next_tier_front_name" varchar,
  	"upgrade_gift_points" numeric DEFAULT 0,
  	"upgrade_gift_description" varchar,
  	"discount_percent" numeric DEFAULT 0 NOT NULL,
  	"points_multiplier" numeric DEFAULT 1 NOT NULL,
  	"free_shipping_threshold" numeric DEFAULT 0 NOT NULL,
  	"lottery_chances" numeric DEFAULT 0 NOT NULL,
  	"birthday_gift" varchar,
  	"exclusive_coupon_enabled" boolean DEFAULT false,
  	"exclusive_coupon_discount" numeric,
  	"color" varchar,
  	"icon_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "member_segments_history" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"segment" varchar,
  	"score" numeric,
  	"changed_at" timestamp(3) with time zone,
  	"reason" varchar
  );
  
  CREATE TABLE "member_segments_auto_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tag" varchar,
  	"confidence" numeric
  );
  
  CREATE TABLE "member_segments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"current_segment" "enum_member_segments_current_segment" NOT NULL,
  	"segment_label" varchar,
  	"segment_color" varchar,
  	"scores_rfm_score" numeric DEFAULT 0,
  	"scores_credit_score" numeric DEFAULT 0,
  	"scores_ltv_score" numeric DEFAULT 0,
  	"scores_churn_score" numeric DEFAULT 0,
  	"scores_behavior_score" numeric DEFAULT 0,
  	"scores_tier_score" numeric DEFAULT 0,
  	"scores_composite_score" numeric DEFAULT 0,
  	"previous_segment" varchar,
  	"segment_changed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "subscription_plans_dopamine_streak_milestones" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"months" numeric NOT NULL,
  	"reward" varchar NOT NULL,
  	"credit_amount" numeric DEFAULT 0
  );
  
  CREATE TABLE "subscription_plans_feature_list" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"icon" varchar,
  	"text" varchar NOT NULL,
  	"highlight" boolean DEFAULT false
  );
  
  CREATE TABLE "subscription_plans" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"badge" varchar,
  	"badge_color" varchar DEFAULT '#C19A5B',
  	"sort_order" numeric DEFAULT 0,
  	"is_active" boolean DEFAULT true,
  	"is_featured" boolean DEFAULT false,
  	"pricing_monthly_price" numeric NOT NULL,
  	"pricing_yearly_price" numeric,
  	"pricing_trial_days" numeric DEFAULT 0,
  	"benefits_discount_percent" numeric DEFAULT 0,
  	"benefits_points_multiplier" numeric DEFAULT 1,
  	"benefits_free_shipping_threshold" numeric,
  	"benefits_monthly_credit" numeric DEFAULT 0,
  	"benefits_birthday_bonus_multiplier" numeric DEFAULT 1,
  	"benefits_exclusive_coupon_count" numeric DEFAULT 0,
  	"dopamine_daily_login_bonus" numeric DEFAULT 0,
  	"dopamine_consecutive_month_bonus" numeric DEFAULT 0,
  	"dopamine_mystery_gift_enabled" boolean DEFAULT false,
  	"dopamine_early_access_hours" numeric DEFAULT 0,
  	"dopamine_exclusive_lottery_spins" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "user_subscriptions_auth_log" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"at" timestamp(3) with time zone,
  	"amount" numeric,
  	"gwsr" varchar,
  	"rtn_code" varchar,
  	"success" boolean
  );
  
  CREATE TABLE "user_subscriptions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"plan_id" integer NOT NULL,
  	"status" "enum_user_subscriptions_status" DEFAULT 'pending' NOT NULL,
  	"billing_cycle" "enum_user_subscriptions_billing_cycle" DEFAULT 'monthly' NOT NULL,
  	"amount" numeric NOT NULL,
  	"started_at" timestamp(3) with time zone,
  	"current_period_end" timestamp(3) with time zone,
  	"streak_months" numeric DEFAULT 0,
  	"ecpay_merchant_trade_no" varchar,
  	"ecpay_gwsr" varchar,
  	"ecpay_period_type" varchar,
  	"ecpay_exec_times" numeric,
  	"ecpay_total_success_times" numeric DEFAULT 0,
  	"ecpay_last_auth_at" timestamp(3) with time zone,
  	"cancelled_at" timestamp(3) with time zone,
  	"cancel_reason" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "points_transactions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"type" "enum_points_transactions_type",
  	"amount" numeric NOT NULL,
  	"balance" numeric,
  	"source" "enum_points_transactions_source",
  	"description" varchar,
  	"related_order_id" integer,
  	"expires_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "points_redemptions_lottery_config_prizes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"prize_name" varchar,
  	"prize_value" numeric,
  	"weight" numeric DEFAULT 1,
  	"stock" numeric
  );
  
  CREATE TABLE "points_redemptions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar,
  	"description" varchar,
  	"image_id" integer,
  	"type" "enum_points_redemptions_type" NOT NULL,
  	"points_cost" numeric NOT NULL,
  	"sort_order" numeric DEFAULT 0,
  	"stock" numeric DEFAULT 0,
  	"redeemed" numeric DEFAULT 0,
  	"is_active" boolean DEFAULT true,
  	"limits_max_per_user" numeric DEFAULT 0,
  	"limits_max_per_day" numeric DEFAULT 0,
  	"limits_min_member_tier" varchar,
  	"limits_subscriber_only" boolean DEFAULT false,
  	"limits_start_date" timestamp(3) with time zone,
  	"limits_end_date" timestamp(3) with time zone,
  	"coupon_config_discount_type" "enum_points_redemptions_coupon_config_discount_type",
  	"coupon_config_discount_value" numeric,
  	"coupon_config_max_discount_amount" numeric,
  	"coupon_config_min_order_amount" numeric DEFAULT 0,
  	"coupon_config_valid_days" numeric DEFAULT 30,
  	"lottery_config_win_rate" numeric DEFAULT 10,
  	"physical_config_linked_product_id" integer,
  	"physical_config_physical_sku" varchar,
  	"physical_config_validity_days" numeric DEFAULT 365,
  	"physical_config_shipping_note" varchar,
  	"physical_config_reward_type_override" "enum_points_redemptions_physical_config_reward_type_override" DEFAULT 'gift_physical',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "user_rewards" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"source_record_id" integer,
  	"redemption_ref_id" integer,
  	"points_cost_snapshot" numeric,
  	"reward_type" "enum_user_rewards_reward_type" NOT NULL,
  	"display_name" varchar NOT NULL,
  	"amount" numeric,
  	"coupon_code" varchar,
  	"redemption_instructions" varchar,
  	"state" "enum_user_rewards_state" DEFAULT 'unused' NOT NULL,
  	"attached_to_order_id" integer,
  	"shipped_at" timestamp(3) with time zone,
  	"consumed_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"requires_physical_shipping" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "credit_score_history" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"previous_score" numeric,
  	"change" numeric NOT NULL,
  	"new_score" numeric,
  	"reason" "enum_credit_score_history_reason" NOT NULL,
  	"description" varchar,
  	"related_order_id" integer,
  	"related_return_id" integer,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "wallet_transactions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"wallet" "enum_wallet_transactions_wallet" DEFAULT 'shoppingCredit' NOT NULL,
  	"type" "enum_wallet_transactions_type",
  	"amount" numeric NOT NULL,
  	"balance" numeric,
  	"source" "enum_wallet_transactions_source",
  	"description" varchar,
  	"related_order_id" integer,
  	"related_withdrawal_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "wallet_withdrawals" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"status" "enum_wallet_withdrawals_status" DEFAULT 'pending' NOT NULL,
  	"amount" numeric NOT NULL,
  	"bank_info_bank_name" varchar,
  	"bank_info_bank_code" varchar,
  	"bank_info_account_name" varchar,
  	"bank_info_account_number" varchar,
  	"user_note" varchar,
  	"admin_note" varchar,
  	"held" boolean DEFAULT false,
  	"refunded_to_wallet" boolean DEFAULT false,
  	"processed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "wishlist_items" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"product_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "conversations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"ticket_number" varchar NOT NULL,
  	"external_thread_id" varchar,
  	"subject" varchar,
  	"channel" "enum_conversations_channel" NOT NULL,
  	"channel_metadata" jsonb,
  	"customer_id" integer,
  	"anon_id" varchar,
  	"guest_name" varchar,
  	"guest_email" varchar,
  	"guest_phone" varchar,
  	"status" "enum_conversations_status" DEFAULT 'open' NOT NULL,
  	"priority" "enum_conversations_priority" DEFAULT 'normal',
  	"unread" boolean DEFAULT true,
  	"assignee_id" integer,
  	"category" "enum_conversations_category",
  	"merged_into_id" integer,
  	"first_response_at" timestamp(3) with time zone,
  	"resolved_at" timestamp(3) with time zone,
  	"last_message_at" timestamp(3) with time zone,
  	"sla_due_at" timestamp(3) with time zone,
  	"sla_breached" boolean DEFAULT false,
  	"internal_note" jsonb,
  	"source" varchar,
  	"utm_source" varchar,
  	"utm_medium" varchar,
  	"utm_campaign" varchar,
  	"ai_summary" varchar,
  	"ai_summary_generated_at" timestamp(3) with time zone,
  	"sentiment" "enum_conversations_sentiment",
  	"detected_language" varchar,
  	"csat_score" numeric,
  	"csat_at" timestamp(3) with time zone,
  	"csat_comment" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "conversations_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"message_tags_id" integer,
  	"orders_id" integer,
  	"products_id" integer,
  	"returns_id" integer
  );
  
  CREATE TABLE "messages_attachments" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"media_id" integer,
  	"caption" varchar,
  	"kind" "enum_messages_attachments_kind",
  	"external_url" varchar,
  	"metadata" jsonb
  );
  
  CREATE TABLE "messages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"conversation_id" integer NOT NULL,
  	"preview" varchar,
  	"direction" "enum_messages_direction" NOT NULL,
  	"sender" "enum_messages_sender" NOT NULL,
  	"staff_user_id" integer,
  	"body" jsonb,
  	"internal" boolean DEFAULT false,
  	"external_id" varchar,
  	"reply_to_external_id" varchar,
  	"quoted_message_id" integer,
  	"read_by_customer_at" timestamp(3) with time zone,
  	"read_by_staff_at" timestamp(3) with time zone,
  	"edited_at" timestamp(3) with time zone,
  	"deleted_at" timestamp(3) with time zone,
  	"ai_suggestion" jsonb,
  	"ai_used" boolean DEFAULT false,
  	"raw_payload" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "message_tags" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"parent_id" integer,
  	"color" "enum_message_tags_color",
  	"description" varchar,
  	"usage_count" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "conversation_activities" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"conversation_id" integer NOT NULL,
  	"actor_id" integer,
  	"actor_type" "enum_conversation_activities_actor_type" DEFAULT 'staff' NOT NULL,
  	"type" "enum_conversation_activities_type" NOT NULL,
  	"payload" jsonb,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "product_view_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"product_id" integer NOT NULL,
  	"session_id" varchar NOT NULL,
  	"user_id" integer,
  	"utm_source" varchar,
  	"utm_medium" varchar,
  	"utm_campaign" varchar,
  	"utm_term" varchar,
  	"utm_content" varchar,
  	"referrer" varchar,
  	"landing_path" varchar,
  	"device_type" "enum_product_view_events_device_type",
  	"country_code" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "behavior_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"event_type" "enum_behavior_events_event_type" NOT NULL,
  	"session_id" varchar NOT NULL,
  	"user_id" integer,
  	"page_path" varchar NOT NULL,
  	"product_id" integer,
  	"element_key" varchar,
  	"value" numeric,
  	"quantity" numeric,
  	"duration_ms" numeric,
  	"scroll_pct_max" numeric,
  	"search_query" varchar,
  	"utm_source" varchar,
  	"utm_medium" varchar,
  	"utm_campaign" varchar,
  	"referrer" varchar,
  	"landing_path" varchar,
  	"device_type" "enum_behavior_events_device_type",
  	"country_code" varchar,
  	"campaign_id" integer,
  	"rule_key" varchar,
  	"variant_id" varchar,
  	"surface" "enum_behavior_events_surface",
  	"meta" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "coupons" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"description" varchar,
  	"discount_type" "enum_coupons_discount_type" DEFAULT 'percentage' NOT NULL,
  	"discount_value" numeric NOT NULL,
  	"max_discount_amount" numeric,
  	"min_order_amount" numeric DEFAULT 0,
  	"usage_limit" numeric,
  	"usage_limit_per_user" numeric DEFAULT 1,
  	"usage_count" numeric DEFAULT 0,
  	"starts_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone,
  	"is_active" boolean DEFAULT true,
  	"stackable" boolean DEFAULT false,
  	"exclusive_group" varchar,
  	"conditions_tier_required_id" integer,
  	"conditions_first_order_only" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "coupons_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"products_id" integer
  );
  
  CREATE TABLE "coupon_redemptions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"coupon_id" integer NOT NULL,
  	"user_id" integer,
  	"order_id" integer NOT NULL,
  	"discount_amount" numeric NOT NULL,
  	"redeemed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "add_on_products" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"product_id" integer NOT NULL,
  	"add_on_price" numeric NOT NULL,
  	"conditions_min_cart_subtotal" numeric DEFAULT 0,
  	"conditions_usage_limit_per_order" numeric DEFAULT 1,
  	"starts_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone,
  	"is_active" boolean DEFAULT true,
  	"priority" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "add_on_products_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"products_id" integer
  );
  
  CREATE TABLE "gift_rules" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"trigger_type" "enum_gift_rules_trigger_type" DEFAULT 'min_amount' NOT NULL,
  	"min_amount" numeric,
  	"gift_product_id" integer NOT NULL,
  	"gift_quantity" numeric DEFAULT 1,
  	"stackable" boolean DEFAULT false,
  	"starts_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone,
  	"is_active" boolean DEFAULT true,
  	"priority" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "gift_rules_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"products_id" integer
  );
  
  CREATE TABLE "bundles_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"product_id" integer NOT NULL,
  	"quantity" numeric DEFAULT 1 NOT NULL
  );
  
  CREATE TABLE "bundles" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" jsonb,
  	"original_price" numeric,
  	"bundle_price" numeric NOT NULL,
  	"savings" numeric,
  	"image_id" integer,
  	"starts_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone,
  	"is_active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "marketing_campaigns_target_segments" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_marketing_campaigns_target_segments",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "marketing_campaigns_tier_filter" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_marketing_campaigns_tier_filter",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "marketing_campaigns_channels" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_marketing_campaigns_channels",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "marketing_campaigns_message_templates" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"channel" "enum_marketing_campaigns_message_templates_channel",
  	"template_ref_id" integer
  );
  
  CREATE TABLE "marketing_campaigns_ab_test_config_split_ratio" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"variant_name" varchar,
  	"percentage" numeric
  );
  
  CREATE TABLE "marketing_campaigns_commerce_surfaces" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_marketing_campaigns_commerce_surfaces",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "marketing_campaigns" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"campaign_name" varchar NOT NULL,
  	"campaign_slug" varchar NOT NULL,
  	"campaign_type" "enum_marketing_campaigns_campaign_type",
  	"status" "enum_marketing_campaigns_status" DEFAULT 'draft',
  	"description" varchar,
  	"credit_score_filter_min_score" numeric,
  	"credit_score_filter_max_score" numeric,
  	"schedule_start_date" timestamp(3) with time zone NOT NULL,
  	"schedule_end_date" timestamp(3) with time zone NOT NULL,
  	"schedule_timezone" varchar DEFAULT 'Asia/Taipei',
  	"journey_ref_id" integer,
  	"ab_test_enabled" boolean DEFAULT false,
  	"ab_test_config_variant_count" numeric DEFAULT 2,
  	"ab_test_config_winner_metric" "enum_marketing_campaigns_ab_test_config_winner_metric",
  	"ab_test_config_auto_select_winner" boolean DEFAULT true,
  	"ab_test_config_min_sample_size" numeric DEFAULT 100,
  	"budget_total_budget" numeric,
  	"budget_spent_amount" numeric DEFAULT 0,
  	"budget_cost_per_message" numeric,
  	"performance_sent" numeric DEFAULT 0,
  	"performance_delivered" numeric DEFAULT 0,
  	"performance_opened" numeric DEFAULT 0,
  	"performance_clicked" numeric DEFAULT 0,
  	"performance_converted" numeric DEFAULT 0,
  	"performance_revenue" numeric DEFAULT 0,
  	"performance_unsubscribed" numeric DEFAULT 0,
  	"personalized_content_use_a_i_recommendation" boolean DEFAULT true,
  	"personalized_content_use_u_g_c" boolean DEFAULT true,
  	"personalized_content_use_credit_score_personalization" boolean DEFAULT true,
  	"personalized_content_use_segment_personalization" boolean DEFAULT true,
  	"linked_festival_id" integer,
  	"commerce_enabled" boolean DEFAULT false,
  	"commerce_kill_switch" boolean DEFAULT false,
  	"commerce_objective" "enum_marketing_campaigns_commerce_objective",
  	"commerce_headline" varchar,
  	"commerce_badge_text" varchar,
  	"commerce_cta_text" varchar,
  	"commerce_cta_href" varchar,
  	"commerce_budget_cap" numeric,
  	"commerce_budget_spent" numeric DEFAULT 0,
  	"commerce_approval_approved_by_id" integer,
  	"commerce_approval_approved_at" timestamp(3) with time zone,
  	"commerce_approval_approval_note" varchar,
  	"admin_note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "promotion_rules_scope_include_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tag" varchar NOT NULL
  );
  
  CREATE TABLE "promotion_rules_scope_exclude_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tag" varchar NOT NULL
  );
  
  CREATE TABLE "promotion_rules_conditions_segments_not_in" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_promotion_rules_conditions_segments_not_in",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "promotion_rules_conditions_channels" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_promotion_rules_conditions_channels",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "promotion_rules_stacking_stackable_with" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_promotion_rules_stacking_stackable_with",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "promotion_rules" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"campaign_id" integer NOT NULL,
  	"status" "enum_promotion_rules_status" DEFAULT 'draft' NOT NULL,
  	"version" numeric DEFAULT 1 NOT NULL,
  	"benefit_class" "enum_promotion_rules_benefit_class" DEFAULT 'item_promo' NOT NULL,
  	"priority" numeric DEFAULT 100 NOT NULL,
  	"conditions_min_quantity" numeric,
  	"conditions_min_eligible_subtotal" numeric,
  	"conditions_min_order_subtotal" numeric,
  	"conditions_members_only" boolean DEFAULT false,
  	"conditions_first_purchase_only" boolean DEFAULT false,
  	"effect_effect_type" "enum_promotion_rules_effect_effect_type" DEFAULT 'fixed_discount_per_group' NOT NULL,
  	"effect_group_size" numeric DEFAULT 2,
  	"effect_amount" numeric,
  	"effect_percent_off" numeric,
  	"effect_max_amount" numeric,
  	"effect_repeat_mode" "enum_promotion_rules_effect_repeat_mode" DEFAULT 'once_per_order',
  	"effect_unit_selection" "enum_promotion_rules_effect_unit_selection" DEFAULT 'cheapest_first',
  	"effect_gift_product_id" integer,
  	"effect_gift_quantity" numeric DEFAULT 1,
  	"effect_multiplier" numeric,
  	"effect_reward_key" varchar,
  	"stacking_exclusive_group" varchar,
  	"stacking_max_benefit_per_order" numeric,
  	"stacking_stackable_with_all" boolean DEFAULT true,
  	"guardrails_minimum_gross_margin_pct" numeric,
  	"guardrails_per_user_limit" numeric,
  	"guardrails_total_usage_limit" numeric,
  	"admin_note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "promotion_rules_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer,
  	"products_id" integer,
  	"membership_tiers_id" integer
  );
  
  CREATE TABLE "promotion_applications" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order_id" integer NOT NULL,
  	"user_id" integer,
  	"campaign_id" integer,
  	"rule_id" integer,
  	"rule_key" varchar NOT NULL,
  	"version" numeric NOT NULL,
  	"source" "enum_promotion_applications_source" NOT NULL,
  	"coupon_code" varchar,
  	"effect_type" varchar NOT NULL,
  	"status" "enum_promotion_applications_status" DEFAULT 'applied' NOT NULL,
  	"discount_amount" numeric NOT NULL,
  	"shipping_discount_amount" numeric DEFAULT 0,
  	"allocations" jsonb,
  	"idempotency_key" varchar NOT NULL,
  	"reversed_at" timestamp(3) with time zone,
  	"reversal_reason" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "festival_templates_phases_channels" (
  	"order" integer NOT NULL,
  	"parent_id" varchar NOT NULL,
  	"value" "enum_festival_templates_phases_channels",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "festival_templates_phases" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"phase_name" varchar NOT NULL,
  	"phase_slug" varchar NOT NULL,
  	"phase_type" "enum_festival_templates_phases_phase_type" NOT NULL,
  	"offset_days" numeric NOT NULL,
  	"duration_hours" numeric NOT NULL
  );
  
  CREATE TABLE "festival_templates_segment_offers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"segment" "enum_festival_templates_segment_offers_segment",
  	"discount_type" "enum_festival_templates_segment_offers_discount_type",
  	"discount_value" numeric NOT NULL,
  	"coupon_code" varchar,
  	"additional_message" varchar,
  	"credit_score_bonus_high_credit_extra_discount" numeric,
  	"credit_score_bonus_medium_credit_extra_discount" numeric
  );
  
  CREATE TABLE "festival_templates_ab_test_variants" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"variant_name" varchar NOT NULL,
  	"variant_slug" varchar NOT NULL,
  	"subject" varchar,
  	"headline" varchar,
  	"body_content" varchar,
  	"cta_text" varchar,
  	"cta_url" varchar
  );
  
  CREATE TABLE "festival_templates_linked_journeys" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"journey_id" integer,
  	"phase" varchar
  );
  
  CREATE TABLE "festival_templates" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"festival_name" varchar NOT NULL,
  	"festival_slug" varchar NOT NULL,
  	"festival_type" "enum_festival_templates_festival_type",
  	"description" varchar,
  	"is_active" boolean DEFAULT true,
  	"is_recurring" boolean DEFAULT true,
  	"schedule_typical_month" numeric,
  	"schedule_typical_day" numeric,
  	"schedule_days_before_start" numeric DEFAULT 7,
  	"schedule_duration_days" numeric DEFAULT 7,
  	"schedule_use_custom_dates" boolean,
  	"schedule_custom_start_date" timestamp(3) with time zone,
  	"schedule_custom_end_date" timestamp(3) with time zone,
  	"theme_primary_color" varchar,
  	"theme_secondary_color" varchar,
  	"theme_banner_image_id" integer,
  	"theme_mobile_image_id" integer,
  	"theme_tagline" varchar,
  	"theme_hashtag" varchar,
  	"points_config_multiplier" numeric DEFAULT 2,
  	"points_config_bonus_points" numeric DEFAULT 0,
  	"points_config_flash_points_hours" numeric DEFAULT 2,
  	"ai_recommendation_enabled" boolean DEFAULT true,
  	"ai_recommendation_strategy" "enum_festival_templates_ai_recommendation_strategy",
  	"ai_recommendation_max_products" numeric DEFAULT 6,
  	"ugc_integration_enabled" boolean DEFAULT true,
  	"ugc_integration_hashtag_campaign" varchar,
  	"ugc_integration_ugc_reward_points" numeric DEFAULT 20,
  	"kpi_targets_target_revenue" numeric,
  	"kpi_targets_target_conversion_rate" numeric,
  	"kpi_targets_target_open_rate" numeric,
  	"kpi_targets_target_click_rate" numeric,
  	"admin_note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "birthday_campaigns_phases_phase1_channels" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_birthday_campaigns_phases_phase1_channels",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "birthday_campaigns_phases_phase2_channels" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_birthday_campaigns_phases_phase2_channels",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "birthday_campaigns_phases_phase3_channels" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_birthday_campaigns_phases_phase3_channels",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "birthday_campaigns_phases_phase3_recommended_products" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"product_id" integer,
  	"reason" varchar
  );
  
  CREATE TABLE "birthday_campaigns_phases_phase4_channels" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_birthday_campaigns_phases_phase4_channels",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "birthday_campaigns_phases_phase5_channels" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_birthday_campaigns_phases_phase5_channels",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "birthday_campaigns" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"campaign_title" varchar NOT NULL,
  	"target_user_id" integer NOT NULL,
  	"target_tier" varchar,
  	"target_tier_front_name" varchar,
  	"target_segment" varchar,
  	"target_credit_score" numeric,
  	"birthday_month" numeric NOT NULL,
  	"birthday_year" numeric NOT NULL,
  	"status" "enum_birthday_campaigns_status" DEFAULT 'scheduled',
  	"phases_phase1_scheduled_date" timestamp(3) with time zone,
  	"phases_phase1_sent_at" timestamp(3) with time zone,
  	"phases_phase1_status" "enum_birthday_campaigns_phases_phase1_status" DEFAULT 'pending',
  	"phases_phase1_sent_message" jsonb,
  	"phases_phase2_scheduled_date" timestamp(3) with time zone,
  	"phases_phase2_sent_at" timestamp(3) with time zone,
  	"phases_phase2_status" "enum_birthday_campaigns_phases_phase2_status" DEFAULT 'pending',
  	"phases_phase2_sent_message" jsonb,
  	"phases_phase2_gifts_delivered_discount_applied" boolean,
  	"phases_phase2_gifts_delivered_shopping_credit_issued" boolean,
  	"phases_phase2_gifts_delivered_points_issued" boolean,
  	"phases_phase2_gifts_delivered_coupon_issued" boolean,
  	"phases_phase2_gifts_delivered_gift_box_sent" boolean,
  	"phases_phase2_gifts_delivered_styling_booked" boolean,
  	"phases_phase3_scheduled_date" timestamp(3) with time zone,
  	"phases_phase3_sent_at" timestamp(3) with time zone,
  	"phases_phase3_status" "enum_birthday_campaigns_phases_phase3_status" DEFAULT 'pending',
  	"phases_phase3_sent_message" jsonb,
  	"phases_phase4_scheduled_date" timestamp(3) with time zone,
  	"phases_phase4_sent_at" timestamp(3) with time zone,
  	"phases_phase4_status" "enum_birthday_campaigns_phases_phase4_status" DEFAULT 'pending',
  	"phases_phase4_sent_message" jsonb,
  	"phases_phase4_bonus_offer_extra_discount" numeric,
  	"phases_phase4_bonus_offer_extra_points" numeric,
  	"phases_phase4_bonus_offer_flash_deal_enabled" boolean,
  	"phases_phase5_scheduled_date" timestamp(3) with time zone,
  	"phases_phase5_sent_at" timestamp(3) with time zone,
  	"phases_phase5_status" "enum_birthday_campaigns_phases_phase5_status" DEFAULT 'pending',
  	"phases_phase5_sent_message" jsonb,
  	"phases_phase5_share_invite_sent" boolean DEFAULT false,
  	"gift_config_discount_percent" numeric,
  	"gift_config_shopping_credit" numeric,
  	"gift_config_bonus_points" numeric,
  	"gift_config_coupon_code" varchar,
  	"gift_config_points_multiplier" numeric DEFAULT 2,
  	"gift_config_free_shipping" boolean DEFAULT true,
  	"gift_config_priority_shipping" boolean DEFAULT false,
  	"gift_config_styling_minutes" numeric DEFAULT 0,
  	"gift_config_gift_box_included" boolean DEFAULT false,
  	"gift_config_credit_score_bonus" numeric DEFAULT 0,
  	"performance_total_messages_sent" numeric DEFAULT 0,
  	"performance_total_opened" numeric DEFAULT 0,
  	"performance_total_clicked" numeric DEFAULT 0,
  	"performance_total_converted" numeric DEFAULT 0,
  	"performance_total_revenue" numeric DEFAULT 0,
  	"admin_note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "automation_journeys_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"step_order" numeric,
  	"action" "enum_automation_journeys_steps_action",
  	"delay_minutes" numeric,
  	"template_key" varchar,
  	"content" varchar
  );
  
  CREATE TABLE "automation_journeys" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"is_active" boolean DEFAULT true,
  	"trigger_type" "enum_automation_journeys_trigger_type",
  	"trigger_event" "enum_automation_journeys_trigger_event",
  	"conditions" jsonb,
  	"priority" numeric,
  	"max_executions_per_user" numeric,
  	"cooldown_hours" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "automation_logs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"journey_id" integer,
  	"user_id" integer,
  	"status" "enum_automation_logs_status",
  	"current_step" numeric,
  	"executed_steps" jsonb,
  	"trigger_data" jsonb,
  	"error" varchar,
  	"completed_at" timestamp(3) with time zone,
  	"resume_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "ab_tests_variants" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"variant_name" varchar NOT NULL,
  	"variant_slug" varchar NOT NULL,
  	"message_template_id" integer,
  	"percentage" numeric NOT NULL,
  	"metrics_sent" numeric DEFAULT 0,
  	"metrics_opened" numeric DEFAULT 0,
  	"metrics_clicked" numeric DEFAULT 0,
  	"metrics_converted" numeric DEFAULT 0,
  	"metrics_revenue" numeric DEFAULT 0
  );
  
  CREATE TABLE "ab_tests" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"test_name" varchar NOT NULL,
  	"campaign_id" integer NOT NULL,
  	"status" "enum_ab_tests_status" DEFAULT 'draft',
  	"winner_metric" "enum_ab_tests_winner_metric" DEFAULT 'conversion_rate',
  	"winner_variant" varchar,
  	"confidence_level" numeric,
  	"auto_select_winner" boolean DEFAULT true,
  	"min_sample_size" numeric DEFAULT 100,
  	"started_at" timestamp(3) with time zone,
  	"completed_at" timestamp(3) with time zone,
  	"analysis_summary" varchar,
  	"analysis_recommendation" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "marketing_execution_logs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"campaign_id" integer NOT NULL,
  	"user_id" integer NOT NULL,
  	"channel" "enum_marketing_execution_logs_channel",
  	"message_template_id" integer,
  	"ab_test_variant" varchar,
  	"status" "enum_marketing_execution_logs_status" DEFAULT 'pending',
  	"personalized_data" jsonb,
  	"sent_at" timestamp(3) with time zone,
  	"delivered_at" timestamp(3) with time zone,
  	"opened_at" timestamp(3) with time zone,
  	"clicked_at" timestamp(3) with time zone,
  	"converted_at" timestamp(3) with time zone,
  	"conversion_order_id" varchar,
  	"conversion_revenue" numeric,
  	"error_message" varchar,
  	"user_segment" varchar,
  	"user_credit_score" numeric,
  	"user_tier" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "message_templates_variables" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"variable_name" varchar NOT NULL,
  	"variable_type" "enum_message_templates_variables_variable_type",
  	"default_value" varchar,
  	"description" varchar
  );
  
  CREATE TABLE "message_templates_segment_variants" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"segment" "enum_message_templates_segment_variants_segment",
  	"content_override" varchar,
  	"subject_override" varchar
  );
  
  CREATE TABLE "message_templates_credit_score_variants" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"min_score" numeric,
  	"max_score" numeric,
  	"content_override" varchar,
  	"extra_discount" numeric
  );
  
  CREATE TABLE "message_templates_tier_variants" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tier_code" "enum_message_templates_tier_variants_tier_code",
  	"content_override" varchar
  );
  
  CREATE TABLE "message_templates_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tag" varchar
  );
  
  CREATE TABLE "message_templates" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"template_name" varchar NOT NULL,
  	"template_slug" varchar NOT NULL,
  	"channel" "enum_message_templates_channel" NOT NULL,
  	"category" "enum_message_templates_category",
  	"subject" varchar,
  	"content" jsonb,
  	"text_content" varchar,
  	"html_content" varchar,
  	"line_flex_message" jsonb,
  	"is_active" boolean DEFAULT true,
  	"preview_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "email_templates" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"event_key" "enum_email_templates_event_key" NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"subject" varchar NOT NULL,
  	"preheader" varchar,
  	"headline" varchar NOT NULL,
  	"body_html" varchar NOT NULL,
  	"preview_sample" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "newsletter_subscribers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"status" "enum_newsletter_subscribers_status" DEFAULT 'subscribed' NOT NULL,
  	"name" varchar,
  	"source" "enum_newsletter_subscribers_source" DEFAULT 'homepage',
  	"kim_blog_subscribed" boolean DEFAULT false,
  	"kim_blog_subscribed_at" timestamp(3) with time zone,
  	"user_id" integer,
  	"locale" varchar,
  	"unsubscribe_token" varchar,
  	"confirmed_at" timestamp(3) with time zone,
  	"unsubscribed_at" timestamp(3) with time zone,
  	"ip_address" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "utm_campaigns" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"source" "enum_utm_campaigns_source" DEFAULT 'facebook' NOT NULL,
  	"medium" "enum_utm_campaigns_medium" DEFAULT 'cpc' NOT NULL,
  	"default_content" varchar,
  	"default_term" varchar,
  	"start_date" timestamp(3) with time zone,
  	"end_date" timestamp(3) with time zone,
  	"budget" numeric,
  	"spend" numeric,
  	"status" "enum_utm_campaigns_status" DEFAULT 'planning',
  	"campaign_notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "ad_audiences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"description" varchar,
  	"type" "enum_ad_audiences_type" DEFAULT 'viewers' NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"time_window_days" numeric DEFAULT 14 NOT NULL,
  	"exclude_purchasers_days" numeric DEFAULT 14,
  	"sync_status" "enum_ad_audiences_sync_status" DEFAULT 'idle',
  	"meta_audience_id" varchar,
  	"last_sync_at" timestamp(3) with time zone,
  	"sync_error" varchar,
  	"estimated_size" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "ad_audiences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"products_id" integer
  );
  
  CREATE TABLE "search_console_keywords" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"query" varchar NOT NULL,
  	"page_path" varchar,
  	"target_product_id" integer,
  	"source" "enum_search_console_keywords_source" DEFAULT 'gsc',
  	"impressions" numeric DEFAULT 0,
  	"clicks" numeric DEFAULT 0,
  	"ctr" numeric DEFAULT 0,
  	"position" numeric,
  	"opportunity_score" numeric DEFAULT 0,
  	"intent" "enum_search_console_keywords_intent" DEFAULT 'unknown',
  	"status" "enum_search_console_keywords_status" DEFAULT 'new',
  	"suggestions_title" varchar,
  	"suggestions_meta_description" varchar,
  	"suggestions_faq" jsonb,
  	"suggestions_copy_patch" varchar,
  	"imported_at" timestamp(3) with time zone,
  	"last_applied_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "competitor_price_records_flags" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_competitor_price_records_flags",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "competitor_price_records" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"product_name" varchar NOT NULL,
  	"normalized_name" varchar,
  	"related_product_id" integer,
  	"platform" "enum_competitor_price_records_platform" DEFAULT 'other',
  	"competitor_name" varchar,
  	"source_url" varchar,
  	"price_t_w_d" numeric,
  	"price_k_r_w" numeric,
  	"estimated_cost_t_w_d" numeric,
  	"style" varchar,
  	"material" varchar,
  	"observed_at" timestamp(3) with time zone,
  	"metrics_margin_score" numeric,
  	"metrics_trend_score" numeric,
  	"metrics_risk_score" numeric,
  	"metrics_matching_score" numeric,
  	"metrics_live_score" numeric,
  	"metrics_ads_score" numeric,
  	"metrics_estimated_margin_percent" numeric,
  	"total_score" numeric DEFAULT 0,
  	"purchase_recommendation" varchar,
  	"status" "enum_competitor_price_records_status" DEFAULT 'new',
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "marketing_content_drafts_channels" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_marketing_content_drafts_channels",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "marketing_content_drafts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"type" "enum_marketing_content_drafts_type" NOT NULL,
  	"title" varchar NOT NULL,
  	"status" "enum_marketing_content_drafts_status" DEFAULT 'draft',
  	"target_product_id" integer,
  	"target_segment" "enum_marketing_content_drafts_target_segment" DEFAULT 'all',
  	"body" varchar NOT NULL,
  	"hashtags" jsonb,
  	"metadata" jsonb,
  	"scheduled_at" timestamp(3) with time zone,
  	"generated_by" varchar DEFAULT 'whitehat-automation',
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "customer_service_tickets_messages" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"sender" "enum_customer_service_tickets_messages_sender",
  	"content" varchar,
  	"timestamp" timestamp(3) with time zone,
  	"metadata" jsonb
  );
  
  CREATE TABLE "customer_service_tickets" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"ticket_number" varchar NOT NULL,
  	"user_id" integer,
  	"channel" "enum_customer_service_tickets_channel",
  	"status" "enum_customer_service_tickets_status",
  	"priority" "enum_customer_service_tickets_priority",
  	"category" "enum_customer_service_tickets_category",
  	"subject" varchar,
  	"assigned_agent_id" integer,
  	"ai_summary" varchar,
  	"sentiment" "enum_customer_service_tickets_sentiment",
  	"escalation_reason" varchar,
  	"related_order_id" integer,
  	"resolution" varchar,
  	"resolved_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "concierge_service_requests_request_detail_attachments" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"file_id" integer
  );
  
  CREATE TABLE "concierge_service_requests_concierge_notes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"note" varchar NOT NULL,
  	"note_type" "enum_concierge_service_requests_concierge_notes_note_type",
  	"added_by_id" integer,
  	"added_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "concierge_service_requests" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"request_number" varchar NOT NULL,
  	"requester_id" integer NOT NULL,
  	"requester_tier" varchar,
  	"requester_credit_score" numeric,
  	"assigned_concierge_id" integer,
  	"service_type" "enum_concierge_service_requests_service_type" NOT NULL,
  	"priority" "enum_concierge_service_requests_priority" DEFAULT 'normal',
  	"status" "enum_concierge_service_requests_status" DEFAULT 'submitted',
  	"request_detail_description" varchar NOT NULL,
  	"request_detail_preferred_date" timestamp(3) with time zone,
  	"request_detail_preferred_time" varchar,
  	"request_detail_location" varchar,
  	"request_detail_budget" varchar,
  	"request_detail_number_of_people" numeric,
  	"request_detail_special_requirements" varchar,
  	"ai_response_ai_suggestion" varchar,
  	"ai_response_ai_confidence" numeric,
  	"ai_response_ai_processed_at" timestamp(3) with time zone,
  	"ai_response_ai_recommended_options" jsonb,
  	"resolution_outcome" varchar,
  	"resolution_customer_satisfaction" numeric,
  	"resolution_feedback_note" varchar,
  	"resolution_completed_at" timestamp(3) with time zone,
  	"resolution_total_cost" numeric,
  	"resolution_invoice_number" varchar,
  	"related_order_id" integer,
  	"is_birthday_month_request" boolean DEFAULT false,
  	"birthday_month_upgrade" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "affiliates_withdrawal_requests" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"amount" numeric NOT NULL,
  	"status" "enum_affiliates_withdrawal_requests_status" DEFAULT 'pending',
  	"requested_at" timestamp(3) with time zone,
  	"processed_at" timestamp(3) with time zone,
  	"admin_note" varchar
  );
  
  CREATE TABLE "affiliates" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"referral_code" varchar NOT NULL,
  	"commission_rate" numeric DEFAULT 10 NOT NULL,
  	"status" "enum_affiliates_status" DEFAULT 'active' NOT NULL,
  	"total_earnings" numeric DEFAULT 0,
  	"withdrawable_amount" numeric DEFAULT 0,
  	"pending_amount" numeric DEFAULT 0,
  	"total_withdrawn" numeric DEFAULT 0,
  	"bank_info_bank_name" varchar,
  	"bank_info_branch_name" varchar,
  	"bank_info_account_number" varchar,
  	"bank_info_account_holder" varchar,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "ugc_posts_media_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"file_id" integer NOT NULL,
  	"thumbnail_url" varchar,
  	"video_url" varchar
  );
  
  CREATE TABLE "ugc_posts_display_locations" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_ugc_posts_display_locations",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "ugc_posts_hashtags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tag" varchar
  );
  
  CREATE TABLE "ugc_posts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"platform" "enum_ugc_posts_platform" NOT NULL,
  	"source_type" "enum_ugc_posts_source_type",
  	"external_id" varchar,
  	"external_url" varchar,
  	"author_name" varchar NOT NULL,
  	"author_handle" varchar,
  	"author_avatar_id" integer,
  	"content_type" "enum_ugc_posts_content_type" NOT NULL,
  	"caption" varchar,
  	"likes" numeric DEFAULT 0,
  	"comments" numeric DEFAULT 0,
  	"shares" numeric DEFAULT 0,
  	"views" numeric DEFAULT 0,
  	"published_at" timestamp(3) with time zone,
  	"status" "enum_ugc_posts_status" DEFAULT 'pending',
  	"is_pinned" boolean DEFAULT false,
  	"sort_order" numeric DEFAULT 0,
  	"display_layout" "enum_ugc_posts_display_layout",
  	"admin_note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "ugc_posts_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"products_id" integer
  );
  
  CREATE TABLE "prize_pools_eligible_games" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_prize_pools_eligible_games",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "prize_pools" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"prize_type" "enum_prize_pools_prize_type" NOT NULL,
  	"amount" numeric DEFAULT 0,
  	"coupon_code" varchar,
  	"description" varchar,
  	"image_id" integer,
  	"weight" numeric DEFAULT 10 NOT NULL,
  	"tier_boost_ordinary" numeric DEFAULT 1,
  	"tier_boost_bronze" numeric DEFAULT 1,
  	"tier_boost_silver" numeric DEFAULT 1,
  	"tier_boost_gold" numeric DEFAULT 1,
  	"tier_boost_platinum" numeric DEFAULT 1,
  	"tier_boost_diamond" numeric DEFAULT 1,
  	"active" boolean DEFAULT true,
  	"inventory_unlimited" boolean DEFAULT true,
  	"inventory_total" numeric,
  	"inventory_remaining" numeric,
  	"starts_at" timestamp(3) with time zone,
  	"ends_at" timestamp(3) with time zone,
  	"delivery_method" "enum_prize_pools_delivery_method" DEFAULT 'instant_credit' NOT NULL,
  	"redemption_instructions" varchar,
  	"expiry_days" numeric DEFAULT 365,
  	"max_per_user_monthly" numeric,
  	"max_per_user_lifetime" numeric,
  	"estimated_value" numeric,
  	"admin_notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "mini_game_records" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"player_id" integer NOT NULL,
  	"game_type" "enum_mini_game_records_game_type" NOT NULL,
  	"result_outcome" "enum_mini_game_records_result_outcome" NOT NULL,
  	"result_prize_type" "enum_mini_game_records_result_prize_type",
  	"result_prize_amount" numeric,
  	"result_prize_description" varchar,
  	"result_coupon_code" varchar,
  	"points_spent" numeric DEFAULT 0,
  	"metadata" jsonb,
  	"player_tier" varchar,
  	"player_credit_score" numeric,
  	"referral_code" varchar,
  	"status" "enum_mini_game_records_status" DEFAULT 'completed',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "card_battles" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"room_code" varchar NOT NULL,
  	"challenger_id" integer NOT NULL,
  	"opponent_id" integer,
  	"referral_code" varchar,
  	"status" "enum_card_battles_status" DEFAULT 'waiting' NOT NULL,
  	"challenger_card_rank" numeric,
  	"challenger_card_suit" "enum_card_battles_challenger_card_suit",
  	"challenger_card_drawn_at" timestamp(3) with time zone,
  	"opponent_card_rank" numeric,
  	"opponent_card_suit" "enum_card_battles_opponent_card_suit",
  	"opponent_card_drawn_at" timestamp(3) with time zone,
  	"result_winner" "enum_card_battles_result_winner",
  	"result_challenger_prize_type" "enum_card_battles_result_challenger_prize_type",
  	"result_challenger_prize_amount" numeric,
  	"result_challenger_prize_description" varchar,
  	"result_opponent_prize_type" "enum_card_battles_result_opponent_prize_type",
  	"result_opponent_prize_amount" numeric,
  	"result_opponent_prize_description" varchar,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "game_leaderboard_badges" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"badge_id" varchar NOT NULL,
  	"badge_name" varchar NOT NULL,
  	"badge_icon" varchar,
  	"earned_at" timestamp(3) with time zone NOT NULL,
  	"badge_type" "enum_game_leaderboard_badges_badge_type"
  );
  
  CREATE TABLE "game_leaderboard" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"player_id" integer NOT NULL,
  	"period" "enum_game_leaderboard_period" NOT NULL,
  	"period_key" varchar NOT NULL,
  	"total_points" numeric DEFAULT 0,
  	"games_played" numeric DEFAULT 0,
  	"wins" numeric DEFAULT 0,
  	"streak" numeric DEFAULT 0,
  	"rank" numeric,
  	"player_tier" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "collectible_card_templates" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"product_id" integer NOT NULL,
  	"admin_title" varchar NOT NULL,
  	"is_active" boolean DEFAULT true,
  	"total_supply" numeric DEFAULT 500 NOT NULL,
  	"sale_pool" numeric DEFAULT 350 NOT NULL,
  	"points_shop_pool" numeric DEFAULT 100 NOT NULL,
  	"crafting_pool" numeric DEFAULT 50 NOT NULL,
  	"sale_pool_remaining" numeric DEFAULT 350 NOT NULL,
  	"points_shop_pool_remaining" numeric DEFAULT 100 NOT NULL,
  	"crafting_pool_remaining" numeric DEFAULT 50 NOT NULL,
  	"next_serial_no" numeric DEFAULT 1 NOT NULL,
  	"points_shop_price" numeric DEFAULT 1200 NOT NULL,
  	"burn_points_reward" numeric DEFAULT 500 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "collectible_cards" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"display_title" varchar,
  	"card_type" "enum_collectible_cards_card_type" NOT NULL,
  	"product_id" integer NOT NULL,
  	"template_id" integer,
  	"serial_no" numeric,
  	"owner_id" integer,
  	"original_owner_id" integer,
  	"status" "enum_collectible_cards_status" DEFAULT 'active' NOT NULL,
  	"minted_via" "enum_collectible_cards_minted_via" NOT NULL,
  	"source_order_id" integer,
  	"minted_at" timestamp(3) with time zone NOT NULL,
  	"design_seed" varchar NOT NULL,
  	"share_slug" varchar NOT NULL,
  	"owner_nickname_snapshot" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "collectible_card_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"card_id" integer NOT NULL,
  	"action" "enum_collectible_card_events_action" NOT NULL,
  	"from_user_id" integer,
  	"to_user_id" integer,
  	"points_delta" numeric,
  	"source_order_id" integer,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "style_submissions_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL
  );
  
  CREATE TABLE "style_submissions_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tag" varchar NOT NULL
  );
  
  CREATE TABLE "style_submissions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"player_id" integer NOT NULL,
  	"game_type" "enum_style_submissions_game_type" NOT NULL,
  	"room_id" integer,
  	"parent_id" integer,
  	"wish_id" integer,
  	"theme" varchar,
  	"caption" varchar,
  	"status" "enum_style_submissions_status" DEFAULT 'submitted' NOT NULL,
  	"rank" numeric,
  	"vote_count" numeric DEFAULT 0,
  	"view_count" numeric DEFAULT 0,
  	"player_tier_snapshot" varchar,
  	"moderation_reviewed_by_id" integer,
  	"moderation_reviewed_at" timestamp(3) with time zone,
  	"moderation_note" varchar,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "style_game_rooms_participants" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"role" "enum_style_game_rooms_participants_role" DEFAULT 'member' NOT NULL,
  	"joined_at" timestamp(3) with time zone,
  	"status" "enum_style_game_rooms_participants_status" DEFAULT 'active' NOT NULL
  );
  
  CREATE TABLE "style_game_rooms" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"room_code" varchar NOT NULL,
  	"game_type" "enum_style_game_rooms_game_type" NOT NULL,
  	"host_id" integer NOT NULL,
  	"capacity" numeric DEFAULT 2 NOT NULL,
  	"visibility" "enum_style_game_rooms_visibility" DEFAULT 'private' NOT NULL,
  	"invite_code" varchar,
  	"theme" varchar,
  	"settings" jsonb,
  	"status" "enum_style_game_rooms_status" DEFAULT 'waiting' NOT NULL,
  	"started_at" timestamp(3) with time zone,
  	"settled_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"result_winner_id" integer,
  	"result_total_submissions" numeric,
  	"result_total_votes" numeric,
  	"result_summary" varchar,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "style_votes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"voter_id" integer NOT NULL,
  	"submission_id" integer NOT NULL,
  	"room_id" integer,
  	"vote_type" "enum_style_votes_vote_type" DEFAULT 'like' NOT NULL,
  	"score" numeric,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "style_wishes_reference_photos" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL
  );
  
  CREATE TABLE "style_wishes_grants" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"granter_id" integer NOT NULL,
  	"submission_id" integer NOT NULL,
  	"note" varchar
  );
  
  CREATE TABLE "style_wishes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"seeker_id" integer NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar NOT NULL,
  	"budget_hint" varchar,
  	"bounty_points" numeric DEFAULT 0,
  	"status" "enum_style_wishes_status" DEFAULT 'open' NOT NULL,
  	"winning_grant_id" integer,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "daily_horoscopes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"zodiac_sign" "enum_daily_horoscopes_zodiac_sign" NOT NULL,
  	"date" varchar NOT NULL,
  	"gender" "enum_daily_horoscopes_gender" NOT NULL,
  	"work_fortune" varchar NOT NULL,
  	"relationship_fortune" varchar NOT NULL,
  	"money_fortune" varchar NOT NULL,
  	"caution_fortune" varchar NOT NULL,
  	"outfit_advice" varchar NOT NULL,
  	"lucky_colors" varchar,
  	"style_keywords" varchar,
  	"generated_by" "enum_daily_horoscopes_generated_by" DEFAULT 'seed',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "pages_blocks_hero_banner" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar NOT NULL,
  	"subheading" varchar,
  	"background_image_id" integer,
  	"cta_text" varchar,
  	"cta_link" varchar,
  	"overlay" numeric DEFAULT 30,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_magazine_cover_corner_labels" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_magazine_cover" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"issue_label" varchar,
  	"heading" varchar NOT NULL,
  	"subheading" varchar,
  	"image_id" integer,
  	"layout" "enum_pages_blocks_magazine_cover_layout" DEFAULT 'banner',
  	"theme" "enum_pages_blocks_magazine_cover_theme" DEFAULT 'light',
  	"object_position" "enum_pages_blocks_magazine_cover_object_position" DEFAULT 'center',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_pull_quote" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"quote" varchar NOT NULL,
  	"source" varchar,
  	"font" "enum_pages_blocks_pull_quote_font" DEFAULT 'serif',
  	"alignment" "enum_pages_blocks_pull_quote_alignment" DEFAULT 'center',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_editorial_spread_rows" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"heading" varchar,
  	"body" jsonb,
  	"image_position" "enum_pages_blocks_editorial_spread_rows_image_position" DEFAULT 'left',
  	"background" "enum_pages_blocks_editorial_spread_rows_background" DEFAULT 'cream'
  );
  
  CREATE TABLE "pages_blocks_editorial_spread" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_lookbook_grid_items_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_lookbook_grid_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL,
  	"name" varchar,
  	"linked_product_id" integer,
  	"link_url" varchar
  );
  
  CREATE TABLE "pages_blocks_lookbook_grid" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"columns" "enum_pages_blocks_lookbook_grid_columns" DEFAULT '3',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_celebrity_grid" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"subheading" varchar,
  	"columns" "enum_pages_blocks_celebrity_grid_columns" DEFAULT '4',
  	"show_bio_on_hover" boolean DEFAULT true,
  	"max_items" numeric,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_kol_persona_social_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"platform" "enum_pages_blocks_kol_persona_social_links_platform" NOT NULL,
  	"url" varchar NOT NULL
  );
  
  CREATE TABLE "pages_blocks_kol_persona" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"avatar_id" integer,
  	"name" varchar NOT NULL,
  	"title" varchar,
  	"bio" jsonb,
  	"signature_quote" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_rich_content" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"content" jsonb NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_image_gallery_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL,
  	"caption" varchar,
  	"link" varchar
  );
  
  CREATE TABLE "pages_blocks_image_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"layout" "enum_pages_blocks_image_gallery_layout" DEFAULT 'grid',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_product_showcase" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"display_style" "enum_pages_blocks_product_showcase_display_style" DEFAULT 'grid',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_cta" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar NOT NULL,
  	"description" varchar,
  	"button_text" varchar NOT NULL,
  	"button_link" varchar NOT NULL,
  	"background_image_id" integer,
  	"style" "enum_pages_blocks_cta_style" DEFAULT 'primary',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_faq_questions" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar NOT NULL,
  	"answer" jsonb NOT NULL
  );
  
  CREATE TABLE "pages_blocks_faq" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar DEFAULT '常見問題',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_testimonial_testimonials" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"content" varchar NOT NULL,
  	"avatar_id" integer,
  	"rating" numeric
  );
  
  CREATE TABLE "pages_blocks_testimonial" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar DEFAULT '顧客好評',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_countdown" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar NOT NULL,
  	"description" varchar,
  	"end_date" timestamp(3) with time zone NOT NULL,
  	"background_image_id" integer,
  	"cta_text" varchar,
  	"cta_link" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_video" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"url" varchar NOT NULL,
  	"caption" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_divider" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"style" "enum_pages_blocks_divider_style" DEFAULT 'line',
  	"height" numeric DEFAULT 40,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"status" "enum_pages_status" DEFAULT 'draft' NOT NULL,
  	"seo_meta_title" varchar,
  	"seo_meta_description" varchar,
  	"seo_meta_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "pages_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"products_id" integer
  );
  
  CREATE TABLE "celebrity_features_gallery_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL,
  	"caption" varchar,
  	"linked_product_id" integer
  );
  
  CREATE TABLE "celebrity_features_social_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"platform" "enum_celebrity_features_social_links_platform" NOT NULL,
  	"url" varchar NOT NULL,
  	"handle" varchar
  );
  
  CREATE TABLE "celebrity_features" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"program" varchar NOT NULL,
  	"photo_id" integer NOT NULL,
  	"tagline" varchar,
  	"bio" varchar,
  	"brand_quote" varchar,
  	"link_type" "enum_celebrity_features_link_type" DEFAULT 'pdp' NOT NULL,
  	"linked_product_id" integer,
  	"link_url" varchar,
  	"sort_order" numeric DEFAULT 0,
  	"status" "enum_celebrity_features_status" DEFAULT 'published' NOT NULL,
  	"admin_note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "podcasts_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tag" varchar NOT NULL
  );
  
  CREATE TABLE "podcasts_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"url" varchar
  );
  
  CREATE TABLE "podcasts_hosts" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"role" varchar
  );
  
  CREATE TABLE "podcasts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"episode_number" numeric NOT NULL,
  	"excerpt" varchar,
  	"category" "enum_podcasts_category" DEFAULT 'trends' NOT NULL,
  	"audio_file_id" integer NOT NULL,
  	"duration" numeric,
  	"cover_image_id" integer,
  	"show_notes" jsonb,
  	"ai_generated" boolean DEFAULT false,
  	"notebook_id" varchar,
  	"status" "enum_podcasts_status" DEFAULT 'draft' NOT NULL,
  	"published_at" timestamp(3) with time zone,
  	"seo_meta_title" varchar,
  	"seo_meta_description" varchar,
  	"seo_meta_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "podcasts_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"products_id" integer,
  	"categories_id" integer
  );
  
  CREATE TABLE "site_themes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"season" "enum_site_themes_season" DEFAULT 'default' NOT NULL,
  	"is_active" boolean DEFAULT false,
  	"palette_primary" varchar DEFAULT '#C19A5B' NOT NULL,
  	"palette_accent" varchar DEFAULT '#EFBBAA' NOT NULL,
  	"palette_surface" varchar DEFAULT '#F9F5EC' NOT NULL,
  	"palette_ink" varchar DEFAULT '#2C2C2C' NOT NULL,
  	"palette_on_primary" varchar DEFAULT '#FDFBF7' NOT NULL,
  	"palette_on_accent" varchar DEFAULT '#2C2C2C' NOT NULL,
  	"palette_hero_overlay_from" varchar DEFAULT '#000000' NOT NULL,
  	"palette_hero_overlay_to" varchar DEFAULT '#000000' NOT NULL,
  	"palette_hero_overlay_opacity" numeric DEFAULT 0.45,
  	"serif_font" "enum_site_themes_serif_font" DEFAULT 'noto-serif-tc',
  	"sans_font" "enum_site_themes_sans_font" DEFAULT 'noto-sans-tc',
  	"hero_layout" "enum_site_themes_hero_layout" DEFAULT 'split' NOT NULL,
  	"hero_min_height_desktop" numeric DEFAULT 85,
  	"hero_min_height_mobile" numeric DEFAULT 60,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar,
  	"caption" varchar,
  	"folder_name" varchar,
  	"usage_rights_source_label" varchar,
  	"usage_rights_source_url" varchar,
  	"usage_rights_creator" varchar,
  	"usage_rights_license_kind" "enum_media_usage_rights_license_kind" DEFAULT 'unknown',
  	"usage_rights_license_url" varchar,
  	"usage_rights_evidence_url" varchar,
  	"usage_rights_promotional_use_allowed" boolean DEFAULT false,
  	"usage_rights_verified_at" timestamp(3) with time zone,
  	"usage_rights_verification_note" varchar,
  	"folder_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_thumbnail_url" varchar,
  	"sizes_thumbnail_width" numeric,
  	"sizes_thumbnail_height" numeric,
  	"sizes_thumbnail_mime_type" varchar,
  	"sizes_thumbnail_filesize" numeric,
  	"sizes_thumbnail_filename" varchar,
  	"sizes_card_url" varchar,
  	"sizes_card_width" numeric,
  	"sizes_card_height" numeric,
  	"sizes_card_mime_type" varchar,
  	"sizes_card_filesize" numeric,
  	"sizes_card_filename" varchar,
  	"sizes_blog800_url" varchar,
  	"sizes_blog800_width" numeric,
  	"sizes_blog800_height" numeric,
  	"sizes_blog800_mime_type" varchar,
  	"sizes_blog800_filesize" numeric,
  	"sizes_blog800_filename" varchar,
  	"sizes_blog1000_url" varchar,
  	"sizes_blog1000_width" numeric,
  	"sizes_blog1000_height" numeric,
  	"sizes_blog1000_mime_type" varchar,
  	"sizes_blog1000_filesize" numeric,
  	"sizes_blog1000_filename" varchar,
  	"sizes_tablet_url" varchar,
  	"sizes_tablet_width" numeric,
  	"sizes_tablet_height" numeric,
  	"sizes_tablet_mime_type" varchar,
  	"sizes_tablet_filesize" numeric,
  	"sizes_tablet_filename" varchar,
  	"sizes_desktop_url" varchar,
  	"sizes_desktop_width" numeric,
  	"sizes_desktop_height" numeric,
  	"sizes_desktop_mime_type" varchar,
  	"sizes_desktop_filesize" numeric,
  	"sizes_desktop_filename" varchar
  );
  
  CREATE TABLE "login_attempts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar,
  	"user_id" varchar,
  	"ip" varchar,
  	"user_agent" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "currencies" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar NOT NULL,
  	"label" varchar NOT NULL,
  	"symbol" varchar NOT NULL,
  	"rate_against_twd" numeric DEFAULT 1 NOT NULL,
  	"decimal_places" numeric DEFAULT 0,
  	"is_active" boolean DEFAULT true,
  	"display_order" numeric DEFAULT 100,
  	"description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_folders_folder_type" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_payload_folders_folder_type",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "payload_folders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"folder_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"blog_posts_id" integer,
  	"blog_categories_id" integer,
  	"orders_id" integer,
  	"invoices_id" integer,
  	"returns_id" integer,
  	"exchanges_id" integer,
  	"refunds_id" integer,
  	"shipping_methods_id" integer,
  	"products_id" integer,
  	"categories_id" integer,
  	"size_charts_id" integer,
  	"product_reviews_id" integer,
  	"inventory_transactions_id" integer,
  	"purchase_orders_id" integer,
  	"stock_takes_id" integer,
  	"users_id" integer,
  	"membership_tiers_id" integer,
  	"member_segments_id" integer,
  	"subscription_plans_id" integer,
  	"user_subscriptions_id" integer,
  	"points_transactions_id" integer,
  	"points_redemptions_id" integer,
  	"user_rewards_id" integer,
  	"credit_score_history_id" integer,
  	"wallet_transactions_id" integer,
  	"wallet_withdrawals_id" integer,
  	"wishlist_items_id" integer,
  	"conversations_id" integer,
  	"messages_id" integer,
  	"message_tags_id" integer,
  	"conversation_activities_id" integer,
  	"product_view_events_id" integer,
  	"behavior_events_id" integer,
  	"coupons_id" integer,
  	"coupon_redemptions_id" integer,
  	"add_on_products_id" integer,
  	"gift_rules_id" integer,
  	"bundles_id" integer,
  	"marketing_campaigns_id" integer,
  	"promotion_rules_id" integer,
  	"promotion_applications_id" integer,
  	"festival_templates_id" integer,
  	"birthday_campaigns_id" integer,
  	"automation_journeys_id" integer,
  	"automation_logs_id" integer,
  	"ab_tests_id" integer,
  	"marketing_execution_logs_id" integer,
  	"message_templates_id" integer,
  	"email_templates_id" integer,
  	"newsletter_subscribers_id" integer,
  	"utm_campaigns_id" integer,
  	"ad_audiences_id" integer,
  	"search_console_keywords_id" integer,
  	"competitor_price_records_id" integer,
  	"marketing_content_drafts_id" integer,
  	"customer_service_tickets_id" integer,
  	"concierge_service_requests_id" integer,
  	"affiliates_id" integer,
  	"ugc_posts_id" integer,
  	"prize_pools_id" integer,
  	"mini_game_records_id" integer,
  	"card_battles_id" integer,
  	"game_leaderboard_id" integer,
  	"collectible_card_templates_id" integer,
  	"collectible_cards_id" integer,
  	"collectible_card_events_id" integer,
  	"style_submissions_id" integer,
  	"style_game_rooms_id" integer,
  	"style_votes_id" integer,
  	"style_wishes_id" integer,
  	"daily_horoscopes_id" integer,
  	"pages_id" integer,
  	"celebrity_features_id" integer,
  	"podcasts_id" integer,
  	"site_themes_id" integer,
  	"media_id" integer,
  	"login_attempts_id" integer,
  	"currencies_id" integer,
  	"payload_folders_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "checkout_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"require_tos" boolean DEFAULT true,
  	"tos_link_text" varchar DEFAULT '同意服務條款與隱私權政策',
  	"require_marketing_consent" boolean DEFAULT false,
  	"marketing_consent_text" varchar DEFAULT '我願意收到 CHIC KIM & MIU 最新活動與優惠資訊',
  	"field_requirements_phone_required" boolean DEFAULT true,
  	"field_requirements_birthday_required" boolean DEFAULT false,
  	"field_requirements_national_id_required" boolean DEFAULT false,
  	"field_requirements_gender_required" boolean DEFAULT false,
  	"checkout_as_guest" boolean DEFAULT true,
  	"min_order_amount" numeric DEFAULT 0,
  	"max_items_per_order" numeric DEFAULT 99,
  	"notes_allow_order_note" boolean DEFAULT true,
  	"notes_order_note_label" varchar DEFAULT '給賣家的備註',
  	"notes_order_note_max_length" numeric DEFAULT 200,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "order_settings_notifications_admin_alert_emails" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL
  );
  
  CREATE TABLE "order_settings_status_flow_custom_statuses" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar NOT NULL,
  	"label" varchar NOT NULL,
  	"sort_order" numeric DEFAULT 100
  );
  
  CREATE TABLE "order_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"numbering_prefix" varchar DEFAULT 'CKMU',
  	"numbering_include_date" boolean DEFAULT true,
  	"numbering_sequence_digits" numeric DEFAULT 3,
  	"numbering_sequence_reset_daily" boolean DEFAULT true,
  	"auto_actions_auto_cancel_unpaid_minutes" numeric DEFAULT 60,
  	"auto_actions_auto_complete_after_delivery" boolean DEFAULT false,
  	"auto_actions_auto_complete_after_days" numeric DEFAULT 7,
  	"notifications_send_confirmation_email" boolean DEFAULT true,
  	"notifications_send_shipped_email" boolean DEFAULT true,
  	"notifications_send_delivered_email" boolean DEFAULT true,
  	"notifications_send_admin_new_order_alert" boolean DEFAULT true,
  	"cvs_shipping_sender_name" varchar DEFAULT '靚秀國際',
  	"cvs_shipping_sender_cell_phone" varchar,
  	"cvs_shipping_return_store_id" varchar,
  	"home_shipping_sender_name" varchar,
  	"home_shipping_sender_cell_phone" varchar,
  	"home_shipping_sender_zip_code" varchar,
  	"home_shipping_sender_address" varchar,
  	"home_shipping_temperature" "enum_order_settings_home_shipping_temperature" DEFAULT '0001',
  	"home_shipping_specification" "enum_order_settings_home_shipping_specification" DEFAULT '0001',
  	"home_shipping_default_goods_weight" numeric DEFAULT 1,
  	"status_flow_enable_processing" boolean DEFAULT true,
  	"status_flow_auto_status_from_logistics" boolean DEFAULT true,
  	"status_flow_enable_ready_for_pickup" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "invoice_settings_automation_config_notify_channels" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_invoice_settings_automation_config_notify_channels",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "invoice_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"ecpay_config_merchant_id" varchar,
  	"ecpay_config_hash_key" varchar,
  	"ecpay_config_hash_i_v" varchar,
  	"ecpay_config_environment" "enum_invoice_settings_ecpay_config_environment" DEFAULT 'test',
  	"ecpay_config_test_gateway_url" varchar DEFAULT 'https://einvoice-stage.ecpay.com.tw',
  	"ecpay_config_prod_gateway_url" varchar DEFAULT 'https://einvoice.ecpay.com.tw',
  	"seller_info_seller_u_b_n" varchar NOT NULL,
  	"seller_info_seller_name" varchar DEFAULT '靚秀國際有限公司' NOT NULL,
  	"seller_info_seller_address" varchar DEFAULT '臺北市信義區基隆路一段68號9樓',
  	"seller_info_seller_phone" varchar,
  	"seller_info_seller_email" varchar,
  	"branding_config_invoice_logo_id" integer,
  	"branding_config_company_chop_id" integer,
  	"branding_config_footer_text" varchar DEFAULT '感謝您的購買！CHIC KIM & MIU 靚秀國際有限公司',
  	"automation_config_auto_issue_enabled" boolean DEFAULT true,
  	"automation_config_auto_notify_enabled" boolean DEFAULT true,
  	"automation_config_retry_enabled" boolean DEFAULT true,
  	"automation_config_max_retry_count" numeric DEFAULT 3,
  	"automation_config_retry_interval_minutes" numeric DEFAULT 5,
  	"default_config_default_invoice_type" "enum_invoice_settings_default_config_default_invoice_type" DEFAULT 'b2c_personal',
  	"default_config_default_donation_code" varchar,
  	"default_config_default_tax_type" "enum_invoice_settings_default_config_default_tax_type" DEFAULT 'taxable',
  	"default_config_item_tax_free" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "tax_settings_tax_categories" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar NOT NULL,
  	"label" varchar NOT NULL,
  	"rate" numeric DEFAULT 0,
  	"exempt" boolean DEFAULT false
  );
  
  CREATE TABLE "tax_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"default_tax_included" boolean DEFAULT true,
  	"default_tax_rate" numeric DEFAULT 5,
  	"shipping_taxable" boolean DEFAULT true,
  	"invoice_breakdown_show_tax_line" boolean DEFAULT true,
  	"invoice_breakdown_rounding_mode" "enum_tax_settings_invoice_breakdown_rounding_mode" DEFAULT 'round_half_up',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "loyalty_settings_recommendation_config_placements" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"location" "loy_place_location" NOT NULL,
  	"strategy" "loy_place_strategy" DEFAULT 'hybrid',
  	"max_items" numeric DEFAULT 4,
  	"exclude_out_of_stock" boolean DEFAULT true
  );
  
  CREATE TABLE "loyalty_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"points_config_enabled" boolean DEFAULT true,
  	"points_config_points_per_dollar" numeric DEFAULT 1,
  	"points_config_points_to_currency_rate" numeric DEFAULT 100,
  	"points_config_points_expiry_days" numeric DEFAULT 365,
  	"points_config_min_redeem_points" numeric DEFAULT 100,
  	"points_config_max_redeem_percentage" numeric DEFAULT 30,
  	"signup_reward_enabled" boolean DEFAULT true,
  	"signup_reward_points" numeric DEFAULT 100,
  	"signup_reward_shopping_credit" numeric DEFAULT 0,
  	"signup_reward_description" varchar DEFAULT '新會員註冊禮',
  	"tier_multipliers_bronze_multiplier" numeric DEFAULT 1,
  	"tier_multipliers_silver_multiplier" numeric DEFAULT 1.2,
  	"tier_multipliers_gold_multiplier" numeric DEFAULT 1.5,
  	"tier_multipliers_platinum_multiplier" numeric DEFAULT 2,
  	"tier_multipliers_diamond_multiplier" numeric DEFAULT 2.5,
  	"monthly_bonus_bronze_monthly_points" numeric DEFAULT 0,
  	"monthly_bonus_silver_monthly_points" numeric DEFAULT 50,
  	"monthly_bonus_gold_monthly_points" numeric DEFAULT 100,
  	"monthly_bonus_platinum_monthly_points" numeric DEFAULT 200,
  	"monthly_bonus_diamond_monthly_points" numeric DEFAULT 500,
  	"birthday_reward_enabled" boolean DEFAULT true,
  	"birthday_reward_birthday_points" numeric DEFAULT 200,
  	"birthday_reward_birthday_credit_amount" numeric DEFAULT 100,
  	"birthday_reward_birthday_discount_percent" numeric DEFAULT 10,
  	"birthday_reward_birthday_multiplier" numeric DEFAULT 3,
  	"review_reward_enabled" boolean DEFAULT true,
  	"review_reward_text_review_points" numeric DEFAULT 20,
  	"review_reward_photo_review_points" numeric DEFAULT 50,
  	"review_reward_first_review_bonus" numeric DEFAULT 30,
  	"referral_points_referral_bonus_points" numeric DEFAULT 100,
  	"referral_points_referee_welcome_points" numeric DEFAULT 50,
  	"game_config_enabled" boolean DEFAULT true,
  	"game_config_bronze_daily_plays" numeric DEFAULT 1,
  	"game_config_silver_daily_plays" numeric DEFAULT 2,
  	"game_config_gold_daily_plays" numeric DEFAULT 3,
  	"game_config_platinum_daily_plays" numeric DEFAULT 5,
  	"game_config_diamond_daily_plays" numeric DEFAULT 10,
  	"game_config_subscriber_extra_plays" numeric DEFAULT 3,
  	"game_config_daily_login_points" numeric DEFAULT 5,
  	"game_config_consecutive_login_bonus" numeric DEFAULT 50,
  	"recommendation_config_enabled" boolean DEFAULT true,
  	"recommendation_config_fit_score_weights_height_weight" numeric DEFAULT 40,
  	"recommendation_config_fit_score_weights_body_weight" numeric DEFAULT 30,
  	"recommendation_config_fit_score_weights_shape_weight" numeric DEFAULT 20,
  	"recommendation_config_fit_score_weights_history_weight" numeric DEFAULT 10,
  	"auto_triggers_award_on_order_delivered" boolean DEFAULT true,
  	"auto_triggers_award_on_review_approved" boolean DEFAULT true,
  	"auto_triggers_award_on_referral_purchase" boolean DEFAULT true,
  	"auto_triggers_deduct_on_refund" boolean DEFAULT true,
  	"auto_triggers_monthly_bonus_day" numeric DEFAULT 1,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "referral_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"rewards_enabled" boolean DEFAULT true,
  	"rewards_referrer_signup_reward" numeric DEFAULT 50,
  	"rewards_referrer_purchase_reward" numeric DEFAULT 100,
  	"rewards_referee_signup_reward" numeric DEFAULT 30,
  	"rewards_referee_purchase_reward" numeric DEFAULT 50,
  	"rewards_min_purchase_amount" numeric DEFAULT 500,
  	"tier_bonus_bronze_multiplier" numeric DEFAULT 1,
  	"tier_bonus_silver_multiplier" numeric DEFAULT 1.2,
  	"tier_bonus_gold_multiplier" numeric DEFAULT 1.5,
  	"tier_bonus_platinum_multiplier" numeric DEFAULT 1.8,
  	"tier_bonus_diamond_multiplier" numeric DEFAULT 2,
  	"tier_bonus_subscriber_bonus" numeric DEFAULT 20,
  	"link_settings_cookie_expiry_days" numeric DEFAULT 30,
  	"link_settings_link_prefix" varchar DEFAULT '/ref/',
  	"anti_abuse_self_referral_block" boolean DEFAULT true,
  	"anti_abuse_same_i_p_limit" numeric DEFAULT 3,
  	"anti_abuse_device_fingerprint_enabled" boolean DEFAULT true,
  	"anti_abuse_same_device_limit" numeric DEFAULT 2,
  	"anti_abuse_email_verification_required" boolean DEFAULT true,
  	"anti_abuse_phone_verification_required" boolean DEFAULT false,
  	"anti_abuse_cooldown_hours" numeric DEFAULT 24,
  	"anti_abuse_min_order_amount" numeric DEFAULT 500,
  	"anti_abuse_monthly_referral_limit" numeric DEFAULT 50,
  	"anti_abuse_auto_lock_threshold" numeric DEFAULT 10,
  	"anti_abuse_auto_lock_window_hours" numeric DEFAULT 1,
  	"anti_abuse_manual_review_enabled" boolean DEFAULT true,
  	"anti_abuse_manual_review_threshold" numeric DEFAULT 20,
  	"anti_abuse_clawback_on_return" boolean DEFAULT true,
  	"anti_abuse_clawback_window_days" numeric DEFAULT 30,
  	"blacklist_blocked_emails" varchar,
  	"blacklist_blocked_i_ps" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "point_redemption_settings_expiry_notification_reminder_days" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"days" numeric NOT NULL,
  	"email_template" varchar,
  	"urgency_level" "pts_remind_urgency"
  );
  
  CREATE TABLE "point_redemption_settings_boost_events" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"multiplier" numeric DEFAULT 2 NOT NULL,
  	"start_date" timestamp(3) with time zone NOT NULL,
  	"end_date" timestamp(3) with time zone NOT NULL,
  	"description" varchar,
  	"is_active" boolean DEFAULT true
  );
  
  CREATE TABLE "point_redemption_settings_ugc_testimonials_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"text" varchar NOT NULL,
  	"avatar" varchar DEFAULT '🎁',
  	"tier" varchar
  );
  
  CREATE TABLE "point_redemption_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"expiry_notification_enabled" boolean DEFAULT true,
  	"expiry_notification_show_countdown" boolean DEFAULT true,
  	"scarcity_show_remaining_stock" boolean DEFAULT true,
  	"scarcity_low_stock_threshold" numeric DEFAULT 10,
  	"scarcity_show_redemption_count" boolean DEFAULT true,
  	"scarcity_hot_badge_threshold" numeric DEFAULT 50,
  	"progress_display_show_progress_bar" boolean DEFAULT true,
  	"progress_display_show_nearby_goals" boolean DEFAULT true,
  	"progress_display_nearby_threshold_percent" numeric DEFAULT 80,
  	"instant_gratification_enable_mystery_gift" boolean DEFAULT true,
  	"instant_gratification_mystery_gift_cost" numeric DEFAULT 100,
  	"instant_gratification_mystery_gift_description" varchar DEFAULT '隨機獲得驚喜好禮！價值最高 NT$500',
  	"instant_gratification_enable_lottery" boolean DEFAULT true,
  	"instant_gratification_lottery_cost" numeric DEFAULT 50,
  	"instant_gratification_consolation_prize_points" numeric DEFAULT 10,
  	"channels_direct_discount" boolean DEFAULT true,
  	"channels_free_shipping_coupon" boolean DEFAULT true,
  	"channels_movie_ticket_lottery" boolean DEFAULT true,
  	"channels_mystery_gift" boolean DEFAULT true,
  	"channels_vip_styling_consult" boolean DEFAULT true,
  	"channels_charity_donation" boolean DEFAULT true,
  	"channels_charity_points_per_unit" numeric DEFAULT 100,
  	"channels_charity_description" varchar DEFAULT '每 100 點 = NT$10 捐贈給台灣兒童福利基金會',
  	"subscriber_boost_discount_percent" numeric DEFAULT 10,
  	"subscriber_boost_exclusive_items" boolean DEFAULT true,
  	"subscriber_boost_priority_access" boolean DEFAULT true,
  	"ugc_testimonials_enabled" boolean DEFAULT true,
  	"ugc_testimonials_max_display" numeric DEFAULT 6,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "point_redemption_settings_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"points_redemptions_id" integer
  );
  
  CREATE TABLE "crm_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"credit_rewards_first_register" numeric DEFAULT 10,
  	"credit_rewards_first_purchase" numeric DEFAULT 15,
  	"credit_rewards_normal_purchase" numeric DEFAULT 8,
  	"credit_rewards_purchase_amount_bonus_per1000" numeric DEFAULT 2,
  	"credit_rewards_purchase_amount_bonus_max" numeric DEFAULT 10,
  	"credit_rewards_on_time_delivery" numeric DEFAULT 5,
  	"credit_rewards_good_review" numeric DEFAULT 10,
  	"credit_rewards_photo_review" numeric DEFAULT 12,
  	"credit_rewards_referral_success" numeric DEFAULT 18,
  	"credit_rewards_birthday_bonus" numeric DEFAULT 10,
  	"credit_rewards_subscriber_monthly" numeric DEFAULT 5,
  	"credit_rewards_good_customer_reward" numeric DEFAULT 10,
  	"credit_penalties_return_general_min" numeric DEFAULT 8,
  	"credit_penalties_return_general_max" numeric DEFAULT 15,
  	"credit_penalties_return_no_reason" numeric DEFAULT 25,
  	"credit_penalties_return_no_reason_consecutive2" numeric DEFAULT 35,
  	"credit_penalties_return_no_reason_consecutive3_plus" numeric DEFAULT 50,
  	"credit_penalties_return_rate_penalty" numeric DEFAULT 15,
  	"credit_penalties_return_rate_threshold" numeric DEFAULT 40,
  	"credit_penalties_return_rate_window_days" numeric DEFAULT 30,
  	"credit_penalties_abandoned_cart" numeric DEFAULT 6,
  	"credit_penalties_malicious_cancel" numeric DEFAULT 20,
  	"credit_thresholds_excellent_min" numeric DEFAULT 90,
  	"credit_thresholds_normal_min" numeric DEFAULT 70,
  	"credit_thresholds_watchlist_min" numeric DEFAULT 50,
  	"credit_thresholds_warning_min" numeric DEFAULT 30,
  	"credit_thresholds_blacklist_min" numeric DEFAULT 10,
  	"credit_thresholds_suspended_below" numeric DEFAULT 10,
  	"credit_notifications_positive_message" varchar DEFAULT '太棒了！感謝您的支持，您的信用分數已提升 🌟',
  	"credit_notifications_mild_deduct_message" varchar DEFAULT '您是我們重視的好客人，請繼續保持喔～',
  	"credit_notifications_serious_deduct_message" varchar DEFAULT '溫馨提醒：頻繁退貨會影響您的會員權益，如有任何問題歡迎聯繫客服 💝',
  	"credit_notifications_watchlist_message" varchar DEFAULT '您的信用分數目前低於標準，部分優惠將暫時受限。我們相信您能很快恢復！💪',
  	"credit_notifications_blacklist_message" varchar DEFAULT '您的信用分數較低，部分會員優惠將暫時受限。歡迎透過購物提升分數！',
  	"credit_notifications_good_customer_message" varchar DEFAULT '恭喜您！您是我們最珍貴的好客人 ✨ 感謝您一直以來的支持與信賴！',
  	"ai_customer_service_enabled" boolean DEFAULT true,
  	"ai_customer_service_greeting_message" varchar DEFAULT '您好！我是 CHIC KIM & MIU 的智能客服助手 ✨ 請問有什麼我可以幫您的嗎？',
  	"ai_customer_service_max_a_i_rounds" numeric DEFAULT 5,
  	"ai_customer_service_escalate_on_negative_sentiment" boolean DEFAULT true,
  	"ai_customer_service_escalate_high_v_i_p" boolean DEFAULT true,
  	"ai_customer_service_escalate_on_credit_complaint" boolean DEFAULT true,
  	"ai_customer_service_human_agent_notify_email" varchar,
  	"ai_customer_service_human_agent_notify_line" varchar,
  	"automation_config_enabled" boolean DEFAULT true,
  	"automation_config_max_journeys_per_day" numeric DEFAULT 3,
  	"automation_config_quiet_hours_start" numeric DEFAULT 22,
  	"automation_config_quiet_hours_end" numeric DEFAULT 8,
  	"automation_config_default_cooldown_hours" numeric DEFAULT 24,
  	"automation_config_cart_abandon_delays_first_reminder" numeric DEFAULT 60,
  	"automation_config_cart_abandon_delays_second_reminder" numeric DEFAULT 1440,
  	"automation_config_cart_abandon_delays_third_reminder" numeric DEFAULT 4320,
  	"automation_config_dormant_days_first_wakeup" numeric DEFAULT 30,
  	"automation_config_dormant_days_second_wakeup" numeric DEFAULT 45,
  	"automation_config_dormant_days_third_wakeup" numeric DEFAULT 60,
  	"notification_channels_line_messaging_enabled" boolean DEFAULT false,
  	"notification_channels_line_channel_access_token" varchar,
  	"notification_channels_line_channel_secret" varchar,
  	"notification_channels_email_enabled" boolean DEFAULT true,
  	"notification_channels_email_from_name" varchar DEFAULT 'CHIC KIM & MIU',
  	"notification_channels_email_from_address" varchar DEFAULT 'hello@chickimmiu.com',
  	"notification_channels_sms_enabled" boolean DEFAULT false,
  	"dashboard_config_refresh_interval_seconds" numeric DEFAULT 300,
  	"dashboard_config_alert_credit_score_below" numeric DEFAULT 30,
  	"dashboard_config_alert_consecutive_returns" numeric DEFAULT 3,
  	"dashboard_config_show_return_correlation" boolean DEFAULT true,
  	"dashboard_config_show_credit_distribution" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "segmentation_settings_segment_colors" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"code" varchar,
  	"label" varchar,
  	"color" varchar
  );
  
  CREATE TABLE "segmentation_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"weights_rfm_weight" numeric DEFAULT 40,
  	"weights_credit_weight" numeric DEFAULT 25,
  	"weights_ltv_churn_weight" numeric DEFAULT 15,
  	"weights_behavior_weight" numeric DEFAULT 10,
  	"weights_tier_weight" numeric DEFAULT 10,
  	"segment_thresholds_blk1_credit_threshold" numeric DEFAULT 30,
  	"segment_thresholds_risk2_credit_threshold" numeric DEFAULT 50,
  	"segment_thresholds_risk2_return_rate_threshold" numeric DEFAULT 25,
  	"segment_thresholds_vip1_min_score" numeric DEFAULT 85,
  	"segment_thresholds_vip1_min_credit" numeric DEFAULT 90,
  	"segment_thresholds_vip2_min_score" numeric DEFAULT 70,
  	"segment_thresholds_vip2_min_credit" numeric DEFAULT 80,
  	"segment_thresholds_risk1_churn_threshold" numeric DEFAULT 70,
  	"segment_thresholds_risk1_days_threshold" numeric DEFAULT 45,
  	"segment_thresholds_slp1_days_threshold" numeric DEFAULT 60,
  	"segment_thresholds_new_max_age" numeric DEFAULT 30,
  	"segment_thresholds_pot1_min_score" numeric DEFAULT 55,
  	"segment_thresholds_pot1_max_age" numeric DEFAULT 90,
  	"segment_thresholds_pot1_min_credit" numeric DEFAULT 75,
  	"segment_thresholds_reg2_median_threshold" numeric DEFAULT 1500,
  	"cron_schedule_enabled" boolean DEFAULT true,
  	"cron_schedule_run_at_hour" numeric DEFAULT 3,
  	"cron_schedule_notify_on_complete" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "cs_settings_business_hours_schedule" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"day_of_week" "enum_cs_settings_business_hours_schedule_day_of_week",
  	"open_time" varchar,
  	"close_time" varchar
  );
  
  CREATE TABLE "cs_settings_business_hours_holidays" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone,
  	"reason" varchar
  );
  
  CREATE TABLE "cs_settings_sla_first_response_minutes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"channel" "enum_cs_settings_sla_first_response_minutes_channel",
  	"priority" "enum_cs_settings_sla_first_response_minutes_priority",
  	"minutes" numeric
  );
  
  CREATE TABLE "cs_settings_sla_resolution_hours" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"priority" "enum_cs_settings_sla_resolution_hours_priority",
  	"hours" numeric
  );
  
  CREATE TABLE "cs_settings_anti_spam_blocked_keywords" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"keyword" varchar
  );
  
  CREATE TABLE "cs_settings_anti_spam_blocked_anon_ids" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"anon_id" varchar
  );
  
  CREATE TABLE "cs_settings_anti_spam_blocked_i_ps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"ip" varchar
  );
  
  CREATE TABLE "cs_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"business_hours_timezone" varchar DEFAULT 'Asia/Taipei',
  	"business_hours_off_hour_auto_reply" varchar DEFAULT '感謝您的訊息！目前是非營業時段，我們會在下次營業時間（週一至週五 10:00–18:00）盡快回覆您。',
  	"sla_breach_action" "enum_cs_settings_sla_breach_action" DEFAULT 'notify_assignee',
  	"default_assignee_id" integer,
  	"auto_assign_mode" "enum_cs_settings_auto_assign_mode" DEFAULT 'round_robin',
  	"greeting_web" varchar DEFAULT '哈囉！我是 CHIC KIM & MIU 的客服小幫手，請問需要什麼協助呢？',
  	"greeting_line" varchar,
  	"greeting_fb" varchar,
  	"greeting_ig" varchar,
  	"anti_spam_max_messages_per_minute" numeric DEFAULT 5,
  	"csat_enabled" boolean DEFAULT true,
  	"csat_send_delay_hours" numeric DEFAULT 24,
  	"csat_question" varchar DEFAULT '您對這次客服體驗滿意嗎？（1–5 星）',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "promotion_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"kill_switch" boolean DEFAULT false,
  	"storefront_enabled" boolean DEFAULT false,
  	"server_pricing_enforcement" boolean DEFAULT true,
  	"quote_ttl_seconds" numeric DEFAULT 300,
  	"default_margin_floor_pct" numeric,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "marketing_automation_settings_birthday_config_tier_gifts" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tier_code" "mkt_bday_tier_code" NOT NULL,
  	"tier_label" varchar,
  	"discount_percent" numeric,
  	"shopping_credit" numeric,
  	"bonus_points" numeric,
  	"coupon_code" varchar,
  	"special_gift" varchar,
  	"styling_minutes" numeric DEFAULT 0,
  	"gift_box_included" boolean DEFAULT false
  );
  
  CREATE TABLE "marketing_automation_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"general_config_enabled" boolean DEFAULT true,
  	"general_config_max_campaigns_per_day" numeric DEFAULT 3,
  	"general_config_global_quiet_hours_start" numeric DEFAULT 22,
  	"general_config_global_quiet_hours_end" numeric DEFAULT 8,
  	"general_config_default_sender_name" varchar DEFAULT 'CHIC KIM & MIU',
  	"general_config_default_sender_email" varchar DEFAULT 'hello@chickimmiu.com',
  	"channel_config_line_o_a_enabled" boolean DEFAULT true,
  	"channel_config_line_o_a_channel_access_token" varchar,
  	"channel_config_line_o_a_channel_secret" varchar,
  	"channel_config_line_o_a_rich_menu_id" varchar,
  	"channel_config_email_enabled" boolean DEFAULT true,
  	"channel_config_email_provider" "mkt_email_provider",
  	"channel_config_email_api_key" varchar,
  	"channel_config_email_daily_limit" numeric DEFAULT 10000,
  	"channel_config_sms_enabled" boolean DEFAULT false,
  	"channel_config_sms_provider" "mkt_sms_provider",
  	"channel_config_sms_api_key" varchar,
  	"channel_config_sms_daily_limit" numeric DEFAULT 1000,
  	"channel_config_push_enabled" boolean DEFAULT false,
  	"channel_config_push_fcm_server_key" varchar,
  	"channel_config_edm_enabled" boolean DEFAULT false,
  	"channel_config_edm_provider" "mkt_edm_provider",
  	"channel_config_edm_api_key" varchar,
  	"ab_test_config_default_min_sample_size" numeric DEFAULT 100,
  	"ab_test_config_default_confidence_threshold" numeric DEFAULT 95,
  	"ab_test_config_auto_select_winner_enabled" boolean DEFAULT true,
  	"ab_test_config_default_winner_metric" "mkt_win_metric" DEFAULT 'conversion_rate',
  	"personalization_config_ai_recommendation_enabled" boolean DEFAULT true,
  	"personalization_config_ugc_integration_enabled" boolean DEFAULT true,
  	"personalization_config_credit_score_personalization_enabled" boolean DEFAULT true,
  	"personalization_config_segment_personalization_enabled" boolean DEFAULT true,
  	"personalization_config_max_recommended_products" numeric DEFAULT 6,
  	"festival_config_auto_create_festival_campaigns" boolean DEFAULT true,
  	"festival_config_days_before_auto_create" numeric DEFAULT 14,
  	"birthday_config_enabled" boolean DEFAULT true,
  	"birthday_config_pre_notify_days" numeric DEFAULT 7,
  	"birthday_config_mid_month_day" numeric DEFAULT 15,
  	"birthday_config_last_days_count" numeric DEFAULT 3,
  	"birthday_config_post_followup_days" numeric DEFAULT 3,
  	"birthday_config_vip_t4_discount" numeric DEFAULT 18,
  	"birthday_config_vip_t4_shopping_credit" numeric DEFAULT 500,
  	"birthday_config_vip_t4_points" numeric DEFAULT 800,
  	"birthday_config_vip_t4_styling_minutes" numeric DEFAULT 30,
  	"birthday_config_vip_t5_discount" numeric DEFAULT 25,
  	"birthday_config_vip_t5_shopping_credit" numeric DEFAULT 1000,
  	"birthday_config_vip_t5_points" numeric DEFAULT 1500,
  	"birthday_config_vip_t5_styling_minutes" numeric DEFAULT 60,
  	"birthday_config_vip_t5_gift_box" boolean DEFAULT true,
  	"birthday_config_credit_score_bonus_t4" numeric DEFAULT 200,
  	"birthday_config_credit_score_bonus_t5" numeric DEFAULT 400,
  	"birthday_config_credit_score_threshold" numeric DEFAULT 90,
  	"birthday_config_free_shipping_all_tiers" boolean DEFAULT true,
  	"birthday_config_vip_t5_priority_shipping" boolean DEFAULT true,
  	"birthday_config_points_multiplier" numeric DEFAULT 2,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "recommendation_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"weights_body_match" numeric DEFAULT 35,
  	"weights_purchase_history" numeric DEFAULT 25,
  	"weights_member_tier" numeric DEFAULT 15,
  	"weights_stock_and_hot" numeric DEFAULT 10,
  	"weights_ugc_interaction" numeric DEFAULT 10,
  	"weights_season_trend" numeric DEFAULT 5,
  	"stages_product_page_enabled" boolean DEFAULT true,
  	"stages_product_page_cross_sell_count" numeric DEFAULT 4,
  	"stages_product_page_upsell_count" numeric DEFAULT 2,
  	"stages_product_page_show_upgrade_diff" boolean DEFAULT true,
  	"stages_cart_page_enabled" boolean DEFAULT true,
  	"stages_cart_page_bundle_count" numeric DEFAULT 4,
  	"stages_cart_page_addon_count" numeric DEFAULT 3,
  	"stages_cart_page_addon_max_price" numeric DEFAULT 500,
  	"stages_cart_page_show_bundle_discount" boolean DEFAULT true,
  	"stages_checkout_page_enabled" boolean DEFAULT true,
  	"stages_checkout_page_last_chance_count" numeric DEFAULT 3,
  	"stages_checkout_page_max_price_percent" numeric DEFAULT 30,
  	"stages_thank_you_page_enabled" boolean DEFAULT true,
  	"stages_thank_you_page_next_purchase_count" numeric DEFAULT 4,
  	"stages_thank_you_page_show_special_offer" boolean DEFAULT true,
  	"stages_thank_you_page_offer_discount_percent" numeric DEFAULT 10,
  	"stages_thank_you_page_offer_expiry_hours" numeric DEFAULT 48,
  	"stages_exit_intent_enabled" boolean DEFAULT true,
  	"stages_exit_intent_trigger_after_seconds" numeric DEFAULT 10,
  	"stages_exit_intent_show_only_once" boolean DEFAULT true,
  	"stages_exit_intent_recommend_count" numeric DEFAULT 3,
  	"stages_exit_intent_discount_percent" numeric DEFAULT 5,
  	"stages_email_enabled" boolean DEFAULT true,
  	"stages_email_abandon_cart_hours" numeric DEFAULT 2,
  	"stages_email_recommend_count" numeric DEFAULT 4,
  	"upsell_rules_enabled" boolean DEFAULT true,
  	"upsell_rules_min_price_diff_percent" numeric DEFAULT 10,
  	"upsell_rules_max_price_diff_percent" numeric DEFAULT 80,
  	"upsell_rules_subscriber_extra_discount" numeric DEFAULT 5,
  	"cross_sell_rules_enabled" boolean DEFAULT true,
  	"cross_sell_rules_bundle_discount_enabled" boolean DEFAULT true,
  	"cross_sell_rules_bundle_discount_type" "rec_bundle_disc_type" DEFAULT 'third_item_off',
  	"cross_sell_rules_third_item_discount_percent" numeric DEFAULT 30,
  	"cross_sell_rules_threshold_amount" numeric DEFAULT 5000,
  	"cross_sell_rules_threshold_discount" numeric DEFAULT 500,
  	"tracking_enable_click_tracking" boolean DEFAULT true,
  	"tracking_enable_conversion_tracking" boolean DEFAULT true,
  	"tracking_enable_a_b_testing" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "ads_catalog_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"general_enabled" boolean DEFAULT true,
  	"general_feed_secret_token" varchar,
  	"general_feed_cache_ttl_minutes" numeric DEFAULT 60,
  	"general_include_out_of_stock" boolean DEFAULT true,
  	"general_include_draft" boolean DEFAULT false,
  	"defaults_default_brand" varchar DEFAULT 'CHIC KIM & MIU',
  	"defaults_default_currency" varchar DEFAULT 'TWD',
  	"defaults_default_gender" "enum_ads_catalog_settings_defaults_default_gender" DEFAULT 'female',
  	"defaults_default_age_group" "enum_ads_catalog_settings_defaults_default_age_group" DEFAULT 'adult',
  	"defaults_default_condition" "enum_ads_catalog_settings_defaults_default_condition" DEFAULT 'new',
  	"defaults_default_google_product_category" varchar DEFAULT 'Apparel & Accessories > Clothing > Dresses',
  	"defaults_default_product_type_prefix" varchar DEFAULT '女裝 > 韓系',
  	"defaults_default_locale" "enum_ads_catalog_settings_defaults_default_locale" DEFAULT 'zh_TW',
  	"meta_business_manager_id" varchar,
  	"meta_catalog_id" varchar,
  	"meta_ad_account_id" varchar,
  	"meta_system_user_token" varchar,
  	"google_merchant_center_id" varchar,
  	"google_service_account_email" varchar,
  	"feed_urls_meta_feed_url" varchar DEFAULT 'https://chickimmiu.com/feeds/meta.xml',
  	"feed_urls_google_feed_url" varchar DEFAULT 'https://chickimmiu.com/feeds/google.xml',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "game_settings_spin_wheel_prizes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"prize_name" varchar NOT NULL,
  	"prize_type" "enum_game_settings_spin_wheel_prizes_prize_type",
  	"prize_amount" numeric,
  	"weight" numeric DEFAULT 10,
  	"coupon_code" varchar
  );
  
  CREATE TABLE "game_settings_scratch_card_prizes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"prize_name" varchar NOT NULL,
  	"prize_type" "enum_game_settings_scratch_card_prizes_prize_type",
  	"prize_amount" numeric,
  	"weight" numeric DEFAULT 10,
  	"coupon_code" varchar
  );
  
  CREATE TABLE "game_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"global_daily_points_limit" numeric DEFAULT 500,
  	"game_list_daily_checkin_enabled" boolean DEFAULT true,
  	"game_list_spin_wheel_enabled" boolean DEFAULT true,
  	"game_list_scratch_card_enabled" boolean DEFAULT true,
  	"game_list_movie_lottery_enabled" boolean DEFAULT false,
  	"game_list_fashion_challenge_enabled" boolean DEFAULT false,
  	"game_list_card_battle_enabled" boolean DEFAULT true,
  	"game_list_style_p_k_enabled" boolean DEFAULT false,
  	"game_list_style_relay_enabled" boolean DEFAULT false,
  	"game_list_weekly_challenge_enabled" boolean DEFAULT false,
  	"game_list_co_create_enabled" boolean DEFAULT false,
  	"game_list_wish_pool_enabled" boolean DEFAULT false,
  	"game_list_blind_box_enabled" boolean DEFAULT false,
  	"game_list_queen_vote_enabled" boolean DEFAULT false,
  	"game_list_team_style_enabled" boolean DEFAULT false,
  	"game_list_mbti_style_enabled" boolean DEFAULT true,
  	"daily_checkin_day1to6_points" numeric DEFAULT 5,
  	"daily_checkin_day7_bonus_points" numeric DEFAULT 50,
  	"daily_checkin_streak_bonus_multiplier" numeric DEFAULT 1.5,
  	"daily_checkin_display_name" varchar DEFAULT '每日簽到',
  	"daily_checkin_description" varchar DEFAULT '每天簽到賺點數，連續七天有大獎！',
  	"daily_checkin_icon" varchar DEFAULT '📅',
  	"spin_wheel_free_per_tier_ordinary" numeric DEFAULT 0,
  	"spin_wheel_free_per_tier_bronze" numeric DEFAULT 1,
  	"spin_wheel_free_per_tier_silver" numeric DEFAULT 2,
  	"spin_wheel_free_per_tier_gold" numeric DEFAULT 3,
  	"spin_wheel_free_per_tier_platinum" numeric DEFAULT 5,
  	"spin_wheel_free_per_tier_diamond" numeric DEFAULT 10,
  	"spin_wheel_points_cost_per_play" numeric DEFAULT 50,
  	"spin_wheel_daily_limit" numeric DEFAULT 10,
  	"spin_wheel_display_name" varchar DEFAULT '幸運轉盤',
  	"spin_wheel_description" varchar DEFAULT '轉動命運之輪，贏取超值獎品！',
  	"spin_wheel_icon" varchar DEFAULT '🎡',
  	"scratch_card_free_per_tier_ordinary" numeric DEFAULT 1,
  	"scratch_card_free_per_tier_bronze" numeric DEFAULT 1,
  	"scratch_card_free_per_tier_silver" numeric DEFAULT 2,
  	"scratch_card_free_per_tier_gold" numeric DEFAULT 2,
  	"scratch_card_free_per_tier_platinum" numeric DEFAULT 3,
  	"scratch_card_free_per_tier_diamond" numeric DEFAULT 5,
  	"scratch_card_points_cost_per_play" numeric DEFAULT 30,
  	"scratch_card_daily_limit" numeric DEFAULT 5,
  	"scratch_card_display_name" varchar DEFAULT '刮刮樂',
  	"scratch_card_description" varchar DEFAULT '刮開驚喜，幸運就在指尖！',
  	"scratch_card_icon" varchar DEFAULT '🎫',
  	"movie_lottery_points_cost_per_play" numeric DEFAULT 100,
  	"movie_lottery_daily_limit" numeric DEFAULT 3,
  	"movie_lottery_win_rate" numeric DEFAULT 5,
  	"movie_lottery_ticket_type" varchar DEFAULT '威秀影城 2D 一般廳',
  	"movie_lottery_display_name" varchar DEFAULT '電影票抽獎',
  	"movie_lottery_description" varchar DEFAULT '用點數抽威秀電影票，看電影不花錢！',
  	"movie_lottery_icon" varchar DEFAULT '🎬',
  	"movie_lottery_total_tickets" numeric DEFAULT 50,
  	"movie_lottery_remaining_tickets" numeric DEFAULT 50,
  	"fashion_challenge_daily_limit" numeric DEFAULT 5,
  	"fashion_challenge_points_cost_per_play" numeric DEFAULT 0,
  	"fashion_challenge_time_limit_seconds" numeric DEFAULT 60,
  	"fashion_challenge_rank_s_points" numeric DEFAULT 50,
  	"fashion_challenge_rank_a_points" numeric DEFAULT 30,
  	"fashion_challenge_rank_b_points" numeric DEFAULT 15,
  	"fashion_challenge_rank_c_points" numeric DEFAULT 5,
  	"fashion_challenge_share_bonus_points" numeric DEFAULT 10,
  	"fashion_challenge_display_name" varchar DEFAULT '璀璨穿搭挑戰',
  	"fashion_challenge_description" varchar DEFAULT '60秒混搭穿搭，AI即時評分！挑戰S級時尚達人！',
  	"fashion_challenge_icon" varchar DEFAULT '✨',
  	"card_battle_daily_battle_limit" numeric DEFAULT 3,
  	"card_battle_winner_points_min" numeric DEFAULT 30,
  	"card_battle_winner_points_max" numeric DEFAULT 80,
  	"card_battle_loser_points_min" numeric DEFAULT 5,
  	"card_battle_loser_points_max" numeric DEFAULT 15,
  	"card_battle_draw_points_min" numeric DEFAULT 20,
  	"card_battle_draw_points_max" numeric DEFAULT 40,
  	"card_battle_room_expiry_hours" numeric DEFAULT 24,
  	"card_battle_referral_bonus_points" numeric DEFAULT 20,
  	"card_battle_display_name" varchar DEFAULT '抽卡片比大小',
  	"card_battle_description" varchar DEFAULT '邀請好友抽卡對戰，比大小贏點數！',
  	"card_battle_icon" varchar DEFAULT '🃏',
  	"style_p_k_daily_limit" numeric DEFAULT 5,
  	"style_p_k_vote_duration_hours" numeric DEFAULT 24,
  	"style_p_k_winner_points" numeric DEFAULT 50,
  	"style_p_k_participant_points" numeric DEFAULT 10,
  	"style_p_k_voter_points" numeric DEFAULT 3,
  	"style_p_k_display_name" varchar DEFAULT '穿搭 PK 對戰',
  	"style_p_k_description" varchar DEFAULT '上傳穿搭照，與其他玩家 PK，讓大家投票選出最佳穿搭！',
  	"style_p_k_icon" varchar DEFAULT '⚔️',
  	"style_relay_daily_limit" numeric DEFAULT 3,
  	"style_relay_participant_points" numeric DEFAULT 15,
  	"style_relay_best_pick_points" numeric DEFAULT 50,
  	"style_relay_chain_length_bonus" numeric DEFAULT 5,
  	"style_relay_display_name" varchar DEFAULT '穿搭接龍',
  	"style_relay_description" varchar DEFAULT '延續上一位玩家的風格元素，接力創造穿搭故事！',
  	"style_relay_icon" varchar DEFAULT '🔗',
  	"weekly_challenge_submission_limit" numeric DEFAULT 3,
  	"weekly_challenge_participant_points" numeric DEFAULT 20,
  	"weekly_challenge_top1_points" numeric DEFAULT 200,
  	"weekly_challenge_top2_points" numeric DEFAULT 100,
  	"weekly_challenge_top3_points" numeric DEFAULT 50,
  	"weekly_challenge_current_theme" varchar DEFAULT '春日約會穿搭',
  	"weekly_challenge_theme_description" varchar,
  	"weekly_challenge_display_name" varchar DEFAULT '每週風格挑戰賽',
  	"weekly_challenge_description" varchar DEFAULT '每週不同主題，秀出你的時尚品味，爭奪穿搭冠軍！',
  	"weekly_challenge_icon" varchar DEFAULT '🏆',
  	"co_create_daily_limit" numeric DEFAULT 3,
  	"co_create_creator_points" numeric DEFAULT 20,
  	"co_create_collaborator_points" numeric DEFAULT 15,
  	"co_create_max_collaborators" numeric DEFAULT 4,
  	"co_create_display_name" varchar DEFAULT '好友共創穿搭',
  	"co_create_description" varchar DEFAULT '邀請好友一起搭配穿搭，共同創作時尚造型！',
  	"co_create_icon" varchar DEFAULT '👯',
  	"wish_pool_daily_wish_limit" numeric DEFAULT 3,
  	"wish_pool_daily_fulfill_limit" numeric DEFAULT 5,
  	"wish_pool_wisher_points" numeric DEFAULT 10,
  	"wish_pool_fulfiller_points" numeric DEFAULT 20,
  	"wish_pool_display_name" varchar DEFAULT '穿搭許願池',
  	"wish_pool_description" varchar DEFAULT '許下穿搭願望，讓時尚達人幫你圓夢！',
  	"wish_pool_icon" varchar DEFAULT '🌟',
  	"blind_box_daily_limit" numeric DEFAULT 2,
  	"blind_box_points_cost" numeric DEFAULT 30,
  	"blind_box_sender_points" numeric DEFAULT 15,
  	"blind_box_receiver_points" numeric DEFAULT 10,
  	"blind_box_display_name" varchar DEFAULT '穿搭盲盒互贈',
  	"blind_box_description" varchar DEFAULT '隨機搭配穿搭盲盒送給好友，拆箱驚喜無限！',
  	"blind_box_icon" varchar DEFAULT '🎁',
  	"queen_vote_daily_vote_limit" numeric DEFAULT 10,
  	"queen_vote_submission_limit" numeric DEFAULT 1,
  	"queen_vote_voter_points" numeric DEFAULT 2,
  	"queen_vote_queen_points" numeric DEFAULT 500,
  	"queen_vote_runner_up_points" numeric DEFAULT 200,
  	"queen_vote_participant_points" numeric DEFAULT 30,
  	"queen_vote_period_days" numeric DEFAULT 7,
  	"queen_vote_display_name" varchar DEFAULT '女王投票大賽',
  	"queen_vote_description" varchar DEFAULT '上傳你的最美穿搭，爭奪本週時尚女王寶座！',
  	"queen_vote_icon" varchar DEFAULT '👑',
  	"team_style_max_room_size" numeric DEFAULT 6,
  	"team_style_daily_limit" numeric DEFAULT 3,
  	"team_style_host_points" numeric DEFAULT 25,
  	"team_style_member_points" numeric DEFAULT 15,
  	"team_style_best_outfit_points" numeric DEFAULT 50,
  	"team_style_room_expiry_hours" numeric DEFAULT 48,
  	"team_style_display_name" varchar DEFAULT '團體穿搭房',
  	"team_style_description" varchar DEFAULT '開房邀請好友，一起穿搭競賽，最佳造型贏大獎！',
  	"team_style_icon" varchar DEFAULT '🏠',
  	"mbti_style_points_cost_per_play" numeric DEFAULT 50,
  	"mbti_style_daily_limit" numeric DEFAULT 1,
  	"mbti_style_allow_retake" boolean DEFAULT false,
  	"mbti_style_share_bonus_points" numeric DEFAULT 0,
  	"mbti_style_display_name" varchar DEFAULT 'MBTI 個性穿搭測驗',
  	"mbti_style_description" varchar DEFAULT '28 題專業 MBTI 測驗，找出你的個性穿搭風格 — 每位會員終身限測 1 次！',
  	"mbti_style_icon" varchar DEFAULT '🧠',
  	"terms_enabled" boolean DEFAULT true,
  	"terms_version" varchar DEFAULT '2026-05-09-v1' NOT NULL,
  	"terms_last_updated_at" timestamp(3) with time zone,
  	"terms_short_summary" varchar DEFAULT '本遊戲所獲點數、購物金、優惠券皆為會員消費回饋，不具金錢價值，不得兌換現金。實體獎品須隨下次訂單寄出，請於 12 個月內下單。詳細條文請見「遊戲規範與獎項」頁面。',
  	"terms_full_content" varchar DEFAULT 'CHIC KIM & MIU 遊戲規範與獎項說明
  
  一、適用範圍
  本規範適用於 CHIC KIM & MIU 網站、APP 內所有互動遊戲與獎項活動（以下簡稱「本遊戲」）。
  
  二、參與資格
  1. 完成 CHIC KIM & MIU 會員註冊並通過 email 驗證之會員方可參與。
  2. 未滿 20 歲之未成年會員，須經法定代理人同意方可參與。
  3. 本公司員工及其二親等內親屬不得參與抽獎活動。
  
  三、獎項與機率公示
  1. 各遊戲獎項清單、中獎機率、剩餘庫存依即時資料公示於本網站「/games/terms」頁面。
  2. 獎品內容及中獎機率得依營運需求調整，調整時將同步更新本規範並另行公告。
  3. 點數、購物金、優惠券等獎項以系統紀錄為準，不得兌換現金、不得轉讓他人。
  
  四、獎品兌換與寄送
  1. 點數及購物金中獎後即時入帳，可於下次消費使用，無使用期限（除遊戲設定點數有效期外）。
  2. 電子優惠券中獎後將自動加入「會員寶物箱」，於有效期內使用。
  3. 實體贈品（如電影票、贈品等）將於會員下次訂單寄出時隨單一同寄出，會員須於得獎日起 12 個月內下單方可寄出，逾期視同放棄。
  4. 獎品恕不退換、不轉讓、不寄送至海外地址；如該獎品市場停售或公司因故無法提供，本公司保留以等值或近似獎品替換之權利。
  
  五、消費型遊戲機制
  1. 每位會員每日免費遊戲次數依會員等級提供；額外次數需消耗會員點數，點數消耗後不可退還。
  2. 會員點數及購物金均為消費回饋，不具金錢價值，不得交易、贈與、變賣或要求退換成現金。
  3. 遊戲結果由系統根據後台設定機率即時計算，所有抽獎結果以伺服器紀錄為準。
  
  六、禁止行為
  會員有下列行為之一者，本公司得取消其得獎資格、追回獎品並終止其會員資格，必要時得依法追訴：
  1. 以不正當方式（包含但不限於多重帳號、自動化程式、機器人、竊取他人帳號、偽造資料等）參與本遊戲。
  2. 散布不實資訊、騷擾其他會員或本公司客服人員。
  3. 違反相關法令、消費者保護法、個人資料保護法或公序良俗之行為。
  
  七、爭議處理
  獎項相關爭議請於得獎日起 30 日內透過客服中心聯繫，逾期視同認可。
  客服信箱：service@chickimmiu.com
  
  八、智慧財產權
  本遊戲所有美術設計、文案、商標、視覺元素、音效等均屬本公司所有，未經書面同意不得重製、改作、散布或為其他商業利用。
  
  九、隱私權
  會員參與本遊戲時，本公司將依本網站「隱私權政策」蒐集、處理及利用其個人資料；會員資料將用於獎項發放、活動通知、會員服務等用途。
  
  十、規範修訂
  本公司得隨時修訂本規範，修訂後將公告於本網站並推播予會員，修訂後之規範自公告日起生效。會員繼續使用本遊戲視同同意修訂後之規範；如不同意修訂內容，會員應停止使用本遊戲。
  
  十一、準據法及管轄法院
  本規範以中華民國法律為準據法。因本規範或本遊戲所生之任何爭議，雙方同意以臺灣臺北地方法院為第一審管轄法院。
  
  十二、聲明
  1. 本遊戲為純粹娛樂消費回饋活動，不具任何投資、賭博性質。
  2. 本公司保留隨時暫停、修改、終止本遊戲之權利。
  3. 本規範未盡事宜，依「會員條款」「隱私權政策」及相關法令規定辦理。',
  	"compliance_monthly_max_value_per_user" numeric DEFAULT 5000,
  	"compliance_abnormal_threshold_per_hour" numeric DEFAULT 5,
  	"compliance_require_adult_confirmation" boolean DEFAULT true,
  	"leaderboard_enabled" boolean DEFAULT true,
  	"leaderboard_reset_daily" boolean DEFAULT true,
  	"leaderboard_reset_weekly" boolean DEFAULT true,
  	"leaderboard_reset_monthly" boolean DEFAULT true,
  	"leaderboard_top3_daily_bonus" numeric DEFAULT 100,
  	"leaderboard_top3_weekly_bonus" numeric DEFAULT 500,
  	"leaderboard_top3_monthly_bonus" numeric DEFAULT 2000,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "navigation_settings_main_menu_children" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"href" varchar NOT NULL
  );
  
  CREATE TABLE "navigation_settings_main_menu" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"href" varchar NOT NULL
  );
  
  CREATE TABLE "navigation_settings_footer_sections_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"href" varchar NOT NULL
  );
  
  CREATE TABLE "navigation_settings_footer_sections" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL
  );
  
  CREATE TABLE "navigation_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"announcement_bar_enabled" boolean DEFAULT true,
  	"announcement_bar_text" varchar DEFAULT '全館滿 $1,000 免運費 ♥ 新會員註冊即享 9 折',
  	"announcement_bar_link" varchar,
  	"announcement_bar_style" "enum_navigation_settings_announcement_bar_style" DEFAULT 'default',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "homepage_settings_hero_banners" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL,
  	"title" varchar,
  	"subtitle" varchar,
  	"link" varchar DEFAULT '/products',
  	"cta_text" varchar DEFAULT '立即選購'
  );
  
  CREATE TABLE "homepage_settings_quick_menu" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"href" varchar NOT NULL,
  	"icon" "enum_homepage_settings_quick_menu_icon" DEFAULT 'Sparkles',
  	"color" varchar DEFAULT 'text-gold-500'
  );
  
  CREATE TABLE "homepage_settings_service_highlights" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"desc" varchar,
  	"icon" "enum_homepage_settings_service_highlights_icon" DEFAULT 'Truck'
  );
  
  CREATE TABLE "homepage_settings_style_journal_section_manual_posts" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"post_id" integer
  );
  
  CREATE TABLE "homepage_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"hero_layout_override" "enum_homepage_settings_hero_layout_override" DEFAULT 'inherit',
  	"new_products_section_tag" varchar DEFAULT 'NEW IN',
  	"new_products_section_title" varchar DEFAULT '新品上市',
  	"new_products_section_href" varchar DEFAULT '/products?tag=new',
  	"new_products_section_limit" numeric DEFAULT 8,
  	"new_products_section_visible" boolean DEFAULT true,
  	"hot_products_section_tag" varchar DEFAULT 'BEST SELLERS',
  	"hot_products_section_title" varchar DEFAULT '熱銷推薦',
  	"hot_products_section_href" varchar DEFAULT '/products?tag=hot',
  	"hot_products_section_limit" numeric DEFAULT 8,
  	"hot_products_section_visible" boolean DEFAULT true,
  	"brand_banner_visible" boolean DEFAULT true,
  	"brand_banner_image_id" integer,
  	"brand_banner_tagline" varchar DEFAULT 'SPECIAL EVENT',
  	"brand_banner_title" varchar DEFAULT '專屬你美好的
  時尚優雅',
  	"brand_banner_subtitle" varchar DEFAULT '精選百件春夏商品限時特惠，搶購你的命定單品！',
  	"brand_banner_cta_text" varchar DEFAULT '立即搶購',
  	"brand_banner_cta_link" varchar DEFAULT '/products?tag=sale',
  	"style_journal_section_visible" boolean DEFAULT true,
  	"style_journal_section_tag" varchar DEFAULT 'STYLE JOURNAL',
  	"style_journal_section_title" varchar DEFAULT '穿搭誌',
  	"style_journal_section_href" varchar DEFAULT '/blog',
  	"style_journal_section_mode" "enum_homepage_settings_style_journal_section_mode" DEFAULT 'auto',
  	"style_journal_section_limit" numeric DEFAULT 3,
  	"ugc_section_visible" boolean DEFAULT true,
  	"ugc_section_max_items" numeric DEFAULT 6,
  	"newsletter_section_visible" boolean DEFAULT true,
  	"newsletter_section_tag" varchar DEFAULT 'STAY CONNECTED',
  	"newsletter_section_title" varchar DEFAULT '訂閱最新消息',
  	"newsletter_section_subtitle" varchar DEFAULT '搶先收到新品上市、限時優惠與專屬會員好禮通知',
  	"newsletter_section_placeholder" varchar DEFAULT 'your@email.com',
  	"newsletter_section_button_text" varchar DEFAULT '訂閱',
  	"seo_meta_title" varchar DEFAULT 'CHIC KIM & MIU ｜ 韓系質感女裝',
  	"seo_meta_description" varchar DEFAULT '探索 CHIC KIM & MIU 精選韓系質感女裝，專屬你的時尚優雅。',
  	"seo_og_image_id" integer,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "collections_page_settings_cards_collection_tags_filter" (
  	"order" integer NOT NULL,
  	"parent_id" varchar NOT NULL,
  	"value" "enum_collections_page_settings_cards_collection_tags_filter",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "collections_page_settings_cards" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"span" "enum_collections_page_settings_cards_span" DEFAULT 'normal',
  	"sort_order" numeric DEFAULT 0,
  	"is_active" boolean DEFAULT true,
  	"seo_meta_title" varchar,
  	"seo_meta_description" varchar
  );
  
  CREATE TABLE "collections_page_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"hero_overline" varchar DEFAULT 'Collection',
  	"hero_title" varchar DEFAULT '主題精選',
  	"hero_description" varchar DEFAULT '依風格、場合、主題瀏覽我們為您精心策劃的系列',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "product_list_settings_page_size_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" numeric NOT NULL
  );
  
  CREATE TABLE "product_list_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"page_size" numeric DEFAULT 24,
  	"default_sort" "enum_product_list_settings_default_sort" DEFAULT 'newest',
  	"max_price_cap" numeric DEFAULT 10000,
  	"hide_out_of_stock" boolean DEFAULT false,
  	"show_size_filter" boolean DEFAULT true,
  	"default_related_count" numeric DEFAULT 4,
  	"banner_image_id" integer,
  	"banner_overline" varchar DEFAULT 'PRODUCTS',
  	"banner_title" varchar DEFAULT '全部商品',
  	"banner_subtitle" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "about_page_settings_brand_values" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"icon" "enum_about_page_settings_brand_values_icon" NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar NOT NULL
  );
  
  CREATE TABLE "about_page_settings_timeline" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"year" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar NOT NULL
  );
  
  CREATE TABLE "about_page_settings_legacy_gallery_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"src" varchar NOT NULL,
  	"alt" varchar
  );
  
  CREATE TABLE "about_page_settings_contact_cta_buttons" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"url" varchar NOT NULL,
  	"style" "enum_about_page_settings_contact_cta_buttons_style" DEFAULT 'outline',
  	"external" boolean DEFAULT false
  );
  
  CREATE TABLE "about_page_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"hero_image_id" integer,
  	"hero_subtitle" varchar DEFAULT 'About Us',
  	"hero_title" varchar DEFAULT '商店介紹',
  	"hero_description" varchar DEFAULT 'Chic, Kind & Mindful — 為每位女性打造優雅與可愛兼具的穿搭風格',
  	"brand_story_title" varchar DEFAULT '品牌故事',
  	"brand_story_content" jsonb,
  	"brand_story_content_fallback" varchar,
  	"our_vision_enabled" boolean DEFAULT true,
  	"our_vision_subtitle" varchar DEFAULT 'Our Vision',
  	"our_vision_title" varchar DEFAULT '品牌願景',
  	"our_vision_logo_id" integer,
  	"our_vision_logo_background_class" varchar DEFAULT 'bg-[#1a1a1a]',
  	"our_vision_content" varchar,
  	"legacy_gallery_enabled" boolean DEFAULT true,
  	"legacy_gallery_subtitle" varchar DEFAULT 'Gallery',
  	"legacy_gallery_title" varchar DEFAULT '品牌相簿',
  	"legacy_gallery_description" varchar DEFAULT '品牌歷年精選照片，記錄 CKMU 每一段旅程。',
  	"contact_cta_title" varchar DEFAULT '與我們聯繫',
  	"contact_cta_description" varchar DEFAULT '無論是商品諮詢、合作洽談、還是穿搭建議，歡迎隨時透過以下方式聯繫我們。',
  	"seo_title" varchar DEFAULT '商店介紹',
  	"seo_description" varchar DEFAULT '認識 CHIC KIM & MIU — 源自韓國的精緻女裝品牌，為每位女性打造優雅與可愛兼具的穿搭風格。',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "faq_page_settings_categories_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar NOT NULL,
  	"rich_answer" jsonb,
  	"answer" varchar
  );
  
  CREATE TABLE "faq_page_settings_categories" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"icon" "enum_faq_page_settings_categories_icon" NOT NULL,
  	"title" varchar NOT NULL
  );
  
  CREATE TABLE "faq_page_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"hero_image_id" integer,
  	"hero_title" varchar DEFAULT '常見問題',
  	"hero_description" varchar DEFAULT '快速找到您需要的答案',
  	"contact_cta_title" varchar DEFAULT '還是找不到答案？',
  	"contact_cta_description" varchar DEFAULT '歡迎直接聯繫我們的客服團隊，我們很樂意為您解答任何問題。',
  	"seo_title" varchar DEFAULT '常見問題 FAQ',
  	"seo_description" varchar DEFAULT '關於 CHIC KIM & MIU 的訂購流程、付款方式、配送時間、退換貨政策等常見問題解答。',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "policy_pages_settings_terms_sections_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "policy_pages_settings_terms_sections" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"rich_content" jsonb,
  	"content" varchar
  );
  
  CREATE TABLE "policy_pages_settings_privacy_policy_sections_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "policy_pages_settings_privacy_policy_sections" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"rich_content" jsonb,
  	"content" varchar
  );
  
  CREATE TABLE "policy_pages_settings_return_policy_sections_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "policy_pages_settings_return_policy_sections" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"rich_content" jsonb,
  	"content" varchar
  );
  
  CREATE TABLE "policy_pages_settings_shopping_guide_sections_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "policy_pages_settings_shopping_guide_sections" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"rich_content" jsonb,
  	"content" varchar
  );
  
  CREATE TABLE "policy_pages_settings_account_returns_notice_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "policy_pages_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"terms_page_title" varchar DEFAULT '服務條款',
  	"terms_en_title" varchar DEFAULT 'Terms of Service',
  	"terms_effective_date" varchar,
  	"terms_version" varchar DEFAULT '1.0',
  	"terms_seo_title" varchar DEFAULT '服務條款',
  	"terms_seo_description" varchar,
  	"privacy_policy_page_title" varchar DEFAULT '隱私權政策',
  	"privacy_policy_en_title" varchar DEFAULT 'Privacy Policy',
  	"privacy_policy_effective_date" varchar,
  	"privacy_policy_version" varchar DEFAULT '1.0',
  	"privacy_policy_seo_title" varchar DEFAULT '隱私權政策',
  	"privacy_policy_seo_description" varchar,
  	"return_policy_page_title" varchar DEFAULT '退換貨政策',
  	"return_policy_en_title" varchar DEFAULT 'Return & Exchange Policy',
  	"return_policy_effective_date" varchar,
  	"return_policy_version" varchar DEFAULT '1.0',
  	"return_policy_seo_title" varchar DEFAULT '退換貨政策',
  	"return_policy_seo_description" varchar,
  	"shopping_guide_page_title" varchar DEFAULT '購物說明',
  	"shopping_guide_en_title" varchar DEFAULT 'Shopping Guide',
  	"shopping_guide_effective_date" varchar,
  	"shopping_guide_version" varchar DEFAULT '1.0',
  	"shopping_guide_seo_title" varchar DEFAULT '購物說明',
  	"shopping_guide_seo_description" varchar,
  	"account_returns_notice_title" varchar DEFAULT '退換貨須知',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "packaging_page_settings_features_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"icon" "enum_packaging_page_settings_features_items_icon" DEFAULT 'Sparkles',
  	"title" varchar NOT NULL,
  	"description" varchar NOT NULL
  );
  
  CREATE TABLE "packaging_page_settings_process_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"step" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar NOT NULL
  );
  
  CREATE TABLE "packaging_page_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"hero_background_image_url" varchar DEFAULT 'https://shoplineimg.com/559df3efe37ec64e9f000092/69ce99f6a88927d62e71333c/1296x.webp?source_format=png',
  	"hero_eyebrow" varchar DEFAULT 'Packaging',
  	"hero_title" varchar DEFAULT '商品包裝',
  	"hero_subtitle" varchar DEFAULT '精心包裝每一份心意，從拆封的那一刻開始享受',
  	"philosophy_eyebrow" varchar DEFAULT 'Philosophy',
  	"philosophy_heading" varchar DEFAULT '包裝理念',
  	"philosophy_body" varchar DEFAULT '在 CKMU，我們相信包裝不只是保護商品的外衣，更是品牌與顧客之間的第一次觸感溝通。從包裝設計、材質選擇到封裝流程，每一個環節都經過用心規劃，希望您收到包裹時，能感受到我們對品質的堅持與對您的重視。
  
  同時，我們持續優化包裝方式，在維持商品保護力的前提下，盡可能減少不必要的包材，選用環保可回收材質，為永續發展盡一份心力。',
  	"features_eyebrow" varchar DEFAULT 'Features',
  	"features_heading" varchar DEFAULT '包裝特色',
  	"process_eyebrow" varchar DEFAULT 'Process',
  	"process_heading" varchar DEFAULT '出貨流程',
  	"gift_cta_heading" varchar DEFAULT '禮物包裝服務',
  	"gift_cta_description" varchar DEFAULT '送禮給重要的人？我們提供精美禮物包裝加購服務。結帳時於備註欄填寫「禮物包裝」，我們將為您的商品換上專屬禮盒、緞帶與祝福小卡。',
  	"gift_cta_badge_text" varchar DEFAULT '加購禮物包裝 NT$ 80 / 件',
  	"seo_meta_title" varchar DEFAULT '商品包裝',
  	"seo_meta_description" varchar DEFAULT 'CHIC KIM & MIU 商品包裝說明 — 了解我們精心設計的包裝細節與環保理念。',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "global_settings_payment_enabled_methods" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_global_settings_payment_enabled_methods",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "global_settings_ai_seo_faq_for_ai" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar NOT NULL,
  	"answer" varchar NOT NULL
  );
  
  CREATE TABLE "global_settings_app_links_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"icon" varchar DEFAULT '✨',
  	"title" varchar NOT NULL,
  	"description" varchar
  );
  
  CREATE TABLE "global_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"site_site_name" varchar DEFAULT 'CHIC KIM & MIU',
  	"site_site_description" varchar DEFAULT '融合高級極簡優雅與韓系可愛活力的台灣女裝品牌',
  	"site_logo_id" integer,
  	"site_favicon_id" integer,
  	"site_apple_touch_icon_id" integer,
  	"site_og_image_id" integer,
  	"site_enable_brand_anthem" boolean DEFAULT true,
  	"seo_title_template" varchar DEFAULT '%s｜CHIC KIM & MIU',
  	"seo_default_title" varchar DEFAULT 'CHIC KIM & MIU｜韓系質感女裝｜靚秀國際',
  	"seo_meta_description" varchar DEFAULT '融合高級極簡優雅與韓系可愛活力的台灣女裝品牌，米白／米杏／金色調，包容性尺碼，打造每一位女性的日常優雅。',
  	"seo_keywords" varchar DEFAULT '韓系女裝,質感穿搭,韓國女裝,名媛風洋裝,通勤穿搭,約會穿搭,直播選品,台灣女裝品牌,CHIC KIM & MIU,靚秀國際,包容性尺碼,春夏女裝,秋冬女裝,韓風洋裝,氣質女裝',
  	"seo_author" varchar DEFAULT 'CHIC KIM & MIU｜靚秀國際有限公司',
  	"seo_google_site_verification" varchar,
  	"seo_bing_site_verification" varchar,
  	"seo_naver_site_verification" varchar,
  	"social_links_instagram" varchar,
  	"social_links_facebook" varchar,
  	"social_links_line" varchar,
  	"social_links_youtube" varchar,
  	"social_links_tiktok" varchar,
  	"social_links_shopee" varchar,
  	"business_info_legal_name" varchar DEFAULT '靚秀國際有限公司',
  	"business_info_tax_id" varchar DEFAULT '24540533',
  	"business_info_phone" varchar DEFAULT '02-2718-9488',
  	"business_info_email" varchar,
  	"business_info_address" varchar DEFAULT '台北市基隆路一段68號9樓',
  	"business_info_business_hours" varchar DEFAULT '週一至週五 09:30-18:00',
  	"customer_service_line_oa_id" varchar,
  	"customer_service_line_oa_url" varchar,
  	"customer_service_meta_page_id" varchar,
  	"customer_service_meta_app_id" varchar,
  	"customer_service_enable_line_widget" boolean DEFAULT true,
  	"customer_service_enable_messenger" boolean DEFAULT true,
  	"tracking_gtm_id" varchar,
  	"tracking_meta_pixel_id" varchar,
  	"tracking_meta_capi_token" varchar,
  	"tracking_ga4_id" varchar,
  	"tracking_google_ads_id" varchar,
  	"tracking_google_ads_conversion_label" varchar,
  	"payment_currency" varchar DEFAULT 'TWD',
  	"payment_tax_rate" numeric DEFAULT 0,
  	"payment_cod_default_fee" numeric DEFAULT 30,
  	"payment_cod_max_amount" numeric DEFAULT 20000,
  	"cookie_consent_enabled" boolean DEFAULT true,
  	"cookie_consent_banner_text" varchar DEFAULT '本網站使用 Cookie 以提供更好的瀏覽體驗。繼續使用即表示您同意我們的 Cookie 政策。',
  	"cookie_consent_privacy_policy_url" varchar,
  	"cookie_consent_accept_button_text" varchar DEFAULT '我知道了',
  	"sinsang_market_access_token" varchar,
  	"sinsang_market_krw_to_twd_rate" numeric DEFAULT 0.023,
  	"shipping_default_shipping_fee" numeric DEFAULT 60,
  	"shipping_global_free_shipping_threshold" numeric DEFAULT 1000,
  	"ai_seo_enable_llms_txt" boolean DEFAULT true,
  	"ai_seo_llms_site_description" varchar DEFAULT 'CHIC KIM & MIU（靚秀國際）是台灣韓系質感女裝電商品牌，提供日常通勤、約會穿搭、名媛風洋裝等精選韓國女裝。主打直播選品、獨家設計款，提供會員點數、遊戲互動、推薦獎勵等多元購物體驗。',
  	"ai_seo_llms_key_topics" varchar DEFAULT '韓系女裝, 質感穿搭, 直播選品, 名媛風洋裝, 通勤穿搭, 約會穿搭, 韓國女裝, 會員制度, 訂閱方案',
  	"ai_seo_ai_crawler_policy" "enum_global_settings_ai_seo_ai_crawler_policy" DEFAULT 'allow_all',
  	"ai_seo_enable_structured_data" boolean DEFAULT true,
  	"ai_seo_brand_knowledge_base" varchar,
  	"ai_seo_competitor_differentiation" varchar,
  	"social_login_enable_google" boolean DEFAULT true,
  	"social_login_google_client_id" varchar,
  	"social_login_google_client_secret" varchar,
  	"social_login_enable_facebook" boolean DEFAULT true,
  	"social_login_facebook_app_id" varchar,
  	"social_login_facebook_app_secret" varchar,
  	"social_login_enable_line" boolean DEFAULT true,
  	"social_login_line_channel_id" varchar,
  	"social_login_line_channel_secret" varchar,
  	"social_login_enable_apple" boolean DEFAULT false,
  	"social_login_apple_services_id" varchar,
  	"social_login_apple_team_id" varchar,
  	"social_login_apple_key_id" varchar,
  	"social_login_apple_private_key" varchar,
  	"social_login_google_ios_client_id" varchar,
  	"social_login_google_android_client_id" varchar,
  	"social_login_apple_app_bundle_id" varchar,
  	"email_auth_require_email_verification" boolean DEFAULT false,
  	"app_links_enabled" boolean DEFAULT true,
  	"app_links_ios_url" varchar DEFAULT 'https://apps.apple.com/us/app/ckmu-%E9%9F%93%E5%9C%8B%E6%9C%8D%E9%A3%BE/id6740013272',
  	"app_links_android_url" varchar,
  	"app_links_apk_url" varchar,
  	"app_links_tagline" varchar DEFAULT '下載 CKMU APP，韓國服飾隨身逛',
  	"app_links_subtagline" varchar DEFAULT '專屬 APP 限定優惠、推播通知新品到貨、互動小遊戲贏點數、訂單追蹤即時看 — 全方位掌握您的時尚生活。',
  	"app_links_qr_code_image_id" integer,
  	"app_links_coming_soon_note" varchar DEFAULT '即將上線',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "pricing_formula_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"currency_code" "enum_pricing_formula_settings_currency_code" DEFAULT 'KRW',
  	"manual_rate_override" numeric,
  	"weight_shipping_per_gram" numeric DEFAULT 0.3,
  	"weight_shipping_flat_fee" numeric DEFAULT 80,
  	"profit_mode" "enum_pricing_formula_settings_profit_mode" DEFAULT 'percent_only',
  	"profit_percent" numeric DEFAULT 35,
  	"profit_fixed_floor" numeric DEFAULT 200,
  	"price_round_to" numeric DEFAULT 10,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "blog_posts_article_studio_research_sources" ADD CONSTRAINT "blog_posts_article_studio_research_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "blog_posts_tags" ADD CONSTRAINT "blog_posts_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_featured_image_id_media_id_fk" FOREIGN KEY ("featured_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_hero_video_id_media_id_fk" FOREIGN KEY ("hero_video_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_hero_audio_id_media_id_fk" FOREIGN KEY ("hero_audio_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_seo_meta_image_id_media_id_fk" FOREIGN KEY ("seo_meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "blog_posts_rels" ADD CONSTRAINT "blog_posts_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "blog_posts_rels" ADD CONSTRAINT "blog_posts_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "orders_items" ADD CONSTRAINT "orders_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders_items" ADD CONSTRAINT "orders_items_bundle_ref_id_bundles_id_fk" FOREIGN KEY ("bundle_ref_id") REFERENCES "public"."bundles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders_items" ADD CONSTRAINT "orders_items_gift_rule_ref_id_gift_rules_id_fk" FOREIGN KEY ("gift_rule_ref_id") REFERENCES "public"."gift_rules"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders_items" ADD CONSTRAINT "orders_items_add_on_rule_ref_id_add_on_products_id_fk" FOREIGN KEY ("add_on_rule_ref_id") REFERENCES "public"."add_on_products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders_items" ADD CONSTRAINT "orders_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "orders_gifts" ADD CONSTRAINT "orders_gifts_reward_id_user_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."user_rewards"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders_gifts" ADD CONSTRAINT "orders_gifts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_shipping_method_method_id_shipping_methods_id_fk" FOREIGN KEY ("shipping_method_method_id") REFERENCES "public"."shipping_methods"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_affiliate_info_affiliate_user_id_users_id_fk" FOREIGN KEY ("affiliate_info_affiliate_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "invoices_invoice_items" ADD CONSTRAINT "invoices_invoice_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_void_info_void_operator_id_users_id_fk" FOREIGN KEY ("void_info_void_operator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "returns_items" ADD CONSTRAINT "returns_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "returns_items" ADD CONSTRAINT "returns_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."returns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "returns_photos" ADD CONSTRAINT "returns_photos_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "returns_photos" ADD CONSTRAINT "returns_photos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."returns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "returns" ADD CONSTRAINT "returns_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "returns" ADD CONSTRAINT "returns_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "exchanges_items" ADD CONSTRAINT "exchanges_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "exchanges_items" ADD CONSTRAINT "exchanges_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."exchanges"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "exchanges" ADD CONSTRAINT "exchanges_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "exchanges" ADD CONSTRAINT "exchanges_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "refunds_items" ADD CONSTRAINT "refunds_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "refunds_items" ADD CONSTRAINT "refunds_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."refunds"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "refunds" ADD CONSTRAINT "refunds_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "refunds" ADD CONSTRAINT "refunds_return_request_id_returns_id_fk" FOREIGN KEY ("return_request_id") REFERENCES "public"."returns"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "shipping_methods_regions" ADD CONSTRAINT "shipping_methods_regions_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."shipping_methods"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "shipping_methods_tracking_flow" ADD CONSTRAINT "shipping_methods_tracking_flow_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."shipping_methods"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_alias_slugs" ADD CONSTRAINT "products_alias_slugs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_tags" ADD CONSTRAINT "products_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_collection_tags" ADD CONSTRAINT "products_collection_tags_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_images" ADD CONSTRAINT "products_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_images" ADD CONSTRAINT "products_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_variants" ADD CONSTRAINT "products_variants_color_swatch_id_media_id_fk" FOREIGN KEY ("color_swatch_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_variants" ADD CONSTRAINT "products_variants_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_material_images" ADD CONSTRAINT "products_material_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_material_images" ADD CONSTRAINT "products_material_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_personality_types" ADD CONSTRAINT "products_personality_types_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_featured_image_id_media_id_fk" FOREIGN KEY ("featured_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_intro_video_id_media_id_fk" FOREIGN KEY ("intro_video_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_size_chart_id_size_charts_id_fk" FOREIGN KEY ("size_chart_id") REFERENCES "public"."size_charts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_seo_meta_image_id_media_id_fk" FOREIGN KEY ("seo_meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "categories" ADD CONSTRAINT "categories_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "size_charts_measurements" ADD CONSTRAINT "size_charts_measurements_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."size_charts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "size_charts_rows_values" ADD CONSTRAINT "size_charts_rows_values_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."size_charts_rows"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "size_charts_rows" ADD CONSTRAINT "size_charts_rows_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."size_charts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "product_reviews_photos" ADD CONSTRAINT "product_reviews_photos_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "product_reviews_photos" ADD CONSTRAINT "product_reviews_photos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."product_reviews"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_related_order_id_orders_id_fk" FOREIGN KEY ("related_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_related_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("related_purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_related_stock_take_id_stock_takes_id_fk" FOREIGN KEY ("related_stock_take_id") REFERENCES "public"."stock_takes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "purchase_orders_items" ADD CONSTRAINT "purchase_orders_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "purchase_orders_items" ADD CONSTRAINT "purchase_orders_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "stock_takes_items" ADD CONSTRAINT "stock_takes_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "stock_takes_items" ADD CONSTRAINT "stock_takes_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."stock_takes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_invoice_profiles" ADD CONSTRAINT "users_invoice_profiles_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_tags" ADD CONSTRAINT "users_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_addresses" ADD CONSTRAINT "users_addresses_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_game_activity_recent_games" ADD CONSTRAINT "users_game_activity_recent_games_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_ai_dm_preferences_dm_history" ADD CONSTRAINT "users_ai_dm_preferences_dm_history_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_notification_preferences_channels" ADD CONSTRAINT "users_notification_preferences_channels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_avatar_id_media_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_member_tier_id_membership_tiers_id_fk" FOREIGN KEY ("member_tier_id") REFERENCES "public"."membership_tiers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_membership_active_plan_id_subscription_plans_id_fk" FOREIGN KEY ("membership_active_plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_membership_active_subscription_id_user_subscriptions_id_fk" FOREIGN KEY ("membership_active_subscription_id") REFERENCES "public"."user_subscriptions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_referred_by_id_users_id_fk" FOREIGN KEY ("referred_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_vip_owner_id_users_id_fk" FOREIGN KEY ("vip_owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "membership_tiers" ADD CONSTRAINT "membership_tiers_icon_id_media_id_fk" FOREIGN KEY ("icon_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "member_segments_history" ADD CONSTRAINT "member_segments_history_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."member_segments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "member_segments_auto_tags" ADD CONSTRAINT "member_segments_auto_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."member_segments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "member_segments" ADD CONSTRAINT "member_segments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "subscription_plans_dopamine_streak_milestones" ADD CONSTRAINT "subscription_plans_dopamine_streak_milestones_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."subscription_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "subscription_plans_feature_list" ADD CONSTRAINT "subscription_plans_feature_list_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."subscription_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "user_subscriptions_auth_log" ADD CONSTRAINT "user_subscriptions_auth_log_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."user_subscriptions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "points_transactions" ADD CONSTRAINT "points_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "points_transactions" ADD CONSTRAINT "points_transactions_related_order_id_orders_id_fk" FOREIGN KEY ("related_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "points_redemptions_lottery_config_prizes" ADD CONSTRAINT "points_redemptions_lottery_config_prizes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."points_redemptions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "points_redemptions" ADD CONSTRAINT "points_redemptions_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "points_redemptions" ADD CONSTRAINT "points_redemptions_physical_config_linked_product_id_products_id_fk" FOREIGN KEY ("physical_config_linked_product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "user_rewards" ADD CONSTRAINT "user_rewards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "user_rewards" ADD CONSTRAINT "user_rewards_source_record_id_mini_game_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."mini_game_records"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "user_rewards" ADD CONSTRAINT "user_rewards_redemption_ref_id_points_redemptions_id_fk" FOREIGN KEY ("redemption_ref_id") REFERENCES "public"."points_redemptions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "user_rewards" ADD CONSTRAINT "user_rewards_attached_to_order_id_orders_id_fk" FOREIGN KEY ("attached_to_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "credit_score_history" ADD CONSTRAINT "credit_score_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "credit_score_history" ADD CONSTRAINT "credit_score_history_related_order_id_orders_id_fk" FOREIGN KEY ("related_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "credit_score_history" ADD CONSTRAINT "credit_score_history_related_return_id_returns_id_fk" FOREIGN KEY ("related_return_id") REFERENCES "public"."returns"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_related_order_id_orders_id_fk" FOREIGN KEY ("related_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_related_withdrawal_id_wallet_withdrawals_id_fk" FOREIGN KEY ("related_withdrawal_id") REFERENCES "public"."wallet_withdrawals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "wallet_withdrawals" ADD CONSTRAINT "wallet_withdrawals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "conversations" ADD CONSTRAINT "conversations_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "conversations" ADD CONSTRAINT "conversations_merged_into_id_conversations_id_fk" FOREIGN KEY ("merged_into_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "conversations_rels" ADD CONSTRAINT "conversations_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "conversations_rels" ADD CONSTRAINT "conversations_rels_message_tags_fk" FOREIGN KEY ("message_tags_id") REFERENCES "public"."message_tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "conversations_rels" ADD CONSTRAINT "conversations_rels_orders_fk" FOREIGN KEY ("orders_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "conversations_rels" ADD CONSTRAINT "conversations_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "conversations_rels" ADD CONSTRAINT "conversations_rels_returns_fk" FOREIGN KEY ("returns_id") REFERENCES "public"."returns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "messages_attachments" ADD CONSTRAINT "messages_attachments_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "messages_attachments" ADD CONSTRAINT "messages_attachments_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "messages" ADD CONSTRAINT "messages_staff_user_id_users_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "messages" ADD CONSTRAINT "messages_quoted_message_id_messages_id_fk" FOREIGN KEY ("quoted_message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "message_tags" ADD CONSTRAINT "message_tags_parent_id_message_tags_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."message_tags"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "conversation_activities" ADD CONSTRAINT "conversation_activities_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "conversation_activities" ADD CONSTRAINT "conversation_activities_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "product_view_events" ADD CONSTRAINT "product_view_events_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "product_view_events" ADD CONSTRAINT "product_view_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "behavior_events" ADD CONSTRAINT "behavior_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "behavior_events" ADD CONSTRAINT "behavior_events_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "behavior_events" ADD CONSTRAINT "behavior_events_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "coupons" ADD CONSTRAINT "coupons_conditions_tier_required_id_membership_tiers_id_fk" FOREIGN KEY ("conditions_tier_required_id") REFERENCES "public"."membership_tiers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "coupons_rels" ADD CONSTRAINT "coupons_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."coupons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "coupons_rels" ADD CONSTRAINT "coupons_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "add_on_products" ADD CONSTRAINT "add_on_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "add_on_products_rels" ADD CONSTRAINT "add_on_products_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."add_on_products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "add_on_products_rels" ADD CONSTRAINT "add_on_products_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "gift_rules" ADD CONSTRAINT "gift_rules_gift_product_id_products_id_fk" FOREIGN KEY ("gift_product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gift_rules_rels" ADD CONSTRAINT "gift_rules_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."gift_rules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "gift_rules_rels" ADD CONSTRAINT "gift_rules_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "bundles_items" ADD CONSTRAINT "bundles_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bundles_items" ADD CONSTRAINT "bundles_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."bundles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "bundles" ADD CONSTRAINT "bundles_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "marketing_campaigns_target_segments" ADD CONSTRAINT "marketing_campaigns_target_segments_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "marketing_campaigns_tier_filter" ADD CONSTRAINT "marketing_campaigns_tier_filter_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "marketing_campaigns_channels" ADD CONSTRAINT "marketing_campaigns_channels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "marketing_campaigns_message_templates" ADD CONSTRAINT "marketing_campaigns_message_templates_template_ref_id_message_templates_id_fk" FOREIGN KEY ("template_ref_id") REFERENCES "public"."message_templates"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "marketing_campaigns_message_templates" ADD CONSTRAINT "marketing_campaigns_message_templates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "marketing_campaigns_ab_test_config_split_ratio" ADD CONSTRAINT "marketing_campaigns_ab_test_config_split_ratio_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "marketing_campaigns_commerce_surfaces" ADD CONSTRAINT "marketing_campaigns_commerce_surfaces_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_journey_ref_id_automation_journeys_id_fk" FOREIGN KEY ("journey_ref_id") REFERENCES "public"."automation_journeys"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_linked_festival_id_festival_templates_id_fk" FOREIGN KEY ("linked_festival_id") REFERENCES "public"."festival_templates"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_commerce_approval_approved_by_id_users_id_fk" FOREIGN KEY ("commerce_approval_approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "promotion_rules_scope_include_tags" ADD CONSTRAINT "promotion_rules_scope_include_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."promotion_rules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "promotion_rules_scope_exclude_tags" ADD CONSTRAINT "promotion_rules_scope_exclude_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."promotion_rules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "promotion_rules_conditions_segments_not_in" ADD CONSTRAINT "promotion_rules_conditions_segments_not_in_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."promotion_rules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "promotion_rules_conditions_channels" ADD CONSTRAINT "promotion_rules_conditions_channels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."promotion_rules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "promotion_rules_stacking_stackable_with" ADD CONSTRAINT "promotion_rules_stacking_stackable_with_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."promotion_rules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "promotion_rules" ADD CONSTRAINT "promotion_rules_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "promotion_rules" ADD CONSTRAINT "promotion_rules_effect_gift_product_id_products_id_fk" FOREIGN KEY ("effect_gift_product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "promotion_rules_rels" ADD CONSTRAINT "promotion_rules_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."promotion_rules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "promotion_rules_rels" ADD CONSTRAINT "promotion_rules_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "promotion_rules_rels" ADD CONSTRAINT "promotion_rules_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "promotion_rules_rels" ADD CONSTRAINT "promotion_rules_rels_membership_tiers_fk" FOREIGN KEY ("membership_tiers_id") REFERENCES "public"."membership_tiers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "promotion_applications" ADD CONSTRAINT "promotion_applications_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "promotion_applications" ADD CONSTRAINT "promotion_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "promotion_applications" ADD CONSTRAINT "promotion_applications_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "promotion_applications" ADD CONSTRAINT "promotion_applications_rule_id_promotion_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."promotion_rules"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "festival_templates_phases_channels" ADD CONSTRAINT "festival_templates_phases_channels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."festival_templates_phases"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "festival_templates_phases" ADD CONSTRAINT "festival_templates_phases_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."festival_templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "festival_templates_segment_offers" ADD CONSTRAINT "festival_templates_segment_offers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."festival_templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "festival_templates_ab_test_variants" ADD CONSTRAINT "festival_templates_ab_test_variants_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."festival_templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "festival_templates_linked_journeys" ADD CONSTRAINT "festival_templates_linked_journeys_journey_id_automation_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."automation_journeys"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "festival_templates_linked_journeys" ADD CONSTRAINT "festival_templates_linked_journeys_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."festival_templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "festival_templates" ADD CONSTRAINT "festival_templates_theme_banner_image_id_media_id_fk" FOREIGN KEY ("theme_banner_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "festival_templates" ADD CONSTRAINT "festival_templates_theme_mobile_image_id_media_id_fk" FOREIGN KEY ("theme_mobile_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "birthday_campaigns_phases_phase1_channels" ADD CONSTRAINT "birthday_campaigns_phases_phase1_channels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."birthday_campaigns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "birthday_campaigns_phases_phase2_channels" ADD CONSTRAINT "birthday_campaigns_phases_phase2_channels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."birthday_campaigns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "birthday_campaigns_phases_phase3_channels" ADD CONSTRAINT "birthday_campaigns_phases_phase3_channels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."birthday_campaigns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "birthday_campaigns_phases_phase3_recommended_products" ADD CONSTRAINT "birthday_campaigns_phases_phase3_recommended_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "birthday_campaigns_phases_phase3_recommended_products" ADD CONSTRAINT "birthday_campaigns_phases_phase3_recommended_products_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."birthday_campaigns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "birthday_campaigns_phases_phase4_channels" ADD CONSTRAINT "birthday_campaigns_phases_phase4_channels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."birthday_campaigns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "birthday_campaigns_phases_phase5_channels" ADD CONSTRAINT "birthday_campaigns_phases_phase5_channels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."birthday_campaigns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "birthday_campaigns" ADD CONSTRAINT "birthday_campaigns_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "automation_journeys_steps" ADD CONSTRAINT "automation_journeys_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."automation_journeys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "automation_logs" ADD CONSTRAINT "automation_logs_journey_id_automation_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."automation_journeys"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "automation_logs" ADD CONSTRAINT "automation_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ab_tests_variants" ADD CONSTRAINT "ab_tests_variants_message_template_id_message_templates_id_fk" FOREIGN KEY ("message_template_id") REFERENCES "public"."message_templates"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ab_tests_variants" ADD CONSTRAINT "ab_tests_variants_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."ab_tests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ab_tests" ADD CONSTRAINT "ab_tests_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "marketing_execution_logs" ADD CONSTRAINT "marketing_execution_logs_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "marketing_execution_logs" ADD CONSTRAINT "marketing_execution_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "marketing_execution_logs" ADD CONSTRAINT "marketing_execution_logs_message_template_id_message_templates_id_fk" FOREIGN KEY ("message_template_id") REFERENCES "public"."message_templates"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "message_templates_variables" ADD CONSTRAINT "message_templates_variables_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."message_templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "message_templates_segment_variants" ADD CONSTRAINT "message_templates_segment_variants_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."message_templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "message_templates_credit_score_variants" ADD CONSTRAINT "message_templates_credit_score_variants_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."message_templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "message_templates_tier_variants" ADD CONSTRAINT "message_templates_tier_variants_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."message_templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "message_templates_tags" ADD CONSTRAINT "message_templates_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."message_templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_preview_image_id_media_id_fk" FOREIGN KEY ("preview_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "newsletter_subscribers" ADD CONSTRAINT "newsletter_subscribers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ad_audiences_rels" ADD CONSTRAINT "ad_audiences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."ad_audiences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ad_audiences_rels" ADD CONSTRAINT "ad_audiences_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "search_console_keywords" ADD CONSTRAINT "search_console_keywords_target_product_id_products_id_fk" FOREIGN KEY ("target_product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "competitor_price_records_flags" ADD CONSTRAINT "competitor_price_records_flags_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."competitor_price_records"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "competitor_price_records" ADD CONSTRAINT "competitor_price_records_related_product_id_products_id_fk" FOREIGN KEY ("related_product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "marketing_content_drafts_channels" ADD CONSTRAINT "marketing_content_drafts_channels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."marketing_content_drafts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "marketing_content_drafts" ADD CONSTRAINT "marketing_content_drafts_target_product_id_products_id_fk" FOREIGN KEY ("target_product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "customer_service_tickets_messages" ADD CONSTRAINT "customer_service_tickets_messages_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."customer_service_tickets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "customer_service_tickets" ADD CONSTRAINT "customer_service_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "customer_service_tickets" ADD CONSTRAINT "customer_service_tickets_assigned_agent_id_users_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "customer_service_tickets" ADD CONSTRAINT "customer_service_tickets_related_order_id_orders_id_fk" FOREIGN KEY ("related_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "concierge_service_requests_request_detail_attachments" ADD CONSTRAINT "concierge_service_requests_request_detail_attachments_file_id_media_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "concierge_service_requests_request_detail_attachments" ADD CONSTRAINT "concierge_service_requests_request_detail_attachments_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."concierge_service_requests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "concierge_service_requests_concierge_notes" ADD CONSTRAINT "concierge_service_requests_concierge_notes_added_by_id_users_id_fk" FOREIGN KEY ("added_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "concierge_service_requests_concierge_notes" ADD CONSTRAINT "concierge_service_requests_concierge_notes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."concierge_service_requests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "concierge_service_requests" ADD CONSTRAINT "concierge_service_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "concierge_service_requests" ADD CONSTRAINT "concierge_service_requests_assigned_concierge_id_users_id_fk" FOREIGN KEY ("assigned_concierge_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "concierge_service_requests" ADD CONSTRAINT "concierge_service_requests_related_order_id_orders_id_fk" FOREIGN KEY ("related_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "affiliates_withdrawal_requests" ADD CONSTRAINT "affiliates_withdrawal_requests_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."affiliates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ugc_posts_media_items" ADD CONSTRAINT "ugc_posts_media_items_file_id_media_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ugc_posts_media_items" ADD CONSTRAINT "ugc_posts_media_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."ugc_posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ugc_posts_display_locations" ADD CONSTRAINT "ugc_posts_display_locations_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."ugc_posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ugc_posts_hashtags" ADD CONSTRAINT "ugc_posts_hashtags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."ugc_posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ugc_posts" ADD CONSTRAINT "ugc_posts_author_avatar_id_media_id_fk" FOREIGN KEY ("author_avatar_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ugc_posts_rels" ADD CONSTRAINT "ugc_posts_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."ugc_posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ugc_posts_rels" ADD CONSTRAINT "ugc_posts_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "prize_pools_eligible_games" ADD CONSTRAINT "prize_pools_eligible_games_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."prize_pools"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "prize_pools" ADD CONSTRAINT "prize_pools_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "mini_game_records" ADD CONSTRAINT "mini_game_records_player_id_users_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "card_battles" ADD CONSTRAINT "card_battles_challenger_id_users_id_fk" FOREIGN KEY ("challenger_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "card_battles" ADD CONSTRAINT "card_battles_opponent_id_users_id_fk" FOREIGN KEY ("opponent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "game_leaderboard_badges" ADD CONSTRAINT "game_leaderboard_badges_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."game_leaderboard"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "game_leaderboard" ADD CONSTRAINT "game_leaderboard_player_id_users_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "collectible_card_templates" ADD CONSTRAINT "collectible_card_templates_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "collectible_cards" ADD CONSTRAINT "collectible_cards_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "collectible_cards" ADD CONSTRAINT "collectible_cards_template_id_collectible_card_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."collectible_card_templates"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "collectible_cards" ADD CONSTRAINT "collectible_cards_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "collectible_cards" ADD CONSTRAINT "collectible_cards_original_owner_id_users_id_fk" FOREIGN KEY ("original_owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "collectible_cards" ADD CONSTRAINT "collectible_cards_source_order_id_orders_id_fk" FOREIGN KEY ("source_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "collectible_card_events" ADD CONSTRAINT "collectible_card_events_card_id_collectible_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."collectible_cards"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "collectible_card_events" ADD CONSTRAINT "collectible_card_events_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "collectible_card_events" ADD CONSTRAINT "collectible_card_events_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "collectible_card_events" ADD CONSTRAINT "collectible_card_events_source_order_id_orders_id_fk" FOREIGN KEY ("source_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "style_submissions_images" ADD CONSTRAINT "style_submissions_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "style_submissions_images" ADD CONSTRAINT "style_submissions_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."style_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "style_submissions_tags" ADD CONSTRAINT "style_submissions_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."style_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "style_submissions" ADD CONSTRAINT "style_submissions_player_id_users_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "style_submissions" ADD CONSTRAINT "style_submissions_room_id_style_game_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."style_game_rooms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "style_submissions" ADD CONSTRAINT "style_submissions_parent_id_style_submissions_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."style_submissions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "style_submissions" ADD CONSTRAINT "style_submissions_wish_id_style_wishes_id_fk" FOREIGN KEY ("wish_id") REFERENCES "public"."style_wishes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "style_submissions" ADD CONSTRAINT "style_submissions_moderation_reviewed_by_id_users_id_fk" FOREIGN KEY ("moderation_reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "style_game_rooms_participants" ADD CONSTRAINT "style_game_rooms_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "style_game_rooms_participants" ADD CONSTRAINT "style_game_rooms_participants_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."style_game_rooms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "style_game_rooms" ADD CONSTRAINT "style_game_rooms_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "style_game_rooms" ADD CONSTRAINT "style_game_rooms_result_winner_id_users_id_fk" FOREIGN KEY ("result_winner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "style_votes" ADD CONSTRAINT "style_votes_voter_id_users_id_fk" FOREIGN KEY ("voter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "style_votes" ADD CONSTRAINT "style_votes_submission_id_style_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."style_submissions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "style_votes" ADD CONSTRAINT "style_votes_room_id_style_game_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."style_game_rooms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "style_wishes_reference_photos" ADD CONSTRAINT "style_wishes_reference_photos_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "style_wishes_reference_photos" ADD CONSTRAINT "style_wishes_reference_photos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."style_wishes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "style_wishes_grants" ADD CONSTRAINT "style_wishes_grants_granter_id_users_id_fk" FOREIGN KEY ("granter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "style_wishes_grants" ADD CONSTRAINT "style_wishes_grants_submission_id_style_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."style_submissions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "style_wishes_grants" ADD CONSTRAINT "style_wishes_grants_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."style_wishes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "style_wishes" ADD CONSTRAINT "style_wishes_seeker_id_users_id_fk" FOREIGN KEY ("seeker_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "style_wishes" ADD CONSTRAINT "style_wishes_winning_grant_id_style_submissions_id_fk" FOREIGN KEY ("winning_grant_id") REFERENCES "public"."style_submissions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_banner" ADD CONSTRAINT "pages_blocks_hero_banner_background_image_id_media_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_banner" ADD CONSTRAINT "pages_blocks_hero_banner_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_magazine_cover_corner_labels" ADD CONSTRAINT "pages_blocks_magazine_cover_corner_labels_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_magazine_cover"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_magazine_cover" ADD CONSTRAINT "pages_blocks_magazine_cover_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_magazine_cover" ADD CONSTRAINT "pages_blocks_magazine_cover_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_pull_quote" ADD CONSTRAINT "pages_blocks_pull_quote_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_editorial_spread_rows" ADD CONSTRAINT "pages_blocks_editorial_spread_rows_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_editorial_spread_rows" ADD CONSTRAINT "pages_blocks_editorial_spread_rows_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_editorial_spread"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_editorial_spread" ADD CONSTRAINT "pages_blocks_editorial_spread_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_lookbook_grid_items_tags" ADD CONSTRAINT "pages_blocks_lookbook_grid_items_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_lookbook_grid_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_lookbook_grid_items" ADD CONSTRAINT "pages_blocks_lookbook_grid_items_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_lookbook_grid_items" ADD CONSTRAINT "pages_blocks_lookbook_grid_items_linked_product_id_products_id_fk" FOREIGN KEY ("linked_product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_lookbook_grid_items" ADD CONSTRAINT "pages_blocks_lookbook_grid_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_lookbook_grid"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_lookbook_grid" ADD CONSTRAINT "pages_blocks_lookbook_grid_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_celebrity_grid" ADD CONSTRAINT "pages_blocks_celebrity_grid_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_kol_persona_social_links" ADD CONSTRAINT "pages_blocks_kol_persona_social_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_kol_persona"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_kol_persona" ADD CONSTRAINT "pages_blocks_kol_persona_avatar_id_media_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_kol_persona" ADD CONSTRAINT "pages_blocks_kol_persona_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_rich_content" ADD CONSTRAINT "pages_blocks_rich_content_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_image_gallery_images" ADD CONSTRAINT "pages_blocks_image_gallery_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_image_gallery_images" ADD CONSTRAINT "pages_blocks_image_gallery_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_image_gallery"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_image_gallery" ADD CONSTRAINT "pages_blocks_image_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_product_showcase" ADD CONSTRAINT "pages_blocks_product_showcase_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_cta" ADD CONSTRAINT "pages_blocks_cta_background_image_id_media_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_cta" ADD CONSTRAINT "pages_blocks_cta_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_faq_questions" ADD CONSTRAINT "pages_blocks_faq_questions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_faq"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_faq" ADD CONSTRAINT "pages_blocks_faq_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_testimonial_testimonials" ADD CONSTRAINT "pages_blocks_testimonial_testimonials_avatar_id_media_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_testimonial_testimonials" ADD CONSTRAINT "pages_blocks_testimonial_testimonials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_testimonial"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_testimonial" ADD CONSTRAINT "pages_blocks_testimonial_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_countdown" ADD CONSTRAINT "pages_blocks_countdown_background_image_id_media_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_countdown" ADD CONSTRAINT "pages_blocks_countdown_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_video" ADD CONSTRAINT "pages_blocks_video_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_divider" ADD CONSTRAINT "pages_blocks_divider_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages" ADD CONSTRAINT "pages_seo_meta_image_id_media_id_fk" FOREIGN KEY ("seo_meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_rels" ADD CONSTRAINT "pages_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_rels" ADD CONSTRAINT "pages_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "celebrity_features_gallery_images" ADD CONSTRAINT "celebrity_features_gallery_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "celebrity_features_gallery_images" ADD CONSTRAINT "celebrity_features_gallery_images_linked_product_id_products_id_fk" FOREIGN KEY ("linked_product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "celebrity_features_gallery_images" ADD CONSTRAINT "celebrity_features_gallery_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."celebrity_features"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "celebrity_features_social_links" ADD CONSTRAINT "celebrity_features_social_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."celebrity_features"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "celebrity_features" ADD CONSTRAINT "celebrity_features_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "celebrity_features" ADD CONSTRAINT "celebrity_features_linked_product_id_products_id_fk" FOREIGN KEY ("linked_product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "podcasts_tags" ADD CONSTRAINT "podcasts_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."podcasts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "podcasts_sources" ADD CONSTRAINT "podcasts_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."podcasts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "podcasts_hosts" ADD CONSTRAINT "podcasts_hosts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."podcasts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "podcasts" ADD CONSTRAINT "podcasts_audio_file_id_media_id_fk" FOREIGN KEY ("audio_file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "podcasts" ADD CONSTRAINT "podcasts_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "podcasts" ADD CONSTRAINT "podcasts_seo_meta_image_id_media_id_fk" FOREIGN KEY ("seo_meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "podcasts_rels" ADD CONSTRAINT "podcasts_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."podcasts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "podcasts_rels" ADD CONSTRAINT "podcasts_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "podcasts_rels" ADD CONSTRAINT "podcasts_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "media" ADD CONSTRAINT "media_folder_id_payload_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."payload_folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_folders_folder_type" ADD CONSTRAINT "payload_folders_folder_type_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_folders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_folders" ADD CONSTRAINT "payload_folders_folder_id_payload_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."payload_folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_blog_posts_fk" FOREIGN KEY ("blog_posts_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_blog_categories_fk" FOREIGN KEY ("blog_categories_id") REFERENCES "public"."blog_categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_orders_fk" FOREIGN KEY ("orders_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_invoices_fk" FOREIGN KEY ("invoices_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_returns_fk" FOREIGN KEY ("returns_id") REFERENCES "public"."returns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_exchanges_fk" FOREIGN KEY ("exchanges_id") REFERENCES "public"."exchanges"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_refunds_fk" FOREIGN KEY ("refunds_id") REFERENCES "public"."refunds"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_shipping_methods_fk" FOREIGN KEY ("shipping_methods_id") REFERENCES "public"."shipping_methods"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_size_charts_fk" FOREIGN KEY ("size_charts_id") REFERENCES "public"."size_charts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_product_reviews_fk" FOREIGN KEY ("product_reviews_id") REFERENCES "public"."product_reviews"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_inventory_transactions_fk" FOREIGN KEY ("inventory_transactions_id") REFERENCES "public"."inventory_transactions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_purchase_orders_fk" FOREIGN KEY ("purchase_orders_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_stock_takes_fk" FOREIGN KEY ("stock_takes_id") REFERENCES "public"."stock_takes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_membership_tiers_fk" FOREIGN KEY ("membership_tiers_id") REFERENCES "public"."membership_tiers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_member_segments_fk" FOREIGN KEY ("member_segments_id") REFERENCES "public"."member_segments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_subscription_plans_fk" FOREIGN KEY ("subscription_plans_id") REFERENCES "public"."subscription_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_user_subscriptions_fk" FOREIGN KEY ("user_subscriptions_id") REFERENCES "public"."user_subscriptions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_points_transactions_fk" FOREIGN KEY ("points_transactions_id") REFERENCES "public"."points_transactions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_points_redemptions_fk" FOREIGN KEY ("points_redemptions_id") REFERENCES "public"."points_redemptions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_user_rewards_fk" FOREIGN KEY ("user_rewards_id") REFERENCES "public"."user_rewards"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_credit_score_history_fk" FOREIGN KEY ("credit_score_history_id") REFERENCES "public"."credit_score_history"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_wallet_transactions_fk" FOREIGN KEY ("wallet_transactions_id") REFERENCES "public"."wallet_transactions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_wallet_withdrawals_fk" FOREIGN KEY ("wallet_withdrawals_id") REFERENCES "public"."wallet_withdrawals"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_wishlist_items_fk" FOREIGN KEY ("wishlist_items_id") REFERENCES "public"."wishlist_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_conversations_fk" FOREIGN KEY ("conversations_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_messages_fk" FOREIGN KEY ("messages_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_message_tags_fk" FOREIGN KEY ("message_tags_id") REFERENCES "public"."message_tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_conversation_activities_fk" FOREIGN KEY ("conversation_activities_id") REFERENCES "public"."conversation_activities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_product_view_events_fk" FOREIGN KEY ("product_view_events_id") REFERENCES "public"."product_view_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_behavior_events_fk" FOREIGN KEY ("behavior_events_id") REFERENCES "public"."behavior_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_coupons_fk" FOREIGN KEY ("coupons_id") REFERENCES "public"."coupons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_coupon_redemptions_fk" FOREIGN KEY ("coupon_redemptions_id") REFERENCES "public"."coupon_redemptions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_add_on_products_fk" FOREIGN KEY ("add_on_products_id") REFERENCES "public"."add_on_products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_gift_rules_fk" FOREIGN KEY ("gift_rules_id") REFERENCES "public"."gift_rules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_bundles_fk" FOREIGN KEY ("bundles_id") REFERENCES "public"."bundles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_marketing_campaigns_fk" FOREIGN KEY ("marketing_campaigns_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_promotion_rules_fk" FOREIGN KEY ("promotion_rules_id") REFERENCES "public"."promotion_rules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_promotion_applications_fk" FOREIGN KEY ("promotion_applications_id") REFERENCES "public"."promotion_applications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_festival_templates_fk" FOREIGN KEY ("festival_templates_id") REFERENCES "public"."festival_templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_birthday_campaigns_fk" FOREIGN KEY ("birthday_campaigns_id") REFERENCES "public"."birthday_campaigns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_automation_journeys_fk" FOREIGN KEY ("automation_journeys_id") REFERENCES "public"."automation_journeys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_automation_logs_fk" FOREIGN KEY ("automation_logs_id") REFERENCES "public"."automation_logs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ab_tests_fk" FOREIGN KEY ("ab_tests_id") REFERENCES "public"."ab_tests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_marketing_execution_logs_fk" FOREIGN KEY ("marketing_execution_logs_id") REFERENCES "public"."marketing_execution_logs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_message_templates_fk" FOREIGN KEY ("message_templates_id") REFERENCES "public"."message_templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_email_templates_fk" FOREIGN KEY ("email_templates_id") REFERENCES "public"."email_templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_newsletter_subscribers_fk" FOREIGN KEY ("newsletter_subscribers_id") REFERENCES "public"."newsletter_subscribers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_utm_campaigns_fk" FOREIGN KEY ("utm_campaigns_id") REFERENCES "public"."utm_campaigns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ad_audiences_fk" FOREIGN KEY ("ad_audiences_id") REFERENCES "public"."ad_audiences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_search_console_keywords_fk" FOREIGN KEY ("search_console_keywords_id") REFERENCES "public"."search_console_keywords"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_competitor_price_records_fk" FOREIGN KEY ("competitor_price_records_id") REFERENCES "public"."competitor_price_records"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_marketing_content_drafts_fk" FOREIGN KEY ("marketing_content_drafts_id") REFERENCES "public"."marketing_content_drafts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_customer_service_tickets_fk" FOREIGN KEY ("customer_service_tickets_id") REFERENCES "public"."customer_service_tickets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_concierge_service_requests_fk" FOREIGN KEY ("concierge_service_requests_id") REFERENCES "public"."concierge_service_requests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_affiliates_fk" FOREIGN KEY ("affiliates_id") REFERENCES "public"."affiliates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ugc_posts_fk" FOREIGN KEY ("ugc_posts_id") REFERENCES "public"."ugc_posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_prize_pools_fk" FOREIGN KEY ("prize_pools_id") REFERENCES "public"."prize_pools"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_mini_game_records_fk" FOREIGN KEY ("mini_game_records_id") REFERENCES "public"."mini_game_records"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_card_battles_fk" FOREIGN KEY ("card_battles_id") REFERENCES "public"."card_battles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_game_leaderboard_fk" FOREIGN KEY ("game_leaderboard_id") REFERENCES "public"."game_leaderboard"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_collectible_card_templates_fk" FOREIGN KEY ("collectible_card_templates_id") REFERENCES "public"."collectible_card_templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_collectible_cards_fk" FOREIGN KEY ("collectible_cards_id") REFERENCES "public"."collectible_cards"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_collectible_card_events_fk" FOREIGN KEY ("collectible_card_events_id") REFERENCES "public"."collectible_card_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_style_submissions_fk" FOREIGN KEY ("style_submissions_id") REFERENCES "public"."style_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_style_game_rooms_fk" FOREIGN KEY ("style_game_rooms_id") REFERENCES "public"."style_game_rooms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_style_votes_fk" FOREIGN KEY ("style_votes_id") REFERENCES "public"."style_votes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_style_wishes_fk" FOREIGN KEY ("style_wishes_id") REFERENCES "public"."style_wishes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_daily_horoscopes_fk" FOREIGN KEY ("daily_horoscopes_id") REFERENCES "public"."daily_horoscopes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_celebrity_features_fk" FOREIGN KEY ("celebrity_features_id") REFERENCES "public"."celebrity_features"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_podcasts_fk" FOREIGN KEY ("podcasts_id") REFERENCES "public"."podcasts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_site_themes_fk" FOREIGN KEY ("site_themes_id") REFERENCES "public"."site_themes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_login_attempts_fk" FOREIGN KEY ("login_attempts_id") REFERENCES "public"."login_attempts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_currencies_fk" FOREIGN KEY ("currencies_id") REFERENCES "public"."currencies"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_folders_fk" FOREIGN KEY ("payload_folders_id") REFERENCES "public"."payload_folders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "order_settings_notifications_admin_alert_emails" ADD CONSTRAINT "order_settings_notifications_admin_alert_emails_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."order_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "order_settings_status_flow_custom_statuses" ADD CONSTRAINT "order_settings_status_flow_custom_statuses_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."order_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "invoice_settings_automation_config_notify_channels" ADD CONSTRAINT "invoice_settings_automation_config_notify_channels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."invoice_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "invoice_settings" ADD CONSTRAINT "invoice_settings_branding_config_invoice_logo_id_media_id_fk" FOREIGN KEY ("branding_config_invoice_logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "invoice_settings" ADD CONSTRAINT "invoice_settings_branding_config_company_chop_id_media_id_fk" FOREIGN KEY ("branding_config_company_chop_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tax_settings_tax_categories" ADD CONSTRAINT "tax_settings_tax_categories_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tax_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "loyalty_settings_recommendation_config_placements" ADD CONSTRAINT "loyalty_settings_recommendation_config_placements_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."loyalty_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "point_redemption_settings_expiry_notification_reminder_days" ADD CONSTRAINT "point_redemption_settings_expiry_notification_reminder_days_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."point_redemption_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "point_redemption_settings_boost_events" ADD CONSTRAINT "point_redemption_settings_boost_events_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."point_redemption_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "point_redemption_settings_ugc_testimonials_items" ADD CONSTRAINT "point_redemption_settings_ugc_testimonials_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."point_redemption_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "point_redemption_settings_rels" ADD CONSTRAINT "point_redemption_settings_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."point_redemption_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "point_redemption_settings_rels" ADD CONSTRAINT "point_redemption_settings_rels_points_redemptions_fk" FOREIGN KEY ("points_redemptions_id") REFERENCES "public"."points_redemptions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "segmentation_settings_segment_colors" ADD CONSTRAINT "segmentation_settings_segment_colors_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."segmentation_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cs_settings_business_hours_schedule" ADD CONSTRAINT "cs_settings_business_hours_schedule_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."cs_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cs_settings_business_hours_holidays" ADD CONSTRAINT "cs_settings_business_hours_holidays_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."cs_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cs_settings_sla_first_response_minutes" ADD CONSTRAINT "cs_settings_sla_first_response_minutes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."cs_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cs_settings_sla_resolution_hours" ADD CONSTRAINT "cs_settings_sla_resolution_hours_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."cs_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cs_settings_anti_spam_blocked_keywords" ADD CONSTRAINT "cs_settings_anti_spam_blocked_keywords_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."cs_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cs_settings_anti_spam_blocked_anon_ids" ADD CONSTRAINT "cs_settings_anti_spam_blocked_anon_ids_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."cs_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cs_settings_anti_spam_blocked_i_ps" ADD CONSTRAINT "cs_settings_anti_spam_blocked_i_ps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."cs_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cs_settings" ADD CONSTRAINT "cs_settings_default_assignee_id_users_id_fk" FOREIGN KEY ("default_assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "marketing_automation_settings_birthday_config_tier_gifts" ADD CONSTRAINT "marketing_automation_settings_birthday_config_tier_gifts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."marketing_automation_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "game_settings_spin_wheel_prizes" ADD CONSTRAINT "game_settings_spin_wheel_prizes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."game_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "game_settings_scratch_card_prizes" ADD CONSTRAINT "game_settings_scratch_card_prizes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."game_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navigation_settings_main_menu_children" ADD CONSTRAINT "navigation_settings_main_menu_children_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."navigation_settings_main_menu"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navigation_settings_main_menu" ADD CONSTRAINT "navigation_settings_main_menu_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."navigation_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navigation_settings_footer_sections_links" ADD CONSTRAINT "navigation_settings_footer_sections_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."navigation_settings_footer_sections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navigation_settings_footer_sections" ADD CONSTRAINT "navigation_settings_footer_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."navigation_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_settings_hero_banners" ADD CONSTRAINT "homepage_settings_hero_banners_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "homepage_settings_hero_banners" ADD CONSTRAINT "homepage_settings_hero_banners_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_settings_quick_menu" ADD CONSTRAINT "homepage_settings_quick_menu_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_settings_service_highlights" ADD CONSTRAINT "homepage_settings_service_highlights_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_settings_style_journal_section_manual_posts" ADD CONSTRAINT "homepage_settings_style_journal_section_manual_posts_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "homepage_settings_style_journal_section_manual_posts" ADD CONSTRAINT "homepage_settings_style_journal_section_manual_posts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_settings" ADD CONSTRAINT "homepage_settings_brand_banner_image_id_media_id_fk" FOREIGN KEY ("brand_banner_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "homepage_settings" ADD CONSTRAINT "homepage_settings_seo_og_image_id_media_id_fk" FOREIGN KEY ("seo_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "collections_page_settings_cards_collection_tags_filter" ADD CONSTRAINT "collections_page_settings_cards_collection_tags_filter_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."collections_page_settings_cards"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "collections_page_settings_cards" ADD CONSTRAINT "collections_page_settings_cards_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "collections_page_settings_cards" ADD CONSTRAINT "collections_page_settings_cards_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."collections_page_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "product_list_settings_page_size_options" ADD CONSTRAINT "product_list_settings_page_size_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."product_list_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "product_list_settings" ADD CONSTRAINT "product_list_settings_banner_image_id_media_id_fk" FOREIGN KEY ("banner_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "about_page_settings_brand_values" ADD CONSTRAINT "about_page_settings_brand_values_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."about_page_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "about_page_settings_timeline" ADD CONSTRAINT "about_page_settings_timeline_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."about_page_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "about_page_settings_legacy_gallery_images" ADD CONSTRAINT "about_page_settings_legacy_gallery_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."about_page_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "about_page_settings_contact_cta_buttons" ADD CONSTRAINT "about_page_settings_contact_cta_buttons_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."about_page_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "about_page_settings" ADD CONSTRAINT "about_page_settings_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "about_page_settings" ADD CONSTRAINT "about_page_settings_our_vision_logo_id_media_id_fk" FOREIGN KEY ("our_vision_logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "faq_page_settings_categories_items" ADD CONSTRAINT "faq_page_settings_categories_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."faq_page_settings_categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "faq_page_settings_categories" ADD CONSTRAINT "faq_page_settings_categories_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."faq_page_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "faq_page_settings" ADD CONSTRAINT "faq_page_settings_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "policy_pages_settings_terms_sections_items" ADD CONSTRAINT "policy_pages_settings_terms_sections_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."policy_pages_settings_terms_sections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "policy_pages_settings_terms_sections" ADD CONSTRAINT "policy_pages_settings_terms_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."policy_pages_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "policy_pages_settings_privacy_policy_sections_items" ADD CONSTRAINT "policy_pages_settings_privacy_policy_sections_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."policy_pages_settings_privacy_policy_sections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "policy_pages_settings_privacy_policy_sections" ADD CONSTRAINT "policy_pages_settings_privacy_policy_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."policy_pages_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "policy_pages_settings_return_policy_sections_items" ADD CONSTRAINT "policy_pages_settings_return_policy_sections_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."policy_pages_settings_return_policy_sections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "policy_pages_settings_return_policy_sections" ADD CONSTRAINT "policy_pages_settings_return_policy_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."policy_pages_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "policy_pages_settings_shopping_guide_sections_items" ADD CONSTRAINT "policy_pages_settings_shopping_guide_sections_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."policy_pages_settings_shopping_guide_sections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "policy_pages_settings_shopping_guide_sections" ADD CONSTRAINT "policy_pages_settings_shopping_guide_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."policy_pages_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "policy_pages_settings_account_returns_notice_items" ADD CONSTRAINT "policy_pages_settings_account_returns_notice_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."policy_pages_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "packaging_page_settings_features_items" ADD CONSTRAINT "packaging_page_settings_features_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."packaging_page_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "packaging_page_settings_process_steps" ADD CONSTRAINT "packaging_page_settings_process_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."packaging_page_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "global_settings_payment_enabled_methods" ADD CONSTRAINT "global_settings_payment_enabled_methods_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."global_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "global_settings_ai_seo_faq_for_ai" ADD CONSTRAINT "global_settings_ai_seo_faq_for_ai_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."global_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "global_settings_app_links_features" ADD CONSTRAINT "global_settings_app_links_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."global_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "global_settings" ADD CONSTRAINT "global_settings_site_logo_id_media_id_fk" FOREIGN KEY ("site_logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "global_settings" ADD CONSTRAINT "global_settings_site_favicon_id_media_id_fk" FOREIGN KEY ("site_favicon_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "global_settings" ADD CONSTRAINT "global_settings_site_apple_touch_icon_id_media_id_fk" FOREIGN KEY ("site_apple_touch_icon_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "global_settings" ADD CONSTRAINT "global_settings_site_og_image_id_media_id_fk" FOREIGN KEY ("site_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "global_settings" ADD CONSTRAINT "global_settings_app_links_qr_code_image_id_media_id_fk" FOREIGN KEY ("app_links_qr_code_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "blog_posts_article_studio_research_sources_order_idx" ON "blog_posts_article_studio_research_sources" USING btree ("_order");
  CREATE INDEX "blog_posts_article_studio_research_sources_parent_id_idx" ON "blog_posts_article_studio_research_sources" USING btree ("_parent_id");
  CREATE INDEX "blog_posts_tags_order_idx" ON "blog_posts_tags" USING btree ("_order");
  CREATE INDEX "blog_posts_tags_parent_id_idx" ON "blog_posts_tags" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "blog_posts_slug_idx" ON "blog_posts" USING btree ("slug");
  CREATE INDEX "blog_posts_featured_image_idx" ON "blog_posts" USING btree ("featured_image_id");
  CREATE INDEX "blog_posts_view_count_idx" ON "blog_posts" USING btree ("view_count");
  CREATE INDEX "blog_posts_author_idx" ON "blog_posts" USING btree ("author_id");
  CREATE INDEX "blog_posts_publish_to_kim_lafayette_idx" ON "blog_posts" USING btree ("publish_to_kim_lafayette");
  CREATE INDEX "blog_posts_visibility_idx" ON "blog_posts" USING btree ("visibility");
  CREATE INDEX "blog_posts_hero_video_idx" ON "blog_posts" USING btree ("hero_video_id");
  CREATE INDEX "blog_posts_hero_audio_idx" ON "blog_posts" USING btree ("hero_audio_id");
  CREATE INDEX "blog_posts_article_studio_article_studio_generated_by_st_idx" ON "blog_posts" USING btree ("article_studio_generated_by_studio");
  CREATE INDEX "blog_posts_seo_seo_meta_image_idx" ON "blog_posts" USING btree ("seo_meta_image_id");
  CREATE INDEX "blog_posts_updated_at_idx" ON "blog_posts" USING btree ("updated_at");
  CREATE INDEX "blog_posts_created_at_idx" ON "blog_posts" USING btree ("created_at");
  CREATE INDEX "blog_posts_rels_order_idx" ON "blog_posts_rels" USING btree ("order");
  CREATE INDEX "blog_posts_rels_parent_idx" ON "blog_posts_rels" USING btree ("parent_id");
  CREATE INDEX "blog_posts_rels_path_idx" ON "blog_posts_rels" USING btree ("path");
  CREATE INDEX "blog_posts_rels_media_id_idx" ON "blog_posts_rels" USING btree ("media_id");
  CREATE INDEX "blog_categories_site_idx" ON "blog_categories" USING btree ("site");
  CREATE INDEX "blog_categories_updated_at_idx" ON "blog_categories" USING btree ("updated_at");
  CREATE INDEX "blog_categories_created_at_idx" ON "blog_categories" USING btree ("created_at");
  CREATE INDEX "orders_items_order_idx" ON "orders_items" USING btree ("_order");
  CREATE INDEX "orders_items_parent_id_idx" ON "orders_items" USING btree ("_parent_id");
  CREATE INDEX "orders_items_product_idx" ON "orders_items" USING btree ("product_id");
  CREATE INDEX "orders_items_bundle_ref_idx" ON "orders_items" USING btree ("bundle_ref_id");
  CREATE INDEX "orders_items_gift_rule_ref_idx" ON "orders_items" USING btree ("gift_rule_ref_id");
  CREATE INDEX "orders_items_add_on_rule_ref_idx" ON "orders_items" USING btree ("add_on_rule_ref_id");
  CREATE INDEX "orders_gifts_order_idx" ON "orders_gifts" USING btree ("_order");
  CREATE INDEX "orders_gifts_parent_id_idx" ON "orders_gifts" USING btree ("_parent_id");
  CREATE INDEX "orders_gifts_reward_idx" ON "orders_gifts" USING btree ("reward_id");
  CREATE UNIQUE INDEX "orders_order_number_idx" ON "orders" USING btree ("order_number");
  CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("customer_id");
  CREATE INDEX "orders_coupon_idx" ON "orders" USING btree ("coupon_id");
  CREATE INDEX "orders_shipping_method_shipping_method_method_idx" ON "orders" USING btree ("shipping_method_method_id");
  CREATE INDEX "orders_affiliate_info_affiliate_info_affiliate_user_idx" ON "orders" USING btree ("affiliate_info_affiliate_user_id");
  CREATE INDEX "orders_updated_at_idx" ON "orders" USING btree ("updated_at");
  CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");
  CREATE INDEX "invoices_invoice_items_order_idx" ON "invoices_invoice_items" USING btree ("_order");
  CREATE INDEX "invoices_invoice_items_parent_id_idx" ON "invoices_invoice_items" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "invoices_invoice_number_idx" ON "invoices" USING btree ("invoice_number");
  CREATE INDEX "invoices_order_idx" ON "invoices" USING btree ("order_id");
  CREATE INDEX "invoices_customer_idx" ON "invoices" USING btree ("customer_id");
  CREATE INDEX "invoices_void_info_void_info_void_operator_idx" ON "invoices" USING btree ("void_info_void_operator_id");
  CREATE INDEX "invoices_updated_at_idx" ON "invoices" USING btree ("updated_at");
  CREATE INDEX "invoices_created_at_idx" ON "invoices" USING btree ("created_at");
  CREATE INDEX "returns_items_order_idx" ON "returns_items" USING btree ("_order");
  CREATE INDEX "returns_items_parent_id_idx" ON "returns_items" USING btree ("_parent_id");
  CREATE INDEX "returns_items_product_idx" ON "returns_items" USING btree ("product_id");
  CREATE INDEX "returns_photos_order_idx" ON "returns_photos" USING btree ("_order");
  CREATE INDEX "returns_photos_parent_id_idx" ON "returns_photos" USING btree ("_parent_id");
  CREATE INDEX "returns_photos_image_idx" ON "returns_photos" USING btree ("image_id");
  CREATE UNIQUE INDEX "returns_return_number_idx" ON "returns" USING btree ("return_number");
  CREATE INDEX "returns_order_idx" ON "returns" USING btree ("order_id");
  CREATE INDEX "returns_customer_idx" ON "returns" USING btree ("customer_id");
  CREATE INDEX "returns_updated_at_idx" ON "returns" USING btree ("updated_at");
  CREATE INDEX "returns_created_at_idx" ON "returns" USING btree ("created_at");
  CREATE INDEX "exchanges_items_order_idx" ON "exchanges_items" USING btree ("_order");
  CREATE INDEX "exchanges_items_parent_id_idx" ON "exchanges_items" USING btree ("_parent_id");
  CREATE INDEX "exchanges_items_product_idx" ON "exchanges_items" USING btree ("product_id");
  CREATE UNIQUE INDEX "exchanges_exchange_number_idx" ON "exchanges" USING btree ("exchange_number");
  CREATE INDEX "exchanges_order_idx" ON "exchanges" USING btree ("order_id");
  CREATE INDEX "exchanges_customer_idx" ON "exchanges" USING btree ("customer_id");
  CREATE INDEX "exchanges_updated_at_idx" ON "exchanges" USING btree ("updated_at");
  CREATE INDEX "exchanges_created_at_idx" ON "exchanges" USING btree ("created_at");
  CREATE INDEX "refunds_items_order_idx" ON "refunds_items" USING btree ("_order");
  CREATE INDEX "refunds_items_parent_id_idx" ON "refunds_items" USING btree ("_parent_id");
  CREATE INDEX "refunds_items_product_idx" ON "refunds_items" USING btree ("product_id");
  CREATE UNIQUE INDEX "refunds_refund_number_idx" ON "refunds" USING btree ("refund_number");
  CREATE INDEX "refunds_order_idx" ON "refunds" USING btree ("order_id");
  CREATE INDEX "refunds_customer_idx" ON "refunds" USING btree ("customer_id");
  CREATE INDEX "refunds_return_request_idx" ON "refunds" USING btree ("return_request_id");
  CREATE INDEX "refunds_updated_at_idx" ON "refunds" USING btree ("updated_at");
  CREATE INDEX "refunds_created_at_idx" ON "refunds" USING btree ("created_at");
  CREATE INDEX "shipping_methods_regions_order_idx" ON "shipping_methods_regions" USING btree ("order");
  CREATE INDEX "shipping_methods_regions_parent_idx" ON "shipping_methods_regions" USING btree ("parent_id");
  CREATE INDEX "shipping_methods_tracking_flow_order_idx" ON "shipping_methods_tracking_flow" USING btree ("_order");
  CREATE INDEX "shipping_methods_tracking_flow_parent_id_idx" ON "shipping_methods_tracking_flow" USING btree ("_parent_id");
  CREATE INDEX "shipping_methods_updated_at_idx" ON "shipping_methods" USING btree ("updated_at");
  CREATE INDEX "shipping_methods_created_at_idx" ON "shipping_methods" USING btree ("created_at");
  CREATE INDEX "products_alias_slugs_order_idx" ON "products_alias_slugs" USING btree ("_order");
  CREATE INDEX "products_alias_slugs_parent_id_idx" ON "products_alias_slugs" USING btree ("_parent_id");
  CREATE INDEX "products_tags_order_idx" ON "products_tags" USING btree ("_order");
  CREATE INDEX "products_tags_parent_id_idx" ON "products_tags" USING btree ("_parent_id");
  CREATE INDEX "products_collection_tags_order_idx" ON "products_collection_tags" USING btree ("order");
  CREATE INDEX "products_collection_tags_parent_idx" ON "products_collection_tags" USING btree ("parent_id");
  CREATE INDEX "products_images_order_idx" ON "products_images" USING btree ("_order");
  CREATE INDEX "products_images_parent_id_idx" ON "products_images" USING btree ("_parent_id");
  CREATE INDEX "products_images_image_idx" ON "products_images" USING btree ("image_id");
  CREATE INDEX "products_variants_order_idx" ON "products_variants" USING btree ("_order");
  CREATE INDEX "products_variants_parent_id_idx" ON "products_variants" USING btree ("_parent_id");
  CREATE INDEX "products_variants_color_swatch_idx" ON "products_variants" USING btree ("color_swatch_id");
  CREATE INDEX "products_material_images_order_idx" ON "products_material_images" USING btree ("_order");
  CREATE INDEX "products_material_images_parent_id_idx" ON "products_material_images" USING btree ("_parent_id");
  CREATE INDEX "products_material_images_image_idx" ON "products_material_images" USING btree ("image_id");
  CREATE INDEX "products_personality_types_order_idx" ON "products_personality_types" USING btree ("order");
  CREATE INDEX "products_personality_types_parent_idx" ON "products_personality_types" USING btree ("parent_id");
  CREATE UNIQUE INDEX "products_slug_idx" ON "products" USING btree ("slug");
  CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");
  CREATE INDEX "products_featured_image_idx" ON "products" USING btree ("featured_image_id");
  CREATE INDEX "products_intro_video_idx" ON "products" USING btree ("intro_video_id");
  CREATE INDEX "products_size_chart_idx" ON "products" USING btree ("size_chart_id");
  CREATE INDEX "products_seo_seo_meta_image_idx" ON "products" USING btree ("seo_meta_image_id");
  CREATE INDEX "products_updated_at_idx" ON "products" USING btree ("updated_at");
  CREATE INDEX "products_created_at_idx" ON "products" USING btree ("created_at");
  CREATE INDEX "products_rels_order_idx" ON "products_rels" USING btree ("order");
  CREATE INDEX "products_rels_parent_idx" ON "products_rels" USING btree ("parent_id");
  CREATE INDEX "products_rels_path_idx" ON "products_rels" USING btree ("path");
  CREATE INDEX "products_rels_categories_id_idx" ON "products_rels" USING btree ("categories_id");
  CREATE UNIQUE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");
  CREATE INDEX "categories_parent_idx" ON "categories" USING btree ("parent_id");
  CREATE INDEX "categories_image_idx" ON "categories" USING btree ("image_id");
  CREATE INDEX "categories_updated_at_idx" ON "categories" USING btree ("updated_at");
  CREATE INDEX "categories_created_at_idx" ON "categories" USING btree ("created_at");
  CREATE INDEX "size_charts_measurements_order_idx" ON "size_charts_measurements" USING btree ("_order");
  CREATE INDEX "size_charts_measurements_parent_id_idx" ON "size_charts_measurements" USING btree ("_parent_id");
  CREATE INDEX "size_charts_rows_values_order_idx" ON "size_charts_rows_values" USING btree ("_order");
  CREATE INDEX "size_charts_rows_values_parent_id_idx" ON "size_charts_rows_values" USING btree ("_parent_id");
  CREATE INDEX "size_charts_rows_order_idx" ON "size_charts_rows" USING btree ("_order");
  CREATE INDEX "size_charts_rows_parent_id_idx" ON "size_charts_rows" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "size_charts_slug_idx" ON "size_charts" USING btree ("slug");
  CREATE INDEX "size_charts_updated_at_idx" ON "size_charts" USING btree ("updated_at");
  CREATE INDEX "size_charts_created_at_idx" ON "size_charts" USING btree ("created_at");
  CREATE INDEX "product_reviews_photos_order_idx" ON "product_reviews_photos" USING btree ("_order");
  CREATE INDEX "product_reviews_photos_parent_id_idx" ON "product_reviews_photos" USING btree ("_parent_id");
  CREATE INDEX "product_reviews_photos_image_idx" ON "product_reviews_photos" USING btree ("image_id");
  CREATE INDEX "product_reviews_product_idx" ON "product_reviews" USING btree ("product_id");
  CREATE INDEX "product_reviews_reviewer_idx" ON "product_reviews" USING btree ("reviewer_id");
  CREATE INDEX "product_reviews_updated_at_idx" ON "product_reviews" USING btree ("updated_at");
  CREATE INDEX "product_reviews_created_at_idx" ON "product_reviews" USING btree ("created_at");
  CREATE INDEX "inventory_transactions_product_idx" ON "inventory_transactions" USING btree ("product_id");
  CREATE INDEX "inventory_transactions_type_idx" ON "inventory_transactions" USING btree ("type");
  CREATE INDEX "inventory_transactions_related_order_idx" ON "inventory_transactions" USING btree ("related_order_id");
  CREATE INDEX "inventory_transactions_related_purchase_order_idx" ON "inventory_transactions" USING btree ("related_purchase_order_id");
  CREATE INDEX "inventory_transactions_related_stock_take_idx" ON "inventory_transactions" USING btree ("related_stock_take_id");
  CREATE INDEX "inventory_transactions_updated_at_idx" ON "inventory_transactions" USING btree ("updated_at");
  CREATE INDEX "inventory_transactions_created_at_idx" ON "inventory_transactions" USING btree ("created_at");
  CREATE INDEX "purchase_orders_items_order_idx" ON "purchase_orders_items" USING btree ("_order");
  CREATE INDEX "purchase_orders_items_parent_id_idx" ON "purchase_orders_items" USING btree ("_parent_id");
  CREATE INDEX "purchase_orders_items_product_idx" ON "purchase_orders_items" USING btree ("product_id");
  CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders" USING btree ("status");
  CREATE INDEX "purchase_orders_updated_at_idx" ON "purchase_orders" USING btree ("updated_at");
  CREATE INDEX "purchase_orders_created_at_idx" ON "purchase_orders" USING btree ("created_at");
  CREATE INDEX "stock_takes_items_order_idx" ON "stock_takes_items" USING btree ("_order");
  CREATE INDEX "stock_takes_items_parent_id_idx" ON "stock_takes_items" USING btree ("_parent_id");
  CREATE INDEX "stock_takes_items_product_idx" ON "stock_takes_items" USING btree ("product_id");
  CREATE INDEX "stock_takes_status_idx" ON "stock_takes" USING btree ("status");
  CREATE INDEX "stock_takes_updated_at_idx" ON "stock_takes" USING btree ("updated_at");
  CREATE INDEX "stock_takes_created_at_idx" ON "stock_takes" USING btree ("created_at");
  CREATE INDEX "users_invoice_profiles_order_idx" ON "users_invoice_profiles" USING btree ("_order");
  CREATE INDEX "users_invoice_profiles_parent_id_idx" ON "users_invoice_profiles" USING btree ("_parent_id");
  CREATE INDEX "users_tags_order_idx" ON "users_tags" USING btree ("_order");
  CREATE INDEX "users_tags_parent_id_idx" ON "users_tags" USING btree ("_parent_id");
  CREATE INDEX "users_addresses_order_idx" ON "users_addresses" USING btree ("_order");
  CREATE INDEX "users_addresses_parent_id_idx" ON "users_addresses" USING btree ("_parent_id");
  CREATE INDEX "users_game_activity_recent_games_order_idx" ON "users_game_activity_recent_games" USING btree ("_order");
  CREATE INDEX "users_game_activity_recent_games_parent_id_idx" ON "users_game_activity_recent_games" USING btree ("_parent_id");
  CREATE INDEX "users_ai_dm_preferences_dm_history_order_idx" ON "users_ai_dm_preferences_dm_history" USING btree ("_order");
  CREATE INDEX "users_ai_dm_preferences_dm_history_parent_id_idx" ON "users_ai_dm_preferences_dm_history" USING btree ("_parent_id");
  CREATE INDEX "users_notification_preferences_channels_order_idx" ON "users_notification_preferences_channels" USING btree ("order");
  CREATE INDEX "users_notification_preferences_channels_parent_idx" ON "users_notification_preferences_channels" USING btree ("parent_id");
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_avatar_idx" ON "users" USING btree ("avatar_id");
  CREATE INDEX "users_shopline_customer_id_idx" ON "users" USING btree ("shopline_customer_id");
  CREATE INDEX "users_member_tier_idx" ON "users" USING btree ("member_tier_id");
  CREATE INDEX "users_membership_membership_active_plan_idx" ON "users" USING btree ("membership_active_plan_id");
  CREATE INDEX "users_membership_membership_active_subscription_idx" ON "users" USING btree ("membership_active_subscription_id");
  CREATE UNIQUE INDEX "users_referral_code_idx" ON "users" USING btree ("referral_code");
  CREATE INDEX "users_referred_by_idx" ON "users" USING btree ("referred_by_id");
  CREATE INDEX "users_vip_owner_idx" ON "users" USING btree ("vip_owner_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE INDEX "users_deleted_at_idx" ON "users" USING btree ("deleted_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "users_rels_order_idx" ON "users_rels" USING btree ("order");
  CREATE INDEX "users_rels_parent_idx" ON "users_rels" USING btree ("parent_id");
  CREATE INDEX "users_rels_path_idx" ON "users_rels" USING btree ("path");
  CREATE INDEX "users_rels_products_id_idx" ON "users_rels" USING btree ("products_id");
  CREATE UNIQUE INDEX "membership_tiers_slug_idx" ON "membership_tiers" USING btree ("slug");
  CREATE INDEX "membership_tiers_icon_idx" ON "membership_tiers" USING btree ("icon_id");
  CREATE INDEX "membership_tiers_updated_at_idx" ON "membership_tiers" USING btree ("updated_at");
  CREATE INDEX "membership_tiers_created_at_idx" ON "membership_tiers" USING btree ("created_at");
  CREATE INDEX "member_segments_history_order_idx" ON "member_segments_history" USING btree ("_order");
  CREATE INDEX "member_segments_history_parent_id_idx" ON "member_segments_history" USING btree ("_parent_id");
  CREATE INDEX "member_segments_auto_tags_order_idx" ON "member_segments_auto_tags" USING btree ("_order");
  CREATE INDEX "member_segments_auto_tags_parent_id_idx" ON "member_segments_auto_tags" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "member_segments_user_idx" ON "member_segments" USING btree ("user_id");
  CREATE INDEX "member_segments_updated_at_idx" ON "member_segments" USING btree ("updated_at");
  CREATE INDEX "member_segments_created_at_idx" ON "member_segments" USING btree ("created_at");
  CREATE INDEX "subscription_plans_dopamine_streak_milestones_order_idx" ON "subscription_plans_dopamine_streak_milestones" USING btree ("_order");
  CREATE INDEX "subscription_plans_dopamine_streak_milestones_parent_id_idx" ON "subscription_plans_dopamine_streak_milestones" USING btree ("_parent_id");
  CREATE INDEX "subscription_plans_feature_list_order_idx" ON "subscription_plans_feature_list" USING btree ("_order");
  CREATE INDEX "subscription_plans_feature_list_parent_id_idx" ON "subscription_plans_feature_list" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "subscription_plans_slug_idx" ON "subscription_plans" USING btree ("slug");
  CREATE INDEX "subscription_plans_updated_at_idx" ON "subscription_plans" USING btree ("updated_at");
  CREATE INDEX "subscription_plans_created_at_idx" ON "subscription_plans" USING btree ("created_at");
  CREATE INDEX "user_subscriptions_auth_log_order_idx" ON "user_subscriptions_auth_log" USING btree ("_order");
  CREATE INDEX "user_subscriptions_auth_log_parent_id_idx" ON "user_subscriptions_auth_log" USING btree ("_parent_id");
  CREATE INDEX "user_subscriptions_user_idx" ON "user_subscriptions" USING btree ("user_id");
  CREATE INDEX "user_subscriptions_plan_idx" ON "user_subscriptions" USING btree ("plan_id");
  CREATE INDEX "user_subscriptions_status_idx" ON "user_subscriptions" USING btree ("status");
  CREATE INDEX "user_subscriptions_ecpay_ecpay_merchant_trade_no_idx" ON "user_subscriptions" USING btree ("ecpay_merchant_trade_no");
  CREATE INDEX "user_subscriptions_updated_at_idx" ON "user_subscriptions" USING btree ("updated_at");
  CREATE INDEX "user_subscriptions_created_at_idx" ON "user_subscriptions" USING btree ("created_at");
  CREATE INDEX "points_transactions_user_idx" ON "points_transactions" USING btree ("user_id");
  CREATE INDEX "points_transactions_related_order_idx" ON "points_transactions" USING btree ("related_order_id");
  CREATE INDEX "points_transactions_updated_at_idx" ON "points_transactions" USING btree ("updated_at");
  CREATE INDEX "points_transactions_created_at_idx" ON "points_transactions" USING btree ("created_at");
  CREATE INDEX "points_redemptions_lottery_config_prizes_order_idx" ON "points_redemptions_lottery_config_prizes" USING btree ("_order");
  CREATE INDEX "points_redemptions_lottery_config_prizes_parent_id_idx" ON "points_redemptions_lottery_config_prizes" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "points_redemptions_slug_idx" ON "points_redemptions" USING btree ("slug");
  CREATE INDEX "points_redemptions_image_idx" ON "points_redemptions" USING btree ("image_id");
  CREATE INDEX "points_redemptions_physical_config_physical_config_linke_idx" ON "points_redemptions" USING btree ("physical_config_linked_product_id");
  CREATE INDEX "points_redemptions_updated_at_idx" ON "points_redemptions" USING btree ("updated_at");
  CREATE INDEX "points_redemptions_created_at_idx" ON "points_redemptions" USING btree ("created_at");
  CREATE INDEX "user_rewards_user_idx" ON "user_rewards" USING btree ("user_id");
  CREATE INDEX "user_rewards_source_record_idx" ON "user_rewards" USING btree ("source_record_id");
  CREATE INDEX "user_rewards_redemption_ref_idx" ON "user_rewards" USING btree ("redemption_ref_id");
  CREATE UNIQUE INDEX "user_rewards_coupon_code_idx" ON "user_rewards" USING btree ("coupon_code");
  CREATE INDEX "user_rewards_attached_to_order_idx" ON "user_rewards" USING btree ("attached_to_order_id");
  CREATE INDEX "user_rewards_updated_at_idx" ON "user_rewards" USING btree ("updated_at");
  CREATE INDEX "user_rewards_created_at_idx" ON "user_rewards" USING btree ("created_at");
  CREATE INDEX "credit_score_history_user_idx" ON "credit_score_history" USING btree ("user_id");
  CREATE INDEX "credit_score_history_related_order_idx" ON "credit_score_history" USING btree ("related_order_id");
  CREATE INDEX "credit_score_history_related_return_idx" ON "credit_score_history" USING btree ("related_return_id");
  CREATE INDEX "credit_score_history_updated_at_idx" ON "credit_score_history" USING btree ("updated_at");
  CREATE INDEX "credit_score_history_created_at_idx" ON "credit_score_history" USING btree ("created_at");
  CREATE INDEX "wallet_transactions_user_idx" ON "wallet_transactions" USING btree ("user_id");
  CREATE INDEX "wallet_transactions_related_order_idx" ON "wallet_transactions" USING btree ("related_order_id");
  CREATE INDEX "wallet_transactions_related_withdrawal_idx" ON "wallet_transactions" USING btree ("related_withdrawal_id");
  CREATE INDEX "wallet_transactions_updated_at_idx" ON "wallet_transactions" USING btree ("updated_at");
  CREATE INDEX "wallet_transactions_created_at_idx" ON "wallet_transactions" USING btree ("created_at");
  CREATE INDEX "wallet_withdrawals_user_idx" ON "wallet_withdrawals" USING btree ("user_id");
  CREATE INDEX "wallet_withdrawals_status_idx" ON "wallet_withdrawals" USING btree ("status");
  CREATE INDEX "wallet_withdrawals_updated_at_idx" ON "wallet_withdrawals" USING btree ("updated_at");
  CREATE INDEX "wallet_withdrawals_created_at_idx" ON "wallet_withdrawals" USING btree ("created_at");
  CREATE INDEX "wishlist_items_user_idx" ON "wishlist_items" USING btree ("user_id");
  CREATE INDEX "wishlist_items_product_idx" ON "wishlist_items" USING btree ("product_id");
  CREATE INDEX "wishlist_items_updated_at_idx" ON "wishlist_items" USING btree ("updated_at");
  CREATE INDEX "wishlist_items_created_at_idx" ON "wishlist_items" USING btree ("created_at");
  CREATE UNIQUE INDEX "user_product_idx" ON "wishlist_items" USING btree ("user_id","product_id");
  CREATE UNIQUE INDEX "conversations_ticket_number_idx" ON "conversations" USING btree ("ticket_number");
  CREATE INDEX "conversations_external_thread_id_idx" ON "conversations" USING btree ("external_thread_id");
  CREATE INDEX "conversations_channel_idx" ON "conversations" USING btree ("channel");
  CREATE INDEX "conversations_customer_idx" ON "conversations" USING btree ("customer_id");
  CREATE INDEX "conversations_anon_id_idx" ON "conversations" USING btree ("anon_id");
  CREATE INDEX "conversations_status_idx" ON "conversations" USING btree ("status");
  CREATE INDEX "conversations_priority_idx" ON "conversations" USING btree ("priority");
  CREATE INDEX "conversations_unread_idx" ON "conversations" USING btree ("unread");
  CREATE INDEX "conversations_assignee_idx" ON "conversations" USING btree ("assignee_id");
  CREATE INDEX "conversations_merged_into_idx" ON "conversations" USING btree ("merged_into_id");
  CREATE INDEX "conversations_last_message_at_idx" ON "conversations" USING btree ("last_message_at");
  CREATE INDEX "conversations_sla_breached_idx" ON "conversations" USING btree ("sla_breached");
  CREATE INDEX "conversations_updated_at_idx" ON "conversations" USING btree ("updated_at");
  CREATE INDEX "conversations_created_at_idx" ON "conversations" USING btree ("created_at");
  CREATE INDEX "conversations_rels_order_idx" ON "conversations_rels" USING btree ("order");
  CREATE INDEX "conversations_rels_parent_idx" ON "conversations_rels" USING btree ("parent_id");
  CREATE INDEX "conversations_rels_path_idx" ON "conversations_rels" USING btree ("path");
  CREATE INDEX "conversations_rels_message_tags_id_idx" ON "conversations_rels" USING btree ("message_tags_id");
  CREATE INDEX "conversations_rels_orders_id_idx" ON "conversations_rels" USING btree ("orders_id");
  CREATE INDEX "conversations_rels_products_id_idx" ON "conversations_rels" USING btree ("products_id");
  CREATE INDEX "conversations_rels_returns_id_idx" ON "conversations_rels" USING btree ("returns_id");
  CREATE INDEX "messages_attachments_order_idx" ON "messages_attachments" USING btree ("_order");
  CREATE INDEX "messages_attachments_parent_id_idx" ON "messages_attachments" USING btree ("_parent_id");
  CREATE INDEX "messages_attachments_media_idx" ON "messages_attachments" USING btree ("media_id");
  CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("conversation_id");
  CREATE INDEX "messages_direction_idx" ON "messages" USING btree ("direction");
  CREATE INDEX "messages_staff_user_idx" ON "messages" USING btree ("staff_user_id");
  CREATE INDEX "messages_internal_idx" ON "messages" USING btree ("internal");
  CREATE INDEX "messages_external_id_idx" ON "messages" USING btree ("external_id");
  CREATE INDEX "messages_quoted_message_idx" ON "messages" USING btree ("quoted_message_id");
  CREATE INDEX "messages_updated_at_idx" ON "messages" USING btree ("updated_at");
  CREATE INDEX "messages_created_at_idx" ON "messages" USING btree ("created_at");
  CREATE UNIQUE INDEX "message_tags_name_idx" ON "message_tags" USING btree ("name");
  CREATE UNIQUE INDEX "message_tags_slug_idx" ON "message_tags" USING btree ("slug");
  CREATE INDEX "message_tags_parent_idx" ON "message_tags" USING btree ("parent_id");
  CREATE INDEX "message_tags_updated_at_idx" ON "message_tags" USING btree ("updated_at");
  CREATE INDEX "message_tags_created_at_idx" ON "message_tags" USING btree ("created_at");
  CREATE INDEX "conversation_activities_conversation_idx" ON "conversation_activities" USING btree ("conversation_id");
  CREATE INDEX "conversation_activities_actor_idx" ON "conversation_activities" USING btree ("actor_id");
  CREATE INDEX "conversation_activities_type_idx" ON "conversation_activities" USING btree ("type");
  CREATE INDEX "conversation_activities_updated_at_idx" ON "conversation_activities" USING btree ("updated_at");
  CREATE INDEX "conversation_activities_created_at_idx" ON "conversation_activities" USING btree ("created_at");
  CREATE INDEX "product_view_events_product_idx" ON "product_view_events" USING btree ("product_id");
  CREATE INDEX "product_view_events_session_id_idx" ON "product_view_events" USING btree ("session_id");
  CREATE INDEX "product_view_events_user_idx" ON "product_view_events" USING btree ("user_id");
  CREATE INDEX "product_view_events_utm_source_idx" ON "product_view_events" USING btree ("utm_source");
  CREATE INDEX "product_view_events_utm_campaign_idx" ON "product_view_events" USING btree ("utm_campaign");
  CREATE INDEX "product_view_events_updated_at_idx" ON "product_view_events" USING btree ("updated_at");
  CREATE INDEX "product_view_events_created_at_idx" ON "product_view_events" USING btree ("created_at");
  CREATE INDEX "behavior_events_event_type_idx" ON "behavior_events" USING btree ("event_type");
  CREATE INDEX "behavior_events_session_id_idx" ON "behavior_events" USING btree ("session_id");
  CREATE INDEX "behavior_events_user_idx" ON "behavior_events" USING btree ("user_id");
  CREATE INDEX "behavior_events_page_path_idx" ON "behavior_events" USING btree ("page_path");
  CREATE INDEX "behavior_events_product_idx" ON "behavior_events" USING btree ("product_id");
  CREATE INDEX "behavior_events_utm_source_idx" ON "behavior_events" USING btree ("utm_source");
  CREATE INDEX "behavior_events_utm_campaign_idx" ON "behavior_events" USING btree ("utm_campaign");
  CREATE INDEX "behavior_events_device_type_idx" ON "behavior_events" USING btree ("device_type");
  CREATE INDEX "behavior_events_campaign_idx" ON "behavior_events" USING btree ("campaign_id");
  CREATE INDEX "behavior_events_rule_key_idx" ON "behavior_events" USING btree ("rule_key");
  CREATE INDEX "behavior_events_updated_at_idx" ON "behavior_events" USING btree ("updated_at");
  CREATE INDEX "behavior_events_created_at_idx" ON "behavior_events" USING btree ("created_at");
  CREATE UNIQUE INDEX "coupons_code_idx" ON "coupons" USING btree ("code");
  CREATE INDEX "coupons_conditions_conditions_tier_required_idx" ON "coupons" USING btree ("conditions_tier_required_id");
  CREATE INDEX "coupons_updated_at_idx" ON "coupons" USING btree ("updated_at");
  CREATE INDEX "coupons_created_at_idx" ON "coupons" USING btree ("created_at");
  CREATE INDEX "coupons_rels_order_idx" ON "coupons_rels" USING btree ("order");
  CREATE INDEX "coupons_rels_parent_idx" ON "coupons_rels" USING btree ("parent_id");
  CREATE INDEX "coupons_rels_path_idx" ON "coupons_rels" USING btree ("path");
  CREATE INDEX "coupons_rels_products_id_idx" ON "coupons_rels" USING btree ("products_id");
  CREATE INDEX "coupon_redemptions_coupon_idx" ON "coupon_redemptions" USING btree ("coupon_id");
  CREATE INDEX "coupon_redemptions_user_idx" ON "coupon_redemptions" USING btree ("user_id");
  CREATE INDEX "coupon_redemptions_order_idx" ON "coupon_redemptions" USING btree ("order_id");
  CREATE INDEX "coupon_redemptions_updated_at_idx" ON "coupon_redemptions" USING btree ("updated_at");
  CREATE INDEX "coupon_redemptions_created_at_idx" ON "coupon_redemptions" USING btree ("created_at");
  CREATE INDEX "add_on_products_product_idx" ON "add_on_products" USING btree ("product_id");
  CREATE INDEX "add_on_products_updated_at_idx" ON "add_on_products" USING btree ("updated_at");
  CREATE INDEX "add_on_products_created_at_idx" ON "add_on_products" USING btree ("created_at");
  CREATE INDEX "add_on_products_rels_order_idx" ON "add_on_products_rels" USING btree ("order");
  CREATE INDEX "add_on_products_rels_parent_idx" ON "add_on_products_rels" USING btree ("parent_id");
  CREATE INDEX "add_on_products_rels_path_idx" ON "add_on_products_rels" USING btree ("path");
  CREATE INDEX "add_on_products_rels_products_id_idx" ON "add_on_products_rels" USING btree ("products_id");
  CREATE INDEX "gift_rules_gift_product_idx" ON "gift_rules" USING btree ("gift_product_id");
  CREATE INDEX "gift_rules_updated_at_idx" ON "gift_rules" USING btree ("updated_at");
  CREATE INDEX "gift_rules_created_at_idx" ON "gift_rules" USING btree ("created_at");
  CREATE INDEX "gift_rules_rels_order_idx" ON "gift_rules_rels" USING btree ("order");
  CREATE INDEX "gift_rules_rels_parent_idx" ON "gift_rules_rels" USING btree ("parent_id");
  CREATE INDEX "gift_rules_rels_path_idx" ON "gift_rules_rels" USING btree ("path");
  CREATE INDEX "gift_rules_rels_products_id_idx" ON "gift_rules_rels" USING btree ("products_id");
  CREATE INDEX "bundles_items_order_idx" ON "bundles_items" USING btree ("_order");
  CREATE INDEX "bundles_items_parent_id_idx" ON "bundles_items" USING btree ("_parent_id");
  CREATE INDEX "bundles_items_product_idx" ON "bundles_items" USING btree ("product_id");
  CREATE UNIQUE INDEX "bundles_slug_idx" ON "bundles" USING btree ("slug");
  CREATE INDEX "bundles_image_idx" ON "bundles" USING btree ("image_id");
  CREATE INDEX "bundles_updated_at_idx" ON "bundles" USING btree ("updated_at");
  CREATE INDEX "bundles_created_at_idx" ON "bundles" USING btree ("created_at");
  CREATE INDEX "marketing_campaigns_target_segments_order_idx" ON "marketing_campaigns_target_segments" USING btree ("order");
  CREATE INDEX "marketing_campaigns_target_segments_parent_idx" ON "marketing_campaigns_target_segments" USING btree ("parent_id");
  CREATE INDEX "marketing_campaigns_tier_filter_order_idx" ON "marketing_campaigns_tier_filter" USING btree ("order");
  CREATE INDEX "marketing_campaigns_tier_filter_parent_idx" ON "marketing_campaigns_tier_filter" USING btree ("parent_id");
  CREATE INDEX "marketing_campaigns_channels_order_idx" ON "marketing_campaigns_channels" USING btree ("order");
  CREATE INDEX "marketing_campaigns_channels_parent_idx" ON "marketing_campaigns_channels" USING btree ("parent_id");
  CREATE INDEX "marketing_campaigns_message_templates_order_idx" ON "marketing_campaigns_message_templates" USING btree ("_order");
  CREATE INDEX "marketing_campaigns_message_templates_parent_id_idx" ON "marketing_campaigns_message_templates" USING btree ("_parent_id");
  CREATE INDEX "marketing_campaigns_message_templates_template_ref_idx" ON "marketing_campaigns_message_templates" USING btree ("template_ref_id");
  CREATE INDEX "marketing_campaigns_ab_test_config_split_ratio_order_idx" ON "marketing_campaigns_ab_test_config_split_ratio" USING btree ("_order");
  CREATE INDEX "marketing_campaigns_ab_test_config_split_ratio_parent_id_idx" ON "marketing_campaigns_ab_test_config_split_ratio" USING btree ("_parent_id");
  CREATE INDEX "marketing_campaigns_commerce_surfaces_order_idx" ON "marketing_campaigns_commerce_surfaces" USING btree ("order");
  CREATE INDEX "marketing_campaigns_commerce_surfaces_parent_idx" ON "marketing_campaigns_commerce_surfaces" USING btree ("parent_id");
  CREATE UNIQUE INDEX "marketing_campaigns_campaign_slug_idx" ON "marketing_campaigns" USING btree ("campaign_slug");
  CREATE INDEX "marketing_campaigns_journey_ref_idx" ON "marketing_campaigns" USING btree ("journey_ref_id");
  CREATE INDEX "marketing_campaigns_linked_festival_idx" ON "marketing_campaigns" USING btree ("linked_festival_id");
  CREATE INDEX "marketing_campaigns_commerce_approval_commerce_approval__idx" ON "marketing_campaigns" USING btree ("commerce_approval_approved_by_id");
  CREATE INDEX "marketing_campaigns_updated_at_idx" ON "marketing_campaigns" USING btree ("updated_at");
  CREATE INDEX "marketing_campaigns_created_at_idx" ON "marketing_campaigns" USING btree ("created_at");
  CREATE INDEX "promotion_rules_scope_include_tags_order_idx" ON "promotion_rules_scope_include_tags" USING btree ("_order");
  CREATE INDEX "promotion_rules_scope_include_tags_parent_id_idx" ON "promotion_rules_scope_include_tags" USING btree ("_parent_id");
  CREATE INDEX "promotion_rules_scope_exclude_tags_order_idx" ON "promotion_rules_scope_exclude_tags" USING btree ("_order");
  CREATE INDEX "promotion_rules_scope_exclude_tags_parent_id_idx" ON "promotion_rules_scope_exclude_tags" USING btree ("_parent_id");
  CREATE INDEX "promotion_rules_conditions_segments_not_in_order_idx" ON "promotion_rules_conditions_segments_not_in" USING btree ("order");
  CREATE INDEX "promotion_rules_conditions_segments_not_in_parent_idx" ON "promotion_rules_conditions_segments_not_in" USING btree ("parent_id");
  CREATE INDEX "promotion_rules_conditions_channels_order_idx" ON "promotion_rules_conditions_channels" USING btree ("order");
  CREATE INDEX "promotion_rules_conditions_channels_parent_idx" ON "promotion_rules_conditions_channels" USING btree ("parent_id");
  CREATE INDEX "promotion_rules_stacking_stackable_with_order_idx" ON "promotion_rules_stacking_stackable_with" USING btree ("order");
  CREATE INDEX "promotion_rules_stacking_stackable_with_parent_idx" ON "promotion_rules_stacking_stackable_with" USING btree ("parent_id");
  CREATE INDEX "promotion_rules_campaign_idx" ON "promotion_rules" USING btree ("campaign_id");
  CREATE INDEX "promotion_rules_status_idx" ON "promotion_rules" USING btree ("status");
  CREATE INDEX "promotion_rules_effect_effect_gift_product_idx" ON "promotion_rules" USING btree ("effect_gift_product_id");
  CREATE INDEX "promotion_rules_updated_at_idx" ON "promotion_rules" USING btree ("updated_at");
  CREATE INDEX "promotion_rules_created_at_idx" ON "promotion_rules" USING btree ("created_at");
  CREATE INDEX "promotion_rules_rels_order_idx" ON "promotion_rules_rels" USING btree ("order");
  CREATE INDEX "promotion_rules_rels_parent_idx" ON "promotion_rules_rels" USING btree ("parent_id");
  CREATE INDEX "promotion_rules_rels_path_idx" ON "promotion_rules_rels" USING btree ("path");
  CREATE INDEX "promotion_rules_rels_categories_id_idx" ON "promotion_rules_rels" USING btree ("categories_id");
  CREATE INDEX "promotion_rules_rels_products_id_idx" ON "promotion_rules_rels" USING btree ("products_id");
  CREATE INDEX "promotion_rules_rels_membership_tiers_id_idx" ON "promotion_rules_rels" USING btree ("membership_tiers_id");
  CREATE INDEX "promotion_applications_order_idx" ON "promotion_applications" USING btree ("order_id");
  CREATE INDEX "promotion_applications_user_idx" ON "promotion_applications" USING btree ("user_id");
  CREATE INDEX "promotion_applications_campaign_idx" ON "promotion_applications" USING btree ("campaign_id");
  CREATE INDEX "promotion_applications_rule_idx" ON "promotion_applications" USING btree ("rule_id");
  CREATE INDEX "promotion_applications_rule_key_idx" ON "promotion_applications" USING btree ("rule_key");
  CREATE INDEX "promotion_applications_status_idx" ON "promotion_applications" USING btree ("status");
  CREATE UNIQUE INDEX "promotion_applications_idempotency_key_idx" ON "promotion_applications" USING btree ("idempotency_key");
  CREATE INDEX "promotion_applications_updated_at_idx" ON "promotion_applications" USING btree ("updated_at");
  CREATE INDEX "promotion_applications_created_at_idx" ON "promotion_applications" USING btree ("created_at");
  CREATE INDEX "festival_templates_phases_channels_order_idx" ON "festival_templates_phases_channels" USING btree ("order");
  CREATE INDEX "festival_templates_phases_channels_parent_idx" ON "festival_templates_phases_channels" USING btree ("parent_id");
  CREATE INDEX "festival_templates_phases_order_idx" ON "festival_templates_phases" USING btree ("_order");
  CREATE INDEX "festival_templates_phases_parent_id_idx" ON "festival_templates_phases" USING btree ("_parent_id");
  CREATE INDEX "festival_templates_segment_offers_order_idx" ON "festival_templates_segment_offers" USING btree ("_order");
  CREATE INDEX "festival_templates_segment_offers_parent_id_idx" ON "festival_templates_segment_offers" USING btree ("_parent_id");
  CREATE INDEX "festival_templates_ab_test_variants_order_idx" ON "festival_templates_ab_test_variants" USING btree ("_order");
  CREATE INDEX "festival_templates_ab_test_variants_parent_id_idx" ON "festival_templates_ab_test_variants" USING btree ("_parent_id");
  CREATE INDEX "festival_templates_linked_journeys_order_idx" ON "festival_templates_linked_journeys" USING btree ("_order");
  CREATE INDEX "festival_templates_linked_journeys_parent_id_idx" ON "festival_templates_linked_journeys" USING btree ("_parent_id");
  CREATE INDEX "festival_templates_linked_journeys_journey_idx" ON "festival_templates_linked_journeys" USING btree ("journey_id");
  CREATE UNIQUE INDEX "festival_templates_festival_slug_idx" ON "festival_templates" USING btree ("festival_slug");
  CREATE INDEX "festival_templates_theme_theme_banner_image_idx" ON "festival_templates" USING btree ("theme_banner_image_id");
  CREATE INDEX "festival_templates_theme_theme_mobile_image_idx" ON "festival_templates" USING btree ("theme_mobile_image_id");
  CREATE INDEX "festival_templates_updated_at_idx" ON "festival_templates" USING btree ("updated_at");
  CREATE INDEX "festival_templates_created_at_idx" ON "festival_templates" USING btree ("created_at");
  CREATE INDEX "birthday_campaigns_phases_phase1_channels_order_idx" ON "birthday_campaigns_phases_phase1_channels" USING btree ("order");
  CREATE INDEX "birthday_campaigns_phases_phase1_channels_parent_idx" ON "birthday_campaigns_phases_phase1_channels" USING btree ("parent_id");
  CREATE INDEX "birthday_campaigns_phases_phase2_channels_order_idx" ON "birthday_campaigns_phases_phase2_channels" USING btree ("order");
  CREATE INDEX "birthday_campaigns_phases_phase2_channels_parent_idx" ON "birthday_campaigns_phases_phase2_channels" USING btree ("parent_id");
  CREATE INDEX "birthday_campaigns_phases_phase3_channels_order_idx" ON "birthday_campaigns_phases_phase3_channels" USING btree ("order");
  CREATE INDEX "birthday_campaigns_phases_phase3_channels_parent_idx" ON "birthday_campaigns_phases_phase3_channels" USING btree ("parent_id");
  CREATE INDEX "birthday_campaigns_phases_phase3_recommended_products_order_idx" ON "birthday_campaigns_phases_phase3_recommended_products" USING btree ("_order");
  CREATE INDEX "birthday_campaigns_phases_phase3_recommended_products_parent_id_idx" ON "birthday_campaigns_phases_phase3_recommended_products" USING btree ("_parent_id");
  CREATE INDEX "birthday_campaigns_phases_phase3_recommended_products_pr_idx" ON "birthday_campaigns_phases_phase3_recommended_products" USING btree ("product_id");
  CREATE INDEX "birthday_campaigns_phases_phase4_channels_order_idx" ON "birthday_campaigns_phases_phase4_channels" USING btree ("order");
  CREATE INDEX "birthday_campaigns_phases_phase4_channels_parent_idx" ON "birthday_campaigns_phases_phase4_channels" USING btree ("parent_id");
  CREATE INDEX "birthday_campaigns_phases_phase5_channels_order_idx" ON "birthday_campaigns_phases_phase5_channels" USING btree ("order");
  CREATE INDEX "birthday_campaigns_phases_phase5_channels_parent_idx" ON "birthday_campaigns_phases_phase5_channels" USING btree ("parent_id");
  CREATE INDEX "birthday_campaigns_target_user_idx" ON "birthday_campaigns" USING btree ("target_user_id");
  CREATE INDEX "birthday_campaigns_updated_at_idx" ON "birthday_campaigns" USING btree ("updated_at");
  CREATE INDEX "birthday_campaigns_created_at_idx" ON "birthday_campaigns" USING btree ("created_at");
  CREATE INDEX "automation_journeys_steps_order_idx" ON "automation_journeys_steps" USING btree ("_order");
  CREATE INDEX "automation_journeys_steps_parent_id_idx" ON "automation_journeys_steps" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "automation_journeys_slug_idx" ON "automation_journeys" USING btree ("slug");
  CREATE INDEX "automation_journeys_updated_at_idx" ON "automation_journeys" USING btree ("updated_at");
  CREATE INDEX "automation_journeys_created_at_idx" ON "automation_journeys" USING btree ("created_at");
  CREATE INDEX "automation_logs_journey_idx" ON "automation_logs" USING btree ("journey_id");
  CREATE INDEX "automation_logs_user_idx" ON "automation_logs" USING btree ("user_id");
  CREATE INDEX "automation_logs_resume_at_idx" ON "automation_logs" USING btree ("resume_at");
  CREATE INDEX "automation_logs_updated_at_idx" ON "automation_logs" USING btree ("updated_at");
  CREATE INDEX "automation_logs_created_at_idx" ON "automation_logs" USING btree ("created_at");
  CREATE INDEX "ab_tests_variants_order_idx" ON "ab_tests_variants" USING btree ("_order");
  CREATE INDEX "ab_tests_variants_parent_id_idx" ON "ab_tests_variants" USING btree ("_parent_id");
  CREATE INDEX "ab_tests_variants_message_template_idx" ON "ab_tests_variants" USING btree ("message_template_id");
  CREATE INDEX "ab_tests_campaign_idx" ON "ab_tests" USING btree ("campaign_id");
  CREATE INDEX "ab_tests_updated_at_idx" ON "ab_tests" USING btree ("updated_at");
  CREATE INDEX "ab_tests_created_at_idx" ON "ab_tests" USING btree ("created_at");
  CREATE INDEX "marketing_execution_logs_campaign_idx" ON "marketing_execution_logs" USING btree ("campaign_id");
  CREATE INDEX "marketing_execution_logs_user_idx" ON "marketing_execution_logs" USING btree ("user_id");
  CREATE INDEX "marketing_execution_logs_message_template_idx" ON "marketing_execution_logs" USING btree ("message_template_id");
  CREATE INDEX "marketing_execution_logs_updated_at_idx" ON "marketing_execution_logs" USING btree ("updated_at");
  CREATE INDEX "marketing_execution_logs_created_at_idx" ON "marketing_execution_logs" USING btree ("created_at");
  CREATE INDEX "message_templates_variables_order_idx" ON "message_templates_variables" USING btree ("_order");
  CREATE INDEX "message_templates_variables_parent_id_idx" ON "message_templates_variables" USING btree ("_parent_id");
  CREATE INDEX "message_templates_segment_variants_order_idx" ON "message_templates_segment_variants" USING btree ("_order");
  CREATE INDEX "message_templates_segment_variants_parent_id_idx" ON "message_templates_segment_variants" USING btree ("_parent_id");
  CREATE INDEX "message_templates_credit_score_variants_order_idx" ON "message_templates_credit_score_variants" USING btree ("_order");
  CREATE INDEX "message_templates_credit_score_variants_parent_id_idx" ON "message_templates_credit_score_variants" USING btree ("_parent_id");
  CREATE INDEX "message_templates_tier_variants_order_idx" ON "message_templates_tier_variants" USING btree ("_order");
  CREATE INDEX "message_templates_tier_variants_parent_id_idx" ON "message_templates_tier_variants" USING btree ("_parent_id");
  CREATE INDEX "message_templates_tags_order_idx" ON "message_templates_tags" USING btree ("_order");
  CREATE INDEX "message_templates_tags_parent_id_idx" ON "message_templates_tags" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "message_templates_template_slug_idx" ON "message_templates" USING btree ("template_slug");
  CREATE INDEX "message_templates_preview_image_idx" ON "message_templates" USING btree ("preview_image_id");
  CREATE INDEX "message_templates_updated_at_idx" ON "message_templates" USING btree ("updated_at");
  CREATE INDEX "message_templates_created_at_idx" ON "message_templates" USING btree ("created_at");
  CREATE UNIQUE INDEX "email_templates_event_key_idx" ON "email_templates" USING btree ("event_key");
  CREATE INDEX "email_templates_updated_at_idx" ON "email_templates" USING btree ("updated_at");
  CREATE INDEX "email_templates_created_at_idx" ON "email_templates" USING btree ("created_at");
  CREATE UNIQUE INDEX "newsletter_subscribers_email_idx" ON "newsletter_subscribers" USING btree ("email");
  CREATE INDEX "newsletter_subscribers_status_idx" ON "newsletter_subscribers" USING btree ("status");
  CREATE INDEX "newsletter_subscribers_source_idx" ON "newsletter_subscribers" USING btree ("source");
  CREATE INDEX "newsletter_subscribers_kim_blog_subscribed_idx" ON "newsletter_subscribers" USING btree ("kim_blog_subscribed");
  CREATE INDEX "newsletter_subscribers_user_idx" ON "newsletter_subscribers" USING btree ("user_id");
  CREATE INDEX "newsletter_subscribers_unsubscribe_token_idx" ON "newsletter_subscribers" USING btree ("unsubscribe_token");
  CREATE INDEX "newsletter_subscribers_updated_at_idx" ON "newsletter_subscribers" USING btree ("updated_at");
  CREATE INDEX "newsletter_subscribers_created_at_idx" ON "newsletter_subscribers" USING btree ("created_at");
  CREATE UNIQUE INDEX "utm_campaigns_slug_idx" ON "utm_campaigns" USING btree ("slug");
  CREATE INDEX "utm_campaigns_updated_at_idx" ON "utm_campaigns" USING btree ("updated_at");
  CREATE INDEX "utm_campaigns_created_at_idx" ON "utm_campaigns" USING btree ("created_at");
  CREATE INDEX "ad_audiences_updated_at_idx" ON "ad_audiences" USING btree ("updated_at");
  CREATE INDEX "ad_audiences_created_at_idx" ON "ad_audiences" USING btree ("created_at");
  CREATE INDEX "ad_audiences_rels_order_idx" ON "ad_audiences_rels" USING btree ("order");
  CREATE INDEX "ad_audiences_rels_parent_idx" ON "ad_audiences_rels" USING btree ("parent_id");
  CREATE INDEX "ad_audiences_rels_path_idx" ON "ad_audiences_rels" USING btree ("path");
  CREATE INDEX "ad_audiences_rels_products_id_idx" ON "ad_audiences_rels" USING btree ("products_id");
  CREATE INDEX "search_console_keywords_query_idx" ON "search_console_keywords" USING btree ("query");
  CREATE INDEX "search_console_keywords_page_path_idx" ON "search_console_keywords" USING btree ("page_path");
  CREATE INDEX "search_console_keywords_target_product_idx" ON "search_console_keywords" USING btree ("target_product_id");
  CREATE INDEX "search_console_keywords_updated_at_idx" ON "search_console_keywords" USING btree ("updated_at");
  CREATE INDEX "search_console_keywords_created_at_idx" ON "search_console_keywords" USING btree ("created_at");
  CREATE INDEX "competitor_price_records_flags_order_idx" ON "competitor_price_records_flags" USING btree ("order");
  CREATE INDEX "competitor_price_records_flags_parent_idx" ON "competitor_price_records_flags" USING btree ("parent_id");
  CREATE INDEX "competitor_price_records_product_name_idx" ON "competitor_price_records" USING btree ("product_name");
  CREATE INDEX "competitor_price_records_normalized_name_idx" ON "competitor_price_records" USING btree ("normalized_name");
  CREATE INDEX "competitor_price_records_related_product_idx" ON "competitor_price_records" USING btree ("related_product_id");
  CREATE INDEX "competitor_price_records_updated_at_idx" ON "competitor_price_records" USING btree ("updated_at");
  CREATE INDEX "competitor_price_records_created_at_idx" ON "competitor_price_records" USING btree ("created_at");
  CREATE INDEX "marketing_content_drafts_channels_order_idx" ON "marketing_content_drafts_channels" USING btree ("order");
  CREATE INDEX "marketing_content_drafts_channels_parent_idx" ON "marketing_content_drafts_channels" USING btree ("parent_id");
  CREATE INDEX "marketing_content_drafts_target_product_idx" ON "marketing_content_drafts" USING btree ("target_product_id");
  CREATE INDEX "marketing_content_drafts_updated_at_idx" ON "marketing_content_drafts" USING btree ("updated_at");
  CREATE INDEX "marketing_content_drafts_created_at_idx" ON "marketing_content_drafts" USING btree ("created_at");
  CREATE INDEX "customer_service_tickets_messages_order_idx" ON "customer_service_tickets_messages" USING btree ("_order");
  CREATE INDEX "customer_service_tickets_messages_parent_id_idx" ON "customer_service_tickets_messages" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "customer_service_tickets_ticket_number_idx" ON "customer_service_tickets" USING btree ("ticket_number");
  CREATE INDEX "customer_service_tickets_user_idx" ON "customer_service_tickets" USING btree ("user_id");
  CREATE INDEX "customer_service_tickets_assigned_agent_idx" ON "customer_service_tickets" USING btree ("assigned_agent_id");
  CREATE INDEX "customer_service_tickets_related_order_idx" ON "customer_service_tickets" USING btree ("related_order_id");
  CREATE INDEX "customer_service_tickets_updated_at_idx" ON "customer_service_tickets" USING btree ("updated_at");
  CREATE INDEX "customer_service_tickets_created_at_idx" ON "customer_service_tickets" USING btree ("created_at");
  CREATE INDEX "concierge_service_requests_request_detail_attachments_order_idx" ON "concierge_service_requests_request_detail_attachments" USING btree ("_order");
  CREATE INDEX "concierge_service_requests_request_detail_attachments_parent_id_idx" ON "concierge_service_requests_request_detail_attachments" USING btree ("_parent_id");
  CREATE INDEX "concierge_service_requests_request_detail_attachments_fi_idx" ON "concierge_service_requests_request_detail_attachments" USING btree ("file_id");
  CREATE INDEX "concierge_service_requests_concierge_notes_order_idx" ON "concierge_service_requests_concierge_notes" USING btree ("_order");
  CREATE INDEX "concierge_service_requests_concierge_notes_parent_id_idx" ON "concierge_service_requests_concierge_notes" USING btree ("_parent_id");
  CREATE INDEX "concierge_service_requests_concierge_notes_added_by_idx" ON "concierge_service_requests_concierge_notes" USING btree ("added_by_id");
  CREATE UNIQUE INDEX "concierge_service_requests_request_number_idx" ON "concierge_service_requests" USING btree ("request_number");
  CREATE INDEX "concierge_service_requests_requester_idx" ON "concierge_service_requests" USING btree ("requester_id");
  CREATE INDEX "concierge_service_requests_assigned_concierge_idx" ON "concierge_service_requests" USING btree ("assigned_concierge_id");
  CREATE INDEX "concierge_service_requests_related_order_idx" ON "concierge_service_requests" USING btree ("related_order_id");
  CREATE INDEX "concierge_service_requests_updated_at_idx" ON "concierge_service_requests" USING btree ("updated_at");
  CREATE INDEX "concierge_service_requests_created_at_idx" ON "concierge_service_requests" USING btree ("created_at");
  CREATE INDEX "affiliates_withdrawal_requests_order_idx" ON "affiliates_withdrawal_requests" USING btree ("_order");
  CREATE INDEX "affiliates_withdrawal_requests_parent_id_idx" ON "affiliates_withdrawal_requests" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "affiliates_user_idx" ON "affiliates" USING btree ("user_id");
  CREATE UNIQUE INDEX "affiliates_referral_code_idx" ON "affiliates" USING btree ("referral_code");
  CREATE INDEX "affiliates_updated_at_idx" ON "affiliates" USING btree ("updated_at");
  CREATE INDEX "affiliates_created_at_idx" ON "affiliates" USING btree ("created_at");
  CREATE INDEX "ugc_posts_media_items_order_idx" ON "ugc_posts_media_items" USING btree ("_order");
  CREATE INDEX "ugc_posts_media_items_parent_id_idx" ON "ugc_posts_media_items" USING btree ("_parent_id");
  CREATE INDEX "ugc_posts_media_items_file_idx" ON "ugc_posts_media_items" USING btree ("file_id");
  CREATE INDEX "ugc_posts_display_locations_order_idx" ON "ugc_posts_display_locations" USING btree ("order");
  CREATE INDEX "ugc_posts_display_locations_parent_idx" ON "ugc_posts_display_locations" USING btree ("parent_id");
  CREATE INDEX "ugc_posts_hashtags_order_idx" ON "ugc_posts_hashtags" USING btree ("_order");
  CREATE INDEX "ugc_posts_hashtags_parent_id_idx" ON "ugc_posts_hashtags" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "ugc_posts_external_id_idx" ON "ugc_posts" USING btree ("external_id");
  CREATE INDEX "ugc_posts_author_avatar_idx" ON "ugc_posts" USING btree ("author_avatar_id");
  CREATE INDEX "ugc_posts_updated_at_idx" ON "ugc_posts" USING btree ("updated_at");
  CREATE INDEX "ugc_posts_created_at_idx" ON "ugc_posts" USING btree ("created_at");
  CREATE INDEX "ugc_posts_rels_order_idx" ON "ugc_posts_rels" USING btree ("order");
  CREATE INDEX "ugc_posts_rels_parent_idx" ON "ugc_posts_rels" USING btree ("parent_id");
  CREATE INDEX "ugc_posts_rels_path_idx" ON "ugc_posts_rels" USING btree ("path");
  CREATE INDEX "ugc_posts_rels_products_id_idx" ON "ugc_posts_rels" USING btree ("products_id");
  CREATE INDEX "prize_pools_eligible_games_order_idx" ON "prize_pools_eligible_games" USING btree ("order");
  CREATE INDEX "prize_pools_eligible_games_parent_idx" ON "prize_pools_eligible_games" USING btree ("parent_id");
  CREATE UNIQUE INDEX "prize_pools_slug_idx" ON "prize_pools" USING btree ("slug");
  CREATE INDEX "prize_pools_image_idx" ON "prize_pools" USING btree ("image_id");
  CREATE INDEX "prize_pools_updated_at_idx" ON "prize_pools" USING btree ("updated_at");
  CREATE INDEX "prize_pools_created_at_idx" ON "prize_pools" USING btree ("created_at");
  CREATE INDEX "mini_game_records_player_idx" ON "mini_game_records" USING btree ("player_id");
  CREATE INDEX "mini_game_records_updated_at_idx" ON "mini_game_records" USING btree ("updated_at");
  CREATE INDEX "mini_game_records_created_at_idx" ON "mini_game_records" USING btree ("created_at");
  CREATE UNIQUE INDEX "card_battles_room_code_idx" ON "card_battles" USING btree ("room_code");
  CREATE INDEX "card_battles_challenger_idx" ON "card_battles" USING btree ("challenger_id");
  CREATE INDEX "card_battles_opponent_idx" ON "card_battles" USING btree ("opponent_id");
  CREATE INDEX "card_battles_updated_at_idx" ON "card_battles" USING btree ("updated_at");
  CREATE INDEX "card_battles_created_at_idx" ON "card_battles" USING btree ("created_at");
  CREATE INDEX "game_leaderboard_badges_order_idx" ON "game_leaderboard_badges" USING btree ("_order");
  CREATE INDEX "game_leaderboard_badges_parent_id_idx" ON "game_leaderboard_badges" USING btree ("_parent_id");
  CREATE INDEX "game_leaderboard_player_idx" ON "game_leaderboard" USING btree ("player_id");
  CREATE INDEX "game_leaderboard_updated_at_idx" ON "game_leaderboard" USING btree ("updated_at");
  CREATE INDEX "game_leaderboard_created_at_idx" ON "game_leaderboard" USING btree ("created_at");
  CREATE UNIQUE INDEX "collectible_card_templates_product_idx" ON "collectible_card_templates" USING btree ("product_id");
  CREATE INDEX "collectible_card_templates_updated_at_idx" ON "collectible_card_templates" USING btree ("updated_at");
  CREATE INDEX "collectible_card_templates_created_at_idx" ON "collectible_card_templates" USING btree ("created_at");
  CREATE INDEX "collectible_cards_product_idx" ON "collectible_cards" USING btree ("product_id");
  CREATE INDEX "collectible_cards_template_idx" ON "collectible_cards" USING btree ("template_id");
  CREATE INDEX "collectible_cards_owner_idx" ON "collectible_cards" USING btree ("owner_id");
  CREATE INDEX "collectible_cards_original_owner_idx" ON "collectible_cards" USING btree ("original_owner_id");
  CREATE INDEX "collectible_cards_status_idx" ON "collectible_cards" USING btree ("status");
  CREATE INDEX "collectible_cards_source_order_idx" ON "collectible_cards" USING btree ("source_order_id");
  CREATE UNIQUE INDEX "collectible_cards_share_slug_idx" ON "collectible_cards" USING btree ("share_slug");
  CREATE INDEX "collectible_cards_updated_at_idx" ON "collectible_cards" USING btree ("updated_at");
  CREATE INDEX "collectible_cards_created_at_idx" ON "collectible_cards" USING btree ("created_at");
  CREATE INDEX "collectible_card_events_card_idx" ON "collectible_card_events" USING btree ("card_id");
  CREATE INDEX "collectible_card_events_from_user_idx" ON "collectible_card_events" USING btree ("from_user_id");
  CREATE INDEX "collectible_card_events_to_user_idx" ON "collectible_card_events" USING btree ("to_user_id");
  CREATE INDEX "collectible_card_events_source_order_idx" ON "collectible_card_events" USING btree ("source_order_id");
  CREATE INDEX "collectible_card_events_updated_at_idx" ON "collectible_card_events" USING btree ("updated_at");
  CREATE INDEX "collectible_card_events_created_at_idx" ON "collectible_card_events" USING btree ("created_at");
  CREATE INDEX "style_submissions_images_order_idx" ON "style_submissions_images" USING btree ("_order");
  CREATE INDEX "style_submissions_images_parent_id_idx" ON "style_submissions_images" USING btree ("_parent_id");
  CREATE INDEX "style_submissions_images_image_idx" ON "style_submissions_images" USING btree ("image_id");
  CREATE INDEX "style_submissions_tags_order_idx" ON "style_submissions_tags" USING btree ("_order");
  CREATE INDEX "style_submissions_tags_parent_id_idx" ON "style_submissions_tags" USING btree ("_parent_id");
  CREATE INDEX "style_submissions_player_idx" ON "style_submissions" USING btree ("player_id");
  CREATE INDEX "style_submissions_game_type_idx" ON "style_submissions" USING btree ("game_type");
  CREATE INDEX "style_submissions_room_idx" ON "style_submissions" USING btree ("room_id");
  CREATE INDEX "style_submissions_parent_idx" ON "style_submissions" USING btree ("parent_id");
  CREATE INDEX "style_submissions_wish_idx" ON "style_submissions" USING btree ("wish_id");
  CREATE INDEX "style_submissions_moderation_moderation_reviewed_by_idx" ON "style_submissions" USING btree ("moderation_reviewed_by_id");
  CREATE INDEX "style_submissions_updated_at_idx" ON "style_submissions" USING btree ("updated_at");
  CREATE INDEX "style_submissions_created_at_idx" ON "style_submissions" USING btree ("created_at");
  CREATE INDEX "style_game_rooms_participants_order_idx" ON "style_game_rooms_participants" USING btree ("_order");
  CREATE INDEX "style_game_rooms_participants_parent_id_idx" ON "style_game_rooms_participants" USING btree ("_parent_id");
  CREATE INDEX "style_game_rooms_participants_user_idx" ON "style_game_rooms_participants" USING btree ("user_id");
  CREATE UNIQUE INDEX "style_game_rooms_room_code_idx" ON "style_game_rooms" USING btree ("room_code");
  CREATE INDEX "style_game_rooms_game_type_idx" ON "style_game_rooms" USING btree ("game_type");
  CREATE INDEX "style_game_rooms_host_idx" ON "style_game_rooms" USING btree ("host_id");
  CREATE INDEX "style_game_rooms_status_idx" ON "style_game_rooms" USING btree ("status");
  CREATE INDEX "style_game_rooms_result_result_winner_idx" ON "style_game_rooms" USING btree ("result_winner_id");
  CREATE INDEX "style_game_rooms_updated_at_idx" ON "style_game_rooms" USING btree ("updated_at");
  CREATE INDEX "style_game_rooms_created_at_idx" ON "style_game_rooms" USING btree ("created_at");
  CREATE INDEX "style_votes_voter_idx" ON "style_votes" USING btree ("voter_id");
  CREATE INDEX "style_votes_submission_idx" ON "style_votes" USING btree ("submission_id");
  CREATE INDEX "style_votes_room_idx" ON "style_votes" USING btree ("room_id");
  CREATE INDEX "style_votes_updated_at_idx" ON "style_votes" USING btree ("updated_at");
  CREATE INDEX "style_votes_created_at_idx" ON "style_votes" USING btree ("created_at");
  CREATE INDEX "style_wishes_reference_photos_order_idx" ON "style_wishes_reference_photos" USING btree ("_order");
  CREATE INDEX "style_wishes_reference_photos_parent_id_idx" ON "style_wishes_reference_photos" USING btree ("_parent_id");
  CREATE INDEX "style_wishes_reference_photos_image_idx" ON "style_wishes_reference_photos" USING btree ("image_id");
  CREATE INDEX "style_wishes_grants_order_idx" ON "style_wishes_grants" USING btree ("_order");
  CREATE INDEX "style_wishes_grants_parent_id_idx" ON "style_wishes_grants" USING btree ("_parent_id");
  CREATE INDEX "style_wishes_grants_granter_idx" ON "style_wishes_grants" USING btree ("granter_id");
  CREATE INDEX "style_wishes_grants_submission_idx" ON "style_wishes_grants" USING btree ("submission_id");
  CREATE INDEX "style_wishes_seeker_idx" ON "style_wishes" USING btree ("seeker_id");
  CREATE INDEX "style_wishes_status_idx" ON "style_wishes" USING btree ("status");
  CREATE INDEX "style_wishes_winning_grant_idx" ON "style_wishes" USING btree ("winning_grant_id");
  CREATE INDEX "style_wishes_updated_at_idx" ON "style_wishes" USING btree ("updated_at");
  CREATE INDEX "style_wishes_created_at_idx" ON "style_wishes" USING btree ("created_at");
  CREATE INDEX "daily_horoscopes_zodiac_sign_idx" ON "daily_horoscopes" USING btree ("zodiac_sign");
  CREATE INDEX "daily_horoscopes_date_idx" ON "daily_horoscopes" USING btree ("date");
  CREATE INDEX "daily_horoscopes_gender_idx" ON "daily_horoscopes" USING btree ("gender");
  CREATE INDEX "daily_horoscopes_updated_at_idx" ON "daily_horoscopes" USING btree ("updated_at");
  CREATE INDEX "daily_horoscopes_created_at_idx" ON "daily_horoscopes" USING btree ("created_at");
  CREATE INDEX "pages_blocks_hero_banner_order_idx" ON "pages_blocks_hero_banner" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_banner_parent_id_idx" ON "pages_blocks_hero_banner" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_banner_path_idx" ON "pages_blocks_hero_banner" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_banner_background_image_idx" ON "pages_blocks_hero_banner" USING btree ("background_image_id");
  CREATE INDEX "pages_blocks_magazine_cover_corner_labels_order_idx" ON "pages_blocks_magazine_cover_corner_labels" USING btree ("_order");
  CREATE INDEX "pages_blocks_magazine_cover_corner_labels_parent_id_idx" ON "pages_blocks_magazine_cover_corner_labels" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_magazine_cover_order_idx" ON "pages_blocks_magazine_cover" USING btree ("_order");
  CREATE INDEX "pages_blocks_magazine_cover_parent_id_idx" ON "pages_blocks_magazine_cover" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_magazine_cover_path_idx" ON "pages_blocks_magazine_cover" USING btree ("_path");
  CREATE INDEX "pages_blocks_magazine_cover_image_idx" ON "pages_blocks_magazine_cover" USING btree ("image_id");
  CREATE INDEX "pages_blocks_pull_quote_order_idx" ON "pages_blocks_pull_quote" USING btree ("_order");
  CREATE INDEX "pages_blocks_pull_quote_parent_id_idx" ON "pages_blocks_pull_quote" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_pull_quote_path_idx" ON "pages_blocks_pull_quote" USING btree ("_path");
  CREATE INDEX "pages_blocks_editorial_spread_rows_order_idx" ON "pages_blocks_editorial_spread_rows" USING btree ("_order");
  CREATE INDEX "pages_blocks_editorial_spread_rows_parent_id_idx" ON "pages_blocks_editorial_spread_rows" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_editorial_spread_rows_image_idx" ON "pages_blocks_editorial_spread_rows" USING btree ("image_id");
  CREATE INDEX "pages_blocks_editorial_spread_order_idx" ON "pages_blocks_editorial_spread" USING btree ("_order");
  CREATE INDEX "pages_blocks_editorial_spread_parent_id_idx" ON "pages_blocks_editorial_spread" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_editorial_spread_path_idx" ON "pages_blocks_editorial_spread" USING btree ("_path");
  CREATE INDEX "pages_blocks_lookbook_grid_items_tags_order_idx" ON "pages_blocks_lookbook_grid_items_tags" USING btree ("_order");
  CREATE INDEX "pages_blocks_lookbook_grid_items_tags_parent_id_idx" ON "pages_blocks_lookbook_grid_items_tags" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_lookbook_grid_items_order_idx" ON "pages_blocks_lookbook_grid_items" USING btree ("_order");
  CREATE INDEX "pages_blocks_lookbook_grid_items_parent_id_idx" ON "pages_blocks_lookbook_grid_items" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_lookbook_grid_items_image_idx" ON "pages_blocks_lookbook_grid_items" USING btree ("image_id");
  CREATE INDEX "pages_blocks_lookbook_grid_items_linked_product_idx" ON "pages_blocks_lookbook_grid_items" USING btree ("linked_product_id");
  CREATE INDEX "pages_blocks_lookbook_grid_order_idx" ON "pages_blocks_lookbook_grid" USING btree ("_order");
  CREATE INDEX "pages_blocks_lookbook_grid_parent_id_idx" ON "pages_blocks_lookbook_grid" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_lookbook_grid_path_idx" ON "pages_blocks_lookbook_grid" USING btree ("_path");
  CREATE INDEX "pages_blocks_celebrity_grid_order_idx" ON "pages_blocks_celebrity_grid" USING btree ("_order");
  CREATE INDEX "pages_blocks_celebrity_grid_parent_id_idx" ON "pages_blocks_celebrity_grid" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_celebrity_grid_path_idx" ON "pages_blocks_celebrity_grid" USING btree ("_path");
  CREATE INDEX "pages_blocks_kol_persona_social_links_order_idx" ON "pages_blocks_kol_persona_social_links" USING btree ("_order");
  CREATE INDEX "pages_blocks_kol_persona_social_links_parent_id_idx" ON "pages_blocks_kol_persona_social_links" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_kol_persona_order_idx" ON "pages_blocks_kol_persona" USING btree ("_order");
  CREATE INDEX "pages_blocks_kol_persona_parent_id_idx" ON "pages_blocks_kol_persona" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_kol_persona_path_idx" ON "pages_blocks_kol_persona" USING btree ("_path");
  CREATE INDEX "pages_blocks_kol_persona_avatar_idx" ON "pages_blocks_kol_persona" USING btree ("avatar_id");
  CREATE INDEX "pages_blocks_rich_content_order_idx" ON "pages_blocks_rich_content" USING btree ("_order");
  CREATE INDEX "pages_blocks_rich_content_parent_id_idx" ON "pages_blocks_rich_content" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_rich_content_path_idx" ON "pages_blocks_rich_content" USING btree ("_path");
  CREATE INDEX "pages_blocks_image_gallery_images_order_idx" ON "pages_blocks_image_gallery_images" USING btree ("_order");
  CREATE INDEX "pages_blocks_image_gallery_images_parent_id_idx" ON "pages_blocks_image_gallery_images" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_image_gallery_images_image_idx" ON "pages_blocks_image_gallery_images" USING btree ("image_id");
  CREATE INDEX "pages_blocks_image_gallery_order_idx" ON "pages_blocks_image_gallery" USING btree ("_order");
  CREATE INDEX "pages_blocks_image_gallery_parent_id_idx" ON "pages_blocks_image_gallery" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_image_gallery_path_idx" ON "pages_blocks_image_gallery" USING btree ("_path");
  CREATE INDEX "pages_blocks_product_showcase_order_idx" ON "pages_blocks_product_showcase" USING btree ("_order");
  CREATE INDEX "pages_blocks_product_showcase_parent_id_idx" ON "pages_blocks_product_showcase" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_product_showcase_path_idx" ON "pages_blocks_product_showcase" USING btree ("_path");
  CREATE INDEX "pages_blocks_cta_order_idx" ON "pages_blocks_cta" USING btree ("_order");
  CREATE INDEX "pages_blocks_cta_parent_id_idx" ON "pages_blocks_cta" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_cta_path_idx" ON "pages_blocks_cta" USING btree ("_path");
  CREATE INDEX "pages_blocks_cta_background_image_idx" ON "pages_blocks_cta" USING btree ("background_image_id");
  CREATE INDEX "pages_blocks_faq_questions_order_idx" ON "pages_blocks_faq_questions" USING btree ("_order");
  CREATE INDEX "pages_blocks_faq_questions_parent_id_idx" ON "pages_blocks_faq_questions" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_faq_order_idx" ON "pages_blocks_faq" USING btree ("_order");
  CREATE INDEX "pages_blocks_faq_parent_id_idx" ON "pages_blocks_faq" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_faq_path_idx" ON "pages_blocks_faq" USING btree ("_path");
  CREATE INDEX "pages_blocks_testimonial_testimonials_order_idx" ON "pages_blocks_testimonial_testimonials" USING btree ("_order");
  CREATE INDEX "pages_blocks_testimonial_testimonials_parent_id_idx" ON "pages_blocks_testimonial_testimonials" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_testimonial_testimonials_avatar_idx" ON "pages_blocks_testimonial_testimonials" USING btree ("avatar_id");
  CREATE INDEX "pages_blocks_testimonial_order_idx" ON "pages_blocks_testimonial" USING btree ("_order");
  CREATE INDEX "pages_blocks_testimonial_parent_id_idx" ON "pages_blocks_testimonial" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_testimonial_path_idx" ON "pages_blocks_testimonial" USING btree ("_path");
  CREATE INDEX "pages_blocks_countdown_order_idx" ON "pages_blocks_countdown" USING btree ("_order");
  CREATE INDEX "pages_blocks_countdown_parent_id_idx" ON "pages_blocks_countdown" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_countdown_path_idx" ON "pages_blocks_countdown" USING btree ("_path");
  CREATE INDEX "pages_blocks_countdown_background_image_idx" ON "pages_blocks_countdown" USING btree ("background_image_id");
  CREATE INDEX "pages_blocks_video_order_idx" ON "pages_blocks_video" USING btree ("_order");
  CREATE INDEX "pages_blocks_video_parent_id_idx" ON "pages_blocks_video" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_video_path_idx" ON "pages_blocks_video" USING btree ("_path");
  CREATE INDEX "pages_blocks_divider_order_idx" ON "pages_blocks_divider" USING btree ("_order");
  CREATE INDEX "pages_blocks_divider_parent_id_idx" ON "pages_blocks_divider" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_divider_path_idx" ON "pages_blocks_divider" USING btree ("_path");
  CREATE UNIQUE INDEX "pages_slug_idx" ON "pages" USING btree ("slug");
  CREATE INDEX "pages_seo_seo_meta_image_idx" ON "pages" USING btree ("seo_meta_image_id");
  CREATE INDEX "pages_updated_at_idx" ON "pages" USING btree ("updated_at");
  CREATE INDEX "pages_created_at_idx" ON "pages" USING btree ("created_at");
  CREATE INDEX "pages_rels_order_idx" ON "pages_rels" USING btree ("order");
  CREATE INDEX "pages_rels_parent_idx" ON "pages_rels" USING btree ("parent_id");
  CREATE INDEX "pages_rels_path_idx" ON "pages_rels" USING btree ("path");
  CREATE INDEX "pages_rels_products_id_idx" ON "pages_rels" USING btree ("products_id");
  CREATE INDEX "celebrity_features_gallery_images_order_idx" ON "celebrity_features_gallery_images" USING btree ("_order");
  CREATE INDEX "celebrity_features_gallery_images_parent_id_idx" ON "celebrity_features_gallery_images" USING btree ("_parent_id");
  CREATE INDEX "celebrity_features_gallery_images_image_idx" ON "celebrity_features_gallery_images" USING btree ("image_id");
  CREATE INDEX "celebrity_features_gallery_images_linked_product_idx" ON "celebrity_features_gallery_images" USING btree ("linked_product_id");
  CREATE INDEX "celebrity_features_social_links_order_idx" ON "celebrity_features_social_links" USING btree ("_order");
  CREATE INDEX "celebrity_features_social_links_parent_id_idx" ON "celebrity_features_social_links" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "celebrity_features_slug_idx" ON "celebrity_features" USING btree ("slug");
  CREATE INDEX "celebrity_features_photo_idx" ON "celebrity_features" USING btree ("photo_id");
  CREATE INDEX "celebrity_features_linked_product_idx" ON "celebrity_features" USING btree ("linked_product_id");
  CREATE INDEX "celebrity_features_updated_at_idx" ON "celebrity_features" USING btree ("updated_at");
  CREATE INDEX "celebrity_features_created_at_idx" ON "celebrity_features" USING btree ("created_at");
  CREATE INDEX "podcasts_tags_order_idx" ON "podcasts_tags" USING btree ("_order");
  CREATE INDEX "podcasts_tags_parent_id_idx" ON "podcasts_tags" USING btree ("_parent_id");
  CREATE INDEX "podcasts_sources_order_idx" ON "podcasts_sources" USING btree ("_order");
  CREATE INDEX "podcasts_sources_parent_id_idx" ON "podcasts_sources" USING btree ("_parent_id");
  CREATE INDEX "podcasts_hosts_order_idx" ON "podcasts_hosts" USING btree ("_order");
  CREATE INDEX "podcasts_hosts_parent_id_idx" ON "podcasts_hosts" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "podcasts_slug_idx" ON "podcasts" USING btree ("slug");
  CREATE INDEX "podcasts_audio_file_idx" ON "podcasts" USING btree ("audio_file_id");
  CREATE INDEX "podcasts_cover_image_idx" ON "podcasts" USING btree ("cover_image_id");
  CREATE INDEX "podcasts_seo_seo_meta_image_idx" ON "podcasts" USING btree ("seo_meta_image_id");
  CREATE INDEX "podcasts_updated_at_idx" ON "podcasts" USING btree ("updated_at");
  CREATE INDEX "podcasts_created_at_idx" ON "podcasts" USING btree ("created_at");
  CREATE INDEX "podcasts_rels_order_idx" ON "podcasts_rels" USING btree ("order");
  CREATE INDEX "podcasts_rels_parent_idx" ON "podcasts_rels" USING btree ("parent_id");
  CREATE INDEX "podcasts_rels_path_idx" ON "podcasts_rels" USING btree ("path");
  CREATE INDEX "podcasts_rels_products_id_idx" ON "podcasts_rels" USING btree ("products_id");
  CREATE INDEX "podcasts_rels_categories_id_idx" ON "podcasts_rels" USING btree ("categories_id");
  CREATE INDEX "site_themes_updated_at_idx" ON "site_themes" USING btree ("updated_at");
  CREATE INDEX "site_themes_created_at_idx" ON "site_themes" USING btree ("created_at");
  CREATE INDEX "media_folder_name_idx" ON "media" USING btree ("folder_name");
  CREATE INDEX "media_folder_idx" ON "media" USING btree ("folder_id");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "media" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "media_sizes_card_sizes_card_filename_idx" ON "media" USING btree ("sizes_card_filename");
  CREATE INDEX "media_sizes_blog800_sizes_blog800_filename_idx" ON "media" USING btree ("sizes_blog800_filename");
  CREATE INDEX "media_sizes_blog1000_sizes_blog1000_filename_idx" ON "media" USING btree ("sizes_blog1000_filename");
  CREATE INDEX "media_sizes_tablet_sizes_tablet_filename_idx" ON "media" USING btree ("sizes_tablet_filename");
  CREATE INDEX "media_sizes_desktop_sizes_desktop_filename_idx" ON "media" USING btree ("sizes_desktop_filename");
  CREATE INDEX "login_attempts_email_idx" ON "login_attempts" USING btree ("email");
  CREATE INDEX "login_attempts_user_id_idx" ON "login_attempts" USING btree ("user_id");
  CREATE INDEX "login_attempts_updated_at_idx" ON "login_attempts" USING btree ("updated_at");
  CREATE INDEX "login_attempts_created_at_idx" ON "login_attempts" USING btree ("created_at");
  CREATE UNIQUE INDEX "currencies_code_idx" ON "currencies" USING btree ("code");
  CREATE INDEX "currencies_updated_at_idx" ON "currencies" USING btree ("updated_at");
  CREATE INDEX "currencies_created_at_idx" ON "currencies" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_folders_folder_type_order_idx" ON "payload_folders_folder_type" USING btree ("order");
  CREATE INDEX "payload_folders_folder_type_parent_idx" ON "payload_folders_folder_type" USING btree ("parent_id");
  CREATE INDEX "payload_folders_name_idx" ON "payload_folders" USING btree ("name");
  CREATE INDEX "payload_folders_folder_idx" ON "payload_folders" USING btree ("folder_id");
  CREATE INDEX "payload_folders_updated_at_idx" ON "payload_folders" USING btree ("updated_at");
  CREATE INDEX "payload_folders_created_at_idx" ON "payload_folders" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_blog_posts_id_idx" ON "payload_locked_documents_rels" USING btree ("blog_posts_id");
  CREATE INDEX "payload_locked_documents_rels_blog_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("blog_categories_id");
  CREATE INDEX "payload_locked_documents_rels_orders_id_idx" ON "payload_locked_documents_rels" USING btree ("orders_id");
  CREATE INDEX "payload_locked_documents_rels_invoices_id_idx" ON "payload_locked_documents_rels" USING btree ("invoices_id");
  CREATE INDEX "payload_locked_documents_rels_returns_id_idx" ON "payload_locked_documents_rels" USING btree ("returns_id");
  CREATE INDEX "payload_locked_documents_rels_exchanges_id_idx" ON "payload_locked_documents_rels" USING btree ("exchanges_id");
  CREATE INDEX "payload_locked_documents_rels_refunds_id_idx" ON "payload_locked_documents_rels" USING btree ("refunds_id");
  CREATE INDEX "payload_locked_documents_rels_shipping_methods_id_idx" ON "payload_locked_documents_rels" USING btree ("shipping_methods_id");
  CREATE INDEX "payload_locked_documents_rels_products_id_idx" ON "payload_locked_documents_rels" USING btree ("products_id");
  CREATE INDEX "payload_locked_documents_rels_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("categories_id");
  CREATE INDEX "payload_locked_documents_rels_size_charts_id_idx" ON "payload_locked_documents_rels" USING btree ("size_charts_id");
  CREATE INDEX "payload_locked_documents_rels_product_reviews_id_idx" ON "payload_locked_documents_rels" USING btree ("product_reviews_id");
  CREATE INDEX "payload_locked_documents_rels_inventory_transactions_id_idx" ON "payload_locked_documents_rels" USING btree ("inventory_transactions_id");
  CREATE INDEX "payload_locked_documents_rels_purchase_orders_id_idx" ON "payload_locked_documents_rels" USING btree ("purchase_orders_id");
  CREATE INDEX "payload_locked_documents_rels_stock_takes_id_idx" ON "payload_locked_documents_rels" USING btree ("stock_takes_id");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_membership_tiers_id_idx" ON "payload_locked_documents_rels" USING btree ("membership_tiers_id");
  CREATE INDEX "payload_locked_documents_rels_member_segments_id_idx" ON "payload_locked_documents_rels" USING btree ("member_segments_id");
  CREATE INDEX "payload_locked_documents_rels_subscription_plans_id_idx" ON "payload_locked_documents_rels" USING btree ("subscription_plans_id");
  CREATE INDEX "payload_locked_documents_rels_user_subscriptions_id_idx" ON "payload_locked_documents_rels" USING btree ("user_subscriptions_id");
  CREATE INDEX "payload_locked_documents_rels_points_transactions_id_idx" ON "payload_locked_documents_rels" USING btree ("points_transactions_id");
  CREATE INDEX "payload_locked_documents_rels_points_redemptions_id_idx" ON "payload_locked_documents_rels" USING btree ("points_redemptions_id");
  CREATE INDEX "payload_locked_documents_rels_user_rewards_id_idx" ON "payload_locked_documents_rels" USING btree ("user_rewards_id");
  CREATE INDEX "payload_locked_documents_rels_credit_score_history_id_idx" ON "payload_locked_documents_rels" USING btree ("credit_score_history_id");
  CREATE INDEX "payload_locked_documents_rels_wallet_transactions_id_idx" ON "payload_locked_documents_rels" USING btree ("wallet_transactions_id");
  CREATE INDEX "payload_locked_documents_rels_wallet_withdrawals_id_idx" ON "payload_locked_documents_rels" USING btree ("wallet_withdrawals_id");
  CREATE INDEX "payload_locked_documents_rels_wishlist_items_id_idx" ON "payload_locked_documents_rels" USING btree ("wishlist_items_id");
  CREATE INDEX "payload_locked_documents_rels_conversations_id_idx" ON "payload_locked_documents_rels" USING btree ("conversations_id");
  CREATE INDEX "payload_locked_documents_rels_messages_id_idx" ON "payload_locked_documents_rels" USING btree ("messages_id");
  CREATE INDEX "payload_locked_documents_rels_message_tags_id_idx" ON "payload_locked_documents_rels" USING btree ("message_tags_id");
  CREATE INDEX "payload_locked_documents_rels_conversation_activities_id_idx" ON "payload_locked_documents_rels" USING btree ("conversation_activities_id");
  CREATE INDEX "payload_locked_documents_rels_product_view_events_id_idx" ON "payload_locked_documents_rels" USING btree ("product_view_events_id");
  CREATE INDEX "payload_locked_documents_rels_behavior_events_id_idx" ON "payload_locked_documents_rels" USING btree ("behavior_events_id");
  CREATE INDEX "payload_locked_documents_rels_coupons_id_idx" ON "payload_locked_documents_rels" USING btree ("coupons_id");
  CREATE INDEX "payload_locked_documents_rels_coupon_redemptions_id_idx" ON "payload_locked_documents_rels" USING btree ("coupon_redemptions_id");
  CREATE INDEX "payload_locked_documents_rels_add_on_products_id_idx" ON "payload_locked_documents_rels" USING btree ("add_on_products_id");
  CREATE INDEX "payload_locked_documents_rels_gift_rules_id_idx" ON "payload_locked_documents_rels" USING btree ("gift_rules_id");
  CREATE INDEX "payload_locked_documents_rels_bundles_id_idx" ON "payload_locked_documents_rels" USING btree ("bundles_id");
  CREATE INDEX "payload_locked_documents_rels_marketing_campaigns_id_idx" ON "payload_locked_documents_rels" USING btree ("marketing_campaigns_id");
  CREATE INDEX "payload_locked_documents_rels_promotion_rules_id_idx" ON "payload_locked_documents_rels" USING btree ("promotion_rules_id");
  CREATE INDEX "payload_locked_documents_rels_promotion_applications_id_idx" ON "payload_locked_documents_rels" USING btree ("promotion_applications_id");
  CREATE INDEX "payload_locked_documents_rels_festival_templates_id_idx" ON "payload_locked_documents_rels" USING btree ("festival_templates_id");
  CREATE INDEX "payload_locked_documents_rels_birthday_campaigns_id_idx" ON "payload_locked_documents_rels" USING btree ("birthday_campaigns_id");
  CREATE INDEX "payload_locked_documents_rels_automation_journeys_id_idx" ON "payload_locked_documents_rels" USING btree ("automation_journeys_id");
  CREATE INDEX "payload_locked_documents_rels_automation_logs_id_idx" ON "payload_locked_documents_rels" USING btree ("automation_logs_id");
  CREATE INDEX "payload_locked_documents_rels_ab_tests_id_idx" ON "payload_locked_documents_rels" USING btree ("ab_tests_id");
  CREATE INDEX "payload_locked_documents_rels_marketing_execution_logs_i_idx" ON "payload_locked_documents_rels" USING btree ("marketing_execution_logs_id");
  CREATE INDEX "payload_locked_documents_rels_message_templates_id_idx" ON "payload_locked_documents_rels" USING btree ("message_templates_id");
  CREATE INDEX "payload_locked_documents_rels_email_templates_id_idx" ON "payload_locked_documents_rels" USING btree ("email_templates_id");
  CREATE INDEX "payload_locked_documents_rels_newsletter_subscribers_id_idx" ON "payload_locked_documents_rels" USING btree ("newsletter_subscribers_id");
  CREATE INDEX "payload_locked_documents_rels_utm_campaigns_id_idx" ON "payload_locked_documents_rels" USING btree ("utm_campaigns_id");
  CREATE INDEX "payload_locked_documents_rels_ad_audiences_id_idx" ON "payload_locked_documents_rels" USING btree ("ad_audiences_id");
  CREATE INDEX "payload_locked_documents_rels_search_console_keywords_id_idx" ON "payload_locked_documents_rels" USING btree ("search_console_keywords_id");
  CREATE INDEX "payload_locked_documents_rels_competitor_price_records_i_idx" ON "payload_locked_documents_rels" USING btree ("competitor_price_records_id");
  CREATE INDEX "payload_locked_documents_rels_marketing_content_drafts_i_idx" ON "payload_locked_documents_rels" USING btree ("marketing_content_drafts_id");
  CREATE INDEX "payload_locked_documents_rels_customer_service_tickets_i_idx" ON "payload_locked_documents_rels" USING btree ("customer_service_tickets_id");
  CREATE INDEX "payload_locked_documents_rels_concierge_service_requests_idx" ON "payload_locked_documents_rels" USING btree ("concierge_service_requests_id");
  CREATE INDEX "payload_locked_documents_rels_affiliates_id_idx" ON "payload_locked_documents_rels" USING btree ("affiliates_id");
  CREATE INDEX "payload_locked_documents_rels_ugc_posts_id_idx" ON "payload_locked_documents_rels" USING btree ("ugc_posts_id");
  CREATE INDEX "payload_locked_documents_rels_prize_pools_id_idx" ON "payload_locked_documents_rels" USING btree ("prize_pools_id");
  CREATE INDEX "payload_locked_documents_rels_mini_game_records_id_idx" ON "payload_locked_documents_rels" USING btree ("mini_game_records_id");
  CREATE INDEX "payload_locked_documents_rels_card_battles_id_idx" ON "payload_locked_documents_rels" USING btree ("card_battles_id");
  CREATE INDEX "payload_locked_documents_rels_game_leaderboard_id_idx" ON "payload_locked_documents_rels" USING btree ("game_leaderboard_id");
  CREATE INDEX "payload_locked_documents_rels_collectible_card_templates_idx" ON "payload_locked_documents_rels" USING btree ("collectible_card_templates_id");
  CREATE INDEX "payload_locked_documents_rels_collectible_cards_id_idx" ON "payload_locked_documents_rels" USING btree ("collectible_cards_id");
  CREATE INDEX "payload_locked_documents_rels_collectible_card_events_id_idx" ON "payload_locked_documents_rels" USING btree ("collectible_card_events_id");
  CREATE INDEX "payload_locked_documents_rels_style_submissions_id_idx" ON "payload_locked_documents_rels" USING btree ("style_submissions_id");
  CREATE INDEX "payload_locked_documents_rels_style_game_rooms_id_idx" ON "payload_locked_documents_rels" USING btree ("style_game_rooms_id");
  CREATE INDEX "payload_locked_documents_rels_style_votes_id_idx" ON "payload_locked_documents_rels" USING btree ("style_votes_id");
  CREATE INDEX "payload_locked_documents_rels_style_wishes_id_idx" ON "payload_locked_documents_rels" USING btree ("style_wishes_id");
  CREATE INDEX "payload_locked_documents_rels_daily_horoscopes_id_idx" ON "payload_locked_documents_rels" USING btree ("daily_horoscopes_id");
  CREATE INDEX "payload_locked_documents_rels_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("pages_id");
  CREATE INDEX "payload_locked_documents_rels_celebrity_features_id_idx" ON "payload_locked_documents_rels" USING btree ("celebrity_features_id");
  CREATE INDEX "payload_locked_documents_rels_podcasts_id_idx" ON "payload_locked_documents_rels" USING btree ("podcasts_id");
  CREATE INDEX "payload_locked_documents_rels_site_themes_id_idx" ON "payload_locked_documents_rels" USING btree ("site_themes_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_login_attempts_id_idx" ON "payload_locked_documents_rels" USING btree ("login_attempts_id");
  CREATE INDEX "payload_locked_documents_rels_currencies_id_idx" ON "payload_locked_documents_rels" USING btree ("currencies_id");
  CREATE INDEX "payload_locked_documents_rels_payload_folders_id_idx" ON "payload_locked_documents_rels" USING btree ("payload_folders_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "order_settings_notifications_admin_alert_emails_order_idx" ON "order_settings_notifications_admin_alert_emails" USING btree ("_order");
  CREATE INDEX "order_settings_notifications_admin_alert_emails_parent_id_idx" ON "order_settings_notifications_admin_alert_emails" USING btree ("_parent_id");
  CREATE INDEX "order_settings_status_flow_custom_statuses_order_idx" ON "order_settings_status_flow_custom_statuses" USING btree ("_order");
  CREATE INDEX "order_settings_status_flow_custom_statuses_parent_id_idx" ON "order_settings_status_flow_custom_statuses" USING btree ("_parent_id");
  CREATE INDEX "invoice_settings_automation_config_notify_channels_order_idx" ON "invoice_settings_automation_config_notify_channels" USING btree ("order");
  CREATE INDEX "invoice_settings_automation_config_notify_channels_parent_idx" ON "invoice_settings_automation_config_notify_channels" USING btree ("parent_id");
  CREATE INDEX "invoice_settings_branding_config_branding_config_invoice_idx" ON "invoice_settings" USING btree ("branding_config_invoice_logo_id");
  CREATE INDEX "invoice_settings_branding_config_branding_config_company_idx" ON "invoice_settings" USING btree ("branding_config_company_chop_id");
  CREATE INDEX "tax_settings_tax_categories_order_idx" ON "tax_settings_tax_categories" USING btree ("_order");
  CREATE INDEX "tax_settings_tax_categories_parent_id_idx" ON "tax_settings_tax_categories" USING btree ("_parent_id");
  CREATE INDEX "loyalty_settings_recommendation_config_placements_order_idx" ON "loyalty_settings_recommendation_config_placements" USING btree ("_order");
  CREATE INDEX "loyalty_settings_recommendation_config_placements_parent_id_idx" ON "loyalty_settings_recommendation_config_placements" USING btree ("_parent_id");
  CREATE INDEX "point_redemption_settings_expiry_notification_reminder_days_order_idx" ON "point_redemption_settings_expiry_notification_reminder_days" USING btree ("_order");
  CREATE INDEX "point_redemption_settings_expiry_notification_reminder_days_parent_id_idx" ON "point_redemption_settings_expiry_notification_reminder_days" USING btree ("_parent_id");
  CREATE INDEX "point_redemption_settings_boost_events_order_idx" ON "point_redemption_settings_boost_events" USING btree ("_order");
  CREATE INDEX "point_redemption_settings_boost_events_parent_id_idx" ON "point_redemption_settings_boost_events" USING btree ("_parent_id");
  CREATE INDEX "point_redemption_settings_ugc_testimonials_items_order_idx" ON "point_redemption_settings_ugc_testimonials_items" USING btree ("_order");
  CREATE INDEX "point_redemption_settings_ugc_testimonials_items_parent_id_idx" ON "point_redemption_settings_ugc_testimonials_items" USING btree ("_parent_id");
  CREATE INDEX "point_redemption_settings_rels_order_idx" ON "point_redemption_settings_rels" USING btree ("order");
  CREATE INDEX "point_redemption_settings_rels_parent_idx" ON "point_redemption_settings_rels" USING btree ("parent_id");
  CREATE INDEX "point_redemption_settings_rels_path_idx" ON "point_redemption_settings_rels" USING btree ("path");
  CREATE INDEX "point_redemption_settings_rels_points_redemptions_id_idx" ON "point_redemption_settings_rels" USING btree ("points_redemptions_id");
  CREATE INDEX "segmentation_settings_segment_colors_order_idx" ON "segmentation_settings_segment_colors" USING btree ("_order");
  CREATE INDEX "segmentation_settings_segment_colors_parent_id_idx" ON "segmentation_settings_segment_colors" USING btree ("_parent_id");
  CREATE INDEX "cs_settings_business_hours_schedule_order_idx" ON "cs_settings_business_hours_schedule" USING btree ("_order");
  CREATE INDEX "cs_settings_business_hours_schedule_parent_id_idx" ON "cs_settings_business_hours_schedule" USING btree ("_parent_id");
  CREATE INDEX "cs_settings_business_hours_holidays_order_idx" ON "cs_settings_business_hours_holidays" USING btree ("_order");
  CREATE INDEX "cs_settings_business_hours_holidays_parent_id_idx" ON "cs_settings_business_hours_holidays" USING btree ("_parent_id");
  CREATE INDEX "cs_settings_sla_first_response_minutes_order_idx" ON "cs_settings_sla_first_response_minutes" USING btree ("_order");
  CREATE INDEX "cs_settings_sla_first_response_minutes_parent_id_idx" ON "cs_settings_sla_first_response_minutes" USING btree ("_parent_id");
  CREATE INDEX "cs_settings_sla_resolution_hours_order_idx" ON "cs_settings_sla_resolution_hours" USING btree ("_order");
  CREATE INDEX "cs_settings_sla_resolution_hours_parent_id_idx" ON "cs_settings_sla_resolution_hours" USING btree ("_parent_id");
  CREATE INDEX "cs_settings_anti_spam_blocked_keywords_order_idx" ON "cs_settings_anti_spam_blocked_keywords" USING btree ("_order");
  CREATE INDEX "cs_settings_anti_spam_blocked_keywords_parent_id_idx" ON "cs_settings_anti_spam_blocked_keywords" USING btree ("_parent_id");
  CREATE INDEX "cs_settings_anti_spam_blocked_anon_ids_order_idx" ON "cs_settings_anti_spam_blocked_anon_ids" USING btree ("_order");
  CREATE INDEX "cs_settings_anti_spam_blocked_anon_ids_parent_id_idx" ON "cs_settings_anti_spam_blocked_anon_ids" USING btree ("_parent_id");
  CREATE INDEX "cs_settings_anti_spam_blocked_i_ps_order_idx" ON "cs_settings_anti_spam_blocked_i_ps" USING btree ("_order");
  CREATE INDEX "cs_settings_anti_spam_blocked_i_ps_parent_id_idx" ON "cs_settings_anti_spam_blocked_i_ps" USING btree ("_parent_id");
  CREATE INDEX "cs_settings_default_assignee_idx" ON "cs_settings" USING btree ("default_assignee_id");
  CREATE INDEX "marketing_automation_settings_birthday_config_tier_gifts_order_idx" ON "marketing_automation_settings_birthday_config_tier_gifts" USING btree ("_order");
  CREATE INDEX "marketing_automation_settings_birthday_config_tier_gifts_parent_id_idx" ON "marketing_automation_settings_birthday_config_tier_gifts" USING btree ("_parent_id");
  CREATE INDEX "game_settings_spin_wheel_prizes_order_idx" ON "game_settings_spin_wheel_prizes" USING btree ("_order");
  CREATE INDEX "game_settings_spin_wheel_prizes_parent_id_idx" ON "game_settings_spin_wheel_prizes" USING btree ("_parent_id");
  CREATE INDEX "game_settings_scratch_card_prizes_order_idx" ON "game_settings_scratch_card_prizes" USING btree ("_order");
  CREATE INDEX "game_settings_scratch_card_prizes_parent_id_idx" ON "game_settings_scratch_card_prizes" USING btree ("_parent_id");
  CREATE INDEX "navigation_settings_main_menu_children_order_idx" ON "navigation_settings_main_menu_children" USING btree ("_order");
  CREATE INDEX "navigation_settings_main_menu_children_parent_id_idx" ON "navigation_settings_main_menu_children" USING btree ("_parent_id");
  CREATE INDEX "navigation_settings_main_menu_order_idx" ON "navigation_settings_main_menu" USING btree ("_order");
  CREATE INDEX "navigation_settings_main_menu_parent_id_idx" ON "navigation_settings_main_menu" USING btree ("_parent_id");
  CREATE INDEX "navigation_settings_footer_sections_links_order_idx" ON "navigation_settings_footer_sections_links" USING btree ("_order");
  CREATE INDEX "navigation_settings_footer_sections_links_parent_id_idx" ON "navigation_settings_footer_sections_links" USING btree ("_parent_id");
  CREATE INDEX "navigation_settings_footer_sections_order_idx" ON "navigation_settings_footer_sections" USING btree ("_order");
  CREATE INDEX "navigation_settings_footer_sections_parent_id_idx" ON "navigation_settings_footer_sections" USING btree ("_parent_id");
  CREATE INDEX "homepage_settings_hero_banners_order_idx" ON "homepage_settings_hero_banners" USING btree ("_order");
  CREATE INDEX "homepage_settings_hero_banners_parent_id_idx" ON "homepage_settings_hero_banners" USING btree ("_parent_id");
  CREATE INDEX "homepage_settings_hero_banners_image_idx" ON "homepage_settings_hero_banners" USING btree ("image_id");
  CREATE INDEX "homepage_settings_quick_menu_order_idx" ON "homepage_settings_quick_menu" USING btree ("_order");
  CREATE INDEX "homepage_settings_quick_menu_parent_id_idx" ON "homepage_settings_quick_menu" USING btree ("_parent_id");
  CREATE INDEX "homepage_settings_service_highlights_order_idx" ON "homepage_settings_service_highlights" USING btree ("_order");
  CREATE INDEX "homepage_settings_service_highlights_parent_id_idx" ON "homepage_settings_service_highlights" USING btree ("_parent_id");
  CREATE INDEX "homepage_settings_style_journal_section_manual_posts_order_idx" ON "homepage_settings_style_journal_section_manual_posts" USING btree ("_order");
  CREATE INDEX "homepage_settings_style_journal_section_manual_posts_parent_id_idx" ON "homepage_settings_style_journal_section_manual_posts" USING btree ("_parent_id");
  CREATE INDEX "homepage_settings_style_journal_section_manual_posts_pos_idx" ON "homepage_settings_style_journal_section_manual_posts" USING btree ("post_id");
  CREATE INDEX "homepage_settings_brand_banner_brand_banner_image_idx" ON "homepage_settings" USING btree ("brand_banner_image_id");
  CREATE INDEX "homepage_settings_seo_seo_og_image_idx" ON "homepage_settings" USING btree ("seo_og_image_id");
  CREATE INDEX "collections_page_settings_cards_collection_tags_filter_order_idx" ON "collections_page_settings_cards_collection_tags_filter" USING btree ("order");
  CREATE INDEX "collections_page_settings_cards_collection_tags_filter_parent_idx" ON "collections_page_settings_cards_collection_tags_filter" USING btree ("parent_id");
  CREATE INDEX "collections_page_settings_cards_order_idx" ON "collections_page_settings_cards" USING btree ("_order");
  CREATE INDEX "collections_page_settings_cards_parent_id_idx" ON "collections_page_settings_cards" USING btree ("_parent_id");
  CREATE INDEX "collections_page_settings_cards_image_idx" ON "collections_page_settings_cards" USING btree ("image_id");
  CREATE INDEX "product_list_settings_page_size_options_order_idx" ON "product_list_settings_page_size_options" USING btree ("_order");
  CREATE INDEX "product_list_settings_page_size_options_parent_id_idx" ON "product_list_settings_page_size_options" USING btree ("_parent_id");
  CREATE INDEX "product_list_settings_banner_banner_image_idx" ON "product_list_settings" USING btree ("banner_image_id");
  CREATE INDEX "about_page_settings_brand_values_order_idx" ON "about_page_settings_brand_values" USING btree ("_order");
  CREATE INDEX "about_page_settings_brand_values_parent_id_idx" ON "about_page_settings_brand_values" USING btree ("_parent_id");
  CREATE INDEX "about_page_settings_timeline_order_idx" ON "about_page_settings_timeline" USING btree ("_order");
  CREATE INDEX "about_page_settings_timeline_parent_id_idx" ON "about_page_settings_timeline" USING btree ("_parent_id");
  CREATE INDEX "about_page_settings_legacy_gallery_images_order_idx" ON "about_page_settings_legacy_gallery_images" USING btree ("_order");
  CREATE INDEX "about_page_settings_legacy_gallery_images_parent_id_idx" ON "about_page_settings_legacy_gallery_images" USING btree ("_parent_id");
  CREATE INDEX "about_page_settings_contact_cta_buttons_order_idx" ON "about_page_settings_contact_cta_buttons" USING btree ("_order");
  CREATE INDEX "about_page_settings_contact_cta_buttons_parent_id_idx" ON "about_page_settings_contact_cta_buttons" USING btree ("_parent_id");
  CREATE INDEX "about_page_settings_hero_hero_image_idx" ON "about_page_settings" USING btree ("hero_image_id");
  CREATE INDEX "about_page_settings_our_vision_our_vision_logo_idx" ON "about_page_settings" USING btree ("our_vision_logo_id");
  CREATE INDEX "faq_page_settings_categories_items_order_idx" ON "faq_page_settings_categories_items" USING btree ("_order");
  CREATE INDEX "faq_page_settings_categories_items_parent_id_idx" ON "faq_page_settings_categories_items" USING btree ("_parent_id");
  CREATE INDEX "faq_page_settings_categories_order_idx" ON "faq_page_settings_categories" USING btree ("_order");
  CREATE INDEX "faq_page_settings_categories_parent_id_idx" ON "faq_page_settings_categories" USING btree ("_parent_id");
  CREATE INDEX "faq_page_settings_hero_hero_image_idx" ON "faq_page_settings" USING btree ("hero_image_id");
  CREATE INDEX "policy_pages_settings_terms_sections_items_order_idx" ON "policy_pages_settings_terms_sections_items" USING btree ("_order");
  CREATE INDEX "policy_pages_settings_terms_sections_items_parent_id_idx" ON "policy_pages_settings_terms_sections_items" USING btree ("_parent_id");
  CREATE INDEX "policy_pages_settings_terms_sections_order_idx" ON "policy_pages_settings_terms_sections" USING btree ("_order");
  CREATE INDEX "policy_pages_settings_terms_sections_parent_id_idx" ON "policy_pages_settings_terms_sections" USING btree ("_parent_id");
  CREATE INDEX "policy_pages_settings_privacy_policy_sections_items_order_idx" ON "policy_pages_settings_privacy_policy_sections_items" USING btree ("_order");
  CREATE INDEX "policy_pages_settings_privacy_policy_sections_items_parent_id_idx" ON "policy_pages_settings_privacy_policy_sections_items" USING btree ("_parent_id");
  CREATE INDEX "policy_pages_settings_privacy_policy_sections_order_idx" ON "policy_pages_settings_privacy_policy_sections" USING btree ("_order");
  CREATE INDEX "policy_pages_settings_privacy_policy_sections_parent_id_idx" ON "policy_pages_settings_privacy_policy_sections" USING btree ("_parent_id");
  CREATE INDEX "policy_pages_settings_return_policy_sections_items_order_idx" ON "policy_pages_settings_return_policy_sections_items" USING btree ("_order");
  CREATE INDEX "policy_pages_settings_return_policy_sections_items_parent_id_idx" ON "policy_pages_settings_return_policy_sections_items" USING btree ("_parent_id");
  CREATE INDEX "policy_pages_settings_return_policy_sections_order_idx" ON "policy_pages_settings_return_policy_sections" USING btree ("_order");
  CREATE INDEX "policy_pages_settings_return_policy_sections_parent_id_idx" ON "policy_pages_settings_return_policy_sections" USING btree ("_parent_id");
  CREATE INDEX "policy_pages_settings_shopping_guide_sections_items_order_idx" ON "policy_pages_settings_shopping_guide_sections_items" USING btree ("_order");
  CREATE INDEX "policy_pages_settings_shopping_guide_sections_items_parent_id_idx" ON "policy_pages_settings_shopping_guide_sections_items" USING btree ("_parent_id");
  CREATE INDEX "policy_pages_settings_shopping_guide_sections_order_idx" ON "policy_pages_settings_shopping_guide_sections" USING btree ("_order");
  CREATE INDEX "policy_pages_settings_shopping_guide_sections_parent_id_idx" ON "policy_pages_settings_shopping_guide_sections" USING btree ("_parent_id");
  CREATE INDEX "policy_pages_settings_account_returns_notice_items_order_idx" ON "policy_pages_settings_account_returns_notice_items" USING btree ("_order");
  CREATE INDEX "policy_pages_settings_account_returns_notice_items_parent_id_idx" ON "policy_pages_settings_account_returns_notice_items" USING btree ("_parent_id");
  CREATE INDEX "packaging_page_settings_features_items_order_idx" ON "packaging_page_settings_features_items" USING btree ("_order");
  CREATE INDEX "packaging_page_settings_features_items_parent_id_idx" ON "packaging_page_settings_features_items" USING btree ("_parent_id");
  CREATE INDEX "packaging_page_settings_process_steps_order_idx" ON "packaging_page_settings_process_steps" USING btree ("_order");
  CREATE INDEX "packaging_page_settings_process_steps_parent_id_idx" ON "packaging_page_settings_process_steps" USING btree ("_parent_id");
  CREATE INDEX "global_settings_payment_enabled_methods_order_idx" ON "global_settings_payment_enabled_methods" USING btree ("order");
  CREATE INDEX "global_settings_payment_enabled_methods_parent_idx" ON "global_settings_payment_enabled_methods" USING btree ("parent_id");
  CREATE INDEX "global_settings_ai_seo_faq_for_ai_order_idx" ON "global_settings_ai_seo_faq_for_ai" USING btree ("_order");
  CREATE INDEX "global_settings_ai_seo_faq_for_ai_parent_id_idx" ON "global_settings_ai_seo_faq_for_ai" USING btree ("_parent_id");
  CREATE INDEX "global_settings_app_links_features_order_idx" ON "global_settings_app_links_features" USING btree ("_order");
  CREATE INDEX "global_settings_app_links_features_parent_id_idx" ON "global_settings_app_links_features" USING btree ("_parent_id");
  CREATE INDEX "global_settings_site_site_logo_idx" ON "global_settings" USING btree ("site_logo_id");
  CREATE INDEX "global_settings_site_site_favicon_idx" ON "global_settings" USING btree ("site_favicon_id");
  CREATE INDEX "global_settings_site_site_apple_touch_icon_idx" ON "global_settings" USING btree ("site_apple_touch_icon_id");
  CREATE INDEX "global_settings_site_site_og_image_idx" ON "global_settings" USING btree ("site_og_image_id");
  CREATE INDEX "global_settings_app_links_app_links_qr_code_image_idx" ON "global_settings" USING btree ("app_links_qr_code_image_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "blog_posts_article_studio_research_sources" CASCADE;
  DROP TABLE "blog_posts_tags" CASCADE;
  DROP TABLE "blog_posts" CASCADE;
  DROP TABLE "blog_posts_rels" CASCADE;
  DROP TABLE "blog_categories" CASCADE;
  DROP TABLE "orders_items" CASCADE;
  DROP TABLE "orders_gifts" CASCADE;
  DROP TABLE "orders" CASCADE;
  DROP TABLE "invoices_invoice_items" CASCADE;
  DROP TABLE "invoices" CASCADE;
  DROP TABLE "returns_items" CASCADE;
  DROP TABLE "returns_photos" CASCADE;
  DROP TABLE "returns" CASCADE;
  DROP TABLE "exchanges_items" CASCADE;
  DROP TABLE "exchanges" CASCADE;
  DROP TABLE "refunds_items" CASCADE;
  DROP TABLE "refunds" CASCADE;
  DROP TABLE "shipping_methods_regions" CASCADE;
  DROP TABLE "shipping_methods_tracking_flow" CASCADE;
  DROP TABLE "shipping_methods" CASCADE;
  DROP TABLE "products_alias_slugs" CASCADE;
  DROP TABLE "products_tags" CASCADE;
  DROP TABLE "products_collection_tags" CASCADE;
  DROP TABLE "products_images" CASCADE;
  DROP TABLE "products_variants" CASCADE;
  DROP TABLE "products_material_images" CASCADE;
  DROP TABLE "products_personality_types" CASCADE;
  DROP TABLE "products" CASCADE;
  DROP TABLE "products_rels" CASCADE;
  DROP TABLE "categories" CASCADE;
  DROP TABLE "size_charts_measurements" CASCADE;
  DROP TABLE "size_charts_rows_values" CASCADE;
  DROP TABLE "size_charts_rows" CASCADE;
  DROP TABLE "size_charts" CASCADE;
  DROP TABLE "product_reviews_photos" CASCADE;
  DROP TABLE "product_reviews" CASCADE;
  DROP TABLE "inventory_transactions" CASCADE;
  DROP TABLE "purchase_orders_items" CASCADE;
  DROP TABLE "purchase_orders" CASCADE;
  DROP TABLE "stock_takes_items" CASCADE;
  DROP TABLE "stock_takes" CASCADE;
  DROP TABLE "users_invoice_profiles" CASCADE;
  DROP TABLE "users_tags" CASCADE;
  DROP TABLE "users_addresses" CASCADE;
  DROP TABLE "users_game_activity_recent_games" CASCADE;
  DROP TABLE "users_ai_dm_preferences_dm_history" CASCADE;
  DROP TABLE "users_notification_preferences_channels" CASCADE;
  DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "users_rels" CASCADE;
  DROP TABLE "membership_tiers" CASCADE;
  DROP TABLE "member_segments_history" CASCADE;
  DROP TABLE "member_segments_auto_tags" CASCADE;
  DROP TABLE "member_segments" CASCADE;
  DROP TABLE "subscription_plans_dopamine_streak_milestones" CASCADE;
  DROP TABLE "subscription_plans_feature_list" CASCADE;
  DROP TABLE "subscription_plans" CASCADE;
  DROP TABLE "user_subscriptions_auth_log" CASCADE;
  DROP TABLE "user_subscriptions" CASCADE;
  DROP TABLE "points_transactions" CASCADE;
  DROP TABLE "points_redemptions_lottery_config_prizes" CASCADE;
  DROP TABLE "points_redemptions" CASCADE;
  DROP TABLE "user_rewards" CASCADE;
  DROP TABLE "credit_score_history" CASCADE;
  DROP TABLE "wallet_transactions" CASCADE;
  DROP TABLE "wallet_withdrawals" CASCADE;
  DROP TABLE "wishlist_items" CASCADE;
  DROP TABLE "conversations" CASCADE;
  DROP TABLE "conversations_rels" CASCADE;
  DROP TABLE "messages_attachments" CASCADE;
  DROP TABLE "messages" CASCADE;
  DROP TABLE "message_tags" CASCADE;
  DROP TABLE "conversation_activities" CASCADE;
  DROP TABLE "product_view_events" CASCADE;
  DROP TABLE "behavior_events" CASCADE;
  DROP TABLE "coupons" CASCADE;
  DROP TABLE "coupons_rels" CASCADE;
  DROP TABLE "coupon_redemptions" CASCADE;
  DROP TABLE "add_on_products" CASCADE;
  DROP TABLE "add_on_products_rels" CASCADE;
  DROP TABLE "gift_rules" CASCADE;
  DROP TABLE "gift_rules_rels" CASCADE;
  DROP TABLE "bundles_items" CASCADE;
  DROP TABLE "bundles" CASCADE;
  DROP TABLE "marketing_campaigns_target_segments" CASCADE;
  DROP TABLE "marketing_campaigns_tier_filter" CASCADE;
  DROP TABLE "marketing_campaigns_channels" CASCADE;
  DROP TABLE "marketing_campaigns_message_templates" CASCADE;
  DROP TABLE "marketing_campaigns_ab_test_config_split_ratio" CASCADE;
  DROP TABLE "marketing_campaigns_commerce_surfaces" CASCADE;
  DROP TABLE "marketing_campaigns" CASCADE;
  DROP TABLE "promotion_rules_scope_include_tags" CASCADE;
  DROP TABLE "promotion_rules_scope_exclude_tags" CASCADE;
  DROP TABLE "promotion_rules_conditions_segments_not_in" CASCADE;
  DROP TABLE "promotion_rules_conditions_channels" CASCADE;
  DROP TABLE "promotion_rules_stacking_stackable_with" CASCADE;
  DROP TABLE "promotion_rules" CASCADE;
  DROP TABLE "promotion_rules_rels" CASCADE;
  DROP TABLE "promotion_applications" CASCADE;
  DROP TABLE "festival_templates_phases_channels" CASCADE;
  DROP TABLE "festival_templates_phases" CASCADE;
  DROP TABLE "festival_templates_segment_offers" CASCADE;
  DROP TABLE "festival_templates_ab_test_variants" CASCADE;
  DROP TABLE "festival_templates_linked_journeys" CASCADE;
  DROP TABLE "festival_templates" CASCADE;
  DROP TABLE "birthday_campaigns_phases_phase1_channels" CASCADE;
  DROP TABLE "birthday_campaigns_phases_phase2_channels" CASCADE;
  DROP TABLE "birthday_campaigns_phases_phase3_channels" CASCADE;
  DROP TABLE "birthday_campaigns_phases_phase3_recommended_products" CASCADE;
  DROP TABLE "birthday_campaigns_phases_phase4_channels" CASCADE;
  DROP TABLE "birthday_campaigns_phases_phase5_channels" CASCADE;
  DROP TABLE "birthday_campaigns" CASCADE;
  DROP TABLE "automation_journeys_steps" CASCADE;
  DROP TABLE "automation_journeys" CASCADE;
  DROP TABLE "automation_logs" CASCADE;
  DROP TABLE "ab_tests_variants" CASCADE;
  DROP TABLE "ab_tests" CASCADE;
  DROP TABLE "marketing_execution_logs" CASCADE;
  DROP TABLE "message_templates_variables" CASCADE;
  DROP TABLE "message_templates_segment_variants" CASCADE;
  DROP TABLE "message_templates_credit_score_variants" CASCADE;
  DROP TABLE "message_templates_tier_variants" CASCADE;
  DROP TABLE "message_templates_tags" CASCADE;
  DROP TABLE "message_templates" CASCADE;
  DROP TABLE "email_templates" CASCADE;
  DROP TABLE "newsletter_subscribers" CASCADE;
  DROP TABLE "utm_campaigns" CASCADE;
  DROP TABLE "ad_audiences" CASCADE;
  DROP TABLE "ad_audiences_rels" CASCADE;
  DROP TABLE "search_console_keywords" CASCADE;
  DROP TABLE "competitor_price_records_flags" CASCADE;
  DROP TABLE "competitor_price_records" CASCADE;
  DROP TABLE "marketing_content_drafts_channels" CASCADE;
  DROP TABLE "marketing_content_drafts" CASCADE;
  DROP TABLE "customer_service_tickets_messages" CASCADE;
  DROP TABLE "customer_service_tickets" CASCADE;
  DROP TABLE "concierge_service_requests_request_detail_attachments" CASCADE;
  DROP TABLE "concierge_service_requests_concierge_notes" CASCADE;
  DROP TABLE "concierge_service_requests" CASCADE;
  DROP TABLE "affiliates_withdrawal_requests" CASCADE;
  DROP TABLE "affiliates" CASCADE;
  DROP TABLE "ugc_posts_media_items" CASCADE;
  DROP TABLE "ugc_posts_display_locations" CASCADE;
  DROP TABLE "ugc_posts_hashtags" CASCADE;
  DROP TABLE "ugc_posts" CASCADE;
  DROP TABLE "ugc_posts_rels" CASCADE;
  DROP TABLE "prize_pools_eligible_games" CASCADE;
  DROP TABLE "prize_pools" CASCADE;
  DROP TABLE "mini_game_records" CASCADE;
  DROP TABLE "card_battles" CASCADE;
  DROP TABLE "game_leaderboard_badges" CASCADE;
  DROP TABLE "game_leaderboard" CASCADE;
  DROP TABLE "collectible_card_templates" CASCADE;
  DROP TABLE "collectible_cards" CASCADE;
  DROP TABLE "collectible_card_events" CASCADE;
  DROP TABLE "style_submissions_images" CASCADE;
  DROP TABLE "style_submissions_tags" CASCADE;
  DROP TABLE "style_submissions" CASCADE;
  DROP TABLE "style_game_rooms_participants" CASCADE;
  DROP TABLE "style_game_rooms" CASCADE;
  DROP TABLE "style_votes" CASCADE;
  DROP TABLE "style_wishes_reference_photos" CASCADE;
  DROP TABLE "style_wishes_grants" CASCADE;
  DROP TABLE "style_wishes" CASCADE;
  DROP TABLE "daily_horoscopes" CASCADE;
  DROP TABLE "pages_blocks_hero_banner" CASCADE;
  DROP TABLE "pages_blocks_magazine_cover_corner_labels" CASCADE;
  DROP TABLE "pages_blocks_magazine_cover" CASCADE;
  DROP TABLE "pages_blocks_pull_quote" CASCADE;
  DROP TABLE "pages_blocks_editorial_spread_rows" CASCADE;
  DROP TABLE "pages_blocks_editorial_spread" CASCADE;
  DROP TABLE "pages_blocks_lookbook_grid_items_tags" CASCADE;
  DROP TABLE "pages_blocks_lookbook_grid_items" CASCADE;
  DROP TABLE "pages_blocks_lookbook_grid" CASCADE;
  DROP TABLE "pages_blocks_celebrity_grid" CASCADE;
  DROP TABLE "pages_blocks_kol_persona_social_links" CASCADE;
  DROP TABLE "pages_blocks_kol_persona" CASCADE;
  DROP TABLE "pages_blocks_rich_content" CASCADE;
  DROP TABLE "pages_blocks_image_gallery_images" CASCADE;
  DROP TABLE "pages_blocks_image_gallery" CASCADE;
  DROP TABLE "pages_blocks_product_showcase" CASCADE;
  DROP TABLE "pages_blocks_cta" CASCADE;
  DROP TABLE "pages_blocks_faq_questions" CASCADE;
  DROP TABLE "pages_blocks_faq" CASCADE;
  DROP TABLE "pages_blocks_testimonial_testimonials" CASCADE;
  DROP TABLE "pages_blocks_testimonial" CASCADE;
  DROP TABLE "pages_blocks_countdown" CASCADE;
  DROP TABLE "pages_blocks_video" CASCADE;
  DROP TABLE "pages_blocks_divider" CASCADE;
  DROP TABLE "pages" CASCADE;
  DROP TABLE "pages_rels" CASCADE;
  DROP TABLE "celebrity_features_gallery_images" CASCADE;
  DROP TABLE "celebrity_features_social_links" CASCADE;
  DROP TABLE "celebrity_features" CASCADE;
  DROP TABLE "podcasts_tags" CASCADE;
  DROP TABLE "podcasts_sources" CASCADE;
  DROP TABLE "podcasts_hosts" CASCADE;
  DROP TABLE "podcasts" CASCADE;
  DROP TABLE "podcasts_rels" CASCADE;
  DROP TABLE "site_themes" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "login_attempts" CASCADE;
  DROP TABLE "currencies" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_folders_folder_type" CASCADE;
  DROP TABLE "payload_folders" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "checkout_settings" CASCADE;
  DROP TABLE "order_settings_notifications_admin_alert_emails" CASCADE;
  DROP TABLE "order_settings_status_flow_custom_statuses" CASCADE;
  DROP TABLE "order_settings" CASCADE;
  DROP TABLE "invoice_settings_automation_config_notify_channels" CASCADE;
  DROP TABLE "invoice_settings" CASCADE;
  DROP TABLE "tax_settings_tax_categories" CASCADE;
  DROP TABLE "tax_settings" CASCADE;
  DROP TABLE "loyalty_settings_recommendation_config_placements" CASCADE;
  DROP TABLE "loyalty_settings" CASCADE;
  DROP TABLE "referral_settings" CASCADE;
  DROP TABLE "point_redemption_settings_expiry_notification_reminder_days" CASCADE;
  DROP TABLE "point_redemption_settings_boost_events" CASCADE;
  DROP TABLE "point_redemption_settings_ugc_testimonials_items" CASCADE;
  DROP TABLE "point_redemption_settings" CASCADE;
  DROP TABLE "point_redemption_settings_rels" CASCADE;
  DROP TABLE "crm_settings" CASCADE;
  DROP TABLE "segmentation_settings_segment_colors" CASCADE;
  DROP TABLE "segmentation_settings" CASCADE;
  DROP TABLE "cs_settings_business_hours_schedule" CASCADE;
  DROP TABLE "cs_settings_business_hours_holidays" CASCADE;
  DROP TABLE "cs_settings_sla_first_response_minutes" CASCADE;
  DROP TABLE "cs_settings_sla_resolution_hours" CASCADE;
  DROP TABLE "cs_settings_anti_spam_blocked_keywords" CASCADE;
  DROP TABLE "cs_settings_anti_spam_blocked_anon_ids" CASCADE;
  DROP TABLE "cs_settings_anti_spam_blocked_i_ps" CASCADE;
  DROP TABLE "cs_settings" CASCADE;
  DROP TABLE "promotion_settings" CASCADE;
  DROP TABLE "marketing_automation_settings_birthday_config_tier_gifts" CASCADE;
  DROP TABLE "marketing_automation_settings" CASCADE;
  DROP TABLE "recommendation_settings" CASCADE;
  DROP TABLE "ads_catalog_settings" CASCADE;
  DROP TABLE "game_settings_spin_wheel_prizes" CASCADE;
  DROP TABLE "game_settings_scratch_card_prizes" CASCADE;
  DROP TABLE "game_settings" CASCADE;
  DROP TABLE "navigation_settings_main_menu_children" CASCADE;
  DROP TABLE "navigation_settings_main_menu" CASCADE;
  DROP TABLE "navigation_settings_footer_sections_links" CASCADE;
  DROP TABLE "navigation_settings_footer_sections" CASCADE;
  DROP TABLE "navigation_settings" CASCADE;
  DROP TABLE "homepage_settings_hero_banners" CASCADE;
  DROP TABLE "homepage_settings_quick_menu" CASCADE;
  DROP TABLE "homepage_settings_service_highlights" CASCADE;
  DROP TABLE "homepage_settings_style_journal_section_manual_posts" CASCADE;
  DROP TABLE "homepage_settings" CASCADE;
  DROP TABLE "collections_page_settings_cards_collection_tags_filter" CASCADE;
  DROP TABLE "collections_page_settings_cards" CASCADE;
  DROP TABLE "collections_page_settings" CASCADE;
  DROP TABLE "product_list_settings_page_size_options" CASCADE;
  DROP TABLE "product_list_settings" CASCADE;
  DROP TABLE "about_page_settings_brand_values" CASCADE;
  DROP TABLE "about_page_settings_timeline" CASCADE;
  DROP TABLE "about_page_settings_legacy_gallery_images" CASCADE;
  DROP TABLE "about_page_settings_contact_cta_buttons" CASCADE;
  DROP TABLE "about_page_settings" CASCADE;
  DROP TABLE "faq_page_settings_categories_items" CASCADE;
  DROP TABLE "faq_page_settings_categories" CASCADE;
  DROP TABLE "faq_page_settings" CASCADE;
  DROP TABLE "policy_pages_settings_terms_sections_items" CASCADE;
  DROP TABLE "policy_pages_settings_terms_sections" CASCADE;
  DROP TABLE "policy_pages_settings_privacy_policy_sections_items" CASCADE;
  DROP TABLE "policy_pages_settings_privacy_policy_sections" CASCADE;
  DROP TABLE "policy_pages_settings_return_policy_sections_items" CASCADE;
  DROP TABLE "policy_pages_settings_return_policy_sections" CASCADE;
  DROP TABLE "policy_pages_settings_shopping_guide_sections_items" CASCADE;
  DROP TABLE "policy_pages_settings_shopping_guide_sections" CASCADE;
  DROP TABLE "policy_pages_settings_account_returns_notice_items" CASCADE;
  DROP TABLE "policy_pages_settings" CASCADE;
  DROP TABLE "packaging_page_settings_features_items" CASCADE;
  DROP TABLE "packaging_page_settings_process_steps" CASCADE;
  DROP TABLE "packaging_page_settings" CASCADE;
  DROP TABLE "global_settings_payment_enabled_methods" CASCADE;
  DROP TABLE "global_settings_ai_seo_faq_for_ai" CASCADE;
  DROP TABLE "global_settings_app_links_features" CASCADE;
  DROP TABLE "global_settings" CASCADE;
  DROP TABLE "pricing_formula_settings" CASCADE;
  DROP TYPE "public"."mkt_fest_channels";
  DROP TYPE "public"."enum_blog_posts_article_studio_research_sources_provider";
  DROP TYPE "public"."enum_blog_posts_category";
  DROP TYPE "public"."enum_blog_posts_status";
  DROP TYPE "public"."enum_blog_posts_visibility";
  DROP TYPE "public"."enum_blog_posts_article_studio_template_key";
  DROP TYPE "public"."enum_blog_categories_site";
  DROP TYPE "public"."enum_blog_categories_value";
  DROP TYPE "public"."enum_orders_status";
  DROP TYPE "public"."enum_orders_payment_method";
  DROP TYPE "public"."enum_orders_payment_status";
  DROP TYPE "public"."enum_orders_affiliate_info_commission_status";
  DROP TYPE "public"."enum_invoices_invoice_items_item_tax_type";
  DROP TYPE "public"."enum_invoices_invoice_type";
  DROP TYPE "public"."enum_invoices_status";
  DROP TYPE "public"."enum_invoices_carrier_info_carrier_type";
  DROP TYPE "public"."enum_invoices_tax_type";
  DROP TYPE "public"."enum_returns_items_reason";
  DROP TYPE "public"."enum_returns_status";
  DROP TYPE "public"."enum_returns_refund_method";
  DROP TYPE "public"."enum_exchanges_items_reason";
  DROP TYPE "public"."enum_exchanges_status";
  DROP TYPE "public"."enum_refunds_type";
  DROP TYPE "public"."enum_refunds_reason";
  DROP TYPE "public"."enum_refunds_refund_method";
  DROP TYPE "public"."enum_refunds_status";
  DROP TYPE "public"."enum_shipping_methods_regions";
  DROP TYPE "public"."enum_shipping_methods_carrier";
  DROP TYPE "public"."enum_products_alias_slugs_source";
  DROP TYPE "public"."enum_products_collection_tags";
  DROP TYPE "public"."enum_products_images_category";
  DROP TYPE "public"."enum_products_personality_types";
  DROP TYPE "public"."enum_products_status";
  DROP TYPE "public"."enum_products_image_migration_status";
  DROP TYPE "public"."enum_products_auto_pricing_cost_currency_code";
  DROP TYPE "public"."enum_products_tax_category";
  DROP TYPE "public"."enum_products_ads_gender";
  DROP TYPE "public"."enum_products_ads_age_group";
  DROP TYPE "public"."enum_products_ads_condition";
  DROP TYPE "public"."enum_categories_level";
  DROP TYPE "public"."enum_size_charts_category";
  DROP TYPE "public"."enum_size_charts_unit";
  DROP TYPE "public"."enum_product_reviews_status";
  DROP TYPE "public"."enum_inventory_transactions_type";
  DROP TYPE "public"."enum_purchase_orders_status";
  DROP TYPE "public"."enum_stock_takes_status";
  DROP TYPE "public"."enum_users_notification_preferences_channels";
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_users_gender";
  DROP TYPE "public"."enum_users_signup_source";
  DROP TYPE "public"."enum_users_credit_status";
  DROP TYPE "public"."enum_users_service_level";
  DROP TYPE "public"."enum_users_body_profile_body_shape";
  DROP TYPE "public"."enum_users_mbti_profile_mbti_type";
  DROP TYPE "public"."enum_users_mbti_profile_primary_occasion";
  DROP TYPE "public"."enum_users_ai_dm_preferences_dm_channel";
  DROP TYPE "public"."enum_member_segments_current_segment";
  DROP TYPE "public"."enum_user_subscriptions_status";
  DROP TYPE "public"."enum_user_subscriptions_billing_cycle";
  DROP TYPE "public"."enum_points_transactions_type";
  DROP TYPE "public"."enum_points_transactions_source";
  DROP TYPE "public"."enum_points_redemptions_type";
  DROP TYPE "public"."enum_points_redemptions_coupon_config_discount_type";
  DROP TYPE "public"."enum_points_redemptions_physical_config_reward_type_override";
  DROP TYPE "public"."enum_user_rewards_reward_type";
  DROP TYPE "public"."enum_user_rewards_state";
  DROP TYPE "public"."enum_credit_score_history_reason";
  DROP TYPE "public"."enum_wallet_transactions_wallet";
  DROP TYPE "public"."enum_wallet_transactions_type";
  DROP TYPE "public"."enum_wallet_transactions_source";
  DROP TYPE "public"."enum_wallet_withdrawals_status";
  DROP TYPE "public"."enum_conversations_channel";
  DROP TYPE "public"."enum_conversations_status";
  DROP TYPE "public"."enum_conversations_priority";
  DROP TYPE "public"."enum_conversations_category";
  DROP TYPE "public"."enum_conversations_sentiment";
  DROP TYPE "public"."enum_messages_attachments_kind";
  DROP TYPE "public"."enum_messages_direction";
  DROP TYPE "public"."enum_messages_sender";
  DROP TYPE "public"."enum_message_tags_color";
  DROP TYPE "public"."enum_conversation_activities_actor_type";
  DROP TYPE "public"."enum_conversation_activities_type";
  DROP TYPE "public"."enum_product_view_events_device_type";
  DROP TYPE "public"."enum_behavior_events_event_type";
  DROP TYPE "public"."enum_behavior_events_device_type";
  DROP TYPE "public"."enum_behavior_events_surface";
  DROP TYPE "public"."enum_coupons_discount_type";
  DROP TYPE "public"."enum_gift_rules_trigger_type";
  DROP TYPE "public"."enum_marketing_campaigns_target_segments";
  DROP TYPE "public"."enum_marketing_campaigns_tier_filter";
  DROP TYPE "public"."enum_marketing_campaigns_channels";
  DROP TYPE "public"."enum_marketing_campaigns_message_templates_channel";
  DROP TYPE "public"."enum_marketing_campaigns_commerce_surfaces";
  DROP TYPE "public"."enum_marketing_campaigns_campaign_type";
  DROP TYPE "public"."enum_marketing_campaigns_status";
  DROP TYPE "public"."enum_marketing_campaigns_ab_test_config_winner_metric";
  DROP TYPE "public"."enum_marketing_campaigns_commerce_objective";
  DROP TYPE "public"."enum_promotion_rules_conditions_segments_not_in";
  DROP TYPE "public"."enum_promotion_rules_conditions_channels";
  DROP TYPE "public"."enum_promotion_rules_stacking_stackable_with";
  DROP TYPE "public"."enum_promotion_rules_status";
  DROP TYPE "public"."enum_promotion_rules_benefit_class";
  DROP TYPE "public"."enum_promotion_rules_effect_effect_type";
  DROP TYPE "public"."enum_promotion_rules_effect_repeat_mode";
  DROP TYPE "public"."enum_promotion_rules_effect_unit_selection";
  DROP TYPE "public"."enum_promotion_applications_source";
  DROP TYPE "public"."enum_promotion_applications_status";
  DROP TYPE "public"."enum_festival_templates_phases_channels";
  DROP TYPE "public"."enum_festival_templates_phases_phase_type";
  DROP TYPE "public"."enum_festival_templates_segment_offers_segment";
  DROP TYPE "public"."enum_festival_templates_segment_offers_discount_type";
  DROP TYPE "public"."enum_festival_templates_festival_type";
  DROP TYPE "public"."enum_festival_templates_ai_recommendation_strategy";
  DROP TYPE "public"."enum_birthday_campaigns_phases_phase1_channels";
  DROP TYPE "public"."enum_birthday_campaigns_phases_phase2_channels";
  DROP TYPE "public"."enum_birthday_campaigns_phases_phase3_channels";
  DROP TYPE "public"."enum_birthday_campaigns_phases_phase4_channels";
  DROP TYPE "public"."enum_birthday_campaigns_phases_phase5_channels";
  DROP TYPE "public"."enum_birthday_campaigns_status";
  DROP TYPE "public"."enum_birthday_campaigns_phases_phase1_status";
  DROP TYPE "public"."enum_birthday_campaigns_phases_phase2_status";
  DROP TYPE "public"."enum_birthday_campaigns_phases_phase3_status";
  DROP TYPE "public"."enum_birthday_campaigns_phases_phase4_status";
  DROP TYPE "public"."enum_birthday_campaigns_phases_phase5_status";
  DROP TYPE "public"."enum_automation_journeys_steps_action";
  DROP TYPE "public"."enum_automation_journeys_trigger_type";
  DROP TYPE "public"."enum_automation_journeys_trigger_event";
  DROP TYPE "public"."enum_automation_logs_status";
  DROP TYPE "public"."enum_ab_tests_status";
  DROP TYPE "public"."enum_ab_tests_winner_metric";
  DROP TYPE "public"."enum_marketing_execution_logs_channel";
  DROP TYPE "public"."enum_marketing_execution_logs_status";
  DROP TYPE "public"."enum_message_templates_variables_variable_type";
  DROP TYPE "public"."enum_message_templates_segment_variants_segment";
  DROP TYPE "public"."enum_message_templates_tier_variants_tier_code";
  DROP TYPE "public"."enum_message_templates_channel";
  DROP TYPE "public"."enum_message_templates_category";
  DROP TYPE "public"."enum_email_templates_event_key";
  DROP TYPE "public"."enum_newsletter_subscribers_status";
  DROP TYPE "public"."enum_newsletter_subscribers_source";
  DROP TYPE "public"."enum_utm_campaigns_source";
  DROP TYPE "public"."enum_utm_campaigns_medium";
  DROP TYPE "public"."enum_utm_campaigns_status";
  DROP TYPE "public"."enum_ad_audiences_type";
  DROP TYPE "public"."enum_ad_audiences_sync_status";
  DROP TYPE "public"."enum_search_console_keywords_source";
  DROP TYPE "public"."enum_search_console_keywords_intent";
  DROP TYPE "public"."enum_search_console_keywords_status";
  DROP TYPE "public"."enum_competitor_price_records_flags";
  DROP TYPE "public"."enum_competitor_price_records_platform";
  DROP TYPE "public"."enum_competitor_price_records_status";
  DROP TYPE "public"."enum_marketing_content_drafts_channels";
  DROP TYPE "public"."enum_marketing_content_drafts_type";
  DROP TYPE "public"."enum_marketing_content_drafts_status";
  DROP TYPE "public"."enum_marketing_content_drafts_target_segment";
  DROP TYPE "public"."enum_customer_service_tickets_messages_sender";
  DROP TYPE "public"."enum_customer_service_tickets_channel";
  DROP TYPE "public"."enum_customer_service_tickets_status";
  DROP TYPE "public"."enum_customer_service_tickets_priority";
  DROP TYPE "public"."enum_customer_service_tickets_category";
  DROP TYPE "public"."enum_customer_service_tickets_sentiment";
  DROP TYPE "public"."enum_concierge_service_requests_concierge_notes_note_type";
  DROP TYPE "public"."enum_concierge_service_requests_service_type";
  DROP TYPE "public"."enum_concierge_service_requests_priority";
  DROP TYPE "public"."enum_concierge_service_requests_status";
  DROP TYPE "public"."enum_affiliates_withdrawal_requests_status";
  DROP TYPE "public"."enum_affiliates_status";
  DROP TYPE "public"."enum_ugc_posts_display_locations";
  DROP TYPE "public"."enum_ugc_posts_platform";
  DROP TYPE "public"."enum_ugc_posts_source_type";
  DROP TYPE "public"."enum_ugc_posts_content_type";
  DROP TYPE "public"."enum_ugc_posts_status";
  DROP TYPE "public"."enum_ugc_posts_display_layout";
  DROP TYPE "public"."enum_prize_pools_eligible_games";
  DROP TYPE "public"."enum_prize_pools_prize_type";
  DROP TYPE "public"."enum_prize_pools_delivery_method";
  DROP TYPE "public"."enum_mini_game_records_game_type";
  DROP TYPE "public"."enum_mini_game_records_result_outcome";
  DROP TYPE "public"."enum_mini_game_records_result_prize_type";
  DROP TYPE "public"."enum_mini_game_records_status";
  DROP TYPE "public"."enum_card_battles_status";
  DROP TYPE "public"."enum_card_battles_challenger_card_suit";
  DROP TYPE "public"."enum_card_battles_opponent_card_suit";
  DROP TYPE "public"."enum_card_battles_result_winner";
  DROP TYPE "public"."enum_card_battles_result_challenger_prize_type";
  DROP TYPE "public"."enum_card_battles_result_opponent_prize_type";
  DROP TYPE "public"."enum_game_leaderboard_badges_badge_type";
  DROP TYPE "public"."enum_game_leaderboard_period";
  DROP TYPE "public"."enum_collectible_cards_card_type";
  DROP TYPE "public"."enum_collectible_cards_status";
  DROP TYPE "public"."enum_collectible_cards_minted_via";
  DROP TYPE "public"."enum_collectible_card_events_action";
  DROP TYPE "public"."enum_style_submissions_game_type";
  DROP TYPE "public"."enum_style_submissions_status";
  DROP TYPE "public"."enum_style_game_rooms_participants_role";
  DROP TYPE "public"."enum_style_game_rooms_participants_status";
  DROP TYPE "public"."enum_style_game_rooms_game_type";
  DROP TYPE "public"."enum_style_game_rooms_visibility";
  DROP TYPE "public"."enum_style_game_rooms_status";
  DROP TYPE "public"."enum_style_votes_vote_type";
  DROP TYPE "public"."enum_style_wishes_status";
  DROP TYPE "public"."enum_daily_horoscopes_zodiac_sign";
  DROP TYPE "public"."enum_daily_horoscopes_gender";
  DROP TYPE "public"."enum_daily_horoscopes_generated_by";
  DROP TYPE "public"."enum_pages_blocks_magazine_cover_layout";
  DROP TYPE "public"."enum_pages_blocks_magazine_cover_theme";
  DROP TYPE "public"."enum_pages_blocks_magazine_cover_object_position";
  DROP TYPE "public"."enum_pages_blocks_pull_quote_font";
  DROP TYPE "public"."enum_pages_blocks_pull_quote_alignment";
  DROP TYPE "public"."enum_pages_blocks_editorial_spread_rows_image_position";
  DROP TYPE "public"."enum_pages_blocks_editorial_spread_rows_background";
  DROP TYPE "public"."enum_pages_blocks_lookbook_grid_columns";
  DROP TYPE "public"."enum_pages_blocks_celebrity_grid_columns";
  DROP TYPE "public"."enum_pages_blocks_kol_persona_social_links_platform";
  DROP TYPE "public"."enum_pages_blocks_image_gallery_layout";
  DROP TYPE "public"."enum_pages_blocks_product_showcase_display_style";
  DROP TYPE "public"."enum_pages_blocks_cta_style";
  DROP TYPE "public"."enum_pages_blocks_divider_style";
  DROP TYPE "public"."enum_pages_status";
  DROP TYPE "public"."enum_celebrity_features_social_links_platform";
  DROP TYPE "public"."enum_celebrity_features_link_type";
  DROP TYPE "public"."enum_celebrity_features_status";
  DROP TYPE "public"."enum_podcasts_category";
  DROP TYPE "public"."enum_podcasts_status";
  DROP TYPE "public"."enum_site_themes_season";
  DROP TYPE "public"."enum_site_themes_serif_font";
  DROP TYPE "public"."enum_site_themes_sans_font";
  DROP TYPE "public"."enum_site_themes_hero_layout";
  DROP TYPE "public"."enum_media_usage_rights_license_kind";
  DROP TYPE "public"."enum_payload_folders_folder_type";
  DROP TYPE "public"."enum_order_settings_home_shipping_temperature";
  DROP TYPE "public"."enum_order_settings_home_shipping_specification";
  DROP TYPE "public"."enum_invoice_settings_automation_config_notify_channels";
  DROP TYPE "public"."enum_invoice_settings_ecpay_config_environment";
  DROP TYPE "public"."enum_invoice_settings_default_config_default_invoice_type";
  DROP TYPE "public"."enum_invoice_settings_default_config_default_tax_type";
  DROP TYPE "public"."enum_tax_settings_invoice_breakdown_rounding_mode";
  DROP TYPE "public"."loy_place_location";
  DROP TYPE "public"."loy_place_strategy";
  DROP TYPE "public"."pts_remind_urgency";
  DROP TYPE "public"."enum_cs_settings_business_hours_schedule_day_of_week";
  DROP TYPE "public"."enum_cs_settings_sla_first_response_minutes_channel";
  DROP TYPE "public"."enum_cs_settings_sla_first_response_minutes_priority";
  DROP TYPE "public"."enum_cs_settings_sla_resolution_hours_priority";
  DROP TYPE "public"."enum_cs_settings_sla_breach_action";
  DROP TYPE "public"."enum_cs_settings_auto_assign_mode";
  DROP TYPE "public"."mkt_bday_tier_code";
  DROP TYPE "public"."mkt_email_provider";
  DROP TYPE "public"."mkt_sms_provider";
  DROP TYPE "public"."mkt_edm_provider";
  DROP TYPE "public"."mkt_win_metric";
  DROP TYPE "public"."rec_bundle_disc_type";
  DROP TYPE "public"."enum_ads_catalog_settings_defaults_default_gender";
  DROP TYPE "public"."enum_ads_catalog_settings_defaults_default_age_group";
  DROP TYPE "public"."enum_ads_catalog_settings_defaults_default_condition";
  DROP TYPE "public"."enum_ads_catalog_settings_defaults_default_locale";
  DROP TYPE "public"."enum_game_settings_spin_wheel_prizes_prize_type";
  DROP TYPE "public"."enum_game_settings_scratch_card_prizes_prize_type";
  DROP TYPE "public"."enum_navigation_settings_announcement_bar_style";
  DROP TYPE "public"."enum_homepage_settings_quick_menu_icon";
  DROP TYPE "public"."enum_homepage_settings_service_highlights_icon";
  DROP TYPE "public"."enum_homepage_settings_hero_layout_override";
  DROP TYPE "public"."enum_homepage_settings_style_journal_section_mode";
  DROP TYPE "public"."enum_collections_page_settings_cards_collection_tags_filter";
  DROP TYPE "public"."enum_collections_page_settings_cards_span";
  DROP TYPE "public"."enum_product_list_settings_default_sort";
  DROP TYPE "public"."enum_about_page_settings_brand_values_icon";
  DROP TYPE "public"."enum_about_page_settings_contact_cta_buttons_style";
  DROP TYPE "public"."enum_faq_page_settings_categories_icon";
  DROP TYPE "public"."enum_packaging_page_settings_features_items_icon";
  DROP TYPE "public"."enum_global_settings_payment_enabled_methods";
  DROP TYPE "public"."enum_global_settings_ai_seo_ai_crawler_policy";
  DROP TYPE "public"."enum_pricing_formula_settings_currency_code";
  DROP TYPE "public"."enum_pricing_formula_settings_profit_mode";`)
}
