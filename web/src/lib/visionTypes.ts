/**
 * 色覚プロファイル — 4 軸独立の連続値で個々人の見え方を表現する。
 *
 * L (赤) / M (緑) / S (青) 錐体の感度低下はそれぞれ独立に起こり、
 * 多くの実在ケースは複数軸の混合 (例: 軽度 protan + 中等度 deutan) として現れる。
 * 黄斑変性 (黄変) は錐体軸とは別系統の劣化で、視野中央の青-黒識別が落ちる。
 *
 * 値はすべて 0..1 の連続値:
 *  - 0 : 影響なし
 *  - 1 : その軸が完全消失 (二色覚 / 黄変重度) 相当
 */
export interface VisionProfile {
  /** L 錐体 — 赤の感受性低下 (1型) */
  protan: number
  /** M 錐体 — 緑の感受性低下 (2型) */
  deutan: number
  /** S 錐体 — 青の感受性低下 (3型) */
  tritan: number
  /** 黄斑変性 — 中心視野の青-黒劣化 */
  macular: number
}

export const AXES = ['protan', 'deutan', 'tritan', 'macular'] as const
export type Axis = (typeof AXES)[number]

export const AXIS_LABEL: Record<Axis, string> = {
  protan: '赤の感受性低下 (1型)',
  deutan: '緑の感受性低下 (2型)',
  tritan: '青の感受性低下 (3型)',
  macular: '黄斑変性 (青-黒)',
}

export const AXIS_LABEL_SHORT: Record<Axis, string> = {
  protan: '1型',
  deutan: '2型',
  tritan: '3型',
  macular: '黄変',
}

export const NORMAL_PROFILE: VisionProfile = Object.freeze({
  protan: 0,
  deutan: 0,
  tritan: 0,
  macular: 0,
})

export function isNormal(p: VisionProfile, threshold = 0.05): boolean {
  return (
    p.protan < threshold &&
    p.deutan < threshold &&
    p.tritan < threshold &&
    p.macular < threshold
  )
}

/** 4 軸のうち最も強い軸 (なければ null) */
export function dominantAxis(p: VisionProfile): Axis | null {
  if (isNormal(p)) return null
  let best: Axis = 'protan'
  let bestVal = -Infinity
  for (const a of AXES) {
    if (p[a] > bestVal) {
      bestVal = p[a]
      best = a
    }
  }
  return best
}

/** プロファイルを「主たる軸 (パーセント)」を強調したラベルに整形 */
export function describeProfile(p: VisionProfile): string {
  if (isNormal(p)) return '正常色覚'
  const parts: string[] = []
  for (const a of AXES) {
    if (p[a] >= 0.05) parts.push(`${AXIS_LABEL_SHORT[a]} ${Math.round(p[a] * 100)}%`)
  }
  return parts.length ? parts.join(' + ') : '正常色覚'
}

export function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0
  if (v < 0) return 0
  if (v > 1) return 1
  return v
}
