import { useMemo, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown, ExternalLink, MoreHorizontal } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_equalsString,
  filterFn_includesString,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
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
  DropdownMenuSeparator,
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
import { formatAmount } from '@/lib/currency'
import { cn } from '@/lib/utils'
import {
  lifecycleActionsFor,
  LIFECYCLE_LABEL,
  type Course,
  type LifecycleAction,
} from '@/hooks/admin/useCourses'
import {
  SelectPageCheckbox,
  SelectRowCheckbox,
} from '@/components/admin/selection/SelectionCheckboxes'
import { TableSelectionBar } from '@/components/admin/selection/BulkActionBar'
import type { TableSelection } from '@/components/admin/selection/useTableSelection'
import { useStableCallbacks } from '@/hooks/useStableCallbacks'
import { CourseStatusPill } from './CourseStatusPill'
import { dateFormatter } from '@/lib/adminConstants'

/**
 * TanStack Table v9 feature registration. Unlike v8 there is no
 * `getSortedRowModel()` passed as an option — feature modules and their row
 * model factories are stitched together statically here, and the resulting
 * object is handed to `useTable` as `features`. The `*Fns` registries make
 * their keys the valid string values for a column's `filterFn`/`sortFn`.
 *
 * Defined at module scope on purpose: it's static configuration, not state.
 */
const coursesFeatures = tableFeatures({
  columnFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  filterFns: {
    includesString: filterFn_includesString,
    equalsString: filterFn_equalsString,
  },
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
})

const columnHelper = createColumnHelper<typeof coursesFeatures, Course>()

interface CourseTableProps {
  courses: Course[]
  isPending: boolean
  isError: boolean
  search: string
  statusFilter: string
  onEdit: (course: Course) => void
  onLifecycle: (course: Course, action: LifecycleAction) => void
  /** Moves the course to the trash straight away — Undo toast instead of a confirm. */
  onTrash: (course: Course) => void
  selection: TableSelection
  bulkActions?: ReactNode
}

function buildColumns(
  onEdit: CourseTableProps['onEdit'],
  onLifecycle: CourseTableProps['onLifecycle'],
  onTrash: CourseTableProps['onTrash'],
) {
  return columnHelper.columns([
    columnHelper.display({
      id: 'select',
      header: ({ table }) => <SelectPageCheckbox table={table} label="Select all courses on this page" />,
      cell: ({ row }) => <SelectRowCheckbox row={row} label={`Select ${row.original.title}`} />,
      enableSorting: false,
    }),
    columnHelper.accessor('title', {
      id: 'title',
      header: 'Title',
      filterFn: 'includesString',
      sortFn: 'text',
      cell: (info) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{info.getValue()}</p>
          <p className="text-muted-foreground truncate text-xs">{info.row.original.slug}</p>
        </div>
      ),
    }),
    columnHelper.accessor('status', {
      id: 'status',
      header: 'Status',
      filterFn: 'equalsString',
      enableSorting: false,
      cell: (info) => <CourseStatusPill status={info.getValue()} />,
    }),
    columnHelper.display({
      id: 'pricing',
      header: 'Pricing',
      cell: ({ row }) =>
        row.original.is_free ? (
          <Badge variant="secondary">Free</Badge>
        ) : row.original.price_amount == null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="tabular-nums">
            {formatAmount(row.original.price_amount, row.original.currency)}
          </span>
        ),
    }),
    columnHelper.accessor('total_students', {
      id: 'total_students',
      header: 'Students',
      sortFn: 'basic',
      cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
    }),
    columnHelper.accessor('total_lessons', {
      id: 'total_lessons',
      header: 'Lessons',
      sortFn: 'basic',
      cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
    }),
    columnHelper.accessor('created_at', {
      id: 'created_at',
      header: 'Created',
      sortFn: 'datetime',
      cell: (info) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {dateFormatter.format(new Date(info.getValue()))}
        </span>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const course = row.original
        const actions = lifecycleActionsFor(course.status)
        return (
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Actions for ${course.title}`}
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              {/* Archive is a status (reversible); Move to trash hides the
                  course from everything and is undone from the Trash page or
                  the toast. Neither deletes: only the Trash page can. */}
              <DropdownMenuContent align="end">
                {/* Opens the student page in a new tab, for every status. A real
                    link (relative, typed route) rather than window.open, so it
                    works on localhost, over the LAN and in production, and
                    middle-click / keyboard behave like any link. An admin who
                    isn't enrolled sees the not-enrolled screen there — by design
                    for now (routes-permissions.md). */}
                <DropdownMenuItem asChild>
                  <Link
                    to="/courses/$courseId"
                    params={{ courseId: course.slug }}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`View course: ${course.title} (opens in a new tab)`}
                  >
                    <ExternalLink />
                    View course
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onEdit(course)}>Edit</DropdownMenuItem>
                {actions.length > 0 ? <DropdownMenuSeparator /> : null}
                {actions.map((action) => (
                  <DropdownMenuItem key={action} onSelect={() => onLifecycle(course, action)}>
                    {LIFECYCLE_LABEL[action]}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onTrash(course)}>Move to trash</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    }),
  ])
}

const COLUMN_COUNT = 8

export function CourseTable({
  courses,
  isPending,
  isError,
  search,
  statusFilter,
  onEdit,
  onLifecycle,
  onTrash,
  selection,
  bulkActions,
}: CourseTableProps) {
  // Memoised because the filtered row model compares these by *reference*: a
  // fresh array/object each render reads as "the filters changed" and fires
  // the model's autoResetPageIndex, pinning the table to page 1. See
  // `ui.md` — this was caught live on the users list.
  const columnFilters = useMemo(
    () => [
      ...(search ? [{ id: 'title', value: search }] : []),
      ...(statusFilter !== 'all' ? [{ id: 'status', value: statusFilter }] : []),
    ],
    [search, statusFilter],
  )
  const state = useMemo(
    () => ({ columnFilters, rowSelection: selection.rowSelection }),
    [columnFilters, selection.rowSelection],
  )

  const handlers = useStableCallbacks({ onEdit, onLifecycle, onTrash })
  const columns = useMemo(
    () => buildColumns(handlers.onEdit, handlers.onLifecycle, handlers.onTrash),
    [handlers],
  )

  const table = useTable({
    features: coursesFeatures,
    columns,
    data: courses,
    getRowId: (course) => course.id,
    onRowSelectionChange: selection.onRowSelectionChange,
    // Filters are driven from the page's toolbar rather than per-column UI,
    // so they're passed straight in as controlled state.
    state,
  })

  const rows = table.getRowModel().rows
  const pageCount = table.getPageCount()

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
                  <p className="text-coral-d font-medium">Couldn&rsquo;t load courses.</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Check your connection and try again.
                  </p>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT} className="h-28 text-center">
                  <p className="font-medium">
                    {courses.length === 0 ? 'No courses yet' : 'No courses match'}
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {courses.length === 0
                      ? 'Create your first course to get started.'
                      : 'Try a different search or status filter.'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getAllCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(cell.column.id === 'title' && 'max-w-xs')}
                    >
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
