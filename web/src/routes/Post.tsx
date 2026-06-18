import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useVisionFilter } from '../components/VisionFilter'
import { PostMeta, getPost } from '../lib/api'
import { NORMAL_PROFILE, describeProfile, isNormal } from '../lib/visionTypes'

// 「そのまま」は canonical な RGB を normal vision 視点でそのまま表示する。
// 「投稿者の見え方」は投稿者プロファイルの forward フィルタを適用し、
// 投稿者がその絵を見たときに感じる色合いをシミュレートする。
type Mode = 'raw' | 'artist'

export default function Post() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [post, setPost] = useState<PostMeta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('raw')

  useEffect(() => {
    if (!id) return
    setError(null)
    getPost(id)
      .then(setPost)
      .catch((e) => setError(String(e)))
  }, [id])

  const artistProfile = post?.artist_profile ?? NORMAL_PROFILE
  const { defs, filterUrl } = useVisionFilter(artistProfile)

  if (error) {
    return (
      <div className="card stack-sm">
        <strong>取得に失敗しました</strong>
        <div className="muted">{error}</div>
        <Link to="/gallery" className="btn">ギャラリーへ戻る</Link>
      </div>
    )
  }
  if (!post) return <div className="muted">読み込み中…</div>

  const artistIsNormal = isNormal(artistProfile)
  const activeFilter = mode === 'artist' && !artistIsNormal ? filterUrl : undefined

  return (
    <div className="stack-lg">
      {defs}
      <section className="rise stack-sm" style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.6rem' }}>お題 — {post.topic}</h1>
        <p className="muted" style={{ fontSize: '0.9rem', margin: 0 }}>
          投稿者: {describeProfile(post.artist_profile)}
        </p>
        {post.comment && (
          <p
            style={{
              borderLeft: '3px solid var(--ink)',
              paddingLeft: 14,
              fontStyle: 'italic',
              maxWidth: 520,
              margin: '8px auto',
              textAlign: 'left',
            }}
          >
            「{post.comment}」
          </p>
        )}
      </section>

      <section
        className="rise"
        style={{ display: 'flex', justifyContent: 'center' }}
      >
        <div
          style={{
            background: '#fff',
            border: '2px solid var(--ink)',
            borderRadius: 12,
            padding: 8,
            maxWidth: 720,
            width: '100%',
            boxShadow: 'var(--shadow-print)',
          }}
        >
          <img
            src={post.image_url}
            alt={`${post.topic} の絵`}
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
              borderRadius: 6,
              filter: activeFilter,
              transition: 'filter 240ms ease',
            }}
          />
        </div>
      </section>

      {!artistIsNormal && (
        <section className="rise" style={{ display: 'flex', justifyContent: 'center' }}>
          <div className="row" style={{ gap: 8 }}>
            <button
              className={`btn ${mode === 'raw' ? 'btn--primary' : ''}`}
              onClick={() => setMode('raw')}
              style={{ minWidth: 160 }}
            >
              そのまま
            </button>
            <button
              className={`btn ${mode === 'artist' ? 'btn--primary' : ''}`}
              onClick={() => setMode('artist')}
              style={{ minWidth: 160 }}
            >
              投稿者の見え方
            </button>
          </div>
        </section>
      )}

      <section className="rise row-between">
        <Link to="/gallery" className="btn btn--ghost">ギャラリーへ戻る</Link>
        <button
          className="btn btn--primary btn--lg"
          onClick={() => navigate(`/draw?topic=${encodeURIComponent(post.topic)}`)}
        >
          同じお題で自分も描く
        </button>
      </section>
    </div>
  )
}
