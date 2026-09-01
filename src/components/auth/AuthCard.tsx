import { useRouter } from '@tanstack/react-router'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

interface AuthCardProps {
  heading: string
  subheading?: string
  children: ReactNode
}

export function AuthCard({ heading, subheading, children }: AuthCardProps) {
  const router = useRouter()

  const handleClose = () => {
    if (window.history.length > 1) {
      router.history.back()
    } else {
      router.navigate({ to: '/' })
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <button
          type="button"
          className="auth-close"
          aria-label="Close"
          onClick={handleClose}
        >
          <X size={18} />
        </button>
        <h1 className="auth-heading">{heading}</h1>
        {subheading ? <p className="auth-subheading">{subheading}</p> : null}
        {children}
      </div>
    </div>
  )
}
