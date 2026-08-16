const loader = String.raw`(() => {
  const script = document.currentScript;
  if (!script) return;
  const widget = script.getAttribute('data-widget');
  if (!widget) return;
  const source = new URL(script.src);
  const target = script.parentElement || document.body;
  const host = window.location.host;
  const frame = document.createElement('iframe');
  frame.title = script.getAttribute('data-title') || '社群牆';
  frame.loading = 'lazy';
  frame.style.cssText = 'border:0;display:block;width:100%;height:420px;overflow:hidden;background:transparent;';
  frame.setAttribute('scrolling', 'no');
  frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');

  const showError = () => {
    const message = document.createElement('p');
    message.textContent = '社群牆暫時無法載入，請確認網域授權。';
    message.style.cssText = 'color:#667085;font:13px/1.6 system-ui,sans-serif;padding:16px;text-align:center;';
    target.insertBefore(message, script.nextSibling);
  };

  window.addEventListener('message', (event) => {
    if (event.origin !== source.origin || !event.data || event.data.type !== 'wallgather:resize') return;
    if (event.data.widget !== widget) return;
    const height = Number(event.data.height);
    if (Number.isFinite(height) && height >= 120 && height <= 10000) frame.style.height = Math.ceil(height) + 'px';
  });

  fetch(source.origin + '/api/social-wall/embed-token?widget=' + encodeURIComponent(widget) + '&host=' + encodeURIComponent(host), {
    credentials: 'omit',
    mode: 'cors',
  })
    .then((response) => {
      if (!response.ok) throw new Error('license denied');
      return response.json();
    })
    .then((data) => {
      frame.src = data.embedUrl;
      target.insertBefore(frame, script.nextSibling);
    })
    .catch(showError);
})();`

export function GET() {
  return new Response(loader, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
