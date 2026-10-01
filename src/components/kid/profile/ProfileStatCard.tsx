import type { ReactNode } from 'react'

/** One stat on the desktop Profile: the desktop Home rail's card (`.khd-card`) with a Baloo 2 number and a Nunito label. */
export function ProfileStatCard({
  kind,
  icon,
  value,
  label,
  testId,
}: {
  kind: 'level' | 'xp' | 'streak'
  icon: ReactNode
  value: number
  label: string
  testId: string
}) {
  return (
    <li className="khd-card kpd-stat" data-kind={kind === 'level' ? 'progress' : kind} data-testid={testId}>
      <span className="khd-card-icon" aria-hidden>
        {icon}
      </span>
      <div>
        <p className="khd-card-value kid-num">{value}</p>
        <p className="khd-card-label">{label}</p>
      </div>
    </li>
  )
}
