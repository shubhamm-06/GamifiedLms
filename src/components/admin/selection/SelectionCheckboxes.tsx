import { Checkbox } from '@/components/ui/checkbox'

/** The slice of a TanStack Table v9 instance the header checkbox needs. */
interface PageSelectableTable {
  getIsAllPageRowsSelected: () => boolean
  getIsSomePageRowsSelected: () => boolean
  toggleAllPageRowsSelected: (value?: boolean) => void
}

/** The slice of a v9 row the row checkbox needs. */
interface SelectableRow {
  getIsSelected: () => boolean
  toggleSelected: (value?: boolean) => void
}

/**
 * Header checkbox: checked when every row on the CURRENT PAGE is selected,
 * indeterminate when only some are. Clicking an indeterminate box selects the
 * page (Radix hands `true` to `onCheckedChange`), the same as a native
 * indeterminate input. "Select all N matching" (the whole filtered set, not
 * just this page) lives in the bulk bar, not here.
 */
export function SelectPageCheckbox({
  table,
  label = 'Select all rows on this page',
}: {
  table: PageSelectableTable
  label?: string
}) {
  const all = table.getIsAllPageRowsSelected()
  const some = table.getIsSomePageRowsSelected()
  return (
    <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <Checkbox
        checked={all ? true : some ? 'indeterminate' : false}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(value === true)}
        aria-label={label}
      />
    </span>
  )
}

/**
 * Per-row checkbox. The wrapper swallows click and key events so a table whose
 * rows are links (`UserTable` navigates on row click and on Enter) doesn't also
 * navigate when the checkbox is toggled — Space toggles, Enter must not bubble.
 */
export function SelectRowCheckbox({ row, label }: { row: SelectableRow; label: string }) {
  return (
    <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(value === true)}
        aria-label={label}
      />
    </span>
  )
}
