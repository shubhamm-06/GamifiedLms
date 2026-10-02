import { useState, type FormEvent } from 'react'
import { Link, useRouter, useSearch } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { AuthCard } from '@/components/auth/AuthCard'
import { AuthField } from '@/components/auth/AuthField'
import { resolvePostLoginPath } from '@/lib/adminSession'
import { supabase } from '@/lib/supabase'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface FieldErrors {
  email?: string
  password?: string
}

export function LoginPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { redirect } = useSearch({ from: '/login' })
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

    if (error) {
      setSubmitting(false)
      setFormError(error.message)
      return
    }

    // Destination depends on the role, which is read from profiles after the
    // session exists. `redirect` is attacker-controllable, so it's validated
    // (and ignored for non-admins) inside resolvePostLoginPath.
    const destination = await resolvePostLoginPath(queryClient, redirect)
    setSubmitting(false)

    // A runtime string rather than one of the typed route paths, so it goes
    // through history instead of navigate().
    router.history.replace(destination)
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
        <Link to="/signup" search={{ redirect }} className="auth-link">
          Sign up
        </Link>
      </p>
    </AuthCard>
  )
}
