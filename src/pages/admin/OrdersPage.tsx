import { useState, type ReactNode } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useTableSelection } from '@/components/admin/selection/useTableSelection'
import { AddOrderDialog } from '@/components/admin/orders/AddOrderDialog'
import { BulkReconciliationDialog } from '@/components/admin/orders/BulkReconciliationDialog'
import { BulkTrashDialog } from '@/components/admin/orders/BulkTrashDialog'
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
  useSetPaymentsTrashed,
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
  const { view } = useSearch({ from: '/admin/orders' })
  const navigate = useNavigate()

  const [statusFilter, setStatusFilter] = useState('all')
  const [reconciliationFilter, setReconciliationFilter] = useState('all')
  const [viewTarget, setViewTarget] = useState<PaymentRow | null>(null)
  const [addOrderOpen, setAddOrderOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [bulkAction, setBulkAction] = useState<'resolved' | 'unresolved' | null>(null)
  const [trashDialog, setTrashDialog] = useState<{ action: 'trash' | 'delete'; ids: string[] } | null>(
    null,
  )

  const { data, isPending, isError } = usePayments()
  const payments = data ?? []
  // Active vs Trash is a split of the SAME fetched list, not a separate
  // query — same client-side-everything reasoning as the status/
  // reconciliation filters below, just one more dimension.
  const activePayments = payments.filter((p) => p.deleted_at === null)
  const trashedPayments = payments.filter((p) => p.deleted_at !== null)
  const viewPayments = view === 'trash' ? trashedPayments : activePayments
  // Shared selection kit. Active and Trash are disjoint row sets, so a
  // selection made in one means nothing in the other — `view` is a reset key
  // alongside the two filters.
  const selection = useTableSelection([view, statusFilter, reconciliationFilter])
  const filteredForExport = filterPaymentsForExport(viewPayments, statusFilter, reconciliationFilter)

  // `rowSelection`'s keys are payment ids directly — `OrderTable` is wired
  // with `getRowId: (payment) => payment.id`, so no need to reach into the
  // table instance to turn a selection back into real rows here.
  const selectedIds = selection.selectedIds
  const selectedPayments = viewPayments.filter((p) => selection.rowSelection[p.id])

  // Selection is independent state that doesn't clean itself up when the
  // rows it points at disappear from view (trashed, restored, or actually
  // deleted) — remove exactly the acted-upon ids rather than assuming a
  // blanket clear, since this same handler backs both a bulk action
  // (ids === the whole selection) and a single row's dropdown action (ids
  // is just that one row, which may not even be selected).
  const removeFromSelection = selection.removeIds

  const setTrashed = useSetPaymentsTrashed()
  function handleRestore(ids: string[]) {
    setTrashed.mutate({ ids, trashed: false }, { onSuccess: () => removeFromSelection(ids) })
  }

  // Active and Trash are disjoint row sets, so a selection made in one view
  // can't mean anything in the other — cleared on every switch rather than
  // left to silently reference rows that are no longer even in the visible
  // list.
  function changeView(next: 'active' | 'trash') {
    navigate({ to: '/admin/orders', search: { view: next }, replace: true })
  }

  const revenue = useRevenue()
  const unresolved = useUnresolvedPaymentsCount()
  const failed = useFailedPaymentsCount()

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Orders & Payments</h1>
          <p className="text-muted-foreground text-sm">
            {view === 'trash'
              ? `${trashedPayments.length} in Trash`
              : `${activePayments.length} ${activePayments.length === 1 ? 'order' : 'orders'}`}
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

      <Tabs value={view} onValueChange={(value) => changeView(value as 'active' | 'trash')}>
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="trash">Trash</TabsTrigger>
        </TabsList>
      </Tabs>

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
        payments={viewPayments}
        isPending={isPending}
        isError={isError}
        statusFilter={statusFilter}
        reconciliationFilter={reconciliationFilter}
        view={view}
        onView={setViewTarget}
        onTrash={(payment) => setTrashDialog({ action: 'trash', ids: [payment.id] })}
        onRestore={(payment) => handleRestore([payment.id])}
        onDeletePermanently={(payment) => setTrashDialog({ action: 'delete', ids: [payment.id] })}
        selection={selection}
        bulkActions={
          <>
            {view === 'active' ? (
              <>
                <Button size="sm" variant="outline" onClick={() => setBulkAction('unresolved')}>
                  Mark Unresolved
                </Button>
                <Button size="sm" variant="outline" onClick={() => setBulkAction('resolved')}>
                  Mark Resolved
                </Button>
                <Button size="sm" variant="outline" onClick={() => exportPaymentsCsv(selectedPayments)}>
                  <Download />
                  Export selected
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTrashDialog({ action: 'trash', ids: selectedIds })}
                >
                  Move to Trash
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => handleRestore(selectedIds)}>
                  Restore
                </Button>
                <Button size="sm" variant="outline" onClick={() => exportPaymentsCsv(selectedPayments)}>
                  <Download />
                  Export selected
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setTrashDialog({ action: 'delete', ids: selectedIds })}
                >
                  Delete Permanently
                </Button>
              </>
            )}
          </>
        }
      />

      <OrderDetailDialog
        payment={viewTarget}
        open={!!viewTarget}
        onOpenChange={(open) => !open && setViewTarget(null)}
      />

      <BulkReconciliationDialog
        action={bulkAction}
        ids={selectedIds}
        open={bulkAction !== null}
        onOpenChange={(open) => !open && setBulkAction(null)}
        onSuccess={() => selection.clear()}
      />

      <BulkTrashDialog
        action={trashDialog?.action ?? null}
        ids={trashDialog?.ids ?? []}
        open={trashDialog !== null}
        onOpenChange={(open) => !open && setTrashDialog(null)}
        onSuccess={() => trashDialog && removeFromSelection(trashDialog.ids)}
      />

      <AddOrderDialog open={addOrderOpen} onOpenChange={setAddOrderOpen} />
      <ImportOrdersDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}
