import { getPayload } from 'payload'
import config from '@payload-config'

export async function getPolicySettings() {
  if (!process.env.DATABASE_URI) return null
  try {
    const payload = await getPayload({ config })
    return (await payload.findGlobal({ slug: 'policy-pages-settings', depth: 1 })) as unknown as Record<string, unknown>
  } catch {
    return null
  }
}

export interface PolicySection {
  title: string
  richContent?: unknown  // Lexical richText（後台「圖文編輯」欄位，支援圖片/影片）
  content?: string
  items?: { text: string }[]
}

/**
 * 判斷 Lexical richText 欄位是否為「實質空白」。
 * Payload 的 richText 欄位即使使用者沒輸入內容，也常會存成 `{ root: { children: [{ type: 'paragraph', children: [] }] } }`
 * 這種「只有一顆空 paragraph」的 JSON —— 它是 truthy object 但前台渲染出來是空白。
 * 若視為空則退回 content / items 欄位，讓前台正確顯示 DB 既有文字。
 */
function isLexicalEmpty(v: unknown): boolean {
  if (!v || typeof v !== 'object') return true
  const root = (v as { root?: { children?: unknown[] } }).root
  if (!root || !Array.isArray(root.children) || root.children.length === 0) return true
  return root.children.every((c) => {
    const child = c as { type?: string; children?: unknown[] }
    return child?.type === 'paragraph' && Array.isArray(child.children) && child.children.length === 0
  })
}

export function extractPolicySections(
  policyGroup: Record<string, unknown> | null,
  fallbackSections: PolicySection[],
) {
  if (!policyGroup) return { sections: fallbackSections, pageTitle: '', enTitle: '', effectiveDate: '', version: '', seoTitle: '', seoDescription: '' }

  const cmsSections = policyGroup.sections as Array<Record<string, unknown>> | undefined
  const sections: PolicySection[] = cmsSections?.length
    ? cmsSections.map((s) => ({
        title: (s.title as string) || '',
        // richContent 優先於 content（照 schema 描述：「若此欄位有內容，將優先使用」）
        // 空 Lexical（只有空 paragraph）視為 undefined，讓 content / items 得以 fallback
        richContent: isLexicalEmpty(s.richContent) ? undefined : s.richContent,
        content: (s.content as string) || undefined,
        items: (s.items as Array<{ text: string }>) || undefined,
      }))
    : fallbackSections

  return {
    sections,
    pageTitle: (policyGroup.pageTitle as string) || '',
    enTitle: (policyGroup.enTitle as string) || '',
    effectiveDate: (policyGroup.effectiveDate as string) || '',
    version: (policyGroup.version as string) || '',
    seoTitle: (policyGroup.seoTitle as string) || '',
    seoDescription: (policyGroup.seoDescription as string) || '',
  }
}
