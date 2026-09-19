import { useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ExportUsersMenuProps {
  selectedCount: number
  filteredCount: number
  isExporting: boolean
  onExport: (scope: 'selected' | 'filtered' | 'all', includeTrashed: boolean) => void
}

/**
 * The page-level Export button: selected rows, the current filtered results,
 * or every user, plus an "Include trashed users" toggle. Trashed users are left
 * out unless it is ticked; it doesn't apply to "Selected rows", since a trashed
 * user can't be ticked in the list.
 */
export function ExportUsersMenu({
  selectedCount,
  filteredCount,
  isExporting,
  onExport,
}: ExportUsersMenuProps) {
  const [includeTrashed, setIncludeTrashed] = useState(false)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={isExporting}>
          <Download />
          {isExporting ? 'Exporting…' : 'Export'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem
          disabled={selectedCount === 0}
          onSelect={() => onExport('selected', includeTrashed)}
        >
          Selected rows
          <span className="text-muted-foreground ml-auto tabular-nums">{selectedCount}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onExport('filtered', includeTrashed)}>
          Current filtered results
          <span className="text-muted-foreground ml-auto tabular-nums">{filteredCount}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onExport('all', includeTrashed)}>All users</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={includeTrashed}
          onCheckedChange={setIncludeTrashed}
          // Toggling an option shouldn't close the menu and lose the choice.
          onSelect={(e) => e.preventDefault()}
        >
          Include trashed users
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
