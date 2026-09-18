import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  LABEL_TAKEN,
  useCreateProvider,
  useManualOrderProviders,
  useSetProviderActive,
} from '@/hooks/admin/useManualOrderProviders'

/**
 * A handful of config rows, not paginated data — a plain list with a
 * Switch per row, not a TanStack Table instance. Forcing the table
 * machinery (sorting, filtering, pagination) onto three-to-a-dozen rows
 * that never need any of it would be adding structure for its own sake.
 */
export function ManualOrderProvidersSection() {
  const { data: providers, isPending, isError } = useManualOrderProviders()
  const createProvider = useCreateProvider()
  const setActive = useSetProviderActive()
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = label.trim()
    if (!trimmed) {
      setError('Enter a label.')
      return
    }
    setError(null)
    createProvider.mutate(trimmed, {
      onSuccess: () => setLabel(''),
      onError: (e) => {
        if (e.message === LABEL_TAKEN) setError('This label already exists.')
      },
    })
  }

  return (
    <section className="rounded-lg border p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold">Manual Order Providers</h2>
        <p className="text-muted-foreground text-xs">
          Options offered in Add Order&rsquo;s Provider dropdown (Orders &amp; Payments). Only
          active providers appear there — payments already recorded against a deactivated label
          are unaffected.
        </p>
      </div>

      <form className="mb-3 flex items-end gap-2" onSubmit={handleSubmit} noValidate>
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="new-provider-label">Add a provider</Label>
          <Input
            id="new-provider-label"
            placeholder="e.g. upi, cheque"
            value={label}
            aria-invalid={!!error}
            onChange={(e) => {
              setLabel(e.target.value)
              setError(null)
            }}
          />
          {error ? <p className="text-coral-d text-sm">{error}</p> : null}
        </div>
        <Button type="submit" disabled={createProvider.isPending}>
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
        <p className="text-coral-d text-sm">Couldn&rsquo;t load providers.</p>
      ) : (providers ?? []).length === 0 ? (
        <p className="text-muted-foreground text-sm">No providers yet — add one above.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {(providers ?? []).map((provider) => (
            <li key={provider.id} className="flex items-center justify-between gap-4 px-3 py-2">
              <span className={provider.is_active ? undefined : 'text-muted-foreground line-through'}>
                {provider.label}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">
                  {provider.is_active ? 'Active' : 'Inactive'}
                </span>
                <Switch
                  aria-label={`${provider.is_active ? 'Deactivate' : 'Activate'} ${provider.label}`}
                  checked={provider.is_active}
                  disabled={setActive.isPending}
                  onCheckedChange={(checked) =>
                    setActive.mutate({ id: provider.id, isActive: checked })
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
