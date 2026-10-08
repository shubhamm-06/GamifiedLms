import { useRef, useState } from 'react'
import { ImageUp, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BRANDING_FILE_RULES, checkBrandingFile, uploadBrandingFile, type BrandingFileKind } from '@/hooks/admin/useSiteConfig'

/**
 * One branding image (logo, favicon, login background): pick a file, checked for type
 * and size before anything is sent, uploaded to the `branding` bucket, previewed.
 * Replace and Remove only change the draft; the old file is deleted when the tab is
 * saved (or the new one when it is discarded), by `useSectionDraft`. Always an <img>,
 * so an SVG can never run anything.
 */
export function ImageUpload({
  id,
  kind,
  label,
  value,
  error,
  onChange,
  onUploaded,
}: {
  id: string
  kind: BrandingFileKind
  label: string
  value: string
  error?: string
  onChange: (url: string) => void
  onUploaded: (url: string) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const rule = BRANDING_FILE_RULES[kind]

  async function pick(file: File | undefined) {
    if (!file) return
    const bad = checkBrandingFile(kind, file)
    setProblem(bad)
    if (bad) return
    setBusy(true)
    try {
      const url = await uploadBrandingFile(kind, file)
      onUploaded(url)
      onChange(url)
    } catch {
      setProblem("Couldn't upload that file. Try again.")
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const message = problem ?? error
  return (
    <div className="space-y-1.5" data-testid={`upload-${kind}`}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-3">
        <div className="bg-muted/50 flex h-14 w-28 shrink-0 items-center justify-center overflow-hidden rounded-md border">
          {value ? (
            <img src={value} alt="" className="max-h-12 max-w-24 object-contain" data-testid={`upload-${kind}-preview`} />
          ) : (
            <span className="text-muted-foreground text-xs">None</span>
          )}
        </div>
        <input
          ref={input}
          id={id}
          type="file"
          accept={rule.types.join(',')}
          className="sr-only"
          // The Upload / Replace button is the keyboard stop; the hidden input is not.
          tabIndex={-1}
          onChange={(e) => void pick(e.target.files?.[0])}
          data-testid={`upload-${kind}-input`}
        />
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? <Loader2 className="animate-spin" /> : <ImageUp />}
          {value ? 'Replace' : 'Upload'}
        </Button>
        {value ? (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => onChange('')} data-testid={`upload-${kind}-remove`}>
            <Trash2 />
            Remove
          </Button>
        ) : null}
      </div>
      {message ? <p className="text-coral-d text-sm">{message}</p> : <p className="text-muted-foreground text-xs">{rule.hint}</p>}
    </div>
  )
}
