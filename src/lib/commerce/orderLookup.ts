/**
 * 訂單查詢的識別碼比對（純函式，可單元測試）
 * ────────────────────────────────────────
 * 顧客查單時輸入的可能是手機或信箱 —— 台灣顧客普遍記得自己的手機，
 * 卻常忘記結帳時填的是哪個信箱，所以手機是主要входа。
 *
 * 手機比對要容忍各種寫法：`0912345678` / `0912-345-678` / `+886912345678` /
 * `886 912 345 678`，全部正規化成 `0912345678` 再比。
 */

export type LookupIdentifier = { kind: 'email'; value: string } | { kind: 'phone'; value: string } | null

/**
 * 台灣手機正規化 → `09xxxxxxxx`；不像手機就回 null。
 * 也接受市話等其他數字串（原樣回傳數字），由呼叫端自行比對。
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null
  let digits = String(input).replace(/\D/g, '')
  if (!digits) return null
  // +886 / 886 開頭 → 換回 0 開頭（886912345678 → 0912345678）
  if (digits.startsWith('886')) digits = '0' + digits.slice(3)
  // 有些人會打成 00886
  else if (digits.startsWith('00886')) digits = '0' + digits.slice(5)
  return digits
}

/** 兩個手機字串是否為同一支（正規化後比對） */
export function phoneMatches(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizePhone(a)
  const nb = normalizePhone(b)
  if (!na || !nb) return false
  if (na === nb) return true
  // 容忍少數只存 9 碼（省略前導 0）或帶區碼的情況：比末 9 碼
  if (na.length >= 9 && nb.length >= 9) return na.slice(-9) === nb.slice(-9)
  return false
}

/**
 * 判斷使用者輸入的是信箱還是手機。
 * 含 `@` → email；否則抽出數字，長度 >= 8 視為電話。都不像 → null。
 */
export function parseLookupIdentifier(input: string | null | undefined): LookupIdentifier {
  const raw = (input ?? '').trim()
  if (!raw) return null
  if (raw.includes('@')) {
    return /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test(raw) ? { kind: 'email', value: raw.toLowerCase() } : null
  }
  const digits = normalizePhone(raw)
  if (digits && digits.length >= 8) return { kind: 'phone', value: digits }
  return null
}
