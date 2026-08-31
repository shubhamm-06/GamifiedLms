import { Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useCourseCount } from '@/hooks/useCourseCount'

export function HomePage() {
  const { data: courseCount, isPending, isError, error } = useCourseCount()

  return (
    <motion.main
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center"
    >
      <h1 className="text-2xl font-semibold">Gamified LMS — Admin</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        Router, Supabase client, and shadcn/ui are wired up. Published courses in
        the live project: {isPending ? '…' : isError ? `error (${error.message})` : courseCount}
      </p>
      <Button>
        <Sparkles />
        Phase 1 scaffold
      </Button>
    </motion.main>
  )
}
