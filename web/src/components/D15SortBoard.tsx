import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CAPS_DESAT,
  CAPS_SAT,
  Palette,
  REF_CAP_DESAT,
  REF_CAP_SAT,
  shuffled,
} from '../lib/d15'

interface Cap {
  capNo: number
  color: string
}

interface Props {
  palette: Palette
  onChange?: (placements: (number | null)[]) => void
  onReady: (placements: (number | null)[]) => void
  disabled?: boolean
}

type Row = 'top' | 'bottom'
type CellRef = { row: Row; index: number }

interface DragState {
  from: CellRef
  cap: Cap
  pointerX: number
  pointerY: number
}

/**
 * D-15 並べ替えボード。
 * - ドラッグ&ドロップで並べ替え (Pointer Events ベースで mouse / touch / pen 全対応)
 * - 短くタップした場合はクリック扱い、最初のタップで掴み、2 回目のタップで離す方式も併用
 */
export default function D15SortBoard({ palette, onChange, onReady, disabled }: Props) {
  const initialCaps: Cap[] = useMemo(() => {
    const list = palette === 'saturated' ? CAPS_SAT : CAPS_DESAT
    return list.map((color, i) => ({ capNo: i + 1, color }))
  }, [palette])

  const refColor = palette === 'saturated' ? REF_CAP_SAT : REF_CAP_DESAT

  const [top, setTop] = useState<(Cap | null)[]>(() => shuffled(initialCaps))
  const [bottom, setBottom] = useState<(Cap | null)[]>(() => Array(15).fill(null))
  /** タップ式の選択 (短いクリックで選択 → 別セルクリックで配置) */
  const [selected, setSelected] = useState<CellRef | null>(null)
  /** ドラッグ中 (ポインタを動かしている最中の状態) */
  const [drag, setDrag] = useState<DragState | null>(null)
  /** ドラッグ中にホバーしているセル */
  const [hover, setHover] = useState<CellRef | null>(null)

  /** pointerdown 直後の状態 (まだ移動量が閾値未満で drag に昇格していない) */
  const pendingRef = useRef<{ from: CellRef; cap: Cap; startX: number; startY: number } | null>(null)
  const boardRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setTop(shuffled(initialCaps))
    setBottom(Array(15).fill(null))
    setSelected(null)
    setDrag(null)
    setHover(null)
    pendingRef.current = null
  }, [palette, initialCaps])

  useEffect(() => {
    onChange?.(bottom.map((c) => (c ? c.capNo : null)))
  }, [bottom, onChange])

  const getCell = (row: Row, index: number): Cap | null =>
    row === 'top' ? top[index] : bottom[index]

  const mutate = (row: Row, index: number, value: Cap | null) => {
    if (row === 'top') {
      setTop((prev) => {
        const next = prev.slice()
        next[index] = value
        return next
      })
    } else {
      setBottom((prev) => {
        const next = prev.slice()
        next[index] = value
        return next
      })
    }
  }

  /** src の中身を dst へ移動 (空ならそのまま、埋まっていればスワップ) */
  const performMove = (src: CellRef, dst: CellRef) => {
    if (src.row === dst.row && src.index === dst.index) return
    const srcCap = getCell(src.row, src.index)
    if (!srcCap) return
    const dstCap = getCell(dst.row, dst.index)
    if (dstCap) {
      mutate(src.row, src.index, dstCap)
      mutate(dst.row, dst.index, srcCap)
    } else {
      mutate(src.row, src.index, null)
      mutate(dst.row, dst.index, srcCap)
    }
  }

  /** タップ式: 同じセルを 2 回タップでキャンセル、別セルで配置/スワップ */
  const handleTap = (target: CellRef) => {
    const cell = getCell(target.row, target.index)
    if (!selected) {
      if (!cell) return
      setSelected(target)
      return
    }
    if (selected.row === target.row && selected.index === target.index) {
      setSelected(null)
      return
    }
    performMove(selected, target)
    setSelected(null)
  }

  // ===== Pointer Events =====

  const handlePointerDown = (row: Row, index: number, e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return
    const cap = getCell(row, index)
    if (!cap) {
      // 空セルへのタップは「配置先選択」(selected があるとき)
      if (selected) handleTap({ row, index })
      return
    }
    pendingRef.current = {
      from: { row, index },
      cap,
      startX: e.clientX,
      startY: e.clientY,
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const pending = pendingRef.current

    if (drag) {
      setDrag({ ...drag, pointerX: e.clientX, pointerY: e.clientY })
      // ホバー中のセルを特定
      const found = findCellAtPoint(e.clientX, e.clientY)
      setHover(found)
      return
    }

    if (pending) {
      const dx = e.clientX - pending.startX
      const dy = e.clientY - pending.startY
      if (Math.hypot(dx, dy) > 6) {
        // 閾値超え → ドラッグ開始 (ゴースト中心はポインタに完全同期)
        setDrag({
          from: pending.from,
          cap: pending.cap,
          pointerX: e.clientX,
          pointerY: e.clientY,
        })
        // タップ系の選択状態は解除しておく
        setSelected(null)
      }
    }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const pending = pendingRef.current

    if (drag) {
      const target = hover ?? findCellAtPoint(e.clientX, e.clientY)
      if (target) performMove(drag.from, target)
      setDrag(null)
      setHover(null)
      pendingRef.current = null
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        // ignore
      }
      return
    }

    if (pending) {
      // ドラッグ閾値を超えなかった → タップ扱い
      handleTap(pending.from)
      pendingRef.current = null
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  const handlePointerCancel = () => {
    setDrag(null)
    setHover(null)
    pendingRef.current = null
  }

  /** 画面座標から data-cell の row/index を解決 */
  const findCellAtPoint = (x: number, y: number): CellRef | null => {
    const stack = document.elementsFromPoint(x, y)
    for (const el of stack) {
      const r = (el as HTMLElement).dataset?.cellRow as Row | undefined
      const i = (el as HTMLElement).dataset?.cellIndex
      if (r && i !== undefined) {
        return { row: r, index: Number(i) }
      }
    }
    return null
  }

  // ===== styles =====

  /* .d15-row 側で width / aspect-ratio を制御 (フルードに shrink) するためここでは設定しない */
  const baseCell = (filled: boolean, isSelected: boolean, isHover: boolean, isHidden: boolean): React.CSSProperties => ({
    borderRadius: 8,
    border: isSelected || isHover ? '2.5px solid var(--ink)' : '1.5px solid var(--rule-soft)',
    background: '#fff',
    cursor: filled ? 'grab' : 'default',
    transition: 'border-color 80ms ease, transform 80ms ease, opacity 80ms ease',
    transform: isSelected ? 'translateY(-2px)' : undefined,
    opacity: isHidden ? 0 : 1,
    touchAction: 'none',
    userSelect: 'none',
  })

  const allPlaced = bottom.every((c) => c !== null)
  const placedCount = bottom.filter(Boolean).length

  return (
    <div
      className="stack-md"
      ref={boardRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      <div className="row-between">
        <span className="field-label" style={{ margin: 0 }}>似ている色を順に並べてください</span>
        <span className="muted" style={{ fontSize: '0.9rem' }}>{placedCount} / 15</span>
      </div>

      {/* 上段: 並べる対象 (15色) — 常に 1 行。狭ければ横スクロール */}
      <div
        className="d15-row"
        style={{
          background: '#fdfcf7',
          border: '1.5px solid var(--rule-soft)',
        }}
      >
        {top.map((cap, i) => {
          const isSel = selected?.row === 'top' && selected.index === i
          const isHover = hover?.row === 'top' && hover.index === i
          const isDragSource = drag?.from.row === 'top' && drag.from.index === i
          return (
            <div
              key={`t-${i}`}
              data-cell-row="top"
              data-cell-index={i}
              onPointerDown={(e) => handlePointerDown('top', i, e)}
              role="button"
              aria-label={cap ? `Cap ${cap.capNo}` : '空きスロット'}
              style={{
                ...baseCell(!!cap, isSel, isHover, isDragSource),
                background: cap ? cap.color : '#fff',
              }}
            />
          )
        })}
      </div>

      <div className="divider" aria-hidden="true" />

      {/* 下段: 基準キャップ + 15 個の空きスロット (ユーザーが並べる場所) — 常に 1 行 */}
      <div
        className="d15-row"
        style={{
          background: '#fff',
          border: '1.5px dashed var(--ink)',
        }}
      >
        <div
          aria-label="基準キャップ"
          title="基準キャップ (動かせません)"
          style={{
            ...baseCell(true, false, false, false),
            background: refColor,
            border: '2.5px solid var(--ink)',
            cursor: 'default',
          }}
        />
        {bottom.map((cap, i) => {
          const isSel = selected?.row === 'bottom' && selected.index === i
          const isHover = hover?.row === 'bottom' && hover.index === i
          const isDragSource = drag?.from.row === 'bottom' && drag.from.index === i
          return (
            <div
              key={`b-${i}`}
              data-cell-row="bottom"
              data-cell-index={i}
              onPointerDown={(e) => handlePointerDown('bottom', i, e)}
              role="button"
              aria-label={cap ? `Cap ${cap.capNo}` : '空きスロット'}
              style={{
                ...baseCell(!!cap, isSel, isHover, isDragSource),
                background: cap ? cap.color : '#fff',
              }}
            />
          )
        })}
      </div>

      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button
          className="btn btn--primary btn--xl"
          disabled={disabled || placedCount === 0}
          onClick={() => onReady(bottom.map((c) => (c ? c.capNo : null)))}
        >
          {allPlaced ? '判定する' : 'この状態で判定する'}
        </button>
      </div>

      {/* ドラッグ中のゴースト — Portal で body 直下に出して `position:fixed` を viewport 基準にする */}
      {drag &&
        createPortal(
          <div
            aria-hidden="true"
            style={{
              position: 'fixed',
              left: drag.pointerX,
              top: drag.pointerY,
              transform: 'translate(-50%, -50%)',
              width: 'clamp(20px, 5vw, 46px)',
              height: 'clamp(20px, 5vw, 46px)',
              borderRadius: 8,
              background: drag.cap.color,
              border: '2.5px solid var(--ink)',
              boxShadow: '4px 4px 0 var(--ink)',
              pointerEvents: 'none',
              zIndex: 1000,
            }}
          />,
          document.body,
        )}
    </div>
  )
}
