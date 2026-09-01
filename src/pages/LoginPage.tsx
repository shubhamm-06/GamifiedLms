import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { AuthCard } from '@/components/auth/AuthCard'
import { AuthField } from '@/components/auth/AuthField'
import { supabase } from '@/lib/supabase'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface FieldErrors {
  email?: string
  password?: string
}

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function validate(): boolean {
    const errors: FieldErrors = {}
    if (!EMAIL_PATTERN.test(email)) errors.email = 'Enter a valid email address.'
    if (!password) errors.password = 'Enter your password.'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    if (!validate()) return

    setSubmitting(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)

    if (error) {
      setFormError(error.message)
      return
    }

    navigate({ to: '/' })
  }

  return (
    <AuthCard heading="Welcome back" subheading="Log in to keep your streak going">
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {formError ? <p className="auth-form-error">{formError}</p> : null}
        <AuthField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
        />
        <AuthField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
        />
        <button type="submit" className="auth-btn-primary" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="auth-footer">
        Don&rsquo;t have an account?{' '}
        <Link to="/signup" className="auth-link">
          Sign up
        </Link>
      </p>
    </AuthCard>
  )
}
