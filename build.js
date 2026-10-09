/* Allarbaa.cloud build: joins index.html + style.css + app-1.js, app-2.js ...
   into dist/index.html and copies every other file next to it.
   Each part ends with an END-OF-FILE line so a file that was cut off while
   copying is caught here and the build stops (the live site stays untouched). */
const fs = require('fs');
const { spawnSync } = require('child_process');

function fail(msg) { console.error('BUILD STOPPED: ' + msg); process.exit(1); }
function read(f) {
  if (!fs.existsSync(f)) fail(f + ' is missing from the repository.');
  return fs.readFileSync(f, 'utf8');
}
function body(f, marker) {
  const t = read(f);
  const re = new RegExp('\\n?' + marker.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '\\s*$');
  if (!re.test(t)) fail(f + ' is incomplete (it was cut off). Upload it again as a file.');
  return t.replace(re, '');
}

const css = body('style.css', '/*END-OF-FILE*/');
const parts = fs.readdirSync('.').filter((f) => /^app-\d+\.js$/.test(f))
  .sort((a, b) => parseInt(a.slice(4), 10) - parseInt(b.slice(4), 10));
if (parts.length < 3) fail('Expected app-1.js, app-2.js and app-3.js, found ' + parts.length + '.');
const js = parts.map((f) => body(f, '//END-OF-FILE')).join('');
if (!/^\s*\(function\(\)\{/.test(js) || !/\}\)\(\);\s*$/.test(js)) fail('The app-*.js files do not join into one complete script.');

let html = read('index.html');
if (!html.includes('/*@CSS*/') || !html.includes('//@JS')) fail('index.html is missing its /*@CSS*/ or //@JS marker.');
if (!/<\/html>\s*$/.test(html)) fail('index.html is incomplete (it does not end with </html>).');
html = html.replace('/*@CSS*/', () => css).replace('//@JS', () => js);

if (!fs.existsSync('_worker.js')) fail('_worker.js is missing. Without it the blog posts and API will not load.');
fs.mkdirSync('dist', { recursive: true });
const skip = /^(index\.html|style\.css|app-\d+\.js|build\.js|README\.md|package(-lock)?\.json)$/;
for (const f of fs.readdirSync('.')) {
  if (f.startsWith('.') || skip.test(f) || !fs.statSync(f).isFile()) continue;
  fs.copyFileSync(f, 'dist/' + f);
}
fs.writeFileSync('dist/index.html', html);
console.log('Joined OK: ' + html.length + ' chars from ' + (parts.length + 2) + ' files');

/* Optional minify. The result is used only if it is complete and still has
   the markers the worker needs; otherwise the normal page is kept. */
const MARKERS = ['<!--SEO_HEAD_START-->', '<!--SEO_HEAD_END-->', '<!--SEO_BODY-->', '<!--CUSTOM_HEAD-->', '<!--CUSTOM_BODY_END-->'];
const missing = MARKERS.filter((m) => !html.includes(m));
if (missing.length) fail('index.html has lost these markers the worker needs: ' + missing.join(', '));
try {
  const r = spawnSync('npx', ['--yes', 'html-minifier-terser', '--collapse-whitespace', '--remove-comments',
    '--ignore-custom-comments', '["SEO_HEAD","SEO_BODY","CUSTOM_"]', '--minify-js', 'true', '--minify-css', 'true',
    '-o', 'dist/index.min.html', 'dist/index.html'], { encoding: 'utf8', timeout: 180000 });
  if (r.status === 0 && fs.existsSync('dist/index.min.html')) {
    const min = fs.readFileSync('dist/index.min.html', 'utf8');
    const lost = MARKERS.filter((m) => !min.includes(m));
    if (lost.length) console.log('Minify skipped (it removed: ' + lost.join(', ') + ').');
    else if (!/<\/html>\s*$/.test(min) || min.length < html.length * 0.4) console.log('Minify skipped (output looked incomplete).');
    else { fs.writeFileSync('dist/index.html', min); console.log('Minified: ' + html.length + ' -> ' + min.length + ' chars'); }
  } else {
    console.log('Minify skipped (' + String((r.stderr || r.error || 'tool failed')).split('\n')[0].slice(0, 160) + ').');
  }
} catch (e) { console.log('Minify skipped (' + e.message + ').'); }
try { fs.unlinkSync('dist/index.min.html'); } catch (e) {}
console.log('Build OK');
