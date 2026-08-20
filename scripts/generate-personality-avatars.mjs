import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const atlasRoot = path.join(projectRoot, 'assets', 'personality-atlases')
const outputRoot = path.join(projectRoot, 'public', 'images', 'personality-avatars')
const avatarSize = 384

const atlasDescriptors = {
  neutral: {
    source: 'neutral-crm.png',
    sha256: '50C28ED0DB6383A0D40C58944E4AAE7CA4C0563D426E3AD9E61AC8DAEDF8BEDB',
    x: [18, 166, 317, 469, 620, 773, 927, 1080, 1229],
    y: [151, 278, 406, 533, 660, 787, 915, 1042, 1169],
    background: '#fbf6ec',
    risk: 'CRM icon atlas; cards are icons rather than people.',
    focus(cell) {
      const size = Math.round(Math.min(cell.width * 0.42, cell.height * 0.44))
      return {
        left: cell.left + Math.round((cell.width - size) / 2),
        top: cell.top + 6,
        width: size,
        height: size,
      }
    },
  },
  male: {
    source: 'male-fashion.png',
    sha256: '034409162066413E822F43C67C06AA98D3AA03ABEA6793A1240655BCF1E5BD60',
    filenamePrefix: '03440916-',
    x: [30, 175, 317, 460, 606, 758, 909, 1053, 1223],
    y: [181, 313, 438, 565, 689, 806, 919, 1034, 1142],
    background: '#fbf3eb',
    risk: null,
    focus(cell, index) {
      if (index === 33) {
        const size = Math.round(Math.min(cell.width * 0.46, cell.height - 38))
        return {
          left: cell.left + Math.round(cell.width * 0.2),
          top: cell.top + 6,
          width: size,
          height: size,
        }
      }
      const size = Math.round(Math.min(cell.width * 0.7, cell.height - 30))
      return {
        left: cell.left + Math.round(cell.width * 0.2),
        top: cell.top + 3,
        width: size,
        height: size,
      }
    },
  },
  female: {
    source: 'female-fashion.png',
    sha256: 'BAFE6C896566FFCC783402998FB68396459BD9543B91FD114E25B4173B9FDA1C',
    x: [30, 171, 314, 457, 602, 755, 906, 1050, 1222],
    y: [180, 310, 434, 568, 680, 801, 912, 1025, 1158],
    background: '#fbf3eb',
    risk: null,
    focus(cell, index) {
      if (index === 33) {
        return {
          left: cell.left + Math.round(cell.width * 0.16),
          top: cell.top + 2,
          width: Math.round(cell.width * 0.58),
          height: Math.round(cell.height * 0.55),
        }
      }
      const finalRowRatio = index >= 57 ? 0.46 : 0.55
      return {
        left: cell.left + Math.round(cell.width * 0.25),
        top: cell.top + 2,
        width: Math.round(cell.width * 0.73),
        height: Math.round(cell.height * finalRowRatio),
      }
    },
  },
}

function hash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex').toUpperCase()
}

function cellFor(descriptor, row, column) {
  return {
    left: descriptor.x[column],
    top: descriptor.y[row],
    width: descriptor.x[column + 1] - descriptor.x[column],
    height: descriptor.y[row + 1] - descriptor.y[row],
  }
}

async function generateDefaultAvatar() {
  const svg = Buffer.from(`
    <svg width="${avatarSize}" height="${avatarSize}" viewBox="0 0 ${avatarSize} ${avatarSize}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="bg" cx="45%" cy="36%" r="78%">
          <stop offset="0" stop-color="#fffaf5"/>
          <stop offset="1" stop-color="#f5e9df"/>
        </radialGradient>
      </defs>
      <rect width="384" height="384" rx="192" fill="url(#bg)"/>
      <circle cx="192" cy="192" r="154" fill="none" stroke="#cba870" stroke-width="2"/>
      <circle cx="192" cy="192" r="138" fill="none" stroke="#dec7a3" stroke-width="1" stroke-dasharray="2 10"/>
      <text x="192" y="205" text-anchor="middle" font-family="Georgia, serif" font-size="112" fill="#4a3328">64</text>
      <path d="M148 235h88" stroke="#cba870" stroke-width="2"/>
      <text x="192" y="268" text-anchor="middle" font-family="Arial, sans-serif" font-size="17" letter-spacing="4" fill="#765a48">CHIC KIM &amp; MIU</text>
    </svg>
  `)
  const destination = path.join(outputRoot, 'neutral', 'default.webp')
  await sharp(svg).webp({ quality: 84, smartSubsample: true, effort: 5 }).toFile(destination)
  return destination
}

await fs.mkdir(outputRoot, { recursive: true })

const manifest = {
  generatedAt: new Date().toISOString(),
  avatarSize,
  format: 'webp',
  variants: {},
}

for (const [variant, descriptor] of Object.entries(atlasDescriptors)) {
  const sourcePath = path.join(atlasRoot, descriptor.source)
  const sourceBuffer = await fs.readFile(sourcePath)
  const actualHash = hash(sourceBuffer)
  if (actualHash !== descriptor.sha256) {
    throw new Error(`${descriptor.source} SHA-256 mismatch: ${actualHash}`)
  }

  const metadata = await sharp(sourceBuffer).metadata()
  if (metadata.width !== 1254 || metadata.height !== 1254) {
    throw new Error(`${descriptor.source} must be 1254x1254, got ${metadata.width}x${metadata.height}`)
  }

  const variantDirectory = path.join(outputRoot, variant)
  await fs.mkdir(variantDirectory, { recursive: true })
  const files = []

  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const index = row * 8 + column + 1
      const cell = cellFor(descriptor, row, column)
      const crop = descriptor.focus(cell, index)
      const filename = `${descriptor.filenamePrefix ?? ''}${String(index).padStart(2, '0')}.webp`
      const destination = path.join(variantDirectory, filename)

      await sharp(sourceBuffer)
        .extract(crop)
        .resize(avatarSize, avatarSize, {
          fit: 'cover',
          position: 'attention',
          background: descriptor.background,
        })
        .webp({ quality: 84, smartSubsample: true, effort: 5 })
        .toFile(destination)

      files.push({ index, filename, cell, crop })
    }
  }

  manifest.variants[variant] = {
    source: descriptor.source,
    sourceSha256: actualHash,
    sourceSize: { width: metadata.width, height: metadata.height },
    grid: { columns: 8, rows: 8, xEdges: descriptor.x, yEdges: descriptor.y },
    sourceRisk: descriptor.risk,
    files,
  }
}

await generateDefaultAvatar()
await fs.writeFile(
  path.join(atlasRoot, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
)

const generatedFiles = await Promise.all(
  Object.keys(atlasDescriptors).map(async (variant) => {
    const entries = await fs.readdir(path.join(outputRoot, variant))
    const webpFiles = entries.filter((entry) => entry.endsWith('.webp'))
    const sizes = await Promise.all(
      webpFiles.map(async (entry) => (await fs.stat(path.join(outputRoot, variant, entry))).size),
    )
    return { variant, count: webpFiles.length, bytes: sizes.reduce((sum, size) => sum + size, 0) }
  }),
)

console.log(JSON.stringify({ outputRoot, generatedFiles }, null, 2))
