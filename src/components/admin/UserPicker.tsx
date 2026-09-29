import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useUsers, type AdminUserRow } from '@/hooks/admin/useUsers'

const MAX_RESULTS = 8

/**
 * Search-then-pick — there's no combobox component installed, and a plain
 * input + list needs no new dependency for this. Shared by Add Order
 * (`orders/AddOrderDialog.tsx`, its original home) and the notifications
 * compose form's "a specific student" target.
 */
export function UserPicker({
  selected,
  onSelect,
}: {
  selected: AdminUserRow | null
  onSelect: (user: AdminUserRow | null) => void
}) {
  const { data: users } = useUsers()
  const [search, setSearch] = useState('')

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{selected.display_name}</p>
          <p className="text-muted-foreground truncate text-xs">{selected.email}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Change user"
          onClick={() => onSelect(null)}
        >
          <X />
        </Button>
      </div>
    )
  }

  const term = search.trim().toLowerCase()
  const matches = term
    ? (users ?? [])
        .filter(
          (u) => u.display_name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term),
        )
        .slice(0, MAX_RESULTS)
    : []

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          className="pl-8"
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {term ? (
        <div className="max-h-40 overflow-y-auto rounded-md border">
          {matches.length === 0 ? (
            <p className="text-muted-foreground p-2.5 text-sm">No users match.</p>
          ) : (
            matches.map((user) => (
              <button
                key={user.id}
                type="button"
                className="hover:bg-muted flex w-full flex-col items-start px-2.5 py-1.5 text-left transition-colors"
                onClick={() => {
                  onSelect(user)
                  setSearch('')
                }}
              >
                <span className="text-sm font-medium">{user.display_name}</span>
                <span className="text-muted-foreground text-xs">{user.email}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
