import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Course thumbnail with its space reserved (16:9) so nothing shifts as it loads.
 * No thumbnail — or one that fails to load — becomes a token-coloured placeholder.
 */
export function CourseArt({ url, className }: { url: string | null; className?: string }) {
  const [failed, setFailed] = useState(false)
  const showImage = !!url && !failed
  return (
    <div
      className={cn('relative aspect-[16/9] w-full overflow-hidden rounded-[20px] bg-teal', className)}
      data-testid="course-art"
    >
      {showImage ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-ink" aria-hidden>
          <BookOpen className="size-12" strokeWidth={2.25} />
        </div>
      )}
    </div>
  )
}
