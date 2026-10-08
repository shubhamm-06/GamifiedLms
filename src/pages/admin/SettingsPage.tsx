import { useNavigate, useSearch } from '@tanstack/react-router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CommerceSettingsSection } from '@/components/admin/settings/CommerceSettingsSection'
import { GamificationSettingsSection } from '@/components/admin/settings/GamificationSettingsSection'
import { SiteIdentitySettingsSection } from '@/components/admin/settings/SiteIdentitySettingsSection'
import { SiteSettingsTab } from '@/components/admin/settings/site/SiteSettingsTabs'
import { useTerms } from '@/hooks/useSettings'

type Tab = 'branding' | 'colors' | 'terminology' | 'features' | 'commerce' | 'gamification' | 'identity'

/**
 * Settings. The first four tabs are the admin Settings system (Phase 1, `site_config`,
 * migration 041): Branding, Colors, Terminology, Features, each its own form with
 * Save / Discard / Reset and compare-and-swap saves. The last three are the older
 * per-area panels over `app_settings` (Commerce, Gamification, Site Identity).
 */
export function SettingsPage() {
  const { tab } = useSearch({ from: '/admin/settings' })
  const navigate = useNavigate()
  const { term } = useTerms()
  const wide = tab === 'branding' || tab === 'colors' || tab === 'terminology' || tab === 'features'

  return (
    <div className={wide ? 'max-w-6xl space-y-6' : 'max-w-2xl space-y-6'}>
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
      </header>

      <Tabs value={tab} onValueChange={(value) => navigate({ to: '/admin/settings', search: { tab: value as Tab }, replace: true })}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="colors">Appearance</TabsTrigger>
          <TabsTrigger value="terminology">Terminology</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="commerce">Commerce</TabsTrigger>
          <TabsTrigger value="gamification">{`${term('xp')} rules`}</TabsTrigger>
          <TabsTrigger value="identity">Site Identity</TabsTrigger>
        </TabsList>

        {(['branding', 'colors', 'terminology', 'features'] as const).map((t) => (
          <TabsContent key={t} value={t} className="pt-4">
            {tab === t ? <SiteSettingsTab tab={t} /> : null}
          </TabsContent>
        ))}
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
