import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown, MoreHorizontal } from 'lucide-react'
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
  DropdownMenuSeparator,
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  SelectPageCheckbox,
  SelectRowCheckbox,
} from '@/components/admin/selection/SelectionCheckboxes'
import { TableSelectionBar } from '@/components/admin/selection/BulkActionBar'
import type { TableSelection } from '@/components/admin/selection/useTableSelection'
import type { TrashRow } from '@/hooks/admin/useTrash'

/**
 * One table for all six Trash tabs (the rows are normalised to `TrashRow`).
 * Same TanStack Table v9 shape as the other admin tables — static feature
 * registration, `columnHelper.columns([...])` — with search (name, context and
 * who trashed it), sorting, pagination and the shared multi-select.
 */
const trashFeatures = tableFeatures({
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

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

const columnHelper = createColumnHelper<typeof trashFeatures, TrashRow>()

/**
 * Row-action handlers reach the (stable) row menu through context instead of
 * being closed over by the column definitions. That is what lets the columns be
 * memoised: a column array rebuilt every render gives every cell a new render
 * function, TanStack's `FlexRender` treats that as a new component, and the
 * whole cell — including an open dropdown — remounts on any background refetch.
 */
interface RowActionHandlers {
  onRestore: (row: TrashRow) => void
  onDeletePermanently: (row: TrashRow) => void
}
const RowActionsContext = createContext<RowActionHandlers | null>(null)

function RowActions({ item }: { item: TrashRow }) {
  const handlers = useContext(RowActionsContext)
  if (!handlers) return null
  const blocker = item.restoreBlockedBy
  return (
    <div className="text-right">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${item.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {blocker ? (
            <Tooltip>
              {/* A disabled menu item swallows pointer events, so the tooltip
                  needs its own wrapper to hover. */}
              <TooltipTrigger asChild>
                <span className="block">
                  <DropdownMenuItem disabled onSelect={(e) => e.preventDefault()}>
                    Restore
                  </DropdownMenuItem>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Its {blocker.type} &ldquo;{blocker.title}&rdquo; is in the trash. Restore that first.
              </TooltipContent>
            </Tooltip>
          ) : (
            <DropdownMenuItem onSelect={() => handlers.onRestore(item)}>Restore</DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => handlers.onDeletePermanently(item)}>
            Delete permanently
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

interface TrashTableProps {
  rows: TrashRow[]
  isPending: boolean
  isError: boolean
  /** Singular noun for the empty states and labels: "course", "user" … */
  noun: string
  nameHeader: string
  search: string
  onRestore: (row: TrashRow) => void
  onDeletePermanently: (row: TrashRow) => void
  selection: TableSelection
  bulkActions?: ReactNode
}

function buildColumns({ noun, nameHeader }: Pick<TrashTableProps, 'noun' | 'nameHeader'>) {
  return columnHelper.columns([
    columnHelper.display({
      id: 'select',
      header: ({ table }) => (
        <SelectPageCheckbox table={table} label={`Select all ${noun}s on this page`} />
      ),
      cell: ({ row }) => <SelectRowCheckbox row={row} label={`Select ${row.original.name}`} />,
      enableSorting: false,
    }),
    columnHelper.accessor('name', {
      id: 'name',
      header: nameHeader,
      sortFn: 'text',
      cell: (info) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{info.getValue()}</p>
          {info.row.original.detail ? (
            <p className="text-muted-foreground truncate text-xs">{info.row.original.detail}</p>
          ) : null}
        </div>
      ),
    }),
    columnHelper.accessor('wasIn', {
      id: 'wasIn',
      header: 'Was in',
      sortFn: 'text',
      cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
    }),
    columnHelper.accessor('deletedAt', {
      id: 'deletedAt',
      header: 'Deleted at',
      sortFn: 'datetime',
      enableGlobalFilter: false,
      cell: (info) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {dateTimeFormatter.format(new Date(info.getValue()))}
        </span>
      ),
    }),
    columnHelper.accessor((row) => row.deletedBy ?? '', {
      id: 'deletedBy',
      header: 'Deleted by',
      sortFn: 'text',
      cell: (info) => (
        <span className="text-muted-foreground">{info.getValue() || 'Unknown'}</span>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => <RowActions item={row.original} />,
    }),
  ])
}

export function TrashTable({
  rows,
  isPending,
  isError,
  noun,
  nameHeader,
  search,
  onRestore,
  onDeletePermanently,
  selection,
  bulkActions,
}: TrashTableProps) {
  // `rowSelection` joins the state object without touching any other slice's
  // identity, so ticking a checkbox can't trigger the autoResetPageIndex bug.
  const state = useMemo(
    () => ({ globalFilter: search, rowSelection: selection.rowSelection }),
    [search, selection.rowSelection],
  )

  // Memoised (see RowActionsContext): stable columns keep open menus open.
  const columns = useMemo(() => buildColumns({ noun, nameHeader }), [noun, nameHeader])
  const actionHandlers = useMemo(
    () => ({ onRestore, onDeletePermanently }),
    [onRestore, onDeletePermanently],
  )

  const table = useTable({
    features: trashFeatures,
    columns,
    data: rows,
    globalFilterFn: 'includesString',
    getRowId: (row) => row.id,
    onRowSelectionChange: selection.onRowSelectionChange,
    state,
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
                  <p className="text-coral-d font-medium">Couldn&rsquo;t load the trash.</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Check your connection and try again.
                  </p>
                </TableCell>
              </TableRow>
            ) : visibleRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columnCount} className="h-28 text-center">
                  <p className="font-medium">
                    {rows.length === 0 ? `No ${noun}s in the trash` : `No ${noun}s match`}
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {rows.length === 0
                      ? `A ${noun} you move to trash will show up here.`
                      : 'Try a different search term.'}
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
      </div>
    </div>
    </RowActionsContext.Provider>
  )
}
