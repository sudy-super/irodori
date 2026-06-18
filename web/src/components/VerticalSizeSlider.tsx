import { useCallback, useRef } from 'react'

interface Props {
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}

/**
 * 縦方向のサイズスライダ。
 * `<input type="range">` の vertical サポートはブラウザ間で差があるので、
 * pointer events で自前実装する。
 */
export default function VerticalSizeSlider({ value, min, max, onChange }: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null)

  const clamp = (v: number) => Math.max(min, Math.min(max, v))

  const compute = useCallback(
    (clientY: number) => {
      const rect = trackRef.current?.getBoundingClientRect()
      if (!rect) return
      const y = clientY - rect.top
      const pct = Math.max(0, Math.min(1, 1 - y / rect.height)) // top = max, bottom = min
      const v = Math.round(min + pct * (max - min))
      onChange(clamp(v))
    },
    [min, max, onChange],
  )

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    compute(e.clientY)
  }

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons === 0) return
    compute(e.clientY)
  }

  const pct = ((clamp(value) - min) / (max - min)) * 100

  return (
    <div
      ref={trackRef}
      className="draw-mobile__size-track"
      role="slider"
      aria-label="太さ"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      onPointerDown={onDown}
      onPointerMove={onMove}
    >
      <div className="draw-mobile__size-thumb" style={{ bottom: `calc(${pct}% - 5px)` }} />
    </div>
  )
}
