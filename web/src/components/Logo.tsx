import { CSSProperties } from 'react'

type Size = 'xs' | 'sm' | 'lg' | 'xl'

const cls: Record<Size, string> = {
  xs: 'brand-mark brand-mark--xs',
  sm: 'brand-mark brand-mark--sm',
  lg: 'brand-mark brand-mark--lg',
  xl: 'brand-mark brand-mark--xl',
}

interface Props {
  size?: Size
  withSubtitle?: boolean
  subtitleSize?: 'normal' | 'small'
  as?: 'span' | 'h1'
  style?: CSSProperties
  className?: string
}

/**
 * irodori タイトル (Adobe Fonts AB-J-GU)。
 * 立体厚みは -webkit-text-stroke + text-shadow の二段重ねで再現。
 * Kit が未ロードでもフォールバック (Bowlby One) でチャンキーな質感を保つ。
 */
export default function Logo({
  size = 'sm',
  withSubtitle = false,
  subtitleSize = 'normal',
  as = 'span',
  style,
  className,
}: Props) {
  const Tag = as
  return (
    <div className={['brand', className].filter(Boolean).join(' ')} style={style}>
      <Tag className={cls[size]} aria-label="irodori">
        irodori
      </Tag>
      {withSubtitle && (
        <span className={`brand-sub${subtitleSize === 'small' ? ' brand-sub--small' : ''}`}>
          「いろ」でつながる色覚支援ツール
        </span>
      )}
    </div>
  )
}
