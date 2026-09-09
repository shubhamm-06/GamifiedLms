import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  useGames,
  type ContentType,
  type Lesson,
  type LessonFormValues,
} from '@/hooks/admin/useCurriculum'
import { QuizQuestionsEditor } from './QuizQuestionsEditor'

const EMPTY_LESSON: LessonFormValues = {
  title: '',
  summary: '',
  content_type: 'video',
  video_url: '',
  content_html: '',
  game_id: '',
  duration_seconds: '',
  xp_reward: '',
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
    is_preview: lesson.is_preview,
    status: lesson.status,
  }
}

interface LessonSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The lesson being edited, or null when creating a new one. */
  lesson: Lesson | null
  isSubmitting: boolean
  onSubmit: (values: LessonFormValues) => void
}

function LessonFields({
  lesson,
  isSubmitting,
  onSubmit,
  onCancel,
}: {
  lesson: Lesson | null
  isSubmitting: boolean
  onSubmit: (values: LessonFormValues) => void
  onCancel: () => void
}) {
  const [values, setValues] = useState<LessonFormValues>(
    lesson ? lessonToFormValues(lesson) : EMPTY_LESSON,
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { data: games } = useGames()

  function set<K extends keyof LessonFormValues>(field: K, value: LessonFormValues[K]) {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (!values.title.trim()) next.title = 'Title is required.'
    setErrors(next)
    if (Object.keys(next).length > 0) return
    onSubmit(values)
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
          onValueChange={(v) => set('content_type', v as ContentType)}
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
          <Label htmlFor="lesson-video">Video URL</Label>
          <Input
            id="lesson-video"
            value={values.video_url}
            placeholder="https://…"
            onChange={(e) => set('video_url', e.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            Paste a hosted or YouTube/Vimeo link. Upload isn&rsquo;t wired yet (no Storage
            bucket exists).
          </p>
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
            onChange={(e) => set('xp_reward', e.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            Blank inherits the course default.
          </p>
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

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : lesson ? 'Save lesson' : 'Add lesson'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>

      {/* Questions live in the same drawer rather than a separate route —
          but only exist once the lesson does, and only for quiz lessons. */}
      {values.content_type === 'quiz' && lesson ? (
        <QuizQuestionsEditor lessonId={lesson.id} />
      ) : values.content_type === 'quiz' ? (
        <p className="text-muted-foreground border-t pt-4 text-sm">
          Save the lesson first, then reopen it to add questions.
        </p>
      ) : null}
    </form>
  )
}

export function LessonSheet({
  open,
  onOpenChange,
  lesson,
  isSubmitting,
  onSubmit,
}: LessonSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{lesson ? 'Edit lesson' : 'New lesson'}</SheetTitle>
          <SheetDescription>
            {lesson ? lesson.title : 'Added to the selected topic.'}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          {/* Keyed so switching between lessons remounts with fresh state
              instead of carrying the previous lesson's values over. */}
          <LessonFields
            key={lesson?.id ?? 'new'}
            lesson={lesson}
            isSubmitting={isSubmitting}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
