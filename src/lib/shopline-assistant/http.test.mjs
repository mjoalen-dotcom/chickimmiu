import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from './http.mjs';
import { canonicalProduct, classifyLocal, mustHandoff, replyFor, SITE, TOPICS } from './core.mjs';
import { loaderResponse, WIDGET_SOURCE } from './widget.mjs';
const enabled = { SHOPLINE_ASSISTANT_ENABLED: 'true', NODE_ENV: 'production' };
const make = (override = {}) => createHandler({ env: enabled, rateLimit: () => ({ allowed: true }), now: () => Date.parse('2026-09-09'), ...override });
const req = (body = { message: '尺寸怎麼選' }, options = {}) => new Request('https://pre.chickimmiu.com/api/shopline-assistant/reply', { method: 'POST', headers: { 'origin': SITE, 'content-type': 'application/json' }, body: JSON.stringify(body), ...options });
test('disabled removes loader bytes and rejects API before processing', async () => {
  const result = loaderResponse(false); assert.equal(result.status, 404); assert.equal(await result.text(), '');
  assert.equal((await make({ env: {}, rateLimit: () => { throw Error('should not run'); } })(req())).status, 404);
});
test('loader is valid JavaScript and has no credentials or automatic API on load', () => { new Function(WIDGET_SOURCE); assert.match(WIDGET_SOURCE, /credentials: 'omit'/); });
test('exact browser origin, not suffix, null, http or pre', async () => {
  for (const origin of [SITE + '.evil.test', 'null', 'http://www.chickimmiu.com', 'https://pre.chickimmiu.com', 'https://chickimmiu.com']) {
    const r = await make()(req({}, { headers: { origin, 'content-type': 'application/json' } })); assert.equal(r.status, 403); assert.equal(r.headers.get('access-control-allow-origin'), null);
  }
});
test('preflight has exact CORS and never credential permission', async () => {
  const r = await make()(req(null, { method: 'OPTIONS', body: undefined })); assert.equal(r.status, 204); assert.equal(r.headers.get('access-control-allow-origin'), SITE); assert.equal(r.headers.get('access-control-allow-credentials'), null);
});
test('enforces JSON and rate limit', async () => {
  assert.equal((await make()(req({}, { headers: { origin: SITE, 'content-type': 'text/plain' } }))).status, 415);
  const r = await make({ rateLimit: () => ({ allowed: false, retryAfter: 35 }) })(req()); assert.equal(r.status, 429); assert.equal(r.headers.get('retry-after'), '35');
});
test('limits streamed bytes, question length, fields and page URLs', async () => {
  for (const body of [{ message: '' }, { message: 'a'.repeat(601) }, { message: 'hello', orderId: '123' }, { message: 'hello', pageUrl: 'http://169.254.169.254/latest' }, ['hello'], null]) assert.equal((await make()(req(body))).status, 400);
  assert.equal((await make()(req({}, { body: ' '.repeat(4100) }))).status, 400);
});
test('canonical product drops query/hash and rejects credentials and private pages', () => {
  assert.equal(canonicalProduct(SITE + '/products/dress?email=private#s'), SITE + '/products/dress');
  for (const u of ['https://name@www.chickimmiu.com/products/a', SITE + '/admin', SITE + '.evil/products/a', SITE + '/products/a/extra']) assert.equal(canonicalProduct(u), null);
});
test('private/order/human questions never reach provider', async () => {
  const handler = make({ env: { ...enabled, SHOPLINE_ASSISTANT_AI_ENABLED: 'true' }, classifyAI: () => { throw Error('provider must not run'); } });
  for (const message of ['我要真人客服', '我的訂單在哪', '退款進度', '我的電話 0912-345-678', 'email test@example.com']) { assert.equal(mustHandoff(message), true); const data = await (await handler(req({ message }))).json(); assert.equal(data.mode, 'handoff'); assert.match(data.reply, /尚未/); }
});
test('stock always unknown, no model needed for established topics', async () => {
  const data = await (await make()(req({ message: '現在有現貨嗎' }))).json(); assert.equal(data.inventory, null); assert.equal(data.orderAccess, false); assert.equal(data.topic, 'delivery');
});
test('expired knowledge fails to source links without stale numeric promise', () => {
  const r = replyFor('delivery', null, Date.parse('2026-11-01')); assert.doesNotMatch(r.reply, /7|14/); assert.match(r.reply, /重新核對/);
});
test('AI can select only reviewed topic; its prose is never rendered', async () => {
  const env = { ...enabled, SHOPLINE_ASSISTANT_AI_ENABLED: 'true' };
  let calls = 0; const h = make({ env, classifyAI: async () => { calls++; return 'size'; } });
  const data = await (await h(req({ message: 'Could you help me choose a fit?' }))).json(); assert.equal(calls, 1); assert.equal(data.topic, 'size'); assert.equal(data.mode, 'ai_routed');
  const bad = make({ env, classifyAI: async () => 'guaranteed free shipping' });
  const b = await (await bad(req({ message: 'help' }))).json(); assert.equal(b.topic, 'other'); assert.doesNotMatch(b.reply, /guaranteed/);
});
test('provider disabled or failed degrades to verified guide', async () => {
  const env = { ...enabled, SHOPLINE_ASSISTANT_AI_ENABLED: 'true' };
  const fail = make({ env, classifyAI: async () => { throw Error('timeout'); } });
  assert.equal((await (await fail(req({ message: 'help' }))).json()).mode, 'guide');
  const off = make({ classifyAI: () => { throw Error('must not run'); } });
  assert.equal((await (await off(req({ message: 'help' }))).json()).mode, 'guide');
});
test('common intent routes and reply links are bounded', () => {
  for (const q of ['尺寸', '下週到貨', '婚宴搭配', '水洗', '韓國製造', '會員優惠', '退換貨', 'hello']) assert.ok(TOPICS.includes(classifyLocal(q)));
  for (const topic of TOPICS) for (const l of replyFor(topic).links) assert.ok(l.url.startsWith(SITE + '/') || l.url === 'https://lin.ee/AYWzgKW');
});
