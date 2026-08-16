import { randomBytes } from 'crypto'
import type { BasePayload } from 'payload'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 8
const MAX_ATTEMPTS = 8

function randomCode(): string {
  const bytes = randomBytes(CODE_LENGTH)
  let out = ''
  for (let i = 0; i < CODE_LENGTH; i++) out += ALPHABET[bytes[i]! % ALPHABET.length]
  return out
}

/**
 * 產生全站唯一的會員推薦碼。8 字元、32 字母表（A-Z 去掉 I/O + 2-9 去掉 0/1），
 * 約 1.1 兆組合 → 實務上幾乎不會撞；但仍做 N 次 uniqueness retry 保險。
 * 若 MAX_ATTEMPTS 次都撞到，fallback 帶 timestamp 後綴避免整條流程掛掉。
 */
export async function generateUniqueReferralCode(payload: BasePayload): Promise<string> {
  return generateUniqueReferralCodeFor(payload, 'users')
}

/**
 * 2026-08-16 APP-API-001 步驟16：顧客搬進獨立的 customers collection 後，
 * 推薦碼唯一性要對新表檢查，不能再查 users（顧客資料已經不在那裡了）。
 * 保留參數化版本，users 版維持只是為了不動到任何還沒遷移前就呼叫過
 * 舊版函式的呼叫點（理論上遷移完成後不會再有）。
 */
export async function generateUniqueCustomerReferralCode(payload: BasePayload): Promise<string> {
  return generateUniqueReferralCodeFor(payload, 'customers')
}

async function generateUniqueReferralCodeFor(
  payload: BasePayload,
  collection: 'users' | 'customers',
): Promise<string> {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const code = randomCode()
    const hit = await payload.find({
      collection,
      where: { referralCode: { equals: code } },
      limit: 1,
      pagination: false,
      depth: 0,
    })
    if (hit.docs.length === 0) return code
  }
  return `${randomCode().slice(0, 5)}${Date.now().toString(36).toUpperCase().slice(-3)}`
}
