/* Allarbaa.cloud - Cloudflare Pages worker
   Needs: KV binding named BLOG, and variable ADMIN_PASSWORD (Pages > Settings). */

const DEFAULT_SITE = 'https://allarbaa.cloud'; // links use whatever address the visitor is on
const NAME = 'Allarbaa.cloud';
const ID_RE = /^[a-z0-9][a-z0-9-]{2,90}$/;
const BOT_RE = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|uptime/i;
const RX_TYPES = ['helpful', 'fire', 'applause', 'heart'];
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
const HEAD_RE = /<!--SEO_HEAD_START-->[\s\S]*?<!--SEO_HEAD_END-->/;

const DEFAULTS = {
  social: { fb: '', wa: '', ig: '', x: '', yt: '', li: '', tt: '', tg: '', coffee: '' },
  payments: [],
  customCode: { css: '', head: '', bodyJs: '' },
  authorBio: '',
  email: '',
  waChannel: '',
  logo: '',
  stores: {
    amazon: { link: 'https://www.amazon.com/', id: '', img: 0 },
    jumia: { link: 'https://www.jumia.com.ng/', id: '', img: 0 },
    konga: { link: 'https://www.konga.com/', id: '', img: 0 }
  },
  phones: ['+2347069444260', '+2349017668973']
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
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

/* Turns plain text into safe HTML.
   [[btn:Label|https://link]] -> affiliate button, [text](https://link) -> text link,
   **bold**, "## Heading", ```code```, blank line = new paragraph. */
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
      if (cm) return `<pre>${blocks[+cm[1]] || ''}</pre>`;
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

const authed = (request, env) => {
  const k = request.headers.get('x-admin-key') || '';
  return !!env.ADMIN_PASSWORD && k === env.ADMIN_PASSWORD;
};

/* Visits that must NOT be counted: the owner (admin key or owner flag on their device),
   repeat opens in the same browser session, and known bots/crawlers. */
const skipCount = (request, env) =>
  authed(request, env) ||
  request.headers.get('x-no-count') === '1' ||
  BOT_RE.test(request.headers.get('user-agent') || '');

async function getIndex(env) {
  try {
    return JSON.parse((await env.BLOG.get('index')) || '[]');
  } catch (e) {
    return [];
  }
}

async function putIndex(env, idx) {
  idx.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
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
    // migrate an old single bank-account setting the first time it's read
    payments = [{ type: 'bank', label: s.bank.bankName || 'Bank transfer', value: [s.bank.number, s.bank.name].filter(Boolean).join(' \u2014 ') }];
  }
  return {
    social: { ...DEFAULTS.social, ...(s.social || {}) },
    stores,
    phones: Array.isArray(s.phones) ? s.phones : DEFAULTS.phones,
    payments,
    customCode: { ...DEFAULTS.customCode, ...(s.customCode || {}) },
    authorBio: typeof s.authorBio === 'string' ? s.authorBio : DEFAULTS.authorBio,
    email: typeof s.email === 'string' ? s.email : '',
    waChannel: typeof s.waChannel === 'string' ? s.waChannel : '',
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

/* Anything the admin page did not send is kept as it was, so saving one part
   of the settings never wipes another part. */
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
      id: String(o.id || '').replace(/[^A-Za-z0-9._-]/g, '').slice(0, 60),
      img: (existing && existing.stores[k] && existing.stores[k].img) || 0
    };
  }
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
      css: String(cc.css || '').slice(0, 20000),
      head: String(cc.head || '').slice(0, 20000),
      bodyJs: String(cc.bodyJs || '').slice(0, 20000)
    };
  } else out.customCode = existing.customCode;

  out.authorBio = has('authorBio') ? String(b.authorBio || '').trim().slice(0, 600) : existing.authorBio;

  if (has('email')) {
    const e = String(b.email || '').trim().slice(0, 200);
    out.email = EMAIL_RE.test(e) ? e : '';
  } else out.email = existing.email;

  out.waChannel = has('waChannel') ? normUrl(b.waChannel) : existing.waChannel;

  if (has('logo')) {
    if (b.logo === '' || b.logo === null) out.logo = '';
    else out.logo = dataUrlOk(b.logo, 400000) ? b.logo : existing.logo;
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
      .map((pg) => String(pg || '').replace(/\r\n?/g, '\n').trim().slice(0, 20000))
      .filter((pg) => pg.length)
      .slice(0, 300);
  } else {
    content = String(body.content || '').replace(/\r\n?/g, '\n').trim().slice(0, 50000);
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
          .map((t) => String(t || '').trim().slice(0, 24))
          .filter(Boolean)
          .slice(0, 8);
  const now = new Date().toISOString();
  id = id || makeId(title);

  let imgCount = existing ? existing.imgCount || 0 : 0;
  if (Array.isArray(body.images)) {
    const imgs = body.images
      .slice(0, 4)
      .filter((s) => dataUrlOk(s, 1800000));
    for (let n = 0; n < (existing ? existing.imgCount || 0 : 0); n++) await env.BLOG.delete(`img:${id}:${n}`);
    for (let n = 0; n < imgs.length; n++) await env.BLOG.put(`img:${id}:${n}`, imgs[n]);
    imgCount = imgs.length;
  }

  const views = existing ? existing.views || 0 : 0;
  const post = { id, title, type, content, pages, link, codeLink, store, price, status, tags, imgCount, views, date: existing ? existing.date : now, updated: now };
  await env.BLOG.put(`post:${id}`, JSON.stringify(post));

  const idx = await getIndex(env);
  const sum = { id, title, type, status, tags, excerpt: excerpt(type === 'book' ? pages : content), imgCount, views, date: post.date, updated: now };
  if (type === 'product') Object.assign(sum, { link, store, price });
  if (type === 'book') Object.assign(sum, { price, pageCount: pages.length });
  const i = idx.findIndex((p) => p.id === id);
  if (i >= 0) idx[i] = sum;
  else idx.push(sum);
  await putIndex(env, idx);
  return { post: { ...post, html: type === 'book' ? undefined : render(content), pageHtml: type === 'book' ? pages.map(render) : undefined } };
}

async function api(request, env, url) {
  if (!env.BLOG) return json({ error: 'kv_missing' }, 503);
  const parts = url.pathname.split('/').filter(Boolean); // ['api', route, id, n]
  const route = parts[1];
  const m = request.method;

  if (route === 'login' && m === 'POST') {
    if (!env.ADMIN_PASSWORD) return json({ error: 'password_not_set' }, 503);
    return authed(request, env) ? json({ ok: true }) : json({ error: 'unauthorized' }, 401);
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
    if (!b || b.website) return json({ ok: true }); // hidden field filled in = bot, pretend it worked
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
    if (skipCount(request, env)) return json({ ok: true, counted: false });
    try {
      const cur = parseInt((await env.BLOG.get('stat:site')) || '0', 10) || 0;
      await env.BLOG.put('stat:site', String(cur + 1));
    } catch (e) {}
    return json({ ok: true, counted: true });
  }

  if (route === 'stats' && m === 'GET') {
    if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
    return json({ views: parseInt((await env.BLOG.get('stat:site')) || '0', 10) || 0 });
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
      if (!b || b.website) return json({ ok: true, comment: null }); // honeypot
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
    const id = parts[2];
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
      const raw = await env.BLOG.get(`post:${id}`);
      if (m === 'GET') {
        if (!raw) return json({ error: 'not_found' }, 404);
        const p = JSON.parse(raw);
        const isAdmin = authed(request, env);
        if (p.status === 'draft' && !isAdmin) return json({ error: 'not_found' }, 404);
        if (!skipCount(request, env)) {
          try {
            p.views = (p.views || 0) + 1;
            await env.BLOG.put(`post:${id}`, JSON.stringify(p));
            const idx2 = await getIndex(env);
            const j = idx2.findIndex((x) => x.id === id);
            if (j >= 0) {
              idx2[j].views = p.views;
              await putIndex(env, idx2);
            }
          } catch (e) {
            /* if the counter cannot be saved, the post must still open */
          }
        }
        const reactions = await getRx(env, id);
        if (p.type === 'book' && !isAdmin) {
          const first = (p.pages && p.pages[0]) || '';
          return json({
            ...p,
            pages: undefined,
            locked: true,
            pageCount: (p.pages || []).length,
            previewHtml: render(first.slice(0, 500)),
            reactions
          });
        }
        return json({ ...p, reactions, html: p.type === 'book' ? undefined : render(p.content), pageHtml: p.type === 'book' ? (p.pages || []).map(render) : undefined });
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
  const urls = [`<url><loc>${SITE}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`];
  for (const p of idx.filter((x) => x.type !== 'product' && x.status !== 'draft')) {
    urls.push(`<url><loc>${SITE}/p/${p.id}</loc><lastmod>${String(p.updated || p.date).slice(0, 10)}</lastmod></url>`);
  }
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`,
    { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=600' } }
  );
}

async function feed(env, SITE) {
  const idx = (env.BLOG ? await getIndex(env) : []).filter((x) => x.type !== 'product' && x.status !== 'draft').slice(0, 30);
  const items = idx
    .map(
      (p) =>
        `<item><title>${esc(p.title)}</title><link>${SITE}/p/${p.id}</link><guid isPermaLink="true">${SITE}/p/${p.id}</guid><pubDate>${new Date(p.date).toUTCString()}</pubDate><description>${esc(p.excerpt)}</description></item>`
    )
    .join('');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${NAME}</title><link>${SITE}/</link><description>Teaching stories, tech blogging and books</description>${items}</channel></rss>`,
    { headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'public, max-age=600' } }
  );
}

async function postPage(env, url) {
  const SITE = url.origin;
  const id = url.pathname.split('/')[2] || '';
  const shell = await env.ASSETS.fetch(new Request(new URL('/', url).toString()));
  let html = await shell.text();
  let post = null;
  if (env.BLOG && ID_RE.test(id)) {
    const raw = await env.BLOG.get(`post:${id}`);
    if (raw) post = JSON.parse(raw);
    if (post && post.type === 'product') post = null;
  }
  const headers = { 'content-type': 'text/html; charset=utf-8' };
  if (post && post.status === 'draft') post = null;
  if (!post) {
    html = html.replace(HEAD_RE, () => `<title>Not found | ${NAME}</title><meta name="robots" content="noindex">`);
    return new Response(html, { status: 404, headers });
  }
  const link = `${SITE}/p/${post.id}`;
  const desc = excerpt(post.type === 'book' ? post.pages : post.content, 160);
  const OG_N = (hashStr(post.id) % 3) + 1;
  const img = post.imgCount ? `${SITE}/api/img/${post.id}/0?v=${encodeURIComponent(post.updated || post.date)}` : `${SITE}/og-${OG_N}.png`;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    datePublished: post.date,
    dateModified: post.updated || post.date,
    author: { '@type': 'Person', name: 'Ticher' },
    publisher: { '@type': 'Organization', name: NAME },
    mainEntityOfPage: link
  };
  ld.image = img;
  const head = [
    `<title>${esc(post.title)} | ${NAME}</title>`,
    `<meta name="description" content="${esc(desc)}">`,
    `<link rel="canonical" href="${link}">`,
    `<meta name="robots" content="index,follow,max-image-preview:large">`,
    `<meta property="og:type" content="article">`,
    `<meta property="og:site_name" content="${NAME}">`,
    `<meta property="og:title" content="${esc(post.title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:url" content="${link}">`,
    `<meta property="og:image" content="${img}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:image" content="${img}">`,
    `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`
  ].join('\n');
  const bodyHtml = post.type === 'book' ? render((post.pages && post.pages[0]) || '') : render(post.content);
  const body = `<article><h1>${esc(post.title)}</h1>${bodyHtml}</article>`;
  html = html.replace(HEAD_RE, () => head).replace('<!--SEO_BODY-->', () => body);
  html = injectCustom(html, env.BLOG ? await getSettings(env) : null);
  return new Response(html, { headers: { ...headers, 'cache-control': 'public, max-age=60' } });
}

/* Puts the Custom Code (AdSense, CSS, scripts) from the admin panel into the page.
   index.html must contain <!--CUSTOM_HEAD--> inside <head> and <!--CUSTOM_BODY_END--> before </body>. */
function injectCustom(html, settings) {
  const cc = (settings && settings.customCode) || {};
  const head = (cc.css ? `<style>${cc.css}</style>` : '') + (cc.head || '');
  const bodyEnd = cc.bodyJs ? `<script>${cc.bodyJs}<\/script>` : '';
  return html.replace('<!--CUSTOM_HEAD-->', () => head).replace('<!--CUSTOM_BODY_END-->', () => bodyEnd);
}

/* The page and robots.txt say allarbaa.cloud. Until that domain is connected,
   swap it for the address the visitor is really on (for example allarbaa.pages.dev). */
async function withOrigin(request, env, url) {
  const res = await env.ASSETS.fetch(request);
  if (!res.ok) return res;
  const settings = env.BLOG ? await getSettings(env) : null;
  const text = injectCustom((await res.text()).split(DEFAULT_SITE).join(url.origin), settings);
  const headers = new Headers(res.headers);
  headers.delete('content-length');
  headers.delete('etag');
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
      if (p.startsWith('/p/')) return await postPage(env, url);
      if (p === '/' || p === '/index.html' || p === '/robots.txt') return await withOrigin(request, env, url);
    } catch (e) {
      return json({ error: 'server_error' }, 500);
    }
    return env.ASSETS.fetch(request);
  }
};
