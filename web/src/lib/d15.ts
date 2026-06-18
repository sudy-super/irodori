/**
 * Farnsworth D-15 Color Vision Test
 * 参考実装: ref/D15.html (Colorlite) のロジックを移植。
 * 結果は 4 軸の連続プロファイル (VisionProfile) として返す。
 * D-15 は錐体軸 (protan/deutan/tritan) しか検出できないため、
 * macular は 0 のまま (手動入力でのみ設定される)。
 */

import { VisionProfile, clamp01 } from './visionTypes'

export const REF_CAP_SAT = 'rgb(55, 129, 193)'
export const REF_CAP_DESAT = 'rgb(161, 203, 243)'

export const CAPS_SAT: string[] = [
  'rgb(53, 131, 180)',
  'rgb(59, 132, 167)',
  'rgb(57, 133, 156)',
  'rgb(59, 134, 144)',
  'rgb(63, 135, 130)',
  'rgb(88, 132, 115)',
  'rgb(108, 129, 100)',
  'rgb(131, 123, 93)',
  'rgb(144, 118, 96)',
  'rgb(158, 110, 111)',
  'rgb(159, 109, 124)',
  'rgb(156, 109, 137)',
  'rgb(146, 112, 153)',
  'rgb(143, 111, 164)',
  'rgb(128, 115, 178)',
]

export const CAPS_DESAT: string[] = [
  'rgb(161, 205, 229)',
  'rgb(162, 206, 219)',
  'rgb(162, 207, 210)',
  'rgb(164, 207, 200)',
  'rgb(165, 208, 191)',
  'rgb(177, 206, 176)',
  'rgb(195, 203, 164)',
  'rgb(216, 197, 157)',
  'rgb(227, 192, 162)',
  'rgb(235, 187, 175)',
  'rgb(239, 186, 187)',
  'rgb(236, 186, 195)',
  'rgb(231, 186, 206)',
  'rgb(229, 186, 216)',
  'rgb(214, 190, 224)',
]

export const CAP_COORDS: ReadonlyArray<readonly [number, number]> = [
  [70, 190],
  [95, 142],
  [130, 106],
  [178, 81],
  [213, 75],
  [262, 81],
  [322, 105],
  [360, 153],
  [372, 238],
  [359, 310],
  [323, 346],
  [274, 370],
  [238, 370],
  [179, 357],
  [142, 337],
  [94, 285],
] as const

export type Palette = 'saturated' | 'desaturated'

export interface DiagnosisInput {
  placements: (number | null)[]
}

export interface DiagnosisResult {
  errorCount: number
  emptyCount: number
  totalLength: number
  protLength: number
  deutLength: number
  tritLength: number
  sortedOrder: number[]
  errorSegments: Array<{ from: number; to: number; angle: number; length: number }>
  /** 各軸の連続プロファイル (0..1)。D-15 では macular = 0 */
  profile: VisionProfile
  /** 軸別エラー比率 (0..1) — 表示用 */
  ratio: { prot: number; deut: number; trit: number }
}

/**
 * 軸別のエラー線長 + 空きスロットペナルティを 0..1 に正規化。
 * - axisLength 700  → 約 0.50
 * - axisLength 1100 → 約 0.77
 * - axisLength 1500 以上 → 1.0
 */
function axisAmount(axisLength: number, emptyCount: number): number {
  const penalty = emptyCount * 100
  return clamp01((axisLength + penalty) / 1500)
}

export function diagnoseD15(input: DiagnosisInput): DiagnosisResult {
  const placements = input.placements
  const sortedOrder: number[] = [0]
  let emptyCount = 0
  for (const p of placements) {
    if (p === null) emptyCount++
    else sortedOrder.push(p)
  }

  const errorPairs: Array<[number, number]> = []
  for (let i = 1; i < sortedOrder.length; i++) {
    if (Math.abs(sortedOrder[i] - sortedOrder[i - 1]) >= 2) {
      errorPairs.push([sortedOrder[i - 1], sortedOrder[i]])
    }
  }

  const errorSegments: DiagnosisResult['errorSegments'] = []
  let protLength = 0
  let deutLength = 0
  let tritLength = 0
  let totalLength = 0

  for (const [from, to] of errorPairs) {
    const [x1, y1] = CAP_COORDS[from]
    const [x2, y2] = CAP_COORDS[to]
    const dx = x2 - x1
    const dy = y2 - y1
    const len = Math.sqrt(dx * dx + dy * dy)
    let angle = Math.atan(dy / (dx === 0 ? 1e-9 : dx))
    if (angle < 0) angle = Math.PI + angle

    errorSegments.push({ from, to, angle, length: len })
    totalLength += len

    if (angle < 1.54) protLength += len
    else if (angle < 2.6) deutLength += len
    else tritLength += len
  }

  // 軸ごとに独立した連続値を計算 — 個人差をそのまま反映できる
  const profile: VisionProfile = {
    protan: axisAmount(protLength, emptyCount),
    deutan: axisAmount(deutLength, emptyCount),
    tritan: axisAmount(tritLength, emptyCount),
    macular: 0,
  }

  const ratio = {
    prot: totalLength === 0 ? 0 : protLength / totalLength,
    deut: totalLength === 0 ? 0 : deutLength / totalLength,
    trit: totalLength === 0 ? 0 : tritLength / totalLength,
  }

  return {
    errorCount: errorSegments.length,
    emptyCount,
    totalLength,
    protLength,
    deutLength,
    tritLength,
    sortedOrder,
    errorSegments,
    profile,
    ratio,
  }
}

export function shuffled<T>(arr: T[]): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
