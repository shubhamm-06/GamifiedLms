import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import './index.css'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { AndroidBackButton } from '@/components/native/AndroidBackButton'
import { AppEntranceSplash } from '@/components/AppEntranceSplash'
import { SettingsProvider } from '@/components/settings/SettingsProvider'
import { queryClient } from '@/lib/queryClient'
import { initNativeShell } from '@/lib/nativeShell'
import { listenForNotificationTaps } from '@/lib/pushNotifications'
import { bootSettings } from '@/lib/settings/store'
import { router } from './router'

// Cached settings (theme, title) before the first paint, so a returning visitor sees no flash.
bootSettings()
initNativeShell()
listenForNotificationTaps()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <TooltipProvider>
          <AppEntranceSplash>
            <RouterProvider router={router} />
          </AppEntranceSplash>
          <Toaster />
          <AndroidBackButton />
        </TooltipProvider>
      </SettingsProvider>
    </QueryClientProvider>
  </StrictMode>,
)
