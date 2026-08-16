import type { Metadata } from 'next'

import { SocialWallStudio } from '@/components/social-wall/SocialWallStudio'

export const metadata: Metadata = {
  title: '視覺編輯器',
}

export default function SocialWallStudioPage() {
  return <SocialWallStudio />
}
