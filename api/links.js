// /api/links.js
import { list, put, del, head, get } from '@vercel/blob';

export const config = {
  runtime: 'edge', // cepat & hemat
};

const BLOB_FILENAME = 'links.json';
const ALLOWED_ORIGINS = [
  'https://rohim.my.id',
  'https://jokisubmit.vercel.app/'
];

async function ensureJson(blobUrl, env) {
  // kalau file belum ada, create kosong
  try {
    const res = await fetch(blobUrl, { method: 'HEAD' });
    if (res.ok) return blobUrl;
  } catch {}
  // create baru
  const init = JSON.stringify({ links: [] }, null, 2);
  const created = await put(BLOB_FILENAME, init, {
    access: 'private', // tidak bisa dibaca langsung, hanya via API
    token: process.env.BLOB_READ_WRITE_TOKEN
  });
  return created.url;
}

async function loadAll(env) {
  // cari blob bernama links.json
  const files = await list({ token: env.BLOB_READ_WRITE_TOKEN });
  const item = files.blobs.find(b => b.pathname === BLOB_FILENAME);
  const url = item ? item.url : await ensureJson('', env);
  const res = await fetch(url);
  if (!res.ok) return { links: [] , url };
  const json = await res.json().catch(async () => JSON.parse(await res.text()));
  return { ...(typeof json === 'object' ? json : { links: [] }), url };
}

async function saveAll(url, data, env) {
  const body = JSON.stringify(data, null, 2);
  const saved = await put(BLOB_FILENAME, body, {
    access: 'private',
    token: env.BLOB_READ_WRITE_TOKEN
  });
  return saved.url;
}

function ok(json, init={}) { return new Response(JSON.stringify(json), { status: 200, headers: { 'Content-Type': 'application/json', ...init.headers } }); }
function bad(msg, code=400) { return new Response(JSON.stringify({ error: msg }), { status: code, headers: { 'Content-Type': 'application/json' } }); }

export default async function handler(req) {
  const { method, headers } = req;
  const origin = headers.get('origin') || '';

  // CORS preflight
  if (method === 'OPTIONS') {
    const allow = ALLOWED_ORIGINS.includes(origin);
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': allow ? origin : '*',
        'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  // Allow GET from anywhere (read-only), write ops only from allowed origins
  const allowOrigin = (method === 'GET') || ALLOWED_ORIGINS.includes(origin);
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowOrigin ? origin || '*' : 'null',
    'Vary': 'Origin',
  };
  if (!allowOrigin) return bad('Origin not allowed', 403);

  // Need token for Blob RW
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return bad('Missing BLOB_READ_WRITE_TOKEN', 500);
  }

  // Load data
  const env = { BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN };
  const { links, url } = await loadAll(env);

  if (method === 'GET') {
    return ok({ links }, { headers: corsHeaders });
  }

  if (method === 'POST') {
    const body = await req.json().catch(() => ({}));
    const now = Date.now();
    let updated = [...links];

    if (!body || !body.url) return bad('Invalid payload', 400);

    // upsert by id
    if (!body.id) body.id = Math.random().toString(36).slice(2) + now.toString(36);
    if (!body.created) body.created = now;

    const idx = updated.findIndex(x => x.id === body.id);
    if (idx >= 0) updated[idx] = body; else updated.unshift(body);

    await saveAll(url, { links: updated }, env);
    return ok({ ok: true }, { headers: corsHeaders });
  }

  if (method === 'DELETE') {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return bad('Missing id', 400);
    const updated = links.filter(l => l.id !== id);
    await saveAll(url, { links: updated }, env);
    return ok({ ok: true }, { headers: corsHeaders });
  }

  return bad('Method not allowed', 405);
}
