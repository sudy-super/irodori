import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { PostMeta, listPosts } from '../lib/api'
import { useMediaQuery } from '../lib/useMediaQuery'
import { describeProfile } from '../lib/visionTypes'

const VISION_TYPES = [
  { value: 'normal', label: '正常色覚' },
  { value: 'protan', label: '1型 (赤)' },
  { value: 'deutan', label: '2型 (緑)' },
  { value: 'tritan', label: '3型 (青)' },
  { value: 'macular', label: '黄斑変性' },
] as const

export default function Gallery() {
  const [topic, setTopic] = useState('')
  const [visionSet, setVisionSet] = useState<Set<string>>(new Set())
  const [draftSet, setDraftSet] = useState<Set<string>>(new Set())
  const [filterOpen, setFilterOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const isWide = useMediaQuery('(min-width: 761px)')
  const [posts, setPosts] = useState<PostMeta[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const closingTimer = useRef<ReturnType<typeof setTimeout>>()

  const visionParam = visionSet.size ? [...visionSet].join(',') : undefined

  const fetchFirst = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await listPosts({ topic: topic || undefined, vision: visionParam })
      setPosts(r.posts)
      setCursor(r.cursor)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [topic, visionParam])

  const fetchMore = useCallback(async () => {
    if (!cursor) return
    setLoading(true)
    try {
      const r = await listPosts({ topic: topic || undefined, vision: visionParam, cursor })
      setPosts((prev) => [...prev, ...r.posts])
      setCursor(r.cursor)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [cursor, topic, visionParam])

  useEffect(() => { fetchFirst() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const openFilter = () => {
    setDraftSet(new Set(visionSet))
    setClosing(false)
    setFilterOpen(true)
  }

  const closeFilter = () => {
    setClosing(true)
    clearTimeout(closingTimer.current)
    closingTimer.current = setTimeout(() => {
      setFilterOpen(false)
      setClosing(false)
    }, 200)
  }

  const applyFilter = () => {
    setVisionSet(new Set(draftSet))
    closeFilter()
  }

  const toggleDraft = (v: string) => {
    setDraftSet((prev) => {
      const next = new Set(prev)
      if (next.has(v)) next.delete(v)
      else next.add(v)
      return next
    })
  }

  useEffect(() => { fetchFirst() }, [visionParam, fetchFirst])

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
          aria-label="フィルター"
          title="フィルター"
          style={{ padding: 10, width: 48, height: 48 }}
        >
          <FilterIcon />
        </button>
        <button className="btn btn--primary btn--lg" onClick={fetchFirst} disabled={loading}>
          {loading ? '検索中…' : '検索する'}
        </button>
      </section>

      {filterOpen && createPortal(
        <>
          <div
            className={`bottom-sheet__overlay${closing ? ' bottom-sheet__overlay--closing' : ''}`}
            onClick={closeFilter}
            aria-hidden="true"
          />
          <aside
            className={`bottom-sheet${isWide ? ' bottom-sheet--dialog' : ''}${closing ? ' bottom-sheet--closing' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label="フィルター"
          >
            <div className="bottom-sheet__handle" />
            <div className="row-between" style={{ paddingBottom: 8, borderBottom: '1.5px solid var(--rule-soft)' }}>
              <strong style={{ fontSize: '1.05rem', letterSpacing: '0.08em' }}>フィルター</strong>
              <button
                className="btn btn--ghost"
                style={{ padding: '4px 10px', fontSize: '0.85rem' }}
                onClick={() => setDraftSet(new Set())}
              >
                リセット
              </button>
            </div>
            <div className="stack-xs" style={{ padding: '4px 0' }}>
              <span className="field-label" style={{ marginBottom: 4 }}>色覚タイプ</span>
              {VISION_TYPES.map((o) => (
                <label
                  key={o.value}
                  className="check-list__item"
                  style={{ padding: '12px 14px', cursor: 'pointer' }}
                >
                  <input
                    type="checkbox"
                    checked={draftSet.has(o.value)}
                    onChange={() => toggleDraft(o.value)}
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
        </>,
        document.body,
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
