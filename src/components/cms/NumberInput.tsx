type NumberInputProps = {
  id: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  ariaInvalid?: boolean
  ariaDescribedBy?: string
}

export function NumberInput({
  id,
  value,
  onChange,
  min,
  max,
  step = 1,
  ariaInvalid,
  ariaDescribedBy,
}: NumberInputProps) {
  return (
    <input
      id={id}
      type="number"
      value={value}
      onChange={(e) => {
        const n = e.target.valueAsNumber
        if (Number.isFinite(n)) onChange(n)
      }}
      min={min}
      max={max}
      step={step}
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedBy}
      data-component="NumberInput"
      className="w-full h-11 rounded-lg border border-line bg-surface-card
                 px-3 text-sm text-ink-AAA
                 focus:border-2 focus:border-ink-AAA focus:outline-none
                 aria-invalid:border-brand"
    />
  )
}
