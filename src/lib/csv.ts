/**
 * Minimal, dependency-free CSV read/write. No library installed for this,
 * and the format is simple enough (quoted fields, escaped `""`, comma
 * delimiter) that a small hand-written parser is safer than pulling in a
 * new dependency for it — matching how this codebase already avoids
 * reaching for a package where a short utility does the job (e.g.
 * `src/lib/video.ts`'s embed-URL parsing).
 */

/** Parses CSV text into rows of raw string cells. Handles quoted fields containing commas, quotes (`""`), and newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let sawAnyContent = false
  let i = 0

  while (i < text.length) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += char
      i++
      continue
    }

    if (char === '"') {
      inQuotes = true
      sawAnyContent = true
      i++
      continue
    }
    if (char === ',') {
      row.push(field)
      field = ''
      sawAnyContent = true
      i++
      continue
    }
    if (char === '\r') {
      i++
      continue
    }
    if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      sawAnyContent = false
      i++
      continue
    }
    field += char
    sawAnyContent = true
    i++
  }

  // A file not ending in a newline still has one trailing row to flush.
  if (sawAnyContent || field.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

/** Serialises rows into CSV text, quoting any cell containing a comma, quote, or newline. */
export function stringifyCsv(rows: (string | number)[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const str = String(cell)
          return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
        })
        .join(','),
    )
    .join('\r\n')
}

/** Triggers a browser download of `content` as a file named `filename`. */
export function downloadTextFile(filename: string, content: string, mimeType = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
