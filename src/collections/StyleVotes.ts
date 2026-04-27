import type { Access, CollectionConfig, Where } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * 穿搭作品投票（正規化）— 7/8 社交遊戲共用，wish_pool 不用本表。
 *
 * 設計原則：
 *   1. Vote immutable — 改票先 delete 再 create
 *   2. UNIQUE (voter, submission, voteType) — 一人對一作品同類型只投一次
 *   3. afterChange 雙寫 style-submissions.voteCount（feed 排序免 aggregate）
 *   4. beforeChange 擋 voter === submission.player（no self-vote）
 *
 * ⚠️ 為了避免 high-concurrency 下 voteCount 漂移，本 PR 用 beforeChange 抓
 * 當前 submissions.voteCount 再 +1 寫回（SQLite 單寫程序下 race window 無風險）。
 * 未來若改 Postgres，用 `UPDATE ... SET vote_count = vote_count + 1` atomic。
 */

const readOwnVotes: Access = ({ req: { user } }) => {
  if (!user) return false
  const userData = user as unknown as Record<string, unknown>
  if (userData.role === 'admin') return true
  return { voter: { equals: user.id } } as Where
}

export const StyleVotes: CollectionConfig = {
  slug: 'style-votes',
  admin: {
    group: '⑤ 互動體驗',
    useAsTitle: 'voteType',
    defaultColumns: ['voter', 'submission', 'voteType', 'score', 'createdAt'],
    description: '穿搭作品投票記錄（feed 排序 / 作弊清理用）',
  },
  access: {
    read: readOwnVotes,
    create: isAdmin, // 實際投票走 server action overrideAccess
    update: () => false, // vote immutable
    delete: isAdmin,
  },
  timestamps: true,
  hooks: {
    beforeChange: [
      async ({ data, operation, req }) => {
        if (operation !== 'create' || !data) return data

        // no self-vote
        const voterId = data.voter
        const submissionId = data.submission
        if (!voterId || !submissionId) return data

        try {
          const submission = await req.payload.findByID({
            collection: 'style-submissions',
            id: submissionId,
            depth: 0,
          })
          const playerId =
            typeof submission.player === 'object' && submission.player
              ? (submission.player as { id?: number | string }).id
              : submission.player
          if (playerId !== undefined && String(playerId) === String(voterId)) {
            throw new Error('不能對自己的作品投票')
          }
        } catch (err) {
          if (err instanceof Error && err.message === '不能對自己的作品投票') {
            throw err
          }
          // findByID 失敗不擋投票（讓 FK 層攔）
          req.payload.logger.warn({
            err,
            msg: 'StyleVotes beforeChange self-vote check skipped (findByID failed)',
            submissionId,
          })
        }

        return data
      },
    ],
    afterChange: [
      // voteCount++ cache — create only
      async ({ doc, operation, req }) => {
        if (operation !== 'create') return doc
        const submissionId = (doc as { submission?: number | string }).submission
        if (!submissionId) return doc
        try {
          const current = await req.payload.findByID({
            collection: 'style-submissions',
            id: submissionId as number | string,
            depth: 0,
          })
          const currentCount =
            typeof current.voteCount === 'number' ? current.voteCount : 0
          await req.payload.update({
            collection: 'style-submissions',
            id: submissionId as number | string,
            data: { voteCount: currentCount + 1 },
            overrideAccess: true,
          })
        } catch (err) {
          req.payload.logger.error({
            err,
            msg: 'StyleVotes afterChange voteCount++ failed',
            submissionId,
          })
        }
        return doc
      },
    ],
    afterDelete: [
      // voteCount-- cache
      async ({ doc, req }) => {
        const submissionId = (doc as { submission?: number | string }).submission
        if (!submissionId) return
        try {
          const current = await req.payload.findByID({
            collection: 'style-submissions',
            id: submissionId as number | string,
            depth: 0,
          })
          const currentCount =
            typeof current.voteCount === 'number' ? current.voteCount : 0
          await req.payload.update({
            collection: 'style-submissions',
            id: submissionId as number | string,
            data: { voteCount: Math.max(0, currentCount - 1) },
            overrideAccess: true,
          })
        } catch (err) {
          req.payload.logger.error({
            err,
            msg: 'StyleVotes afterDelete voteCount-- failed',
            submissionId,
          })
        }
      },
    ],
  },
  fields: [
    {
      name: 'voter',
      label: '投票人',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },
    {
      name: 'submission',
      label: '作品',
      type: 'relationship',
      relationTo: 'style-submissions',
      required: true,
      index: true,
    },
    {
      name: 'room',
      label: '所屬房間',
      type: 'relationship',
      relationTo: 'style-game-rooms',
      index: true,
      admin: {
        description: 'denormalize — 便於 per-room 查詢（從 submission.room 複製）',
      },
    },
    {
      name: 'voteType',
      label: '投票類型',
      type: 'select',
      required: true,
      defaultValue: 'like',
      options: [
        { label: 'PK 挑選', value: 'pk_pick' },
        { label: '讚', value: 'like' },
        { label: '星星', value: 'star' },
        { label: '加權分', value: 'score' },
      ],
    },
    {
      name: 'score',
      label: '加權分數',
      type: 'number',
      min: 1,
      max: 10,
      admin: {
        description: 'voteType=score 時必填，1–10 分',
      },
    },
    {
      name: 'metadata',
      label: '額外資料',
      type: 'json',
    },
  ],
}
