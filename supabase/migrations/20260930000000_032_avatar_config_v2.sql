-- =====================================================================
-- 032: Avatar builder v2 — `profiles.avatar_config` accepts the richer shape.
--
-- Migration 026's CHECK required EXACTLY {base, topper, face, accent} and
-- rejected any other key, so the new builder's config (more slots, per-slot
-- colours, a version key) could not be saved without changing it. The rule
-- moves into one immutable function so the CHECK stays a single call (a CHECK
-- cannot hold a subquery, and the tint colours need one).
--
-- Both shapes are accepted:
--   legacy (no "v" key): exactly migration 026's shape, unchanged — rows
--     already stored keep validating, and the app maps them on read
--     (`normalizeAvatarConfig` in src/lib/avatar.ts).
--   v2 ("v": 2): {v, base, eyes, mouth, glasses, head, extra, backdrop} all
--     required, each from its fixed set, plus an optional "tints" object with
--     only the keys glasses/head/extra/backdrop, each a swatch name. No other
--     keys, and at most 1 KB of JSON.
-- The option sets below mirror src/lib/avatar.ts exactly (the single source of
-- truth) — change both together. Nothing here knows about unlocks: Phase 1 is
-- every option free. NULL still means "never customized".
-- RLS is unchanged: the column is still read and written only through the
-- caller's own row (profiles_select_self_or_admin / profiles_update_self).
-- =====================================================================

create or replace function public.avatar_config_is_valid(cfg jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $fn$
  select coalesce(
    case
      when cfg is null then true
      when jsonb_typeof(cfg) <> 'object' then false
      when length(cfg::text) > 1024 then false
      when not (cfg ? 'v') then (
        cfg ?& array['base', 'topper', 'face', 'accent']
        and (cfg - array['base', 'topper', 'face', 'accent']) = '{}'::jsonb
        and (cfg ->> 'base') = any (array['gold', 'teal', 'coral', 'plum'])
        and (cfg ->> 'topper') = any (array['spiky', 'round', 'star', 'antenna', 'bow', 'none'])
        and (cfg ->> 'face') = any (array['happy', 'wink', 'silly', 'cool', 'sleepy'])
        and (cfg ->> 'accent') = any (array['star', 'stripe', 'dot', 'heart', 'none'])
      )
      else (
        (cfg ->> 'v') = '2'
        and cfg ?& array['v', 'base', 'eyes', 'mouth', 'glasses', 'head', 'extra', 'backdrop']
        and (cfg - array['v', 'base', 'eyes', 'mouth', 'glasses', 'head', 'extra', 'backdrop', 'tints']) = '{}'::jsonb
        and (cfg ->> 'base') = any (array['gold', 'teal', 'coral', 'plum'])
        and (cfg ->> 'eyes') = any (array['round', 'happy', 'sleepy', 'wink', 'sparkle', 'wide'])
        and (cfg ->> 'mouth') = any (array['smile', 'grin', 'open', 'tongue', 'surprised'])
        and (cfg ->> 'glasses') = any (array['none', 'round', 'square', 'star', 'sunglasses'])
        and (cfg ->> 'head') = any (array['none', 'spiky', 'round', 'star', 'antenna', 'bow', 'cap', 'beanie', 'crown', 'wizard', 'grad', 'phones'])
        and (cfg ->> 'extra') = any (array['none', 'star', 'stripe', 'dot', 'heart', 'bowtie', 'scarf', 'cape', 'blush'])
        and (cfg ->> 'backdrop') = any (array['none', 'solid', 'dots', 'stripes', 'rays', 'rings'])
        and (
          not (cfg ? 'tints')
          or (
            jsonb_typeof(cfg -> 'tints') = 'object'
            and ((cfg -> 'tints') - array['glasses', 'head', 'extra', 'backdrop']) = '{}'::jsonb
            and not exists (
              select 1
              from jsonb_each_text(cfg -> 'tints') as t
              where t.value <> all (array['gold', 'teal', 'coral', 'plum', 'ink', 'cream'])
            )
          )
        )
      )
    end,
    false
  )
$fn$;

alter table public.profiles drop constraint profiles_avatar_config_shape_check;

alter table public.profiles
  add constraint profiles_avatar_config_shape_check
  check (public.avatar_config_is_valid(avatar_config));

comment on column public.profiles.avatar_config is
  'Procedural avatar (lib/avatar.ts). v2: {v:2, base, eyes, mouth, glasses, head, extra, backdrop, tints?}; legacy: {base, topper, face, accent} (migration 026). Rendered client-side by one shared SVG component; never a stored image. NULL = never customized. Validated by avatar_config_is_valid (migration 032).';
