import { useMemo } from 'react'
import {
  feColorMatrixValues,
  feColorMatrixValuesInverse,
  profileFilterId,
} from '../lib/colorMatrices'
import { VisionProfile, isNormal } from '../lib/visionTypes'

interface Options {
  /**
   * true にすると順方向 (シミュレーション) ではなく逆行列を出力する。
   * 画面の色を補正して、その目を通った後で正常な色に近づける用途。
   */
  inverse?: boolean
}

/**
 * VisionProfile から動的に SVG `<filter>` を生成し、CSS で参照できる url(#id) を返す。
 * - 同じプロファイルなら id が安定 (5% 刻みスナップ) なので、複数箇所で共有しても重複しない
 * - 親に挿入するため、Fragment で <svg defs> を出力 + filterUrl を計算
 * - opts.inverse で順方向 / 補正方向を切り替え
 */
export function useVisionFilter(
  profile: VisionProfile,
  opts: Options = {},
): {
  filterId: string
  filterUrl: string | undefined
  defs: JSX.Element | null
} {
  const inverse = opts.inverse ?? false
  return useMemo(() => {
    if (isNormal(profile)) {
      return { filterId: '', filterUrl: undefined, defs: null }
    }
    const baseId = profileFilterId(profile)
    const id = inverse ? `${baseId}-inv` : baseId
    const values = inverse
      ? feColorMatrixValuesInverse(profile)
      : feColorMatrixValues(profile)
    const defs = (
      <svg
        aria-hidden="true"
        width="0"
        height="0"
        style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}
      >
        <defs>
          <filter
            id={id}
            x="0"
            y="0"
            width="100%"
            height="100%"
            colorInterpolationFilters="sRGB"
          >
            <feColorMatrix type="matrix" values={values} />
          </filter>
        </defs>
      </svg>
    )
    return { filterId: id, filterUrl: `url(#${id})`, defs }
  }, [profile.protan, profile.deutan, profile.tritan, profile.macular, inverse])
}
