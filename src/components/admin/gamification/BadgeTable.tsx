import { useMemo } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown, MoreHorizontal } from 'lucide-react'
import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_basic,
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
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { CONDITION_TYPES, isConditionType, type Badge } from '@/hooks/admin/useBadges'

/** Same TanStack Table v9 feature registration as `GameTable.tsx` — see `CourseTable.tsx`'s comment for why it looks this way. */
const badgesFeatures = tableFeatures({
  columnFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  filterFns: {
    includesString: filterFn_includesString,
  },
  sortFns: {
    basic: sortFn_basic,
    text: sortFn_text,
  },
})

const columnHelper = createColumnHelper<typeof badgesFeatures, Badge>()

interface BadgeTableProps {
  badges: Badge[]
  isPending: boolean
  isError: boolean
  search: string
  onEdit: (badge: Badge) => void
  onToggleActive: (badge: Badge) => void
  onDelete: (badge: Badge) => void
}

function buildColumns({
  onEdit,
  onToggleActive,
  onDelete,
}: Pick<BadgeTableProps, 'onEdit' | 'onToggleActive' | 'onDelete'>) {
  return columnHelper.columns([
    columnHelper.accessor('name', {
      id: 'name',
      header: 'Badge',
      filterFn: 'includesString',
      sortFn: 'text',
      cell: (info) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{info.getValue()}</p>
          <p className="text-muted-foreground truncate text-xs">{info.row.original.slug}</p>
        </div>
      ),
    }),
    columnHelper.accessor('condition_value', {
      id: 'condition',
      header: 'Unlocks at',
      sortFn: 'basic',
      cell: (info) => {
        const { condition_type: type, condition_value: value } = info.row.original
        return (
          <span className="text-muted-foreground">
            {isConditionType(type) ? CONDITION_TYPES[type].valueLabel : type}:{' '}
            <span className="text-foreground tabular-nums">{value}</span>
          </span>
        )
      },
    }),
    columnHelper.accessor('is_active', {
      id: 'is_active',
      header: 'Status',
      enableSorting: false,
      // teal = active, per the admin colour rules in ui.md; inactive is a
      // quiet neutral, not a warning — a deactivated badge is a deliberate
      // admin choice, not a problem to fix.
      cell: (info) => (
        <span
          className={cn(
            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
            info.getValue() ? 'bg-teal/10 text-teal-d' : 'bg-muted text-muted-foreground',
          )}
        >
          {info.getValue() ? 'Active' : 'Inactive'}
        </span>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const badge = row.original
        return (
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${badge.name}`}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => onEdit(badge)}>Edit</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onToggleActive(badge)}>
                  {badge.is_active ? 'Deactivate' : 'Activate'}
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => onDelete(badge)}>
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    }),
  ])
}

const COLUMN_COUNT = 4

export function BadgeTable({
  badges,
  isPending,
  isError,
  search,
  onEdit,
  onToggleActive,
  onDelete,
}: BadgeTableProps) {
  // Memoised — the filtered row model compares `state` by reference; see
  // ui.md's stable-identity rule.
  const state = useMemo(
    () => ({ columnFilters: [...(search ? [{ id: 'name', value: search }] : [])] }),
    [search],
  )

  const table = useTable({
    features: badgesFeatures,
    columns: buildColumns({ onEdit, onToggleActive, onDelete }),
    data: badges,
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
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={COLUMN_COUNT}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT} className="h-28 text-center">
                  <p className="text-coral-d font-medium">Couldn&rsquo;t load badges.</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Check your connection and try again.
                  </p>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT} className="h-28 text-center">
                  <p className="font-medium">
                    {badges.length === 0 ? 'No badges yet' : 'No badges match'}
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {badges.length === 0
                      ? 'Add your first badge to get started.'
                      : 'Try a different search.'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getAllCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(cell.column.id === 'name' && 'max-w-xs')}
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
