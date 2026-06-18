import { PALETTE } from '../lib/palette'

interface Props {
  current: string
  onSelect: (color: string) => void
}

export default function ColorPalette({ current, onSelect }: Props) {
  return (
    <div className="palette" role="radiogroup" aria-label="色を選ぶ">
      {PALETTE.map((c) => {
        const selected = c.color.toLowerCase() === current.toLowerCase()
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c.color)}
            aria-label={c.label}
            aria-pressed={selected}
            data-selected={selected || undefined}
            className="palette__swatch"
            style={{ background: c.color, color: c.text }}
          >
            {c.label}
          </button>
        )
      })}
    </div>
  )
}
