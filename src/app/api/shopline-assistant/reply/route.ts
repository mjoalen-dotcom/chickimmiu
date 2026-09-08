import { createHandler } from '@/lib/shopline-assistant/http.mjs'
import { checkRateLimit, clientIpForRateLimit } from '@/lib/rateLimit'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const handler = createHandler({
  rateLimit: (request: Request) => {
    const global = checkRateLimit('shopline-guide-global', 300, 60_000)
    if (!global.allowed) return global
    return checkRateLimit('shopline-guide:' + clientIpForRateLimit(request), 12, 60_000)
  },
  classifyAI: async (question: string) => {
    const { classifyAI } = await import('@/lib/shopline-assistant/model')
    return classifyAI(question)
  },
})
export const POST = handler
export const OPTIONS = handler
