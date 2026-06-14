type SpinnerProps = {
  /** SR 讀出的狀態文字，也視覺顯示在 spinner 下方 */
  label: string
  /** size：sm=24、md=40（預設）、lg=48 */
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Spec 003n — Spinner
 *
 * 純 CSS 旋轉圈圈 + 下方 label 文字。
 * border-line 灰圈底、border-t-brand 紅段是「轉動」視覺。
 * `role="status"` + aria-label 讓 SR 朗讀 loading 文字。
 * `motion-reduce:animate-none` 對 prefers-reduced-motion 友善（圈圈不轉、label 仍顯示）。
 */
export function Spinner({ label, size = 'md' }: SpinnerProps) {
  const ringSize =
    size === 'sm'
      ? 'w-6 h-6 border-[3px]'
      : size === 'lg'
        ? 'w-12 h-12 border-4'
        : 'w-10 h-10 border-4'

  return (
    <div
      role="status"
      aria-label={label}
      className="flex flex-col items-center gap-3"
    >
      <div
        aria-hidden
        className={`${ringSize} rounded-full border-line border-t-brand animate-spin motion-reduce:animate-none`}
      />
      <p className="text-sm text-ink-AA">{label}</p>
    </div>
  )
}
