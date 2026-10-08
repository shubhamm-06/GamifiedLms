import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'
import { readSection, type SectionKey, type Settings } from '@/lib/settings/schema'
import { getSettingsSnapshot, getSettingsVersions, publicSettingsQueryKey, setSettings } from '@/lib/settings/store'

export const siteConfigKey = ['admin', 'site-config'] as const

export interface SiteConfigRow<K extends SectionKey = SectionKey> {
  key: K
  value: Settings[K]
  version: number
}

/** The admin's own read of `site_config` (RLS: admins only), every section merged over its defaults. */
export function useSiteConfig() {
  return useQuery({
    queryKey: siteConfigKey,
    queryFn: async () => {
      const { data, error } = await supabase.from('site_config').select('key, value, version')
      if (error) throw error
      const rows = {} as { [K in SectionKey]: SiteConfigRow<K> }
      for (const r of data ?? []) {
        const key = r.key as SectionKey
        ;(rows as Record<SectionKey, SiteConfigRow>)[key] = { key, value: readSection(key, r.value), version: r.version }
      }
      return rows
    },
  })
}

/** A save hit a newer version: someone else saved this section after it was loaded. */
export class SettingsConflictError extends Error {
  constructor() {
    super('Settings were changed by someone else. Reload to continue.')
  }
}

/**
 * Compare-and-swap save of one section: `update ... where key = $1 and version = $2`.
 * The version is bumped by the database (migration 041); zero rows back means a newer
 * version exists, which is reported as a conflict and the draft is kept. On success the
 * live settings and their cache update at once (this tab), and the public query is
 * invalidated so other tabs refresh on focus.
 */
export function useSaveSiteConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ key, value, version }: { key: SectionKey; value: Settings[SectionKey]; version: number }) => {
      const { data, error } = await supabase
        .from('site_config')
        .update({ value: value as unknown as Json })
        .eq('key', key)
        .eq('version', version)
        .select('key, value, version')
      if (error) throw error
      if (!data || data.length !== 1) throw new SettingsConflictError()
      return { key, value: readSection(key, data[0].value), version: data[0].version }
    },
    onSuccess: (saved) => {
      setSettings({
        settings: { ...getSettingsSnapshot(), [saved.key]: saved.value },
        versions: { ...getSettingsVersions(), [saved.key]: saved.version },
      })
      void queryClient.invalidateQueries({ queryKey: siteConfigKey })
      void queryClient.invalidateQueries({ queryKey: publicSettingsQueryKey })
    },
  })
}

// ---------------------------------------------------------------- branding files

export const BRANDING_BUCKET = 'branding'

export type BrandingFileKind = 'logo' | 'favicon' | 'background'

export const BRANDING_FILE_RULES: Record<BrandingFileKind, { maxBytes: number; types: string[]; hint: string }> = {
  logo: {
    maxBytes: 1024 * 1024,
    types: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
    hint: 'PNG, SVG, WebP or JPEG, up to 1 MB. About 320 x 64 px (wide), transparent background.',
  },
  favicon: {
    maxBytes: 256 * 1024,
    types: ['image/png', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'],
    hint: 'PNG, SVG or ICO, up to 256 KB. Square, 64 x 64 px or larger.',
  },
  background: {
    maxBytes: 2 * 1024 * 1024,
    types: ['image/png', 'image/jpeg', 'image/webp'],
    hint: 'JPEG, PNG or WebP, up to 2 MB. About 1920 x 1080 px.',
  },
}

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
}

/** Client-side check before any upload; the bucket enforces types and a 2 MB cap again. */
export function checkBrandingFile(kind: BrandingFileKind, file: File): string | null {
  const rule = BRANDING_FILE_RULES[kind]
  if (!rule.types.includes(file.type)) return 'That file type is not allowed here.'
  if (file.size > rule.maxBytes) return `That file is too big (max ${Math.round(rule.maxBytes / 1024)} KB).`
  return null
}

/** Upload to `branding/<kind>-<timestamp>.<ext>` and return the public URL. */
export async function uploadBrandingFile(kind: BrandingFileKind, file: File): Promise<string> {
  const path = `${kind}-${Date.now()}.${EXT[file.type] ?? 'bin'}`
  const { error } = await supabase.storage.from(BRANDING_BUCKET).upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw error
  return supabase.storage.from(BRANDING_BUCKET).getPublicUrl(path).data.publicUrl
}

/** Remove files this project's bucket holds (anything else is ignored). Best effort. */
export async function deleteBrandingFiles(urls: string[]): Promise<void> {
  const marker = `/storage/v1/object/public/${BRANDING_BUCKET}/`
  const paths = urls.filter((u) => u.includes(marker)).map((u) => decodeURIComponent(u.split(marker)[1].split('?')[0]))
  if (paths.length) await supabase.storage.from(BRANDING_BUCKET).remove(paths)
}
