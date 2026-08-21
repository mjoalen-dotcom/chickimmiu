import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationUrl = new URL('./20260817_060801_social_wall_saas.ts', import.meta.url)
const migrationSource = await readFile(migrationUrl, 'utf8')

function migrationBody(name) {
  const functionStart = migrationSource.indexOf(`export async function ${name}`)
  assert.notEqual(functionStart, -1, `找不到 ${name} migration function`)

  const sqlStart = migrationSource.indexOf('sql`', functionStart)
  assert.notEqual(sqlStart, -1, `找不到 ${name} migration SQL 起點`)

  const sqlEnd = migrationSource.indexOf('`)', sqlStart + 4)
  assert.notEqual(sqlEnd, -1, `找不到 ${name} migration SQL 終點`)
  return migrationSource.slice(sqlStart + 4, sqlEnd)
}

test('UP 只建立社群牆資料表，不夾帶 Customers 或 Users schema', () => {
  const up = migrationBody('up')
  const tables = [...up.matchAll(/CREATE TABLE "([^"]+)"/g)].map((match) => match[1])

  assert.deepEqual(tables, [
    'social_wall_connections',
    'social_wall_widgets',
    'social_wall_subscriptions',
    'social_wall_licenses',
    'social_wall_usage_daily',
  ])
  assert.doesNotMatch(up, /CREATE (?:TABLE|TYPE) "(?:public"\.)?"?(?:customers|users)/)
})

test('DOWN 先移除外部關聯，再刪除社群牆資料表', () => {
  const down = migrationBody('down')
  const firstExternalConstraint = down.indexOf(
    'ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT',
  )
  const firstTableDrop = down.indexOf('DROP TABLE "social_wall_connections"')

  assert.notEqual(firstExternalConstraint, -1)
  assert.notEqual(firstTableDrop, -1)
  assert.ok(
    firstExternalConstraint < firstTableDrop,
    '外部 FK 必須在被參照資料表之前移除，否則 PostgreSQL 回滾會失敗',
  )
})

test('每個 owner 關聯都指向 Customers，且訂閱 owner 維持唯一', () => {
  const up = migrationBody('up')
  const ownerForeignKeys = [
    'social_wall_connections',
    'social_wall_widgets',
    'social_wall_subscriptions',
    'social_wall_licenses',
    'social_wall_usage_daily',
  ]

  for (const table of ownerForeignKeys) {
    assert.match(
      up,
      new RegExp(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${table}_owner_id_customers_id_fk"[^;]+REFERENCES "public"\\."customers"\\("id"\\)`,
      ),
    )
  }
  assert.match(
    up,
    /CREATE UNIQUE INDEX "social_wall_subscriptions_owner_idx" ON "social_wall_subscriptions"/,
  )
})
