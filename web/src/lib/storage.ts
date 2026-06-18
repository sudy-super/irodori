import { useEffect, useState } from 'react'
import { VisionProfile, clamp01, NORMAL_PROFILE } from './visionTypes'

const KEY_VISION = 'irodori.vision.v3'
/** 同一タブ内の保存/削除を伝搬するためのカスタムイベント */
const EVENT_VISION_CHANGED = 'irodori:vision-changed'

export interface SavedVision {
  profile: VisionProfile
  savedAt: number
}

export function loadVision(): SavedVision | null {
  try {
    const raw = localStorage.getItem(KEY_VISION)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { profile?: Partial<VisionProfile>; savedAt?: number }
    if (!parsed.profile) return null
    return {
      profile: normalizeProfile(parsed.profile),
      savedAt: parsed.savedAt ?? Date.now(),
    }
  } catch {
    return null
  }
}

export function saveVision(profile: VisionProfile): void {
  const data: SavedVision = { profile: normalizeProfile(profile), savedAt: Date.now() }
  try {
    localStorage.setItem(KEY_VISION, JSON.stringify(data))
    window.dispatchEvent(new Event(EVENT_VISION_CHANGED))
  } catch {
    // ignore
  }
}

export function clearVision(): void {
  try {
    localStorage.removeItem(KEY_VISION)
    window.dispatchEvent(new Event(EVENT_VISION_CHANGED))
  } catch {
    // ignore
  }
}

/**
 * 保存されたプロファイルを購読する React フック。
 * 同一タブの save/clear (custom event) と他タブ (storage event) の両方に追従する。
 */
export function useSavedVision(): SavedVision | null {
  const [vision, setVision] = useState<SavedVision | null>(() => loadVision())
  useEffect(() => {
    const update = () => setVision(loadVision())
    window.addEventListener(EVENT_VISION_CHANGED, update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener(EVENT_VISION_CHANGED, update)
      window.removeEventListener('storage', update)
    }
  }, [])
  return vision
}

function normalizeProfile(p: Partial<VisionProfile>): VisionProfile {
  return {
    protan: clamp01(p.protan ?? NORMAL_PROFILE.protan),
    deutan: clamp01(p.deutan ?? NORMAL_PROFILE.deutan),
    tritan: clamp01(p.tritan ?? NORMAL_PROFILE.tritan),
    macular: clamp01(p.macular ?? NORMAL_PROFILE.macular),
  }
}
