import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown, MoreHorizontal, Trash2 } from 'lucide-react'
import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
} from '@tanstack/table-core'
import { useTable } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { deliveryLabel, targetLabel, type NotificationHistoryRow } from '@/hooks/admin/useNotifications'
import { dateTimeFormatter } from '@/lib/adminConstants'

/**
 * The notification send history: same TanStack Table v9 shape as `TrashTable`
 * (search, sort, pagination, the shared multi-select) — search, sort and
 * pagination are client-side (the table is capped at 100 rows, `useNotifications.ts`).
 * The only row action is "Move to trash", which always goes through
 * `TrashNotificationDialog` first (never immediate) — everything else here
 * is view-only history.
 */
const historyFeatures = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  filterFns: { includesString: filterFn_includesString },
  sortFns: { datetime: sortFn_datetime, text: sortFn_text },
})

const PAGE_SIZES = [10, 25, 50, 100]

const columnHelper = createColumnHelper<typeof historyFeatures, NotificationHistoryRow>()

// Same reasoning as TrashTable's RowActionsContext: row-action handlers reach the
// row menu through context so the column array (and its render functions) can stay
// memoised across background refetches.
interface RowActionHandlers {
  onTrash: (row: NotificationHistoryRow) => void
}
const RowActionsContext = createContext<RowActionHandlers | null>(null)

function RowActions({ item }: { item: NotificationHistoryRow }) {
  const handlers = useContext(RowActionsContext)
  if (!handlers) return null
  return (
    <div className="text-right">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${item.title}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" onSelect={() => handlers.onTrash(item)}>
            <Trash2 /> Move to trash
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function buildColumns() {
  return columnHelper.columns([
    columnHelper.display({
      id: 'select',
      header: ({ table }) => <SelectPageCheckbox table={table} label="Select all notifications on this page" />,
      cell: ({ row }) => <SelectRowCheckbox row={row} label={`Select ${row.original.title}`} />,
      enableSorting: false,
    }),
    columnHelper.accessor('title', {
      id: 'title',
      header: 'Title',
      sortFn: 'text',
      cell: (info) => (
        <div className="min-w-0 max-w-xs">
          <p className="truncate font-medium">{info.getValue()}</p>
          <p className="text-muted-foreground truncate text-xs">{info.row.original.body}</p>
        </div>
      ),
    }),
    columnHelper.display({
      id: 'target',
      header: 'Target',
      cell: (info) => <span>{targetLabel(info.row.original)}</span>,
    }),
    columnHelper.display({
      id: 'delivery',
      header: 'Delivery',
      cell: (info) => {
        const row = info.row.original
        return (
          <div>
            <span>{deliveryLabel(row)}</span>
            {row.recipient_count !== null ? (
              <span className="text-muted-foreground block text-xs">
                {row.recipient_count} recipient{row.recipient_count === 1 ? '' : 's'}
              </span>
            ) : null}
          </div>
        )
      },
    }),
    columnHelper.accessor((row) => row.sent_by_name ?? '', {
      id: 'sentBy',
      header: 'Sent by',
      sortFn: 'text',
      cell: (info) => <span className="text-muted-foreground">{info.getValue() || 'Unknown'}</span>,
    }),
    columnHelper.accessor('sent_at', {
      id: 'sentAt',
      header: 'Sent at',
      sortFn: 'datetime',
      enableGlobalFilter: false,
      cell: (info) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {dateTimeFormatter.format(new Date(info.getValue()))}
        </span>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => <RowActions item={row.original} />,
    }),
  ])
}

interface NotificationsHistoryTableProps {
  rows: NotificationHistoryRow[]
  isPending: boolean
  isError: boolean
  search: string
  onTrash: (row: NotificationHistoryRow) => void
  selection: TableSelection
  bulkActions?: ReactNode
}

export function NotificationsHistoryTable({
  rows,
  isPending,
  isError,
  search,
  onTrash,
  selection,
  bulkActions,
}: NotificationsHistoryTableProps) {
  const state = useMemo(
    () => ({ globalFilter: search, rowSelection: selection.rowSelection }),
    [search, selection.rowSelection],
  )
  const columns = useMemo(() => buildColumns(), [])
  const actionHandlers = useMemo(() => ({ onTrash }), [onTrash])

  const table = useTable({
    features: historyFeatures,
    columns,
    data: rows,
    globalFilterFn: 'includesString',
    getRowId: (row) => row.id,
    onRowSelectionChange: selection.onRowSelectionChange,
    state,
    initialState: { pagination: { pageIndex: 0, pageSize: 25 } },
  })

  const visibleRows = table.getRowModel().rows
  const pageCount = table.getPageCount()
  const filteredCount = table.getFilteredRowModel().rows.length
  const { pageIndex, pageSize } = table.state.pagination
  const columnCount = table.getAllLeafColumns().length
  const rangeStart = filteredCount === 0 ? 0 : pageIndex * pageSize + 1
  const rangeEnd = Math.min((pageIndex + 1) * pageSize, filteredCount)

  return (
    <RowActionsContext.Provider value={actionHandlers}>
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
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={columnCount}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={columnCount} className="h-28 text-center">
                    <p className="text-coral-d font-medium">Couldn&rsquo;t load notification history.</p>
                    <p className="text-muted-foreground mt-1 text-sm">Check your connection and try again.</p>
                  </TableCell>
                </TableRow>
              ) : visibleRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columnCount} className="h-28 text-center">
                    <p className="font-medium">{rows.length === 0 ? 'No notifications sent yet' : 'No notifications match'}</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {rows.length === 0 ? 'Notifications you send will show up here.' : 'Try a different search term.'}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                visibleRows.map((row) => (
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

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <p className="text-muted-foreground text-sm">
              {filteredCount === 0 ? 'No results' : `Showing ${rangeStart}–${rangeEnd} of ${filteredCount}`}
            </p>
            <Select value={String(pageSize)} onValueChange={(value) => table.setPageSize(Number(value))}>
              <SelectTrigger size="sm" className="w-[110px]" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size} / page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm tabular-nums">
              Page {pageIndex + 1} of {Math.max(1, pageCount)}
            </span>
            <Button variant="outline" size="sm" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
              Next
            </Button>
          </div>
        </div>
      </div>
    </RowActionsContext.Provider>
  )
}
