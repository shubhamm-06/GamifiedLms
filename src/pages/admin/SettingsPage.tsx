import { useNavigate, useSearch } from '@tanstack/react-router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ManualOrderProvidersSection } from '@/components/admin/settings/ManualOrderProvidersSection'
import { PlatformSettingsSection } from '@/components/admin/settings/PlatformSettingsSection'

/**
 * Two tabs now that there's an actual second section, not a hypothetical
 * one — the earlier "structure it so a second section can be added later"
 * note (see git history / changelog) was written for exactly this moment.
 * Still no generic "settings framework": each tab renders one purpose-built
 * component, and a third tab would just be one more `TabsTrigger` +
 * `TabsContent` pair, not a registry to extend.
 */
export function SettingsPage() {
  const { tab } = useSearch({ from: '/admin/settings' })
  const navigate = useNavigate()

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
      </header>

      <Tabs
        value={tab}
        onValueChange={(value) =>
          navigate({ to: '/admin/settings', search: { tab: value as 'providers' | 'platform' }, replace: true })
        }
      >
        <TabsList>
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="platform">Platform</TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="pt-4">
          <ManualOrderProvidersSection />
        </TabsContent>
        <TabsContent value="platform" className="pt-4">
          <PlatformSettingsSection />
        </TabsContent>
      </Tabs>
    </div>
  )
}
