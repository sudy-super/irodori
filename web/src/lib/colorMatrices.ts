/**
 * 各軸の色覚異常を行列で表現し、独立軸の連続値を合成して
 * 単一の 3x3 RGB 変換行列にまとめる。
 *
 * Machado et al. 2009 の二色覚 (重度) 行列を基準とし、各軸の amount で
 * 恒等行列との線形補間を行ってから連続合成する。
 */

import { Axis, VisionProfile, clamp01 } from './visionTypes'

type Mat3 = [number, number, number, number, number, number, number, number, number]

const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1]

const FULL: Record<Exclude<Axis, 'macular'>, Mat3> = {
  protan: [
    0.152286, 1.052583, -0.204868,
    0.114503, 0.786281,  0.099216,
    -0.003882, -0.048116, 1.051998,
  ],
  deutan: [
    0.367322, 0.860646, -0.227968,
    0.280085, 0.672501,  0.047413,
    -0.011820, 0.042940,  0.968881,
  ],
  tritan: [
    1.255528, -0.076749, -0.178779,
    -0.078411, 0.930809,  0.147602,
     0.004733, 0.691367,  0.303900,
  ],
}

function lerpMat(base: Mat3, target: Mat3, t: number): Mat3 {
  const a = clamp01(t)
  const out: Mat3 = [0, 0, 0, 0, 0, 0, 0, 0, 0]
  for (let i = 0; i < 9; i++) out[i] = base[i] * (1 - a) + target[i] * a
  return out
}

/** A · B (3x3 行列の積) */
function mulMat(A: Mat3, B: Mat3): Mat3 {
  const out: Mat3 = [0, 0, 0, 0, 0, 0, 0, 0, 0]
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      let s = 0
      for (let k = 0; k < 3; k++) s += A[r * 3 + k] * B[k * 3 + c]
      out[r * 3 + c] = s
    }
  }
  return out
}

/** 黄斑変性近似: 青チャンネル劣化 + わずかな黄バイアス */
function macularMat(amount: number): Mat3 {
  const t = clamp01(amount)
  return [
    1,        0,        0,
    0,        1,        0,
    0.20 * t, 0.40 * t, 1 - 0.7 * t,
  ]
}

/**
 * プロファイルから 3x3 RGB 変換行列を合成。
 * 適用順 (内側 → 外側): protan → deutan → tritan → macular。
 * 行列積 M_m · M_t · M_d · M_p の形で出力する。
 */
export function composeMatrix(profile: VisionProfile): Mat3 {
  const Mp = lerpMat(IDENTITY, FULL.protan, profile.protan)
  const Md = lerpMat(IDENTITY, FULL.deutan, profile.deutan)
  const Mt = lerpMat(IDENTITY, FULL.tritan, profile.tritan)
  const Mm = macularMat(profile.macular)
  return mulMat(Mm, mulMat(Mt, mulMat(Md, Mp)))
}

function mat3ToFeValues(m: Mat3): string {
  return [
    m[0], m[1], m[2], 0, 0,
    m[3], m[4], m[5], 0, 0,
    m[6], m[7], m[8], 0, 0,
    0,    0,    0,    1, 0,
  ].join(' ')
}

/** SVG `feColorMatrix values` 用の 4x5 行列文字列 (順方向、シミュレーション用) */
export function feColorMatrixValues(profile: VisionProfile): string {
  return mat3ToFeValues(composeMatrix(profile))
}

/**
 * 補正用の逆行列を 4x5 文字列で返す。
 * 「画面に出す色 = M⁻¹ × 見せたい色」とすることで、profile を持つ目を通った後で
 * 「見せたい色」に近い感覚が再生される。
 *
 * 二色覚相当の行列は特異 (rank 2) になるため、Tikhonov 正則化 (M + ε·I) を施してから
 * 直接逆を求める。重度の場合は完全な復元ではなく "ベストエフォート" の補正となる。
 */
export function feColorMatrixValuesInverse(profile: VisionProfile): string {
  return mat3ToFeValues(composeInverseMatrix(profile))
}

export function composeInverseMatrix(profile: VisionProfile): Mat3 {
  const M = composeMatrix(profile)
  return inverseMat3(M, 0.05)
}

/** 3x3 行列の逆行列。epsilon > 0 を渡すと M + ε·I の逆を返す (Tikhonov 正則化)。 */
function inverseMat3(m: Mat3, epsilon = 0): Mat3 {
  const a = m[0] + epsilon, b = m[1], c = m[2]
  const d = m[3], e = m[4] + epsilon, f = m[5]
  const g = m[6], h = m[7], i = m[8] + epsilon

  // 余因子 (cofactor) を直接展開
  const A =  (e * i - f * h)
  const B = -(b * i - c * h)
  const C =  (b * f - c * e)
  const D = -(d * i - f * g)
  const E =  (a * i - c * g)
  const F = -(a * f - c * d)
  const G =  (d * h - e * g)
  const H = -(a * h - b * g)
  const I =  (a * e - b * d)

  const det = a * A + b * D + c * G
  if (Math.abs(det) < 1e-8) {
    return [1, 0, 0, 0, 1, 0, 0, 0, 1]
  }
  const inv = 1 / det
  return [
    A * inv, B * inv, C * inv,
    D * inv, E * inv, F * inv,
    G * inv, H * inv, I * inv,
  ]
}

/** プロファイルから安定した SVG フィルタ id を生成 (各軸 5% 刻みでスナップ) */
export function profileFilterId(profile: VisionProfile): string {
  const snap = (v: number) => Math.round(clamp01(v) * 20) // 0..20
  return `vision-${snap(profile.protan)}-${snap(profile.deutan)}-${snap(profile.tritan)}-${snap(profile.macular)}`
}
