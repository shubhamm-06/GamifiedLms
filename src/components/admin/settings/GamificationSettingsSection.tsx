import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppSettings, useUpdateAppSettings, type AppSettings } from '@/hooks/useAppSettings'

/**
 * Mounted with `key={settings.id}` by the parent, same "mount fresh from a
 * query-loaded singleton row" trick `PlatformSettingsSection` used before
 * this file split off it — there's no dialog open/close moment to reset
 * local state on, so a stable key that only changes if the row itself
 * changes (it never does) stands in for one.
 */
function GamificationSettingsForm({ settings }: { settings: AppSettings }) {
  const updateSettings = useUpdateAppSettings()
  const [threshold, setThreshold] = useState(String(settings.quiz_pass_threshold_percent))

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const parsed = Number(threshold)
    updateSettings.mutate({
      id: settings.id,
      quiz_pass_threshold_percent: Number.isFinite(parsed)
        ? parsed
        : settings.quiz_pass_threshold_percent,
    })
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="quiz-pass-threshold">Quiz pass threshold (%)</Label>
        <Input
          id="quiz-pass-threshold"
          type="number"
          min={0}
          max={100}
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
        />
        <p className="text-muted-foreground text-xs">
          Not used anywhere yet — quiz grading doesn&rsquo;t exist. Stored here so it&rsquo;s ready
          when it does.
        </p>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={updateSettings.isPending}>
          {updateSettings.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}

/**
 * Alone in this tab for now, matching the sidebar's own "Gamification"
 * naming for this area — Badges & XP live under their own future nav
 * entry, not here; this is only the one setting quiz grading will
 * eventually read.
 */
export function GamificationSettingsSection() {
  const { data: settings, isPending, isError } = useAppSettings()

  if (isPending) {
    return (
      <div className="rounded-lg border p-4">
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (isError || !settings) {
    return <p className="text-coral-d text-sm">Couldn&rsquo;t load platform settings.</p>
  }

  return (
    <section className="rounded-lg border p-4">
      <GamificationSettingsForm key={settings.id} settings={settings} />
    </section>
  )
}
