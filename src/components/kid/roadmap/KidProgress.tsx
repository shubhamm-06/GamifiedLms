/** Chunky course progress bar: gold fill on an ink-tinted track. */
export function KidProgress({ percent, label }: { percent: number; label: string }) {
  return (
    <div
      className="kid-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={label}
    >
      <div className="kid-progress-fill" style={{ width: `${percent}%` }} />
    </div>
  )
}
