/**
 * 旧: 事前にすべての色覚フィルタを `<defs>` に列挙していた。
 * 新: 各画面が VisionFilter (動的) で必要なフィルタだけインライン挿入する。
 * このコンポーネントは互換のため残し、何もレンダリングしない。
 */
export default function ColorFilterDefs() {
  return null
}
