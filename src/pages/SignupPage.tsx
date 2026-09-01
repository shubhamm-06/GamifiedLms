import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { AuthCard } from '@/components/auth/AuthCard'
import { AuthField } from '@/components/auth/AuthField'
import { supabase } from '@/lib/supabase'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface FieldErrors {
  displayName?: string
  email?: string
  password?: string
}

export function SignupPage() {
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [checkEmail, setCheckEmail] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  function validate(): boolean {
    const errors: FieldErrors = {}
    if (!displayName.trim()) errors.displayName = 'Enter your name.'
    if (!EMAIL_PATTERN.test(email)) errors.email = 'Enter a valid email address.'
    if (password.length < 8) errors.password = 'Must be at least 8 characters.'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    if (!validate()) return

    setSubmitting(true)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName.trim() } },
    })
    setSubmitting(false)

    if (error) {
      setFormError(error.message)
      return
    }

    if (data.session) {
      navigate({ to: '/' })
    } else {
      setCheckEmail(true)
    }
  }

  if (checkEmail) {
    return (
      <AuthCard heading="Check your email" subheading="Almost there">
        <p className="auth-form-success">
          We sent a confirmation link to {email}. Click it to activate your
          account, then log in.
        </p>
        <p className="auth-footer">
          <Link to="/login" className="auth-link">
            Back to log in
          </Link>
        </p>
      </AuthCard>
    )
  }

  return (
    <AuthCard heading="Create your account" subheading="Start earning XP today">
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {formError ? <p className="auth-form-error">{formError}</p> : null}
        <AuthField
          id="displayName"
          label="Display name"
          type="text"
          autoComplete="name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          error={fieldErrors.displayName}
        />
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
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
        />
        <button type="submit" className="auth-btn-primary" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Sign up'}
        </button>
      </form>
      <p className="auth-footer">
        Already have an account?{' '}
        <Link to="/login" className="auth-link">
          Log in
        </Link>
      </p>
    </AuthCard>
  )
}
