/**
 * POST /api/ops-copilot/chat
 * ─────────────────────────────────────
 * 營運對話。Body：{ messages: [{ role: 'user'|'assistant', content: string }] }
 *
 * 工具全部唯讀（見 lib/ops-copilot/tools.ts），唯一會寫入的是 propose_action，
 * 而它只建立 pending 提案 —— 真正執行還是要人在後台按。
 *
 * 只給 admin。
 */

import { NextResponse } from 'next/server'

import { getAnthropic, runToolLoop } from '@/lib/ops-copilot/llm'
import { buildTools } from '@/lib/ops-copilot/tools'
import { requireAdmin } from '../_auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const MAX_TURNS = 20
const MAX_CHARS = 4000

const SYSTEM = `你是 CHIC KIM & MIU（韓系女裝電商，台灣）的營運 AI 助理，服務對象是創辦人 Alan。

你能做什麼：
- 用工具查站內真實資料（商品、訂單、會員、發票、庫存、競品價、穿搭投票、信用分數、提領）
- 產生行動提案（propose_action），排進待辦等 Alan 核准

你**不能**做什麼：
- 你沒有任何直接修改資料的能力。propose_action 只是排隊，不是執行。
  如果 Alan 說「幫我改價」，正確做法是提一個 adjust_product_price 提案並告訴他去按核准。

回答規則：
1. 繁體中文、台灣用語。結論先行 → 數字 → 缺口 → 下一步。
2. **所有數字都必須來自工具回傳結果。** 沒查到就說沒查到，絕對不要估、不要編。
   如果工具回傳 truncated: true，要明講「這是取樣結果，不是全量」。
3. 不知道就問，不要用模糊敘述掩蓋。
4. 語氣是已經看過報表的營運主管，不是客服。不要說「我可以幫您…」「需要我做什麼嗎」。
5. 需要多個資料點時，同一輪把工具一起呼叫，不要一問一答慢慢查。
6. users 資料的 email/電話/地址已被系統遮蔽，這是刻意的，不要嘗試繞過。`

export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  if (!getAnthropic()) {
    return NextResponse.json(
      { error: '未設定 ANTHROPIC_API_KEY，營運助理對話功能停用' },
      { status: 503 },
    )
  }

  let body: { messages?: Array<{ role?: string; content?: string }> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'body 不是合法 JSON' }, { status: 400 })
  }

  const raw = Array.isArray(body.messages) ? body.messages : []
  const messages = raw
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_TURNS)
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: String(m.content).slice(0, MAX_CHARS),
    }))

  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    return NextResponse.json({ error: '最後一則必須是 user 訊息' }, { status: 400 })
  }

  try {
    const result = await runToolLoop({
      system: SYSTEM,
      messages,
      tools: buildTools(auth.payload, auth.userId),
    })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[ops-copilot] chat failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '對話失敗' },
      { status: 500 },
    )
  }
}
