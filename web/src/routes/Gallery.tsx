import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PostMeta, listPosts } from '../lib/api'
import { describeProfile } from '../lib/visionTypes'

export default function Gallery() {
  const [topic, setTopic] = useState('')
  const [posts, setPosts] = useState<PostMeta[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchFirst = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await listPosts({ topic: topic || undefined })
      setPosts(r.posts)
      setCursor(r.cursor)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [topic])

  const fetchMore = useCallback(async () => {
    if (!cursor) return
    setLoading(true)
    try {
      const r = await listPosts({ topic: topic || undefined, cursor })
      setPosts((prev) => [...prev, ...r.posts])
      setCursor(r.cursor)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [cursor, topic])

  useEffect(() => {
    fetchFirst()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="stack-lg">
      <section
        className="rise card"
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'flex-end',
          flexWrap: 'wrap',
        }}
      >
        <div className="stack-xs" style={{ flex: 1, minWidth: 220 }}>
          <span className="field-label">お題で検索</span>
          <input
            type="search"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="トマト"
            onKeyDown={(e) => e.key === 'Enter' && fetchFirst()}
          />
        </div>
        <button className="btn btn--primary btn--lg" onClick={fetchFirst} disabled={loading}>
          {loading ? '検索中…' : '検索する'}
        </button>
      </section>

      {error && (
        <div className="card" style={{ borderColor: 'var(--ink)' }}>
          <strong>取得に失敗しました</strong>
          <div className="muted">{error}</div>
        </div>
      )}

      {posts.length === 0 && !loading && (
        <div className="card center muted" style={{ borderStyle: 'dashed', boxShadow: 'none' }}>
          まだ絵がありません。最初の一枚を描いてみましょう。
        </div>
      )}

      <section
        style={{
          display: 'grid',
          gap: 18,
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        }}
      >
        {posts.map((p, i) => (
          <Link
            key={p.id}
            to={`/post/${p.id}`}
            className="card rise"
            style={{
              textDecoration: 'none',
              color: 'var(--ink)',
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              animationDelay: `${Math.min(i, 6) * 60}ms`,
            }}
          >
            <div
              style={{
                aspectRatio: '4 / 3',
                background: '#fafaf7',
                borderRadius: 10,
                border: '1.5px solid var(--ink)',
                overflow: 'hidden',
              }}
            >
              <img
                src={p.image_url}
                alt={`${p.topic} の絵`}
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
              />
            </div>
            <div className="stack-xs">
              <strong style={{ fontSize: '1rem' }}>{p.topic}</strong>
              <span className="muted" style={{ fontSize: '0.8rem' }}>
                {describeProfile(p.artist_profile)}
              </span>
            </div>
          </Link>
        ))}
      </section>

      {cursor && (
        <div className="center">
          <button className="btn" onClick={fetchMore} disabled={loading}>
            もっと見る
          </button>
        </div>
      )}
    </div>
  )
}
