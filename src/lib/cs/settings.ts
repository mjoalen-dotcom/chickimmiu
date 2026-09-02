/**
 * 站內 AI 客服的可調參數（程式常數版）
 * ─────────────────────────────────
 * Alan 2026-09-02 決定先不為了這幾個開關動 cs_settings schema，所以參數放這裡，
 * 需要臨時調整用環境變數覆寫即可（改完 pm2 restart --update-env）。
 * 之後若要後台可調，再補 cs-settings 的 ai group + 一支純加欄 migration。
 *
 * 業務時間、anti-spam、歡迎詞仍然讀 cs-settings（那些欄位本來就存在）。
 */

/** AI 自動回覆總開關；設 CS_AI_ENABLED=false 可整站關掉（訊息仍會建工單給真人） */
export const CS_AI_ENABLED = process.env.CS_AI_ENABLED !== 'false'

/** AI 答不出來、自動轉真人時接的那句話 */
export const CS_HANDOFF_MESSAGE =
  process.env.CS_HANDOFF_MESSAGE?.trim() ||
  '這個問題我幫您轉給真人客服，客服夥伴看到後會盡快回覆您 🙏'

/** 客戶自己按「轉真人客服」時的回覆 */
export const CS_HUMAN_REQUEST_MESSAGE =
  process.env.CS_HUMAN_REQUEST_MESSAGE?.trim() ||
  '好的，已經幫您轉給真人客服囉 🙋 您可以直接在這裡留言，客服會在營業時間內回覆；如果比較急，也可以點下方的 LINE 客服直接找我們。'

/** 已轉真人後，客戶再留言時的收到回條（此時 AI 不再作答） */
export const CS_HUMAN_MODE_ACK =
  process.env.CS_HUMAN_MODE_ACK?.trim() ||
  '訊息已收到，會一併轉給真人客服 🙏'

/** 對話視窗底部的免責說明 */
export const CS_DISCLAIMER =
  process.env.CS_DISCLAIMER?.trim() ||
  'AI 小幫手的回覆僅供參考，實際以官方公告與真人客服說明為準。'

/**
 * 品牌自訂的「一律轉真人」關鍵字（逗號分隔）。
 * 訂單/退款/客訴那類已在 lib/cs/aiReply 內建攔截，這裡只放品牌臨時想加的，
 * 例如：CS_ESCALATE_KEYWORDS=批發,媒體邀訪,異業合作
 */
export const CS_EXTRA_ESCALATE_KEYWORDS = (process.env.CS_ESCALATE_KEYWORDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
