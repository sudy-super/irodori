import { useRef } from 'react'

interface Props {
  value: number
  min: number
  max: number
  color: string
  onChange: (v: number) => void
}

/**
 * 円形サイズ調整 (ibisPaint 風の太さ pad)。
 * - 中央の点のサイズが現在の太さを視覚化 (現在の色で塗る)
 * - 上下ドラッグで値を増減 (上 = 大、下 = 小)
 */
export default function SizePuck({ value, min, max, color, onChange }: Props) {
  const startRef = useRef<{ y: number; v: number } | null>(null)

  const clamp = (n: number) => Math.max(min, Math.min(max, n))

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    startRef.current = { y: e.clientY, v: value }
  }

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!startRef.current) return
    const dy = startRef.current.y - e.clientY // 上方向 = +
    const next = clamp(startRef.current.v + Math.round(dy / 4))
    if (next !== value) onChange(next)
  }

  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    startRef.current = null
  }

  return (
    <div
      className="draw-mobile__size-puck"
      role="slider"
      aria-label="太さ"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      title={`太さ ${value}px`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <span className="draw-mobile__size-puck-num">{value}</span>
    </div>
  )
}
