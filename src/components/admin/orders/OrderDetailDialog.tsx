import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { formatAmount } from '@/lib/currency'
import { useUpdatePaymentReconciliation, type PaymentRow } from '@/hooks/admin/usePayments'
import { PaymentStatusPill } from './PaymentStatusPill'

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
})

function ReadOnlyField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 text-sm break-words">{value}</dd>
    </div>
  )
}

/**
 * Mounts fresh per open (`key={payment.id}` on the parent), so switching
 * between payments never carries a previous edit over. Its only local state
 * is the two editable columns — nothing else is ever tracked here, which is
 * what keeps the submit payload incapable of touching a read-only field:
 * there is no wider form object to spread from.
 */
function OrderReconciliationForm({
  payment,
  onDone,
}: {
  payment: PaymentRow
  onDone: () => void
}) {
  const updateReconciliation = useUpdatePaymentReconciliation()
  const [status, setStatus] = useState(payment.reconciliation_status)
  const [note, setNote] = useState(payment.reconciliation_note ?? '')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    updateReconciliation.mutate(
      {
        id: payment.id,
        reconciliation_status: status,
        reconciliation_note: note.trim() || null,
      },
      { onSuccess: onDone },
    )
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      <div className="flex items-center justify-between gap-4 rounded-md border p-3">
        <div>
          <Label htmlFor="reconciliation-resolved">Mark as resolved</Label>
          <p className="text-muted-foreground text-xs">
            Only this and the note below can be changed — every other field on a payment is
            fixed once the gateway reports it.
          </p>
        </div>
        <Switch
          id="reconciliation-resolved"
          checked={status === 'resolved'}
          onCheckedChange={(checked) => setStatus(checked ? 'resolved' : 'unresolved')}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reconciliation-note">Note</Label>
        <Textarea
          id="reconciliation-note"
          rows={3}
          placeholder="e.g. Confirmed with the gateway dashboard, duplicate webhook."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={updateReconciliation.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={updateReconciliation.isPending}>
          {updateReconciliation.isPending ? 'Saving…' : 'Save'}
        </Button>
      </DialogFooter>
    </form>
  )
}

interface OrderDetailDialogProps {
  payment: PaymentRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function OrderDetailDialog({ payment, open, onOpenChange }: OrderDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {payment ? formatAmount(payment.amount, payment.currency) : 'Payment'}
          </DialogTitle>
          <DialogDescription>
            {payment ? `${payment.provider} · ${payment.provider_payment_id}` : null}
          </DialogDescription>
        </DialogHeader>

        {payment ? (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 rounded-md border p-3 text-sm">
              <ReadOnlyField
                label="Received"
                value={dateTimeFormatter.format(new Date(payment.received_at))}
              />
              <ReadOnlyField label="Status" value={<PaymentStatusPill status={payment.status} />} />
              <ReadOnlyField label="Email" value={payment.email} />
              <ReadOnlyField
                label="User"
                value={
                  payment.user_id ? (
                    <Link
                      to="/admin/users/$userId"
                      params={{ userId: payment.user_id }}
                      className="text-teal-d hover:underline"
                    >
                      {payment.profiles?.display_name ?? 'View profile'}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Unclaimed — no account yet</span>
                  )
                }
              />
              <ReadOnlyField
                label="Course"
                value={
                  <Link
                    to="/admin/courses/$courseId/edit"
                    params={{ courseId: payment.course_id }}
                    search={{ tab: 'basics' }}
                    className="text-teal-d hover:underline"
                  >
                    {payment.courses?.title ?? 'View course'}
                  </Link>
                }
              />
              <ReadOnlyField label="Provider" value={payment.provider} />
            </dl>

            <div>
              <p className="text-muted-foreground mb-1 text-xs">Raw payload</p>
              <pre className="max-h-48 overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs whitespace-pre-wrap">
                {JSON.stringify(payment.raw_payload, null, 2)}
              </pre>
            </div>

            <OrderReconciliationForm
              key={payment.id}
              payment={payment}
              onDone={() => onOpenChange(false)}
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
