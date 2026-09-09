import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CourseTable } from '@/components/admin/courses/CourseTable'
import {
  useCourseLifecycle,
  useCourses,
  type Course,
  type LifecycleAction,
} from '@/hooks/admin/useCourses'

export function CoursesPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const { data, isPending, isError } = useCourses()
  const lifecycle = useCourseLifecycle()

  function handleEdit(course: Course) {
    navigate({ to: '/admin/courses/$courseId/edit', params: { courseId: course.id } })
  }

  function handleLifecycle(course: Course, action: LifecycleAction) {
    // Archive is reversible via Restore, so no confirmation dialog.
    lifecycle.mutate({ course, action })
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Courses</h1>
          <p className="text-muted-foreground text-sm">
            {data?.length ?? 0} {(data?.length ?? 0) === 1 ? 'course' : 'courses'}
          </p>
        </div>
        <Button onClick={() => navigate({ to: '/admin/courses/new' })}>
          <Plus />
          New course
        </Button>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            className="pl-8"
            placeholder="Search by title…"
            aria-label="Search courses"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <CourseTable
        courses={data ?? []}
        isPending={isPending}
        isError={isError}
        search={search}
        statusFilter={statusFilter}
        onEdit={handleEdit}
        onLifecycle={handleLifecycle}
      />
    </div>
  )
}
