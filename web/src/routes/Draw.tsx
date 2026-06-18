import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ColorWheel from '../components/ColorWheel'
import DrawingCanvas, { DrawingCanvasHandle } from '../components/DrawingCanvas'
import ProfileSliders from '../components/ProfileSliders'
import { createPost } from '../lib/api'
import { randomTopic } from '../lib/palette'
import { loadVision } from '../lib/storage'
import { useMediaQuery } from '../lib/useMediaQuery'
import { NORMAL_PROFILE, VisionProfile, describeProfile } from '../lib/visionTypes'

export default function Draw() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const canvasRef = useRef<DrawingCanvasHandle | null>(null)

  const initialTopic = params.get('topic') ?? randomTopic()
  const [topic, setTopic] = useState(initialTopic)
  const [color, setColor] = useState<string>('#d54545')
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen')
  const [size, setSize] = useState(8)
  const [modalOpen, setModalOpen] = useState(false)
  const [sheet, setSheet] = useState<'color' | 'size' | null>(null)
  const isMobile = useMediaQuery('(max-width: 760px)')

  useEffect(() => {
    setTopic(params.get('topic') ?? initialTopic)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const handleReset = () => {
    if (!confirm('描いた絵をすべて消去します。よろしいですか？')) return
    canvasRef.current?.clear()
  }

  const handleUndo = () => {
    canvasRef.current?.undo()
  }

  const handleSubmit = useCallback(
    async (payload: { profile: VisionProfile; comment: string }) => {
      const handle = canvasRef.current
      if (!handle) return
      const blob = await handle.toBlob()
      if (!blob) return
      const { width, height } = handle.size()
      const post = await createPost({
        image: blob,
        topic,
        artist_profile: payload.profile,
        comment: payload.comment || undefined,
        width,
        height,
      })
      navigate(`/post/${post.id}`)
    },
    [navigate, topic],
  )

  if (isMobile) {
    return (
      <div className="draw-mobile">
        <div className="draw-mobile__topic">
          <span className="field-label" style={{ margin: 0, fontSize: '0.8rem' }}>お題</span>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
          <button className="btn btn--ghost" onClick={() => setTopic(randomTopic())}>
            変える
          </button>
        </div>

        <section className="draw-mobile__stage">
          <div className="draw-mobile__canvas-wrap">
            <DrawingCanvas ref={canvasRef} color={color} tool={tool} size={size} />
          </div>
        </section>

        <section className="draw-mobile__tools" role="toolbar" aria-label="描画ツール">
          <button
            className="icon-btn"
            data-active={tool === 'pen'}
            onClick={() => setTool('pen')}
            aria-label="えんぴつ"
            title="えんぴつ"
          >
            <PencilIcon />
          </button>
          <button
            className="icon-btn"
            data-active={tool === 'eraser'}
            onClick={() => setTool('eraser')}
            aria-label="けしごむ"
            title="けしごむ"
          >
            <EraserIcon />
          </button>
          <button
            className="draw-mobile__size-puck"
            onClick={() => setSheet('size')}
            aria-label="太さを変える"
            title={`太さ ${size}px`}
          >
            <span className="draw-mobile__size-puck-num">{size}</span>
          </button>
          <button
            className="draw-mobile__color-btn"
            onClick={() => setSheet('color')}
            aria-label="色を選ぶ"
            title="色を選ぶ"
            style={{ background: color }}
          />
          <button className="icon-btn" onClick={handleReset} aria-label="リセット" title="リセット">
            <TrashIcon />
          </button>
          <button className="icon-btn" onClick={handleUndo} aria-label="1ステップ戻す" title="1ステップ戻す">
            <UndoIcon />
          </button>
          <button
            className="draw-mobile__finish"
            onClick={() => setModalOpen(true)}
            aria-label="完成"
          >
            完成！
          </button>
        </section>

        {sheet && (
          <>
            <div
              className="bottom-sheet__overlay"
              onClick={() => setSheet(null)}
              aria-hidden="true"
            />
            <aside
              className="bottom-sheet"
              role="dialog"
              aria-modal="true"
              aria-label={sheet === 'color' ? 'カラー' : '太さ'}
            >
              <div className="bottom-sheet__handle" />

              {sheet === 'color' && (
                <>
                  <div className="bottom-sheet__center">
                    <ColorWheel value={color} onChange={setColor} size={240} />
                  </div>
                  <div className="bottom-sheet__row">
                    <span className="bottom-sheet__swatch" style={{ background: color }} />
                    <code className="bottom-sheet__hex">{color.toUpperCase()}</code>
                  </div>
                </>
              )}

              {sheet === 'size' && (
                <>
                  <div className="bottom-sheet__size-preview">
                    <span
                      className="bottom-sheet__size-preview-dot"
                      style={{ width: size, height: size, background: color }}
                    />
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={48}
                    value={size}
                    onChange={(e) => setSize(Number(e.target.value))}
                    aria-label="太さ"
                  />
                  <div className="row-between">
                    <span className="muted" style={{ fontSize: '0.85rem' }}>細い</span>
                    <span style={{ fontWeight: 700 }}>{size}px</span>
                    <span className="muted" style={{ fontSize: '0.85rem' }}>太い</span>
                  </div>
                </>
              )}
            </aside>
          </>
        )}

        {modalOpen && (
          <PostModal
            topic={topic}
            onClose={() => setModalOpen(false)}
            onSubmit={async (p) => {
              try {
                await handleSubmit(p)
              } catch (e) {
                alert(`投稿に失敗しました: ${String(e)}`)
              }
            }}
          />
        )}
      </div>
    )
  }

  return (
    <div className="draw-page">
      <header className="rise draw-page__topic">
        <span className="field-label" style={{ margin: 0 }}>お題</span>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          style={{ minWidth: 180, fontWeight: 700 }}
        />
        <button className="btn btn--ghost" onClick={() => setTopic(randomTopic())}>
          お題を変える
        </button>
      </header>

      <section className="rise draw-page__main">
        <aside className="card stack-md">
          <div className="stack-sm" style={{ alignItems: 'center' }}>
            <span className="field-label" style={{ alignSelf: 'flex-start' }}>色</span>
            <ColorWheel value={color} onChange={setColor} size={220} />
            <div
              className="row-center"
              style={{ gap: 8, alignSelf: 'flex-start', marginTop: 4 }}
            >
              <span
                aria-label="現在の色"
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  background: color,
                  border: '1.5px solid var(--ink)',
                }}
              />
              <code style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                {color.toUpperCase()}
              </code>
            </div>
          </div>

          <div className="divider" />

          <div className="stack-sm">
            <span className="field-label">ツール</span>
            <div className="row" style={{ gap: 8 }}>
              <button
                className={`btn ${tool === 'pen' ? 'btn--primary' : ''}`}
                onClick={() => setTool('pen')}
                aria-label="えんぴつ"
                title="えんぴつ"
                style={{ flex: 1, padding: 12 }}
              >
                <PencilIcon />
              </button>
              <button
                className={`btn ${tool === 'eraser' ? 'btn--primary' : ''}`}
                onClick={() => setTool('eraser')}
                aria-label="けしごむ"
                title="けしごむ"
                style={{ flex: 1, padding: 12 }}
              >
                <EraserIcon />
              </button>
            </div>
          </div>

          <div className="stack-sm">
            <span className="field-label">太さ ({size}px)</span>
            <input
              type="range"
              min={2}
              max={32}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
            />
          </div>
        </aside>

        <div className="draw-page__canvas">
          <DrawingCanvas ref={canvasRef} color={color} tool={tool} size={size} />
        </div>
      </section>

      <section className="rise draw-page__actions">
        <div className="row" style={{ gap: 10 }}>
          <button
            className="btn"
            onClick={handleReset}
            aria-label="リセット"
            title="リセット"
            style={{ padding: 10, width: 48, height: 48 }}
          >
            <TrashIcon />
          </button>
          <button
            className="btn"
            onClick={handleUndo}
            aria-label="1ステップ戻す"
            title="1ステップ戻す"
            style={{ padding: 10, width: 48, height: 48 }}
          >
            <UndoIcon />
          </button>
        </div>
        <button
          className="btn btn--primary btn--lg"
          onClick={() => setModalOpen(true)}
          style={{ padding: '18px 36px', minWidth: 260 }}
        >
          <span className="btn-stack">
            <span className="btn-stack__main">完成！</span>
            <span className="btn-stack__sub">絵を交換する</span>
          </span>
        </button>
      </section>

      {modalOpen && (
        <PostModal
          topic={topic}
          onClose={() => setModalOpen(false)}
          onSubmit={async (p) => {
            try {
              await handleSubmit(p)
            } catch (e) {
              alert(`投稿に失敗しました: ${String(e)}`)
            }
          }}
        />
      )}
    </div>
  )
}

function PostModal({
  topic,
  onClose,
  onSubmit,
}: {
  topic: string
  onClose: () => void
  onSubmit: (p: { profile: VisionProfile; comment: string }) => Promise<void>
}) {
  const saved = useMemo(() => loadVision(), [])
  const [profile, setProfile] = useState<VisionProfile>(saved?.profile ?? NORMAL_PROFILE)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await onSubmit({ profile, comment })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(17,17,17,0.55)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 16,
      }}
    >
      <div
        className="panel stack-md"
        style={{ maxWidth: 520, width: '100%', background: 'var(--canvas)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: 0 }}>投稿する</h2>
        <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>お題: {topic}</p>
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          現在のプロファイル: {describeProfile(profile)}
        </p>

        <div className="card">
          <ProfileSliders profile={profile} onChange={setProfile} />
        </div>

        <div className="stack-sm">
          <span className="field-label">ひとこと (任意)</span>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={200}
          />
        </div>

        <div className="row-between">
          <button className="btn btn--ghost" onClick={onClose} disabled={submitting}>
            キャンセル
          </button>
          <button className="btn btn--primary btn--lg" onClick={handleSubmit} disabled={submitting}>
            {submitting ? '投稿中…' : '投稿する'}
          </button>
        </div>
      </div>
    </div>
  )
}

function UndoIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h11a5 5 0 0 1 5 5v0a5 5 0 0 1-5 5h-4" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      <path d="M14.5 5.5l3 3" />
    </svg>
  )
}

function EraserIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 16l6 6h10" />
      <path d="M9 22l11-11-7-7L3 14l6 6 4-4" />
    </svg>
  )
}
