import { useNavigate, useSearch } from '@tanstack/react-router'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TrashTab } from '@/components/admin/trash/TrashTab'
import { TRASH_ENTITIES, useTrashCounts } from '@/hooks/admin/useTrash'
import type { TrashEntity } from '@/lib/trash'
import { getTerms as tw } from '@/lib/settings/terms'

const TAB_LABEL: Record<TrashEntity, string> = {
  courses: `${tw().terms('course')}`,
  modules: `${tw().terms('module')}`,
  lessons: `${tw().terms('lesson')}`,
  games: 'Games',
  badges: `${tw().terms('badge')}`,
  users: 'Users',
}

/**
 * The only screen in the admin panel where anything is permanently deleted.
 * Everything else moves items here; from here they can be restored or, if
 * nothing still depends on them, removed for good.
 */
export function TrashPage() {
  const { tab } = useSearch({ from: '/admin/trash' })
  const navigate = useNavigate()
  const counts = useTrashCounts()

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Trash</h1>
        <p className="text-muted-foreground text-sm">
          {counts.data
            ? `${counts.data.total} ${counts.data.total === 1 ? 'item' : 'items'} in the trash`
            : 'Restore items, or delete them for good.'}
        </p>
      </header>

      {/* Same ?tab=-as-real-search-param convention as Course Builder,
          Orders and Settings: survives a refresh and is linkable. */}
      <Tabs
        value={tab}
        onValueChange={(value) =>
          navigate({ to: '/admin/trash', search: { tab: value as TrashEntity }, replace: true })
        }
      >
        <TabsList>
          {TRASH_ENTITIES.map((entity) => (
            <TabsTrigger key={entity} value={entity}>
              {TAB_LABEL[entity]}
              {counts.data && counts.data[entity] > 0 ? (
                <span className="text-muted-foreground ml-1.5 text-xs tabular-nums">
                  {counts.data[entity]}
                </span>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* key: switching tabs remounts the tab, so search and selection start fresh. */}
      <TrashTab key={tab} entity={tab} />
    </div>
  )
}
