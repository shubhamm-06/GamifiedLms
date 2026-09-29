import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import './index.css'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { AndroidBackButton } from '@/components/native/AndroidBackButton'
import { AppEntranceSplash } from '@/components/AppEntranceSplash'
import { queryClient } from '@/lib/queryClient'
import { initNativeShell } from '@/lib/nativeShell'
import { router } from './router'

initNativeShell()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppEntranceSplash>
          <RouterProvider router={router} />
        </AppEntranceSplash>
        <Toaster />
        <AndroidBackButton />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
)
