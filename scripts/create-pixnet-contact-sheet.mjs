import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const [sourceArg, outputArg] = process.argv.slice(2)
if (!sourceArg || !outputArg) {
  throw new Error('Usage: node scripts/create-pixnet-contact-sheet.mjs <source-dir> <output.png>')
}

const sourceDir = path.resolve(sourceArg)
const output = path.resolve(outputArg)
const files = fs.readdirSync(sourceDir).filter((file) => /\.png$/i.test(file)).sort()
const tiles = []

for (let index = 0; index < files.length; index += 1) {
  const filename = files[index]
  const thumbnail = await sharp(path.join(sourceDir, filename))
    .resize(220, 195, { fit: 'contain', background: '#ffffff' })
    .png()
    .toBuffer()
  const label = Buffer.from(
    `<svg width="250" height="35"><rect width="250" height="35" fill="white"/><text x="125" y="23" text-anchor="middle" font-family="Arial" font-size="17" fill="#111">${filename.replace(/\.png$/i, '')}</text></svg>`,
  )
  const tile = await sharp({
    create: { width: 250, height: 240, channels: 3, background: '#ffffff' },
  })
    .composite([
      { input: thumbnail, left: 15, top: 5 },
      { input: label, left: 0, top: 205 },
    ])
    .png()
    .toBuffer()
  tiles.push({ input: tile, left: (index % 5) * 250, top: Math.floor(index / 5) * 240 })
}

await sharp({
  create: {
    width: 1250,
    height: Math.ceil(files.length / 5) * 240,
    channels: 3,
    background: '#dddddd',
  },
})
  .composite(tiles)
  .png()
  .toFile(output)

console.log(output)
