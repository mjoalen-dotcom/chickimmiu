// One-off prod repair: convert raw-HTML product descriptions (imported from
// Shopline) into valid Lexical richText JSON. A single HTML value in a
// json-mode column makes Drizzle's JSON.parse throw and poisons the entire
// products query (homepage carousel + product listings + recommendations).
//
// Usage (run from /var/www/chickimmiu):
//   node fix-html-descriptions.mjs --dry   # preview, no writes
//   node fix-html-descriptions.mjs         # apply
import { createClient } from '@libsql/client'

const DB_URL = process.env.FIX_DB_URL || 'file:./data/chickimmiu.db'
const DRY = process.argv.includes('--dry')

const db = createClient({ url: DB_URL })

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
}

function htmlToLines(html) {
  let s = String(html)
  // Preserve anchor links as "text (url)" before stripping tags.
  s = s.replace(/<a\b[^>]*?href\s*=\s*"([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, inner) => {
    const t = inner.replace(/<[^>]+>/g, '').trim()
    return t && !t.includes(href) ? `${t} (${href})` : href
  })
  // Turn block boundaries into newlines.
  s = s
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*(div|p|li|tr|h[1-6]|section|article)\s*>/gi, '\n')
    .replace(/<\s*(div|p|li|tr|h[1-6]|section|article)[^>]*>/gi, '\n')
  // Strip every remaining tag.
  s = s.replace(/<[^>]+>/g, '')
  s = decodeEntities(s)
  return s
    .split('\n')
    .map((l) => l.replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim())
    .filter((l) => l.length > 0)
    // Drop leftover bare-URL lines (image/link artifacts from the Shopline
    // export); they are not real description copy. Originals are archived.
    .filter((l) => !/^https?:\/\/\S+$/i.test(l))
}

function buildLexical(lines) {
  const children = lines.map((text) => ({
    type: 'paragraph',
    children: [
      { type: 'text', text, format: 0, detail: 0, mode: 'normal', style: '', version: 1 },
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
    textFormat: 0,
  }))
  if (children.length === 0) {
    children.push({ type: 'paragraph', children: [], direction: null, format: '', indent: 0, version: 1 })
  }
  return JSON.stringify({
    root: { type: 'root', children, direction: 'ltr', format: '', indent: 0, version: 1 },
  })
}

const run = async () => {
  const res = await db.execute(
    "SELECT id, name, slug, description FROM products WHERE substr(trim(description),1,1)='<'",
  )
  console.log(`Found ${res.rows.length} rows with HTML descriptions.`)

  // Archive originals (belt-and-suspenders alongside the full DB backup).
  if (!DRY && res.rows.length > 0) {
    const archive = res.rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug, html: r.description }))
    const fs = await import('node:fs')
    const path = `./data/html-desc-archive-${res.rows.length}rows.json`
    fs.writeFileSync(path, JSON.stringify(archive, null, 2), 'utf8')
    console.log(`Archived ${archive.length} original HTML descriptions to ${path}`)
  }

  let updated = 0
  let withText = 0
  for (const row of res.rows) {
    const id = row.id
    const lines = htmlToLines(row.description)
    if (lines.length > 0) withText++
    const lex = buildLexical(lines)
    // Sanity: must be parseable and shaped like lexical.
    const parsed = JSON.parse(lex)
    if (!parsed?.root?.children) throw new Error(`bad lexical for id ${id}`)

    if (DRY) {
      if (updated < 3) {
        console.log(`\n--- id ${id} ---`)
        console.log('lines:', JSON.stringify(lines.slice(0, 6), null, 0))
        console.log('lexical[:240]:', lex.slice(0, 240))
      }
    } else {
      await db.execute({ sql: 'UPDATE products SET description = ? WHERE id = ?', args: [lex, id] })
    }
    updated++
  }

  console.log(`Rows with preserved text: ${withText} / ${updated} (rest become empty paragraph).`)
  if (DRY) {
    console.log(`\n[DRY] Would update ${updated} rows. No writes performed.`)
  } else {
    const chk = await db.execute("SELECT count(*) AS c FROM products WHERE substr(trim(description),1,1)='<'")
    console.log(`Updated ${updated} rows. Remaining bad rows: ${chk.rows[0].c}`)
  }
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('FAILED:', e)
    process.exit(1)
  })
