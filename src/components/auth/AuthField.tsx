import { useEffect, useRef, useState, type ComponentProps } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface AuthFieldProps extends Omit<ComponentProps<'input'>, 'autoFocus'> {
  label: string
  error?: string
  /** Focus on mount, but only where a keyboard is the primary input; on touch it would pop the keyboard open. */
  autoFocus?: boolean
}

const FINE_POINTER = '(hover: hover) and (pointer: fine)'

// `auth-field` / `auth-field-error` stay as class hooks: the kid Profile forms reuse this field
// and kid.css targets them (see docs/ui.md).
export function AuthField({ label, error, id, type, autoFocus, className, ...inputProps }: AuthFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [revealed, setRevealed] = useState(false)
  const isPassword = type === 'password'
  const errorId = id ? `${id}-error` : undefined

  useEffect(() => {
    if (autoFocus && window.matchMedia(FINE_POINTER).matches) inputRef.current?.focus()
  }, [autoFocus])

  return (
    <div className="auth-field flex flex-col gap-2">
      <Label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </Label>
      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          type={isPassword && revealed ? 'text' : type}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            'h-10 rounded-[8px] border-ink/20 bg-white px-3 text-base text-ink placeholder:text-ink/40 focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/40 aria-invalid:border-coral-d aria-invalid:ring-2 aria-invalid:ring-coral-d/15 md:text-base',
            isPassword && 'pr-10',
            className,
          )}
          {...inputProps}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-[8px] text-ink/55 outline-none hover:text-ink focus-visible:text-ink focus-visible:ring-2 focus-visible:ring-teal/60"
          >
            {revealed ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
          </button>
        ) : null}
      </div>
      {error ? (
        <p id={errorId} className="auth-field-error text-sm leading-snug text-coral-d">
          {error}
        </p>
      ) : null}
    </div>
  )
}
