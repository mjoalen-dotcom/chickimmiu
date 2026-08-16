import * as migration_20260816_023522_pg_baseline from './20260816_023522_pg_baseline';

export const migrations = [
  {
    up: migration_20260816_023522_pg_baseline.up,
    down: migration_20260816_023522_pg_baseline.down,
    name: '20260816_023522_pg_baseline'
  },
];
