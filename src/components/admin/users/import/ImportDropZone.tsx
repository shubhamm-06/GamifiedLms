import { useId, useState, type ChangeEvent, type DragEvent } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IMPORT_MAX_ROWS } from '@/lib/userImport'

interface ImportDropZoneProps {
  onFile: (file: File) => void
  /** Why the last file was refused, shown under the zone. */
  error: string | null
}

/**
 * Drag-and-drop or click-to-browse for one .csv file. The real `<input>` is
 * visually hidden but still focusable, so keyboard users reach it and the
 * whole zone (its `<label>`) lights up when it has focus.
 */
export function ImportDropZone({ onFile, error }: ImportDropZoneProps) {
  const inputId = useId()
  const [dragging, setDragging] = useState(false)

  function handleDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Clear the input so picking the same file again (after fixing it) still fires.
    e.target.value = ''
    if (file) onFile(file)
  }

  return (
    <div className="space-y-2">
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors',
          'focus-within:ring-ring/50 focus-within:ring-3',
          dragging ? 'border-primary bg-accent' : 'border-border hover:bg-muted/50',
        )}
      >
        <Upload className="text-muted-foreground size-6" />
        <span className="font-medium">
          Drop a .csv file here, or <span className="underline">browse</span>
        </span>
        <span className="text-muted-foreground text-xs">
          CSV only · up to 2 MB and {IMPORT_MAX_ROWS} rows
        </span>
        <input
          id={inputId}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={handleChange}
        />
      </label>
      {error ? (
        <p role="alert" className="text-coral-d text-sm">
          {error}
        </p>
      ) : null}
    </div>
  )
}
