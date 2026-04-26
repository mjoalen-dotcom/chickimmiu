import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Media — 啟用 Payload v3 內建資料夾系統 (`folders: true`)
 *
 * 對應 src/payload.config.ts (`folders: true`) + src/collections/Media.ts
 * (`folders: true` + `folderName` 文字欄位取代舊 `folder` 文字欄位)。
 *
 * 變動概要：
 *   1. 新建 `payload_folders` collection（樹狀，自我參照 `folder_id`）
 *   2. 新建 `payload_folders_folder_type` 子表（select hasMany — 限定可放的 collection）
 *   3. `media`：新增 `folder_id` (relationship → payload_folders)
 *   4. `media`：把舊 `folder` (text) 改名 → `folder_name`（保留資料，新流程降為輔助標籤）
 *   5. `payload_locked_documents_rels`：新增 `payload_folders_id` (供 admin lock/unlock 文件用)
 *   6. 資料回填：把 distinct `folder_name` 值各建一筆 payload_folders（folder_type=['media']），
 *      然後 update media 把對應 folder_id 寫進去（保留原本的文字標籤不刪）
 *
 * SQLite 限制：沒有原生 RENAME COLUMN 支援到 v3.25 才有，但 libsql/Payload 用的版本
 * 已支援；用 `ALTER TABLE ... RENAME COLUMN` 直接改名，不需要重建表。
 *
 * 冪等：sqlite_master / PRAGMA 判斷，承襲 20260421_120000_add_collectible_cards.ts pattern。
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tableExists(db: any, table: string): Promise<boolean> {
  const res = await db.run(
    sql.raw(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}';`),
  )
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.length > 0
}

async function columnExists(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  table: string,
  column: string,
): Promise<boolean> {
  const res = await db.run(sql.raw(`PRAGMA table_info('${table}');`))
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.some((r) => r?.name === column)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function indexExists(db: any, name: string): Promise<boolean> {
  const res = await db.run(
    sql.raw(`SELECT name FROM sqlite_master WHERE type='index' AND name='${name}';`),
  )
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.length > 0
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ── 1. payload_folders 主表 ──
  if (!(await tableExists(db, 'payload_folders'))) {
    await db.run(sql`CREATE TABLE \`payload_folders\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`name\` text NOT NULL,
      \`folder_id\` integer,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      FOREIGN KEY (\`folder_id\`) REFERENCES \`payload_folders\`(\`id\`) ON UPDATE no action ON DELETE set null
    );`)
    await db.run(sql`CREATE INDEX \`payload_folders_name_idx\` ON \`payload_folders\` (\`name\`);`)
    await db.run(sql`CREATE INDEX \`payload_folders_folder_idx\` ON \`payload_folders\` (\`folder_id\`);`)
    await db.run(sql`CREATE INDEX \`payload_folders_updated_at_idx\` ON \`payload_folders\` (\`updated_at\`);`)
    await db.run(sql`CREATE INDEX \`payload_folders_created_at_idx\` ON \`payload_folders\` (\`created_at\`);`)
  }

  // ── 2. payload_folders_folder_type 子表（select hasMany）──
  // 注意：drizzle-sqlite 對 select hasMany 的子表 column 是 `order`/`parent_id`（無底線前綴），
  //       與 Payload `array` 子表的 `_order`/`_parent_id` 不同，這是兩個 layout 規則。
  if (!(await tableExists(db, 'payload_folders_folder_type'))) {
    await db.run(sql`CREATE TABLE \`payload_folders_folder_type\` (
      \`order\` integer NOT NULL,
      \`parent_id\` integer NOT NULL,
      \`value\` text,
      \`id\` integer PRIMARY KEY NOT NULL,
      FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_folders\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );`)
    await db.run(
      sql`CREATE INDEX \`payload_folders_folder_type_order_idx\` ON \`payload_folders_folder_type\` (\`order\`);`,
    )
    await db.run(
      sql`CREATE INDEX \`payload_folders_folder_type_parent_idx\` ON \`payload_folders_folder_type\` (\`parent_id\`);`,
    )
  }

  // ── 3. media.folder (text) → media.folder_name (text) ──
  // 舊 column: 由 20260419_110000_add_media_folder migration 加進來的 free-text 欄位
  // 新角色：folder 之後給 Payload 內建資料夾關聯使用，folder_name 留純文字標籤
  if (
    (await columnExists(db, 'media', 'folder')) &&
    !(await columnExists(db, 'media', 'folder_name'))
  ) {
    // SQLite 3.25+ 支援 RENAME COLUMN；libsql/Payload db-sqlite adapter 都已用更新版
    await db.run(sql`ALTER TABLE \`media\` RENAME COLUMN \`folder\` TO \`folder_name\`;`)
  } else if (!(await columnExists(db, 'media', 'folder_name'))) {
    // 沒有舊 folder 欄位（不太可能，但 fallback：fresh DB）
    await db.run(sql`ALTER TABLE \`media\` ADD COLUMN \`folder_name\` text;`)
  }

  // 換掉舊 idx 名稱：media_folder_idx → media_folder_name_idx
  if (await indexExists(db, 'media_folder_idx')) {
    await db.run(sql`DROP INDEX \`media_folder_idx\`;`)
  }
  if (!(await indexExists(db, 'media_folder_name_idx'))) {
    await db.run(sql`CREATE INDEX \`media_folder_name_idx\` ON \`media\` (\`folder_name\`);`)
  }

  // ── 4. media.folder_id (relationship to payload_folders) ──
  if (!(await columnExists(db, 'media', 'folder_id'))) {
    await db.run(
      sql`ALTER TABLE \`media\` ADD COLUMN \`folder_id\` integer REFERENCES payload_folders(id);`,
    )
  }
  // media_folder_idx 在這個遷移裡指向 folder_id（前一節已 DROP 同名舊 idx）
  if (!(await indexExists(db, 'media_folder_idx'))) {
    await db.run(sql`CREATE INDEX \`media_folder_idx\` ON \`media\` (\`folder_id\`);`)
  }

  // ── 5. payload_locked_documents_rels: payload_folders_id ──
  if (!(await columnExists(db, 'payload_locked_documents_rels', 'payload_folders_id'))) {
    await db.run(
      sql`ALTER TABLE \`payload_locked_documents_rels\` ADD COLUMN \`payload_folders_id\` integer REFERENCES payload_folders(id);`,
    )
  }
  if (!(await indexExists(db, 'payload_locked_documents_rels_payload_folders_id_idx'))) {
    await db.run(
      sql`CREATE INDEX \`payload_locked_documents_rels_payload_folders_id_idx\` ON \`payload_locked_documents_rels\` (\`payload_folders_id\`);`,
    )
  }

  // ── 6. 資料回填：distinct folder_name → payload_folders + 連結 media ──
  //   - 只在 payload_folders 還沒有任何 row 時跑（避免重複執行 migrate 重建）
  //   - folderType=['media'] → 只允許放 media documents（collectionSpecific:true 預設）
  //   - 不刪 media.folder_name 的字串值，保留為輔助標籤
  const folderCountRes = await db.run(sql.raw(`SELECT COUNT(*) AS c FROM payload_folders;`))
  const folderRows = (folderCountRes?.rows ?? folderCountRes ?? []) as Array<
    Record<string, unknown>
  >
  const folderCount = Number((folderRows[0]?.c ?? folderRows[0]?.['COUNT(*)']) || 0)

  if (folderCount === 0) {
    const distinctRes = await db.run(
      sql.raw(
        `SELECT DISTINCT folder_name FROM media WHERE folder_name IS NOT NULL AND TRIM(folder_name) != '' ORDER BY folder_name;`,
      ),
    )
    const distinctRows = (distinctRes?.rows ?? distinctRes ?? []) as Array<
      Record<string, unknown>
    >

    for (const row of distinctRows) {
      const name = String(row?.folder_name ?? '').trim()
      if (!name) continue

      // 建立 folder
      const insertRes = await db.run(
        sql.raw(
          `INSERT INTO payload_folders (name) VALUES (${escapeSqlString(name)}) RETURNING id;`,
        ),
      )
      const insertRows = (insertRes?.rows ?? insertRes ?? []) as Array<Record<string, unknown>>
      const folderId = Number(insertRows[0]?.id ?? insertRes?.lastInsertRowid ?? 0)
      if (!folderId) continue

      // folderType = ['media']（select hasMany 子表）
      // id 留空讓 SQLite autoincrement（INTEGER PRIMARY KEY 自動填）
      await db.run(
        sql.raw(
          `INSERT INTO payload_folders_folder_type ("order", parent_id, value) VALUES (1, ${folderId}, 'media');`,
        ),
      )

      // 把同名 folder_name 的 media 都連到此 folder
      await db.run(
        sql.raw(
          `UPDATE media SET folder_id = ${folderId} WHERE folder_name = ${escapeSqlString(name)};`,
        ),
      )
    }
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // 1. 回滾 media: folder_id 移除 + folder_name 改回 folder
  if (await indexExists(db, 'media_folder_idx')) {
    await db.run(sql`DROP INDEX \`media_folder_idx\`;`)
  }
  if (await indexExists(db, 'media_folder_name_idx')) {
    await db.run(sql`DROP INDEX \`media_folder_name_idx\`;`)
  }
  if (await columnExists(db, 'media', 'folder_id')) {
    await db.run(sql`ALTER TABLE \`media\` DROP COLUMN \`folder_id\`;`)
  }
  if (
    (await columnExists(db, 'media', 'folder_name')) &&
    !(await columnExists(db, 'media', 'folder'))
  ) {
    await db.run(sql`ALTER TABLE \`media\` RENAME COLUMN \`folder_name\` TO \`folder\`;`)
    await db.run(sql`CREATE INDEX \`media_folder_idx\` ON \`media\` (\`folder\`);`)
  }

  // 2. payload_locked_documents_rels: 移除 payload_folders_id
  if (await indexExists(db, 'payload_locked_documents_rels_payload_folders_id_idx')) {
    await db.run(sql`DROP INDEX \`payload_locked_documents_rels_payload_folders_id_idx\`;`)
  }
  if (await columnExists(db, 'payload_locked_documents_rels', 'payload_folders_id')) {
    await db.run(
      sql`ALTER TABLE \`payload_locked_documents_rels\` DROP COLUMN \`payload_folders_id\`;`,
    )
  }

  // 3. drop folders 子表 + 主表（cascade FK 會清掉 children）
  if (await tableExists(db, 'payload_folders_folder_type')) {
    await db.run(sql`DROP TABLE \`payload_folders_folder_type\`;`)
  }
  if (await tableExists(db, 'payload_folders')) {
    await db.run(sql`DROP TABLE \`payload_folders\`;`)
  }
}

/**
 * 簡易 SQL 字串 escape（單引號雙寫）—— 只用於 migration backfill 的可信內部資料來源
 *   (folder_name 從 DB 自己讀回來)，非 user-supplied input。
 *   不採用 prepared/parameterized 是因為 db.run(sql.raw(...)) 的這個 path 不接受
 *   bind values；其他 DDL/DML 也是 raw 直拼。
 */
function escapeSqlString(s: string): string {
  return `'${s.replace(/'/g, "''")}'`
}
