import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { createColumnHelper, tableFeatures } from '@tanstack/table-core'
import { useTable } from '@tanstack/react-table'
import { ArrowRight } from 'lucide-react'
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
import { formatAmount } from '@/lib/currency'
import {
  useActiveEnrollmentCount,
  useCourseCounts,
  useNeedsAttention,
  useRecentActivity,
  useStudentCount,
  type ActivityKind,
  type ActivityRow,
} from '@/hooks/admin/useDashboard'
import { useRevenue } from '@/hooks/admin/usePayments'
import { getTerms as tw } from '@/lib/settings/terms'

/* ------------------------------------------------------------------ */
/* KPI cards                                                           */
/* ------------------------------------------------------------------ */

interface KpiCardProps {
  label: string
  value: ReactNode
  sub?: ReactNode
  isPending: boolean
  isError: boolean
}

function KpiCard({ label, value, sub, isPending, isError }: KpiCardProps) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-muted-foreground text-sm">{label}</p>
      {isPending ? (
        <Skeleton className="mt-2 h-8 w-20" />
      ) : isError ? (
        <p className="text-coral-d mt-2 text-sm font-medium">Couldn&rsquo;t load</p>
      ) : (
        <>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          {sub ? <div className="text-muted-foreground mt-1 text-xs">{sub}</div> : null}
        </>
      )}
    </div>
  )
}

function KpiRow() {
  const students = useStudentCount()
  const courses = useCourseCounts()
  const enrollments = useActiveEnrollmentCount()
  const revenue = useRevenue()

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Students"
        value={students.data ?? 0}
        isPending={students.isPending}
        isError={students.isError}
      />
      <KpiCard
        label={`${tw().terms('course')}`}
        value={(courses.data?.published ?? 0) + (courses.data?.draft ?? 0)}
        sub={
          courses.data && courses.data.published + courses.data.draft === 0 ? (
            <Link to={'/admin/courses' as never} className="text-teal-d hover:underline">
              {`Create your first ${tw().lower('course')}`}
            </Link>
          ) : (
            `${courses.data?.published ?? 0} published · ${courses.data?.draft ?? 0} draft`
          )
        }
        isPending={courses.isPending}
        isError={courses.isError}
      />
      <KpiCard
        label="Active enrollments"
        value={enrollments.data ?? 0}
        isPending={enrollments.isPending}
        isError={enrollments.isError}
      />
      <KpiCard
        label="Revenue"
        value={formatAmount(revenue.data ?? 0)}
        sub="Paid, INR only"
        isPending={revenue.isPending}
        isError={revenue.isError}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Needs attention                                                     */
/* ------------------------------------------------------------------ */

const TONE_DOT: Record<'coral' | 'gold' | 'plum', string> = {
  coral: 'bg-coral',
  gold: 'bg-gold',
  plum: 'bg-plum',
}

function NeedsAttention() {
  const { data, isPending, isError } = useNeedsAttention()

  return (
    <section className="rounded-lg border">
      <header className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Needs attention</h2>
      </header>
      <div className="p-4">
        {isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        ) : isError ? (
          <p className="text-coral-d text-sm">Couldn&rsquo;t load attention items.</p>
        ) : data && data.length > 0 ? (
          <ul className="space-y-2">
            {data.map((item) => (
              <li key={item.id}>
                <Link
                  to={item.to as never}
                  className="hover:bg-muted -mx-2 flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors"
                >
                  <span className={cn('size-2 shrink-0 rounded-full', TONE_DOT[item.tone])} />
                  <span className="flex-1">{item.label}</span>
                  <ArrowRight className="text-muted-foreground size-3.5" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">Nothing needs attention.</p>
        )}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Recent activity                                                     */
/* ------------------------------------------------------------------ */

const KIND_LABEL: Record<ActivityKind, string> = {
  enrollment: 'Enrollment',
  payment: 'Payment',
  xp: `${tw().term('xp')}`,
}

const KIND_PILL: Record<ActivityKind, string> = {
  enrollment: 'bg-teal/10 text-teal-d',
  payment: 'bg-gold/15 text-gold-d',
  xp: 'bg-plum/10 text-plum-d',
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000_000],
  ['month', 2_592_000_000],
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
]

const relativeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

function formatRelativeTime(iso: string): string {
  const elapsed = Date.now() - new Date(iso).getTime()
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (Math.abs(elapsed) >= ms) {
      return relativeFormatter.format(-Math.round(elapsed / ms), unit)
    }
  }
  return 'just now'
}

// Static, per TanStack Table v9 guidance — this table needs no optional
// features, only the core row model.
const activityFeatures = tableFeatures({})
const columnHelper = createColumnHelper<typeof activityFeatures, ActivityRow>()

// columnHelper.columns() preserves each column's own value type; a plain
// array widens them to `unknown` and fails the useTable constraint.
const activityColumns = columnHelper.columns([
  columnHelper.accessor('at', {
    id: 'when',
    header: 'When',
    cell: (info) => (
      <span className="text-muted-foreground whitespace-nowrap">
        {formatRelativeTime(info.getValue())}
      </span>
    ),
  }),
  columnHelper.accessor('kind', {
    id: 'type',
    header: 'Type',
    cell: (info) => {
      const kind = info.getValue()
      return (
        <span
          className={cn(
            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
            KIND_PILL[kind],
          )}
        >
          {KIND_LABEL[kind]}
        </span>
      )
    },
  }),
  columnHelper.accessor('detail', {
    id: 'detail',
    header: 'Detail',
    cell: (info) => info.getValue(),
  }),
])

function RecentActivity() {
  const { data, isPending, isError } = useRecentActivity()
  const table = useTable({
    features: activityFeatures,
    columns: activityColumns,
    data: data ?? [],
  })

  return (
    <section className="rounded-lg border">
      <header className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Recent activity</h2>
      </header>

      {isPending ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-coral-d p-4 text-sm">Couldn&rsquo;t load recent activity.</p>
      ) : (data?.length ?? 0) === 0 ? (
        <p className="text-muted-foreground p-4 text-sm">
          {`No activity yet. Enrollments, payments and ${tw().term('xp')} will show up here as they happen.`}
        </p>
      ) : (
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    <table.FlexRender header={header} />
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id}>
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */

export function DashboardPage() {
  return (
    <div className="space-y-6">
      <KpiRow />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <NeedsAttention />
        <RecentActivity />
      </div>
    </div>
  )
}
