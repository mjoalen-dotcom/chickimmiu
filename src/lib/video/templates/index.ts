/**
 * CHIC KIM & MIU Reels 影片範本總入口
 *
 * 使用方式：
 *   import { TEMPLATES, getTemplate } from '@/lib/video/templates'
 *
 *   const template = getTemplate('story-emotional')
 */

import type { VideoTemplate, TemplateId } from './types'
import { ClassicElegant } from './classicElegant'
import { StoryEmotional } from './storyEmotional'
import { DetailObsessed } from './detailObsessed'
import { QuickSell } from './quickSell'

export const TEMPLATES: Record<TemplateId, VideoTemplate> = {
  'classic-elegant': ClassicElegant,
  'story-emotional': StoryEmotional,
  'detail-obsessed': DetailObsessed,
  'quick-sell': QuickSell
}

export function getTemplate(id: TemplateId): VideoTemplate {
  return TEMPLATES[id]
}

export function getAllTemplates(): VideoTemplate[] {
  return Object.values(TEMPLATES)
}

export * from './types'
export { ClassicElegant, StoryEmotional, DetailObsessed, QuickSell }
