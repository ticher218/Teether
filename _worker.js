/* Teesher.cloud - Cloudflare Pages worker
   Needs: KV binding named BLOG, and variable ADMIN_PASSWORD (Pages > Settings). */

const SITE = 'https://teesher.cloud';
const NAME = 'Teesher.cloud';
const ID_RE = /^[a-z0-9][a-z0-9-]{2,90}$/;
const HEAD_RE = /<!--SEO_HEAD_START-->[\s\S]*?<!--SEO_HEAD_END-->/;

const DEFAULTS = {
  social: { fb: '', wa: '', ig: '', x: '', yt: '', li: '', tt: '', tg: '' },
  stores: {
    amazon: 'https://www.amazon.com/',
    jumia: 'https://www.jumia.com.ng/',
    konga: 'https://www.konga.com/'
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
   **bold**, "## Heading", blank line = new paragraph. */
function render(text) {
  let s = esc(String(text || '').replace(/\r\n?/g, '\n'));
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
    .map((b) => (/^## /.test(b) ? `<h3>${b.slice(3)}</h3>` : `<p>${b.replace(/\n/g, '<br>')}</p>`))
    .join('\n');
}

const excerpt = (t, n = 160) =>
  String(t || '')
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

async function getSettings(env) {
  let s = {};
  try {
    s = JSON.parse((await env.BLOG.get('settings')) || '{}');
  } catch (e) {}
  return {
    social: { ...DEFAULTS.social, ...(s.social || {}) },
    stores: { ...DEFAULTS.stores, ...(s.stores || {}) },
    phones: Array.isArray(s.phones) ? s.phones : DEFAULTS.phones
  };
}

function cleanSettings(b) {
  const out = { social: {}, stores: {}, phones: [] };
  const src = (b && b.social) || {};
  for (const k of Object.keys(DEFAULTS.social)) {
    let v = String(src[k] || '').trim();
    if (k === 'wa' && v && !/^https?:\/\//i.test(v) && /^[+\d\s()-]{6,}$/.test(v)) {
      out.social[k] = 'https://wa.me/' + v.replace(/\D/g, '');
    } else {
      out.social[k] = normUrl(v);
    }
  }
  const st = (b && b.stores) || {};
  for (const k of Object.keys(DEFAULTS.stores)) {
    out.stores[k] = normUrl(st[k]) || DEFAULTS.stores[k];
  }
  const ph = (b && Array.isArray(b.phones) ? b.phones : []).slice(0, 5);
  out.phones = ph.map((p) => String(p).replace(/[^0-9+ ()-]/g, '').trim().slice(0, 20)).filter(Boolean);
  return out;
}

async function savePost(env, body, id, existing) {
  const title = String(body.title || '').trim().slice(0, 200);
  const content = String(body.content || '').replace(/\r\n?/g, '\n').trim().slice(0, 50000);
  if (!title || !content) return { error: 'missing_fields' };
  const type = body.type === 'book' ? 'book' : 'blog';
  const link = body.link ? safeUrl(String(body.link).slice(0, 500)) : '';
  const now = new Date().toISOString();
  id = id || makeId(title);

  let imgCount = existing ? existing.imgCount || 0 : 0;
  if (Array.isArray(body.images)) {
    const imgs = body.images
      .slice(0, 4)
      .filter((s) => typeof s === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(s) && s.length < 1800000);
    for (let n = 0; n < (existing ? existing.imgCount || 0 : 0); n++) await env.BLOG.delete(`img:${id}:${n}`);
    for (let n = 0; n < imgs.length; n++) await env.BLOG.put(`img:${id}:${n}`, imgs[n]);
    imgCount = imgs.length;
  }

  const post = { id, title, type, content, link, imgCount, date: existing ? existing.date : now, updated: now };
  await env.BLOG.put(`post:${id}`, JSON.stringify(post));

  const idx = await getIndex(env);
  const sum = { id, title, type, excerpt: excerpt(content), imgCount, date: post.date, updated: now };
  const i = idx.findIndex((p) => p.id === id);
  if (i >= 0) idx[i] = sum;
  else idx.push(sum);
  await putIndex(env, idx);
  return { post: { ...post, html: render(content) } };
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
      const s = cleanSettings(b);
      await env.BLOG.put('settings', JSON.stringify(s));
      return json(s);
    }
  }

  if (route === 'img' && m === 'GET') {
    const id = parts[2] || '';
    const n = parseInt(parts[3], 10);
    if (!ID_RE.test(id) || !(n >= 0 && n < 4)) return new Response('Not found', { status: 404 });
    const v = await env.BLOG.get(`img:${id}:${n}`);
    if (!v) return new Response('Not found', { status: 404 });
    const c = v.indexOf(',');
    const mime = v.slice(5, v.indexOf(';'));
    const bin = atob(v.slice(c + 1));
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Response(arr, {
      headers: { 'content-type': mime, 'cache-control': 'public, max-age=31536000, immutable' }
    });
  }

  if (route === 'posts') {
    const id = parts[2];
    if (!id) {
      if (m === 'GET') return json({ posts: await getIndex(env) });
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
        return json({ ...p, html: render(p.content) });
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
        const idx = (await getIndex(env)).filter((p) => p.id !== id);
        await putIndex(env, idx);
        return json({ ok: true });
      }
    }
  }
  return json({ error: 'not_found' }, 404);
}

async function sitemap(env) {
  const idx = env.BLOG ? await getIndex(env) : [];
  const urls = [`<url><loc>${SITE}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`];
  for (const p of idx) {
    urls.push(`<url><loc>${SITE}/p/${p.id}</loc><lastmod>${String(p.updated || p.date).slice(0, 10)}</lastmod></url>`);
  }
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`,
    { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=600' } }
  );
}

async function postPage(env, url) {
  const id = url.pathname.split('/')[2] || '';
  const shell = await env.ASSETS.fetch(new Request(new URL('/', url).toString()));
  let html = await shell.text();
  let post = null;
  if (env.BLOG && ID_RE.test(id)) {
    const raw = await env.BLOG.get(`post:${id}`);
    if (raw) post = JSON.parse(raw);
  }
  const headers = { 'content-type': 'text/html; charset=utf-8' };
  if (!post) {
    html = html.replace(HEAD_RE, () => `<title>Not found | ${NAME}</title><meta name="robots" content="noindex">`);
    return new Response(html, { status: 404, headers });
  }
  const link = `${SITE}/p/${post.id}`;
  const desc = excerpt(post.content, 160);
  const img = post.imgCount ? `${SITE}/api/img/${post.id}/0?v=${encodeURIComponent(post.updated || post.date)}` : '';
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
  if (img) ld.image = img;
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
    img ? `<meta property="og:image" content="${img}">` : '',
    `<meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}">`,
    `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`
  ].join('\n');
  const body = `<article><h1>${esc(post.title)}</h1>${render(post.content)}</article>`;
  html = html.replace(HEAD_RE, () => head).replace('<!--SEO_BODY-->', () => body);
  return new Response(html, { headers: { ...headers, 'cache-control': 'public, max-age=60' } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;
    try {
      if (p.startsWith('/api/')) return await api(request, env, url);
      if (p === '/sitemap.xml') return await sitemap(env);
      if (p.startsWith('/p/')) return await postPage(env, url);
    } catch (e) {
      return json({ error: 'server_error' }, 500);
    }
    return env.ASSETS.fetch(request);
  }
};
