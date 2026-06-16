type DateTimeInputProps = {
  id: string
  /** ISO datetime string or empty (= null on the wire) */
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  ariaInvalid?: boolean
  ariaDescribedBy?: string
}

export function DateTimeInput({
  id,
  value,
  onChange,
  min,
  max,
  ariaInvalid,
  ariaDescribedBy,
}: DateTimeInputProps) {
  return (
    <input
      id={id}
      type="datetime-local"
      value={isoToLocalInput(value)}
      onChange={(e) => onChange(localInputToIso(e.target.value))}
      min={min ? isoToLocalInput(min) : undefined}
      max={max ? isoToLocalInput(max) : undefined}
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedBy}
      data-component="DateTimeInput"
      className="w-full h-11 rounded-lg border border-line bg-surface-card
                 px-3 text-sm text-ink-AAA
                 focus:border-2 focus:border-ink-AAA focus:outline-none
                 aria-invalid:border-brand"
    />
  )
}

/** ISO `2026-06-16T03:30:00.000Z` → `2026-06-16T11:30`(local，無秒、無時區) */
export function isoToLocalInput(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** local `2026-06-16T11:30` → ISO `2026-06-16T03:30:00.000Z`(依瀏覽器 TZ) */
export function localInputToIso(local: string): string {
  if (!local) return ''
  const d = new Date(local)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString()
}
