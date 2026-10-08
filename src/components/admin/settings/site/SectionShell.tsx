import type { ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

/** What the frame needs from a tab's draft (`useSectionDraft`). */
interface ShellDraft {
  dirty: boolean
  valid: boolean
  saving: boolean
  conflict: boolean
  onSave: () => Promise<void>
  onDiscard: () => void
  onResetToDefaults: () => void
}

/** The frame every settings tab shares: description, the form, then Save / Discard / Reset. */
export function SectionShell({
  title,
  description,
  draft,
  children,
}: {
  title: string
  description: string
  draft: ShellDraft
  children: ReactNode
}) {
  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        void draft.onSave()
      }}
      data-testid="settings-section"
    >
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>

      {draft.conflict ? (
        <div role="alert" className="border-coral-d/40 bg-coral/10 text-coral-d rounded-md border px-3 py-2 text-sm" data-testid="settings-conflict">
          Settings were changed by someone else. Reload to continue. Your changes are kept below.{' '}
          <button type="button" className="font-medium underline underline-offset-2" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      ) : null}

      {children}

      <div className="bg-background sticky bottom-0 flex flex-wrap items-center gap-2 border-t py-3">
        <Button type="submit" disabled={!draft.dirty || !draft.valid || draft.saving} data-testid="settings-save">
          {draft.saving ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" variant="outline" disabled={!draft.dirty || draft.saving} onClick={draft.onDiscard} data-testid="settings-discard">
          Discard
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="ghost" disabled={draft.saving} data-testid="settings-reset">
              Reset to defaults
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset this tab to the defaults?</AlertDialogTitle>
              <AlertDialogDescription>
                The fields go back to the built-in values. Nothing changes for learners until you press Save.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={draft.onResetToDefaults}>Reset fields</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <span className="text-muted-foreground ml-auto text-sm" aria-live="polite" data-testid="settings-dirty">
          {draft.dirty ? (draft.valid ? 'Unsaved changes' : 'Fix the highlighted fields to save') : 'All changes saved'}
        </span>
      </div>
    </form>
  )
}

/** Label + control + error-or-hint, the admin form convention. */
export function SettingField({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: ReactNode
  error?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-coral-d text-sm" id={`${id}-error`}>
          {error}
        </p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  )
}
