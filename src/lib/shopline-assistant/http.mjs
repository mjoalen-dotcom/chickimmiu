import { allowedOrigin, canonicalProduct, classifyLocal, handoffReply, mustHandoff, replyFor, TOPICS } from './core.mjs';
const MAX_BYTES = 4096;
async function bodyJson(req) {
  const reader = req.body?.getReader();
  if (!reader) throw new Error('input');
  let size = 0; const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength; if (size > MAX_BYTES) { await reader.cancel(); throw new Error('size'); } chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const part of chunks) { bytes.set(part, offset); offset += part.length; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
export function createHandler({ env = process.env, rateLimit, classifyAI, now = () => Date.now() }) {
  return async function handle(req) {
    const origin = req.headers.get('origin');
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff' };
    const json = (data, status = 200) => Response.json(data, { status, headers });
    if (env.SHOPLINE_ASSISTANT_ENABLED !== 'true') return json({ ok: false, error: 'disabled' }, 404);
    if (!allowedOrigin(origin, env)) return json({ ok: false, error: 'origin' }, 403);
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405);
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type') || '')) return json({ ok: false, error: 'content_type' }, 415);
    const budget = rateLimit(req);
    if (!budget.allowed) { headers['Retry-After'] = String(budget.retryAfter); return json({ ok: false, error: 'rate_limit' }, 429); }
    let input;
    try { input = await bodyJson(req); } catch { return json({ ok: false, error: 'invalid_input' }, 400); }
    if (!input || typeof input !== 'object' || Array.isArray(input) || typeof input.message !== 'string' || !input.message.trim() || input.message.length > 600
      || (input.pageUrl != null && canonicalProduct(input.pageUrl) === null)
      || Object.keys(input).some(k => !['message', 'pageUrl'].includes(k))) return json({ ok: false, error: 'invalid_input' }, 400);
    const q = input.message.trim();
    if (mustHandoff(q)) return json(handoffReply());
    let topic = classifyLocal(q), mode = 'guide';
    // AI only chooses a topic. Provider prose never becomes a customer-facing promise.
    if (topic === 'other' && env.SHOPLINE_ASSISTANT_AI_ENABLED === 'true' && classifyAI) {
      try {
        const selected = await classifyAI(q);
        if (TOPICS.includes(selected)) { topic = selected; mode = 'ai_routed'; }
      } catch { /* Verified guide remains available during provider failure. */ }
    }
    return json({ ...replyFor(topic, input.pageUrl, now()), mode });
  };
}
