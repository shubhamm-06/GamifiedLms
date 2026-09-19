import { useMemo, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown, MoreHorizontal } from 'lucide-react'
import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_equalsString,
  filterFn_includesString,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
} from '@tanstack/table-core'
import { useTable } from '@tanstack/react-table'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
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
import { useStableCallbacks } from '@/hooks/useStableCallbacks'
import type { AdminUserRow, RoleFilter } from '@/hooks/admin/useUsers'
import { PRIMARY_ADMIN_ID } from '@/lib/adminConstants'

/**
 * TanStack Table v9 feature registration — see `context.md` for why this is
 * static wiring rather than v8's `getSortedRowModel()` options, and
 * `CourseTable.tsx` for the same shape.
 *
 * `globalFilteringFeature` is what backs the search box: one input matching
 * across two columns, which a per-column filter can't express. The filtered
 * row model applies both it and the role column filter.
 */
const usersFeatures = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
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
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
})

const PAGE_SIZES = [10, 25, 50, 100]

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function initialsOf(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function RoleBadge({ role }: { role: string }) {
  const isAdmin = role === 'admin'
  return (
    <Badge
      className="border-transparent font-semibold"
      style={
        isAdmin
          ? { backgroundColor: 'var(--gold)', color: 'var(--ink)' }
          : { backgroundColor: 'var(--teal)', color: '#ffffff' }
      }
    >
      {isAdmin ? 'Admin' : 'Student'}
    </Badge>
  )
}

const columnHelper = createColumnHelper<typeof usersFeatures, AdminUserRow>()

interface UserTableProps {
  rows: AdminUserRow[]
  isPending: boolean
  isError: boolean
  /** Matched against name and email; owned by the page toolbar. */
  search: string
  roleFilter: RoleFilter
  /** Clicking anywhere in a row except the actions cell navigates to the detail page. */
  onRowClick: (user: AdminUserRow) => void
  onEdit: (user: AdminUserRow) => void
  onChangeEmail: (user: AdminUserRow) => void
  onResetPassword: (user: AdminUserRow) => void
  /** Opens the (lightweight) move-to-trash confirm — trashing bans the user and signs them out. */
  onTrash: (user: AdminUserRow) => void
  /** The signed-in admin: their own row can't be trashed. */
  currentUserId: string | undefined
  selection: TableSelection
  /** Context actions for the bulk bar, supplied by the page. */
  bulkActions?: ReactNode
}

function buildColumns({
  onEdit,
  onChangeEmail,
  onResetPassword,
  onTrash,
  currentUserId,
}: Pick<
  UserTableProps,
  'onEdit' | 'onChangeEmail' | 'onResetPassword' | 'onTrash' | 'currentUserId'
>) {
  return columnHelper.columns([
    columnHelper.display({
      id: 'select',
      header: ({ table }) => (
        <SelectPageCheckbox table={table} label="Select all users on this page" />
      ),
      cell: ({ row }) => (
        <SelectRowCheckbox row={row} label={`Select ${row.original.display_name}`} />
      ),
      enableSorting: false,
    }),
    columnHelper.display({
      id: 'avatar',
      header: '',
      cell: ({ row }) => (
        <Avatar className="size-8">
          {row.original.avatar_url ? <AvatarImage src={row.original.avatar_url} alt="" /> : null}
          <AvatarFallback className="text-xs font-semibold">
            {initialsOf(row.original.display_name)}
          </AvatarFallback>
        </Avatar>
      ),
    }),
    columnHelper.accessor('display_name', {
      id: 'display_name',
      header: 'Name',
      sortFn: 'text',
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
    }),
    columnHelper.accessor('email', {
      id: 'email',
      header: 'Email',
      sortFn: 'text',
      cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
    }),
    columnHelper.accessor('role', {
      id: 'role',
      header: 'Role',
      filterFn: 'equalsString',
      sortFn: 'text',
      // Excluded from the search box: otherwise typing "admin" would match
      // every admin by role rather than by name or email, which is what the
      // role filter is for.
      enableGlobalFilter: false,
      cell: (info) => <RoleBadge role={info.getValue()} />,
    }),
    // A display column, not an accessor: XP lives on the nullable `user_stats`
    // relation rather than on the row, so there's no single value to sort or
    // search on — and display columns are excluded from global filtering for
    // free, since they have no accessor.
    columnHelper.display({
      id: 'xp',
      header: 'XP / Level',
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {row.original.user_stats
            ? `${row.original.user_stats.total_xp} XP · L${row.original.user_stats.level}`
            : '—'}
        </span>
      ),
    }),
    columnHelper.accessor('created_at', {
      id: 'created_at',
      header: 'Joined',
      sortFn: 'datetime',
      // Excluded from search for the same reason as role — a date substring
      // isn't what an admin means when they type in a name/email box.
      enableGlobalFilter: false,
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
        const user = row.original
        // Server-side guards (self / primary admin / last admin) are the real
        // enforcement; disabling up front just saves the admin a refused click.
        const trashBlockedReason =
          user.id === PRIMARY_ADMIN_ID
            ? "The primary admin account can't be moved to trash."
            : user.id === currentUserId
              ? "You can't move your own account to trash."
              : null
        return (
          // Isolates every action (including opening the dropdown) from the
          // row's own onClick, which navigates to the detail page.
          <div className="text-right" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Actions for ${user.display_name}`}
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => onEdit(user)}>Edit</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onChangeEmail(user)}>
                  Change email
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onResetPassword(user)}>
                  Reset password
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {trashBlockedReason ? (
                  <Tooltip>
                    {/* A disabled menu item swallows pointer events, so
                        the tooltip needs its own wrapper to hover. */}
                    <TooltipTrigger asChild>
                      <span className="block">
                        <DropdownMenuItem disabled onSelect={(e) => e.preventDefault()}>
                          Move to trash
                        </DropdownMenuItem>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{trashBlockedReason}</TooltipContent>
                  </Tooltip>
                ) : (
                  // Not the red destructive style: this is reversible. Red is
                  // reserved for permanent deletion on the Trash page.
                  <DropdownMenuItem onSelect={() => onTrash(user)}>Move to trash</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    }),
  ])
}

export function UserTable({
  rows,
  isPending,
  isError,
  search,
  roleFilter,
  onRowClick,
  onEdit,
  onChangeEmail,
  onResetPassword,
  onTrash,
  currentUserId,
  selection,
  bulkActions,
}: UserTableProps) {
  // Memoised because the filtered row model compares these by *reference*:
  // a fresh array/object each render reads as "the filters changed", which
  // fires the model's autoResetPageIndex and snaps the table back to page 1.
  // The visible symptom is Next appearing to do nothing.
  const columnFilters = useMemo(
    () => (roleFilter === 'all' ? [] : [{ id: 'role', value: roleFilter }]),
    [roleFilter],
  )
  // `rowSelection` joins the state object but never touches `columnFilters`'s
  // identity, so ticking a checkbox can't trigger the page-reset bug above.
  const state = useMemo(
    () => ({ globalFilter: search, columnFilters, rowSelection: selection.rowSelection }),
    [search, columnFilters, selection.rowSelection],
  )

  // Stable columns: a rebuilt column array remounts every cell on each render,
  // which drops keyboard focus from a checkbox the moment it toggles.
  const handlers = useStableCallbacks({ onEdit, onChangeEmail, onResetPassword, onTrash })
  const columns = useMemo(
    () => buildColumns({ ...handlers, currentUserId }),
    [handlers, currentUserId],
  )

  const table = useTable({
    features: usersFeatures,
    columns,
    data: rows,
    // Selection is keyed by the real user id, never the row index.
    getRowId: (user) => user.id,
    onRowSelectionChange: selection.onRowSelectionChange,
    // Without this the global filter silently no-ops: the feature resolves
    // its filter function from this registry key and applies nothing when
    // it's unset.
    globalFilterFn: 'includesString',
    // Search and role live in the page toolbar, so they're passed straight
    // in as controlled state rather than driven through per-column UI.
    state,
  })

  const visibleRows = table.getRowModel().rows
  const pageCount = table.getPageCount()
  const filteredCount = table.getFilteredRowModel().rows.length
  const { pageIndex, pageSize } = table.state.pagination
  const columnCount = table.getAllLeafColumns().length

  const rangeStart = filteredCount === 0 ? 0 : pageIndex * pageSize + 1
  const rangeEnd = Math.min((pageIndex + 1) * pageSize, filteredCount)
  // "No users at all" and "nothing matched" are different problems for an
  // admin to act on, so they don't share copy.
  const isFiltered = search.trim() !== '' || roleFilter !== 'all'

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
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={columnCount}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={columnCount} className="h-32 text-center">
                  <p className="text-coral-d font-medium">Couldn&rsquo;t load users.</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Check your connection and try again.
                  </p>
                </TableCell>
              </TableRow>
            ) : visibleRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columnCount} className="h-32 text-center">
                  <p className="font-medium">
                    {isFiltered ? 'No users match your search' : 'No users yet'}
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {isFiltered
                      ? 'Try a different search term or role filter.'
                      : 'Add a user to get started.'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              visibleRows.map((row) => (
                <TableRow
                  key={row.id}
                  tabIndex={0}
                  role="link"
                  aria-label={`View ${row.original.display_name}`}
                  className="cursor-pointer"
                  onClick={() => onRowClick(row.original)}
                  onKeyDown={(e) => {
                    // Matches native <a> behavior: Enter activates, Space does not.
                    if (e.key === 'Enter') onRowClick(row.original)
                  }}
                >
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
          {/* Present from day one so this doesn't need revisiting once real
              signups arrive — not because 2 rows need paging. */}
          <Select
            value={String(pageSize)}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
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
  )
}
