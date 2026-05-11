"""
Generate src/migrations/20260414_000000_baseline.ts from Payload drizzle snapshot.

Source snapshot: <repo>/.claude/worktrees/baseline-tmp/src/migrations/20260413_050421_add_richtext_fields.json
This snapshot is the schema as of 2026-04-13, right before 20260415_112142_add_size_charts.

Output: src/migrations/20260414_000000_baseline.ts
  - Up: CREATE TABLE IF NOT EXISTS for all 159 tables + CREATE INDEX IF NOT EXISTS
  - Down: no-op (we never want to drop the baseline)

Run from worktree root:
  python scripts/generate-baseline-migration.py
"""
import json
import os

SRC = 'C:/Users/mjoal/ally-site/chickimmiu/.claude/worktrees/baseline-tmp/src/migrations/20260413_050421_add_richtext_fields.json'
DST = 'src/migrations/20260414_000000_baseline.ts'


def fmt_default(default):
    """Convert Drizzle JSON default value into SQL-safe DEFAULT clause."""
    if default is True:
        return 'true'
    if default is False:
        return 'false'
    if isinstance(default, (int, float)):
        return str(default)
    # string default — may already be SQL-escaped ('foo') or an expression ((strftime(...)))
    return default


def build_create_table_sql(table_name: str, table_def: dict) -> str:
    cols = []
    for col_name, col in table_def['columns'].items():
        parts = [f'`{col_name}`', col['type']]
        if col.get('primaryKey'):
            parts.append('PRIMARY KEY')
        if col.get('notNull'):
            parts.append('NOT NULL')
        if 'default' in col:
            parts.append(f'DEFAULT {fmt_default(col["default"])}')
        cols.append('  ' + ' '.join(parts))

    fks = []
    for fk_name, fk in table_def.get('foreignKeys', {}).items():
        cols_from = ', '.join(f'`{c}`' for c in fk['columnsFrom'])
        cols_to = ', '.join(f'`{c}`' for c in fk['columnsTo'])
        on_update = (fk.get('onUpdate') or 'no action').replace('_', ' ')
        on_delete = (fk.get('onDelete') or 'no action').replace('_', ' ')
        fks.append(
            f'  FOREIGN KEY ({cols_from}) REFERENCES `{fk["tableTo"]}`({cols_to}) '
            f'ON UPDATE {on_update} ON DELETE {on_delete}'
        )

    all_parts = cols + fks
    body = ',\n'.join(all_parts)
    return f'CREATE TABLE IF NOT EXISTS `{table_name}` (\n{body}\n);'


def build_indexes_sql(table_name: str, table_def: dict) -> list[str]:
    out = []
    for idx_name, idx in table_def.get('indexes', {}).items():
        cols = ', '.join(f'`{c}`' for c in idx['columns'])
        unique = 'UNIQUE ' if idx.get('isUnique') else ''
        out.append(f'CREATE {unique}INDEX IF NOT EXISTS `{idx_name}` ON `{table_name}` ({cols});')
    return out


def main():
    with open(SRC, encoding='utf-8') as f:
        data = json.load(f)
    tables = data['tables']

    create_stmts = []
    index_stmts = []
    for name in sorted(tables.keys()):
        create_stmts.append(build_create_table_sql(name, tables[name]))
        index_stmts.extend(build_indexes_sql(name, tables[name]))

    all_stmts = create_stmts + index_stmts

    # Render the .ts file
    lines = [
        "import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'",
        '',
        '/**',
        ' * Pre-2026-04-15 baseline schema (Payload drizzle snapshot 20260413_050421).',
        ' *',
        ' * 為何需要：原本第一條 migration 20260415_112142_add_size_charts.ts 是用',
        ' * `pnpm payload migrate:create` 對「已經被 dev push 過 schema 的 DB」產生的，',
        ' * 直接 ALTER 假設 products/products_images/products_variants/',
        ' * payload_locked_documents_rels 已存在。fresh DB 跑 migrate 立刻爆',
        ' * `SQLITE_ERROR: no such table: products_images`。',
        ' *',
        ' * 這條 baseline 在 20260415 之前先 CREATE TABLE IF NOT EXISTS 把全部 159 張表',
        ' * 建好 — 等於把 prod 早期 dev push 的狀態用 migration 重現。prod 上跑時',
        ' * 每張表都已存在，全部 IF NOT EXISTS no-op。local fresh DB 上跑時，',
        ' * 一次把 baseline 蓋齊，後續 20260415+ 既有 ALTERs 才有東西可以動。',
        ' *',
        ' * down() 故意 no-op：我們從不想 rollback baseline（那會誤刪整個 DB）。',
        ' *',
        ' * 來源 snapshot：',
        ' *   .claude/worktrees/baseline-tmp/src/migrations/20260413_050421_add_richtext_fields.json',
        ' *   commit 0b5695b（0e11f04 的 parent，size_charts 加入前最後一個 commit）',
        ' * 產生：scripts/generate-baseline-migration.py',
        ' */',
        '',
        'const STATEMENTS: string[] = [',
    ]
    for stmt in all_stmts:
        # Use TS backtick template literal-safe formatting: escape backticks
        safe = stmt.replace('\\', '\\\\').replace('`', '\\`').replace('${', '\\${')
        lines.append(f'  `{safe}`,')
    lines.append('];')
    lines.append('')
    lines.append('export async function up({ db }: MigrateUpArgs): Promise<void> {')
    lines.append('  for (const stmt of STATEMENTS) {')
    lines.append('    await db.run(sql.raw(stmt))')
    lines.append('  }')
    lines.append('}')
    lines.append('')
    lines.append('export async function down(_args: MigrateDownArgs): Promise<void> {')
    lines.append('  // no-op: baseline is never rolled back (would wipe the entire DB)')
    lines.append('}')
    lines.append('')

    with open(DST, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

    print(f'Wrote {DST}')
    print(f'  {len(create_stmts)} CREATE TABLE IF NOT EXISTS')
    print(f'  {len(index_stmts)} CREATE INDEX IF NOT EXISTS')


if __name__ == '__main__':
    main()
