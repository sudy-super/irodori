import { CSSProperties, useCallback, useEffect, useRef, useState } from 'react'

interface Props {
  value: string
  onChange: (hex: string) => void
  size?: number
}

/**
 * HSV カラーピッカー。
 * - 外側のリング: 色相 (H) を選択
 * - 内側の正方形: 彩度 (S, 横軸) と明度 (V, 縦軸) を選択
 * - Pointer Events ベース、mouse / touch / pen 全対応
 */
export default function ColorWheel({ value, onChange, size = 220 }: Props) {
  const ringWidth = 18
  const ringPad = 6
  const outerR = size / 2
  const innerR = outerR - ringWidth - ringPad
  // 内接正方形の辺 (半径×√2)
  const sqSide = Math.floor((innerR * 2) / Math.SQRT2) - 6
  const ringMid = (innerR + outerR) / 2

  const wrapRef = useRef<HTMLDivElement | null>(null)
  const sqRef = useRef<HTMLDivElement | null>(null)

  // HSV state — value (hex) との同期は useEffect で双方向に
  const [h, setH] = useState(0)
  const [s, setS] = useState(1)
  const [v, setV] = useState(1)
  // 入力プロパティが外から変わった場合 (e.g. プリセット選択) に同期
  const lastEmittedRef = useRef<string>('')
  useEffect(() => {
    if (value.toLowerCase() === lastEmittedRef.current.toLowerCase()) return
    const next = hexToHsv(value)
    setH(next.h)
    setS(next.s)
    setV(next.v)
  }, [value])

  const emit = useCallback(
    (nh: number, ns: number, nv: number) => {
      const hex = hsvToHex(nh, ns, nv)
      lastEmittedRef.current = hex
      onChange(hex)
    },
    [onChange],
  )

  type DragMode = 'ring' | 'sq' | null
  const [drag, setDrag] = useState<DragMode>(null)

  const updateFromRing = (clientX: number, clientY: number) => {
    const rect = wrapRef.current!.getBoundingClientRect()
    const dx = clientX - rect.left - size / 2
    const dy = clientY - rect.top - size / 2
    const angle = Math.atan2(dy, dx) + Math.PI / 2 // 0 を上に
    let hue = (angle * 180) / Math.PI
    hue = ((hue % 360) + 360) % 360
    setH(hue)
    emit(hue, s, v)
  }

  const updateFromSquare = (clientX: number, clientY: number) => {
    const rect = sqRef.current!.getBoundingClientRect()
    const px = clientX - rect.left
    const py = clientY - rect.top
    const ns = clamp01(px / rect.width)
    const nv = clamp01(1 - py / rect.height)
    setS(ns)
    setV(nv)
    emit(h, ns, nv)
  }

  const onRingDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag('ring')
    updateFromRing(e.clientX, e.clientY)
  }
  const onSqDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag('sq')
    updateFromSquare(e.clientX, e.clientY)
  }
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag === 'ring') updateFromRing(e.clientX, e.clientY)
    else if (drag === 'sq') updateFromSquare(e.clientX, e.clientY)
  }
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    setDrag(null)
  }

  // ===== styles =====
  const ringStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    background:
      'conic-gradient(from 0deg, hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%), hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%))',
    WebkitMask: `radial-gradient(circle, transparent ${innerR}px, #000 ${innerR + 1}px, #000 ${outerR}px, transparent ${outerR + 1}px)`,
    mask: `radial-gradient(circle, transparent ${innerR}px, #000 ${innerR + 1}px, #000 ${outerR}px, transparent ${outerR + 1}px)`,
    touchAction: 'none',
    cursor: 'crosshair',
  }

  const sqStyle: CSSProperties = {
    position: 'absolute',
    width: sqSide,
    height: sqSide,
    left: (size - sqSide) / 2,
    top: (size - sqSide) / 2,
    background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${h}, 100%, 50%))`,
    border: '1.5px solid var(--ink)',
    borderRadius: 6,
    touchAction: 'none',
    cursor: 'crosshair',
  }

  // ===== markers =====
  const hRad = (h * Math.PI) / 180
  const ringMarkerX = size / 2 + ringMid * Math.sin(hRad)
  const ringMarkerY = size / 2 - ringMid * Math.cos(hRad)
  const sqMarkerX = s * sqSide
  const sqMarkerY = (1 - v) * sqSide

  const markerOnDark = v < 0.5

  return (
    <div
      ref={wrapRef}
      style={{ position: 'relative', width: size, height: size, userSelect: 'none' }}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <div style={ringStyle} onPointerDown={onRingDown} />
      <div ref={sqRef} style={sqStyle} onPointerDown={onSqDown}>
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: sqMarkerX - 6,
            top: sqMarkerY - 6,
            width: 12,
            height: 12,
            borderRadius: '50%',
            border: `2px solid ${markerOnDark ? '#fff' : '#000'}`,
            boxShadow: '0 0 0 1px rgba(0,0,0,0.45)',
            pointerEvents: 'none',
          }}
        />
      </div>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: ringMarkerX - 9,
          top: ringMarkerY - 9,
          width: 18,
          height: 18,
          borderRadius: '50%',
          border: '2px solid #fff',
          boxShadow: '0 0 0 1.5px var(--ink)',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}

// ===== helpers =====

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) {
    r = c; g = x
  } else if (h < 120) {
    r = x; g = c
  } else if (h < 180) {
    g = c; b = x
  } else if (h < 240) {
    g = x; b = c
  } else if (h < 300) {
    r = x; b = c
  } else {
    r = c; b = x
  }
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 }
}

function hsvToHex(h: number, s: number, v: number): string {
  const { r, g, b } = hsvToRgb(h, s, v)
  const toHex = (n: number) =>
    Math.round(clamp01(n / 255) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) return { h: 0, s: 1, v: 1 }
  const r = parseInt(m[1], 16) / 255
  const g = parseInt(m[2], 16) / 255
  const b = parseInt(m[3], 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let hh = 0
  if (d !== 0) {
    if (max === r) hh = ((g - b) / d) % 6
    else if (max === g) hh = (b - r) / d + 2
    else hh = (r - g) / d + 4
    hh *= 60
    if (hh < 0) hh += 360
  }
  const s = max === 0 ? 0 : d / max
  return { h: hh, s, v: max }
}
