// Parklights Studija - statinis dashboardas (public/) + komentarų API be prisijungimo.
// Komentarai saugomi D1 lentelėje `comments` (žr. db/schema.sql).
// Autorius = nario žymė, pasirinkta puslapyje. Ištrinti gali tik ta naršyklė, kuri parašė
// (raktas `parklights.key` naršyklės localStorage; DB laikomas tik jo SHA-256).

const MEMBERS = new Set(['VS', 'LM', 'AR', 'RS']);
const SONG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const KEY_RE = /^[A-Za-z0-9_-]{20,64}$/;
const MAX_TEXT = 1000;
const MAX_BODY = 8 * 1024;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 10; // komentarų per minutę iš vienos naršyklės

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === '/api/comments' || path.startsWith('/api/comments/')) {
      try {
        return await comments(request, env, path);
      } catch (err) {
        console.error(err);
        return json({ error: 'server' }, 500);
      }
    }
    if (path.startsWith('/api/')) return json({ error: 'not_found' }, 404);
    if (path.startsWith('/audio/')) return audio(request, env);
    return env.ASSETS.fetch(request);
  },
};

// MP3 su Range palaikymu (iPhone Safari be 206 atsakymų negroja ir neleidžia prasukti).
async function audio(request, env) {
  const range = request.headers.get('Range');
  const res = await env.ASSETS.fetch(request);
  if (!range || res.status !== 200) return res;
  const m = range.match(/^bytes=(\d*)-(\d*)$/);
  if (!m || (m[1] === '' && m[2] === '')) return res;
  const buf = await res.arrayBuffer();
  const size = buf.byteLength;
  let start, end;
  if (m[1] === '') { start = Math.max(0, size - Number(m[2])); end = size - 1; }
  else { start = Number(m[1]); end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1); }
  if (start >= size || start > end) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }
  const headers = new Headers(res.headers);
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.set('Content-Length', String(end - start + 1));
  headers.set('Accept-Ranges', 'bytes');
  return new Response(buf.slice(start, end + 1), { status: 206, headers });
}

async function comments(request, env, path) {
  const method = request.method;
  const key = request.headers.get('X-Client-Key') || '';
  const owner = KEY_RE.test(key) ? await sha256(key) : null;

  if (path === '/api/comments' && method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT id, song, author, text, at, owner FROM comments ORDER BY at ASC LIMIT 5000'
    ).all();
    return json({
      comments: results.map((r) => ({
        id: r.id, song: r.song, by: r.author, text: r.text, at: r.at,
        mine: !!(owner && r.owner === owner),
      })),
    });
  }

  if (path === '/api/comments' && method === 'POST') {
    if (!owner) return json({ error: 'bad_key' }, 400);
    const raw = await request.text();
    if (raw.length > MAX_BODY) return json({ error: 'too_large' }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: 'bad_json' }, 400); }
    const song = typeof body.song === 'string' ? body.song : '';
    const by = typeof body.by === 'string' ? body.by : '';
    const text = typeof body.text === 'string' ? body.text.trim().slice(0, MAX_TEXT) : '';
    if (!SONG_RE.test(song) || !MEMBERS.has(by) || !text) return json({ error: 'invalid' }, 400);

    const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
    const recent = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM comments WHERE owner = ? AND at > ?'
    ).bind(owner, since).first();
    if (recent && recent.n >= RATE_MAX) return json({ error: 'rate_limited' }, 429);

    const id = crypto.randomUUID().replace(/-/g, '');
    const at = new Date().toISOString();
    await env.DB.prepare(
      'INSERT INTO comments (id, song, author, text, at, owner) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, song, by, text, at, owner).run();
    return json({ comment: { id, song, by, text, at, mine: true } }, 201);
  }

  const m = path.match(/^\/api\/comments\/([^/]+)$/);
  if (m && method === 'DELETE') {
    const id = decodeURIComponent(m[1]);
    if (!ID_RE.test(id) || !owner) return json({ error: 'invalid' }, 400);
    const res = await env.DB.prepare('DELETE FROM comments WHERE id = ? AND owner = ?')
      .bind(id, owner).run();
    if (!res.meta || !res.meta.changes) return json({ error: 'not_yours' }, 403);
    return json({ ok: true });
  }

  return json({ error: 'method_not_allowed' }, 405);
}

async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
