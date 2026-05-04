/**
 * MBTI Quiz 計分引擎
 * ────────────────────
 * 將使用者的答案 (questionId → axis) 累加成 4 維度分數，
 * 取每維度較多票的 axis 拼成 16 型。
 */

import { MBTI_QUESTIONS, type MBTIAxis } from './mbtiQuestions'
import { MBTI_RESULTS, type MBTIType, type MBTIResultDef } from './mbtiResults'

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

export interface DimensionScores {
  EI: number  // E - I 的差值（正→E、負→I）
  SN: number
  TF: number
  JP: number
}

/** 答案：questionId → 受測者選的 axis */
export type MBTIAnswers = Record<string, MBTIAxis>

export interface ComputeResult {
  type: MBTIType
  scores: MBTIScores
  /** 4 維度淨分（正向＝第一字母佔上風）— 給後台/前台 debug 用 */
  dimensionScores: DimensionScores
}

const initScores = (): MBTIScores => ({ E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 })

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

export function getResult(type: MBTIType): MBTIResultDef {
  return MBTI_RESULTS[type]
}

/** 校驗答案完整性 */
export function isAnswersComplete(answers: MBTIAnswers): boolean {
  return MBTI_QUESTIONS.every((q) => Boolean(answers[q.id]))
}
