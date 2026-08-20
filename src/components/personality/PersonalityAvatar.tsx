import Image from 'next/image'

import {
  resolvePersonalityAvatar,
  resolvePersonalityProfile,
} from '@/lib/personality/personalityProfile'

interface PersonalityAvatarProps {
  gender?: unknown
  personalityIndex?: unknown
  mbtiType?: unknown
  occasion?: unknown
  size?: number
  className?: string
  imageClassName?: string
  priority?: boolean
  alt?: string
}

export function PersonalityAvatar({
  gender,
  personalityIndex,
  mbtiType,
  occasion,
  size = 192,
  className = '',
  imageClassName = '',
  priority = false,
  alt,
}: PersonalityAvatarProps) {
  const asset = resolvePersonalityAvatar({ gender, personalityIndex, mbtiType, occasion })
  const profile = resolvePersonalityProfile({
    personalityIndex: asset.personalityIndex,
  })
  const accessibleName = alt ?? (profile ? `${profile.name}人格人物圖` : '64 型人格預設人物圖')

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-[28%] border border-[#d9b982]/70 bg-[#fbf3eb] shadow-[0_14px_34px_rgba(82,51,39,0.14)] ${className}`}
      style={{ width: size, height: size }}
      data-testid="personality-avatar"
      data-gender-variant={asset.variant}
      data-personality-index={asset.personalityIndex ?? 'fallback'}
      data-personality-fallback={asset.isFallback ? 'true' : 'false'}
    >
      <Image
        src={asset.src}
        alt={accessibleName}
        width={size}
        height={size}
        sizes={`${size}px`}
        priority={priority}
        className={`h-full w-full object-cover ${imageClassName}`}
      />
      <span className="pointer-events-none absolute inset-[7px] rounded-[25%] border border-white/65" />
    </div>
  )
}

export default PersonalityAvatar
