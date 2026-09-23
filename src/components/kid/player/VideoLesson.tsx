import { useState } from 'react'
import { Play } from 'lucide-react'
import { videoSource } from '@/lib/lessonPlayer'
import { playerCopy } from '@/lib/playerCopy'
import { PlayerError } from './PlayerError'

/**
 * A video lesson. A normalized YouTube or Vimeo embed goes in a frame (a
 * different origin, so letting it run scripts and keep its own storage does
 * not touch ours); anything else that is a plain https file or stream goes in
 * a native video element, behind a tap-to-play overlay so it (and its audio)
 * never starts before the child is ready (spec Part B4). Watching is not
 * tracked: the minimum time is counted by the heartbeat, not by playback.
 */
export function VideoLesson({ url, title, courseId }: { url: string | null; title: string; courseId: string }) {
  const source = videoSource(url, import.meta.env.DEV)
  const [started, setStarted] = useState(false)
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
      <video
        controls={started}
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture
        playsInline
        preload="metadata"
        src={source.url}
        aria-label={title}
        autoPlay={started}
        onError={() => setFailed(true)}
      >
        Your device can&rsquo;t play this video.
      </video>
      {!started ? (
        <button
          type="button"
          className="lp-play-overlay kid-tap"
          aria-label={playerCopy.button.playVideo}
          onClick={() => setStarted(true)}
          data-testid="video-play"
        >
          <span className="lp-play-button">
            <Play className="size-8" fill="currentColor" strokeWidth={0} />
          </span>
        </button>
      ) : null}
    </div>
  )
}
