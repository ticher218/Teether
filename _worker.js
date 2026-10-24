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
  waChannel: 'https://whatsapp.com/channel/0029Va9Allarbaa',
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
      return /^## /.test(b) ? `<h3>${b.slice(3)}</h3>` : `<p>${b.replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');
}

const excerpt = (t, n = 160) =>
  Array.isArray(t) ? excerptText(t[0] || '', n) : excerptText(t, n);

const excerptText = (t, n = 160) =>
  String(t || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\[\[btn:[^\]]*\]\]/g, '')
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
  const pool = (await getIndex(env)).filter((p) => p.id !== cur.id && p.type !== 'product' && p.status !== 'draft');
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
    waChannel: typeof s.waChannel === 'string' ? s.waChannel : DEFAULTS.waChannel,
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

  let imgCount = existing ? existing.imgCount || 0 : 0;
  if (Array.isArray(body.images)) {
    const imgs = body.images.slice(0, 4).filter((s) => dataUrlOk(s, 2000000));
    for (let n = 0; n < (existing ? existing.imgCount || 0 : 0); n++) await env.BLOG.delete(`img:${id}:${n}`);
    for (let n = 0; n < imgs.length; n++) await env.BLOG.put(`img:${id}:${n}`, imgs[n]);
    imgCount = imgs.length;
  }

  const views = existing ? (parseInt(existing.views, 10) || 0) : 0;
  const post = { id, slug, url: `/p/${id}`, title, type, content, pages, excerpt: exc, link, codeLink, store, price, status, tags, imgCount, views, date: existing ? existing.date : now, updated: now, author: AUTHOR_NAME };
  await env.BLOG.put(`post:${id}`, JSON.stringify(post));

  const sum = { id, slug, url: `/p/${id}`, title, type, status, tags, excerpt: exc, imgCount, views, date: post.date, updated: now, author: AUTHOR_NAME };
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
      if (p.type !== 'book' || p.status === 'draft') return json({ error: 'not_found' }, 404);
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
        const posts = authed(request, env) ? all : all.filter((p) => p.status !== 'draft');
        return json({ posts });
      }
      if (m === 'POST') {
        if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
        const b = await request.json().catch(() => null);
        if (!b) return json({ error: 'bad_json' }, 400);
        const r = await savePost(env, b, null, null);
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
        if (p.status === 'draft' && !isAdmin) return json({ error: 'not_found' }, 404);

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
  const pub = idx.filter((x) => x.type !== 'product' && x.status !== 'draft');
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
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${urls.join('')}</urlset>`,
    { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=600' } }
  );
}

async function feed(env, SITE) {
  const idx = (env.BLOG ? await getIndex(env) : []).filter((x) => x.type !== 'product' && x.status !== 'draft').slice(0, 30);
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
  if (post && post.status === 'draft') post = null;
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
  const body = `<article><h1>${esc(post.title)}</h1>${bodyHtml}</article>${relatedHtml(related)}`;
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

// Small crawlable list of the most-read posts for the homepage HTML (hidden by the page's own script)
async function homeSeoBody(env, SITE) {
  if (!env.BLOG) return '';
  const pub = (await getIndex(env)).filter((p) => p.type !== 'product' && p.status !== 'draft');
  if (!pub.length) return '';
  const top = pub
    .slice()
    .sort((a, b) => (b.views || 0) - (a.views || 0) || new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, 5);
  return `<nav aria-label="Popular reads"><h2>Popular reads</h2><ul>${top
    .map((p) => `<li><a href="${SITE}/p/${esc(p.id)}">${esc(p.title)}</a></li>`)
    .join('')}</ul></nav>`;
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;
    try {
      if (p.startsWith('/api/')) return await api(request, env, url);
      if (p === '/sitemap.xml') return await sitemap(env, url.origin);
      if (p === '/feed.xml') return await feed(env, url.origin);
      if (p === '/robots.txt') return robots(url.origin);
      if (p.startsWith('/p/')) return await postPage(env, url, request);
      if (p === '/' || p === '/index.html') return await withOrigin(request, env, url);
    } catch (e) {
      return json({ error: 'server_error' }, 500);
    }
    return env.ASSETS.fetch(request);
  }
};
