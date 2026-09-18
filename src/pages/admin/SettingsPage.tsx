import { ManualOrderProvidersSection } from '@/components/admin/settings/ManualOrderProvidersSection'

/**
 * One section for now. Adding a second is just another component rendered
 * below this one — no shared "settings framework" (tabs, a section
 * registry, generic card wrapper) built for sections that don't exist yet.
 */
export function SettingsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
      </header>

      <ManualOrderProvidersSection />
    </div>
  )
}
