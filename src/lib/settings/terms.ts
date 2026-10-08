/**
 * Terminology helpers. Never hardcode course / module / lesson / XP / badge / streak /
 * level in a UI string: use these (`useTerms()` in components, `getTerms()` elsewhere).
 * The admin supplies both singular and plural; we never auto-pluralize. Avoid "a" / "an"
 * before a term (it cannot agree with every word). Display strings only: routes, data,
 * types and query keys keep their own names.
 */
export { getTerms, lowerTerm, makeTerms, type Terms } from './termsCore'
