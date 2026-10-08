import { useState, type FormEvent } from 'react'
import { Link, useRouter, useSearch } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { AuthCard } from '@/components/auth/AuthCard'
import { AuthField } from '@/components/auth/AuthField'
import { useBranding } from '@/hooks/useSettings'
import { resolvePostLoginPath } from '@/lib/adminSession'
import { supabase } from '@/lib/supabase'
import { EMAIL_PATTERN } from '@/lib/utils'

interface FieldErrors {
  displayName?: string
  email?: string
  password?: string
}

export function SignupPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { redirect } = useSearch({ from: '/signup' })
  const branding = useBranding()
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
      // Back to where the visitor came from (e.g. a free course page, so the Enroll button is ready), else Home.
      // `redirect` is validated (internal paths only) inside resolvePostLoginPath.
      router.history.replace(await resolvePostLoginPath(queryClient, redirect))
    } else {
      setCheckEmail(true)
    }
  }

  if (checkEmail) {
    return (
      <AuthCard
        heading="Check your email"
        subheading={`We sent a confirmation link to ${email}`}
        footer={
          <Link to="/login" search={{ redirect }} className="font-medium text-teal hover:underline">
            Back to log in
          </Link>
        }
      >
        <p className="text-center text-sm text-ink/60">Click it to activate your account, then log in.</p>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      heading={branding.registerHeading || 'Create your account'}
      subheading={branding.registerSubline || 'Get started in a minute'}
      onSubmit={handleSubmit}
      submitLabel="Create account"
      submitting={submitting}
      error={formError}
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" search={{ redirect }} className="font-medium text-teal hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <AuthField
        id="displayName"
        label="Display name"
        type="text"
        autoComplete="name"
        placeholder="Your name"
        autoFocus
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        error={fieldErrors.displayName}
      />
      <AuthField
        id="email"
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldErrors.email}
      />
      <AuthField
        id="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        placeholder="At least 8 characters"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fieldErrors.password}
      />
    </AuthCard>
  )
}
