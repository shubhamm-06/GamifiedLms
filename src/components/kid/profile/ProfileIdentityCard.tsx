import type { Ref } from 'react'
import { Pencil } from 'lucide-react'
import { Avatar } from '@/components/kid/Avatar'
import type { AvatarConfig } from '@/lib/avatar'

/**
 * The desktop Profile's left column: the avatar large in its ring, the student's
 * name (two lines at most, the full name in `title`), and the page's ONE gold
 * action, which opens the avatar builder. The button keeps the mobile entry
 * point's wording ("Edit your avatar").
 */
export function ProfileIdentityCard({
  config,
  name,
  onEdit,
  editRef,
}: {
  config: AvatarConfig
  name: string
  onEdit: () => void
  editRef: Ref<HTMLButtonElement>
}) {
  return (
    <section className="kpd-identity" aria-label="Your profile" data-testid="profile-identity">
      <div className="kpd-avatar-ring">
        <Avatar config={config} size={152} data-testid="profile-avatar" />
      </div>
      <p className="kpd-name" title={name} data-testid="profile-name">
        {name}
      </p>
      <button ref={editRef} type="button" className="kpd-edit kid-tap" onClick={onEdit} data-testid="edit-avatar">
        <Pencil className="size-4" strokeWidth={2.75} aria-hidden />
        Edit your avatar
      </button>
    </section>
  )
}
