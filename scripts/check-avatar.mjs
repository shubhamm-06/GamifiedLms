// Runs the avatar config rules against real inputs: `node --experimental-strip-types scripts/check-avatar.mjs`
// (no test runner in the repo; the module under test is pure TypeScript with no imports).
import assert from 'node:assert/strict'
import {
  AVATAR_CATALOG, AVATAR_SWATCHES, DEFAULT_AVATAR, normalizeAvatarConfig, randomAvatarConfig, describeAvatar, tintFor,
} from '../src/lib/avatar.ts'

let n = 0
const ok = (name, fn) => { fn(); n++; console.log('ok  ', name) }
const isRenderable = (c) => c && c.v === 2 && Object.entries(AVATAR_CATALOG).every(([cat, list]) => list.some((p) => p.id === c[cat]))

ok('null / undefined / string / number / array / empty object all give a renderable default-ish config', () => {
  for (const raw of [null, undefined, 'x', 7, [], {}, true]) assert.ok(isRenderable(normalizeAvatarConfig(raw)), String(raw))
  assert.deepEqual(normalizeAvatarConfig(null), DEFAULT_AVATAR)
})
ok('legacy defaults reproduce the old default avatar (teal, round cap, happy)', () => {
  const c = normalizeAvatarConfig({ base: 'teal', topper: 'round', face: 'happy', accent: 'none' })
  assert.deepEqual(c, DEFAULT_AVATAR)
})
ok('every legacy face / topper / accent maps to a valid new part', () => {
  for (const face of ['happy', 'wink', 'silly', 'cool', 'sleepy'])
    for (const topper of ['spiky', 'round', 'star', 'antenna', 'bow', 'none'])
      for (const accent of ['star', 'stripe', 'dot', 'heart', 'none'])
        for (const base of ['gold', 'teal', 'coral', 'plum']) {
          const c = normalizeAvatarConfig({ base, topper, face, accent })
          assert.ok(isRenderable(c)); assert.equal(c.base, base); assert.equal(c.head, topper); assert.equal(c.extra, accent)
        }
  assert.equal(normalizeAvatarConfig({ base: 'gold', topper: 'none', face: 'cool', accent: 'none' }).glasses, 'sunglasses')
  assert.equal(normalizeAvatarConfig({ base: 'gold', topper: 'none', face: 'silly', accent: 'none' }).mouth, 'tongue')
})
ok('malformed legacy values fall back per field, never throw', () => {
  const c = normalizeAvatarConfig({ base: 'nope', topper: 3, face: null, accent: 'heart' })
  assert.ok(isRenderable(c)); assert.equal(c.extra, 'heart'); assert.equal(c.base, DEFAULT_AVATAR.base)
})
ok('v2: one bad key does not reset the rest; bad tints are dropped', () => {
  const c = normalizeAvatarConfig({ v: 2, base: 'plum', eyes: 'zzz', mouth: 'grin', glasses: 'star', head: 'crown', extra: 'cape', backdrop: 'rays', tints: { head: 'plum', glasses: 'pink', bogus: 'gold' } })
  assert.equal(c.eyes, DEFAULT_AVATAR.eyes); assert.equal(c.mouth, 'grin'); assert.equal(c.head, 'crown')
  assert.deepEqual(c.tints, { head: 'plum' })
})
ok('a round trip through normalize is stable', () => {
  for (let i = 0; i < 200; i++) { const c = randomAvatarConfig(); assert.deepEqual(normalizeAvatarConfig(JSON.parse(JSON.stringify(c))), c) }
})
ok('random configs are valid and tint only tintable parts with known swatches', () => {
  const sw = AVATAR_SWATCHES.map((s) => s.id)
  for (let i = 0; i < 200; i++) {
    const c = randomAvatarConfig(); assert.ok(isRenderable(c))
    for (const [slot, v] of Object.entries(c.tints)) { assert.ok(sw.includes(v)); assert.ok(tintFor(c, slot) !== null) }
  }
})
ok('tintFor: default for an untinted tintable part, null for a non-tintable one', () => {
  assert.equal(tintFor({ ...DEFAULT_AVATAR, head: 'crown' }, 'head'), 'gold')
  assert.equal(tintFor({ ...DEFAULT_AVATAR, head: 'crown', tints: { head: 'teal' } }, 'head'), 'teal')
  assert.equal(tintFor({ ...DEFAULT_AVATAR, head: 'spiky' }, 'head'), null)
})
ok('describeAvatar names the body and each chosen part, skips "none"', () => {
  const d = describeAvatar({ ...DEFAULT_AVATAR, base: 'teal', glasses: 'round', head: 'cap' })
  assert.match(d, /^Your avatar: teal body, .*round glasses, baseball cap$/)
  assert.ok(!/no glasses|no extra/.test(describeAvatar(DEFAULT_AVATAR)))
})
ok('catalogue: unique ids per slot, counts', () => {
  for (const [cat, list] of Object.entries(AVATAR_CATALOG)) assert.equal(new Set(list.map((p) => p.id)).size, list.length, cat)
  assert.deepEqual(Object.fromEntries(Object.entries(AVATAR_CATALOG).map(([k, v]) => [k, v.length])), { base: 4, eyes: 6, mouth: 5, glasses: 5, head: 12, extra: 9, backdrop: 6 })
})
console.log(`\n${n} checks passed`)
