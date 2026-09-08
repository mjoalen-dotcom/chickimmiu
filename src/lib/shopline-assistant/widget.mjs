// Serialized as a classic script; all browser dependencies stay inside this function.
export function mountWidget() {
  const script = document.currentScript;
  if (!script || document.getElementById('ckmu-shopping-guide')) return;
  const local = ['127.0.0.1', 'localhost'].includes(location.hostname);
  if (location.origin !== 'https://www.chickimmiu.com' && !local) return;
  // Do not inject into checkout, account, cart, or admin pages.
  if (!local && !(/^\/$/.test(location.pathname) || /^\/(products|categories|pages)(\/|$)/.test(location.pathname))) return;
  const service = new URL(script.src).origin;
  if (service !== 'https://pre.chickimmiu.com' && !(local && service === location.origin)) return;
  const host = document.createElement('div'); host.id = 'ckmu-shopping-guide';
  const root = host.attachShadow({ mode: 'open' });
  const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
  const style = el('style');
  if (script.nonce) style.nonce = script.nonce;
  style.textContent = ':host{all:initial;position:fixed;right:18px;bottom:calc(100px + env(safe-area-inset-bottom,0px));z-index:1000;font:15px/1.7 system-ui,"Microsoft JhengHei",sans-serif;color:#253b2d}*{box-sizing:border-box}button,input,a{font:inherit}button,a{touch-action:manipulation}button{cursor:pointer;background:#fff;border:1px solid #c8d0c6;border-radius:8px;color:#253b2d;padding:9px 14px}button:disabled{opacity:.5;cursor:default}button:focus-visible,input:focus-visible,a:focus-visible{outline:3px solid #b88143;outline-offset:3px}button.launch{border:0;border-radius:30px;background:#344739;color:white;box-shadow:0 4px 18px #0002}section{position:absolute;right:0;bottom:58px;width:min(370px,calc(100vw - 52px));max-height:calc(100dvh - 180px);background:#fbfcf9;box-shadow:0 10px 40px #0003;border:1px solid #d9dfd5;border-radius:14px;overflow:auto}header{padding:15px 18px;background:#344739;color:white;display:flex;align-items:center;justify-content:space-between;gap:8px}header b{font-size:17px}header button{padding:5px 9px}.body{padding:18px}p{margin:0 0 12px;white-space:pre-line}small{display:block;font-size:12px;color:#65735f;margin:12px 0}.quick{display:flex;gap:6px;flex-wrap:wrap;margin:14px 0}.quick button{font-size:13px;padding:6px 10px}form{display:flex;gap:7px;margin-top:14px}input{min-width:0;flex:1;width:100%;padding:8px 10px;border:1px solid #aab8a8;border-radius:6px;background:#fff;color:#253b2d}a{display:block;color:#344739;padding:6px 0;text-underline-offset:3px}.user{font-size:13px;color:#65735f;border-top:1px solid #d9dfd5;padding-top:12px}.status{font-size:13px;color:#7b4827}[hidden]{display:none!important}@media(max-height:540px){:host{bottom:14px}section{max-height:calc(100dvh - 90px)}}';
  root.append(style);
  const launch = el('button', '穿搭與購物協助', 'launch'); launch.type = 'button'; launch.setAttribute('aria-expanded', 'false'); launch.setAttribute('aria-controls', 'ckmu-guide-panel');
  const panel = el('section'); panel.id = 'ckmu-guide-panel'; panel.hidden = true; panel.setAttribute('aria-label', 'CHIC KIM & MIU 購物協助');
  const header = el('header'), close = el('button', '關閉'); close.type = 'button';
  header.append(el('b', 'CHIC KIM & MIU'), close);
  const body = el('div', undefined, 'body');
  body.append(el('p', '想確認尺寸、交期或場合穿搭？選一個問題開始。'), el('small', '請勿輸入姓名、電話、地址或訂單編號。此處不會建立訂單或客服工單。'));
  const quick = el('div', undefined, 'quick');
  const user = el('p', '', 'user'); user.hidden = true;
  const answer = el('div'); answer.setAttribute('aria-live', 'polite');
  const status = el('p', '', 'status'); status.setAttribute('role', 'status');
  const form = el('form'), input = el('input'), submit = el('button', '送出');
  input.maxLength = 600; input.placeholder = '輸入商品問題'; input.setAttribute('aria-label', '商品問題'); submit.type = 'submit';
  form.append(input, submit);
  let busy = false, human = false, controller;
  const buttons = [];
  const event = (action, topic) => window.dispatchEvent(new CustomEvent('ckmu:assist', { detail: { action, topic: topic || null } }));
  const setDisabled = () => { input.disabled = submit.disabled = busy || human; for (const b of buttons) b.disabled = busy || human; };
  const setOpen = (open) => { panel.hidden = !open; launch.setAttribute('aria-expanded', String(open)); (open ? close : launch).focus(); if(open) event('open'); };
  launch.addEventListener('click', () => setOpen(panel.hidden)); close.addEventListener('click', () => setOpen(false));
  root.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) setOpen(false); });
  const render = data => {
    answer.replaceChildren(el('p', data.reply));
    for (const item of data.links || []) {
      try {
        const url = new URL(item.url);
        if (!((url.origin === 'https://www.chickimmiu.com' && !url.username && !url.password) || url.href === 'https://lin.ee/AYWzgKW')) continue;
        const a = el('a', item.label + ' ↗'); a.href = url.href; a.target = '_blank'; a.rel = 'noopener noreferrer';
        a.addEventListener('click', () => event(url.hostname === 'lin.ee' ? 'line_open' : 'product_or_source_open', data.topic)); answer.append(a);
      } catch {}
    }
    if (data.note) answer.append(el('small', data.note));
    if (data.mode === 'handoff') human = true;
    setDisabled(); event('answer', data.topic);
  };
  const handoff = () => {
    human = true; controller?.abort(); busy = false; status.textContent = '';
    render({ mode: 'handoff', topic: 'human', reply: '請開啟官方 LINE，將問題與商品連結傳給客服。此視窗尚未替您送出 LINE 訊息、建立客服工單或訂單。', links: [{ label: '開啟官方 LINE', url: 'https://lin.ee/AYWzgKW' }] });
    event('human_selected');
  };
  const humanButton = el('button', '轉真人客服'); humanButton.type = 'button'; humanButton.addEventListener('click', handoff);
  async function send(message) {
    if (busy || human || !message.trim()) return;
    if (/真人|人工|退款|取消訂單|我的訂單|訂單編號|電話|手機|地址|信用卡|密碼|驗證碼|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\d[\s-]*){8,}/i.test(message)) { handoff(); return; }
    busy = true; setDisabled(); status.textContent = '正在確認資料…'; user.textContent = message; user.hidden = false;
    controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 9000);
    try {
      const pageUrl = location.origin === 'https://www.chickimmiu.com' && /^\/products\/[^/]+\/?$/.test(location.pathname) ? location.origin + location.pathname : null;
      const response = await fetch(service + '/api/shopline-assistant/reply', {
        method: 'POST', mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, pageUrl }), signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok || data.ok !== true || typeof data.reply !== 'string') throw new Error('unavailable');
      if (human) return; render(data); input.value = ''; status.textContent = '';
    } catch {
      if (!human) status.textContent = '暫時無法取得回答，問題尚未送交客服。可稍後重試，或選擇轉真人客服。';
    } finally { clearTimeout(timer); busy = false; setDisabled(); }
  }
  for (const label of ['尺寸怎麼選', '急用來得及嗎', '場合搭配', '布料怎麼洗']) {
    const b = el('button', label); b.type = 'button'; b.addEventListener('click', () => send(label)); buttons.push(b); quick.append(b);
  }
  form.addEventListener('submit', e => { e.preventDefault(); send(input.value.trim()); });
  body.append(quick, user, answer, status, form, humanButton); panel.append(header, body); root.append(panel, launch); document.body.append(host);
}
export const WIDGET_SOURCE = '(' + mountWidget.toString() + ')();';
export function loaderResponse(enabled) {
  return new Response(enabled ? WIDGET_SOURCE : '', {
    status: enabled ? 200 : 404,
    headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'cross-origin' },
  });
}
