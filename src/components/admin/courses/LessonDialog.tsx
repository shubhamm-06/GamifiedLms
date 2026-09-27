import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  type ContentType,
  type Lesson,
  type LessonFormValues,
} from '@/hooks/admin/useCurriculum'
import { useGames } from '@/hooks/admin/useGames'
import {
  DEFAULT_MIN_TIME_SECONDS,
  DEFAULT_PASS_PERCENTAGE,
  defaultMinTimeFor,
  describeEffectiveXp,
  validateMinTime,
  validatePassPercentage,
  validateXpOverride,
} from '@/lib/lessonSettings'
import { cn } from '@/lib/utils'
import { isEmbedUrl, normalizeEmbedUrl } from '@/lib/video'
import { DocBlocksEditor } from './DocBlocksEditor'
import { MinTimeField } from './MinTimeField'
import { QuizQuestionsEditor } from './QuizQuestionsEditor'

type VideoMode = 'direct' | 'embed'

/** The two course fields that decide what XP a lesson really awards. */
export interface LessonCourseXp {
  default_lesson_xp: number
  gamification_enabled: boolean
}

const EMPTY_LESSON: LessonFormValues = {
  title: '',
  summary: '',
  content_type: 'video',
  video_url: '',
  content_html: '',
  game_id: '',
  duration_seconds: '',
  xp_reward: '',
  // A new video lesson: the video/game/text default. Switching the type on an
  // unedited new lesson re-derives it (see handleTypeChange).
  min_time_seconds: String(DEFAULT_MIN_TIME_SECONDS),
  pass_percentage: String(DEFAULT_PASS_PERCENTAGE),
  is_preview: false,
  status: 'draft',
}

function lessonToFormValues(lesson: Lesson): LessonFormValues {
  return {
    title: lesson.title,
    summary: lesson.summary ?? '',
    content_type: lesson.content_type as ContentType,
    video_url: lesson.video_url ?? '',
    content_html: lesson.content_html ?? '',
    game_id: lesson.game_id ?? '',
    duration_seconds: lesson.duration_seconds == null ? '' : String(lesson.duration_seconds),
    xp_reward: lesson.xp_reward == null ? '' : String(lesson.xp_reward),
    min_time_seconds: String(lesson.min_time_seconds),
    // NULL for every non-quiz lesson (migration 028) — the form still shows
    // the same 70% pre-fill a brand-new quiz lesson gets, in case this
    // lesson's type is switched to quiz, rather than a literal "null".
    pass_percentage: lesson.pass_percentage == null ? String(DEFAULT_PASS_PERCENTAGE) : String(lesson.pass_percentage),
    is_preview: lesson.is_preview,
    status: lesson.status,
  }
}

interface LessonDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The lesson being edited, or null when creating a new one. */
  lesson: Lesson | null
  /** For the effective-XP helper text; absent while the course is still loading. */
  course: LessonCourseXp | null
  isSubmitting: boolean
  onSubmit: (values: LessonFormValues) => void
}

/** Mounts fresh per open, so switching lessons never carries over stale state. */
function LessonForm({
  lesson,
  course,
  isSubmitting,
  onSubmit,
  onCancel,
}: {
  lesson: Lesson | null
  course: LessonCourseXp | null
  isSubmitting: boolean
  onSubmit: (values: LessonFormValues) => void
  onCancel: () => void
}) {
  const [values, setValues] = useState<LessonFormValues>(
    lesson ? lessonToFormValues(lesson) : EMPTY_LESSON,
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  // Whether the admin has touched the minimum-time field. While it is false on
  // a NEW lesson, changing the content type re-derives the pre-fill (90 for
  // video/game/text, 0 for quiz); once touched, the type never overwrites it.
  // An existing lesson's saved value is never re-derived.
  const [minTimeTouched, setMinTimeTouched] = useState(false)
  // Not a stored field — there is no column marking a video as "embedded".
  // Defaults from whatever's already saved: an existing embed URL opens back
  // into Embed mode rather than looking like a mismatched direct link.
  const [videoMode, setVideoMode] = useState<VideoMode>(() =>
    lesson?.video_url && isEmbedUrl(lesson.video_url) ? 'embed' : 'direct',
  )
  const { data: games } = useGames()

  function set<K extends keyof LessonFormValues>(field: K, value: LessonFormValues[K]) {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  function handleTypeChange(contentType: ContentType) {
    setValues((prev) => ({
      ...prev,
      content_type: contentType,
      min_time_seconds:
        !lesson && !minTimeTouched
          ? String(defaultMinTimeFor(contentType))
          : prev.min_time_seconds,
    }))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (!values.title.trim()) next.title = 'Title is required.'

    // Same ranges as the database checks, with readable messages.
    const timeError = validateMinTime(values.min_time_seconds)
    if (timeError) next.min_time_seconds = timeError
    if (values.content_type === 'quiz') {
      const passError = validatePassPercentage(values.pass_percentage)
      if (passError) next.pass_percentage = passError
    }
    const xpError = validateXpOverride(values.xp_reward)
    if (xpError) next.xp_reward = xpError

    // video_url is optional either way, so an empty field isn't an error —
    // only a non-empty value that doesn't parse as a YouTube/Vimeo link is.
    // Never store the raw input in that failure case; either it's the
    // normalized embed URL or the save is refused.
    let videoUrl = values.video_url
    if (values.content_type === 'video' && videoMode === 'embed' && values.video_url.trim()) {
      const normalized = normalizeEmbedUrl(values.video_url)
      if (!normalized) {
        next.video_url = "That doesn't look like a YouTube or Vimeo link."
      } else {
        videoUrl = normalized
      }
    }

    setErrors(next)
    if (Object.keys(next).length > 0) return
    onSubmit({ ...values, video_url: videoUrl })
  }

  const hasGames = (games?.length ?? 0) > 0

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="lesson-title">Title</Label>
        <Input
          id="lesson-title"
          value={values.title}
          aria-invalid={!!errors.title}
          onChange={(e) => set('title', e.target.value)}
        />
        {errors.title ? <p className="text-coral-d text-sm">{errors.title}</p> : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="lesson-summary">Summary</Label>
        <Textarea
          id="lesson-summary"
          rows={2}
          value={values.summary}
          onChange={(e) => set('summary', e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="lesson-type">Content type</Label>
        <Select
          value={values.content_type}
          onValueChange={(v) => handleTypeChange(v as ContentType)}
        >
          <SelectTrigger id="lesson-type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="video">Video</SelectItem>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="quiz">Quiz</SelectItem>
            <SelectItem value="game">Game</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Only the field matching the chosen type is shown; the others are
          cleared on save so a stale value can't linger in the row. */}
      {values.content_type === 'video' ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="lesson-video">Video URL</Label>
            {/* Two plain buttons rather than a new shadcn radio-group/
                toggle-group — the CLI's alias bug has hit this repo three
                times already, and a two-option switch doesn't need a new
                dependency to get right. */}
            <div
              role="radiogroup"
              aria-label="Video link type"
              className="inline-flex rounded-md border p-0.5"
            >
              {(['direct', 'embed'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={videoMode === mode}
                  onClick={() => setVideoMode(mode)}
                  className={cn(
                    'rounded-sm px-2.5 py-1 text-xs font-medium transition-colors',
                    videoMode === mode
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {mode === 'direct' ? 'Direct URL' : 'Embed link'}
                </button>
              ))}
            </div>
          </div>
          <Input
            id="lesson-video"
            value={values.video_url}
            placeholder={videoMode === 'embed' ? 'https://youtu.be/… or https://vimeo.com/…' : 'https://…'}
            aria-invalid={!!errors.video_url}
            onChange={(e) => set('video_url', e.target.value)}
          />
          {errors.video_url ? (
            <p className="text-coral-d text-sm">{errors.video_url}</p>
          ) : (
            <p className="text-muted-foreground text-xs">
              {videoMode === 'embed'
                ? 'Paste a YouTube or Vimeo share link — it will be converted to an embeddable URL on save.'
                : "Paste a hosted or streaming file URL. Upload isn't wired yet (no Storage bucket exists)."}
            </p>
          )}
        </div>
      ) : null}

      {values.content_type === 'text' ? (
        <div className="space-y-1.5">
          <Label htmlFor="lesson-html">Content</Label>
          <Textarea
            id="lesson-html"
            rows={6}
            className="font-mono text-xs"
            value={values.content_html}
            onChange={(e) => set('content_html', e.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            Raw HTML for now — a rich-text editor is a separate decision.
          </p>
        </div>
      ) : null}

      {values.content_type === 'game' ? (
        <div className="space-y-1.5">
          <Label htmlFor="lesson-game">Game</Label>
          {hasGames ? (
            <Select value={values.game_id} onValueChange={(v) => set('game_id', v)}>
              <SelectTrigger id="lesson-game" className="w-full">
                <SelectValue placeholder="Select a game…" />
              </SelectTrigger>
              <SelectContent>
                {games!.map((game) => (
                  <SelectItem key={game.id} value={game.id}>
                    {game.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <>
              <Input
                id="lesson-game"
                value={values.game_id}
                placeholder="Paste a game UUID"
                onChange={(e) => set('game_id', e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                No games exist yet — paste a game UUID manually, or add games first.
              </p>
            </>
          )}
        </div>
      ) : null}

      {/* Stored settings only — nothing enforces either yet (docs/rules.md). */}
      <MinTimeField
        id="lesson-min-time"
        value={values.min_time_seconds}
        error={errors.min_time_seconds}
        onChange={(v) => {
          setMinTimeTouched(true)
          set('min_time_seconds', v)
        }}
      />

      {values.content_type === 'quiz' ? (
        <div className="space-y-1.5">
          <Label htmlFor="lesson-pass">Pass mark</Label>
          <div className="flex items-center gap-2">
            <Input
              id="lesson-pass"
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              step={1}
              className="w-28"
              value={values.pass_percentage}
              aria-invalid={!!errors.pass_percentage}
              onChange={(e) => set('pass_percentage', e.target.value)}
            />
            <span className="text-muted-foreground text-sm">%</span>
          </div>
          {errors.pass_percentage ? (
            <p className="text-coral-d text-sm">{errors.pass_percentage}</p>
          ) : (
            <p className="text-muted-foreground text-xs">
              Kids must score at least this to pass. Retries are unlimited.
            </p>
          )}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="lesson-duration">Duration (seconds)</Label>
          <Input
            id="lesson-duration"
            type="number"
            min={0}
            value={values.duration_seconds}
            onChange={(e) => set('duration_seconds', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lesson-xp">XP reward</Label>
          <Input
            id="lesson-xp"
            type="number"
            min={0}
            value={values.xp_reward}
            aria-invalid={!!errors.xp_reward}
            onChange={(e) => set('xp_reward', e.target.value)}
          />
          {errors.xp_reward ? (
            <p className="text-coral-d text-sm">{errors.xp_reward}</p>
          ) : (
            <p className="text-muted-foreground text-xs">
              {course
                ? `Blank uses the course default (${course.default_lesson_xp} XP). ${describeEffectiveXp(values.xp_reward, course)}`
                : 'Blank uses the course default.'}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="lesson-status">Status</Label>
        <Select value={values.status} onValueChange={(v) => set('status', v)}>
          <SelectTrigger id="lesson-status" className="w-full sm:w-1/2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <Label htmlFor="lesson-preview">Free preview</Label>
          <p className="text-muted-foreground text-xs">Viewable without enrolling.</p>
        </div>
        <Switch
          id="lesson-preview"
          checked={values.is_preview}
          onCheckedChange={(checked) => set('is_preview', checked)}
        />
      </div>

      {/* Questions/blocks live in the same dialog rather than a separate
          route — but only exist once the lesson does, since both need a
          lesson_id. */}
      {values.content_type === 'quiz' && lesson ? (
        <QuizQuestionsEditor lessonId={lesson.id} />
      ) : values.content_type === 'quiz' ? (
        <p className="text-muted-foreground border-t pt-4 text-sm">
          Save the lesson first, then reopen it to add questions.
        </p>
      ) : values.content_type === 'text' && lesson ? (
        <DocBlocksEditor lessonId={lesson.id} />
      ) : values.content_type === 'text' ? (
        <p className="text-muted-foreground border-t pt-4 text-sm">
          Save the lesson first, then reopen it to add content blocks.
        </p>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : lesson ? 'Save lesson' : 'Add lesson'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function LessonDialog({
  open,
  onOpenChange,
  lesson,
  course,
  isSubmitting,
  onSubmit,
}: LessonDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Wider than the Users dialogs (sm:max-w-md) — this form has more
          fields plus a conditional block and, for quiz lessons, the nested
          question editor, so the default/narrow width feels cramped.
          max-h/overflow-y-auto since that combination can run tall. */}
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{lesson ? 'Edit lesson' : 'New lesson'}</DialogTitle>
          <DialogDescription>
            {lesson ? lesson.title : 'Added to the selected topic.'}
          </DialogDescription>
        </DialogHeader>
        {/* Keyed so switching between lessons remounts with fresh state
            instead of carrying the previous lesson's values over. */}
        <LessonForm
          key={lesson?.id ?? 'new'}
          lesson={lesson}
          course={course}
          isSubmitting={isSubmitting}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
