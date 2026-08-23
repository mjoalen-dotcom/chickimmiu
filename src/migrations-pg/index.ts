import * as migration_20260816_023522_pg_baseline from './20260816_023522_pg_baseline';
import * as migration_20260817_035151_p0b_rule_conditions from './20260817_035151_p0b_rule_conditions';
import * as migration_20260817_042534_p0b_reward_type from './20260817_042534_p0b_reward_type';
import * as migration_20260817_044059_cost_snapshot from './20260817_044059_cost_snapshot';
import * as migration_20260817_051044_p0c_campaign_governance from './20260817_051044_p0c_campaign_governance';
import * as migration_20260817_060801_social_wall_saas from './20260817_060801_social_wall_saas';
import * as migration_20260817_170000_p0b_drop_enums from './20260817_170000_p0b_drop_enums';
import * as migration_20260817_170500_p0b_drop_schema from './20260817_170500_p0b_drop_schema';
import * as migration_20260821_010000_add_ops_actions from './20260821_010000_add_ops_actions';
import * as migration_20260821_150000_add_customer_nickname from './20260821_150000_add_customer_nickname';
import * as migration_20260821_170000_users_customers_cutover from './20260821_170000_users_customers_cutover';
import * as migration_20260822_150000_add_notifications from './20260822_150000_add_notifications';
import * as migration_20260823_120000_add_cover_page_settings from './20260823_120000_add_cover_page_settings';
import * as migration_20260823_140000_add_cover_wall_sections from './20260823_140000_add_cover_wall_sections';
import * as migration_20260823_180000_add_cover_section_heading from './20260823_180000_add_cover_section_heading';
import * as migration_20260824_100000_add_cover_grid3 from './20260824_100000_add_cover_grid3';
import * as migration_20260824_120000_add_card_style from './20260824_120000_add_card_style';
import * as migration_20260824_150000_add_cover_links from './20260824_150000_add_cover_links';
import * as migration_20260824_170000_add_is_collection from './20260824_170000_add_is_collection';
import * as migration_20260824_190000_add_catalog_push_controls from './20260824_190000_add_catalog_push_controls';

export const migrations = [
  {
    up: migration_20260816_023522_pg_baseline.up,
    down: migration_20260816_023522_pg_baseline.down,
    name: '20260816_023522_pg_baseline',
  },
  {
    up: migration_20260817_035151_p0b_rule_conditions.up,
    down: migration_20260817_035151_p0b_rule_conditions.down,
    name: '20260817_035151_p0b_rule_conditions',
  },
  {
    up: migration_20260817_042534_p0b_reward_type.up,
    down: migration_20260817_042534_p0b_reward_type.down,
    name: '20260817_042534_p0b_reward_type',
  },
  {
    up: migration_20260817_044059_cost_snapshot.up,
    down: migration_20260817_044059_cost_snapshot.down,
    name: '20260817_044059_cost_snapshot',
  },
  {
    up: migration_20260817_051044_p0c_campaign_governance.up,
    down: migration_20260817_051044_p0c_campaign_governance.down,
    name: '20260817_051044_p0c_campaign_governance',
  },
  {
    up: migration_20260817_060801_social_wall_saas.up,
    down: migration_20260817_060801_social_wall_saas.down,
    name: '20260817_060801_social_wall_saas',
  },
  // ⚠️ 順序不可對調：ADD VALUE 必須先單獨 commit，新值才能被下一支使用。
  {
    up: migration_20260817_170000_p0b_drop_enums.up,
    down: migration_20260817_170000_p0b_drop_enums.down,
    name: '20260817_170000_p0b_drop_enums',
  },
  {
    up: migration_20260817_170500_p0b_drop_schema.up,
    down: migration_20260817_170500_p0b_drop_schema.down,
    name: '20260817_170500_p0b_drop_schema',
  },
  {
    up: migration_20260821_010000_add_ops_actions.up,
    down: migration_20260821_010000_add_ops_actions.down,
    name: '20260821_010000_add_ops_actions',
  },
  {
    up: migration_20260821_150000_add_customer_nickname.up,
    down: migration_20260821_150000_add_customer_nickname.down,
    name: '20260821_150000_add_customer_nickname',
  },
  {
    up: migration_20260821_170000_users_customers_cutover.up,
    down: migration_20260821_170000_users_customers_cutover.down,
    name: '20260821_170000_users_customers_cutover',
  },
  {
    up: migration_20260822_150000_add_notifications.up,
    down: migration_20260822_150000_add_notifications.down,
    name: '20260822_150000_add_notifications',
  },
  {
    up: migration_20260823_120000_add_cover_page_settings.up,
    down: migration_20260823_120000_add_cover_page_settings.down,
    name: '20260823_120000_add_cover_page_settings',
  },
  {
    up: migration_20260823_140000_add_cover_wall_sections.up,
    down: migration_20260823_140000_add_cover_wall_sections.down,
    name: '20260823_140000_add_cover_wall_sections',
  },
  {
    up: migration_20260823_180000_add_cover_section_heading.up,
    down: migration_20260823_180000_add_cover_section_heading.down,
    name: '20260823_180000_add_cover_section_heading',
  },
  {
    up: migration_20260824_100000_add_cover_grid3.up,
    down: migration_20260824_100000_add_cover_grid3.down,
    name: '20260824_100000_add_cover_grid3',
  },
  {
    up: migration_20260824_120000_add_card_style.up,
    down: migration_20260824_120000_add_card_style.down,
    name: '20260824_120000_add_card_style',
  },
  {
    up: migration_20260824_150000_add_cover_links.up,
    down: migration_20260824_150000_add_cover_links.down,
    name: '20260824_150000_add_cover_links',
  },
  {
    up: migration_20260824_170000_add_is_collection.up,
    down: migration_20260824_170000_add_is_collection.down,
    name: '20260824_170000_add_is_collection',
  },
  {
    up: migration_20260824_190000_add_catalog_push_controls.up,
    down: migration_20260824_190000_add_catalog_push_controls.down,
    name: '20260824_190000_add_catalog_push_controls',
  },
];
