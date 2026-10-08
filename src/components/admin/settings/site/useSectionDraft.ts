import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { DEFAULT_SETTINGS, strictSchemas, type SectionKey, type Settings } from '@/lib/settings/schema'
import { SettingsConflictError, deleteBrandingFiles, useSaveSiteConfig, type SiteConfigRow } from '@/hooks/admin/useSiteConfig'

/** Every branding-bucket URL anywhere in a section value (logo, favicon, login background). */
function fileUrls(value: unknown): string[] {
  const out: string[] = []
  const walk = (v: unknown) => {
    if (typeof v === 'string' && v.includes('/storage/v1/object/public/branding/')) out.push(v)
    else if (v && typeof v === 'object') Object.values(v).forEach(walk)
  }
  walk(value)
  return out
}

/**
 * One tab's draft: dirty state, strict validation (the same zod rules the reader
 * uses, without the per-field fallbacks), Save / Discard / Reset to defaults. The
 * draft never touches the live app until Save succeeds. Uploaded files are tracked
 * so an unsaved upload is removed on Discard and a replaced one after Save.
 */
export function useSectionDraft<K extends SectionKey>(row: SiteConfigRow<K>, opts: { onSaved?: () => void } = {}) {
  const [saved, setSaved] = useState<{ value: Settings[K]; version: number }>({ value: row.value, version: row.version })
  const [draft, setDraft] = useState<Settings[K]>(row.value)
  const [conflict, setConflict] = useState(false)
  const uploaded = useRef(new Set<string>())
  const save = useSaveSiteConfig()

  // A refetch after someone else's save brings a newer row: adopt it (during render, React's
  // "adjust state when a prop changes" pattern) when there is nothing unsaved.
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved.value)
  if (row.version > saved.version && !dirty) {
    setSaved({ value: row.value, version: row.version })
    setDraft(row.value)
    setConflict(false)
  }

  const parsed = useMemo(() => strictSchemas[row.key].safeParse(draft), [draft, row.key])
  const errors = useMemo(() => {
    const map: Record<string, string> = {}
    if (!parsed.success) for (const i of parsed.error.issues) map[i.path.join('.')] ??= i.message
    return map
  }, [parsed])

  function track(url: string) {
    uploaded.current.add(url)
  }

  async function onSave() {
    if (!parsed.success) return
    const value = parsed.data as Settings[K]
    try {
      const result = await save.mutateAsync({ key: row.key, value, version: saved.version })
      const before = fileUrls(saved.value)
      const after = new Set(fileUrls(result.value))
      // Files that were live before and are not any more, and unsaved uploads that lost out.
      void deleteBrandingFiles([...before, ...uploaded.current].filter((u) => !after.has(u)))
      uploaded.current.clear()
      setSaved({ value: result.value as Settings[K], version: result.version })
      setDraft(result.value as Settings[K])
      setConflict(false)
      toast.success('Settings saved. Everyone sees the change now.')
      opts.onSaved?.()
    } catch (e) {
      if (e instanceof SettingsConflictError) {
        setConflict(true)
        toast.error(e.message)
      } else {
        toast.error("Couldn't save the settings. Check your connection and try again.")
      }
    }
  }

  function onDiscard() {
    const live = new Set(fileUrls(saved.value))
    void deleteBrandingFiles([...uploaded.current].filter((u) => !live.has(u)))
    uploaded.current.clear()
    setDraft(saved.value)
  }

  function onResetToDefaults() {
    setDraft(structuredClone(DEFAULT_SETTINGS[row.key]))
  }

  return {
    draft,
    setDraft,
    dirty,
    valid: parsed.success,
    errors,
    saving: save.isPending,
    conflict,
    onSave,
    onDiscard,
    onResetToDefaults,
    track,
  }
}
