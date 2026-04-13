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
  content?: string
  items?: { text: string }[]
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
