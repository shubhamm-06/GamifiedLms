import { useState, type FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  CODE_TAKEN,
  CURRENCY_IS_DEFAULT,
  useCreateCurrency,
  useCurrencies,
  useDeleteCurrency,
  useSetCurrencyActive,
  type Currency,
} from '@/hooks/admin/useCurrencies'

/**
 * Same add/toggle/delete list pattern as `ManualOrderProvidersSection.tsx`
 * — a plain `<ul>`, not a TanStack Table, for the same "a few dozen config
 * rows never need sort/filter/pagination" reasoning. Not a shared
 * component with Providers: the add-form shape genuinely differs (one
 * field there, code+name here), so the two files are independently
 * written rather than generalized over a difference that would just add
 * indirection for two call sites.
 */
export function CurrenciesSection() {
  const { data: currencies, isPending, isError } = useCurrencies()
  const createCurrency = useCreateCurrency()
  const setActive = useSetCurrencyActive()
  const deleteCurrency = useDeleteCurrency()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [errors, setErrors] = useState<{ code?: string; name?: string }>({})
  const [deleteTarget, setDeleteTarget] = useState<Currency | null>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmedCode = code.trim().toUpperCase()
    const trimmedName = name.trim()
    const nextErrors: { code?: string; name?: string } = {}
    if (!trimmedCode) nextErrors.code = 'Enter a code.'
    if (!trimmedName) nextErrors.name = 'Enter a name.'
    if (nextErrors.code || nextErrors.name) {
      setErrors(nextErrors)
      return
    }
    setErrors({})
    createCurrency.mutate(
      { code: trimmedCode, name: trimmedName },
      {
        onSuccess: () => {
          setCode('')
          setName('')
        },
        onError: (e) => {
          if (e.message === CODE_TAKEN) setErrors({ code: 'This code already exists.' })
        },
      },
    )
  }

  return (
    <section className="rounded-lg border p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold">Currencies</h2>
        <p className="text-muted-foreground text-xs">
          Sourced from the full ISO 4217 active currency list. Only active currencies appear in
          the Default currency picker below — deactivate the ones this platform doesn&rsquo;t use
          rather than deleting them, unless you&rsquo;re sure they&rsquo;ll never be needed again.
        </p>
      </div>

      <form className="mb-3 flex items-end gap-2" onSubmit={handleSubmit} noValidate>
        <div className="w-24 space-y-1.5">
          <Label htmlFor="new-currency-code">Code</Label>
          <Input
            id="new-currency-code"
            placeholder="XYZ"
            maxLength={3}
            value={code}
            aria-invalid={!!errors.code}
            onChange={(e) => {
              setCode(e.target.value)
              setErrors((prev) => ({ ...prev, code: undefined }))
            }}
          />
          {errors.code ? <p className="text-coral-d text-sm">{errors.code}</p> : null}
        </div>
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="new-currency-name">Name</Label>
          <Input
            id="new-currency-name"
            placeholder="e.g. Something Coin"
            value={name}
            aria-invalid={!!errors.name}
            onChange={(e) => {
              setName(e.target.value)
              setErrors((prev) => ({ ...prev, name: undefined }))
            }}
          />
          {errors.name ? <p className="text-coral-d text-sm">{errors.name}</p> : null}
        </div>
        <Button type="submit" disabled={createCurrency.isPending}>
          <Plus />
          Add
        </Button>
      </form>

      {isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : isError ? (
        <p className="text-coral-d text-sm">Couldn&rsquo;t load currencies.</p>
      ) : (currencies ?? []).length === 0 ? (
        <p className="text-muted-foreground text-sm">No currencies yet — add one above.</p>
      ) : (
        <ul className="max-h-80 divide-y overflow-y-auto rounded-md border">
          {(currencies ?? []).map((currency) => (
            <li
              key={currency.code}
              className="flex items-center justify-between gap-4 px-3 py-2"
            >
              <span className={currency.is_active ? undefined : 'text-muted-foreground line-through'}>
                <span className="font-mono">{currency.code}</span>
                <span className="text-muted-foreground"> — {currency.name}</span>
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-muted-foreground text-xs">
                  {currency.is_active ? 'Active' : 'Inactive'}
                </span>
                <Switch
                  aria-label={`${currency.is_active ? 'Deactivate' : 'Activate'} ${currency.code}`}
                  checked={currency.is_active}
                  disabled={setActive.isPending}
                  onCheckedChange={(checked) =>
                    setActive.mutate({ code: currency.code, isActive: checked })
                  }
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${currency.code}`}
                  onClick={() => setDeleteTarget(currency)}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteTarget?.code} ({deleteTarget?.name})?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the currency for good — there&rsquo;s no undo. If it&rsquo;s currently
              set as the platform default, this will be refused until you change the default to
              something else first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteCurrency.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteCurrency.isPending}
              onClick={(event) => {
                event.preventDefault()
                if (!deleteTarget) return
                deleteCurrency.mutate(deleteTarget.code, {
                  onSuccess: () => setDeleteTarget(null),
                  onError: (e) => {
                    // Keep the dialog open on the expected FK-blocked case
                    // so the admin can read the toast and just Cancel —
                    // closing it would hide exactly the row they need to
                    // go change the default away from.
                    if (e.message !== CURRENCY_IS_DEFAULT) setDeleteTarget(null)
                  },
                })
              }}
            >
              {deleteCurrency.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
