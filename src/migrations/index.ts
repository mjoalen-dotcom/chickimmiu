import * as migration_20260415_112142_add_size_charts from './20260415_112142_add_size_charts';
import * as migration_20260416_140000_add_gender_and_male_tier_name from './20260416_140000_add_gender_and_male_tier_name';
import * as migration_20260416_193835_add_daily_checkin_streak from './20260416_193835_add_daily_checkin_streak';
import * as migration_20260417_100000_add_stored_value_balance from './20260417_100000_add_stored_value_balance';
import * as migration_20260418_220000_add_login_attempts from './20260418_220000_add_login_attempts';
import * as migration_20260418_230000_add_body_and_invoice_fields from './20260418_230000_add_body_and_invoice_fields';
import * as migration_20260419_100000_add_email_verification from './20260419_100000_add_email_verification';
import * as migration_20260419_110000_add_media_folder from './20260419_110000_add_media_folder';
import * as migration_20260419_180000_add_cod_fee from './20260419_180000_add_cod_fee';
import * as migration_20260419_200000_add_invoice_profiles from './20260419_200000_add_invoice_profiles';
import * as migration_20260419_210000_add_user_rewards from './20260419_210000_add_user_rewards';
import * as migration_20260419_230000_add_orders_gifts from './20260419_230000_add_orders_gifts';
import * as migration_20260419_235500_add_membership_tier_descriptions from './20260419_235500_add_membership_tier_descriptions';
import * as migration_20260420_100000_add_style_submissions from './20260420_100000_add_style_submissions';
import * as migration_20260420_110000_add_style_game_rooms from './20260420_110000_add_style_game_rooms';
import * as migration_20260420_120000_add_style_votes from './20260420_120000_add_style_votes';
import * as migration_20260420_130000_add_style_wishes from './20260420_130000_add_style_wishes';
import * as migration_20260420_140000_add_global_settings_payment_cod_and_email_auth from './20260420_140000_add_global_settings_payment_cod_and_email_auth';
import * as migration_20260420_200000_add_about_vision_and_gallery from './20260420_200000_add_about_vision_and_gallery';
import * as migration_20260421_100000_add_tax from './20260421_100000_add_tax';
import * as migration_20260421_120000_add_collectible_cards from './20260421_120000_add_collectible_cards';
import * as migration_20260421_200000_add_checkout_order_settings from './20260421_200000_add_checkout_order_settings';
import * as migration_20260422_000000_add_promo_trio from './20260422_000000_add_promo_trio';
import * as migration_20260422_100000_add_coupons from './20260422_100000_add_coupons';
import * as migration_20260422_200000_fix_policy_returns_notice_title from './20260422_200000_fix_policy_returns_notice_title';
import * as migration_20260426_120000_add_daily_horoscopes from './20260426_120000_add_daily_horoscopes';
import * as migration_20260426_130000_add_users_birth_time from './20260426_130000_add_users_birth_time';
import * as migration_20260426_140000_add_points_mall_shipping from './20260426_140000_add_points_mall_shipping';
import * as migration_20260427_100000_add_site_themes from './20260427_100000_add_site_themes';
import * as migration_20260427_180000_enable_payload_folders from './20260427_180000_enable_payload_folders';

export const migrations = [
  {
    up: migration_20260415_112142_add_size_charts.up,
    down: migration_20260415_112142_add_size_charts.down,
    name: '20260415_112142_add_size_charts',
  },
  {
    up: migration_20260416_140000_add_gender_and_male_tier_name.up,
    down: migration_20260416_140000_add_gender_and_male_tier_name.down,
    name: '20260416_140000_add_gender_and_male_tier_name',
  },
  {
    up: migration_20260416_193835_add_daily_checkin_streak.up,
    down: migration_20260416_193835_add_daily_checkin_streak.down,
    name: '20260416_193835_add_daily_checkin_streak',
  },
  {
    up: migration_20260417_100000_add_stored_value_balance.up,
    down: migration_20260417_100000_add_stored_value_balance.down,
    name: '20260417_100000_add_stored_value_balance',
  },
  {
    up: migration_20260418_220000_add_login_attempts.up,
    down: migration_20260418_220000_add_login_attempts.down,
    name: '20260418_220000_add_login_attempts',
  },
  {
    up: migration_20260418_230000_add_body_and_invoice_fields.up,
    down: migration_20260418_230000_add_body_and_invoice_fields.down,
    name: '20260418_230000_add_body_and_invoice_fields',
  },
  {
    up: migration_20260419_100000_add_email_verification.up,
    down: migration_20260419_100000_add_email_verification.down,
    name: '20260419_100000_add_email_verification',
  },
  {
    up: migration_20260419_110000_add_media_folder.up,
    down: migration_20260419_110000_add_media_folder.down,
    name: '20260419_110000_add_media_folder',
  },
  {
    up: migration_20260419_180000_add_cod_fee.up,
    down: migration_20260419_180000_add_cod_fee.down,
    name: '20260419_180000_add_cod_fee',
  },
  {
    up: migration_20260419_200000_add_invoice_profiles.up,
    down: migration_20260419_200000_add_invoice_profiles.down,
    name: '20260419_200000_add_invoice_profiles',
  },
  {
    up: migration_20260419_210000_add_user_rewards.up,
    down: migration_20260419_210000_add_user_rewards.down,
    name: '20260419_210000_add_user_rewards',
  },
  {
    up: migration_20260419_230000_add_orders_gifts.up,
    down: migration_20260419_230000_add_orders_gifts.down,
    name: '20260419_230000_add_orders_gifts',
  },
  {
    up: migration_20260419_235500_add_membership_tier_descriptions.up,
    down: migration_20260419_235500_add_membership_tier_descriptions.down,
    name: '20260419_235500_add_membership_tier_descriptions',
  },
  {
    up: migration_20260420_100000_add_style_submissions.up,
    down: migration_20260420_100000_add_style_submissions.down,
    name: '20260420_100000_add_style_submissions',
  },
  {
    up: migration_20260420_110000_add_style_game_rooms.up,
    down: migration_20260420_110000_add_style_game_rooms.down,
    name: '20260420_110000_add_style_game_rooms',
  },
  {
    up: migration_20260420_120000_add_style_votes.up,
    down: migration_20260420_120000_add_style_votes.down,
    name: '20260420_120000_add_style_votes',
  },
  {
    up: migration_20260420_130000_add_style_wishes.up,
    down: migration_20260420_130000_add_style_wishes.down,
    name: '20260420_130000_add_style_wishes',
  },
  {
    up: migration_20260420_140000_add_global_settings_payment_cod_and_email_auth.up,
    down: migration_20260420_140000_add_global_settings_payment_cod_and_email_auth.down,
    name: '20260420_140000_add_global_settings_payment_cod_and_email_auth',
  },
  {
    up: migration_20260420_200000_add_about_vision_and_gallery.up,
    down: migration_20260420_200000_add_about_vision_and_gallery.down,
    name: '20260420_200000_add_about_vision_and_gallery',
  },
  {
    up: migration_20260421_100000_add_tax.up,
    down: migration_20260421_100000_add_tax.down,
    name: '20260421_100000_add_tax',
  },
  {
    up: migration_20260421_120000_add_collectible_cards.up,
    down: migration_20260421_120000_add_collectible_cards.down,
    name: '20260421_120000_add_collectible_cards',
  },
  {
    up: migration_20260421_200000_add_checkout_order_settings.up,
    down: migration_20260421_200000_add_checkout_order_settings.down,
    name: '20260421_200000_add_checkout_order_settings',
  },
  {
    up: migration_20260422_000000_add_promo_trio.up,
    down: migration_20260422_000000_add_promo_trio.down,
    name: '20260422_000000_add_promo_trio',
  },
  {
    up: migration_20260422_100000_add_coupons.up,
    down: migration_20260422_100000_add_coupons.down,
    name: '20260422_100000_add_coupons',
  },
  {
    up: migration_20260422_200000_fix_policy_returns_notice_title.up,
    down: migration_20260422_200000_fix_policy_returns_notice_title.down,
    name: '20260422_200000_fix_policy_returns_notice_title',
  },
  {
    up: migration_20260426_120000_add_daily_horoscopes.up,
    down: migration_20260426_120000_add_daily_horoscopes.down,
    name: '20260426_120000_add_daily_horoscopes',
  },
  {
    up: migration_20260426_130000_add_users_birth_time.up,
    down: migration_20260426_130000_add_users_birth_time.down,
    name: '20260426_130000_add_users_birth_time',
  },
  {
    up: migration_20260426_140000_add_points_mall_shipping.up,
    down: migration_20260426_140000_add_points_mall_shipping.down,
    name: '20260426_140000_add_points_mall_shipping',
  },
  {
    up: migration_20260427_100000_add_site_themes.up,
    down: migration_20260427_100000_add_site_themes.down,
    name: '20260427_100000_add_site_themes'
  },
  {
    up: migration_20260427_180000_enable_payload_folders.up,
    down: migration_20260427_180000_enable_payload_folders.down,
    name: '20260427_180000_enable_payload_folders',
  },
];
