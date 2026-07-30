import { createServerFeature } from '@payloadcms/richtext-lexical'

export const BlogImageResizeFeature = createServerFeature({
  key: 'blogImageResize',
  dependencies: ['upload'],
  feature: {
    ClientFeature:
      '@/components/admin/lexical/BlogImageResizeFeature.client#BlogImageResizeFeatureClient',
  },
})
