import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAwardXp } from '@/hooks/admin/useUserDetail'

/**
 * Inline, not a dialog — this is a small, tightly-scoped action attached to
 * the Stats section, not a separate flow worth a modal of its own.
 */
export function AwardXpForm({ userId }: { userId: string }) {
  const awardXp = useAwardXp(userId)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const parsed = Number(amount)
    // Zero-amount corrections would be a manual entry with no effect.
    // Negative amounts are deliberately allowed — xp_transactions is an
    // append-only ledger where corrections are negative-amount rows
    // (see schema.md), not something this form should refuse.
    if (!amount.trim() || Number.isNaN(parsed) || !Number.isInteger(parsed) || parsed === 0) {
      setError('Enter a non-zero whole number.')
      return
    }
    if (!reason.trim()) {
      setError('A reason is required — this is a permanent ledger entry.')
      return
    }
    setError(null)
    awardXp.mutate(
      { amount: parsed, reason: reason.trim() },
      { onSuccess: () => { setAmount(''); setReason('') } },
    )
  }

  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={handleSubmit} noValidate>
      <div className="w-28 space-y-1.5">
        <Label htmlFor="award-xp-amount">Amount</Label>
        <Input
          id="award-xp-amount"
          type="number"
          step={1}
          value={amount}
          aria-invalid={!!error}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <div className="min-w-48 flex-1 space-y-1.5">
        <Label htmlFor="award-xp-reason">Reason</Label>
        <Input
          id="award-xp-reason"
          value={reason}
          aria-invalid={!!error}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={awardXp.isPending}>
        {awardXp.isPending ? 'Awarding…' : 'Award XP'}
      </Button>
      {error ? <p className="text-coral-d w-full text-sm">{error}</p> : null}
    </form>
  )
}
