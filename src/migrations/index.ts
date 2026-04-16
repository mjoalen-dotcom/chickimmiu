import * as migration_20260415_112142_add_size_charts from './20260415_112142_add_size_charts';
import * as migration_20260416_140000_add_gender_and_male_tier_name from './20260416_140000_add_gender_and_male_tier_name';

export const migrations = [
  {
    up: migration_20260415_112142_add_size_charts.up,
    down: migration_20260415_112142_add_size_charts.down,
    name: '20260415_112142_add_size_charts'
  },
  {
    up: migration_20260416_140000_add_gender_and_male_tier_name.up,
    down: migration_20260416_140000_add_gender_and_male_tier_name.down,
    name: '20260416_140000_add_gender_and_male_tier_name'
  },
];
