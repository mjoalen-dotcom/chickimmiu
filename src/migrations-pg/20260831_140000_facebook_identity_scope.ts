import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Leave legacy Facebook IDs unscoped. Only a verified callback may bind an
  // App ID; guessing the old SHOPLINE App ID could attach the wrong customer.
  await db.execute(sql`
    ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "social_logins_facebook_app_id" varchar;
    CREATE UNIQUE INDEX IF NOT EXISTS "socialLogins_facebookAppId_socialLogins_facebookId_idx"
      ON "customers" ("social_logins_facebook_app_id", "social_logins_facebook_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // A program rollback can retain this additive column/index. Once used, a
  // schema rollback would erase the scope of established login identities.
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM "customers" WHERE "social_logins_facebook_app_id" IS NOT NULL) THEN
        RAISE EXCEPTION 'Facebook bindings exist; retain the identity scope and roll back code only';
      END IF;
    END $$;
    DROP INDEX IF EXISTS "socialLogins_facebookAppId_socialLogins_facebookId_idx";
    ALTER TABLE "customers" DROP COLUMN IF EXISTS "social_logins_facebook_app_id";
  `)
}
