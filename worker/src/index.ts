import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { nanoid } from 'nanoid'

interface VisionProfile {
  protan: number
  deutan: number
  tritan: number
  macular: number
}

type Bindings = {
  DB: D1Database
  IMAGES: R2Bucket
  ASSETS: Fetcher
  MAX_IMAGE_BYTES: string
  PUBLIC_BASE: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', cors({ origin: '*', allowMethods: ['GET', 'POST', 'OPTIONS'] }))

app.get('/api/health', (c) => c.json({ ok: true }))

/** POST /api/posts — multipart: image + meta(JSON) */
app.post('/api/posts', async (c) => {
  const maxBytes = Number(c.env.MAX_IMAGE_BYTES || '2097152')
  let form: FormData
  try {
    form = await c.req.formData()
  } catch {
    return c.json({ error: 'invalid multipart' }, 400)
  }

  // workers-types の FormData.get は string | null だが、ランタイムでは File も返る。
  const image = form.get('image') as unknown as File | string | null
  const metaRaw = form.get('meta')
  if (image === null || typeof image === 'string' || typeof metaRaw !== 'string') {
    return c.json({ error: 'image (File) and meta (JSON string) are required' }, 400)
  }

  if (image.size > maxBytes) {
    return c.json({ error: `image too large: ${image.size} > ${maxBytes}` }, 413)
  }
  if (image.type !== 'image/png') {
    return c.json({ error: `unsupported image type: ${image.type}` }, 415)
  }

  type MetaIn = {
    topic?: unknown
    artist_profile?: unknown
    comment?: unknown
    width?: unknown
    height?: unknown
  }
  let meta: MetaIn
  try {
    meta = JSON.parse(metaRaw)
  } catch {
    return c.json({ error: 'meta is not valid JSON' }, 400)
  }

  const topic = sanitizeTopic(meta.topic)
  if (!topic) return c.json({ error: 'topic required (<= 100 chars)' }, 400)
  const profile = sanitizeProfile(meta.artist_profile)
  if (!profile) return c.json({ error: 'invalid artist_profile (each axis must be in [0,1])' }, 400)
  const width = toInt(meta.width)
  const height = toInt(meta.height)
  if (!width || !height || width > 4096 || height > 4096) {
    return c.json({ error: 'invalid width/height' }, 400)
  }
  const comment = sanitizeComment(meta.comment)

  const id = nanoid(12)
  const imageKey = `posts/${id}.png`
  const buf = await image.arrayBuffer()
  await c.env.IMAGES.put(imageKey, buf, {
    httpMetadata: { contentType: 'image/png', cacheControl: 'public, max-age=31536000, immutable' },
  })

  const now = Date.now()
  const topicNorm = normalizeText(topic)
  await c.env.DB.prepare(
    `INSERT INTO posts (id, topic, topic_norm, artist_protan, artist_deutan, artist_tritan, artist_macular, comment, image_key, width, height, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      topic,
      topicNorm,
      profile.protan,
      profile.deutan,
      profile.tritan,
      profile.macular,
      comment,
      imageKey,
      width,
      height,
      now,
    )
    .run()

  return c.json(
    buildPostMeta(c.env.PUBLIC_BASE, {
      id,
      topic,
      artist_protan: profile.protan,
      artist_deutan: profile.deutan,
      artist_tritan: profile.tritan,
      artist_macular: profile.macular,
      comment,
      image_key: imageKey,
      width,
      height,
      created_at: now,
    }),
  )
})

/** GET /api/posts?topic=&vision=&cursor= */
app.get('/api/posts', async (c) => {
  const topic = c.req.query('topic')
  const vision = c.req.query('vision')
  const cursor = c.req.query('cursor')
  const limit = 24

  const conds: string[] = []
  const binds: unknown[] = []
  if (topic) {
    conds.push('topic_norm LIKE ?')
    binds.push(`%${normalizeText(topic)}%`)
  }
  // vision フィルタ: カンマ区切りで複数指定可 (e.g. vision=protan,deutan)
  if (vision) {
    const types = vision.split(',').map((s) => s.trim()).filter(Boolean)
    const THRESHOLD = 0.05
    const visionClauses: string[] = []
    for (const t of types) {
      if (t === 'normal') {
        visionClauses.push(`(artist_protan < ${THRESHOLD} AND artist_deutan < ${THRESHOLD} AND artist_tritan < ${THRESHOLD} AND artist_macular < ${THRESHOLD})`)
      } else if (t === 'protan') {
        visionClauses.push(`(artist_protan >= ${THRESHOLD} AND artist_protan >= artist_deutan AND artist_protan >= artist_tritan AND artist_protan >= artist_macular)`)
      } else if (t === 'deutan') {
        visionClauses.push(`(artist_deutan >= ${THRESHOLD} AND artist_deutan >= artist_protan AND artist_deutan >= artist_tritan AND artist_deutan >= artist_macular)`)
      } else if (t === 'tritan') {
        visionClauses.push(`(artist_tritan >= ${THRESHOLD} AND artist_tritan >= artist_protan AND artist_tritan >= artist_deutan AND artist_tritan >= artist_macular)`)
      } else if (t === 'macular') {
        visionClauses.push(`(artist_macular >= ${THRESHOLD} AND artist_macular >= artist_protan AND artist_macular >= artist_deutan AND artist_macular >= artist_tritan)`)
      }
    }
    if (visionClauses.length) conds.push(`(${visionClauses.join(' OR ')})`)
  }
  if (cursor) {
    const n = Number(cursor)
    if (Number.isFinite(n)) {
      conds.push('created_at < ?')
      binds.push(n)
    }
  }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
  const sql = `SELECT id, topic, artist_protan, artist_deutan, artist_tritan, artist_macular, comment, image_key, width, height, created_at
               FROM posts ${where}
               ORDER BY created_at DESC
               LIMIT ${limit + 1}`

  const result = await c.env.DB.prepare(sql).bind(...binds).all<RowPost>()
  const rows = result.results ?? []
  const hasMore = rows.length > limit
  const items = (hasMore ? rows.slice(0, limit) : rows).map((r) => buildPostMeta(c.env.PUBLIC_BASE, r))
  const nextCursor = hasMore ? String(rows[limit - 1].created_at) : null
  return c.json({ posts: items, cursor: nextCursor })
})

/** GET /api/posts/:id */
app.get('/api/posts/:id', async (c) => {
  const id = c.req.param('id')
  const row = await c.env.DB.prepare(
    `SELECT id, topic, artist_protan, artist_deutan, artist_tritan, artist_macular, comment, image_key, width, height, created_at
     FROM posts WHERE id = ?`,
  )
    .bind(id)
    .first<RowPost>()
  if (!row) return c.json({ error: 'not found' }, 404)
  return c.json(buildPostMeta(c.env.PUBLIC_BASE, row))
})

/** GET /images/posts/:filename — R2 から配信 */
app.get('/images/:scope/:filename', async (c) => {
  const scope = c.req.param('scope')
  const filename = c.req.param('filename')
  if (scope !== 'posts') return c.notFound()
  const key = `${scope}/${filename}`
  const obj = await c.env.IMAGES.get(key)
  if (!obj) return c.notFound()
  const headers = new Headers()
  obj.writeHttpMetadata(headers)
  headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  return new Response(obj.body, { headers })
})

/**
 * 未マッチ経路: /api/* と /images/* は素直に JSON 404、
 * それ以外は SPA フォールバックとして index.html を ASSETS から返す。
 * /post/:id の場合は OGP meta を注入して返す。
 */
app.notFound(async (c) => {
  const url = new URL(c.req.url)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/images/')) {
    return c.json({ error: 'not found' }, 404)
  }
  const indexUrl = new URL('/index.html', url.origin)
  const res = await c.env.ASSETS.fetch(new Request(indexUrl.toString(), { method: 'GET' }))
  let html = await res.text()

  const postMatch = url.pathname.match(/^\/post\/([^/]+)$/)
  if (postMatch) {
    const row = await c.env.DB.prepare(
      `SELECT id, topic, image_key, width, height FROM posts WHERE id = ?`,
    ).bind(postMatch[1]).first<{ id: string; topic: string; image_key: string; width: number; height: number }>()
    if (row) {
      const imageUrl = `${url.origin}/images/${row.image_key}`
      const ogTags = [
        `<meta property="og:title" content="${escapeAttr(row.topic)} — irodori" />`,
        `<meta property="og:image" content="${escapeAttr(imageUrl)}" />`,
        `<meta property="og:image:type" content="image/png" />`,
        `<meta property="og:image:width" content="${row.width}" />`,
        `<meta property="og:image:height" content="${row.height}" />`,
        `<meta property="og:type" content="article" />`,
        `<meta property="og:url" content="${escapeAttr(url.href)}" />`,
        `<meta name="twitter:card" content="summary_large_image" />`,
      ].join('\n    ')
      html = html.replace('</head>', `    ${ogTags}\n  </head>`)
    }
  }

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
})

export default app

// ===== helpers =====

interface RowPost {
  id: string
  topic: string
  artist_protan: number
  artist_deutan: number
  artist_tritan: number
  artist_macular: number
  comment: string | null
  image_key: string
  width: number
  height: number
  created_at: number
}

function buildPostMeta(publicBase: string, r: RowPost) {
  const base = publicBase || ''
  return {
    id: r.id,
    topic: r.topic,
    artist_profile: {
      protan: clamp01(r.artist_protan),
      deutan: clamp01(r.artist_deutan),
      tritan: clamp01(r.artist_tritan),
      macular: clamp01(r.artist_macular),
    },
    comment: r.comment,
    image_url: `${base}/images/${r.image_key}`,
    width: r.width,
    height: r.height,
    created_at: r.created_at,
  }
}

/** プロファイルの4軸をすべて [0,1] に検証。1軸でも欠ければ null。 */
function sanitizeProfile(v: unknown): VisionProfile | null {
  if (!v || typeof v !== 'object') return null
  const obj = v as Record<string, unknown>
  const protan = toAxis(obj.protan)
  const deutan = toAxis(obj.deutan)
  const tritan = toAxis(obj.tritan)
  const macular = toAxis(obj.macular)
  if (protan === null || deutan === null || tritan === null || macular === null) return null
  return { protan, deutan, tritan, macular }
}
function toAxis(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1) return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n) && n >= 0 && n <= 1) return n
  }
  return null
}
function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0
  if (v < 0) return 0
  if (v > 1) return 1
  return v
}
function toInt(v: unknown): number {
  if (typeof v === 'number' && Number.isInteger(v) && v > 0) return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isInteger(n) && n > 0) return n
  }
  return 0
}
function sanitizeTopic(v: unknown): string {
  if (typeof v !== 'string') return ''
  return v.normalize('NFKC').trim().slice(0, 100)
}
function sanitizeComment(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.normalize('NFKC').trim().slice(0, 200)
  return t || null
}
function normalizeText(v: string): string {
  return v.normalize('NFKC').toLowerCase()
}
function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
