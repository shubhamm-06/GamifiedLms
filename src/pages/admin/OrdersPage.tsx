import { useState, type ReactNode } from 'react'
import { Download, Plus, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { AddOrderDialog } from '@/components/admin/orders/AddOrderDialog'
import { ImportOrdersDialog } from '@/components/admin/orders/ImportOrdersDialog'
import { OrderDetailDialog } from '@/components/admin/orders/OrderDetailDialog'
import { OrderTable } from '@/components/admin/orders/OrderTable'
import { formatAmount } from '@/lib/currency'
import { downloadTextFile, stringifyCsv } from '@/lib/csv'
import {
  filterPaymentsForExport,
  useFailedPaymentsCount,
  usePayments,
  useRevenue,
  useUnresolvedPaymentsCount,
  type PaymentRow,
} from '@/hooks/admin/usePayments'

const EXPORT_HEADER = ['Received', 'Email', 'Course', 'Amount', 'Currency', 'Provider', 'Status', 'Reconciliation']

function exportPaymentsCsv(payments: PaymentRow[]) {
  const rows = payments.map((p) => [
    p.received_at.slice(0, 10),
    p.email,
    p.courses?.title ?? '',
    p.amount,
    p.currency,
    p.provider,
    p.status,
    p.reconciliation_status,
  ])
  downloadTextFile(`orders-${new Date().toISOString().slice(0, 10)}.csv`, stringifyCsv([EXPORT_HEADER, ...rows]))
}

/**
 * Same card shape as `DashboardPage.tsx`'s `KpiCard` — kept as a separate,
 * small copy rather than extracted into a shared component. Only the
 * revenue-*summing logic* was asked to be shared (`useRevenue`, now in
 * `usePayments.ts`); this presentational box has no domain logic to drift,
 * so duplicating ~15 lines here is cheaper than coupling two pages' JSX to
 * one component for a wrapper this thin.
 */
function KpiCard({
  label,
  value,
  sub,
  isPending,
  isError,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  isPending: boolean
  isError: boolean
}) {
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

export function OrdersPage() {
  const [statusFilter, setStatusFilter] = useState('all')
  const [reconciliationFilter, setReconciliationFilter] = useState('all')
  const [viewTarget, setViewTarget] = useState<PaymentRow | null>(null)
  const [addOrderOpen, setAddOrderOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const { data, isPending, isError } = usePayments()
  const payments = data ?? []
  const filteredForExport = filterPaymentsForExport(payments, statusFilter, reconciliationFilter)

  const revenue = useRevenue()
  const unresolved = useUnresolvedPaymentsCount()
  const failed = useFailedPaymentsCount()

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Orders & Payments</h1>
          <p className="text-muted-foreground text-sm">
            {payments.length} {payments.length === 1 ? 'order' : 'orders'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportPaymentsCsv(filteredForExport)}>
            <Download />
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload />
            Import CSV
          </Button>
          <Button onClick={() => setAddOrderOpen(true)}>
            <Plus />
            Add order
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Revenue"
          value={formatAmount(revenue.data ?? 0)}
          sub="Paid, INR only"
          isPending={revenue.isPending}
          isError={revenue.isError}
        />
        <KpiCard
          label="Unresolved"
          value={unresolved.data ?? 0}
          sub="Needs reconciliation"
          isPending={unresolved.isPending}
          isError={unresolved.isError}
        />
        <KpiCard
          label="Failed"
          value={failed.data ?? 0}
          sub="Payment attempts that failed"
          isPending={failed.isPending}
          isError={failed.isError}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={reconciliationFilter} onValueChange={setReconciliationFilter}>
          <SelectTrigger className="w-52" aria-label="Filter by reconciliation status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All reconciliation states</SelectItem>
            <SelectItem value="unresolved">Unresolved</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <OrderTable
        payments={payments}
        isPending={isPending}
        isError={isError}
        statusFilter={statusFilter}
        reconciliationFilter={reconciliationFilter}
        onView={setViewTarget}
      />

      <OrderDetailDialog
        payment={viewTarget}
        open={!!viewTarget}
        onOpenChange={(open) => !open && setViewTarget(null)}
      />

      <AddOrderDialog open={addOrderOpen} onOpenChange={setAddOrderOpen} />
      <ImportOrdersDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}
