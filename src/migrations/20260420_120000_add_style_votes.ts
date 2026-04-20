import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * PR-1 games-social — style_votes 表（單表，無子表）。
 *
 * 對照 src/collections/StyleVotes.ts：
 *   id / voter_id / submission_id / room_id / vote_type / score /
 *   metadata / created_at / updated_at
 *
 * 唯一約束：UNIQUE (voter_id, submission_id, vote_type)
 *   → 一人對一作品同 voteType 只能投一次
 *
 * 冪等：sqlite_master / PRAGMA 判斷。
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
async function indexExists(db: any, index: string): Promise<boolean> {
  const res = await db.run(
    sql.raw(`SELECT name FROM sqlite_master WHERE type='index' AND name='${index}';`),
  )
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.length > 0
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  if (!(await tableExists(db, 'style_votes'))) {
    await db.run(sql`CREATE TABLE \`style_votes\` (
      \`id\` integer PRIMARY KEY NOT NULL,
      \`voter_id\` integer NOT NULL,
      \`submission_id\` integer NOT NULL,
      \`room_id\` integer,
      \`vote_type\` text DEFAULT 'like' NOT NULL,
      \`score\` numeric,
      \`metadata\` text,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      FOREIGN KEY (\`voter_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (\`submission_id\`) REFERENCES \`style_submissions\`(\`id\`) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (\`room_id\`) REFERENCES \`style_game_rooms\`(\`id\`) ON UPDATE no action ON DELETE set null
    );`)

    await db.run(sql`CREATE INDEX \`style_votes_voter_idx\` ON \`style_votes\` (\`voter_id\`);`)
    await db.run(sql`CREATE INDEX \`style_votes_submission_idx\` ON \`style_votes\` (\`submission_id\`);`)
    await db.run(sql`CREATE INDEX \`style_votes_room_idx\` ON \`style_votes\` (\`room_id\`);`)
    await db.run(sql`CREATE INDEX \`style_votes_updated_at_idx\` ON \`style_votes\` (\`updated_at\`);`)
    await db.run(sql`CREATE INDEX \`style_votes_created_at_idx\` ON \`style_votes\` (\`created_at\`);`)
    // 複合 index：作品票數時序、會員投票時序、per-room
    await db.run(sql`CREATE INDEX \`style_votes_submission_created_at_idx\` ON \`style_votes\` (\`submission_id\`, \`created_at\`);`)
    await db.run(sql`CREATE INDEX \`style_votes_voter_created_at_idx\` ON \`style_votes\` (\`voter_id\`, \`created_at\`);`)
    await db.run(sql`CREATE INDEX \`style_votes_room_created_at_idx\` ON \`style_votes\` (\`room_id\`, \`created_at\`);`)
    // UNIQUE (voter, submission, vote_type) — 核心 anti-dup 約束
    await db.run(sql`CREATE UNIQUE INDEX \`style_votes_voter_submission_type_uniq\` ON \`style_votes\` (\`voter_id\`, \`submission_id\`, \`vote_type\`);`)
  }

  // payload_locked_documents_rels
  if (!(await columnExists(db, 'payload_locked_documents_rels', 'style_votes_id'))) {
    await db.run(
      sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`style_votes_id\` integer REFERENCES style_votes(id);`,
    )
  }
  if (!(await indexExists(db, 'payload_locked_documents_rels_style_votes_id_idx'))) {
    await db.run(
      sql`CREATE INDEX \`payload_locked_documents_rels_style_votes_id_idx\` ON \`payload_locked_documents_rels\` (\`style_votes_id\`);`,
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await tableExists(db, 'style_votes')) {
    await db.run(sql`DROP TABLE \`style_votes\`;`)
  }
}
