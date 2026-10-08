import { Info } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useSiteConfig } from '@/hooks/admin/useSiteConfig'
import { BrandingTab } from './BrandingTab'
import { AppearanceTab } from './AppearanceTab'
import { FeaturesTab } from './FeaturesTab'
import { TerminologyTab } from './TerminologyTab'

export type SiteTab = 'branding' | 'colors' | 'terminology' | 'features'

/** One of the four Settings tabs, with the admin's own (RLS) read of `site_config`. */
export function SiteSettingsTab({ tab }: { tab: SiteTab }) {
  const config = useSiteConfig()
  if (config.isPending) return <Skeleton className="h-64 w-full" />
  if (config.isError || !config.data.branding) {
    return <p className="text-coral-d text-sm">Couldn&rsquo;t load the settings. Reload the page to try again.</p>
  }
  const rows = config.data
  return (
    <div className="space-y-6">
      {tab === 'branding' ? <BrandingTab row={rows.branding} /> : null}
      {tab === 'colors' ? <AppearanceTab row={rows.theme} /> : null}
      {tab === 'terminology' ? <TerminologyTab row={rows.terminology} /> : null}
      {tab === 'features' ? <FeaturesTab row={rows.features} /> : null}
      <p className="text-muted-foreground flex items-start gap-2 text-xs" data-testid="build-time-note">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Not editable here: the Android app&rsquo;s icon, name and splash screen (set when the app is built) and the sign-up and
        password emails (set in the Supabase dashboard).
      </p>
    </div>
  )
}
