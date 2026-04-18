import * as migration_20260415_112142_add_size_charts from './20260415_112142_add_size_charts';
import * as migration_20260416_140000_add_gender_and_male_tier_name from './20260416_140000_add_gender_and_male_tier_name';
import * as migration_20260416_193835_add_daily_checkin_streak from './20260416_193835_add_daily_checkin_streak';
import * as migration_20260417_100000_add_stored_value_balance from './20260417_100000_add_stored_value_balance';
import * as migration_20260418_220000_add_login_attempts from './20260418_220000_add_login_attempts';
import * as migration_20260418_230000_add_body_and_invoice_fields from './20260418_230000_add_body_and_invoice_fields';
import * as migration_20260419_100000_add_email_verification from './20260419_100000_add_email_verification';

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
  {
    up: migration_20260416_193835_add_daily_checkin_streak.up,
    down: migration_20260416_193835_add_daily_checkin_streak.down,
    name: '20260416_193835_add_daily_checkin_streak'
  },
  {
    up: migration_20260417_100000_add_stored_value_balance.up,
    down: migration_20260417_100000_add_stored_value_balance.down,
    name: '20260417_100000_add_stored_value_balance'
  },
  {
    up: migration_20260418_220000_add_login_attempts.up,
    down: migration_20260418_220000_add_login_attempts.down,
    name: '20260418_220000_add_login_attempts'
  },
  {
    up: migration_20260418_230000_add_body_and_invoice_fields.up,
    down: migration_20260418_230000_add_body_and_invoice_fields.down,
    name: '20260418_230000_add_body_and_invoice_fields'
  },
  {
    up: migration_20260419_100000_add_email_verification.up,
    down: migration_20260419_100000_add_email_verification.down,
    name: '20260419_100000_add_email_verification'
  },
];
