#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { URL } = require('url');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8001);
const DATA_DIR = process.env.SLIPBOX_DATA || path.join(ROOT, 'data');

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

function escapeHtml(s = '') {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseBasicAuth(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Basic ')) return null;
  try {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const i = decoded.indexOf(':');
    if (i < 0) return null;
    return { user: decoded.slice(0, i), pass: decoded.slice(i + 1) };
  } catch {
    return null;
  }
}

async function loadUsers() {
  const iniPath = path.join(ROOT, 'users.ini');
  const file = fs.existsSync(iniPath) ? iniPath : null;
  if (!file) return { admin: 'admin' };

  const raw = await fsp.readFile(file, 'utf8');
  const users = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith(';') || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    users[k] = v;
  }
  return Object.keys(users).length ? users : { admin: 'admin' };
}

async function authenticate(req, res) {
  const users = await loadUsers();
  const creds = parseBasicAuth(req);
  const ok = creds && users[creds.user] && users[creds.user] === creds.pass;
  if (ok) return true;

  res.writeHead(401, {
    'WWW-Authenticate': 'Basic realm="Slipbox"',
    'Content-Type': 'text/plain; charset=utf-8'
  });
  res.end('Unauthorized');
  return false;
}

function slugifyTitle(title) {
  let s = String(title || '').trim().toLowerCase();
  s = s.replace(/^#+\s*/, '');
  s = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s || 'untitled';
}

function firstLineTitle(text) {
  const first = (text || '').split(/\r?\n/, 1)[0] || '';
  const cleaned = first.replace(/^#+\s*/, '').trim();
  return cleaned || 'Untitled';
}

function filenameFromText(text) {
  const first = (text || '').split(/\r?\n/, 1)[0] || '';
  return `${slugifyTitle(first)}.md`;
}

async function ensureDataDir() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
}

async function listPluginFiles() {
  const pluginsDir = path.join(ROOT, 'plugins');
  try {
    const entries = await fsp.readdir(pluginsDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.js'))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

async function listDocs() {
  await ensureDataDir();
  const entries = await fsp.readdir(DATA_DIR, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.md'));

  const withTimes = await Promise.all(
    files.map(async (e) => {
      const full = path.join(DATA_DIR, e.name);
      const stat = await fsp.stat(full);
      return { name: e.name, mtimeMs: stat.mtimeMs || 0 };
    })
  );

  // Newest first.
  withTimes.sort((a, b) => b.mtimeMs - a.mtimeMs || a.name.localeCompare(b.name));
  return withTimes.map((f) => f.name);
}

async function ensureSeedDoc() {
  const docs = await listDocs();
  if (docs.length) return docs;
  await fsp.writeFile(path.join(DATA_DIR, 'untitled.md'), '', 'utf8');
  return ['untitled.md'];
}

function uniqueName(baseName, takenSet) {
  if (!takenSet.has(baseName)) return baseName;
  const ext = '.md';
  const stem = baseName.slice(0, -ext.length);
  let n = 2;
  while (takenSet.has(`${stem}-${n}${ext}`)) n += 1;
  return `${stem}-${n}${ext}`;
}

async function readDoc(filename) {
  const full = path.join(DATA_DIR, filename);
  const text = await fsp.readFile(full, 'utf8');
  return text;
}

async function writeDoc(filename, text) {
  const full = path.join(DATA_DIR, filename);
  await fsp.writeFile(full, text, 'utf8');
}

function parseForm(body) {
  const out = {};
  for (const pair of body.split('&')) {
    if (!pair) continue;
    const i = pair.indexOf('=');
    const k = decodeURIComponent((i >= 0 ? pair.slice(0, i) : pair).replace(/\+/g, ' '));
    const v = decodeURIComponent((i >= 0 ? pair.slice(i + 1) : '').replace(/\+/g, ' '));
    out[k] = v;
  }
  return out;
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        req.destroy();
        reject(new Error('Body too large'));
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function renderEditor(docName, text, prevName, nextName, pluginScriptsHtml = '') {
  const slug = docName.replace(/\.md$/i, '');

  return `<!DOCTYPE html>
<head>
  <title>${escapeHtml(firstLineTitle(text))} - Slipbox</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <link rel="stylesheet" type="text/css" href="/main.css">
  <link rel="stylesheet" type="text/css" href="/vendor/material-ui/material-ui.css">
  <link rel="icon" type="image/png" sizes="64x64" href="/media/pen-nib-solid.png">
  <link rel="icon" type="image/png" sizes="128x128" href="/media/pen-nib-solid-128.png">
  <link rel="shortcut icon" type="image/png" href="/media/pen-nib-solid.png">
  <link rel="apple-touch-icon" href="/media/pen-nib-solid-128-white.png">
</head>
<body>
  <div id="title">
    <p id="nav" style="float: right;">
      <a href="/search"><span class="material-icons" title="Search">search</span></a>
      <a href="/doc/${encodeURIComponent(prevName.replace(/\.md$/i, ''))}"><span class="material-icons" title="Previous Document">navigate_before</span></a>
      <a href="/doc/${encodeURIComponent(nextName.replace(/\.md$/i, ''))}"><span class="material-icons" title="Next Document">navigate_next</span></a>
      <a href="/new"><span class="material-icons" title="Add New Document">add</span></a>
      <a href="#" id="pluginsButton"><span class="material-icons" title="Menu">menu</span></a>
    </p>
    <p id="page">${escapeHtml(docName)}</p>
  </div>

  <div id="menu">
    <ul id="pluginMenuItems">
      <li>No plugins loaded</li>
    </ul>
  </div>

  <input type="hidden" name="doc" value="${escapeHtml(docName)}">
  <textarea id="typebox" name="text" hx-post="/save" hx-trigger="keyup delay:500ms, paste delay:75ms" hx-sync="this:replace" hx-include="[name='doc']">${escapeHtml(text)}</textarea>

  <script src="/view/edit/edit.js"></script>
  <script src="/view/edit/plugins.js"></script>
  <script src="/vendor/commonmark.min.js"></script>
  ${pluginScriptsHtml}
  <script src="/vendor/htmx.min.js"></script>
</body>
</html>`;
}

function renderSearch() {
  return `<!DOCTYPE html>
<head>
  <title>Slipbox - Search</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <link rel="stylesheet" type="text/css" href="/main.css">
  <link rel="stylesheet" type="text/css" href="/view/search/search.css">
  <link rel="stylesheet" type="text/css" href="/vendor/material-ui/material-ui.css">
  <link rel="icon" type="image/png" sizes="64x64" href="/media/pen-nib-solid.png">
  <link rel="icon" type="image/png" sizes="128x128" href="/media/pen-nib-solid-128.png">
  <link rel="shortcut icon" type="image/png" href="/media/pen-nib-solid.png">
  <link rel="apple-touch-icon" href="/media/pen-nib-solid-128-white.png">
</head>
<body>
  <div id="title">
    <p id="nav" style="float:right;">
      <a href="/"><span class="material-icons" title="Close Search">close</span></a>
    </p>
    <p id="page"></p>
  </div>

  <div id="searchPane">
    <input type="text" name="search" placeholder="Enter your search..." hx-get="/find" hx-target="#results" autofocus>
    <div id="results"></div>
  </div>

  <script src="/vendor/htmx.min.js"></script>
</body>
</html>`;
}

async function serveStatic(res, pathname) {
  const target = path.normalize(path.join(ROOT, pathname));
  if (!target.startsWith(ROOT)) return send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');

  try {
    const stat = await fsp.stat(target);
    if (!stat.isFile()) return send(res, 404, 'Not Found', 'text/plain; charset=utf-8');
    const ext = path.extname(target).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    fs.createReadStream(target).pipe(res);
  } catch {
    send(res, 404, 'Not Found', 'text/plain; charset=utf-8');
  }
}

function send(res, code, body, type = 'text/html; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  try {
    if (!(await authenticate(req, res))) return;

    const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = u.pathname;

    if (pathname.startsWith('/media/') || pathname.startsWith('/vendor/') || pathname.startsWith('/view/') || pathname.startsWith('/plugins/') || pathname === '/main.css') {
      return serveStatic(res, pathname);
    }

    if (pathname === '/health' && req.method === 'GET') {
      return send(res, 200, 'ok', 'text/plain; charset=utf-8');
    }

    if (pathname === '/search' && req.method === 'GET') {
      return send(res, 200, renderSearch());
    }

    if (pathname === '/find' && req.method === 'GET') {
      const q = (u.searchParams.get('search') || '').toLowerCase();
      const docs = await ensureSeedDoc();
      const results = [];
      for (const d of docs) {
        const text = await readDoc(d);
        if (!q || text.toLowerCase().includes(q)) {
          const title = firstLineTitle(text);
          const slug = d.replace(/\.md$/i, '');
          const bodyWithoutTitle = (text || '').split(/\r?\n/).slice(1).join(' ');
          const fragment = bodyWithoutTitle.replace(/\s+/g, ' ').trim().slice(0, 80);
          results.push({ title, slug, fragment });
        }
      }
      const html = results
        .map((r) => `<p><a href="/doc/${encodeURIComponent(r.slug)}">${escapeHtml(r.title)}</a><br>${escapeHtml(r.fragment)}</p>`)
        .join('');
      return send(res, 200, html);
    }

    if (pathname === '/new' && req.method === 'GET') {
      const docs = await ensureSeedDoc();
      const set = new Set(docs);
      const name = uniqueName('untitled.md', set);
      await writeDoc(name, '');
      const slug = name.replace(/\.md$/i, '');
      res.writeHead(302, { Location: `/doc/${encodeURIComponent(slug)}` });
      return res.end();
    }

    if (pathname === '/save' && req.method === 'POST') {
      const form = parseForm(await readBody(req));
      const currentName = path.basename(form.doc || 'untitled.md');
      const text = form.text || '';

      const docs = await ensureSeedDoc();
      const set = new Set(docs);
      if (!set.has(currentName)) set.add(currentName);

      const desired = filenameFromText(text);
      let target = currentName;

      if (desired !== currentName) {
        set.delete(currentName);
        target = uniqueName(desired, set);
      }

      await writeDoc(target, text);

      if (target !== currentName) {
        const oldPath = path.join(DATA_DIR, currentName);
        if (fs.existsSync(oldPath)) await fsp.unlink(oldPath);
      }

      res.writeHead(204, {
        'HX-Trigger': JSON.stringify({ documentRenamed: { doc: target } })
      });
      return res.end();
    }

    if (pathname === '/' && req.method === 'GET') {
      const docs = await ensureSeedDoc();
      const first = docs[0].replace(/\.md$/i, '');
      res.writeHead(302, { Location: `/doc/${encodeURIComponent(first)}` });
      return res.end();
    }

    if (pathname.startsWith('/doc/') && req.method === 'GET') {
      const slug = decodeURIComponent(pathname.slice('/doc/'.length)).trim();
      const name = `${path.basename(slug)}.md`;
      const docs = await ensureSeedDoc();
      const idx = docs.indexOf(name);

      const useIdx = idx >= 0 ? idx : 0;
      const useName = docs[useIdx];
      const prevName = docs[(useIdx - 1 + docs.length) % docs.length];
      const nextName = docs[(useIdx + 1) % docs.length];
      const text = await readDoc(useName);
      const pluginFiles = await listPluginFiles();
      const pluginScriptsHtml = pluginFiles.map((name) => `<script src="/plugins/${encodeURIComponent(name)}"></script>`).join('\n  ');

      return send(res, 200, renderEditor(useName, text, prevName, nextName, pluginScriptsHtml));
    }

    send(res, 404, 'Not Found', 'text/plain; charset=utf-8');
  } catch (err) {
    send(res, 500, `Server error\n${String(err.message || err)}`, 'text/plain; charset=utf-8');
  }
});

server.listen(PORT, () => {
  console.log(`Slipbox running on http://localhost:${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
  console.log('Default auth: admin/admin (create users.ini to change)');
});
