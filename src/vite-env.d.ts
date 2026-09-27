/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** package.json's `version`, injected at build time (vite.config.ts) — the profile page's About row reads this rather than a second hardcoded copy. */
declare const __APP_VERSION__: string
