/* Allarbaa.cloud - Cloudflare Pages Worker (Production Ready & Fully Audited)
   Author: Ticher
   Domain: https://allarbaa.cloud
   Bindings required in Cloudflare Dashboard:
     - KV Namespace Binding: BLOG
     - Environment Variable: ADMIN_PASSWORD (in Pages > Settings > Environment variables)

   SEO / safety update:
     - slug + excerpt + url stored on every post; /p/:slug redirects to /p/:id
     - related posts (by tags) on every article page and in GET /api/posts/:id
     - full per-post metadata (title, description, canonical, OG, Twitter, JSON-LD) in server HTML
     - homepage gets crawlable "Popular reads" links; sitemap has lastmod + images
     - owner visits are never counted (admin key, x-no-hit / x-admin-visit headers, or admin cookie)
     - custom code is injected on the server only (the page no longer injects it a second time)
     - wrong admin keys are rate limited per IP

   Growth update:
     - /archive, /tags, /tag/:tag, /store, /tools, /tools/:tool pages built on the server (crawlable)
     - scheduled publishing (publishAt), product cards [[card:...]], paged backup/restore API
*/

const DEFAULT_SITE = 'https://allarbaa.cloud';
const NAME = 'Allarbaa.cloud';
const AUTHOR_NAME = 'Ticher';
const ID_RE = /^[a-z0-9][a-z0-9-]{2,90}$/;
const BOT_RE = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|uptime|curl|wget|bytespider/i;
const RX_TYPES = ['helpful', 'fire', 'applause', 'heart'];
const LOGIN_MAX_FAILS = 8; // wrong admin keys allowed per IP ...
const LOGIN_WINDOW = 900; // ... within this many seconds
// Cookie that marks the owner's browser so direct page visits are never counted
const ADMIN_COOKIE = 'allarbaa_admin=1; Path=/; Max-Age=31536000; Secure; HttpOnly; SameSite=Lax';

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const HEAD_RE = /<!--SEO_HEAD_START-->[\s\S]*?<!--SEO_HEAD_END-->/;

const DEFAULTS = {
  social: { fb: '', wa: 'https://wa.me/2347069444260', ig: '', x: '', yt: '', li: '', tt: '', tg: '', coffee: '' },
  payments: [],
  customCode: { css: '', head: '', bodyHtml: '', bodyStart: '', html: '', bodyJs: '' },
  authorBio: 'Ticher — Software engineer, researcher, and author dedicated to practical tech blogging, health research, and digital publishing.',
  email: 'ticher218@gmail.com',
  waChannel: '',
  logo: '',
  stores: {
    amazon: { link: 'https://www.amazon.com/?tag=3eesher216-20', id: '3eesher216-20', img: 0 },
    jumia: { link: 'https://www.jumia.com.ng/', id: '', img: 0 },
    konga: { link: 'https://www.konga.com/', id: '', img: 0 }
  },
  customStores: [],
  phones: ['+2347069444260', '+2349017668973']
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
      'access-control-allow-origin': '*'
    }
  });

const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const safeUrl = (u) => {
  try {
    const x = new URL(String(u).trim());
    return x.protocol === 'http:' || x.protocol === 'https:' ? x.href : '';
  } catch (e) {
    return '';
  }
};

const normUrl = (u) => {
  u = String(u || '').trim().slice(0, 500);
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  return safeUrl(u);
};

function render(text) {
  let s = esc(String(text || '').replace(/\r\n?/g, '\n'));
  const blocks = [];
  s = s.replace(/```([\s\S]*?)```/g, (m, c) => {
    blocks.push(c.replace(/^\n+|\n+$/g, ''));
    return '\n\n@@CODE' + (blocks.length - 1) + '@@\n\n';
  });
  const cards = [];
  s = s.replace(/\[\[card:([^\]]+)\]\]/g, (m, inner) => {
    const c = cardParts(inner.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
    if (!c) return '';
    cards.push(c);
    return '\n\n@@CARD' + (cards.length - 1) + '@@\n\n';
  });
  s = s.replace(/\[\[btn:([^|\]]+)\|([^\]]+)\]\]/g, (m, label, u) => {
    const href = safeUrl(u.replace(/&amp;/g, '&'));
    return href
      ? `\n\n<a class="aff-btn" href="${esc(href)}" target="_blank" rel="sponsored nofollow noopener">${label.trim()}</a>\n\n`
      : label;
  });
  s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, label, u) => {
    const href = safeUrl(u.replace(/&amp;/g, '&'));
    return href ? `<a href="${esc(href)}" target="_blank" rel="sponsored nofollow noopener">${label}</a>` : label;
  });
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  return s
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => {
      const cm = b.match(/^@@CODE(\d+)@@$/);
      if (cm) return `<pre><code>${blocks[+cm[1]] || ''}</code></pre>`;
      const cd = b.match(/^@@CARD(\d+)@@$/);
      if (cd) return productCardHtml(cards[+cd[1]], false);
      return /^## /.test(b) ? `<h3>${b.slice(3)}</h3>` : `<p>${b.replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');
}

const excerpt = (t, n = 160) =>
  Array.isArray(t) ? excerptText(t[0] || '', n) : excerptText(t, n);

const excerptText = (t, n = 160) =>
  String(t || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\[\[(?:btn|card):[^\]]*\]\]/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, n);

// Short, clean description for meta tags (cuts on a word boundary)
function makeExcerpt(text, length = 160) {
  const t = Array.isArray(text) ? text[0] || '' : text;
  const s = excerptText(t, 100000);
  if (s.length <= length) return s;
  let cut = s.slice(0, length);
  const sp = cut.lastIndexOf(' ');
  if (sp > length * 0.6) cut = cut.slice(0, sp);
  return cut.replace(/[\s,;:.\-]+$/, '') + '\u2026';
}

// URL-friendly slug from a title (ASCII only, max ~60 chars, whole words)
function slugify(text) {
  let s = String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['\u2019`]/g, '')
    .replace(/[^\x00-\x7f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (s.length > 60) {
    s = s.slice(0, 60);
    const i = s.lastIndexOf('-');
    if (i > 20) s = s.slice(0, i);
  }
  return s.replace(/-+$/, '');
}

function uniqueSlug(idx, base, selfId) {
  if (!base || base.length < 3) return '';
  let s = base;
  let n = 2;
  while (idx.some((p) => (p.slug === s || p.id === s) && p.id !== selfId)) s = base.slice(0, 55) + '-' + n++;
  return s;
}

// Related posts: most shared tags first, newest as tie-breaker (also fills with latest posts)
async function getRelatedPosts(env, cur, limit = 4) {
  if (!env.BLOG || !cur) return [];
  const tags = new Set((cur.tags || []).map((t) => String(t).toLowerCase()));
  const pool = (await getIndex(env)).filter((p) => p.id !== cur.id && p.type !== 'product' && isLive(p));
  return pool
    .map((p) => ({ p, s: (p.tags || []).filter((t) => tags.has(String(t).toLowerCase())).length }))
    .sort((a, b) => b.s - a.s || new Date(b.p.date || 0) - new Date(a.p.date || 0))
    .slice(0, limit)
    .map(({ p }) => ({ id: p.id, slug: p.slug || '', title: p.title, excerpt: p.excerpt || '', type: p.type, imgCount: p.imgCount || 0 }));
}

const makeId = (title) => {
  const slug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\x00-\x7f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  return Date.now().toString(36) + (slug ? '-' + slug : '');
};

// constant-time string compare
const safeEqual = (a, b) => {
  a = String(a);
  b = String(b);
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
};

const authed = (request, env) => {
  const k = request.headers.get('x-admin-key') || '';
  return !!env.ADMIN_PASSWORD && safeEqual(k, env.ADMIN_PASSWORD);
};

const hasAdminCookie = (request) => /(?:^|;\s*)allarbaa_admin=1(?:;|$)/.test(request.headers.get('cookie') || '');

// Real visitors only: never count the owner, bots, or flagged requests
const skipCount = (request, env) => {
  if (authed(request, env)) return true;
  if (hasAdminCookie(request)) return true;
  const hd = request.headers;
  if (hd.get('x-no-count') === '1' || hd.get('x-no-hit') === '1' || hd.get('x-admin-visit') === '1') return true;
  const ua = hd.get('user-agent') || '';
  if (!ua || BOT_RE.test(ua)) return true;
  return false;
};

// Brute-force guard: count wrong admin keys per IP in KV (auto-expires)
async function isBlocked(env, ip) {
  if (!env.BLOG) return false;
  try {
    return (parseInt((await env.BLOG.get('rl:' + ip)) || '0', 10) || 0) >= LOGIN_MAX_FAILS;
  } catch (e) {
    return false;
  }
}
async function noteFail(env, ip) {
  if (!env.BLOG) return;
  try {
    const n = (parseInt((await env.BLOG.get('rl:' + ip)) || '0', 10) || 0) + 1;
    await env.BLOG.put('rl:' + ip, String(n), { expirationTtl: LOGIN_WINDOW });
  } catch (e) {}
}

async function incrementPostView(env, id) {
  if (!env.BLOG || !ID_RE.test(id)) return 0;
  try {
    const raw = await env.BLOG.get(`post:${id}`);
    if (!raw) return 0;
    const p = JSON.parse(raw);
    const newViews = (parseInt(p.views, 10) || 0) + 1;
    p.views = newViews;
    await env.BLOG.put(`post:${id}`, JSON.stringify(p));

    const idx = await getIndex(env);
    const j = idx.findIndex((x) => x.id === id);
    if (j >= 0) {
      idx[j].views = newViews;
      await env.BLOG.put('index', JSON.stringify(idx));
    }
    return newViews;
  } catch (err) {
    return 0;
  }
}

async function getIndex(env) {
  try {
    const data = await env.BLOG.get('index');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

async function putIndex(env, idx) {
  idx.sort((a, b) => (new Date(b.date || 0) > new Date(a.date || 0) ? 1 : -1));
  await env.BLOG.put('index', JSON.stringify(idx));
}

async function getRx(env, id) {
  const out = {};
  let r = {};
  try {
    r = JSON.parse((await env.BLOG.get('rx:' + id)) || '{}');
  } catch (e) {}
  RX_TYPES.forEach((t) => (out[t] = Math.max(0, parseInt(r[t], 10) || 0)));
  return out;
}

async function getSettings(env) {
  let s = {};
  try {
    s = JSON.parse((await env.BLOG.get('settings')) || '{}');
  } catch (e) {}
  const stores = {};
  for (const k of Object.keys(DEFAULTS.stores)) {
    let v = s.stores && s.stores[k];
    if (typeof v === 'string') v = { link: v };
    stores[k] = { ...DEFAULTS.stores[k], ...(v || {}) };
  }
  let payments = Array.isArray(s.payments) ? s.payments : [];
  if (!payments.length && s.bank && s.bank.number) {
    payments = [{ type: 'bank', label: s.bank.bankName || 'Bank transfer', value: [s.bank.number, s.bank.name].filter(Boolean).join(' \u2014 ') }];
  }
  return {
    social: { ...DEFAULTS.social, ...(s.social || {}) },
    stores,
    customStores: Array.isArray(s.customStores) ? s.customStores : [],
    phones: Array.isArray(s.phones) ? s.phones : DEFAULTS.phones,
    payments,
    customCode: { ...DEFAULTS.customCode, ...(s.customCode || {}) },
    authorBio: typeof s.authorBio === 'string' ? s.authorBio : DEFAULTS.authorBio,
    email: typeof s.email === 'string' ? s.email : DEFAULTS.email,
    // an old placeholder link that was never a real channel is ignored
    waChannel: typeof s.waChannel === 'string' && !/0029Va9Allarbaa/.test(s.waChannel) ? s.waChannel : DEFAULTS.waChannel,
    logo: typeof s.logo === 'string' ? s.logo : ''
  };
}

const HANDLE = {
  fb: (h) => 'https://facebook.com/' + h,
  ig: (h) => 'https://instagram.com/' + h,
  x: (h) => 'https://x.com/' + h,
  yt: (h) => 'https://youtube.com/@' + h,
  li: (h) => 'https://linkedin.com/in/' + h,
  tt: (h) => 'https://tiktok.com/@' + h,
  tg: (h) => 'https://t.me/' + h
};

const dataUrlOk = (s, max) => typeof s === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(s) && s.length < max;
const PAY_TYPES = ['bank', 'ussd', 'paypal', 'stripe', 'wallet', 'other'];
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/;

function cleanSettings(b, existing) {
  const has = (k) => Object.prototype.hasOwnProperty.call(b, k);
  const out = { social: {}, stores: {}, phones: [] };
  const src = (b && b.social) || {};
  for (const k of Object.keys(DEFAULTS.social)) {
    const v = String(src[k] || '').trim().slice(0, 300);
    if (!v) {
      out.social[k] = '';
    } else if (k === 'coffee') {
      out.social[k] = normUrl(v);
    } else if (k === 'wa' && !/^https?:\/\//i.test(v) && /^[+\d\s()-]{6,}$/.test(v)) {
      out.social[k] = 'https://wa.me/' + v.replace(/\D/g, '');
    } else if (
      HANDLE[k] &&
      !/^https?:\/\//i.test(v) &&
      !/[\/]/.test(v) &&
      !/^www\./i.test(v) &&
      !/\.(com|net|org|me|tv|be|co|io|app|link)$/i.test(v) &&
      /^@?[A-Za-z0-9._-]{2,60}$/.test(v)
    ) {
      out.social[k] = HANDLE[k](v.replace(/^@/, ''));
    } else {
      out.social[k] = normUrl(v);
    }
  }
  const st = (b && b.stores) || {};
  for (const k of Object.keys(DEFAULTS.stores)) {
    const o = st[k] || {};
    out.stores[k] = {
      link: normUrl(o.link) || DEFAULTS.stores[k].link,
      id: String(o.id || (k === 'amazon' ? '3eesher216-20' : '')).replace(/[^A-Za-z0-9._-]/g, '').slice(0, 60),
      img: (existing && existing.stores[k] && existing.stores[k].img) || 0
    };
  }
  out.customStores = (Array.isArray(b.customStores) ? b.customStores : (existing && existing.customStores) || [])
    .slice(0, 20)
    .map((s) => ({
      name: String((s && s.name) || '').trim().slice(0, 60),
      link: normUrl((s && s.link) || ''),
      id: String((s && s.id) || '').trim().replace(/[^A-Za-z0-9._-]/g, '').slice(0, 60)
    }))
    .filter((s) => s.name && s.link);
  if (has('phones')) {
    const ph = (Array.isArray(b.phones) ? b.phones : []).slice(0, 5);
    out.phones = ph.map((p) => String(p).replace(/[^0-9+ ()-]/g, '').trim().slice(0, 20)).filter(Boolean);
  } else out.phones = existing.phones;

  if (has('payments')) {
    out.payments = (Array.isArray(b.payments) ? b.payments : [])
      .slice(0, 12)
      .map((p) => ({
        type: PAY_TYPES.includes(p && p.type) ? p.type : 'other',
        label: String((p && p.label) || '').trim().slice(0, 60),
        value: String((p && p.value) || '').trim().slice(0, 300)
      }))
      .filter((p) => p.label || p.value);
  } else out.payments = existing.payments;

  if (has('customCode')) {
    const cc = b.customCode || {};
    out.customCode = {
      css: String(cc.css || ''),
      head: String(cc.head || ''),
      bodyStart: String(cc.bodyStart || ''),
      html: String(cc.html || ''),
      // legacy field: dropped once the new boxes are used, so nothing is injected twice
      bodyHtml: 'bodyStart' in cc || 'html' in cc ? '' : String(cc.bodyHtml || cc.body || ''),
      bodyJs: String(cc.bodyJs || '')
    };
  } else out.customCode = existing.customCode;

  out.authorBio = has('authorBio') ? String(b.authorBio || '').trim().slice(0, 800) : existing.authorBio;

  if (has('email')) {
    const e = String(b.email || '').trim().slice(0, 200);
    out.email = EMAIL_RE.test(e) ? e : existing.email;
  } else out.email = existing.email;

  out.waChannel = has('waChannel') ? normUrl(b.waChannel) : existing.waChannel;

  if (has('logo')) {
    if (b.logo === '' || b.logo === null) out.logo = '';
    else out.logo = dataUrlOk(b.logo, 500000) ? b.logo : existing.logo;
  } else out.logo = existing.logo;

  return out;
}

function imgResponse(v) {
  const c = v.indexOf(',');
  const mime = v.slice(5, v.indexOf(';'));
  const bin = atob(v.slice(c + 1));
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Response(arr, { headers: { 'content-type': mime, 'cache-control': 'public, max-age=31536000, immutable' } });
}

async function savePost(env, body, id, existing) {
  const title = String(body.title || '').trim().slice(0, 200);
  const type = body.type === 'book' || body.type === 'product' ? body.type : 'blog';
  const status = body.status === 'draft' ? 'draft' : 'published';
  let content = '';
  let pages = [];
  if (type === 'book') {
    pages = (Array.isArray(body.pages) ? body.pages : [])
      .map((pg) => String(pg || '').replace(/\r\n?/g, '\n').trim().slice(0, 30000))
      .filter((pg) => pg.length)
      .slice(0, 300);
  } else {
    content = String(body.content || '').replace(/\r\n?/g, '\n').trim().slice(0, 60000);
  }
  const link = body.link ? normUrl(body.link) : '';
  const codeLink = type !== 'product' && body.codeLink ? normUrl(body.codeLink) : '';
  if (!title) return { error: 'missing_fields' };
  if (type === 'blog' && !content) return { error: 'missing_fields' };
  if (type === 'product' && !link) return { error: 'missing_fields' };
  if (type === 'book' && !pages.length && status === 'published') return { error: 'missing_fields' };
  const store = type === 'product' && ['amazon', 'jumia', 'konga', 'other'].includes(body.store) ? body.store : '';
  const price = type === 'product' || type === 'book' ? String(body.price || '').trim().slice(0, 40) : '';
  const tags =
    type === 'product'
      ? []
      : (Array.isArray(body.tags) ? body.tags : String(body.tags || '').split(','))
          .map((t) => String(t || '').trim().slice(0, 28))
          .filter(Boolean)
          .slice(0, 10);
  const now = new Date().toISOString();
  id = id || makeId(title);
  const idx = await getIndex(env);
  const slug = (existing && existing.slug) || uniqueSlug(idx, slugify(title), id);
  const exc = makeExcerpt(type === 'book' ? pages : content, 160);
  // scheduled publishing: a future time keeps the post hidden until then (no timer needed)
  let publishAt = existing && existing.publishAt ? existing.publishAt : '';
  if (Object.prototype.hasOwnProperty.call(body, 'publishAt')) {
    const d = body.publishAt ? new Date(body.publishAt) : null;
    publishAt = d && !isNaN(d) ? d.toISOString() : '';
  }
  let date = existing ? existing.date : now;
  if (publishAt) date = publishAt;
  else if (existing && existing.publishAt) date = now;
  const cards = type === 'product' ? [] : parseCards(type === 'book' ? pages.join('\n\n') : content);

  let imgCount = existing ? existing.imgCount || 0 : 0;
  if (Array.isArray(body.images)) {
    const imgs = body.images.slice(0, 4).filter((s) => dataUrlOk(s, 2000000));
    for (let n = 0; n < (existing ? existing.imgCount || 0 : 0); n++) await env.BLOG.delete(`img:${id}:${n}`);
    for (let n = 0; n < imgs.length; n++) await env.BLOG.put(`img:${id}:${n}`, imgs[n]);
    imgCount = imgs.length;
  }

  const views = existing ? (parseInt(existing.views, 10) || 0) : 0;
  const post = { id, slug, url: `/p/${id}`, title, type, content, pages, excerpt: exc, link, codeLink, store, price, status, tags, imgCount, views, date, updated: now, author: AUTHOR_NAME, ...(publishAt ? { publishAt } : {}) };
  await env.BLOG.put(`post:${id}`, JSON.stringify(post));

  const sum = { id, slug, url: `/p/${id}`, title, type, status, tags, excerpt: exc, imgCount, views, date: post.date, updated: now, author: AUTHOR_NAME };
  if (publishAt) sum.publishAt = publishAt;
  if (cards.length) sum.cards = cards;
  if (type === 'product') Object.assign(sum, { link, store, price });
  if (type === 'book') Object.assign(sum, { price, pageCount: pages.length });
  const i = idx.findIndex((p) => p.id === id);
  if (i >= 0) idx[i] = sum;
  else idx.unshift(sum);
  await putIndex(env, idx);
  return { post: { ...post, html: type === 'book' ? undefined : render(content), pageHtml: type === 'book' ? pages.map(render) : undefined } };
}

async function api(request, env, url) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'access-control-allow-headers': 'content-type, x-admin-key, x-no-count, x-no-hit, x-admin-visit'
      }
    });
  }

  const parts = url.pathname.split('/').filter(Boolean);
  const route = parts[1];
  const m = request.method;

  // Rate limit wrong admin keys (checked before the key is evaluated)
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const sentKey = request.headers.get('x-admin-key');
  if (sentKey) {
    if (await isBlocked(env, ip)) return json({ error: 'too_many_attempts' }, 429);
    if (!env.ADMIN_PASSWORD || !safeEqual(sentKey, env.ADMIN_PASSWORD)) await noteFail(env, ip);
  }

  // Marks this browser as the owner so it is never counted as a visitor
  if (route === 'nocount' && m === 'POST') {
    const res = json({ ok: true });
    res.headers.append('set-cookie', ADMIN_COOKIE);
    return res;
  }

  if (route === 'login' && m === 'POST') {
    if (!env.ADMIN_PASSWORD) return json({ error: 'password_not_set' }, 503);
    const keyFromHeader = (request.headers.get('x-admin-key') || '').trim();
    let keyFromBody = '';
    try {
      const b = await request.clone().json().catch(() => null);
      if (b && b.password) keyFromBody = String(b.password).trim();
    } catch (e) {}
    const pass = keyFromBody || keyFromHeader;
    if (!sentKey && (await isBlocked(env, ip))) return json({ error: 'too_many_attempts' }, 429);
    if (pass && pass === env.ADMIN_PASSWORD.trim()) {
      const res = json({ ok: true });
      res.headers.append('set-cookie', ADMIN_COOKIE);
      return res;
    }
    if (!sentKey) await noteFail(env, ip);
    return json({ error: 'unauthorized' }, 401);
  }

  if (!env.BLOG) return json({ error: 'kv_missing' }, 503);

  if (route === 'backup' || route === 'restore') {
    if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
    if (route === 'backup' && m === 'GET') return json({ keys: await backupList(env) });
    if (route === 'backup' && m === 'POST') {
      const b = await request.json().catch(() => null);
      return json(await backupRead(env, b && b.keys));
    }
    if (route === 'restore' && m === 'POST') {
      const b = await request.json().catch(() => null);
      return json(await restoreWrite(env, b && b.entries));
    }
  }

  if (route === 'indexnow' && m === 'POST') {
    if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
    const live = (await getIndex(env)).filter((x) => x.type !== 'product' && isLive(x));
    const O = url.origin;
    const urls = [O + '/', O + '/archive', O + '/tools', ...live.slice(0, 40).map((x) => `${O}/p/${x.id}`)];
    return json(await indexNow(O, urls));
  }

  if (route === 'settings') {
    if (m === 'GET') return json(await getSettings(env));
    if (m === 'PUT') {
      if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
      const b = await request.json().catch(() => null);
      if (!b) return json({ error: 'bad_json' }, 400);
      const existing = await getSettings(env);
      const s = cleanSettings(b, existing);
      const imgs = b.storeImgs || {};
      for (const k of Object.keys(DEFAULTS.stores)) {
        if (imgs[k] === null) {
          await env.BLOG.delete('simg:' + k);
          s.stores[k].img = 0;
        } else if (dataUrlOk(imgs[k], 600000)) {
          await env.BLOG.put('simg:' + k, imgs[k]);
          s.stores[k].img = Date.now();
        }
      }
      await env.BLOG.put('settings', JSON.stringify(s));
      return json(s);
    }
  }

  if (route === 'subscribe' && m === 'POST') {
    const b = await request.json().catch(() => null);
    if (!b || b.website) return json({ ok: true });
    const email = String(b.email || '').trim().toLowerCase();
    if (email.length > 200 || !EMAIL_RE.test(email)) return json({ error: 'bad_email' }, 400);
    await env.BLOG.put('sub:' + email, '1', { metadata: { d: new Date().toISOString() } });
    return json({ ok: true });
  }

  if (route === 'subscribers') {
    if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
    if (m === 'GET') {
      const keys = [];
      let cursor;
      do {
        const r = await env.BLOG.list({ prefix: 'sub:', cursor, limit: 1000 });
        keys.push(...r.keys);
        cursor = r.list_complete ? undefined : r.cursor;
      } while (cursor && keys.length < 5000);
      return json({
        subscribers: keys.map((k) => ({ email: k.name.slice(4), date: (k.metadata && k.metadata.d) || '' }))
      });
    }
    if (m === 'DELETE') {
      const e = (url.searchParams.get('email') || '').trim().toLowerCase();
      if (e) await env.BLOG.delete('sub:' + e);
      return json({ ok: true });
    }
  }

  if (route === 'hit' && m === 'POST') {
    if (skipCount(request, env)) return json({ ok: true, counted: false, reason: 'ignored' });
    try {
      const cur = parseInt((await env.BLOG.get('stat:site')) || '0', 10) || 0;
      await env.BLOG.put('stat:site', String(cur + 1));
      return json({ ok: true, counted: true, total: cur + 1 });
    } catch (e) {
      return json({ ok: false });
    }
  }

  if (route === 'stats' && m === 'GET') {
    const siteViews = parseInt((await env.BLOG.get('stat:site')) || '0', 10) || 0;
    return json({ views: siteViews });
  }

  if (route === 'react' && m === 'POST') {
    const id = parts[2] || '';
    if (!ID_RE.test(id)) return json({ error: 'not_found' }, 404);
    if (!(await env.BLOG.get(`post:${id}`))) return json({ error: 'not_found' }, 404);
    const b = (await request.json().catch(() => null)) || {};
    const rx = await getRx(env, id);
    if (RX_TYPES.includes(b.prev) && rx[b.prev] > 0) rx[b.prev]--;
    if (RX_TYPES.includes(b.type)) rx[b.type]++;
    await env.BLOG.put('rx:' + id, JSON.stringify(rx));
    return json({ ok: true, reactions: rx });
  }

  if (route === 'unlock') {
    const bookId = parts[2] || '';
    if (m === 'POST' && ID_RE.test(bookId)) {
      const b = await request.json().catch(() => null);
      if (!b || b.website) return json({ error: 'bad_request' }, 400);
      const email = String(b.email || '').trim().toLowerCase();
      if (email.length > 200 || !EMAIL_RE.test(email)) return json({ error: 'bad_email' }, 400);
      const raw = await env.BLOG.get(`post:${bookId}`);
      if (!raw) return json({ error: 'not_found' }, 404);
      const p = JSON.parse(raw);
      if (p.type !== 'book' || !isLive(p)) return json({ error: 'not_found' }, 404);
      await env.BLOG.put('sub:' + email, '1', { metadata: { d: new Date().toISOString(), via: 'book:' + bookId } });
      if (!p.price) {
        return json({ ok: true, pageHtml: (p.pages || []).map(render) });
      }
      let paid = [];
      try {
        paid = JSON.parse((await env.BLOG.get(`paid:${bookId}`)) || '[]');
      } catch (e) {}
      if (paid.includes(email)) {
        return json({ ok: true, pageHtml: (p.pages || []).map(render) });
      }
      let claims = [];
      try {
        claims = JSON.parse((await env.BLOG.get(`claims:${bookId}`)) || '[]');
      } catch (e) {}
      if (!claims.some((c) => c.email === email)) {
        claims.push({ email, date: new Date().toISOString() });
        if (claims.length > 500) claims = claims.slice(claims.length - 500);
        await env.BLOG.put(`claims:${bookId}`, JSON.stringify(claims));
      }
      return json({ ok: true, pending: true });
    }
  }

  if (route === 'claims') {
    if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
    if (m === 'GET') {
      const idx = await getIndex(env);
      const titleOf = {};
      idx.forEach((p) => (titleOf[p.id] = p.title));
      const out = [];
      let cursor;
      do {
        const r = await env.BLOG.list({ prefix: 'claims:', cursor, limit: 1000 });
        for (const k of r.keys) {
          const bookId = k.name.slice('claims:'.length);
          let list = [];
          try {
            list = JSON.parse((await env.BLOG.get(k.name)) || '[]');
          } catch (e) {}
          list.forEach((c) => out.push({ ...c, bookId, bookTitle: titleOf[bookId] || '(deleted book)' }));
        }
        cursor = r.list_complete ? undefined : r.cursor;
      } while (cursor);
      out.sort((a, b) => (a.date < b.date ? 1 : -1));
      return json({ claims: out.slice(0, 300) });
    }
    if (m === 'POST') {
      const b = await request.json().catch(() => null);
      const bookId = b && b.bookId,
        email = b && String(b.email || '').trim().toLowerCase(),
        approve = !!(b && b.approve);
      if (!ID_RE.test(bookId || '') || !email) return json({ error: 'bad_request' }, 400);
      let claims = [];
      try {
        claims = JSON.parse((await env.BLOG.get(`claims:${bookId}`)) || '[]');
      } catch (e) {}
      claims = claims.filter((c) => c.email !== email);
      await env.BLOG.put(`claims:${bookId}`, JSON.stringify(claims));
      if (approve) {
        let paid = [];
        try {
          paid = JSON.parse((await env.BLOG.get(`paid:${bookId}`)) || '[]');
        } catch (e) {}
        if (!paid.includes(email)) paid.push(email);
        await env.BLOG.put(`paid:${bookId}`, JSON.stringify(paid));
      }
      return json({ ok: true });
    }
  }

  if (route === 'comments') {
    const postId = parts[2] || '';
    if (!ID_RE.test(postId)) return json({ error: 'not_found' }, 404);
    if (m === 'GET') {
      let list = [];
      try {
        list = JSON.parse((await env.BLOG.get(`comments:${postId}`)) || '[]');
      } catch (e) {}
      return json({ comments: list });
    }
    if (m === 'POST') {
      const b = await request.json().catch(() => null);
      if (!b || b.website) return json({ ok: true, comment: null });
      const name = String(b.name || '').trim().slice(0, 60) || 'Guest';
      const text = String(b.text || '').trim().slice(0, 1000);
      if (!text) return json({ error: 'missing_text' }, 400);
      let list = [];
      try {
        list = JSON.parse((await env.BLOG.get(`comments:${postId}`)) || '[]');
      } catch (e) {}
      const c = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, text, date: new Date().toISOString() };
      list.push(c);
      if (list.length > 300) list = list.slice(list.length - 300);
      await env.BLOG.put(`comments:${postId}`, JSON.stringify(list));
      return json({ ok: true, comment: c });
    }
    if (m === 'DELETE') {
      if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
      const cid = parts[3] || '';
      let list = [];
      try {
        list = JSON.parse((await env.BLOG.get(`comments:${postId}`)) || '[]');
      } catch (e) {}
      list = list.filter((c) => c.id !== cid);
      await env.BLOG.put(`comments:${postId}`, JSON.stringify(list));
      return json({ ok: true });
    }
  }

  if (route === 'allcomments' && m === 'GET') {
    if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
    const idx = await getIndex(env);
    const titleOf = {};
    idx.forEach((p) => (titleOf[p.id] = p.title));
    const out = [];
    let cursor;
    do {
      const r = await env.BLOG.list({ prefix: 'comments:', cursor, limit: 1000 });
      for (const k of r.keys) {
        const postId = k.name.slice('comments:'.length);
        let list = [];
        try {
          list = JSON.parse((await env.BLOG.get(k.name)) || '[]');
        } catch (e) {}
        list.forEach((c) => out.push({ ...c, postId, postTitle: titleOf[postId] || '(deleted post)' }));
      }
      cursor = r.list_complete ? undefined : r.cursor;
    } while (cursor);
    out.sort((a, b) => (a.date < b.date ? 1 : -1));
    return json({ comments: out.slice(0, 200) });
  }

  if (route === 'img' && m === 'GET') {
    const id = parts[2] || '';
    const n = parseInt(parts[3], 10);
    if (!ID_RE.test(id) || !(n >= 0 && n < 4)) return new Response('Not found', { status: 404 });
    const v = await env.BLOG.get(`img:${id}:${n}`);
    return v ? imgResponse(v) : new Response('Not found', { status: 404 });
  }

  if (route === 'simg' && m === 'GET') {
    const k = parts[2] || '';
    if (!Object.keys(DEFAULTS.stores).includes(k)) return new Response('Not found', { status: 404 });
    const v = await env.BLOG.get('simg:' + k);
    return v ? imgResponse(v) : new Response('Not found', { status: 404 });
  }

  if (route === 'posts') {
    let id = parts[2];
    if (!id) {
      if (m === 'GET') {
        const all = await getIndex(env);
        const posts = authed(request, env) ? all : all.filter(isLive);
        return json({ posts });
      }
      if (m === 'POST') {
        if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
        const b = await request.json().catch(() => null);
        if (!b) return json({ error: 'bad_json' }, 400);
        const r = await savePost(env, b, null, null);
        if (r.post && r.post.type !== 'product' && isLive(r.post)) await indexNow(url.origin, [`${url.origin}/p/${r.post.id}`, url.origin + '/']);
        return r.error ? json(r, 400) : json(r.post);
      }
    } else {
      if (!ID_RE.test(id)) return json({ error: 'not_found' }, 404);
      let raw = await env.BLOG.get(`post:${id}`);
      if (!raw && m === 'GET') {
        // friendly slug: /api/posts/<slug> resolves to the same post
        const hit = (await getIndex(env)).find((x) => x.slug === id);
        if (hit) {
          id = hit.id;
          raw = await env.BLOG.get(`post:${id}`);
        }
      }
      if (m === 'GET') {
        if (!raw) return json({ error: 'not_found' }, 404);
        const p = JSON.parse(raw);
        const isAdmin = authed(request, env);
        if (!isLive(p) && !isAdmin) return json({ error: 'not_found' }, 404);

        if (!skipCount(request, env)) {
          const updatedViews = await incrementPostView(env, id);
          if (updatedViews) p.views = updatedViews;
        }

        const reactions = await getRx(env, id);
        const related = await getRelatedPosts(env, p, 4);
        if (p.type === 'book' && !isAdmin) {
          const first = (p.pages && p.pages[0]) || '';
          return json({
            ...p,
            pages: undefined,
            locked: true,
            pageCount: (p.pages || []).length,
            previewHtml: render(first.slice(0, 500)),
            reactions,
            related
          });
        }
        return json({ ...p, reactions, related, html: p.type === 'book' ? undefined : render(p.content), pageHtml: p.type === 'book' ? (p.pages || []).map(render) : undefined });
      }
      if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
      if (!raw) return json({ error: 'not_found' }, 404);
      const existing = JSON.parse(raw);
      if (m === 'PUT') {
        const b = await request.json().catch(() => null);
        if (!b) return json({ error: 'bad_json' }, 400);
        const r = await savePost(env, b, id, existing);
        if (r.post && r.post.type !== 'product' && isLive(r.post)) await indexNow(url.origin, [`${url.origin}/p/${r.post.id}`]);
        return r.error ? json(r, 400) : json(r.post);
      }
      if (m === 'DELETE') {
        for (let n = 0; n < (existing.imgCount || 0); n++) await env.BLOG.delete(`img:${id}:${n}`);
        await env.BLOG.delete(`post:${id}`);
        await env.BLOG.delete(`comments:${id}`);
        await env.BLOG.delete(`rx:${id}`);
        await env.BLOG.delete(`claims:${id}`);
        await env.BLOG.delete(`paid:${id}`);
        const idx = (await getIndex(env)).filter((p) => p.id !== id);
        await putIndex(env, idx);
        return json({ ok: true });
      }
    }
  }
  return json({ error: 'not_found' }, 404);
}

async function sitemap(env, SITE) {
  const idx = env.BLOG ? await getIndex(env) : [];
  const pub = idx.filter((x) => x.type !== 'product' && isLive(x));
  const day = (d) => {
    const t = new Date(d || 0);
    return isNaN(t) || +t === 0 ? '' : t.toISOString().slice(0, 10);
  };
  const latest = pub.reduce((m, p) => {
    const d = day(p.updated || p.date);
    return d > m ? d : m;
  }, '');
  const urls = [
    `<url><loc>${esc(SITE)}/</loc>${latest ? `<lastmod>${latest}</lastmod>` : ''}<changefreq>daily</changefreq><priority>1.0</priority></url>`
  ];
  for (const p of pub) {
    const lm = day(p.updated || p.date);
    const im = p.imgCount ? `<image:image><image:loc>${esc(SITE)}/api/img/${esc(p.id)}/0</image:loc></image:image>` : '';
    urls.push(`<url><loc>${esc(SITE)}/p/${esc(p.id)}</loc>${lm ? `<lastmod>${lm}</lastmod>` : ''}<changefreq>weekly</changefreq><priority>0.8</priority>${im}</url>`);
  }
  const add = (path, lm, cf, pr) =>
    urls.push(`<url><loc>${esc(SITE)}${path}</loc>${lm ? `<lastmod>${lm}</lastmod>` : ''}<changefreq>${cf}</changefreq><priority>${pr}</priority></url>`);
  if (pub.length) add('/archive', latest, 'daily', '0.7');
  const tags = [...collectTags(pub).values()];
  if (tags.length) add('/tags', latest, 'weekly', '0.5');
  for (const t of tags) if (t.posts.length >= 2) add('/tag/' + esc(t.slug), latest, 'weekly', '0.6'); // thin one-post topics stay out
  if (pub.some((p) => p.cards && p.cards.length)) add('/store', latest, 'weekly', '0.6');
  add('/tools', '', 'monthly', '0.7');
  for (const k of Object.keys(LEGAL)) add('/' + k, '', 'yearly', '0.3');
  for (const t of TOOL_PAGES) add('/tools/' + t.slug, '', 'monthly', '0.7');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${urls.join('')}</urlset>`,
    { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=600' } }
  );
}

async function feed(env, SITE) {
  const idx = (env.BLOG ? await getIndex(env) : []).filter((x) => x.type !== 'product' && isLive(x)).slice(0, 30);
  const items = idx
    .map(
      (p) =>
        `<item><title>${esc(p.title)}</title><link>${SITE}/p/${p.id}</link><guid isPermaLink="true">${SITE}/p/${p.id}</guid><pubDate>${new Date(p.date).toUTCString()}</pubDate><description>${esc(p.excerpt)}</description><author>${esc(AUTHOR_NAME)}</author></item>`
    )
    .join('');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${NAME}</title><link>${SITE}/</link><description>Tech blogging, programming tutorials, and digital books by ${AUTHOR_NAME}</description>${items}</channel></rss>`,
    { headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'public, max-age=600' } }
  );
}

function robots(SITE) {
  // Nothing is blocked: /api/img/... images are used for social cards and Google Images
  return new Response(
    `User-agent: Googlebot\nAllow: /\n\nUser-agent: Bingbot\nAllow: /\n\nUser-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`,
    { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=86400' } }
  );
}

// Puts per-page tags into the HTML shell. Uses the SEO_HEAD markers; if an old shell
// has no markers, the homepage tags are stripped first so nothing is duplicated.
function injectHead(html, head) {
  if (HEAD_RE.test(html)) return html.replace(HEAD_RE, () => head);
  return html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+name="description"[^>]*>/i, '')
    .replace(/<link\s+rel="canonical"[^>]*>/i, '')
    .replace(/<meta\s+property="og:[^"]*"[^>]*>/gi, '')
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*>/gi, '')
    .replace('</head>', () => head + '\n</head>');
}

// "Related posts" block rendered in the server HTML (crawlable internal links)
function relatedHtml(list) {
  if (!list || !list.length) return '';
  const items = list
    .map((r) => `<li><a href="/p/${esc(r.id)}">${esc(r.title)}</a>${r.excerpt ? ' \u2014 ' + esc(r.excerpt) : ''}</li>`)
    .join('');
  return `<aside class="related"><h2>Related posts</h2><ul>${items}</ul></aside>`;
}

// Handler for direct post links: /p/:id or /p/:slug (WhatsApp, Facebook, search engines)
async function postPage(env, url, request) {
  const SITE = url.origin;
  const id = url.pathname.split('/')[2] || '';
  const shell = await env.ASSETS.fetch(new Request(new URL('/', url).toString()));
  let html = await shell.text();
  let post = null;
  if (env.BLOG && ID_RE.test(id)) {
    let raw = await env.BLOG.get(`post:${id}`);
    if (!raw) {
      // friendly slug URL -> find the post by its slug
      const hit = (await getIndex(env)).find((p) => p.slug === id);
      if (hit) raw = await env.BLOG.get(`post:${hit.id}`);
    }
    if (raw) post = JSON.parse(raw);
    if (post && post.type === 'product') post = null;
  }
  const PRESET_TITLES = {
    'learn-html-css-javascript-beginners-guide': "Learn HTML, CSS and JavaScript: A Beginner's Practical Guide",
    'koyon-html-css-da-javascript-jagorar-mafari': "Koyon HTML, CSS da JavaScript: Jagorar Mafari Dalla-Dalla",
    'from-code-to-website-deployment-handbook': "From Code to Website: The Complete Multi-Platform Deployment Handbook"
  };
  if (!post && PRESET_TITLES[id]) {
    post = {
      id: id,
      title: PRESET_TITLES[id],
      type: 'book',
      content: PRESET_TITLES[id],
      date: '2026-01-01',
      status: 'published'
    };
  }
  const headers = { 'content-type': 'text/html; charset=utf-8' };
  if (post && !isLive(post)) post = null;
  if (!post) {
    // unknown / deleted post: real 404 + noindex (the page still shows its "not found" message)
    const nf = html.replace('</head>', () => '<meta name="robots" content="noindex">\n</head>');
    return new Response(nf, { status: 404, headers });
  }
  // slug URLs redirect to the one canonical /p/:id address
  if (post.id !== id) return Response.redirect(`${SITE}/p/${post.id}`, 301);

  // NOTE: views are counted once, by the page's own GET /api/posts/:id call (not here),
  // so a direct visit is no longer counted twice.

  const link = `${SITE}/p/${post.id}`;
  const desc = post.excerpt || makeExcerpt(post.type === 'book' ? post.pages : post.content, 160);
  const OG_N = (hashStr(post.id) % 3) + 1;
  const img = post.imgCount ? `${SITE}/api/img/${post.id}/0?v=${encodeURIComponent(post.updated || post.date)}` : `${SITE}/og-${OG_N}.png`;
  const tags = Array.isArray(post.tags) ? post.tags : [];
  const published = post.date;
  const modified = post.updated || post.date;
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': post.type === 'book' ? 'Book' : 'Article',
        '@id': link + '#article',
        headline: post.title,
        name: post.title,
        description: desc,
        image: [img],
        url: link,
        datePublished: published,
        dateModified: modified,
        author: { '@type': 'Person', name: AUTHOR_NAME },
        publisher: { '@type': 'Organization', name: NAME, logo: { '@type': 'ImageObject', url: `${SITE}/logo.png` } },
        mainEntityOfPage: { '@type': 'WebPage', '@id': link },
        ...(tags.length ? { keywords: tags.join(', ') } : {})
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: NAME, item: SITE + '/' },
          { '@type': 'ListItem', position: 2, name: post.title, item: link }
        ]
      }
    ]
  };
  const head = [
    `<title>${esc(post.title)} | ${NAME}</title>`,
    `<meta name="description" content="${esc(desc)}">`,
    tags.length ? `<meta name="keywords" content="${esc(tags.join(', '))}">` : '',
    `<link rel="canonical" href="${esc(link)}">`,
    `<meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1">`,
    `<meta property="og:type" content="${post.type === 'book' ? 'book' : 'article'}">`,
    `<meta property="og:site_name" content="${NAME}">`,
    `<meta property="og:title" content="${esc(post.title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:url" content="${esc(link)}">`,
    `<meta property="og:image" content="${esc(img)}">`,
    published ? `<meta property="article:published_time" content="${esc(published)}">` : '',
    modified ? `<meta property="article:modified_time" content="${esc(modified)}">` : '',
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(post.title)}">`,
    `<meta name="twitter:description" content="${esc(desc)}">`,
    `<meta name="twitter:image" content="${esc(img)}">`,
    `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`
  ]
    .filter(Boolean)
    .join('\n');
  const bodyHtml = post.type === 'book' ? render((post.pages && post.pages[0]) || '') : render(post.content);
  const related = await getRelatedPosts(env, post, 4);
  const tagLinks = tags.length ? `<p class="tags">Topics: ${tags.map((t) => `<a href="/tag/${esc(tagSlug(t))}">#${esc(t)}</a>`).join(' ')}</p>` : '';
  const body = `<article><h1>${esc(post.title)}</h1>${bodyHtml}</article>${tagLinks}${relatedHtml(related)}`;
  html = injectHead(html, head).replace('<!--SEO_BODY-->', () => body);
  html = injectCustom(html, env.BLOG ? await getSettings(env) : null);
  return new Response(html, { headers: { ...headers, 'cache-control': 'public, max-age=60' } });
}

/* Universal HTML, CSS, Body HTML, and JavaScript Injection (done once, on the server) */
function injectCustom(html, settings) {
  const cc = (settings && settings.customCode) || {};
  // flag tells the page that the server already applied the custom code (no second injection)
  const headInject = '<script>window.__CC_SERVER=1<\/script>' + (cc.css ? `<style>${cc.css}</style>` : '') + (cc.head || '');
  const bodyStartInject = (cc.bodyStart || '') + (cc.bodyHtml || cc.body || '');
  const rawHtmlInject = cc.html || '';
  const bodyJsInject = cc.bodyJs ? `<script>${cc.bodyJs}<\/script>` : '';

  let out = html;
  if (out.includes('<!--CUSTOM_HEAD-->')) {
    out = out.replace('<!--CUSTOM_HEAD-->', () => headInject);
  } else {
    out = out.replace('</head>', () => headInject + '</head>');
  }

  if (out.includes('<!--CUSTOM_BODY-->')) {
    out = out.replace('<!--CUSTOM_BODY-->', () => bodyStartInject);
  } else if (bodyStartInject) {
    out = out.replace(/<body[^>]*>/i, (m) => m + '\n' + bodyStartInject);
  }

  if (rawHtmlInject && out.includes('<div id="dyn-html-target"></div>')) {
    out = out.replace('<div id="dyn-html-target"></div>', () => `<div id="dyn-html-target">${rawHtmlInject}</div>`);
  }

  if (out.includes('<!--CUSTOM_BODY_END-->')) {
    out = out.replace('<!--CUSTOM_BODY_END-->', () => bodyJsInject);
  } else if (bodyJsInject) {
    out = out.replace('</body>', () => bodyJsInject + '\n</body>');
  }

  return out;
}

// Small crawlable block for the homepage HTML (hidden by the page's own script):
// most-read posts plus links to the archive, topics, store and every tool page
async function homeSeoBody(env, SITE) {
  const pub = env.BLOG ? (await getIndex(env)).filter((p) => p.type !== 'product' && isLive(p)) : [];
  const top = pub
    .slice()
    .sort((a, b) => (b.views || 0) - (a.views || 0) || new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, 5);
  const popular = top.length
    ? `<nav aria-label="Popular reads"><h2>Popular reads</h2><ul>${top.map((p) => `<li><a href="${SITE}/p/${esc(p.id)}">${esc(p.title)}</a></li>`).join('')}</ul></nav>`
    : '';
  const hasStore = pub.some((p) => p.cards && p.cards.length);
  const browse = `<nav aria-label="Browse"><ul><li><a href="${SITE}/archive">All posts</a></li><li><a href="${SITE}/tags">Topics</a></li>${hasStore ? `<li><a href="${SITE}/store">Store</a></li>` : ''}<li><a href="${SITE}/tools">Free tools</a></li></ul></nav>`;
  const tools = `<nav aria-label="Free tools"><h2>Free tools</h2><ul>${TOOL_PAGES.map((t) => `<li><a href="${SITE}/tools/${t.slug}">${esc(t.name)}</a></li>`).join('')}</ul></nav>`;
  return popular + browse + tools;
}

async function withOrigin(request, env, url) {
  const res = await env.ASSETS.fetch(request);
  if (!res.ok) return res;
  const settings = env.BLOG ? await getSettings(env) : null;
  const seoBody = await homeSeoBody(env, url.origin).catch(() => '');
  let text = (await res.text()).split(DEFAULT_SITE).join(url.origin);
  text = text.replace('<!--SEO_BODY-->', () => seoBody);
  text = injectCustom(text, settings);
  const headers = new Headers(res.headers);
  headers.delete('content-length');
  headers.delete('etag');
  headers.set('cache-control', 'no-cache, must-revalidate');
  return new Response(text, { status: 200, headers });
}

/* ====================================================================== */
/* Server-built pages: tags, archive, store, tools (all crawlable HTML)    */
/* ====================================================================== */

// A post is public only when it is not a draft and its publish time has passed
const isLive = (p) => !!p && p.status !== 'draft' && !(p.publishAt && new Date(p.publishAt) > new Date());

const tagSlug = (t) => slugify(t) || encodeURIComponent(String(t || '').toLowerCase());

const TOOL_PAGES = [
  {
    slug: 'star-name-calculator', key: 'stars', name: 'Star & Name Calculator (Hisab al-Burj)', seo: 'Star and Name Calculator (Hisab al-Burj)',
    desc: "Free star and name calculator: find your burj (zodiac sign), element and ruling planet from your name and your mother's name using the Hisab al-Jumal Abjad method.",
    intro: "This tool turns a name and the mother's name into Abjad numbers and shows the matching burj (sign), element and ruling planet, following the traditional Hisab al-Jumal method taught in Islamic manuscripts.",
    steps: ['Type your name in Arabic, or in English or Hausa and press "Convert to Arabic".', "Add your mother's name (optional).", 'Press "Calculate Star" to see your burj, element, planet and day.'],
    note: 'Results are for learning and interest. They are not a religious ruling.'
  },
  {
    slug: 'abjad-calculator', key: 'abjad', name: 'Abjad Calculator (Hisab al-Jumal)', seo: 'Abjad Calculator - Hisab al-Jumal (Kabir and Saghir)',
    desc: 'Free Abjad calculator: get the Hisab al-Jumal value (Kabir and Saghir) of any Arabic name, verse or phrase, with a letter-by-letter breakdown.',
    intro: 'Hisab al-Jumal gives a number to each Arabic letter. Type any Arabic word, name or verse to see its total value (Abjad Kabir), its reduced value (Abjad Saghir) and how many letters it has.',
    steps: ['Type or paste Arabic text into the box.', 'Read the Kabir (large) and Saghir (small) values and the letter count.', "Use the breakdown to check each letter's value."]
  },
  {
    slug: 'word-counter', key: 'counter', name: 'Word Counter & Reading Time', seo: 'Word Counter and Reading Time Calculator',
    desc: 'Free word counter: count words and characters and estimate reading time for blog posts, essays and book pages. Works instantly on your phone.',
    intro: 'Paste your text to count words and characters and see how long it takes to read. Useful for blog posts, articles and book pages.',
    steps: ['Paste or type your text.', 'Watch words, characters and reading time update as you type.', 'Edit the text until the length suits your post.']
  },
  {
    slug: 'dhikr-counter', key: 'tasbih', name: 'Digital Tasbih (Dhikr Counter)', seo: 'Digital Tasbih - Online Dhikr Counter',
    desc: 'Free online tasbih counter: tap to count your dhikr, with the phrase changing every 33 counts. Simple, quiet and works on any phone.',
    intro: 'A simple digital tasbih for daily dhikr. Tap the button to count, and the phrase changes after every 33 taps.',
    steps: ['Tap the big button for each dhikr.', 'The phrase changes after every 33 counts.', 'Press Reset to start again.']
  },
  {
    slug: 'hijri-date-converter', key: 'hijri', name: 'Hijri Date Today', seo: 'Hijri Date Today - Islamic Date Converter',
    desc: "See today's date in the Islamic Hijri calendar next to the Gregorian date. Free and instant.",
    intro: "This tool shows today's Gregorian date and the matching Islamic Hijri date (Umm al-Qura calendar), so you can read both at a glance.",
    steps: ['Open the tool.', "Read today's Gregorian date and Hijri date side by side."],
    note: 'The Hijri date can differ by a day in some countries, depending on moon sighting.'
  },
  {
    slug: 'bmi-calculator', key: 'bmi', name: 'BMI Calculator', seo: 'BMI Calculator - Body Mass Index',
    desc: 'Free BMI calculator: enter your weight and height to see your body mass index and the healthy weight range for your height. Metric and imperial.',
    intro: 'Body mass index (BMI) compares your weight with your height. Enter both to see your BMI, the usual category, and the weight range that matches a BMI of 18.5 to 24.9.',
    steps: ['Choose metric (kg, cm) or imperial (lb, inches).', 'Enter your weight and height.', 'Read your BMI, category and healthy weight range.'],
    note: 'BMI is a rough guide, not a diagnosis. It does not measure body fat or muscle. Talk to a doctor about your health.'
  },
  {
    slug: 'water-intake-calculator', key: 'water', name: 'Daily Water Intake Calculator', seo: 'Daily Water Intake Calculator',
    desc: 'Free water intake calculator: estimate how much water you need each day from your weight, activity and weather.',
    intro: 'A simple estimate of daily water need, based on body weight, how active you are and whether the weather is hot. Your real needs also depend on health, food and age.',
    steps: ['Enter your weight in kg.', 'Choose how active you are and whether it is hot.', 'Read the estimate in litres and cups.'],
    note: "This is a general estimate, not medical advice. People with kidney, heart or other conditions should follow their doctor's advice."
  },
  {
    slug: 'zakat-calculator', key: 'zakat', name: 'Zakat Calculator', seo: 'Zakat Calculator - 2.5% on Savings and Wealth',
    desc: 'Free Zakat calculator: add your savings, gold, silver, investments and debts, compare with the nisab, and see the 2.5% Zakat due.',
    intro: 'Zakat is 2.5% of zakatable wealth that has been held for one lunar year and is above the nisab. Enter your amounts and the current nisab value to see whether Zakat is due and how much.',
    steps: ["Enter the current nisab value in your currency (the value of about 85 g of gold or 595 g of silver; check today's price).", 'Enter your cash, gold, silver, investments and business stock, and any money owed to you that you expect to receive.', 'Enter debts you must pay soon, then read the result.'],
    note: 'Scholars differ on details such as which nisab to use, so ask a qualified scholar about your own situation.'
  },
  {
    slug: 'slug-generator', key: 'slugger', name: 'URL Slug Generator', seo: 'URL Slug Generator for Blog Posts',
    desc: 'Free slug generator: turn any blog title into a clean, lowercase, SEO friendly URL slug.',
    intro: 'A slug is the readable last part of a web address. Short slugs that contain the main keyword are easier for people and search engines to read.',
    steps: ['Type or paste your post title.', 'Copy the slug.', 'Keep it short, use hyphens, and avoid extra words.']
  },
  {
    slug: 'seo-title-checker', key: 'titlecheck', name: 'SEO Title & Description Checker', seo: 'SEO Title and Meta Description Length Checker',
    desc: 'Free checker: see if your page title and meta description are a good length for Google, with a live search result preview.',
    intro: 'Google shows only the first part of a title and description. Check yours here and see a preview of how it may look in search results.',
    steps: ['Type your page title and description.', 'Check the character counts and colours.', 'Adjust until both are in the green range.'],
    note: 'Display length depends on character width, so 50 to 60 characters for titles and 120 to 160 for descriptions are good targets, not strict rules.'
  },
  {
    slug: 'image-compressor', key: 'imgcomp', name: 'Image Compressor', seo: 'Free Image Compressor - Shrink JPEG and WebP',
    desc: 'Free image compressor: reduce photo size in your browser. Nothing is uploaded, so your pictures stay private.',
    intro: 'Smaller pictures make pages load faster and use less data. Choose a photo, pick a width and quality, and download the lighter file. Everything happens on your own device.',
    steps: ['Choose a photo.', 'Pick the maximum width and quality.', 'Compare the sizes and download the result.']
  }
];

const crumbs = (items) =>
  '<nav class="crumbs" aria-label="Breadcrumb" style="margin:6px 0 14px;font-size:.9rem">' +
  items.map((x) => (x.href ? `<a href="${esc(x.href)}">${esc(x.name)}</a>` : `<span>${esc(x.name)}</span>`)).join(' &rsaquo; ') +
  '</nav>';

// Same card look as the homepage list, built on the server
function cardHtml(p) {
  const href = '/p/' + esc(p.id);
  const img = p.imgCount ? `<a class="pimg" href="${href}"><img src="/api/img/${esc(p.id)}/0?v=${encodeURIComponent(p.updated || p.date || '')}" alt="" loading="lazy"></a>` : '';
  const tags = (p.tags || []).slice(0, 4).map((t) => `<a href="/tag/${esc(tagSlug(t))}" style="color:var(--mut);font-size:.8rem;margin-right:6px">#${esc(t)}</a>`).join('');
  return `<article class="pc">${img}<div class="pb"><span class="badge">${p.type === 'book' ? 'Book' : 'Blog'}</span><h3><a href="${href}">${esc(p.title)}</a></h3>${p.excerpt ? `<p>${esc(p.excerpt)}</p>` : ''}<div>${tags}</div><div class="pm"><span>${esc(String(p.date || '').slice(0, 10))}</span><a class="more" href="${href}">Read more</a></div></div></article>`;
}

function collectTags(posts) {
  const m = new Map();
  for (const p of posts) {
    for (const t of p.tags || []) {
      const s = tagSlug(t);
      if (!s) continue;
      const e = m.get(s) || { slug: s, name: String(t), posts: [] };
      e.posts.push(p);
      m.set(s, e);
    }
  }
  return m;
}

const livePosts = async (env) => (env.BLOG ? await getIndex(env) : []).filter((p) => p.type !== 'product' && isLive(p));

// Builds a full page from the site shell: own head tags + readable body. The page's own script
// leaves this content visible (window.__STATIC_PAGE) and hides the rest of the homepage.
async function staticPage(env, url, o) {
  const SITE = url.origin;
  const shell = await env.ASSETS.fetch(new Request(new URL('/', url).toString()));
  let html = await shell.text();
  const link = SITE + o.path;
  const robotsMeta = o.noindex ? 'noindex,follow' : 'index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1';
  const img = `${SITE}/og-1.png`;
  const ld = o.ld ? `<script type="application/ld+json">${JSON.stringify(o.ld).replace(/</g, '\\u003c')}</script>` : '';
  const flag =
    `<script>window.__STATIC_PAGE=1;${o.toolKey ? `window.__TOOL_KEY=${JSON.stringify(o.toolKey)};` : ''}<\/script>` +
    `<style>#home>*:not(#ssr)${o.toolKey ? ':not(#toolsSection)' : ''}{display:none!important}${o.toolKey ? '#home{display:flex;flex-direction:column}#ssr{order:2}' : ''}</style>`;
  const head = [
    `<title>${esc(o.title)}</title>`,
    `<meta name="description" content="${esc(o.desc)}">`,
    `<link rel="canonical" href="${esc(link)}">`,
    `<meta name="robots" content="${robotsMeta}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${NAME}">`,
    `<meta property="og:title" content="${esc(o.title)}">`,
    `<meta property="og:description" content="${esc(o.desc)}">`,
    `<meta property="og:url" content="${esc(link)}">`,
    `<meta property="og:image" content="${esc(img)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(o.title)}">`,
    `<meta name="twitter:description" content="${esc(o.desc)}">`,
    `<meta name="twitter:image" content="${esc(img)}">`,
    ld,
    flag
  ]
    .filter(Boolean)
    .join('\n');
  html = injectHead(html, head).replace('<!--SEO_BODY-->', () => `<div class="wrap text">${o.body}</div>`);
  html = injectCustom(html, env.BLOG ? await getSettings(env) : null);
  return new Response(html, {
    status: o.status || 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=120' }
  });
}

const breadcrumbLd = (SITE, items) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.name, item: SITE + x.path }))
});

async function notFoundPage(env, url) {
  const shell = await env.ASSETS.fetch(new Request(new URL('/', url).toString()));
  const html = (await shell.text()).replace('</head>', () => '<meta name="robots" content="noindex">\n</head>');
  return new Response(html, { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

async function archivePage(env, url) {
  const SITE = url.origin;
  const posts = (await livePosts(env)).slice(0, 500);
  const body =
    crumbs([{ name: 'Home', href: '/' }, { name: 'All posts' }]) +
    `<h1 class="sec">All posts and books</h1><p class="mut">Every article and book on ${NAME}, newest first.</p>` +
    (posts.length ? `<div class="grid">${posts.map(cardHtml).join('')}</div>` : '<p class="mut">Nothing has been published yet.</p>') +
    `<p style="margin-top:18px"><a href="/tags">Browse by topic</a> &middot; <a href="/tools">Free tools</a></p>`;
  return staticPage(env, url, {
    path: '/archive',
    title: `All posts and books | ${NAME}`,
    desc: `Browse every blog post and book on ${NAME}: reading, health research, web guides and more.`,
    body,
    noindex: !posts.length,
    ld: { '@context': 'https://schema.org', '@graph': [{ '@type': 'CollectionPage', name: 'All posts and books', url: SITE + '/archive' }, breadcrumbLd(SITE, [{ name: 'Home', path: '/' }, { name: 'All posts', path: '/archive' }])] }
  });
}

async function tagsPage(env, url) {
  const SITE = url.origin;
  const tags = [...collectTags(await livePosts(env)).values()].sort((a, b) => b.posts.length - a.posts.length || a.name.localeCompare(b.name));
  const body =
    crumbs([{ name: 'Home', href: '/' }, { name: 'Topics' }]) +
    `<h1 class="sec">Topics</h1><p class="mut">Pick a topic to see every post about it.</p>` +
    (tags.length
      ? `<ul class="feat">${tags.map((t) => `<li><a href="/tag/${esc(t.slug)}">#${esc(t.name)} (${t.posts.length})</a></li>`).join('')}</ul>`
      : '<p class="mut">Topics will appear when posts have tags.</p>');
  return staticPage(env, url, {
    path: '/tags',
    title: `Topics | ${NAME}`,
    desc: `Browse ${NAME} by topic: health, books, blogging, web guides and more.`,
    body,
    noindex: !tags.length,
    ld: { '@context': 'https://schema.org', '@graph': [breadcrumbLd(SITE, [{ name: 'Home', path: '/' }, { name: 'Topics', path: '/tags' }])] }
  });
}

async function tagPage(env, url, rawSlug) {
  const SITE = url.origin;
  let slug = rawSlug;
  try {
    slug = decodeURIComponent(rawSlug);
  } catch (e) {}
  const tags = collectTags(await livePosts(env));
  const t = tags.get(slug);
  if (!t) return notFoundPage(env, url);
  const posts = t.posts.slice(0, 200);
  const others = [...tags.values()].filter((x) => x.slug !== slug).sort((a, b) => b.posts.length - a.posts.length).slice(0, 12);
  const body =
    crumbs([{ name: 'Home', href: '/' }, { name: 'Topics', href: '/tags' }, { name: '#' + t.name }]) +
    `<h1 class="sec">Posts about ${esc(t.name)}</h1><p class="mut">${posts.length} ${posts.length === 1 ? 'post' : 'posts'} tagged &ldquo;${esc(t.name)}&rdquo; on ${NAME}.</p>` +
    `<div class="grid">${posts.map(cardHtml).join('')}</div>` +
    (others.length ? `<h2 style="margin-top:24px">More topics</h2><ul class="feat">${others.map((x) => `<li><a href="/tag/${esc(x.slug)}">#${esc(x.name)}</a></li>`).join('')}</ul>` : '');
  const path = '/tag/' + t.slug;
  return staticPage(env, url, {
    path,
    title: `${t.name}: posts and guides | ${NAME}`,
    desc: `Read ${posts.length} ${posts.length === 1 ? 'post' : 'posts'} about ${t.name} on ${NAME}.`,
    body,
    noindex: posts.length < 2, // a topic page with one post is too thin to index
    ld: { '@context': 'https://schema.org', '@graph': [{ '@type': 'CollectionPage', name: t.name, url: SITE + path }, breadcrumbLd(SITE, [{ name: 'Home', path: '/' }, { name: 'Topics', path: '/tags' }, { name: t.name, path }])] }
  });
}

// Product cards found in posts, newest first
function storeItems(posts) {
  const out = [];
  for (const p of posts) for (const c of p.cards || []) out.push({ ...c, postId: p.id, postTitle: p.title, date: p.date });
  return out;
}

function productCardHtml(c, withReview) {
  const img = c.image ? `<img src="${esc(c.image)}" alt="${esc(c.title)}" loading="lazy">` : '';
  return `<div class="pcard">${img}<div class="pcard-b"><h4>${esc(c.title)}</h4>${c.price ? `<div class="pcard-price">${esc(c.price)}</div>` : ''}<div class="pcard-act">${withReview && c.postId ? `<a class="btn sm ghost" href="/p/${esc(c.postId)}">Read review</a> ` : ''}<a class="aff-btn" href="${esc(c.link)}" target="_blank" rel="sponsored nofollow noopener">Buy now</a></div></div></div>`;
}

async function storePage(env, url) {
  const SITE = url.origin;
  const reviews = (await livePosts(env)).filter((p) => p.cards && p.cards.length);
  const items = storeItems(reviews).slice(0, 36);
  const body =
    crumbs([{ name: 'Home', href: '/' }, { name: 'Store' }]) +
    `<h1 class="sec">Store: reviews and recommended products</h1>` +
    `<p class="mut">Products we recommend, each one explained in a post. Some links are affiliate links: if you buy through them we may earn a small commission at no extra cost to you.</p>` +
    (items.length
      ? `<div class="pgrid">${items.map((c) => productCardHtml(c, true)).join('')}</div>` +
        `<h2 style="margin-top:26px">Latest product posts</h2><div class="grid">${reviews.slice(0, 12).map(cardHtml).join('')}</div>`
      : '<p class="mut">Product reviews are coming soon.</p>');
  return staticPage(env, url, {
    path: '/store',
    title: `Store: reviews and recommended products | ${NAME}`,
    desc: `Honest product reviews and recommendations on ${NAME}, with links to buy from trusted stores.`,
    body,
    noindex: !items.length,
    ld: { '@context': 'https://schema.org', '@graph': [{ '@type': 'CollectionPage', name: 'Store', url: SITE + '/store' }, breadcrumbLd(SITE, [{ name: 'Home', path: '/' }, { name: 'Store', path: '/store' }])] }
  });
}

async function toolsIndexPage(env, url) {
  const SITE = url.origin;
  const body =
    crumbs([{ name: 'Home', href: '/' }, { name: 'Free tools' }]) +
    `<h1 class="sec">Free online tools</h1><p class="mut">Simple tools that work on your phone: Abjad and star calculators, a tasbih counter, health and Zakat calculators, and helpers for bloggers.</p>` +
    `<div class="grid">${TOOL_PAGES.map((t) => `<article class="pc"><div class="pb"><span class="badge">Tool</span><h3><a href="/tools/${t.slug}">${esc(t.name)}</a></h3><p>${esc(t.desc)}</p><div class="pm"><span></span><a class="more" href="/tools/${t.slug}">Open tool</a></div></div></article>`).join('')}</div>`;
  return staticPage(env, url, {
    path: '/tools',
    title: `Free online tools | ${NAME}`,
    desc: `Free tools on ${NAME}: Abjad calculator, star calculator, tasbih counter, BMI, water intake, Zakat, slug generator and more.`,
    body,
    ld: { '@context': 'https://schema.org', '@graph': [{ '@type': 'CollectionPage', name: 'Free online tools', url: SITE + '/tools' }, breadcrumbLd(SITE, [{ name: 'Home', path: '/' }, { name: 'Free tools', path: '/tools' }])] }
  });
}

async function toolPage(env, url, slug) {
  const SITE = url.origin;
  const t = TOOL_PAGES.find((x) => x.slug === slug);
  if (!t) return notFoundPage(env, url);
  const path = '/tools/' + t.slug;
  const body =
    crumbs([{ name: 'Home', href: '/' }, { name: 'Free tools', href: '/tools' }, { name: t.name }]) +
    `<h1 class="sec">${esc(t.name)}</h1><p class="lead">${esc(t.intro)}</p>` +
    `<h2>How to use it</h2><ol>${t.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` +
    (t.note ? `<p class="mut">${esc(t.note)}</p>` : '') +
    `<h2>More free tools</h2><ul class="feat">${TOOL_PAGES.filter((x) => x.slug !== t.slug).map((x) => `<li><a href="/tools/${x.slug}">${esc(x.name)}</a></li>`).join('')}</ul>`;
  return staticPage(env, url, {
    path,
    toolKey: t.key,
    title: `${t.seo} | ${NAME}`,
    desc: t.desc,
    body,
    ld: {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'SoftwareApplication', name: t.name, url: SITE + path, description: t.desc, applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any (web browser)', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
        breadcrumbLd(SITE, [{ name: 'Home', path: '/' }, { name: 'Free tools', path: '/tools' }, { name: t.name, path }])
      ]
    }
  });
}

/* ====================================================================== */
/* Backup & restore (admin only). Moves data in small chunks so it works   */
/* on the free plan; the page drives the loop and builds/reads the file.   */
/* ====================================================================== */
const BACKUP_KEY_RE = /^(?:(?:post|img|simg|sub|comments|claims|paid|rx):[\w.@+:%-]{1,200}|index|settings|stat:site)$/;

async function backupList(env) {
  const keys = [];
  let cursor;
  do {
    const r = await env.BLOG.list({ cursor, limit: 1000 });
    for (const k of r.keys) if (BACKUP_KEY_RE.test(k.name)) keys.push({ k: k.name, m: (k.metadata && Object.keys(k.metadata).length) ? k.metadata : undefined });
    cursor = r.list_complete ? undefined : r.cursor;
  } while (cursor && keys.length < 20000);
  return keys;
}

async function backupRead(env, names) {
  const entries = [];
  let size = 0;
  let taken = 0;
  for (const name of (Array.isArray(names) ? names : []).slice(0, 40)) {
    if (!BACKUP_KEY_RE.test(String(name))) {
      taken++;
      continue;
    }
    const v = await env.BLOG.get(name);
    if (v != null) {
      if (entries.length && size + v.length > 5000000) break; // keep each reply small; the page asks again
      entries.push({ k: name, v });
      size += v.length;
    }
    taken++;
  }
  return { entries, taken };
}

function validRestore(k, v, m) {
  if (typeof k !== 'string' || typeof v !== 'string' || !BACKUP_KEY_RE.test(k) || v.length > 12000000) return false;
  if (/^(img|simg):/.test(k)) return /^data:image\/(jpeg|png|webp);base64,/.test(v);
  if (k === 'stat:site') return /^\d{1,12}$/.test(v);
  if (k.startsWith('sub:')) return v.length < 100 && (m == null || typeof m === 'object');
  try {
    JSON.parse(v);
    return true;
  } catch (e) {
    return false;
  }
}

async function restoreWrite(env, entries) {
  let restored = 0;
  let skipped = 0;
  for (const e of (Array.isArray(entries) ? entries : []).slice(0, 40)) {
    if (!e || !validRestore(e.k, e.v, e.m)) {
      skipped++;
      continue;
    }
    const meta = e.k.startsWith('sub:') && e.m && typeof e.m === 'object' ? { metadata: { d: String(e.m.d || ''), ...(e.m.via ? { via: String(e.m.via) } : {}) } } : undefined;
    await env.BLOG.put(e.k, e.v, meta);
    restored++;
  }
  return { restored, skipped };
}

// Product cards inside posts: [[card:Title|Price|ImageURL|BuyLink]] (price and image are optional)
function cardParts(inner) {
  const parts = String(inner).split('|').map((x) => x.trim());
  if (parts.length < 2) return null;
  const link = safeUrl(parts[parts.length - 1]);
  const title = parts[0].slice(0, 120);
  if (!link || !title) return null;
  return {
    title,
    price: parts.length > 2 ? parts[1].slice(0, 40) : '',
    image: parts.length > 3 ? safeUrl(parts[2]) : '',
    link
  };
}

function parseCards(text) {
  const out = [];
  String(text || '').replace(/\[\[card:([^\]]+)\]\]/g, (m, inner) => {
    const c = cardParts(inner);
    if (c) out.push(c);
    return m;
  });
  return out.slice(0, 6);
}


// ---------- Legal pages ----------
const LEGAL = {
  terms: {
    name: 'Terms of Use',
    desc: 'The terms for using this website.',
    html: `<p>By using this website you agree to these terms. If you do not agree, please do not use the site.</p>
<h2>Content</h2><p>Posts, books and tools are shared for information and learning. We try to keep them correct, but we do not promise that everything is complete or free of mistakes.</p>
<h2>Your use</h2><p>You may read and share links to our pages. Do not copy our posts or books and publish them as your own, and do not misuse the site, its forms or its comments.</p>
<h2>Comments and messages</h2><p>Be respectful. We may remove comments that are abusive, spam or unlawful.</p>
<h2>Purchases</h2><p>Paid books are sold under the payment details shown on the book page. Links to other stores take you to websites we do not control.</p>
<h2>Changes</h2><p>We may update these terms from time to time. Continued use means you accept the updated terms.</p>
<p>Questions? Use the contact details on the homepage.</p>`
  },
  disclaimer: {
    name: 'Disclaimer',
    desc: 'Important notes about the information and tools on this website.',
    html: `<h2>General information only</h2><p>Everything on this website is for general information and education. It is not professional advice.</p>
<h2>Health tools</h2><p>The BMI and water calculators give rough estimates. They are not medical advice. Please speak to a doctor or health worker about your own situation.</p>
<h2>Religious and Zakat tools</h2><p>The Zakat calculator, Hijri date converter and similar tools are aids only. Scholars differ on some details, so please ask a qualified scholar about your own case.</p>
<h2>Traditional and spiritual texts</h2><p>Books and summaries about spiritual or traditional knowledge are shared for study and history. We do not promise any result from them.</p>
<h2>Earnings</h2><p>Posts about making money show what is possible, not what will happen to you. Results depend on your effort, skills and market.</p>
<h2>External links</h2><p>We are not responsible for the content or safety of websites we link to.</p>`
  },
  'affiliate-disclosure': {
    name: 'Affiliate Disclosure',
    desc: 'How affiliate links and commissions work on this website.',
    html: `<p>Some links on this website are affiliate links. If you click one and buy something, we may earn a small commission. You pay the same price, and the commission does not change what you pay.</p>
<p>We only recommend things we believe are useful to readers. Our opinions are our own, and a commission never decides what we write.</p>
<p>As an Amazon Associate I earn from qualifying purchases.</p>
<p>We may also take part in the affiliate programs of other stores, such as Jumia and Konga. Product cards and buy buttons on the site may use such links.</p>`
  }
};

async function legalPage(env, url, key) {
  const L = LEGAL[key];
  if (!L) return null;
  const SITE = url.origin, path = '/' + key;
  const body = crumbs([{ name: 'Home', href: '/' }, { name: L.name }]) + `<h1 class="sec">${esc(L.name)}</h1><div class="wrap text" style="padding:0">${L.html}</div>`;
  return staticPage(env, url, {
    path,
    title: `${L.name} | ${NAME}`,
    desc: L.desc,
    body,
    ld: { '@context': 'https://schema.org', '@graph': [breadcrumbLd(SITE, [{ name: 'Home', path: '/' }, { name: L.name, path }])] }
  });
}


// ---------- IndexNow: tells Bing, Yandex and others about new pages at once (Google does not use it) ----------
const INDEXNOW_KEY = '04de79cf454c4007ccfb8252008f2de8';
async function indexNow(origin, urls) {
  try {
    const list = [...new Set(urls)].filter((u) => typeof u === 'string' && u.startsWith(origin)).slice(0, 100);
    if (!list.length) return { sent: 0 };
    const r = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: new URL(origin).host, key: INDEXNOW_KEY, keyLocation: `${origin}/${INDEXNOW_KEY}.txt`, urlList: list }),
      signal: AbortSignal.timeout(3000)
    });
    return { sent: list.length, status: r.status };
  } catch (e) {
    return { sent: 0, error: 'unreachable' };
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;
    try {
      if (p.startsWith('/api/')) return await api(request, env, url);
      if (p === `/${INDEXNOW_KEY}.txt`) return new Response(INDEXNOW_KEY, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
      if (p === '/sitemap.xml') return await sitemap(env, url.origin);
      if (p === '/feed.xml') return await feed(env, url.origin);
      if (p === '/robots.txt') return robots(url.origin);
      if (p.startsWith('/p/')) return await postPage(env, url, request);
      const pn = p.length > 1 ? p.replace(/\/+$/, '') : p;
      if (pn === '/archive') return await archivePage(env, url);
      if (pn === '/tags') return await tagsPage(env, url);
      if (pn.startsWith('/tag/')) return await tagPage(env, url, pn.slice(5));
      if (pn === '/store') return await storePage(env, url);
      if (Object.prototype.hasOwnProperty.call(LEGAL, pn.slice(1)) && pn.indexOf('/', 1) < 0) return await legalPage(env, url, pn.slice(1));
      if (pn === '/tools') return await toolsIndexPage(env, url);
      if (pn.startsWith('/tools/')) return await toolPage(env, url, pn.slice(7));
      if (p === '/' || p === '/index.html') return await withOrigin(request, env, url);
    } catch (e) {
      return json({ error: 'server_error' }, 500);
    }
    return env.ASSETS.fetch(request);
  }
};