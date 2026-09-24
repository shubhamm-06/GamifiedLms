import { useState } from 'react'
import { videoSource } from '@/lib/lessonPlayer'
import { playerCopy } from '@/lib/playerCopy'
import { PlayerError } from './PlayerError'


/** Adds `autoplay=1` to a normalized YouTube/Vimeo embed URL: the child already tapped Play. */
function withAutoplay(url: string): string {
  const u = new URL(url)
  u.searchParams.set('autoplay', '1')
  return u.toString()
}

/**
 * A video lesson, mounted only after the child taps Play on the activity card,
 * so it starts right away: a normalized YouTube or Vimeo embed (a different
 * origin, so its scripts and storage do not touch ours) gets `autoplay=1`, and
 * a plain https file plays in a native video element with its controls. Where
 * a browser still blocks autoplay with sound (some iOS versions), the visible
 * controls are the fallback. Watching is not tracked: the minimum time is
 * counted by the heartbeat, not by playback.
 */
export function VideoLesson({ url, title, courseId }: { url: string | null; title: string; courseId: string }) {
  const source = videoSource(url, import.meta.env.DEV)
  const [failed, setFailed] = useState(false)

  if (!source) {
    return (
      <div className="lp-frame">
        <PlayerError
          heading={playerCopy.video.unavailable.heading}
          body={playerCopy.video.unavailable.body}
          action={{ kind: 'back', courseId }}
          testId="video-unavailable"
        />
      </div>
    )
  }

  if (failed) {
    return (
      <div className="lp-frame">
        <PlayerError
          heading={playerCopy.video.failed.heading}
          body={playerCopy.video.failed.body}
          action={{ kind: 'retry', onRetry: () => setFailed(false) }}
          testId="video-failed"
        />
      </div>
    )
  }

  if (source.kind === 'embed') {
    return (
      <div className="lp-frame" data-testid="video-embed">
        <iframe
          src={withAutoplay(source.url)}
          title={title}
          sandbox="allow-scripts allow-same-origin allow-presentation"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    )
  }

  return (
    <div className="lp-frame" data-testid="video-file">
      <video
        controls
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture
        playsInline
        autoPlay
        preload="metadata"
        src={source.url}
        aria-label={title}
        onError={() => setFailed(true)}
      >
        Your device can&rsquo;t play this video.
      </video>
    </div>
  )
}
