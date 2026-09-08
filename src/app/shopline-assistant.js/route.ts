import { loaderResponse } from '@/lib/shopline-assistant/widget.mjs'
export const dynamic = 'force-dynamic'
export function GET() {
  return loaderResponse(process.env.SHOPLINE_ASSISTANT_ENABLED === 'true')
}
