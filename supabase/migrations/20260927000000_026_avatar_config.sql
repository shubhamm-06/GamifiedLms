-- =====================================================================
-- 026: A procedural avatar for the kid app.
--
-- `profiles.avatar_config` is a small structured jsonb config, never a
-- rendered image: { base, topper, face, accent }, each value from a fixed
-- option set (see `src/lib/avatar.ts`, the single source of truth for the
-- sets and the one place they could ever change). A CHECK constraint keeps a
-- row from ever holding a value outside those sets — a shape check, the same
-- pattern migration 023 used for callout color/icon. NULL means "never
-- customized"; the app renders a deterministic default (`DEFAULT_AVATAR`) in
-- that case rather than storing one, so a default never needs to migrate.
--
-- Not added to `profiles_public`: nothing today shows another student's
-- avatar (no leaderboard, no social screen), so the only place it is read is
-- the caller's own row, already covered by `profiles_select_self_or_admin`
-- and writable through `profiles_update_self` — no RLS change needed. A
-- future feature that shows a classmate's avatar would add it there
-- deliberately, the same way `display_name`/`avatar_url` are exposed today.
-- =====================================================================

alter table public.profiles
  add column avatar_config jsonb;

alter table public.profiles
  add constraint profiles_avatar_config_shape_check
  check (
    avatar_config is null
    or (
      jsonb_typeof(avatar_config) = 'object'
      -- Both directions: no extra keys, AND none of the four missing (a missing key makes
      -- ->> return SQL NULL, and NULL = ANY(...) is NULL, not FALSE, so a CHECK constraint
      -- would silently accept it without the ?& half — caught in testing, not theoretical).
      and avatar_config ?& array['base', 'topper', 'face', 'accent']
      and (avatar_config - 'base' - 'topper' - 'face' - 'accent') = '{}'::jsonb
      and (avatar_config ->> 'base') = any (array['gold', 'teal', 'coral', 'plum'])
      and (avatar_config ->> 'topper') = any (array['spiky', 'round', 'star', 'antenna', 'bow', 'none'])
      and (avatar_config ->> 'face') = any (array['happy', 'wink', 'silly', 'cool', 'sleepy'])
      and (avatar_config ->> 'accent') = any (array['star', 'stripe', 'dot', 'heart', 'none'])
    )
  );

comment on column public.profiles.avatar_config is
  'Procedural avatar {base, topper, face, accent}, each from a small fixed option set (lib/avatar.ts). Rendered client-side by one shared SVG component; never a stored image. NULL = never customized, the app renders a deterministic default. Migration 026.';
