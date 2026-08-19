'use client'

import React from 'react'
import { useField } from '@payloadcms/ui'

import { PersonalityAvatar } from '@/components/personality/PersonalityAvatar'
import {
  normalizeGenderVariant,
  resolvePersonalityAvatar,
  resolvePersonalityProfile,
} from '@/lib/personality/personalityProfile'

const genderLabels = {
  neutral: '未明確標註（中性素材）',
  male: '男性',
  female: '女性',
} as const

const PersonalityAvatarField: React.FC = () => {
  const { value: gender } = useField<unknown>({ path: 'gender' })
  const { value: mbtiType } = useField<unknown>({ path: 'mbtiProfile.mbtiType' })
  const { value: primaryOccasion } = useField<unknown>({
    path: 'mbtiProfile.primaryOccasion',
  })

  const profile = resolvePersonalityProfile({ mbtiType, occasion: primaryOccasion })
  const asset = resolvePersonalityAvatar({ gender, mbtiType, occasion: primaryOccasion })
  const genderVariant = normalizeGenderVariant(gender)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        flexWrap: 'wrap',
        padding: 18,
        margin: '8px 0 18px',
        borderRadius: 16,
        border: '1px solid #dec59d',
        background: 'linear-gradient(135deg, #fffaf5 0%, #faeee7 100%)',
        color: '#3d2b24',
      }}
      data-testid="admin-personality-avatar-card"
    >
      <PersonalityAvatar
        gender={gender}
        mbtiType={mbtiType}
        occasion={primaryOccasion}
        size={148}
      />

      <div style={{ flex: '1 1 260px', minWidth: 0 }}>
        <div
          style={{
            color: '#9a7545',
            fontSize: 11,
            letterSpacing: '0.18em',
            marginBottom: 7,
          }}
        >
          MEMBER PERSONALITY PORTRAIT
        </div>
        <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 10 }}>
          {profile?.name ?? '尚無有效的 64 型人格結果'}
        </div>
        <div style={{ display: 'grid', gap: 5, fontSize: 13, lineHeight: 1.5 }}>
          <div>
            <strong>性別：</strong>
            {genderLabels[genderVariant]}
          </div>
          <div>
            <strong>人格：</strong>
            {profile
              ? `#${String(profile.index).padStart(2, '0')} · ${profile.key}`
              : 'neutral/default fallback'}
          </div>
          <div>
            <strong>素材：</strong>
            {asset.variant} atlas
          </div>
        </div>
        {asset.isFallback && (
          <p style={{ margin: '10px 0 0', color: '#9a604d', fontSize: 12 }}>
            MBTI 類型或主要場合缺漏／無效，先顯示中性預設圖，會員頁不會因此中斷。
          </p>
        )}
      </div>
    </div>
  )
}

export default PersonalityAvatarField
