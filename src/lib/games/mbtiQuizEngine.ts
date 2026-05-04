/**
 * MBTI Quiz 計分引擎
 * ────────────────────
 * 28 題基本 MBTI → 16 型；
 * 4 題場合題（PR-Y 加） → primaryOccasion；
 * 兩者組合 → 64 sub-personalities
 */

import {
  MBTI_QUESTIONS,
  MBTI_LIFESTYLE_QUESTIONS,
  type MBTIAxis,
  type LifestyleOccasion,
} from './mbtiQuestions'
import { MBTI_RESULTS, type MBTIType, type MBTIResultDef } from './mbtiResults'
import {
  OCCASION_LIST,
  getSubResult,
  type OccasionMode,
  type MBTISubResult,
} from './mbtiOccasions'

export interface MBTIScores {
  E: number
  I: number
  S: number
  N: number
  T: number
  F: number
  J: number
  P: number
}

export interface OccasionScores {
  urban: number
  vacation: number
  party: number
  cozy: number
}

export interface DimensionScores {
  EI: number  // E - I 的差值（正→E、負→I）
  SN: number
  TF: number
  JP: number
}

/** 答案：questionId → 受測者選的 axis */
export type MBTIAnswers = Record<string, MBTIAxis>

/** 場合題答案：questionId → 選的 occasion */
export type LifestyleAnswers = Record<string, LifestyleOccasion>

export interface ComputeResult {
  type: MBTIType
  scores: MBTIScores
  /** 4 維度淨分（正向＝第一字母佔上風）— 給後台/前台 debug 用 */
  dimensionScores: DimensionScores
}

export interface ComputeResultWithOccasion extends ComputeResult {
  primaryOccasion: OccasionMode
  occasionScores: OccasionScores
  /** 對應 (type, primaryOccasion) 的 sub-personality 結果 */
  subResult: MBTISubResult
}

const initScores = (): MBTIScores => ({ E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 })
const initOccasion = (): OccasionScores => ({ urban: 0, vacation: 0, party: 0, cozy: 0 })

export function computeMBTIType(answers: MBTIAnswers): ComputeResult {
  const scores = initScores()

  for (const q of MBTI_QUESTIONS) {
    const chosen = answers[q.id]
    if (!chosen) continue
    if (scores[chosen] !== undefined) {
      scores[chosen]++
    }
  }

  // 平手時偏向第一字母 (E/S/T/J) — MBTI 標準慣例
  const ei: 'E' | 'I' = scores.E >= scores.I ? 'E' : 'I'
  const sn: 'S' | 'N' = scores.S >= scores.N ? 'S' : 'N'
  const tf: 'T' | 'F' = scores.T >= scores.F ? 'T' : 'F'
  const jp: 'J' | 'P' = scores.J >= scores.P ? 'J' : 'P'

  const type = `${ei}${sn}${tf}${jp}` as MBTIType

  return {
    type,
    scores,
    dimensionScores: {
      EI: scores.E - scores.I,
      SN: scores.S - scores.N,
      TF: scores.T - scores.F,
      JP: scores.J - scores.P,
    },
  }
}

/** 從 4 題 lifestyle 答案推算 primaryOccasion */
export function computePrimaryOccasion(
  lifestyleAnswers: LifestyleAnswers,
): { primaryOccasion: OccasionMode; occasionScores: OccasionScores } {
  const occasionScores = initOccasion()

  for (const q of MBTI_LIFESTYLE_QUESTIONS) {
    const chosen = lifestyleAnswers[q.id]
    if (!chosen) continue
    if (occasionScores[chosen] !== undefined) {
      occasionScores[chosen]++
    }
  }

  // 找最高分；平手時依 OCCASION_LIST 順序（urban → vacation → party → cozy）
  let primaryOccasion: OccasionMode = 'urban'
  let maxScore = -1
  for (const occ of OCCASION_LIST) {
    if (occasionScores[occ] > maxScore) {
      maxScore = occasionScores[occ]
      primaryOccasion = occ
    }
  }
  return { primaryOccasion, occasionScores }
}

/** 整合：MBTI 答案 + lifestyle 答案 → MBTI64 完整結果 */
export function computeMBTI64(
  answers: MBTIAnswers,
  lifestyleAnswers: LifestyleAnswers,
): ComputeResultWithOccasion {
  const base = computeMBTIType(answers)
  const { primaryOccasion, occasionScores } = computePrimaryOccasion(lifestyleAnswers)
  const subResult = getSubResult(base.type, primaryOccasion)
  return {
    ...base,
    primaryOccasion,
    occasionScores,
    subResult,
  }
}

export function getResult(type: MBTIType): MBTIResultDef {
  return MBTI_RESULTS[type]
}

/** 校驗答案完整性 */
export function isAnswersComplete(answers: MBTIAnswers): boolean {
  return MBTI_QUESTIONS.every((q) => Boolean(answers[q.id]))
}

export function isLifestyleAnswersComplete(answers: LifestyleAnswers): boolean {
  return MBTI_LIFESTYLE_QUESTIONS.every((q) => Boolean(answers[q.id]))
}
