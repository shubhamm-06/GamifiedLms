import type { ReactNode } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export type CourseTab = 'basics' | 'curriculum'

interface CourseBuilderProps {
  tab: CourseTab
  onTabChange: (tab: CourseTab) => void
  /** Curriculum needs a course row to attach to, so it's locked until saved. */
  curriculumLocked: boolean
  basics: ReactNode
  curriculum: ReactNode
}

export function CourseBuilder({
  tab,
  onTabChange,
  curriculumLocked,
  basics,
  curriculum,
}: CourseBuilderProps) {
  return (
    <Tabs value={tab} onValueChange={(value) => onTabChange(value as CourseTab)}>
      <TabsList>
        <TabsTrigger value="basics">Basics</TabsTrigger>
        {curriculumLocked ? (
          <Tooltip>
            {/* A disabled trigger swallows pointer events, so the tooltip
                needs its own wrapper to be hoverable. */}
            <TooltipTrigger asChild>
              <span>
                <TabsTrigger value="curriculum" disabled>
                  Curriculum
                </TabsTrigger>
              </span>
            </TooltipTrigger>
            <TooltipContent>Save the course first</TooltipContent>
          </Tooltip>
        ) : (
          <TabsTrigger value="curriculum">Curriculum</TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="basics" className="pt-4">
        {basics}
      </TabsContent>
      <TabsContent value="curriculum" className="pt-4">
        {curriculum}
      </TabsContent>
    </Tabs>
  )
}
