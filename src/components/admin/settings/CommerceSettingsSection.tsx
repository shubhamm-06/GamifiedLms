import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useCurrencies } from '@/hooks/admin/useCurrencies'
import { useAppSettings, useUpdateAppSettings } from '@/hooks/useAppSettings'
import { CurrenciesSection } from './CurrenciesSection'
import { ManualOrderProvidersSection } from './ManualOrderProvidersSection'

/**
 * A searchable combobox, not a plain `Select` — with ~180 seeded
 * currencies, a scroll list is unusable; typing to filter is the only way
 * this stays pickable. Popover + Command (shadcn's standard combobox
 * shape) rather than a bespoke filter-as-you-type input, since this is
 * exactly the case that pairing exists for. Auto-saves the instant a
 * currency is picked — matches the immediate-toggle feel of the Switches
 * in the list editors right above/below it in this same tab, rather than
 * introducing the only "needs a Save button" control on the page.
 */
function DefaultCurrencyPicker() {
  const { data: settings, isPending: settingsPending } = useAppSettings()
  const { data: currencies, isPending: currenciesPending } = useCurrencies()
  const updateSettings = useUpdateAppSettings()
  const [open, setOpen] = useState(false)

  if (settingsPending || currenciesPending || !settings) {
    return <Skeleton className="h-9 w-full" />
  }

  const activeCurrencies = (currencies ?? []).filter((c) => c.is_active)
  const selected = activeCurrencies.find((c) => c.code === settings.default_currency)

  return (
    <div className="space-y-1.5">
      <Label htmlFor="default-currency-trigger">Default currency</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="default-currency-trigger"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
            disabled={updateSettings.isPending}
          >
            {selected ? (
              <span>
                <span className="font-mono">{selected.code}</span>
                <span className="text-muted-foreground"> — {selected.name}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">Select a currency…</span>
            )}
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
          <Command>
            <CommandInput placeholder="Search currencies…" />
            <CommandList>
              <CommandEmpty>No active currency matches.</CommandEmpty>
              <CommandGroup>
                {activeCurrencies.map((currency) => (
                  <CommandItem
                    key={currency.code}
                    value={`${currency.code} ${currency.name}`}
                    onSelect={() => {
                      updateSettings.mutate({ id: settings.id, default_currency: currency.code })
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        'size-4',
                        currency.code === settings.default_currency ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span className="font-mono">{currency.code}</span>
                    <span className="text-muted-foreground">— {currency.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <p className="text-muted-foreground text-xs">
        Pre-fills new courses&rsquo; currency in the Course Builder (not wired up yet — see
        state.md). Only active currencies from the list below are offered.
      </p>
    </div>
  )
}

/**
 * Commerce groups everything money-adjacent that Settings manages: the
 * providers a manual order can be recorded under, the currencies the
 * platform recognizes, and which one is the default. Three independent
 * pieces, not one form — each list editor already saves per-action
 * (add/toggle/delete), and the currency picker now does too.
 */
export function CommerceSettingsSection() {
  return (
    <div className="space-y-6">
      <ManualOrderProvidersSection />
      <CurrenciesSection />
      <section className="rounded-lg border p-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold">Default Currency</h2>
        </div>
        <DefaultCurrencyPicker />
      </section>
    </div>
  )
}
