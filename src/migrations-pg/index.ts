import * as migration_20260816_023522_pg_baseline from './20260816_023522_pg_baseline';
import * as migration_20260817_035151_p0b_rule_conditions from './20260817_035151_p0b_rule_conditions';
import * as migration_20260817_042534_p0b_reward_type from './20260817_042534_p0b_reward_type';
import * as migration_20260817_044059_cost_snapshot from './20260817_044059_cost_snapshot';
import * as migration_20260817_051044_p0c_campaign_governance from './20260817_051044_p0c_campaign_governance';
import * as migration_20260817_170000_p0b_drop_enums from './20260817_170000_p0b_drop_enums';
import * as migration_20260817_170500_p0b_drop_schema from './20260817_170500_p0b_drop_schema';
import * as migration_20260821_010000_add_ops_actions from './20260821_010000_add_ops_actions';

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
    name: '20260817_051044_p0c_campaign_governance'
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
];
