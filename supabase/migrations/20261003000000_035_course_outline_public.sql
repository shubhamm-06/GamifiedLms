-- =====================================================================
-- 035: Public (signed-out) parent-facing course page.
--
-- The page at /course/<id> needs no login, so `fn_course_outline` (migration
-- 034, authenticated-only) becomes executable by `anon` as well. Nothing else
-- changes:
--   * the course row itself was already readable by anon under the existing
--     `courses_select_published_or_admin` policy (its role list is PUBLIC and
--     anon has table SELECT), so no policy or grant change is needed there;
--   * the function's own visibility rule (course live AND published, or the
--     caller is an admin) is unchanged and is what keeps drafts, archived and
--     trashed courses out for anon: `fn_is_admin()` is false without a session;
--   * it still returns only titles, types, positions, minutes and the preview
--     flag of PUBLISHED lessons, never content, URLs, bundles or quiz data.
-- =====================================================================

grant execute on function public.fn_course_outline(uuid) to anon;

comment on function public.fn_course_outline(uuid) is
  'Parent-facing course page outline: [{id,title,position,lessons:[{id,title,type,position,minutes,is_preview}]}] for PUBLISHED lessons of a course the caller may see (published+live, or admin). Lessons without a module come back as one module with a null id and blank title. Never returns content, URLs, bundles or quiz data. Executable by anon and authenticated (public course page, migration 035); public.fn_course_outline is revoked from PUBLIC.';
