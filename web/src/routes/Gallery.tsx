import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PostMeta, listPosts } from '../lib/api'
import { describeProfile } from '../lib/visionTypes'

const VISION_OPTIONS = [
  { value: '', label: 'すべて' },
  { value: 'normal', label: '正常色覚' },
  { value: 'protan', label: '1型 (赤)' },
  { value: 'deutan', label: '2型 (緑)' },
  { value: 'tritan', label: '3型 (青)' },
  { value: 'macular', label: '黄斑変性' },
] as const

export default function Gallery() {
  const [topic, setTopic] = useState('')
  const [vision, setVision] = useState('')
  const [draftVision, setDraftVision] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [posts, setPosts] = useState<PostMeta[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeFilterLabel = VISION_OPTIONS.find((o) => o.value === vision)?.label ?? 'すべて'

  const fetchFirst = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await listPosts({ topic: topic || undefined, vision: vision || undefined })
      setPosts(r.posts)
      setCursor(r.cursor)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [topic, vision])

  const fetchMore = useCallback(async () => {
    if (!cursor) return
    setLoading(true)
    try {
      const r = await listPosts({ topic: topic || undefined, vision: vision || undefined, cursor })
      setPosts((prev) => [...prev, ...r.posts])
      setCursor(r.cursor)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [cursor, topic, vision])

  useEffect(() => {
    fetchFirst()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openFilter = () => {
    setDraftVision(vision)
    setFilterOpen(true)
  }

  const applyFilter = () => {
    setVision(draftVision)
    setFilterOpen(false)
  }

  // vision 変更後に自動検索
  useEffect(() => {
    fetchFirst()
  }, [vision, fetchFirst])

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
        <div className="stack-xs" style={{ flex: 1, minWidth: 180 }}>
          <span className="field-label">お題で検索</span>
          <input
            type="search"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="トマト"
            onKeyDown={(e) => e.key === 'Enter' && fetchFirst()}
          />
        </div>
        <button
          className="btn"
          onClick={openFilter}
          style={{ padding: '10px 16px', fontSize: '0.9rem', gap: 6 }}
        >
          <FilterIcon />
          {vision ? activeFilterLabel : 'フィルター'}
        </button>
        <button className="btn btn--primary btn--lg" onClick={fetchFirst} disabled={loading}>
          {loading ? '検索中…' : '検索する'}
        </button>
      </section>

      {filterOpen && (
        <>
          <div className="bottom-sheet__overlay" onClick={() => setFilterOpen(false)} aria-hidden="true" />
          <aside className="bottom-sheet" role="dialog" aria-modal="true" aria-label="フィルター">
            <div className="bottom-sheet__handle" />
            <div className="row-between" style={{ paddingBottom: 8, borderBottom: '1.5px solid var(--rule-soft)' }}>
              <strong style={{ fontSize: '1.05rem', letterSpacing: '0.08em' }}>フィルター</strong>
              <button
                className="btn btn--ghost"
                style={{ padding: '4px 10px', fontSize: '0.85rem' }}
                onClick={() => setDraftVision('')}
              >
                リセット
              </button>
            </div>
            <div className="stack-xs" style={{ padding: '4px 0' }}>
              <span className="field-label" style={{ marginBottom: 4 }}>色覚タイプ</span>
              {VISION_OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className="check-list__item"
                  style={{ padding: '12px 14px', cursor: 'pointer' }}
                >
                  <input
                    type="radio"
                    name="vision-filter"
                    checked={draftVision === o.value}
                    onChange={() => setDraftVision(o.value)}
                  />
                  <span className="check-list__mark" />
                  <span className="check-list__label">{o.label}</span>
                </label>
              ))}
            </div>
            <button
              className="btn btn--primary btn--block btn--lg"
              onClick={applyFilter}
              style={{ marginTop: 8 }}
            >
              適用
            </button>
          </aside>
        </>
      )}

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

function FilterIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="7" y1="12" x2="17" y2="12" />
      <line x1="10" y1="18" x2="14" y2="18" />
    </svg>
  )
}
