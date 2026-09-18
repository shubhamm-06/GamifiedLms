import { useNavigate, useSearch } from '@tanstack/react-router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CommerceSettingsSection } from '@/components/admin/settings/CommerceSettingsSection'
import { GamificationSettingsSection } from '@/components/admin/settings/GamificationSettingsSection'
import { SiteIdentitySettingsSection } from '@/components/admin/settings/SiteIdentitySettingsSection'

/**
 * Three tabs, one purpose-built component each — Commerce (Manual Order
 * Providers + Currencies + the default currency picker), Gamification
 * (quiz pass threshold, alone for now — matches the sidebar's own naming
 * for this area), Site Identity (name/URL/support/legal links). Replaced
 * the earlier Providers | Platform split now that Platform's fields have
 * an actual home to be grouped by, rather than one undifferentiated
 * second tab. Still no generic settings framework: a fourth tab is one
 * more `TabsTrigger`/`TabsContent` pair, not a registry to extend.
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
          navigate({
            to: '/admin/settings',
            search: { tab: value as 'commerce' | 'gamification' | 'identity' },
            replace: true,
          })
        }
      >
        <TabsList>
          <TabsTrigger value="commerce">Commerce</TabsTrigger>
          <TabsTrigger value="gamification">Gamification</TabsTrigger>
          <TabsTrigger value="identity">Site Identity</TabsTrigger>
        </TabsList>

        <TabsContent value="commerce" className="pt-4">
          <CommerceSettingsSection />
        </TabsContent>
        <TabsContent value="gamification" className="pt-4">
          <GamificationSettingsSection />
        </TabsContent>
        <TabsContent value="identity" className="pt-4">
          <SiteIdentitySettingsSection />
        </TabsContent>
      </Tabs>
    </div>
  )
}
