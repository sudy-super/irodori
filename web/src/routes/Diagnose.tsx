import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import D15SortBoard from '../components/D15SortBoard'
import Logo from '../components/Logo'
import ProfileSliders from '../components/ProfileSliders'
import { useVisionFilter } from '../components/VisionFilter'
import { CAP_COORDS, DiagnosisResult, Palette, diagnoseD15 } from '../lib/d15'
import { saveVision } from '../lib/storage'
import { NORMAL_PROFILE, VisionProfile, describeProfile, isNormal } from '../lib/visionTypes'

type Step = 'intro' | 'sorting' | 'result' | 'manual'

export default function Diagnose() {
  const [step, setStep] = useState<Step>('intro')
  // UI 上では選択肢を出さないが、低彩度版 (Lanthony D-15d) を既定として使う。
  // CAPS_SAT / Palette 型はコードベースに残してあるので、将来再公開する場合は
  // この値を state に戻し、Intro に切替ボタンを足すだけで復旧できる。
  const palette: Palette = 'desaturated'
  const [result, setResult] = useState<DiagnosisResult | null>(null)
  const navigate = useNavigate()

  const handleReady = useCallback((placements: (number | null)[]) => {
    const r = diagnoseD15({ placements })
    setResult(r)
    setStep('result')
    saveVision(r.profile)
  }, [])

  return (
    <div className="stack-lg">
      <header className="rise" style={{ display: 'flex', justifyContent: 'center' }}>
        <Logo size="lg" withSubtitle subtitleSize="small" />
      </header>

      {step === 'intro' && (
        <Intro
          onStart={() => setStep('sorting')}
          onManual={() => setStep('manual')}
        />
      )}

      {step === 'sorting' && (
        <section className="panel rise">
          <D15SortBoard palette={palette} onReady={handleReady} />
        </section>
      )}

      {step === 'result' && result && (
        <ResultPanel
          result={result}
          onRetry={() => {
            setResult(null)
            setStep('sorting')
          }}
          onManual={() => setStep('manual')}
          onDraw={() => navigate('/draw')}
        />
      )}

      {step === 'manual' && (
        <ManualSelect
          onDone={(profile) => {
            saveVision(profile)
            navigate('/draw')
          }}
        />
      )}
    </div>
  )
}

function Intro({
  onStart,
  onManual,
}: {
  onStart: () => void
  onManual: () => void
}) {
  return (
    <section
      className="rise stack-md"
      style={{ maxWidth: 420, margin: '0 auto', alignItems: 'stretch' }}
    >
      <button className="btn btn--primary btn--xl" onClick={onStart}>
        テストを始める
      </button>

      <button className="btn btn--ghost" onClick={onManual}>
        手動で調整する
      </button>
    </section>
  )
}

function ManualSelect({ onDone }: { onDone: (profile: VisionProfile) => void }) {
  const [profile, setProfile] = useState<VisionProfile>(NORMAL_PROFILE)

  return (
    <section className="rise stack-md" style={{ maxWidth: 560, margin: '0 auto' }}>
      <div className="card">
        <ProfileSliders profile={profile} onChange={setProfile} />
      </div>

      <div className="row-between">
        <button className="btn btn--ghost" onClick={() => history.back()}>
          戻る
        </button>
        <button className="btn btn--primary btn--lg" onClick={() => onDone(profile)}>
          保存して絵を描く
        </button>
      </div>
    </section>
  )
}

function ResultPanel({
  result,
  onRetry,
  onManual,
  onDraw,
}: {
  result: DiagnosisResult
  onRetry: () => void
  onManual: () => void
  onDraw: () => void
}) {
  const [profile, setProfile] = useState<VisionProfile>(result.profile)
  const { defs: invDefs, filterUrl: invFilterUrl } = useVisionFilter(profile, { inverse: true })

  const spectrumStyle: React.CSSProperties = {
    height: 64,
    borderRadius: 8,
    background:
      'linear-gradient(90deg, #d54545, #e08b3a, #e3c83a, #5aab5a, #3973c2, #9156a8)',
    border: '1.5px solid var(--ink)',
  }

  return (
    <section className="rise stack-lg">
      {invDefs}
      <div className="panel layout-2col layout-2col--equal" style={{ alignItems: 'start' }}>
        <div className="stack-md">
          <h1 style={{ fontSize: '1.8rem', lineHeight: 1.3 }}>
            あなたの見え方
          </h1>
          <p style={{ fontSize: '1.05rem', borderLeft: '3px solid var(--ink)', paddingLeft: 14 }}>
            {isNormal(profile) ? '正常色覚 (各軸ほぼ 0%)' : describeProfile(profile)}
          </p>

          <ReceptorBars result={result} />

          <div className="divider" />
          <span className="field-label">プロファイルを微調整</span>
          <ProfileSliders profile={profile} onChange={setProfile} />
        </div>

        <div className="stack-sm">
          <ResultDiagram result={result} />
          <div className="card--hair card stack-sm" style={{ padding: 14 }}>
            <span className="field-label">プレビュー</span>
            <div className="stack-xs">
              <span className="muted" style={{ fontSize: '0.82rem' }}>ありのまま</span>
              <div style={spectrumStyle} aria-label="補正なしの可視光スペクトル" />
            </div>
            <div className="stack-xs">
              <span className="muted" style={{ fontSize: '0.82rem' }}>
                あなたの色覚に合わせて補正
              </span>
              <div
                style={{ ...spectrumStyle, filter: invFilterUrl }}
                aria-label="逆行列でプリ補正したスペクトル"
              />
            </div>
            <span className="faint" style={{ fontSize: '0.74rem', lineHeight: 1.5 }}>
              重度の場合、完全な補正にはなりません。
            </span>
          </div>
        </div>
      </div>

      <div className="row-between">
        <button className="btn" onClick={onRetry}>
          もう一度
        </button>
        <button className="btn btn--ghost" onClick={onManual}>
          手動で調整
        </button>
        <button
          className="btn btn--primary btn--lg"
          onClick={() => {
            saveVision(profile)
            onDraw()
          }}
        >
          このプロファイルで描く
        </button>
      </div>
    </section>
  )
}

function ReceptorBars({ result }: { result: DiagnosisResult }) {
  const items = [
    { label: '赤の軸', ratio: result.ratio.prot },
    { label: '緑の軸', ratio: result.ratio.deut },
    { label: '青の軸', ratio: result.ratio.trit },
  ]
  return (
    <div className="stack-sm">
      {items.map((it) => (
        <div key={it.label}>
          <div className="row-between">
            <span style={{ fontSize: '0.9rem' }}>{it.label}</span>
            <span style={{ fontSize: '0.9rem' }}>{Math.round(it.ratio * 100)}%</span>
          </div>
          <div style={{ height: 6, background: '#eceae3', border: '1px solid var(--rule-soft)', borderRadius: 3, overflow: 'hidden', marginTop: 4 }}>
            <div
              style={{
                width: `${Math.round(it.ratio * 100)}%`,
                height: '100%',
                background: 'var(--ink)',
                transition: 'width 260ms ease',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function ResultDiagram({ result }: { result: DiagnosisResult }) {
  const w = 400
  const h = 420
  const linePath = result.sortedOrder
    .map((capNo, i) => {
      const [x, y] = CAP_COORDS[capNo]
      return `${i === 0 ? 'M' : 'L'}${x},${y}`
    })
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      style={{
        width: '100%',
        height: 'auto',
        background: '#fdfcf7',
        borderRadius: 12,
        border: '1.5px solid var(--ink)',
      }}
      aria-label="色覚診断結果のカラーホイール図"
    >
      <line x1={140} y1={60} x2={210} y2={400} stroke="#1a1a1a" strokeWidth={1} strokeDasharray="3 5" opacity={0.5} />
      <line x1={195} y1={60} x2={155} y2={375} stroke="#1a1a1a" strokeWidth={1} strokeDasharray="3 5" opacity={0.5} />
      <line x1={94} y1={285} x2={380} y2={180} stroke="#1a1a1a" strokeWidth={1} strokeDasharray="3 5" opacity={0.5} />

      {linePath && (
        <path d={linePath} fill="none" stroke="#111111" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      )}

      {CAP_COORDS.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={6} fill="#fff" stroke="#111111" strokeWidth={1.8} />
        </g>
      ))}
    </svg>
  )
}
