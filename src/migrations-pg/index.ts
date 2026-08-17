import * as migration_20260816_023522_pg_baseline from './20260816_023522_pg_baseline';
import * as migration_20260817_035151_p0b_rule_conditions from './20260817_035151_p0b_rule_conditions';
import * as migration_20260817_042534_p0b_reward_type from './20260817_042534_p0b_reward_type';

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
    name: '20260817_042534_p0b_reward_type'
  },
];
