import { useState } from 'react'
import { toast } from 'sonner'
import {
  collectUsersForExport,
  downloadUsersCsv,
  type ExportScope,
  type UserExportSource,
} from '@/lib/userExport'

/**
 * Runs a users export and reports it: builds the file, saves it, and toasts the
 * row count. Shared by the Export menu and the bulk bar's "Export selected" so
 * both behave identically. Failures say so without leaking the underlying error.
 */
export function useUsersExport(source: UserExportSource) {
  const [isExporting, setIsExporting] = useState(false)

  async function run(scope: ExportScope, includeTrashed = false) {
    if (isExporting) return
    setIsExporting(true)
    try {
      const users = await collectUsersForExport(scope, includeTrashed, source)
      if (users.length === 0) {
        toast.info('No users to export')
        return
      }
      const count = downloadUsersCsv(users)
      toast.success(`Exported ${count} ${count === 1 ? 'user' : 'users'}`)
    } catch {
      toast.error("Couldn't export users. Please try again.")
    } finally {
      setIsExporting(false)
    }
  }

  return { run, isExporting }
}
