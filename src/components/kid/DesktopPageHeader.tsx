import type { ReactNode } from 'react'

/**
 * The page header of a >= 1024px kid screen: one `<h1>`, an optional short
 * subtitle and an optional right-aligned actions slot, inside the content area
 * (so it lines up with desktop Home, not the old 40rem top-bar row). Used by
 * Profile now; Badges and Courses adopt it in their own passes. The caller mounts
 * it only at >= 1024px and calls `useOwnDesktopHeader()` so the shell hides the
 * old top-bar title row (kidHeader.ts, kid.css `data-own-header`).
 */
export function DesktopPageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="kdh" data-testid="desktop-page-header">
      <div className="kdh-text">
        <h1 className="kdh-title" data-testid="page-title">
          {title}
        </h1>
        {subtitle ? <p className="kdh-sub">{subtitle}</p> : null}
      </div>
      {actions ? <div className="kdh-actions">{actions}</div> : null}
    </header>
  )
}
