import { useMemo } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown, Eye } from 'lucide-react'
import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_equalsString,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
} from '@tanstack/table-core'
import { useTable } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatAmount } from '@/lib/currency'
import type { PaymentRow } from '@/hooks/admin/usePayments'
import { PaymentStatusPill } from './PaymentStatusPill'
import { ReconciliationStatusPill } from './ReconciliationStatusPill'

/**
 * Same TanStack Table v9 feature registration as `CourseTable.tsx`/
 * `GameTable.tsx`/`UserTable.tsx` — see `CourseTable.tsx`'s comment for why
 * this shape looks the way it does (v9's static feature-module wiring, no
 * `getSortedRowModel()` option like v8). No `globalFilteringFeature` here —
 * this table has no search box, only the two status filters below.
 */
const ordersFeatures = tableFeatures({
  columnFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
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

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

const columnHelper = createColumnHelper<typeof ordersFeatures, PaymentRow>()

interface OrderTableProps {
  payments: PaymentRow[]
  isPending: boolean
  isError: boolean
  statusFilter: string
  reconciliationFilter: string
  onView: (payment: PaymentRow) => void
}

function buildColumns(onView: OrderTableProps['onView']) {
  return columnHelper.columns([
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
      header: 'Course',
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
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="text-right">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`View payment ${row.original.provider_payment_id}`}
            onClick={() => onView(row.original)}
          >
            <Eye />
          </Button>
        </div>
      ),
    }),
  ])
}

const COLUMN_COUNT = 8

export function OrderTable({
  payments,
  isPending,
  isError,
  statusFilter,
  reconciliationFilter,
  onView,
}: OrderTableProps) {
  // Memoised — the filtered row model compares `state` by reference, and a
  // fresh literal each render fires autoResetPageIndex, pinning the table
  // to page 1. See ui.md; this bug has already been caught (and fixed)
  // three times over on the other admin tables — don't reintroduce it here.
  const state = useMemo(
    () => ({
      columnFilters: [
        ...(statusFilter !== 'all' ? [{ id: 'status', value: statusFilter }] : []),
        ...(reconciliationFilter !== 'all'
          ? [{ id: 'reconciliation_status', value: reconciliationFilter }]
          : []),
      ],
    }),
    [statusFilter, reconciliationFilter],
  )

  const table = useTable({
    features: ordersFeatures,
    columns: buildColumns(onView),
    data: payments,
    state,
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
                  <TableCell colSpan={COLUMN_COUNT}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT} className="h-28 text-center">
                  <p className="text-coral-d font-medium">Couldn&rsquo;t load orders.</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Check your connection and try again.
                  </p>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT} className="h-28 text-center">
                  <p className="font-medium">
                    {payments.length === 0 ? 'No orders yet' : 'No orders match'}
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {payments.length === 0
                      ? 'Payments will show up here once the first purchase comes through.'
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
