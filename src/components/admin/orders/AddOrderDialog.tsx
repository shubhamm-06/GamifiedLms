import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCourses } from '@/hooks/admin/useCourses'
import { useManualOrderProviders } from '@/hooks/admin/useManualOrderProviders'
import { useCreateManualOrder } from '@/hooks/admin/usePayments'
import { filterEnrollableCourses, useUserEnrollments } from '@/hooks/admin/useUserDetail'
import { useUsers, type AdminUserRow } from '@/hooks/admin/useUsers'
import { DEFAULT_CURRENCY } from '@/lib/currency'

const MAX_RESULTS = 8

/** Search-then-pick — there's no combobox component installed, and a plain input + list needs no new dependency for this. */
function UserPicker({
  selected,
  onSelect,
}: {
  selected: AdminUserRow | null
  onSelect: (user: AdminUserRow | null) => void
}) {
  const { data: users } = useUsers()
  const [search, setSearch] = useState('')

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{selected.display_name}</p>
          <p className="text-muted-foreground truncate text-xs">{selected.email}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Change user"
          onClick={() => onSelect(null)}
        >
          <X />
        </Button>
      </div>
    )
  }

  const term = search.trim().toLowerCase()
  const matches = term
    ? (users ?? [])
        .filter(
          (u) => u.display_name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term),
        )
        .slice(0, MAX_RESULTS)
    : []

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          className="pl-8"
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {term ? (
        <div className="max-h-40 overflow-y-auto rounded-md border">
          {matches.length === 0 ? (
            <p className="text-muted-foreground p-2.5 text-sm">No users match.</p>
          ) : (
            matches.map((user) => (
              <button
                key={user.id}
                type="button"
                className="hover:bg-muted flex w-full flex-col items-start px-2.5 py-1.5 text-left transition-colors"
                onClick={() => {
                  onSelect(user)
                  setSearch('')
                }}
              >
                <span className="text-sm font-medium">{user.display_name}</span>
                <span className="text-muted-foreground text-xs">{user.email}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}

/** Mounts fresh per open, so a previous selection never carries into the next order. */
function AddOrderForm({ onDone }: { onDone: () => void }) {
  const createOrder = useCreateManualOrder()
  const [user, setUser] = useState<AdminUserRow | null>(null)
  const [courseId, setCourseId] = useState('')
  const [provider, setProvider] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY)
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: allCourses } = useCourses()
  const { data: providers } = useManualOrderProviders()
  const activeProviders = (providers ?? []).filter((p) => p.is_active)
  // Only fetched once a user is picked (enabled: false otherwise — see
  // useUserEnrollments) — there is nothing to scope the course list to
  // before then.
  const {
    data: enrollments,
    isPending: enrollmentsPending,
    isFetching: enrollmentsFetching,
  } = useUserEnrollments(user?.id ?? '')
  // isPending alone isn't enough here: switching from one student to
  // another keeps the *previous* student's enrollments as cached data
  // while the new query is in flight (isPending would already read false),
  // which would flash the wrong exclusion list for a moment. isFetching
  // covers that refetch window too, not just the very first load.
  const enrollmentsSettled = !!user && !enrollmentsPending && !enrollmentsFetching
  const eligibleCourses = enrollmentsSettled
    ? filterEnrollableCourses(
        allCourses ?? [],
        (enrollments ?? []).map((e) => e.course_id),
      )
    : []

  function handleUserChange(next: AdminUserRow | null) {
    setUser(next)
    // A course picked for the previous user may not even be eligible for
    // the new one.
    setCourseId('')
  }

  /**
   * Amount/currency pre-fill from the course's own price whenever the
   * selection changes, then stay freely editable — goodwill comps and
   * partial amounts are a real, named use case (see the dialog's own
   * description), so this can never lock the field. A free course or one
   * with no price set (`price_amount` null) falls back to 0, not blank —
   * that's a real, submittable amount here (see the relaxed `>= 0` check
   * in handleSubmit below), not a placeholder asking to be filled in.
   */
  function handleCourseChange(nextCourseId: string) {
    setCourseId(nextCourseId)
    const course = eligibleCourses.find((c) => c.id === nextCourseId)
    if (course) {
      setAmount(course.price_amount == null ? '0' : String(course.price_amount))
      setCurrency(course.currency)
    }
  }

  function handleSubmit() {
    const next: Record<string, string> = {}
    if (!user) next.user = 'Pick a student.'
    if (!courseId) next.course = 'Pick a course.'
    if (!provider.trim()) next.provider = 'Pick a provider.'
    const parsedAmount = Number(amount)
    // >= 0, not > 0: a free course or a full comp is legitimately a
    // zero-amount order, not an invalid one — see handleCourseChange.
    if (!amount.trim() || Number.isNaN(parsedAmount) || parsedAmount < 0) {
      next.amount = 'Enter an amount of 0 or more.'
    }
    if (!currency.trim()) next.currency = 'Currency is required.'

    setErrors(next)
    if (Object.keys(next).length > 0 || !user) return

    createOrder.mutate(
      {
        userId: user.id,
        courseId,
        provider: provider.trim(),
        amount: parsedAmount,
        currency: currency.trim().toUpperCase(),
        note: note.trim() || null,
      },
      { onSuccess: onDone },
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Student</Label>
        <UserPicker selected={user} onSelect={handleUserChange} />
        {errors.user ? <p className="text-coral-d text-sm">{errors.user}</p> : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="order-course">Course</Label>
        <Select value={courseId} onValueChange={handleCourseChange} disabled={!enrollmentsSettled}>
          <SelectTrigger id="order-course" className="w-full">
            <SelectValue
              placeholder={
                !user
                  ? 'Pick a student first'
                  : !enrollmentsSettled
                    ? 'Loading this student’s enrollments…'
                    : 'Select a published course…'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {eligibleCourses.map((course) => (
              <SelectItem key={course.id} value={course.id}>
                {course.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {enrollmentsSettled && eligibleCourses.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            No published courses left to enroll this student in.
          </p>
        ) : null}
        {errors.course ? <p className="text-coral-d text-sm">{errors.course}</p> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="order-amount">Amount</Label>
          <Input
            id="order-amount"
            type="number"
            min={0}
            value={amount}
            aria-invalid={!!errors.amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {errors.amount ? (
            <p className="text-coral-d text-sm">{errors.amount}</p>
          ) : (
            <p className="text-muted-foreground text-xs">
              Whole rupees, not paise. Fills in from the course&rsquo;s price — stays editable
              for comps and partial amounts.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="order-currency">Currency</Label>
          <Input
            id="order-currency"
            value={currency}
            aria-invalid={!!errors.currency}
            onChange={(e) => setCurrency(e.target.value)}
          />
          {errors.currency ? <p className="text-coral-d text-sm">{errors.currency}</p> : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="order-provider">Provider</Label>
        <Select value={provider} onValueChange={setProvider} disabled={activeProviders.length === 0}>
          <SelectTrigger id="order-provider" className="w-full">
            <SelectValue
              placeholder={
                activeProviders.length === 0 ? 'No active providers configured' : 'Select a provider…'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {activeProviders.map((p) => (
              <SelectItem key={p.id} value={p.label}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.provider ? (
          <p className="text-coral-d text-sm">{errors.provider}</p>
        ) : activeProviders.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            Add one in{' '}
            <Link to="/admin/settings" className="text-teal-d hover:underline">
              Settings
            </Link>{' '}
            first.
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">
            However you want to label how this was actually paid — configured in Settings, not
            free text.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="order-note">Note</Label>
        <Textarea
          id="order-note"
          rows={2}
          placeholder="Optional — recorded on the payment for later reference."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={createOrder.isPending}>
          Cancel
        </Button>
        <Button type="button" disabled={createOrder.isPending} onClick={handleSubmit}>
          {createOrder.isPending ? 'Recording…' : 'Record order'}
        </Button>
      </DialogFooter>
    </div>
  )
}

interface AddOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddOrderDialog({ open, onOpenChange }: AddOrderDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add order</DialogTitle>
          <DialogDescription>
            Records a payment that happened outside the gateway and enrolls the student — a bank
            transfer, cash, or a goodwill comp.
          </DialogDescription>
        </DialogHeader>
        {/* No key needed to reset state between opens: Radix unmounts
            DialogContent's children on close, so this mounts fresh every
            time regardless (same reasoning as EditUserDialog/CreateUserDialog
            — see ui.md). */}
        <AddOrderForm onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}
