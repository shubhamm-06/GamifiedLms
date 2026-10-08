// Settings safety checks: `node --experimental-strip-types scripts/check-settings.mjs`
// (no test runner in the repo). Exits non-zero on the first failure.
import assert from 'node:assert/strict'
import { THEME_PRESETS, THEME_RULES, DEFAULT_PRIMARY, DEFAULT_SECONDARY, checkTheme, deriveTokens, contrastRatio, hexToHsl, WHITE } from '../src/lib/theme.ts'
import { DEFAULT_SETTINGS, SECTION_KEYS, strictSchemas, readPublicSettings, readSection, effectiveFeatures } from '../src/lib/settings/schema.ts'
import { FONT_CATALOG, FONT_IDS, getFont, resolveFamily } from '../src/lib/settings/fonts.ts'

let n = 0
const ok = (name, fn) => { fn(); n++; console.log('ok  ', name) }

ok('the default colours pass the contrast rules', () => {
  const r = checkTheme(DEFAULT_PRIMARY, DEFAULT_SECONDARY)
  assert.deepEqual(r.errors, [], r.errors.join(' / '))
})
ok('every preset passes the contrast rules', () => {
  for (const p of THEME_PRESETS) {
    const r = checkTheme(p.primary, p.secondary)
    assert.deepEqual(r.errors, [], `${p.id}: ${r.errors.join(' / ')}`)
    console.log(`       ${p.id.padEnd(8)} fg ${r.primaryForeground.toFixed(2)}:1 (${deriveTokens(p.primary).fg}), secondary on white ${r.secondaryOnWhite.toFixed(2)}:1${r.warnings.length ? ' (link warning)' : ''}`)
  }
})
ok('the default gold keeps ink text', () => assert.equal(deriveTokens(DEFAULT_PRIMARY).fg, '#3A2A1A'))
ok('deriveTokens reproduces the locked -d values within rounding', () => {
  for (const [base, locked] of [[DEFAULT_PRIMARY, '#C98A0D'], [DEFAULT_SECONDARY, '#1E6765']]) {
    const got = deriveTokens(base).dark
    const a = hexToHsl(got), b = hexToHsl(locked)
    const dist = Math.max(Math.abs(a.h - b.h), Math.abs(a.s - b.s), Math.abs(a.l - b.l))
    console.log(`       ${base} -> ${got} (locked ${locked}, max HSL difference ${dist.toFixed(1)})`)
    assert.ok(dist <= 3, `${base}: derived ${got}, locked ${locked}`)
  }
})
ok('DEFAULT_SETTINGS parses against every strict schema', () => {
  for (const k of SECTION_KEYS) {
    const r = strictSchemas[k].safeParse(DEFAULT_SETTINGS[k])
    assert.ok(r.success, `${k}: ${JSON.stringify(r.error?.issues)}`)
  }
})
ok('an empty or garbage payload falls back to the defaults', () => {
  for (const raw of [null, undefined, 'x', 7, [], {}, { branding: 'nope' }, { theme: { value: [] } }]) {
    assert.deepEqual(readPublicSettings(raw).settings, DEFAULT_SETTINGS)
  }
})
ok('invalid stored fields fall back one by one', () => {
  const b = readSection('branding', { productName: 'X', tagline: 'Fine tagline', supportEmail: 'bad', logoUrl: 'https://evil.example/x.png', login: { background: { type: 'image', color: 'red' } } })
  assert.equal(b.productName, DEFAULT_SETTINGS.branding.productName)
  assert.equal(b.tagline, 'Fine tagline')
  assert.equal(b.supportEmail, '')
  assert.equal(b.logoUrl, '')
  assert.equal(b.login.background.type, 'image')
  assert.equal(b.login.background.color, '#FFFFFF')
  const t = readSection('terminology', { lesson: { singular: 'Unit', plural: '<b>' }, xp: 5 })
  assert.deepEqual(t.lesson, { singular: 'Unit', plural: 'Lessons' })
  assert.deepEqual(t.xp, DEFAULT_SETTINGS.terminology.xp)
  const f = readSection('features', { badges: false, xp: 'no' })
  assert.equal(f.badges, false); assert.equal(f.xp, true)
})
ok('an unreadable colour pair never applies', () => {
  assert.deepEqual(readSection('theme', { primary: '#FFFF00', secondary: '#FFFFFF' }), DEFAULT_SETTINGS.theme)
  assert.equal(strictSchemas.theme.safeParse({ preset: 'x', primary: '#FFFF00', secondary: '#FFFFFF' }).success, false)
})
ok('feature dependencies', () => {
  const all = DEFAULT_SETTINGS.features
  const off = effectiveFeatures({ ...all, gamification: false })
  assert.ok(!off.xp && !off.streaks && !off.badges && !off.levels && off.avatars && off.celebrations && off.publicCoursePages)
  const noXp = effectiveFeatures({ ...all, xp: false })
  assert.ok(!noXp.xp && !noXp.levels && noXp.badges && noXp.streaks)
})
ok('contrast math sanity', () => {
  assert.equal(contrastRatio('#000000', WHITE).toFixed(1), '21.0')
  assert.ok(THEME_RULES.primaryForeground === 4.5)
})
ok('every FONT_IDS entry has a catalog entry with a loader and a fallback stack', () => {
  for (const id of FONT_IDS) {
    const f = FONT_CATALOG[id]
    assert.ok(f, id)
    assert.equal(typeof f.load, 'function', id)
    if (id === 'default') continue
    assert.ok(f.fallbackStack.length > 0, `${id}: no fallback stack`)
    assert.ok(f.cssFamily.length > 0, `${id}: no cssFamily`)
    assert.ok(f.weights.length > 0, `${id}: no weights`)
    assert.ok(f.package, `${id}: no package`)
  }
})
ok('"default" resolves to no override (today\'s hardcoded chains render unchanged)', () => {
  assert.equal(resolveFamily('default'), null)
  assert.equal(resolveFamily(null), null)
  assert.equal(resolveFamily(undefined), null)
  assert.equal(getFont('default').cssFamily, '')
})
ok('a non-default id resolves to its family plus its fallback stack', () => {
  assert.equal(resolveFamily('inter'), `'Inter Variable', ${FONT_CATALOG.inter.fallbackStack}`)
})
ok('an unknown or removed font id falls back to "default" per field', () => {
  const t = readSection('theme', { fonts: { heading: 'not-a-real-font', body: 'inter' } })
  assert.equal(t.fonts.heading, 'default')
  assert.equal(t.fonts.body, 'inter')
  assert.deepEqual(readSection('theme', { fonts: 'nonsense' }).fonts, DEFAULT_SETTINGS.theme.fonts)
  assert.deepEqual(readSection('theme', {}).fonts, DEFAULT_SETTINGS.theme.fonts)
})
ok('DEFAULT_SETTINGS.theme.fonts is "default" for both roles', () => {
  assert.deepEqual(DEFAULT_SETTINGS.theme.fonts, { heading: 'default', body: 'default' })
})
console.log(`\n${n} checks passed`)
