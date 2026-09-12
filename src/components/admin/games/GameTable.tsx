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
import type { Game } from '@/hooks/admin/useGames'

/**
 * Same TanStack Table v9 feature registration as `CourseTable.tsx` — see that
 * file's comment for why this shape looks the way it does (v9's static
 * feature-module wiring, no `getSortedRowModel()` option like v8).
 */
const gamesFeatures = tableFeatures({
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
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
})

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

const columnHelper = createColumnHelper<typeof gamesFeatures, Game>()

interface GameTableProps {
  games: Game[]
  isPending: boolean
  isError: boolean
  search: string
  onEdit: (game: Game) => void
  onDelete: (game: Game) => void
}

function buildColumns(onEdit: GameTableProps['onEdit'], onDelete: GameTableProps['onDelete']) {
  return columnHelper.columns([
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
    columnHelper.accessor('max_xp', {
      id: 'max_xp',
      header: 'Max XP',
      sortFn: 'basic',
      cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
    }),
    columnHelper.accessor('bundle_version', {
      id: 'bundle_version',
      header: 'Bundle version',
      sortFn: 'text',
      cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
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
        const game = row.original
        return (
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${game.title}`}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => onEdit(game)}>Edit</DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => onDelete(game)}>
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

const COLUMN_COUNT = 5

export function GameTable({ games, isPending, isError, search, onEdit, onDelete }: GameTableProps) {
  const table = useTable({
    features: gamesFeatures,
    columns: buildColumns(onEdit, onDelete),
    data: games,
    state: {
      columnFilters: [...(search ? [{ id: 'title', value: search }] : [])],
    },
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
                  <p className="text-coral-d font-medium">Couldn&rsquo;t load games.</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Check your connection and try again.
                  </p>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT} className="h-28 text-center">
                  <p className="font-medium">
                    {games.length === 0 ? 'No games yet' : 'No games match'}
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {games.length === 0
                      ? 'Add your first game to get started.'
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
