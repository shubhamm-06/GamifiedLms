import type { InputHTMLAttributes } from 'react'

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export function AuthField({ label, error, id, ...inputProps }: AuthFieldProps) {
  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-invalid={!!error} {...inputProps} />
      {error ? <span className="auth-field-error">{error}</span> : null}
    </div>
  )
}
