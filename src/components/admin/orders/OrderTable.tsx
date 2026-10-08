import { useMemo, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown, MoreHorizontal } from 'lucide-react'
import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_equalsString,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
} from '@tanstack/table-core'
import { useTable } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  SelectPageCheckbox,
  SelectRowCheckbox,
} from '@/components/admin/selection/SelectionCheckboxes'
import { TableSelectionBar } from '@/components/admin/selection/BulkActionBar'
import type { TableSelection } from '@/components/admin/selection/useTableSelection'
import { useStableCallbacks } from '@/hooks/useStableCallbacks'
import { formatAmount } from '@/lib/currency'
import type { PaymentRow } from '@/hooks/admin/usePayments'
import { PaymentStatusPill } from './PaymentStatusPill'
import { ReconciliationStatusPill } from './ReconciliationStatusPill'
import { dateTimeFormatter } from '@/lib/adminConstants'
import { getTerms as tw } from '@/lib/settings/terms'

/**
 * Same TanStack Table v9 feature registration as `CourseTable.tsx`/
 * `GameTable.tsx`/`UserTable.tsx` — see `CourseTable.tsx`'s comment for why
 * this shape looks the way it does (v9's static feature-module wiring, no
 * `getSortedRowModel()` option like v8). No `globalFilteringFeature` here —
 * this table has no search box, only the two status filters below.
 *
 * `rowSelectionFeature` needs no row-model factory of its own (unlike
 * filtering/sorting/pagination) — its select-all and "is all selected"
 * getters read straight off whatever row model is already registered
 * (`getFilteredRowModel()` for "all"/"some", `getPaginatedRowModel()` for
 * "all on this page", which this table doesn't use). Verified against the
 * installed v9 source before writing this — v9's shape here (an ID map in
 * `state.rowSelection`, `getIsAllRowsSelected`/`getFilteredSelectedRowModel`
 * as table-level getters) matches v8's `rowSelection` closely enough that
 * assuming parity would have been *mostly* safe, but "mostly" is exactly
 * why this got checked rather than assumed, same as sorting/filtering were.
 */
const ordersFeatures = tableFeatures({
  columnFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  filterFns: {
    equalsString: filterFn_equalsString,
  },
  sortFns: {
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
})

const columnHelper = createColumnHelper<typeof ordersFeatures, PaymentRow>()

interface OrderTableProps {
  payments: PaymentRow[]
  isPending: boolean
  isError: boolean
  statusFilter: string
  reconciliationFilter: string
  /** Which row set this is — decides the Trashed-on column and which row actions are on offer. */
  view: 'active' | 'trash'
  onView: (payment: PaymentRow) => void
  /** Active view only — opens the (small) trash confirmation for this one row. */
  onTrash: (payment: PaymentRow) => void
  /** Trash view only — restores immediately, no confirmation (see ui.md/state.md for why). */
  onRestore: (payment: PaymentRow) => void
  /** Trash view only — opens the strong permanent-delete confirmation for this one row. */
  onDeletePermanently: (payment: PaymentRow) => void
  selection: TableSelection
  /** Context actions for the shared bulk bar, supplied by the page. */
  bulkActions?: ReactNode
}

type RowActionHandlers = Pick<
  OrderTableProps,
  'view' | 'onView' | 'onTrash' | 'onRestore' | 'onDeletePermanently'
>

function buildColumns({ view, onView, onTrash, onRestore, onDeletePermanently }: RowActionHandlers) {
  return columnHelper.columns([
    columnHelper.display({
      id: 'select',
      // The shared selection kit (`components/admin/selection`): the header
      // box is scoped to the CURRENT PAGE, and "Select all N matching" for the
      // whole filtered set lives in the bulk bar.
      header: ({ table }) => (
        <SelectPageCheckbox table={table} label="Select all orders on this page" />
      ),
      cell: ({ row }) => (
        <SelectRowCheckbox
          row={row}
          label={`Select payment ${row.original.provider_payment_id}`}
        />
      ),
      enableSorting: false,
    }),
    columnHelper.accessor('received_at', {
      id: 'received_at',
      header: 'Received',
      sortFn: 'datetime',
      cell: (info) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {dateTimeFormatter.format(new Date(info.getValue()))}
        </span>
      ),
    }),
    columnHelper.display({
      id: 'user',
      header: 'User',
      // Unclaimed (user_id null) is a real, expected state — a payment can
      // arrive before its buyer signs up — not an error, hence a plain
      // outline badge rather than a warning tone.
      cell: ({ row }) => {
        const { profiles, email } = row.original
        if (profiles?.display_name) {
          return <span className="font-medium">{profiles.display_name}</span>
        }
        return (
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="text-muted-foreground truncate">{email}</span>
            <Badge variant="outline" className="shrink-0">
              Unclaimed
            </Badge>
          </div>
        )
      },
    }),
    columnHelper.display({
      id: 'course',
      header: `${tw().term('course')}`,
      cell: ({ row }) => (
        <span className="truncate">{row.original.courses?.title ?? '—'}</span>
      ),
    }),
    columnHelper.accessor('amount', {
      id: 'amount',
      header: 'Amount',
      sortFn: 'basic',
      cell: (info) => (
        <span className="tabular-nums">
          {formatAmount(info.getValue(), info.row.original.currency)}
        </span>
      ),
    }),
    columnHelper.accessor('provider', {
      id: 'provider',
      header: 'Provider',
      cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
    }),
    columnHelper.accessor('status', {
      id: 'status',
      header: 'Status',
      filterFn: 'equalsString',
      enableSorting: false,
      cell: (info) => <PaymentStatusPill status={info.getValue()} />,
    }),
    columnHelper.accessor('reconciliation_status', {
      id: 'reconciliation_status',
      header: 'Reconciliation',
      filterFn: 'equalsString',
      enableSorting: false,
      cell: (info) => <ReconciliationStatusPill status={info.getValue()} />,
    }),
    // Trash-only column — `deleted_at` is meaningless (always null) in the
    // Active view, so it's added conditionally rather than always present
    // and blank.
    ...(view === 'trash'
      ? [
          columnHelper.accessor('deleted_at', {
            id: 'deleted_at',
            header: 'Trashed on',
            sortFn: 'datetime',
            cell: (info) => {
              const value = info.getValue()
              return (
                <span className="text-muted-foreground whitespace-nowrap">
                  {value ? dateTimeFormatter.format(new Date(value)) : '—'}
                </span>
              )
            },
          }),
        ]
      : []),
    columnHelper.display({
      id: 'actions',
      header: '',
      // A second per-row action (Move to Trash / Restore + Delete
      // Permanently) is exactly the "reach for a DropdownMenu once a
      // second action exists" threshold this file's own convention already
      // names — a single Eye icon was fine when viewing details was the
      // only thing a row could do.
      cell: ({ row }) => (
        <div className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Actions for payment ${row.original.provider_payment_id}`}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {view === 'active' ? (
                <>
                  <DropdownMenuItem onSelect={() => onView(row.original)}>
                    View details
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onTrash(row.original)}>
                    Move to Trash
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem onSelect={() => onRestore(row.original)}>
                    Restore
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => onDeletePermanently(row.original)}
                  >
                    Delete Permanently
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    }),
  ])
}

const BASE_COLUMN_COUNT = 9

export function OrderTable({
  payments,
  isPending,
  isError,
  statusFilter,
  reconciliationFilter,
  view,
  onView,
  onTrash,
  onRestore,
  onDeletePermanently,
  selection,
  bulkActions,
}: OrderTableProps) {
  const columnCount = view === 'trash' ? BASE_COLUMN_COUNT + 1 : BASE_COLUMN_COUNT
  // Memoised separately from `rowSelection` below, on purpose: toggling a
  // checkbox must not produce a new `columnFilters` array reference, or the
  // filtered row model reads that as "the filters changed" and resets to
  // page 1 — the exact bug this file's own comment already warns about, just
  // one field over. `state` itself composes the two, so it's a fresh object
  // every render either of its inputs changes, but each field individually
  // keeps its identity unless what it actually represents changed.
  const columnFilters = useMemo(
    () => [
      ...(statusFilter !== 'all' ? [{ id: 'status', value: statusFilter }] : []),
      ...(reconciliationFilter !== 'all'
        ? [{ id: 'reconciliation_status', value: reconciliationFilter }]
        : []),
    ],
    [statusFilter, reconciliationFilter],
  )
  const state = useMemo(
    () => ({ columnFilters, rowSelection: selection.rowSelection }),
    [columnFilters, selection.rowSelection],
  )

  const handlers = useStableCallbacks({ onView, onTrash, onRestore, onDeletePermanently })
  const columns = useMemo(() => buildColumns({ view, ...handlers }), [view, handlers])

  const table = useTable({
    features: ordersFeatures,
    columns,
    data: payments,
    state,
    // Payment ids are stable and unique — selection must key off these, not
    // the default index-into-`data` id, so a selected set survives a filter
    // change or a refetch reordering rows rather than silently pointing at
    // whatever row now happens to sit at that index.
    getRowId: (payment) => payment.id,
    onRowSelectionChange: selection.onRowSelectionChange,
  })

  const rows = table.getRowModel().rows
  const pageCount = table.getPageCount()
  const isFiltered = statusFilter !== 'all' || reconciliationFilter !== 'all'

  return (
    <div className="space-y-3">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  return (
                    <TableHead key={header.id}>
                      {canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="hover:text-foreground -mx-1 flex items-center gap-1 rounded px-1 py-0.5 transition-colors"
                        >
                          <table.FlexRender header={header} />
                          {sorted === 'asc' ? (
                            <ArrowUp className="size-3.5" />
                          ) : sorted === 'desc' ? (
                            <ArrowDown className="size-3.5" />
                          ) : (
                            <ChevronsUpDown className="size-3.5 opacity-40" />
                          )}
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isPending ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={columnCount}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={columnCount} className="h-28 text-center">
                  <p className="text-coral-d font-medium">Couldn&rsquo;t load orders.</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Check your connection and try again.
                  </p>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columnCount} className="h-28 text-center">
                  <p className="font-medium">
                    {payments.length === 0
                      ? view === 'trash'
                        ? 'Trash is empty'
                        : 'No orders yet'
                      : 'No orders match'}
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {payments.length === 0
                      ? view === 'trash'
                        ? 'Orders moved to Trash will show up here.'
                        : 'Payments will show up here once the first purchase comes through.'
                      : isFiltered
                        ? 'Try a different status or reconciliation filter.'
                        : 'Try a different filter.'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <TableSelectionBar table={table} selection={selection}>
        {bulkActions}
      </TableSelectionBar>

      {pageCount > 1 ? (
        <div className="flex items-center justify-end gap-2">
          <span className="text-muted-foreground text-sm tabular-nums">
            Page {table.state.pagination.pageIndex + 1} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  )
}
