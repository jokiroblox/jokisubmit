// /api/links.js
import { list, put } from '@vercel/blob';

export const config = { runtime: 'nodejs20.x' };

const BLOB_FILENAME = 'links.json';
const ALLOWED_ORIGINS = [
  'https://jokisubmit.vercel.app/',
  'https://rohim.my.id'
];

function ok(res, json, cors) {
  res.setHeader('Content-Type', 'application/json');
  if (cors) { res.setHeader('Access-Control-Allow-Origin', cors); res.setHeader('Vary', 'Origin'); }
  res.status(200).send(JSON.stringify(json));
}
function bad(res, msg, code=400) { res.status(code).json({ error: msg }); }

async function ensureJson(env) {
  const files = await list({ token: env.BLOB_READ_WRITE_TOKEN });
  const item = files.blobs.find(b => b.pathname === BLOB_FILENAME);
  if (item) return item.url;
  const created = await put(BLOB_FILENAME, JSON.stringify({ links: [] }, null, 2), {
    access: 'private', token: env.BLOB_READ_WRITE_TOKEN
  });
  return created.url;
}
async function loadAll(env) {
  const url = await ensureJson(env);
  const r = await fetch(url);
  const json = await r.json().catch(async () => JSON.parse(await r.text()));
  return { ...(typeof json === 'object' ? json : { links: [] }), url };
}
async function saveAll(data, env) {
  await put(BLOB_FILENAME, JSON.stringify(data, null, 2), {
    access: 'private', token: env.BLOB_READ_WRITE_TOKEN
  });
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  if (req.method === 'OPTIONS') {
    const allow = ALLOWED_ORIGINS.includes(origin);
    res.setHeader('Access-Control-Allow-Origin', allow ? origin : '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  const cors = (req.method === 'GET') ? (origin || '*') :
               (ALLOWED_ORIGINS.includes(origin) ? origin : null);
  if (!cors) return bad(res, 'Origin not allowed', 403);

  if (!process.env.BLOB_READ_WRITE_TOKEN) return bad(res, 'Missing BLOB_READ_WRITE_TOKEN', 500);
  const env = { BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN };

  const { links, url } = await loadAll(env);

  if (req.method === 'GET') return ok(res, { links }, cors);

  if (req.method === 'POST') {
    const body = req.body || {};
    if (!body.url) return bad(res, 'Invalid payload');
    const now = Date.now();
    const item = {
      id: body.id ?? (Math.random().toString(36).slice(2)+now.toString(36)),
      title: body.title || null,
      url: body.url, tags: Array.isArray(body.tags)? body.tags: [],
      notes: body.notes || null, favorite: !!body.favorite,
      created: body.created ?? now
    };
    const updated = [...links];
    const i = updated.findIndex(x=>x.id===item.id);
    if (i>=0) updated[i]=item; else updated.unshift(item);
    await saveAll({ links: updated }, env);
    return ok(res, { ok:true }, cors);
  }

  if (req.method === 'DELETE') {
    const id = req.query.id;
    if (!id) return bad(res, 'Missing id');
    const updated = links.filter(l=>l.id!==id);
    await saveAll({ links: updated }, env);
    return ok(res, { ok:true }, cors);
  }

  return bad(res, 'Method not allowed', 405);
}
