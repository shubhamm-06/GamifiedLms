// Runs the course page model's show/hide rules against real inputs:
// `node --experimental-strip-types scripts/check-course-page.mjs` (no test runner in the repo;
// the modules under test are pure TypeScript plus zod).
import assert from 'node:assert/strict'
import { toPageFormValues, toPageRow, validatePageValues, samePage, previewCourse, describePageWriteError, newCustomEntry, blankTestimonial, detectSource, PAGE_COLUMNS } from '../src/lib/coursePageForm.ts'
import { buildCoursePageModel, formatAges, formatDuration, formatAccessLength, parseOutline, normalizePageConfig, BUILTIN_KEYS } from '../src/lib/coursePage.ts'
import { pageConfigSchema } from '../src/lib/coursePageSchema.ts'

let n = 0
const ok = (name, fn) => { fn(); n++; console.log('ok  ', name) }

const L = (id, type = 'video', minutes = 5) => ({ id, title: `Lesson ${id}`, type, position: 1, minutes, is_preview: false })
const M = (title, lessons, id = title || 'm' + Math.random()) => ({ id, title, position: 1, lessons })
const build = (course = {}, extra = {}) => buildCoursePageModel({ course: { title: 'T', ...course }, ...extra })
const OUT = [M('Numbers', [L('a', 'video', 10), L('b', 'text', 10), L('c', 'quiz', 10)]), M('Shapes', [L('d', 'game', 10), L('e', 'video', 10)])]
/** The rendered section with this kind (or id), or undefined. */
const sec = (m, kind) => m.sections.find((s) => s.kind === kind || s.id === kind)
const kinds = (m) => m.sections.map((s) => s.kind)
const FULL = { description: 'x', learning_outcomes: ['a'], requirements: ['b'], instructor_name: 'N', faqs: [{ question: 'q', answer: 'a' }], testimonials: [{ quote: 'A lovely course indeed', name: 'Sample parent' }] }
const C = (id, extra = {}) => ({ key: 'custom', id, type: 'text', visible: true, title: 'Custom', body: 'Body', ...extra })

// =========================================================== existing rules (ported to sections)

ok('everything empty except the title: only title, closed enroll, How it works, no facts', () => {
  const m = build()
  assert.equal(m.title, 'T'); assert.equal(m.lead, null); assert.deepEqual(m.cover, { url: null, focus: 'center' })
  assert.deepEqual(m.facts, []); assert.deepEqual(kinds(m), ['how']); assert.equal(m.support, null)
  assert.equal(sec(m, 'how').items.length, 4)
  assert.equal(m.enroll.state, 'closed'); assert.equal(m.price.text, null); assert.equal(m.price.accessLine, null)
  assert.deepEqual(m.included, ['Progress saved automatically', 'Works on phone, tablet and computer'])
})
ok('tagline shows only when non-blank', () => { assert.equal(build({ tagline: '  ' }).lead, null); assert.equal(build({ tagline: ' Hi ' }).lead, 'Hi') })
ok('cover: https thumbnail used, http/javascript/blank fall back to the generated cover', () => {
  assert.equal(build({ thumbnail_url: 'https://x.test/a.png' }).cover.url, 'https://x.test/a.png')
  for (const u of ['http://x.test/a.png', 'javascript:alert(1)', 'https://a b', '', null]) assert.equal(build({ thumbnail_url: u }).cover.url, null, String(u))
})
ok('ages: both null hidden', () => assert.equal(formatAges(null, null), null))
ok('ages: equal "Age 6"', () => assert.equal(formatAges(6, 6), 'Age 6'))
ok('ages: range "5 to 7"', () => assert.equal(formatAges(5, 7), '5 to 7'))
ok('ages: only min "5 and up"', () => assert.equal(formatAges(5, null), '5 and up'))
ok('ages: only max "Up to 7"', () => assert.equal(formatAges(null, 7), 'Up to 7'))
ok('ages: invalid (min > max, out of range, fractional, wrong type) hidden', () => {
  for (const [a, b] of [[8, 5], [0, 5], [5, 19], [0, null], [null, 19], [2.5, 4], ['5', 7], [NaN, 6]]) assert.equal(formatAges(a, b), null, `${a},${b}`)
})
ok('ages fact appears first and only when valid', () => {
  assert.equal(build({ age_min: 5, age_max: 7 }).facts[0].value, '5 to 7')
  assert.equal(build({ age_min: 9, age_max: 7 }).facts.length, 0)
})
ok('no outline / null outline: no lesson or time facts, no inside', () => {
  for (const outline of [undefined, null, []]) { const m = build({}, { outline }); assert.equal(sec(m, 'inside'), undefined); assert.equal(m.facts.length, 0) }
})
ok('outline of only empty modules is treated as no outline', () => {
  const m = build({}, { outline: [M('A', []), M('B', [])] }); assert.equal(sec(m, 'inside'), undefined); assert.equal(m.facts.length, 0)
})
ok('lessons fact counts outline lessons, never total_lessons', () => {
  const m = build({ total_lessons: 99 }, { outline: OUT })
  assert.equal(m.facts.find((f) => f.key === 'lessons').value, '5')
  assert.equal(JSON.stringify(m).includes('99'), false)
})
ok('empty module skipped; untitled module is "Section N" by visible position', () => {
  const m = build({}, { outline: [M('', [L('x')]), M('Skip', []), M('', [L('y')])] })
  assert.deepEqual(sec(m, 'inside').modules.map((x) => x.title), ['Section 1', 'Section 2'])
  assert.equal(sec(m, 'inside').modules[1].meta.startsWith('Section 2, 1 lesson'), true)
})
ok('inside intro built from known parts; singular forms', () => {
  assert.equal(sec(build({}, { outline: OUT }), 'inside').intro, '2 sections, 5 lessons, 50 min')
  assert.equal(sec(build({}, { outline: [M('A', [L('1', 'video', null)])] }), 'inside').intro, '1 section, 1 lesson')
})
ok('lesson with no minutes shows none; known minutes shown', () => {
  const m = build({}, { outline: [M('A', [L('1', 'video', null), L('2', 'text', 8)])] })
  assert.deepEqual(sec(m, 'inside').modules[0].lessons.map((l) => l.minutes), [null, '8 min'])
})
ok('total time needs >= 80% of lessons to have minutes', () => {
  const mk = (withMin, without) => [M('A', [...Array.from({ length: withMin }, (_, i) => L('w' + i, 'video', 6)), ...Array.from({ length: without }, (_, i) => L('n' + i, 'video', null))])]
  const time = (o) => build({}, { outline: o }).facts.find((f) => f.key === 'time')
  assert.ok(time(mk(4, 1))); assert.equal(time(mk(3, 2)), undefined); assert.equal(time(mk(0, 3)), undefined)
})
ok('How it works intro names only the lesson types present, in fixed order', () => {
  assert.equal(sec(build({}, { outline: OUT }), 'how').intro, 'Lessons mix short videos, reading, games and quizzes.')
  assert.equal(sec(build({}, { outline: [M('A', [L('1', 'quiz'), L('2', 'video')])] }), 'how').intro, 'Lessons mix short videos and quizzes.')
  assert.equal(sec(build({}, { outline: [M('A', [L('1', 'game')])] }), 'how').intro, 'Lessons are games.')
})
ok('how copy is subject-neutral (no numbers/maths wording)', () => {
  const s = sec(build({ gamification_enabled: true }, { outline: OUT }), 'how')
  assert.equal(/numbers?|math|counting/.test([s.intro, ...s.items].join(' ').toLowerCase()), false)
})
ok('unknown lesson type still listed as "Lesson", never in the how intro', () => {
  const m = build({}, { outline: [M('A', [L('1', 'weird')])] }); assert.equal(sec(m, 'inside').modules[0].lessons[0].typeLabel, 'Lesson'); assert.equal(sec(m, 'how').intro, null)
})
ok('parseOutline: malformed input is dropped, never throws', () => {
  assert.deepEqual(parseOutline(null), []); assert.deepEqual(parseOutline('x'), [])
  const o = parseOutline([{ id: null, title: '', position: 1, lessons: [{ id: 'a', title: 'A', type: 'video', position: 1, minutes: 0, is_preview: false }, { title: 'no id' }, 5] }, 7, null])
  assert.equal(o.length, 1); assert.equal(o[0].lessons.length, 1); assert.equal(o[0].lessons[0].minutes, null)
})
ok('access: lifetime, fixed durations, unknown', () => {
  const a = (c) => build(c).facts.find((f) => f.key === 'access')?.value
  assert.equal(a({ access_type: 'lifetime' }), 'No expiry')
  assert.equal(a({ access_type: 'fixed', access_duration_days: 30 }), '30 days')
  assert.equal(a({ access_type: 'fixed', access_duration_days: 180 }), '6 months')
  assert.equal(a({ access_type: 'fixed', access_duration_days: 365 }), '12 months')
  assert.equal(a({ access_type: 'fixed', access_duration_days: 730 }), '2 years')
  assert.equal(a({ access_type: 'fixed', access_duration_days: 45 }), '45 days')
  assert.equal(a({ access_type: 'fixed', access_duration_days: 1 }), '1 day')
  assert.equal(a({ access_type: 'fixed', access_duration_days: null }), undefined)
  assert.equal(a({ access_type: 'fixed', access_duration_days: 0 }), undefined)
  assert.equal(a({ access_type: 'mystery' }), undefined); assert.equal(a({}), undefined)
  assert.equal(formatAccessLength(60), '2 months')
})
ok('language fact hidden when blank; facts keep fixed order', () => {
  assert.equal(build({ language: '  ' }).facts.length, 0)
  const m = build({ age_min: 5, age_max: 5, language: 'English', access_type: 'lifetime' }, { outline: OUT })
  assert.deepEqual(m.facts.map((f) => f.key), ['ages', 'lessons', 'time', 'access', 'language'])
})
ok('about: paragraphs split on blank lines, plain text, blank hidden', () => {
  assert.equal(sec(build({ description: '   ' }), 'about'), undefined)
  assert.deepEqual(sec(build({ description: 'One\n\nTwo\r\n\r\n\n  Three' }), 'about').paragraphs, ['One', 'Two', 'Three'])
  assert.deepEqual(sec(build({ description: 'a\nb' }), 'about').paragraphs, ['a\nb'])
  assert.deepEqual(sec(build({ description: '<b>x</b> <script>1</script>' }), 'about').paragraphs, ['<b>x</b> <script>1</script>'])
})
ok('learn / need: trimmed non-blank items; hidden when none or not an array', () => {
  assert.deepEqual(sec(build({ learning_outcomes: [' a ', '', '  ', 'b'] }), 'learn').items, ['a', 'b'])
  assert.equal(sec(build({ learning_outcomes: [' ', ''] }), 'learn'), undefined); assert.equal(sec(build({ requirements: 'nope' }), 'need'), undefined)
  assert.deepEqual(sec(build({ requirements: ['x'] }), 'need').items, ['x'])
})
ok('How it works: points-and-badges rule only with gamification on', () => {
  assert.equal(sec(build({ gamification_enabled: true }), 'how').items.some((l) => /points and badges/.test(l)), true)
  for (const g of [false, null, undefined]) assert.equal(sec(build({ gamification_enabled: g }), 'how').items.some((l) => /points/.test(l)), false)
})
ok('made by: needs a name; role/bio/photo optional; photo must be https; initials', () => {
  assert.equal(sec(build({ instructor_role: 'Teacher', instructor_bio: 'Bio' }), 'made_by'), undefined)
  const p = sec(build({ instructor_name: ' ada lovelace byron ', instructor_photo_url: 'http://x/p.png' }), 'made_by').person
  assert.equal(p.name, 'ada lovelace byron'); assert.equal(p.initials, 'AL'); assert.equal(p.photoUrl, null); assert.equal(p.role, null); assert.equal(p.bio, null)
  assert.equal(sec(build({ instructor_name: 'Zed', instructor_photo_url: 'https://x.test/p.png' }), 'made_by').person.photoUrl, 'https://x.test/p.png')
})
ok('faq: only complete entries; hidden when none; support email only if present', () => {
  const faqs = [{ question: 'Q1', answer: 'A1' }, { question: 'Q2' }, { answer: 'A3' }, { question: ' ', answer: 'x' }, null, 'bad']
  assert.deepEqual(sec(build({ faqs }), 'faq').items, [{ question: 'Q1', answer: 'A1' }])
  assert.equal(sec(build({ faqs: [{ question: 'Q' }] }), 'faq'), undefined); assert.equal(sec(build({ faqs: {} }), 'faq'), undefined)
  assert.equal(build({ faqs }).support, null)
  assert.deepEqual(build({ faqs }, { supportEmail: 'help@x.test' }).support, { email: 'help@x.test', inFaq: true })
  assert.deepEqual(build({}, { supportEmail: 'help@x.test' }).support, { email: 'help@x.test', inFaq: false })
  assert.equal(build({ faqs }, { supportEmail: 'not an email' }).support, null)
})
ok('legacy: every section force-hidden by page_hidden_sections even with content', () => {
  const base = build(FULL, { outline: OUT })
  assert.deepEqual(kinds(base), ['about', 'learn', 'inside', 'how', 'need', 'reviews', 'made_by', 'faq'])
  const m = build({ ...FULL, page_hidden_sections: ['about', 'learn', 'inside', 'how', 'know', 'need', 'made_by', 'faq'] }, { outline: OUT })
  assert.deepEqual(kinds(m), ['reviews'])
  for (const k of ['about', 'learn', 'inside', 'how', 'need', 'made_by', 'faq']) assert.equal(m.sectionStatus[k], 'hidden_by_you', k)
  assert.equal(build({ ...FULL, page_hidden_sections: ['faq'] }, { supportEmail: 'a@b.test' }).support.inFaq, false)
})
ok('every section empty: status "empty" except How it works "showing"', () => {
  const m = build()
  for (const k of BUILTIN_KEYS) assert.equal(m.sectionStatus[k], k === 'how' ? 'showing' : 'empty', k)
})
ok('unknown hidden keys / non-array hidden are ignored', () => {
  assert.equal(build({ page_hidden_sections: ['nope', 5, null] }).sectionStatus.how, 'showing')
  assert.equal(build({ page_hidden_sections: 'about' }).sectionStatus.how, 'showing')
})
ok('price: free, paid, paid without price, whole rupees only, en-IN grouping', () => {
  assert.equal(build({ is_free: true, price_amount: 500 }).price.text, 'Free')
  assert.equal(build({ is_free: false, price_amount: 242545, currency: 'INR' }).price.text, '₹2,42,545')
  assert.equal(build({ is_free: false, price_amount: 1000 }).price.text, '₹1,000')
  assert.equal(build({ is_free: false, price_amount: null }).price.text, null)
  assert.equal(build({ is_free: false, price_amount: 0 }).price.text, null)
  assert.equal(/\.\d\d/.test(build({ price_amount: 1499 }).price.text), false)
  assert.ok(build({ price_amount: 5, currency: 'ZZZZ' }).price.text.includes('5'))
})
ok('enroll: https link opens; label "Enroll now"', () => {
  assert.deepEqual(build({ enroll_url: 'https://pay.test/x' }).enroll, { state: 'open', url: 'https://pay.test/x', label: 'Enroll now', expiredNote: null })
})
ok('enroll: expired viewer gets "Enroll again" and a dated note', () => {
  const e = build({ enroll_url: 'https://pay.test/x' }, { viewer: { kind: 'expired', endedAt: '2026-09-21T10:00:00Z' } }).enroll
  assert.equal(e.label, 'Enroll again'); assert.equal(e.expiredNote, 'Your access ended on 21 Sep 2026.')
  assert.equal(build({ enroll_url: 'https://pay.test/x' }, { viewer: { kind: 'expired', endedAt: null } }).enroll.expiredNote, 'Your access has ended.')
  assert.equal(build({ enroll_url: 'https://pay.test/x' }, { viewer: { kind: 'expired', endedAt: 'garbage' } }).enroll.expiredNote, 'Your access has ended.')
})
ok('enroll: no link, invalid link, http link, javascript link all closed with the calm note', () => {
  for (const u of [null, '', '  ', 'http://pay.test', 'javascript:alert(1)', 'https://a b', 'ftp://x', 'https://' + 'a'.repeat(2049)]) {
    const e = build({ enroll_url: u }).enroll; assert.equal(e.state, 'closed', String(u).slice(0, 20)); assert.equal(e.note, "Enrollment isn't open for this course yet.")
  }
})
ok('expired viewer with no link: no button, note not leaked as an open state', () => assert.equal(build({}, { viewer: { kind: 'expired', endedAt: null } }).enroll.state, 'closed'))
ok('preview chips are never modelled (previews cannot be opened by non-enrolled students)', () => {
  const m = build({}, { outline: [M('A', [{ ...L('1'), is_preview: true }])] }); assert.equal(JSON.stringify(m).includes('is_preview'), false); assert.equal(/preview/i.test(JSON.stringify(m)), false)
})
ok('included: auto list has the lesson count with types; never repeats the access line', () => {
  assert.deepEqual(build({ access_type: 'fixed', access_duration_days: 365 }, { outline: OUT }).included, ['5 lessons (videos, reading, games and quizzes)', 'Progress saved automatically', 'Works on phone, tablet and computer'])
  assert.equal(build({ access_type: 'lifetime' }).included.some((l) => /access/i.test(l)), false)
  assert.equal(build({ access_type: 'lifetime' }).price.accessLine, 'Access with no expiry')
})
ok('theme and font: valid kept, unknown or missing fall back to teal / inter', () => {
  const m = build({ page_theme: 'plum', page_font: 'classic' }); assert.equal(m.theme, 'plum'); assert.equal(m.font, 'classic')
  for (const [t, f] of [['pink', 'comic'], [null, null], [undefined, undefined], ['', '']]) { const x = build({ page_theme: t, page_font: f }); assert.equal(x.theme, 'teal'); assert.equal(x.font, 'inter') }
})
ok('very long strings pass through unmodified (the layout handles overflow)', () => {
  const long = 'W'.repeat(5000)
  const m = build({ title: long, tagline: long, description: long, learning_outcomes: [long], instructor_name: long, faqs: [{ question: long, answer: long }] })
  assert.equal(m.title, long); assert.equal(m.lead, long); assert.deepEqual(sec(m, 'about').paragraphs, [long]); assert.deepEqual(sec(m, 'learn').items, [long]); assert.equal(sec(m, 'made_by').person.name, long); assert.equal(sec(m, 'faq').items[0].answer, long)
})
ok('malformed course values never throw (null arrays, numbers where strings expected)', () => {
  assert.doesNotThrow(() => build({ title: 5, tagline: 7, learning_outcomes: null, requirements: 3, faqs: 'x', page_hidden_sections: null, age_min: 'a', instructor_name: 4, page_layout: 'x', page_options: 9, testimonials: {} }))
})

// =========================================================== v3: total time, layout, options, reviews

ok('v3 total time: 45 min, 1 hr, 1 hr 30 min, 2 hr 30 min, rounded to 5 minutes', () => {
  assert.equal(formatDuration(45), '45 min'); assert.equal(formatDuration(59), '59 min')
  assert.equal(formatDuration(60), '1 hr'); assert.equal(formatDuration(62), '1 hr'); assert.equal(formatDuration(90), '1 hr 30 min'); assert.equal(formatDuration(88), '1 hr 30 min')
  assert.equal(formatDuration(150), '2 hr 30 min'); assert.equal(formatDuration(178), '3 hr')
  const t = (min) => build({}, { outline: [M('A', [L('1', 'video', min)])] }).facts.find((f) => f.key === 'time').value
  assert.equal(t(45), '45 min'); assert.equal(t(150), '2 hr 30 min'); assert.equal(/about/i.test(t(180)), false)
})
ok('v3 legacy row: empty layout uses default order; "know" alone hides the merged How it works', () => {
  const c = normalizePageConfig({ page_layout: [], page_hidden_sections: ['know'] })
  assert.equal(c.legacy, true); assert.deepEqual(c.layout.map((e) => e.key), [...BUILTIN_KEYS])
  assert.equal(c.layout.find((e) => e.key === 'how').visible, false)
  assert.equal(build({ page_hidden_sections: ['how'] }).sectionStatus.how, 'hidden_by_you')
})
ok('v3 reordered layout renders in the stored order; missing built-ins are appended in default order', () => {
  const m = build(FULL, { outline: OUT })
  const r = build({ ...FULL, page_layout: [{ key: 'faq', visible: true }, { key: 'reviews', visible: true }, { key: 'about', visible: true }] }, { outline: OUT })
  assert.deepEqual(kinds(r), ['faq', 'reviews', 'about', 'learn', 'inside', 'how', 'need', 'made_by'])
  assert.notDeepEqual(kinds(r), kinds(m))
})
ok('v3 with a layout, legacy page_hidden_sections is ignored (one source of truth)', () => {
  const r = build({ ...FULL, page_layout: [{ key: 'about', visible: true }], page_hidden_sections: ['about', 'faq'] })
  assert.equal(sec(r, 'about') !== undefined, true); assert.equal(sec(r, 'faq') !== undefined, true)
})
ok('v3 hidden vs empty: hidden wins over content, empty is reported separately', () => {
  const r = build({ description: 'x', page_layout: [{ key: 'about', visible: false }, { key: 'learn', visible: true }] })
  assert.equal(r.sectionStatus.about, 'hidden_by_you'); assert.equal(r.sectionStatus.learn, 'empty'); assert.equal(sec(r, 'about'), undefined)
  assert.equal(build({ page_layout: [{ key: 'learn', visible: false }] }).sectionStatus.learn, 'hidden_by_you')
})
ok('v3 title and intro overrides; blank title falls back to the default; blank intro renders nothing', () => {
  const r = build({ description: 'x', learning_outcomes: ['a'], page_layout: [{ key: 'about', visible: true, title: 'Why this course', intro: 'Read this first' }, { key: 'learn', visible: true, title: '  ', intro: ' ' }] })
  assert.equal(sec(r, 'about').title, 'Why this course'); assert.equal(sec(r, 'about').intro, 'Read this first')
  assert.equal(sec(r, 'learn').title, 'What your child will learn'); assert.equal(sec(r, 'learn').intro, null)
})
ok('v3 custom text block: paragraphs split on blank lines; blank body is empty (not rendered)', () => {
  const r = build({ page_layout: [C('aaaaaaaa', { body: 'One\n\nTwo' }), C('bbbbbbbb', { body: '   ' })] })
  assert.deepEqual(sec(r, 'aaaaaaaa').paragraphs, ['One', 'Two']); assert.equal(sec(r, 'aaaaaaaa').kind, 'text')
  assert.equal(sec(r, 'bbbbbbbb'), undefined); assert.equal(r.sectionStatus.bbbbbbbb, 'empty')
})
ok('v3 custom list block: check, bullet and number styles carried through', () => {
  for (const style of ['check', 'bullet', 'number']) {
    const r = build({ page_layout: [{ key: 'custom', id: 'list-0001', type: 'list', visible: true, title: 'L', items: ['a', 'b'], list_style: style }] })
    assert.equal(sec(r, 'list-0001').style, style); assert.deepEqual(sec(r, 'list-0001').items, ['a', 'b'])
  }
})
ok('v3 custom image block: https url and alt required; caption optional', () => {
  const img = (x) => ({ key: 'custom', id: 'image-001', type: 'image', visible: true, title: 'Pic', image_url: 'https://x.test/a.png', alt: 'A drawing', ...x })
  assert.deepEqual(sec(build({ page_layout: [img({ caption: 'Made in week 1' })] }), 'image-001'), { id: 'image-001', title: 'Pic', intro: null, kind: 'image', url: 'https://x.test/a.png', alt: 'A drawing', caption: 'Made in week 1' })
  assert.equal(sec(build({ page_layout: [img({})] }), 'image-001').caption, null)
})
ok('v3 invalid custom entries are dropped: http image, empty alt, blank title, bad id, unknown type, extra key', () => {
  const bad = [
    { key: 'custom', id: 'image-001', type: 'image', visible: true, title: 'P', image_url: 'http://x.test/a.png', alt: 'a' },
    { key: 'custom', id: 'image-002', type: 'image', visible: true, title: 'P', image_url: 'https://x.test/a.png', alt: '' },
    C('blank-tt', { title: ' ' }), C('BAD ID'), C('vid-0001', { type: 'video' }), C('extra-01', { color: 'red' }),
  ]
  const c = normalizePageConfig({ page_layout: [...bad, C('good-0001')] })
  assert.deepEqual(c.layout.filter((e) => e.key === 'custom').map((e) => e.id), ['good-0001'])
})
ok('v3 duplicate built-in keys and duplicate custom ids: the first wins', () => {
  const c = normalizePageConfig({ page_layout: [{ key: 'faq', visible: false }, { key: 'faq', visible: true }, C('dupe-0001', { title: 'First' }), C('dupe-0001', { title: 'Second' })] })
  assert.equal(c.layout.filter((e) => e.key === 'faq').length, 1); assert.equal(c.layout.find((e) => e.key === 'faq').visible, false)
  assert.deepEqual(c.layout.filter((e) => e.key === 'custom').map((e) => e.title), ['First'])
})
ok('v3 unknown layout keys ignored; more than 6 custom blocks capped; at most 20 entries', () => {
  const c = normalizePageConfig({ page_layout: [{ key: 'pricing', visible: true }, ...Array.from({ length: 8 }, (_, i) => C(`cust-000${i}`))] })
  assert.equal(c.layout.filter((e) => e.key === 'custom').length, 6); assert.equal(c.layout.some((e) => e.key === 'pricing'), false)
  assert.equal(c.layout.length, 6 + 8)
})
ok('v3 facts: hidden built-ins removed, custom facts appended, blank custom dropped, capped at 6', () => {
  const course = { age_min: 5, age_max: 7, language: 'English', access_type: 'lifetime' }
  const r = build({ ...course, page_options: { hidden_facts: ['ages', 'time'], custom_facts: [{ label: 'Level', value: 'Beginner' }] } }, { outline: OUT })
  assert.deepEqual(r.facts.map((f) => f.label), ['Lessons', 'Access', 'Language', 'Level'])
  const full = build({ ...course, page_options: { custom_facts: [{ label: 'A', value: '1' }, { label: 'B', value: '2' }, { label: 'C', value: '3' }] } }, { outline: OUT })
  assert.equal(full.facts.length, 6); assert.deepEqual(full.facts.slice(5).map((f) => f.label), ['A'])
  assert.equal(build({ page_options: { custom_facts: [{ label: 'X', value: ' ' }] } }).facts.length, 0)
  assert.equal(build({ page_options: { hidden_facts: ['ages', 'lessons', 'time', 'access', 'language'] } }, { outline: OUT }).facts.length, 0)
})
ok('v3 cta_label: overrides "Enroll now" for new viewers; expired viewers still see "Enroll again"', () => {
  const c = { enroll_url: 'https://pay.test/x', page_options: { cta_label: 'Join the course' } }
  assert.equal(build(c).enroll.label, 'Join the course')
  assert.equal(build(c, { viewer: { kind: 'expired', endedAt: null } }).enroll.label, 'Enroll again')
})
ok('v3 price note and included override', () => {
  const r = build({ is_free: true, page_options: { price_note: 'No card needed', included: ['Worksheets', '  '] } })
  assert.equal(r.price.note, 'No card needed')
  assert.deepEqual(build({ page_options: { included: ['Worksheets'] } }).included, ['Worksheets'])
})
ok('v3 cover: show false removes it; focus carried; invalid cover option falls back', () => {
  assert.equal(build({ thumbnail_url: 'https://x.test/a.png', page_options: { cover: { show: false } } }).cover, null)
  assert.deepEqual(build({ thumbnail_url: 'https://x.test/a.png', page_options: { cover: { focus: 'top' } } }).cover, { url: 'https://x.test/a.png', focus: 'top' })
  assert.deepEqual(build({ page_options: { cover: { focus: 'left' } } }).cover, { url: null, focus: 'center' })
})
ok('v3 outline options: detail, open, show_minutes', () => {
  const r = build({ page_options: { outline: { detail: 'sections', open: 'all', show_minutes: false } } }, { outline: OUT })
  const s = sec(r, 'inside')
  assert.equal(s.detail, 'sections'); assert.equal(s.open, 'all'); assert.deepEqual(s.modules.map((m) => m.summary), ['3 lessons', '2 lessons'])
  assert.equal(s.modules[0].lessons.every((l) => l.minutes === null), true); assert.equal(s.intro, '2 sections, 5 lessons')
  assert.ok(r.facts.find((f) => f.key === 'time'), 'Total time still governed by the facts rules')
  assert.equal(sec(build({}, { outline: OUT }), 'inside').modules[0].summary, '3 lessons, 30 min')
  assert.equal(sec(build({ page_options: { outline: { open: 'sometimes' } } }, { outline: OUT }), 'inside').open, 'first')
})
ok('v3 how it works: custom rules and intro replace the defaults', () => {
  const s = sec(build({ page_options: { how_items: ['Rule one'], how_intro: 'How we teach.' } }, { outline: OUT }), 'how')
  assert.deepEqual(s.items, ['Rule one']); assert.equal(s.intro, 'How we teach.')
  // A stored list the database would reject (a blank rule) is ignored as a whole: the defaults show.
  assert.equal(sec(build({ page_options: { how_items: ['Rule one', ' '] } }), 'how').items.length, 4)
})
ok('v3 reviews: none -> section absent; one -> single; quote and name both required', () => {
  assert.equal(sec(build(), 'reviews'), undefined); assert.equal(build().sectionStatus.reviews, 'empty')
  const one = sec(build({ testimonials: [{ quote: 'A lovely course indeed', name: 'Sample parent', relation: 'Parent of a 6 year old' }] }), 'reviews')
  assert.equal(one.items.length, 1); assert.equal(one.title, 'What parents say'); assert.equal(one.items[0].relation, 'Parent of a 6 year old'); assert.equal(one.items[0].source, null); assert.equal(one.items[0].postUrl, null); assert.equal('rating' in one.items[0], false)
})
ok('v3 reviews: two kept in order; seven capped to six; bad entries dropped', () => {
  const T = (q, extra = {}) => ({ quote: q, name: 'Sample parent', ...extra })
  assert.deepEqual(sec(build({ testimonials: [T('First review here'), T('Second review here')] }), 'reviews').items.map((t) => t.quote), ['First review here', 'Second review here'])
  assert.equal(sec(build({ testimonials: Array.from({ length: 7 }, (_, i) => T(`Review number ${i}`)) }), 'reviews').items.length, 6)
  const bad = [T('short'), T('x'.repeat(281)), { quote: 'No name at all here' }, T('Javascript photo', { photo_url: 'javascript:alert(1)' }), T('A valid review')]
  assert.deepEqual(sec(build({ testimonials: bad }), 'reviews').items.map((t) => t.quote), ['A valid review'])
})
ok('v3 reviews v2: no initials and no rating in the model; https photo kept, none otherwise', () => {
  const items = sec(build({ testimonials: [{ quote: 'With a photo here', name: 'Priya S.', photo_url: 'https://x.test/p.png' }, { quote: 'Without a photo', name: 'Sam K.' }] }), 'reviews').items
  assert.equal(items[0].photoUrl, 'https://x.test/p.png'); assert.equal(items[1].photoUrl, null)
  for (const t of items) { assert.equal('rating' in t, false); assert.equal('initials' in t, false) }
})
ok('v3 reviews v2: a legacy rating key (or any unknown key) is silently ignored, the quote stays', () => {
  const items = sec(build({ testimonials: [{ quote: 'A legacy rated review', name: 'Priya S.', rating: 5 }, { quote: 'Has a kid name key', name: 'Sam K.', child: 'Ann' }] }), 'reviews').items
  assert.deepEqual(items.map((t) => t.quote), ['A legacy rated review', 'Has a kid name key']); assert.equal(JSON.stringify(items).includes('rating'), false); assert.equal(JSON.stringify(items).includes('Ann'), false)
})
ok('v3 reviews v2: every source with and without a link', () => {
  const SRC = ['google', 'facebook', 'instagram', 'whatsapp', 'youtube', 'x', 'linkedin', 'website']
  for (const src of SRC) {
    const bare = sec(build({ testimonials: [{ quote: 'A sourced review here', name: 'N', source: src }] }), 'reviews').items[0]
    assert.equal(bare.source, src); assert.equal(bare.postUrl, null)
    const linked = sec(build({ testimonials: [{ quote: 'A linked review here', name: 'N', source: src, post_url: 'https://example.com/post/1' }] }), 'reviews').items[0]
    assert.equal(linked.source, src); assert.equal(linked.postUrl, 'https://example.com/post/1')
  }
})
ok('v3 reviews v2: a link without a source is dropped (the quote stays); bad sources and bad links are dropped on their own', () => {
  const g = (x) => sec(build({ testimonials: [{ quote: 'A review with extras', name: 'N', ...x }] }), 'reviews').items[0]
  assert.equal(g({ post_url: 'https://example.com/x' }).postUrl, null); assert.equal(g({ post_url: 'https://example.com/x' }).source, null)
  assert.equal(g({ source: 'tiktok', post_url: 'https://example.com/x' }).source, null); assert.equal(g({ source: 'tiktok', post_url: 'https://example.com/x' }).postUrl, null)
  for (const u of ['http://example.com/x', 'javascript:alert(1)', 'https://a b', 'https://' + 'a'.repeat(2041), '', 5, null]) { const t = g({ source: 'google', post_url: u }); assert.equal(t.source, 'google', String(u).slice(0, 20)); assert.equal(t.postUrl, null, String(u).slice(0, 20)) }
})
ok('v3 reviews v2: broken photo state (an http or javascript photo is no photo at all); 1, 2 and 6 entries keep order', () => {
  const rows = sec(build({ testimonials: [{ quote: 'An http photo here', name: 'N', photo_url: 'http://x.test/p.png' }] }), 'reviews')
  assert.equal(rows, undefined, 'an invalid photo URL drops the entry (the database never stores one)')
  const mk = (n) => Array.from({ length: n }, (_, i) => ({ quote: `Review number ${i + 1} here`, name: 'Sample parent', source: i % 2 ? 'facebook' : 'google' }))
  for (const n of [1, 2, 6]) assert.deepEqual(sec(build({ testimonials: mk(n) }), 'reviews').items.map((t) => t.quote), mk(n).map((t) => t.quote))
})
ok('v3 invalid page_options keys fall back individually (one bad key does not wipe the rest)', () => {
  const r = build({ enroll_url: 'https://pay.test/x', page_options: { cta_label: 'Join now', price_note: 'x'.repeat(81), color: 'red' } })
  assert.equal(r.enroll.label, 'Join now'); assert.equal(r.price.note, null)
})

// =========================================================== admin form module

const formOf = (c = {}) => toPageFormValues(c)
ok('form: empty course maps to blank editable values, default layout and look', () => {
  const v = formOf(); assert.equal(v.tagline, ''); assert.deepEqual(v.learning_outcomes, []); assert.equal(v.page_theme, 'teal'); assert.equal(v.page_font, 'inter')
  assert.deepEqual(v.layout.map((e) => e.key), [...BUILTIN_KEYS]); assert.deepEqual(v.testimonials, [])
  assert.deepEqual(validatePageValues(v), { errors: {}, warnings: {} })
})
ok('form: toPageRow writes exactly the page columns, trims, blanks dropped, legacy hidden cleared', () => {
  const v = { ...formOf({ page_hidden_sections: ['faq'] }), tagline: '  Hi  ', age_min: ' 5 ', language: '  ', learning_outcomes: [' a ', '', '  '], faqs: [{ question: ' q ', answer: ' a ' }, { question: 'only q', answer: '' }], instructor_name: ' N ' }
  const r = toPageRow(v)
  assert.deepEqual(Object.keys(r).sort(), [...PAGE_COLUMNS].sort())
  assert.equal(r.tagline, 'Hi'); assert.equal(r.age_min, 5); assert.equal(r.language, null); assert.deepEqual(r.learning_outcomes, ['a'])
  assert.deepEqual(r.faqs, [{ question: 'q', answer: 'a' }]); assert.equal(r.instructor_name, 'N'); assert.deepEqual(r.page_hidden_sections, [])
  assert.equal(r.page_layout.find((e) => e.key === 'faq').visible, false, 'legacy hidden carried into the layout')
  assert.equal(pageConfigSchema.safeParse(r).success, true)
})
ok('form: blank optional strings become ABSENT keys (never null) and defaults are omitted', () => {
  const r = toPageRow(formOf())
  assert.deepEqual(r.page_options, {}); assert.deepEqual(r.page_layout[0], { key: 'about', visible: true })
  assert.equal(JSON.stringify(r.page_layout).includes('null'), false)
})
ok('form: custom blocks round-trip through the row and back', () => {
  const v = formOf(); const t = newCustomEntry('text'); const li = newCustomEntry('list'); const im = newCustomEntry('image')
  Object.assign(t, { title: 'Note', body: 'Hello' }); Object.assign(li, { title: 'Steps', items: ['a', '', 'b'], list_style: 'number' }); Object.assign(im, { title: 'Pic', image_url: 'https://x.test/a.png', alt: 'A pic' })
  const row = toPageRow({ ...v, layout: [...v.layout, t, li, im] })
  assert.equal(pageConfigSchema.safeParse(row).success, true)
  assert.deepEqual(row.page_layout.find((e) => e.id === li.id).items, ['a', 'b'])
  const back = toPageFormValues(row); assert.equal(back.layout.filter((e) => e.key === 'custom').length, 3)
})
ok('form: validation limits mirror the database CHECKs', () => {
  const e = (patch) => validatePageValues({ ...formOf(), ...patch }).errors
  assert.ok(e({ tagline: 'a'.repeat(161) }).tagline); assert.equal(e({ tagline: 'a'.repeat(160) }).tagline, undefined)
  for (const a of ['0', '19', '5.5', 'x', '-1']) assert.ok(e({ age_min: a }).age_min, a)
  assert.ok(e({ age_min: '8', age_max: '5' }).age_max); assert.deepEqual(e({ age_min: '5', age_max: '5' }), {})
  assert.ok(e({ learning_outcomes: Array(9).fill('x') }).learning_outcomes); assert.ok(e({ requirements: Array(7).fill('x') }).requirements)
  for (const u of ['http://x.test/a.png', 'javascript:alert(1)', 'https://a b']) { assert.ok(e({ instructor_photo_url: u }).instructor_photo_url, u); assert.ok(e({ thumbnail_url: u }).thumbnail_url, u) }
  assert.ok(e({ faqs: Array(9).fill({ question: 'q', answer: 'a' }) }).faqs)
})
ok('form: v3 option, layout and review limits produce inline errors', () => {
  const v = formOf(); const opts = (o) => validatePageValues({ ...v, options: { ...v.options, ...o } }).errors
  assert.ok(opts({ cta_label: 'x'.repeat(25) })['options.cta_label']); assert.ok(opts({ included: Array(7).fill('x') })['options.included'])
  assert.ok(opts({ custom_facts: Array(4).fill({ label: 'a', value: 'b' }) })['options.custom_facts']); assert.ok(opts({ how_items: Array(9).fill('x') })['options.how_items'])
  const lay = (entries) => validatePageValues({ ...v, layout: [...v.layout, ...entries] }).errors
  const t = newCustomEntry('text'); const li = newCustomEntry('list'); const im = newCustomEntry('image')
  assert.ok(lay([t])[`layout.${t.id}.title`], 'custom title required')
  assert.ok(lay([{ ...li, title: 'L' }])[`layout.${li.id}.items`], 'list needs a line')
  const ie = lay([{ ...im, title: 'I', image_url: 'http://x' }]); assert.ok(ie[`layout.${im.id}.image_url`]); assert.ok(ie[`layout.${im.id}.alt`])
  assert.ok(lay(Array.from({ length: 7 }, () => ({ ...newCustomEntry('text'), title: 'T' }))).layout)
  const rev = (items) => validatePageValues({ ...v, testimonials: items }).errors
  assert.ok(rev([{ quote: 'short', name: 'N', relation: '', photo_url: '', source: '', post_url: '' }])['testimonials.0.quote'])
  assert.ok(rev(Array(7).fill({ quote: 'A long enough review', name: 'N', relation: '', photo_url: '', source: '', post_url: '' })).testimonials)
  assert.ok(rev([{ quote: 'A long enough review', name: 'N', relation: '', photo_url: 'javascript:x', source: '', post_url: '' }])['testimonials.0.photo_url'])
  const R1 = { quote: 'A long enough review', name: 'N', relation: '', photo_url: '', source: '', post_url: '' }
  assert.ok(rev([{ ...R1, source: 'google', post_url: 'http://x.test/a' }])['testimonials.0.post_url']); assert.ok(rev([{ ...R1, source: 'google', post_url: 'https://a b' }])['testimonials.0.post_url'])
  assert.ok(rev([{ ...R1, post_url: 'https://x.test/a' }])['testimonials.0.source'], 'a link needs a source'); assert.deepEqual(rev([{ ...R1, source: 'google', post_url: 'https://x.test/a' }]), {}); assert.deepEqual(rev([{ ...R1, source: 'facebook' }]), {})
})
ok('form v2: review rows write source and link only together; a link without a source is not saved', () => {
  const R1 = { quote: 'A long enough review', name: 'N', relation: '', photo_url: '', source: '', post_url: '' }
  const row = (t) => toPageRow({ ...formOf(), testimonials: [t] }).testimonials[0]
  assert.deepEqual(row({ ...R1, source: 'google', post_url: 'https://x.test/p' }), { quote: 'A long enough review', name: 'N', source: 'google', post_url: 'https://x.test/p' })
  assert.deepEqual(row({ ...R1, source: 'facebook' }), { quote: 'A long enough review', name: 'N', source: 'facebook' })
  assert.equal('post_url' in row({ ...R1, post_url: 'https://x.test/p' }), false); assert.equal('rating' in row(R1), false)
  const back = toPageFormValues({ testimonials: [{ quote: 'A long enough review', name: 'N', source: 'x', post_url: 'https://x.test/p' }] }).testimonials[0]
  assert.equal(back.source, 'x'); assert.equal(back.post_url, 'https://x.test/p'); assert.deepEqual(blankTestimonial(), { quote: '', name: '', relation: '', photo_url: '', source: '', post_url: '' })
})
ok('form v2: the source is picked from a pasted link by hostname', () => {
  const d = detectSource
  assert.equal(d('https://www.instagram.com/p/abc'), 'instagram'); assert.equal(d('https://facebook.com/x/posts/1'), 'facebook'); assert.equal(d('https://m.facebook.com/x'), 'facebook'); assert.equal(d('https://fb.com/x'), 'facebook')
  assert.equal(d('https://youtube.com/watch?v=1'), 'youtube'); assert.equal(d('https://youtu.be/abc'), 'youtube'); assert.equal(d('https://x.com/a/status/1'), 'x'); assert.equal(d('https://twitter.com/a/status/1'), 'x')
  assert.equal(d('https://www.linkedin.com/posts/a'), 'linkedin'); assert.equal(d('https://www.google.com/maps/reviews'), 'google'); assert.equal(d('https://g.page/r/abc/review'), 'google'); assert.equal(d('https://maps.app.goo.gl/abc'), 'google')
  assert.equal(d('https://example.com/review/1'), 'website'); assert.equal(d('https://notinstagram.com/p'), 'website'); assert.equal(d('https://instagram.com.evil.test/p'), 'website')
  for (const bad of ['', 'instagram.com/p', 'http://instagram.com/p', 'javascript:alert(1)', 'https://a b']) assert.equal(d(bad), null, bad)
})
ok('form: half-filled FAQ, custom fact and review rows warn (and are dropped), never block', () => {
  const v = formOf()
  const r = validatePageValues({ ...v, faqs: [{ question: 'q', answer: '' }], options: { ...v.options, custom_facts: [{ label: 'L', value: '' }] }, testimonials: [{ quote: 'A long enough review', name: '', relation: '', photo_url: '', source: '', post_url: '' }] })
  assert.deepEqual(r.errors, {}); assert.deepEqual(Object.keys(r.warnings).sort(), ['faqs.0', 'options.custom_facts.0', 'testimonials.0'])
  const row = toPageRow({ ...v, testimonials: [{ quote: 'A long enough review', name: '', relation: '', photo_url: '', source: '', post_url: '' }] }); assert.deepEqual(row.testimonials, [])
})
ok('form: dirty comparison ignores blank rows and whitespace; sees reorders', () => {
  const a = formOf({ learning_outcomes: ['x'] })
  assert.equal(samePage(a, { ...a, learning_outcomes: ['x', '', ' '], tagline: '   ' }), true)
  assert.equal(samePage(a, { ...a, page_theme: 'plum' }), false)
  assert.equal(samePage(a, { ...a, layout: [...a.layout].reverse() }), false)
})
ok('form: preview course overlays UNSAVED page values on the saved basics', () => {
  const basics = { title: 'Saved title', enroll_url: 'https://pay.test/x', tagline: 'old' }
  const v = formOf()
  const p = previewCourse(basics, { ...v, tagline: 'new', age_min: 'oops', page_theme: 'coral', options: { ...v.options, cta_label: 'Join' } })
  assert.equal(p.title, 'Saved title'); assert.equal(p.tagline, 'new'); assert.equal(p.age_min, null); assert.equal(p.page_theme, 'coral')
  const m = buildCoursePageModel({ course: p }); assert.equal(m.lead, 'new'); assert.equal(m.enroll.label, 'Join')
})
ok('form: database CHECK names map to readable messages; unknown messages pass through', () => {
  assert.match(describePageWriteError('new row for relation "courses" violates check constraint "courses_instructor_photo_url_check"'), /https:\/\//)
  assert.match(describePageWriteError('violates check constraint "courses_testimonials_check"'), /Reviews/)
  assert.match(describePageWriteError('violates check constraint "courses_page_layout_check"'), /Sections/)
  assert.equal(describePageWriteError('something else'), 'something else')
})

// =========================================================== mobile pass: icon keys, included, zod parity

ok('mobile: facts carry icon keys; lifetime access uses the no-expiry icon; custom facts use the tag', () => {
  const m = build({ age_min: 5, age_max: 7, language: 'English', access_type: 'lifetime', page_options: { custom_facts: [{ label: 'Level', value: 'Beginner' }] } }, { outline: OUT })
  assert.deepEqual(m.facts.map((f) => f.iconKey), ['ages', 'lessons', 'time', 'no-expiry', 'language', 'custom-fact'])
  assert.equal(build({ access_type: 'fixed', access_duration_days: 30 }).facts[0].iconKey, 'access')
})
ok('mobile: default How it works rules carry icons; an admin-written list has none (plain dots)', () => {
  const d = sec(build({ gamification_enabled: true }), 'how')
  assert.deepEqual(d.icons, ['rule-order', 'rule-time', 'rule-retry', 'rule-save', 'rule-points']); assert.equal(d.icons.length, d.items.length)
  assert.equal(sec(build({ page_options: { how_items: ['Mine'] } }), 'how').icons, null)
})
ok('mobile: included list is automatic (with icons, not shown on narrow) unless the admin wrote it', () => {
  const auto = build({}, { outline: OUT }); assert.equal(auto.includedCustom, false); assert.deepEqual(auto.includedIcons, ['incl-lessons', 'incl-save', 'incl-devices'])
  assert.equal(build().includedIcons.length, build().included.length)
  const own = build({ page_options: { included: ['Worksheets'] } }); assert.equal(own.includedCustom, true); assert.equal(own.includedIcons, null)
})
{
  const { layoutEntrySchema, pageOptionSchemas, testimonialSchema } = await import('../src/lib/coursePageSchema.ts')
  const { isValidLayoutEntry, isValidPageOption, isValidTestimonial } = await import('../src/lib/coursePage.ts')
  const layouts = [
    { key: 'about', visible: true }, { key: 'about', visible: true, title: 'x'.repeat(80) }, { key: 'about', visible: true, title: 'x'.repeat(81) }, { key: 'about' }, { key: 'about', visible: 'yes' },
    { key: 'about', visible: true, color: 'red' }, { key: 'about', visible: true, title: null }, { key: 'nope', visible: true }, { visible: true },
    C('aaaaaaaa'), C('aaaaaaaa', { body: 'x'.repeat(1201) }), C('aaa'), C('AAAAAAAA'), C('aaaaaaaa', { title: ' ' }), C('aaaaaaaa', { title: 'x'.repeat(81) }), C('aaaaaaaa', { items: ['x'] }),
    { key: 'custom', id: 'list-0001', type: 'list', visible: true, title: 'L', items: ['a'], list_style: 'check' },
    { key: 'custom', id: 'list-0001', type: 'list', visible: true, title: 'L', items: [], list_style: 'check' },
    { key: 'custom', id: 'list-0001', type: 'list', visible: true, title: 'L', items: [' '], list_style: 'check' },
    { key: 'custom', id: 'list-0001', type: 'list', visible: true, title: 'L', items: Array(11).fill('a'), list_style: 'check' },
    { key: 'custom', id: 'list-0001', type: 'list', visible: true, title: 'L', items: ['a'], list_style: 'stars' },
    { key: 'custom', id: 'img-00001', type: 'image', visible: true, title: 'I', image_url: 'https://x.test/a.png', alt: 'a' },
    { key: 'custom', id: 'img-00001', type: 'image', visible: true, title: 'I', image_url: 'http://x.test/a.png', alt: 'a' },
    { key: 'custom', id: 'img-00001', type: 'image', visible: true, title: 'I', image_url: 'https://x.test/a.png', alt: '' },
    { key: 'custom', id: 'img-00001', type: 'image', visible: true, title: 'I', image_url: 'https://x.test/a.png', alt: 'a', caption: 'x'.repeat(141) },
    C('aaaaaaaa', { type: 'video' }), null, 'about', 5, [],
  ]
  for (const e of layouts) assert.equal(isValidLayoutEntry(e), layoutEntrySchema.safeParse(e).success, JSON.stringify(e)?.slice(0, 80))
  const options = [
    ['cover', { show: false }], ['cover', { focus: 'top' }], ['cover', { focus: 'left' }], ['cover', { show: 'no' }], ['cover', { show: true, extra: 1 }], ['cover', null],
    ['cta_label', 'Join'], ['cta_label', 'x'.repeat(25)], ['cta_label', 5], ['price_note', 'x'.repeat(80)], ['price_note', 'x'.repeat(81)], ['how_intro', ''],
    ['included', ['a']], ['included', []], ['included', [' ']], ['included', Array(7).fill('a')], ['included', ['x'.repeat(81)]],
    ['hidden_facts', ['ages']], ['hidden_facts', ['ages', 'ages']], ['hidden_facts', ['price']], ['hidden_facts', 'ages'],
    ['custom_facts', [{ label: 'a', value: 'b' }]], ['custom_facts', Array(4).fill({ label: 'a', value: 'b' })], ['custom_facts', [{ label: 'a', value: ' ' }]], ['custom_facts', [{ label: 'a', value: 'b', x: 1 }]],
    ['how_items', ['a']], ['how_items', Array(9).fill('a')],
    ['outline', { open: 'all' }], ['outline', { open: 'some' }], ['outline', { detail: 'sections', show_minutes: false }], ['outline', { show_minutes: 'no' }], ['outline', { sort: 1 }],
  ]
  for (const [k, v] of options) assert.equal(isValidPageOption(k, v), pageOptionSchemas[k].safeParse(v).success, `${k} ${JSON.stringify(v)}`)
  const T = (x) => ({ quote: 'A good review here', name: 'N', ...x })
  const testimonials = [T({}), T({ rating: 5 }), T({ rating: 6 }), T({ source: 'google' }), T({ source: 'google', post_url: 'https://x.test/p' }), T({ source: 'x', post_url: 'http://x.test/p' }), T({ source: 'tiktok' }), T({ source: 'Google' }), T({ source: null }), T({ post_url: 'https://x.test/p' }), T({ source: 'website', post_url: 'https://a b' }), T({ source: 'website', post_url: 'https://' + 'a'.repeat(2041) }), T({ source: 'website', post_url: 'https://' + 'a'.repeat(2040) }), T({ source: 'linkedin', post_url: null }), T({ quote: 'short' }), T({ quote: 'x'.repeat(281) }), T({ name: ' ' }), T({ name: 'x'.repeat(61) }),
    T({ relation: 'x'.repeat(81) }), T({ photo_url: 'https://x.test/p.png' }), T({ photo_url: 'javascript:x' }), T({ child: 'Ann' }), null, 'x']
  for (const t of testimonials) assert.equal(isValidTestimonial(t), testimonialSchema.safeParse(t).success, JSON.stringify(t)?.slice(0, 80))
  n++; console.log('ok   mobile: parity holds for', layouts.length + options.length + testimonials.length, 'samples')
}
{
  const fs = await import('node:fs')
  const src = fs.readFileSync(new URL('../src/lib/coursePage.ts', import.meta.url), 'utf8')
  assert.equal(/from ['"]zod['"]|coursePageSchema/.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')), false)
  n++; console.log('ok   mobile: coursePage.ts imports neither zod nor coursePageSchema')
}

console.log(`\n${n} checks passed`)
