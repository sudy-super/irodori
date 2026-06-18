/** 描画パレットの10色 */
export interface PaletteColor {
  /** 内部識別子 */
  id: string
  /** 表示ラベル */
  label: string
  /** CSS color */
  color: string
  /** 文字色 (ボタン上に重ねる漢字色) */
  text: '#000' | '#fff'
}

export const PALETTE: PaletteColor[] = [
  { id: 'red',    label: '赤', color: '#d54545', text: '#fff' },
  { id: 'brown',  label: '茶', color: '#8a6a5b', text: '#fff' },
  { id: 'cyan',   label: '水', color: '#9ed1e8', text: '#000' },
  { id: 'green',  label: '緑', color: '#5aab5a', text: '#fff' },
  { id: 'yellow', label: '黄', color: '#e3c83a', text: '#000' },
  { id: 'blue',   label: '青', color: '#3973c2', text: '#fff' },
  { id: 'purple', label: '紫', color: '#9156a8', text: '#fff' },
  { id: 'orange', label: '橙', color: '#e08b3a', text: '#000' },
  { id: 'white',  label: '白', color: '#ffffff', text: '#000' },
  { id: 'black',  label: '黒', color: '#000000', text: '#fff' },
]

export const DEFAULT_TOPICS = [
  'トマト',
  'りんご',
  'ひまわり',
  '虹',
  'にんじん',
  '青空と雲',
  '紅葉',
  '海と砂浜',
  'いちご',
  '森',
]

export function randomTopic(): string {
  return DEFAULT_TOPICS[Math.floor(Math.random() * DEFAULT_TOPICS.length)]
}
