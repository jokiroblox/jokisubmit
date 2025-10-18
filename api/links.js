// /api/links.js
import { list, put } from '@vercel/blob';

export const config = { runtime: 'nodejs' };

const BLOB_FILENAME = 'links.json';

// SESUAIKAN origin kamu (tanpa trailing slash)
const ALLOWED_ORIGINS = [
  'https://jokisubmit.vercel.app',
  'https://rohim.my.id',
  'https://www.rohim.my.id',
];

const normalize = (s) => (s || '').replace(/\/+$/, '').toLowerCase();

function setCORS(res, origin) {
  if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
}
function ok(res, json, corsOrigin) {
  res.setHeader('Content-Type', 'application/json');
  setCORS(res, corsOrigin);
  res.status(200).send(JSON.stringify(json));
}
function bad(res, msg, code = 400, corsOrigin) {
  setCORS(res, corsOrigin);
  res.status(code).json({ error: msg });
}

async function ensureJson(env) {
  const files = await list({ token: env.BLOB_READ_WRITE_TOKEN });
  const item = files.blobs.find((b) => b.pathname === BLOB_FILENAME);
  if (item) return item.url;

  const init = JSON.stringify({ links: [] }, null, 2);
  const created = await put(BLOB_FILENAME, init, {
    access: 'public', // ⬅️ wajib PUBLIC
    token: env.BLOB_READ_WRITE_TOKEN,
    contentType: 'application/json; charset=utf-8',
  });
  return created.url;
}

async function loadAll(env) {
  const url = await ensureJson(env);
  const r = await fetch(url);
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { links: [] }; }
  if (!json || typeof json !== 'object' || !Array.isArray(json.links)) json = { links: [] };
  return { links: json.links, url };
}

async function saveAll(links, env) {
  const body = JSON.stringify({ links }, null, 2);
  await put(BLOB_FILENAME, body, {
    access: 'public', // ⬅️ wajib PUBLIC
    token: env.BLOB_READ_WRITE_TOKEN,
    contentType: 'application/json; charset=utf-8',
  });
}

// Body parser untuk Node runtime
async function readJSONBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error('Invalid JSON body')); } });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  const originRaw = req.headers.origin || '';
  const host = req.headers.host || '';
  const proto = (req.headers['x-forwarded-proto'] || 'https').toLowerCase();
  const origin = normalize(originRaw);
  const selfOrigin = normalize(`${proto}://${host}`);

  // Preflight
  if (req.method === 'OPTIONS') {
    const allow = ALLOWED_ORIGINS.map(normalize).includes(origin) || origin === selfOrigin;
    res.setHeader('Access-Control-Allow-Origin', allow ? (origin || selfOrigin) : '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('Missing BLOB_READ_WRITE_TOKEN');
      return bad(res, 'Missing BLOB_READ_WRITE_TOKEN', 500, origin || selfOrigin);
    }
    const env = { BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN };

    // CORS: GET boleh; POST/DELETE hanya dari origin terdaftar/self
    const isWrite = req.method === 'POST' || req.method === 'DELETE';
    const allowed = !isWrite || ALLOWED_ORIGINS.map(normalize).includes(origin) || origin === selfOrigin;
    if (!allowed) {
      console.warn('CORS blocked:', { origin, selfOrigin, method: req.method });
      return bad(res, 'Origin not allowed', 403, origin || selfOrigin);
    }
    const corsOrigin = origin || selfOrigin;

    const { links } = await loadAll(env);

    if (req.method === 'GET') {
      return ok(res, { links }, corsOrigin);
    }

    if (req.method === 'POST') {
      const body = await readJSONBody(req);
      if (!body || !body.url) return bad(res, 'Invalid payload', 400, corsOrigin);

      const now = Date.now();
      const item = {
        id: body.id ?? (Math.random().toString(36).slice(2) + now.toString(36)),
        title: body.title || null,
        url: body.url,
        tags: Array.isArray(body.tags) ? body.tags : [],
        notes: body.notes || null,
        favorite: !!body.favorite,
        created: body.created ?? now,
      };

      const updated = [item, ...links.filter((x) => x.id !== item.id)];
      await saveAll(updated, env);
      return ok(res, { ok: true }, corsOrigin);
    }

    if (req.method === 'DELETE') {
      const id = req.query?.id;
      if (!id) return bad(res, 'Missing id', 400, corsOrigin);
      const updated = links.filter((l) => l.id !== id);
      await saveAll(updated, env);
      return ok(res, { ok: true }, corsOrigin);
    }

    return bad(res, 'Method not allowed', 405, corsOrigin);
  } catch (err) {
    console.error('Function error:', err?.stack || err);
    return bad(res, 'Internal error (see function logs)', 500, originRaw);
  }
}
