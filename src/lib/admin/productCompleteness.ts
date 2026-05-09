export interface TabStatus {
  state: 'ok' | 'warn' | 'todo'
  missing: string[]
  suggested: string[]
}

export interface ProductCompletenessResult {
  tab1: TabStatus
  tab2: TabStatus
  tab3: TabStatus
  tab4: TabStatus
}

type LooseRecord = Record<string, unknown>

function asRecord(data: unknown): LooseRecord {
  if (data && typeof data === 'object') return data as LooseRecord
  return {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function hasRelationship(value: unknown): boolean {
  if (value == null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'object') {
    const record = value as LooseRecord
    return hasRelationship(record.id)
  }
  return false
}

function hasTagItems(value: unknown): boolean {
  const rows = asArray(value)
  if (rows.length === 0) return false
  return rows.some((row) => {
    if (typeof row === 'string') return row.trim().length > 0
    if (row && typeof row === 'object') {
      const record = row as LooseRecord
      return hasText(record.tag) || hasText(record.label) || hasText(record.value)
    }
    return false
  })
}

function toStatus(requiredMissing: string[], suggestedMissing: string[]): TabStatus {
  if (requiredMissing.length > 0) {
    return {
      state: 'todo',
      missing: requiredMissing,
      suggested: suggestedMissing,
    }
  }

  if (suggestedMissing.length > 0) {
    return {
      state: 'warn',
      missing: [],
      suggested: suggestedMissing,
    }
  }

  return {
    state: 'ok',
    missing: [],
    suggested: [],
  }
}

export function evaluateProduct(data: unknown): ProductCompletenessResult {
  const source = asRecord(data)

  const tab1Required: string[] = []
  const tab1Suggested: string[] = []

  if (!hasText(source.name)) tab1Required.push('商品名稱')
  if (!hasText(source.slug)) tab1Required.push('網址代碼')
  if (toNumber(source.price) == null) tab1Required.push('原價')
  if (!hasRelationship(source.category)) tab1Required.push('主分類')

  if (!hasText(source.description)) tab1Suggested.push('商品描述')
  if (!hasText(source.shortDescription)) tab1Suggested.push('簡短描述')
  if (!hasTagItems(source.tags)) tab1Suggested.push('商品標籤')

  const tab2Required: string[] = []
  const tab2Suggested: string[] = []

  const hasFeaturedImage = hasRelationship(source.featuredImage)
  const hasGalleryImage = asArray(source.images).length > 0
  if (!hasFeaturedImage && !hasGalleryImage) tab2Required.push('封面主圖或商品圖庫')

  const variantRows = asArray(source.variants)
  const totalStock = toNumber(source.stock) ?? 0
  if (variantRows.length < 1 && totalStock <= 0) tab2Suggested.push('至少一組變體或可售庫存')

  const tab3Required: string[] = []
  const tab3Suggested: string[] = []

  if (!hasText(source.material)) tab3Suggested.push('材質')
  if (!hasText(source.careInstructions)) tab3Suggested.push('洗滌與保養說明')
  const modelInfo = asRecord(source.modelInfo)
  if (!hasText(modelInfo.height)) tab3Suggested.push('模特兒身高')

  const tab4Required: string[] = []
  const tab4Suggested: string[] = []

  if (!hasText(source.adsTitleOverride)) tab4Suggested.push('廣告標題（覆寫）')
  if (!hasText(source.googleProductCategory)) tab4Suggested.push('Google 商品分類')

  return {
    tab1: toStatus(tab1Required, tab1Suggested),
    tab2: toStatus(tab2Required, tab2Suggested),
    tab3: toStatus(tab3Required, tab3Suggested),
    tab4: toStatus(tab4Required, tab4Suggested),
  }
}

