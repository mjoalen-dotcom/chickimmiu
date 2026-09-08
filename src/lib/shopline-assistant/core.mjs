export const SITE = 'https://www.chickimmiu.com';
export const LINE = 'https://lin.ee/AYWzgKW';
export const REVIEWED = '2026-09-08T08:00:00+08:00';
const FAQ = SITE + '/pages/faqs';
export const TOPICS = ['size', 'delivery', 'outfit', 'care', 'origin', 'member', 'policy', 'other'];
const link = (label, path) => ({ label, url: SITE + path });
export const ANSWERS = {
  size: { reply: '請先確認商品與想選的尺寸，再比較您穿得舒服的衣服平量：胸寬、腰寬、肩寬與衣長。身高體重只能輔助；目前沒有這款的逐尺寸量測資料，還不能替您判定合身尺寸。可把商品連結與平量帶給客服確認。', links: [link('查看購物說明', '/pages/faqs')] },
  delivery: { reply: '官網購物說明的預購等待通常為 7–14 個工作天，遇缺料等情況可能延長。這不是保證送達日。急用請先提供使用日期、寄送地區與顏色尺寸，並從現貨專區挑選；各規格可售量與出貨安排仍需確認。', links: [link('現貨速到專區', '/pages/instockckmu'), link('交期說明', '/pages/faqs')] },
  outfit: { reply: '商務提案可先看正式套裝；婚宴或主持可先看正式洋裝。請再提供場合、整套預算與使用日期，讓客服核對尺寸和交期。以下是分類入口，尚未替您組成可直接結帳的搭配。', links: [link('正式套裝', '/categories/formal-set-suits'), link('婚宴・正式洋裝', '/pages/wedding-formal-dress')] },
  care: { reply: '布料是否易皺、可否水洗或需乾洗，要依該款材質與洗標確認。目前沒有已核對的逐款保養資料；請將商品連結帶給客服確認，避免用其他款的洗法套用。', links: [link('商品列表', '/products')] },
  origin: { reply: '商品產地請依各款頁面標示確認。法式復古芭蕾舞鞋的官網說明標示委託中國製作，不能把全站商品一概視為韓國製造。', links: [link('法式復古芭蕾舞鞋', '/products/法式復古芭蕾舞鞋-1'), link('商品來源說明', '/pages/faqs')] },
  member: { reply: '會員權益請以目前官網的說明與您登入後的帳戶為準。此導購沒有讀取個人等級、點數或專屬價格；需要核對時請開啟官方 LINE。', links: [link('官網購物說明', '/pages/faqs')] },
  policy: { reply: '退換貨適用條件請查看官網購物說明，並由客服依您的商品和訂單核對。此處不受理退款或變更訂單；請透過官方 LINE 提出需求。', links: [link('退換貨說明', '/pages/faqs')] },
  other: { reply: '我可以協助查看尺寸挑選、預購交期、場合分類與保養資料來源。這個問題目前沒有足夠資料，請開啟官方 LINE 讓客服確認。', links: [link('官網購物說明', '/pages/faqs')] },
};
export function canonicalProduct(value) {
  if (typeof value !== 'string' || value.length > 2000) return null;
  try {
    const u = new URL(value);
    if (u.origin !== SITE || u.username || u.password || !/^\/products\/[^/]+\/?$/.test(u.pathname)) return null;
    u.search = ''; u.hash = ''; return u.href;
  } catch { return null; }
}
export function mustHandoff(q) {
  return /真人|人工|專人|客服人員|找客服|轉客服|轉接|不要機器人|我的訂單|查訂單|訂單編號|物流編號|包裹|退款|取消訂單|我要退|我要換|改地址|投訴|客訴|申訴|我的點數|我的等級|電話|手機|地址|身分證|信用卡|密碼|驗證碼|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\d[\s-]*){8,}/i.test(q);
}
export function classifyLocal(q) {
  if (/何時|下週|下周|幾天|到貨|交期|來得及|現貨|庫存|剩幾|追加|預購/.test(q)) return 'delivery';
  if (/尺寸|身高|胸|腰|肩|合身|偏小|平量/.test(q)) return 'size';
  if (/產地|哪[裡裏]製|韓國製|中國製|製造|正韓/.test(q)) return 'origin';
  if (/洗|皺|布料|材質|保養/.test(q)) return 'care';
  if (/整套|搭配|提案|婚宴|上班|主持|套裝|會議/.test(q)) return 'outfit';
  if (/退換|退貨|換貨/.test(q)) return 'policy';
  if (/會員|點數|禮遇|優惠|等級/.test(q)) return 'member';
  return 'other';
}
export function replyFor(topic, pageUrl, now = Date.now()) {
  const stale = now - Date.parse(REVIEWED) > 30 * 86400000 || now < Date.parse(REVIEWED);
  const selected = TOPICS.includes(topic) ? topic : 'other';
  const answer = stale ? { reply: '導購資料需要重新核對，請以官網商品頁及購物說明為準，或開啟官方 LINE 確認。', links: [link('官網購物說明', '/pages/faqs')] } : ANSWERS[selected];
  const product = canonicalProduct(pageUrl);
  return { ok: true, mode: 'guide', topic: stale ? 'other' : selected, ...answer,
    links: [...(product ? [{ label: '返回正在看的商品', url: product }] : []), ...answer.links, { label: '開啟官方 LINE', url: LINE }],
    reviewedAt: REVIEWED, inventory: null, orderAccess: false,
    note: '未連接即時庫存與個人訂單；購買條件以 SHOPLINE 商品頁及結帳結果為準。' };
}
export function handoffReply() {
  return { ok: true, mode: 'handoff', topic: 'human', reply: '這項需求請由真人客服確認。請開啟官方 LINE，將問題與商品連結傳給客服。此視窗尚未替您送出 LINE 訊息、建立客服工單或訂單。', links: [{ label: '開啟官方 LINE', url: LINE }], inventory: null, orderAccess: false };
}
export function allowedOrigin(origin, env = process.env) {
  if (origin === SITE) return true;
  return env.NODE_ENV !== 'production' && ['http://127.0.0.1:4318', 'http://127.0.0.1:4319', 'http://localhost:4318'].includes(origin);
}
