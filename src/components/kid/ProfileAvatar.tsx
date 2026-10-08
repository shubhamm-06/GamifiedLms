import type { AvatarConfig } from '@/lib/avatar'
import { useFeature } from '@/hooks/useSettings'
import { initialsOf } from '@/lib/initials'
import { Avatar } from './Avatar'

/**
 * The student's own avatar on learner-facing surfaces (nav tab, sidebar, profile).
 * With Settings > Features > Avatars off it is an initials disc instead (the
 * builder is hidden too); admin tables are not affected.
 */
export function ProfileAvatar({
  config,
  name,
  size,
  'data-testid': testId,
}: {
  config: AvatarConfig
  name: string
  size: number
  'data-testid'?: string
}) {
  const avatars = useFeature('avatars')
  if (avatars) return <Avatar config={config} size={size} data-testid={testId} />
  return (
    <span
      className="inline-flex flex-none items-center justify-center rounded-full bg-teal font-bold text-teal-fg"
      style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.38)) }}
      role="img"
      aria-label={name || 'You'}
      data-testid={testId ?? 'avatar'}
      data-initials="true"
    >
      {initialsOf(name)}
    </span>
  )
}
