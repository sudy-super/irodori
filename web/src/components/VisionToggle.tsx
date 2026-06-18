import ProfileSliders from './ProfileSliders'
import { NORMAL_PROFILE, VisionProfile, describeProfile, isNormal } from '../lib/visionTypes'

interface Props {
  profile: VisionProfile
  onChange: (next: VisionProfile) => void
  artistProfile: VisionProfile
  viewerProfile?: VisionProfile
}

const profilesEqual = (a: VisionProfile, b: VisionProfile, tol = 0.01) =>
  Math.abs(a.protan - b.protan) < tol &&
  Math.abs(a.deutan - b.deutan) < tol &&
  Math.abs(a.tritan - b.tritan) < tol &&
  Math.abs(a.macular - b.macular) < tol

/**
 * 鑑賞モードの切替 UI。
 * - クイックボタン: そのまま / 投稿者の主観 / あなたの主観
 * - 詳細: 4 軸スライダで任意のプロファイルを直接調整
 */
export default function VisionToggle({
  profile,
  onChange,
  artistProfile,
  viewerProfile,
}: Props) {
  const isRaw = isNormal(profile)
  const isArtist = profilesEqual(profile, artistProfile)
  const isViewer = viewerProfile ? profilesEqual(profile, viewerProfile) : false

  return (
    <div className="stack-md">
      <div className="stack-sm">
        <span className="field-label">かんたん切替</span>
        <div className="row" style={{ gap: 8 }}>
          <button
            className={`btn ${isRaw ? 'btn--primary' : ''}`}
            onClick={() => onChange(NORMAL_PROFILE)}
            style={{ flex: 1, minWidth: 110 }}
          >
            そのまま
          </button>
          <button
            className={`btn ${isArtist ? 'btn--primary' : ''}`}
            onClick={() => onChange(artistProfile)}
            title={describeProfile(artistProfile)}
            style={{ flex: 1, minWidth: 110 }}
          >
            投稿者の主観
          </button>
          {viewerProfile && !isNormal(viewerProfile) && (
            <button
              className={`btn ${isViewer ? 'btn--primary' : ''}`}
              onClick={() => onChange(viewerProfile)}
              title={describeProfile(viewerProfile)}
              style={{ flex: 1, minWidth: 110 }}
            >
              あなたの主観
            </button>
          )}
        </div>
      </div>

      <div className="card stack-md">
        <span className="field-label">4 軸スライダで微調整</span>
        <ProfileSliders profile={profile} onChange={onChange} />
      </div>
    </div>
  )
}
