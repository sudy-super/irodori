import { AXES, AXIS_LABEL, VisionProfile, clamp01 } from '../lib/visionTypes'

interface Props {
  profile: VisionProfile
  onChange: (next: VisionProfile) => void
}

/**
 * 4 軸独立のスライダ UI。
 * 個々の生理学的軸を独立に調整できる。
 */
export default function ProfileSliders({ profile, onChange }: Props) {
  return (
    <div className="stack-md">
      {AXES.map((axis) => {
        const value = profile[axis]
        const pct = Math.round(value * 100)
        return (
          <div key={axis} className="stack-xs">
            <div className="row-between">
              <span className="field-label" style={{ margin: 0 }}>{AXIS_LABEL[axis]}</span>
              <span style={{ fontSize: '0.9rem', minWidth: 48, textAlign: 'right' }}>{pct}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={pct}
              onChange={(e) =>
                onChange({ ...profile, [axis]: clamp01(Number(e.target.value) / 100) })
              }
              aria-label={AXIS_LABEL[axis]}
            />
          </div>
        )
      })}
    </div>
  )
}
