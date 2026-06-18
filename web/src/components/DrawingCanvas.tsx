import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

export interface DrawingCanvasHandle {
  clear: () => void
  undo: () => void
  toBlob: () => Promise<Blob | null>
  size: () => { width: number; height: number }
}

/** undo 用に保持する直前スナップショットの最大数 */
const MAX_HISTORY = 10

interface Props {
  color: string
  tool: 'pen' | 'eraser'
  size: number
}

/**
 * Pointer Events ベースの描画キャンバス。
 * - 表示寸法はフレーム内に absolute 配置した「sizer」 div で決定
 * - canvas は sizer に 100% で重ねるため、canvas の intrinsic-ratio で生じる
 *   ResizeObserver 無限ループを回避できる
 * - sizer のサイズ変化を Observe して内部 pixel 解像度を一致させる
 */
const DrawingCanvas = forwardRef<DrawingCanvasHandle, Props>(function DrawingCanvas(
  { color, tool, size: strokeSize },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sizerRef = useRef<HTMLDivElement | null>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const drawingRef = useRef(false)
  const lastRef = useRef<{ x: number; y: number } | null>(null)
  const historyRef = useRef<HTMLCanvasElement[]>([])
  const [dpr, setDpr] = useState(1)
  const [dim, setDim] = useState({ width: 0, height: 0 })

  /** 現在の canvas 内容を 1 スナップショットとして履歴に積む (FIFO で MAX_HISTORY 件) */
  const pushHistory = () => {
    const canvas = canvasRef.current
    if (!canvas || canvas.width === 0 || canvas.height === 0) return
    const snap = document.createElement('canvas')
    snap.width = canvas.width
    snap.height = canvas.height
    const sctx = snap.getContext('2d')
    if (!sctx) return
    sctx.drawImage(canvas, 0, 0)
    historyRef.current.push(snap)
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift()
  }

  useEffect(() => {
    setDpr(window.devicePixelRatio || 1)
  }, [])

  // sizer (intrinsic-ratio を持たない通常 div) を Observe して表示寸法を取得
  useEffect(() => {
    const sizer = sizerRef.current
    if (!sizer) return

    const measure = () => {
      const r = sizer.getBoundingClientRect()
      const w = Math.max(100, Math.floor(r.width))
      const h = Math.max(100, Math.floor(r.height))
      setDim((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }))
    }
    measure()

    const ro = new ResizeObserver(() => measure())
    ro.observe(sizer)
    return () => ro.disconnect()
  }, [])

  // dim 変化に応じて canvas pixel 解像度を更新。既存内容は退避→新サイズに scale。
  useEffect(() => {
    const { width, height } = dim
    if (!width || !height) return
    const canvas = canvasRef.current
    if (!canvas) return

    let snapshot: HTMLCanvasElement | null = null
    if (canvas.width > 0 && canvas.height > 0) {
      const tmp = document.createElement('canvas')
      tmp.width = canvas.width
      tmp.height = canvas.height
      const tctx = tmp.getContext('2d')
      if (tctx) {
        tctx.drawImage(canvas, 0, 0)
        snapshot = tmp
      }
    }

    canvas.width = width * dpr
    canvas.height = height * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (snapshot) ctx.drawImage(snapshot, 0, 0, width, height)
    ctxRef.current = ctx
    // 解像度が変わると過去のスナップショットは寸法が合わなくなるので破棄
    historyRef.current = []
  }, [dim.width, dim.height, dpr])

  useImperativeHandle(
    ref,
    () => ({
      clear: () => {
        const ctx = ctxRef.current
        const canvas = canvasRef.current
        if (!ctx || !canvas) return
        // クリア前の状態を履歴に積み、undo で戻せるようにする
        pushHistory()
        ctx.save()
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.restore()
      },
      undo: () => {
        const ctx = ctxRef.current
        const canvas = canvasRef.current
        const snap = historyRef.current.pop()
        if (!ctx || !canvas || !snap) return
        ctx.save()
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(snap, 0, 0)
        ctx.restore()
      },
      toBlob: () => {
        const canvas = canvasRef.current
        if (!canvas) return Promise.resolve(null)
        return new Promise<Blob | null>((resolve) => {
          canvas.toBlob((b) => resolve(b), 'image/png')
        })
      },
      size: () => ({ width: dim.width, height: dim.height }),
    }),
    [dim.width, dim.height],
  )

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * dim.width,
      y: ((e.clientY - rect.top) / rect.height) * dim.height,
    }
  }

  const handleDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drawingRef.current = true
    // 新規ストロークの直前状態を履歴に積む
    pushHistory()
    const p = getPos(e)
    lastRef.current = p
    const ctx = ctxRef.current
    if (!ctx) return
    ctx.beginPath()
    ctx.fillStyle = tool === 'eraser' ? '#ffffff' : color
    ctx.arc(p.x, p.y, strokeSize / 2, 0, Math.PI * 2)
    ctx.fill()
  }

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return
    const ctx = ctxRef.current
    const last = lastRef.current
    if (!ctx || !last) return
    const p = getPos(e)
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color
    ctx.lineWidth = strokeSize
    ctx.beginPath()
    ctx.moveTo(last.x, last.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    lastRef.current = p
  }

  const handleUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = false
    lastRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  return (
    <div className="canvas-frame">
      <div
        ref={sizerRef}
        style={{ position: 'absolute', top: 12, left: 12, right: 12, bottom: 12 }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            background: '#fff',
            borderRadius: 8,
            touchAction: 'none',
            cursor: tool === 'eraser' ? 'cell' : 'crosshair',
            display: 'block',
          }}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
        />
      </div>
      <svg
        className="canvas-frame__pencil"
        viewBox="0 0 24 24"
        aria-hidden="true"
        fill="none"
        stroke="#111111"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        <path d="M14.5 5.5l3 3" />
      </svg>
    </div>
  )
})

export default DrawingCanvas
