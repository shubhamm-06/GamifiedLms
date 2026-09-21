import { videoSource } from '@/lib/lessonPlayer'
import { LessonMessage } from './LessonMessage'

/**
 * A video lesson. A normalized YouTube or Vimeo embed goes in a frame (these are
 * different origins, so letting them run scripts and keep their own storage does
 * not touch ours); anything else that is a plain https file or stream goes in a
 * native video element. Other URLs (or none) show a friendly message instead of
 * loading. Watching is not tracked: the minimum time is counted by the heartbeat,
 * not by playback.
 */
export function VideoLesson({ url, title }: { url: string | null; title: string }) {
  const source = videoSource(url, import.meta.env.DEV)
  if (!source) {
    return <LessonMessage testId="video-unavailable">This video isn&rsquo;t ready yet. Please check back soon.</LessonMessage>
  }
  if (source.kind === 'embed') {
    return (
      <div className="lp-frame" data-testid="video-embed">
        <iframe
          src={source.url}
          title={title}
          sandbox="allow-scripts allow-same-origin allow-presentation"
          allow="fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          loading="lazy"
        />
      </div>
    )
  }
  return (
    <div className="lp-frame" data-testid="video-file">
      <video controls playsInline preload="metadata" src={source.url} aria-label={title}>
        Your device can&rsquo;t play this video.
      </video>
    </div>
  )
}
