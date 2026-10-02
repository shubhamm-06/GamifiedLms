import {
  Award,
  BookOpen,
  CalendarClock,
  Clock,
  FileText,
  Gamepad2,
  Infinity as InfinityIcon,
  Languages,
  ListChecks,
  ListOrdered,
  MonitorSmartphone,
  RotateCcw,
  Save,
  Tag,
  Timer,
  Users,
  Video,
  type LucideIcon,
} from 'lucide-react'
import type { LessonType, PageIconKey } from '@/lib/coursePage'

/**
 * The ONE icon map for the parent-facing course page (ui.md "Course page icons"). The model
 * supplies keys; the view maps them here, so no icon is chosen inside the view. Functional only:
 * every icon sits beside a text label that carries the meaning, in secondary ink (currentColor),
 * stroke 1.75, never on a coloured background. Individually imported, so only these ship.
 */
export const PAGE_ICONS: Record<PageIconKey, LucideIcon> = {
  ages: Users,
  lessons: BookOpen,
  time: Clock,
  access: CalendarClock,
  'no-expiry': InfinityIcon,
  language: Languages,
  'custom-fact': Tag,
  'rule-order': ListOrdered,
  'rule-time': Timer,
  'rule-retry': RotateCcw,
  'rule-save': Save,
  'rule-points': Award,
  'incl-lessons': BookOpen,
  'incl-save': Save,
  'incl-devices': MonitorSmartphone,
}

export const LESSON_ICONS: Record<LessonType, LucideIcon> = { video: Video, text: FileText, game: Gamepad2, quiz: ListChecks, other: FileText }
