import { useCallback, useMemo, useState } from 'react'
import type { OnChangeFn, RowSelectionState } from '@tanstack/table-core'

/**
 * Row selection for an admin table, owned by the PAGE (not the table) so the
 * page's bulk actions can read it. Pass the result to the table as
 * `selection`; the table wires `rowSelection`/`onRowSelectionChange` into
 * `useTable` and keys rows with `getRowId` (never the index).
 *
 * Selection is a controlled `{ [rowId]: true }` map, so it persists across
 * pagination on its own. `resetKeys` are the search/filter values that scope
 * the list: when any of them changes the selection is cleared, because a
 * selection made under one filter says nothing about the rows shown under
 * another.
 */
export interface TableSelection {
  rowSelection: RowSelectionState
  onRowSelectionChange: OnChangeFn<RowSelectionState>
  selectedIds: string[]
  count: number
  isSelected: (id: string) => boolean
  toggle: (id: string, value?: boolean) => void
  /** Drop specific ids (e.g. after acting on them) without touching the rest. */
  removeIds: (ids: string[]) => void
  clear: () => void
}

export function useTableSelection(resetKeys: readonly unknown[] = []): TableSelection {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  // Adjust state while rendering (React's documented pattern for "reset when
  // a prop changes") rather than in an effect — `react-hooks/set-state-in-effect`
  // rejects the effect version, and this avoids a frame with a stale selection.
  const signature = JSON.stringify(resetKeys)
  const [seenSignature, setSeenSignature] = useState(signature)
  if (signature !== seenSignature) {
    setSeenSignature(signature)
    setRowSelection({})
  }

  const selectedIds = useMemo(
    () => Object.keys(rowSelection).filter((id) => rowSelection[id]),
    [rowSelection],
  )

  const toggle = useCallback((id: string, value?: boolean) => {
    setRowSelection((old) => {
      const next = { ...old }
      const on = value ?? !old[id]
      if (on) next[id] = true
      else delete next[id]
      return next
    })
  }, [])

  const removeIds = useCallback((ids: string[]) => {
    setRowSelection((old) => {
      const next = { ...old }
      for (const id of ids) delete next[id]
      return next
    })
  }, [])

  const clear = useCallback(() => setRowSelection({}), [])

  return {
    rowSelection,
    onRowSelectionChange: setRowSelection,
    selectedIds,
    count: selectedIds.length,
    isSelected: (id) => !!rowSelection[id],
    toggle,
    removeIds,
    clear,
  }
}
