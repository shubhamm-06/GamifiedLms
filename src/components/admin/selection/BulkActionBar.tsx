import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import type { TableSelection } from './useTableSelection'

interface BulkActionBarProps {
  count: number
  onClear: () => void
  /** Size of the whole filtered set. Offers "Select all N matching" when larger than the selection. */
  matchingCount?: number
  onSelectAllMatching?: () => void
  /** Context actions, passed in by the page (Move to trash, Restore, …). */
  children?: ReactNode
}

/**
 * Sticky bar shown while at least one row is selected: "N selected", Clear,
 * the optional "Select all N matching", then whatever actions the page
 * supplies. It renders nothing when the selection is empty.
 */
export function BulkActionBar({
  count,
  onClear,
  matchingCount,
  onSelectAllMatching,
  children,
}: BulkActionBarProps) {
  if (count === 0) return null

  const canSelectAll = onSelectAllMatching && matchingCount !== undefined && matchingCount > count

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="bg-background sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-2.5 shadow-lg"
    >
      <span className="text-sm font-medium tabular-nums" aria-live="polite">
        {count} selected
      </span>
      <Button variant="ghost" size="sm" onClick={onClear}>
        Clear
      </Button>
      {canSelectAll ? (
        <Button variant="link" size="sm" onClick={onSelectAllMatching}>
          Select all {matchingCount} matching
        </Button>
      ) : null}
      <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

/** The slice of a v9 table instance the bar needs to offer "Select all N matching". */
interface FilterableTable {
  getFilteredRowModel: () => { rows: readonly unknown[] }
  toggleAllRowsSelected: (value?: boolean) => void
}

/**
 * `BulkActionBar` wired to a table + its `TableSelection`, so every table
 * drops in one line. "Select all N matching" selects the whole FILTERED set
 * (v9's `toggleAllRowsSelected` reads the filtered row model), not just the
 * visible page.
 */
export function TableSelectionBar({
  table,
  selection,
  children,
}: {
  table: FilterableTable
  selection: TableSelection
  children?: ReactNode
}) {
  return (
    <BulkActionBar
      count={selection.count}
      onClear={selection.clear}
      matchingCount={table.getFilteredRowModel().rows.length}
      onSelectAllMatching={() => table.toggleAllRowsSelected(true)}
    >
      {children}
    </BulkActionBar>
  )
}
