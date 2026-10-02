import { useEffect, useId, useState, type ComponentType, type MouseEvent, type ReactNode } from 'react'
import { ArrowLeft, Check, ChevronDown, ExternalLink, History, Info, Mail, type LucideIcon } from 'lucide-react'
import { isHttpsUrl } from '@/lib/externalLink'
import type { CoursePageModel, PageIconKey, PageModuleOut, PageSection, PageTestimonial } from '@/lib/coursePage'
import { loadCoursePageFont } from './fonts'
import { LESSON_ICONS, PAGE_ICONS } from './icons'
import { SourceIcon } from './testimonialSources'
import './coursePage.css'

export interface CoursePageViewProps {
  model: CoursePageModel
  /** Admin preview: everything in normal flow, and the Enroll link does nothing when clicked. */
  embedded?: boolean
  /** The real back link (a router Link). Absent: a static look-alike, so the preview matches the page. */
  backLink?: ComponentType<{ className: string; 'aria-label'?: string; children: ReactNode }>
  /** The signed-out public page: replaces the back control with this (site name, Log in). */
  top?: ReactNode
  /** FREE courses only: what the Enroll button does. Absent (or `embedded`): the button is inert. */
  free?: FreeEnrollActions
}

export interface FreeEnrollActions {
  onEnroll: () => void
  /** True while the enrollment call is in flight: the button is disabled (no double submit). */
  pending: boolean
  /** A calm, already-worded message (never raw error text), shown under the lead. */
  error: string | null
  signupHref: string
  loginHref: string
  goHref: string
  /** Client-side navigation for the plain links (the href stays for middle-click and screen readers). */
  onNavigate: (href: string) => void
}

/** Every page icon goes through this: supportive (the text beside it carries the meaning), so hidden from assistive tech. */
function PageIcon({ icon: Icon, size, className }: { icon: LucideIcon; size: 16 | 18 | 20 | 24; className?: string }) {
  return <Icon className={className} size={size} strokeWidth={1.75} aria-hidden="true" focusable="false" />
}

/**
 * The parent-facing course page: pure presentation of a `CoursePageModel` (lib/coursePage.ts,
 * where every show/hide and ordering rule lives). MOBILE FIRST: the base layout is the phone
 * layout; coursePage.css enhances it at 640px and 1024px of CONTAINER width, so the admin
 * preview lays out exactly like the real page. Sections render by mapping over
 * `model.sections` through the ONE `Section` wrapper. Plain text only: every string is a React
 * text node, never HTML, and nothing is auto-linked.
 */
export function CoursePageView({ model, embedded = false, backLink: BackLink, top, free }: CoursePageViewProps) {
  const uid = useId()
  useEffect(() => {
    void loadCoursePageFont(model.font)
  }, [model.font])


  return (
    <div className="cp" data-theme={model.theme} data-font={model.font} data-embedded={embedded ? '' : undefined} data-testid="course-page">
      <div className="cp-top" data-public={top ? '' : undefined}>
        <div className="cp-top-in">
          {top ? (
            top
          ) : BackLink ? (
            <BackLink className="cp-back" aria-label="Back to courses">
              <PageIcon icon={ArrowLeft} size={20} />
              <span className="cp-back-text">Back to courses</span>
            </BackLink>
          ) : (
            <span className="cp-back">
              <PageIcon icon={ArrowLeft} size={20} />
              <span className="cp-back-text">Back to courses</span>
            </span>
          )}
        </div>
      </div>

      <div className="cp-layout" data-cover={model.cover ? '' : undefined}>
        <main className="cp-main">
          <header className="cp-hero">
            {model.cover ? <Cover url={model.cover.url} focus={model.cover.focus} /> : null}
            <h1 className="cp-title" data-testid="course-title" data-long={model.title.length > 60 ? '' : undefined}>
              {model.title}
            </h1>
            {model.lead ? <p className="cp-lead">{model.lead}</p> : null}
            {free?.error && model.enroll.state === 'free' ? (
              <p className="cp-noenroll cp-hero-err" role="alert" data-testid="free-enroll-error">
                <PageIcon icon={Info} size={16} />
                <span>{free.error}</span>
              </p>
            ) : null}
            {model.enroll.state === 'closed' ? (
              // Narrow and medium: the note is seen at once, under the lead (the wide card carries its own).
              <p className="cp-noenroll cp-hero-note" role="status" data-testid="no-enroll-note-hero">
                <PageIcon icon={Info} size={16} />
                <span>{model.enroll.note}</span>
              </p>
            ) : null}
            {model.facts.length > 0 ? (
              <div className="cp-facts-wrap">
                <dl className="cp-facts" data-testid="course-facts">
                  {model.facts.map((f) => (
                    <div key={f.key} className="cp-fact" data-fact={f.key}>
                      <dt>
                        <PageIcon icon={PAGE_ICONS[f.iconKey]} size={16} className="cp-fact-icon" />
                        <span>{f.label}</span>
                      </dt>
                      <dd>{f.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
            {model.enroll.state === 'open' && model.enroll.expiredNote ? (
              <p className="cp-expired" data-testid="expired-note">
                <PageIcon icon={History} size={16} />
                <span>{model.enroll.expiredNote}</span>
              </p>
            ) : null}
          </header>

          {model.sections.map((s) => (
            <SectionBlock key={s.id} section={s} uid={uid} support={model.support?.inFaq && s.kind === 'faq' ? model.support.email : null} />
          ))}

          {model.support && !model.support.inFaq ? (
            <div className="cp-sec cp-sec-plain">
              <SupportLine email={model.support.email} />
            </div>
          ) : null}

          {/* Narrow and medium only, and only an admin-written list: the automatic one repeats the facts and rules. */}
          {model.includedCustom ? (
            <Section id={`${uid}-included`} title="What's included" intro={model.price.note} kind="included" className="cp-included">
              <Checks items={model.included} />
            </Section>
          ) : null}
        </main>

        <aside
          className="cp-buy"
          data-enroll={model.enroll.state}
          data-noprice={model.price.text ? undefined : ''}
          data-long={'label' in model.enroll && model.enroll.label.length > 16 ? '' : undefined}
          aria-label="Enrollment"
          data-testid="enroll-area"
        >
          {model.price.text || model.price.accessLine ? (
            <div className="cp-buy-price">
              {model.price.text ? (
                <p className="cp-price" data-testid="course-price">
                  {model.price.text}
                </p>
              ) : null}
              {model.price.note ? <p className="cp-price-note">{model.price.note}</p> : null}
              {model.price.accessLine ? (
                <p className="cp-access" data-testid="access-line">
                  {model.price.accessLine}
                </p>
              ) : null}
            </div>
          ) : null}
          {model.enroll.state === 'open' ? (
            <div className="cp-buy-cta">
              <EnrollLink url={model.enroll.url} label={model.enroll.label} embedded={embedded} />
              <p className="cp-fine">You&apos;ll finish enrolling on another page.</p>
            </div>
          ) : model.enroll.state === 'free' ? (
            <div className="cp-buy-cta">
              <FreeEnrollAction action={model.enroll.action} label={model.enroll.label} free={free} embedded={embedded} />
              {model.enroll.action === 'enroll' ? <p className="cp-fine">Free. No payment needed.</p> : null}
              {model.enroll.action === 'signup' ? (
                <p className="cp-fine">
                  Free. You&apos;ll create an account first.{' '}
                  <a href={free?.loginHref ?? '/login'} onClick={(e) => navClick(e, free?.loginHref, free, embedded)}>
                    Log in
                  </a>
                </p>
              ) : null}
            </div>
          ) : (
            <p className="cp-noenroll cp-card-note" data-testid="no-enroll-note">
              <PageIcon icon={Info} size={16} />
              <span>{model.enroll.note}</span>
            </p>
          )}
          <ul className="cp-card-incl">
            {model.included.map((line, i) => (
              <li key={line}>
                <PageIcon icon={model.includedIcons ? PAGE_ICONS[model.includedIcons[i]] : Check} size={18} className={model.includedIcons ? 'cp-ico' : 'cp-tick'} />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  )
}

/**
 * The one section wrapper: hairline on top (not for the first section after the hero),
 * fixed padding, h2, optional intro, content. Every section on the page goes through it.
 */
function Section({ id, title, intro, kind, className = '', children }: { id: string; title: string; intro: string | null; kind: string; className?: string; children: ReactNode }) {
  return (
    <section className={`cp-sec ${className}`.trim()} aria-labelledby={id} data-section={kind}>
      <h2 className="cp-h2" id={id}>
        {title}
      </h2>
      {intro ? <p className="cp-intro">{intro}</p> : null}
      <div className="cp-sec-body">{children}</div>
    </section>
  )
}

function SectionBlock({ section: s, uid, support }: { section: PageSection; uid: string; support: string | null }) {
  const [imageFailed, setImageFailed] = useState<string | null>(null)
  const id = `${uid}-${s.id}`
  let body: ReactNode
  switch (s.kind) {
    case 'about':
    case 'text':
      body = (
        <div className="cp-prose">
          {s.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )
      break
    case 'learn':
      body = <Checks items={s.items} className="cp-checks-2" />
      break
    case 'how':
      body = s.icons ? <IconList items={s.items} icons={s.icons} /> : <Dots items={s.items} />
      break
    case 'need':
      body = <Dots items={s.items} />
      break
    case 'list':
      body = s.style === 'check' ? <Checks items={s.items} /> : s.style === 'number' ? <Numbered items={s.items} /> : <Dots items={s.items} />
      break
    case 'inside':
      body = <Outline modules={s.modules} detail={s.detail} open={s.open} />
      break
    case 'reviews':
      body = <Reviews items={s.items} />
      break
    case 'made_by':
      body = (
        <div className="cp-made" data-solo={!s.person.role && !s.person.bio ? '' : undefined}>
          <Avatar initials={s.person.initials} photoUrl={s.person.photoUrl} />
          <div className="cp-made-body">
            <p className="cp-made-name">{s.person.name}</p>
            {s.person.role ? <p className="cp-made-role">{s.person.role}</p> : null}
            {s.person.bio ? <p className="cp-made-bio">{s.person.bio}</p> : null}
          </div>
        </div>
      )
      break
    case 'faq':
      body = (
        <>
          <div className="cp-faq">
            {s.items.map((f, i) => (
              <details key={i}>
                <summary>
                  <h3 className="cp-faq-q">{f.question}</h3>
                  <ChevronDown className="cp-chev" aria-hidden="true" focusable="false" strokeWidth={1.75} />
                </summary>
                <p className="cp-faq-a">{f.answer}</p>
              </details>
            ))}
          </div>
          {support ? <SupportLine email={support} /> : null}
        </>
      )
      break
    case 'image':
      // A broken image removes the whole section: no heading over an empty space.
      if (imageFailed === s.url) return null
      body = (
        <figure className="cp-figure">
          <img src={s.url} alt={s.alt} loading="lazy" decoding="async" onError={() => setImageFailed(s.url)} />
          {s.caption ? <figcaption>{s.caption}</figcaption> : null}
        </figure>
      )
      break
  }
  return (
    <Section id={id} title={s.title} intro={s.intro} kind={s.kind}>
      {body}
    </Section>
  )
}

/** The cover: the page's largest image, so it loads first and its box is reserved up front (no shift). */
function Cover({ url, focus }: { url: string | null; focus: string }) {
  const [failed, setFailed] = useState<string | null>(null)
  if (url && failed !== url) {
    return (
      <div className="cp-cover" aria-hidden="true">
        <img src={url} alt="" loading="eager" decoding="async" fetchPriority="high" style={{ objectPosition: `center ${focus}` }} onError={() => setFailed(url)} />
      </div>
    )
  }
  return (
    <div className="cp-cover" aria-hidden="true" data-generated>
      <GeneratedCover />
    </div>
  )
}

/** Flat generated cover: the theme's deep accent, three white outline shapes and four faint dots. Nothing else. */
function GeneratedCover() {
  const stroke = { stroke: '#fff', strokeWidth: 3, strokeOpacity: 0.85, fill: 'none', vectorEffect: 'non-scaling-stroke', strokeLinejoin: 'round' } as const
  return (
    <svg viewBox="0 0 560 315" preserveAspectRatio="xMidYMid slice" focusable="false">
      <circle cx="132" cy="157" r="36" {...stroke} />
      <path d="M280 119 L318 191 L242 191 Z" {...stroke} />
      <rect x="388" y="121" width="72" height="72" rx="14" {...stroke} />
      <g fill="#fff" fillOpacity="0.22">
        <circle cx="40" cy="88" r="7" />
        <circle cx="524" cy="94" r="5" />
        <circle cx="34" cy="228" r="5" />
        <circle cx="520" cy="224" r="8" />
      </g>
    </svg>
  )
}

/** The page's check-icon list: "What your child will learn", check-style custom lists, admin-written included items. */
function Checks({ items, className = '' }: { items: string[]; className?: string }) {
  return (
    <ul className={`cp-checks ${className}`.trim()}>
      {items.map((t, i) => (
        <li key={i}>
          <PageIcon icon={Check} size={20} className="cp-tick" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  )
}

/** The default "How it works" rules: one functional icon per rule, secondary ink. */
function IconList({ items, icons }: { items: string[]; icons: PageIconKey[] }) {
  return (
    <ul className="cp-checks cp-iconlist">
      {items.map((t, i) => (
        <li key={i}>
          <PageIcon icon={PAGE_ICONS[icons[i]]} size={20} className="cp-ico" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  )
}

function Dots({ items }: { items: string[] }) {
  return (
    <ul className="cp-dots">
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  )
}

function Numbered({ items }: { items: string[] }) {
  return (
    <ol className="cp-numbered">
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ol>
  )
}

function LessonList({ lessons }: { lessons: PageModuleOut['lessons'] }) {
  return (
    <ul className="cp-lessons">
      {lessons.map((l) => (
        <li key={l.id} className="cp-lesson">
          <PageIcon icon={LESSON_ICONS[l.type]} size={20} />
          <span className="cp-lesson-text">
            <span className="cp-lesson-title">{l.title}</span>
            <span className="cp-lesson-type">{l.typeLabel}</span>
          </span>
          {l.minutes ? <span className="cp-lesson-min">{l.minutes}</span> : null}
        </li>
      ))}
    </ul>
  )
}

function Outline({ modules, detail, open }: { modules: PageModuleOut[]; detail: 'lessons' | 'sections'; open: 'first' | 'all' | 'none' }) {
  if (detail === 'sections') {
    return (
      <ul className="cp-acc cp-acc-flat" data-testid="course-outline">
        {modules.map((m) => (
          <li key={m.key} className="cp-mod-row">
            <h3 className="cp-mod-title">{m.title}</h3>
            <span className="cp-mod-sum">{m.summary}</span>
          </li>
        ))}
      </ul>
    )
  }
  // ONE section: no accordion header to open; the intro line above already says "1 section, ...".
  if (modules.length === 1) {
    return (
      <div className="cp-acc cp-acc-single" data-testid="course-outline">
        <LessonList lessons={modules[0].lessons} />
      </div>
    )
  }
  return (
    <div className="cp-acc" data-testid="course-outline">
      {modules.map((m, i) => (
        // Keyed by the open mode so changing it in the editor re-applies the initial state.
        <details key={`${m.key}-${open}`} open={open === 'all' || (open === 'first' && i === 0)}>
          <summary>
            <h3 className="cp-mod-title">{m.title}</h3>
            <span className="cp-mod-meta">{m.meta}</span>
            <ChevronDown className="cp-chev" aria-hidden="true" focusable="false" strokeWidth={1.75} />
          </summary>
          <LessonList lessons={m.lessons} />
        </details>
      ))}
    </div>
  )
}

/** Testimonials: ONE card design for every count (1 = a single full-width card; 2 to 6 = a grid). */
function Reviews({ items }: { items: PageTestimonial[] }) {
  return (
    <ul className="cp-reviews" data-count={items.length} data-testid="review-grid">
      {items.map((t, i) => (
        <li key={i}>
          <figure className="cp-review" data-testid="review-card">
            <blockquote>
              <p>{t.quote}</p>
            </blockquote>
            <figcaption className="cp-person">
              {t.photoUrl ? <ReviewPhoto url={t.photoUrl} /> : null}
              <span className="cp-person-text">
                <span className="cp-person-name">{t.name}</span>
                {t.relation ? <span className="cp-person-rel">{t.relation}</span> : null}
              </span>
              {t.source ? <SourceIcon source={t.source} postUrl={t.postUrl} /> : null}
            </figcaption>
          </figure>
        </li>
      ))}
    </ul>
  )
}

/** A decorative 40px photo (at most 6 small images, so eager: a broken one is removed at once, not left as an empty circle until scrolled near). If it fails to load the element is removed entirely: never initials, never a broken-image icon. */
function ReviewPhoto({ url }: { url: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return <img className="cp-photo" src={url} alt="" width={40} height={40} loading="eager" decoding="async" onError={() => setFailed(true)} />
}

function Avatar({ initials, photoUrl }: { initials: string; photoUrl: string | null }) {
  const [failed, setFailed] = useState<string | null>(null)
  return (
    <span className="cp-avatar" aria-hidden="true">
      {photoUrl && failed !== photoUrl ? <img src={photoUrl} alt="" loading="lazy" decoding="async" width={56} height={56} onError={() => setFailed(photoUrl)} /> : initials}
    </span>
  )
}

function SupportLine({ email }: { email: string }) {
  return (
    <p className="cp-support" data-testid="support-line">
      Still have a question?{' '}
      <a href={`mailto:${email}`}>
        <PageIcon icon={Mail} size={16} />
        Email support
      </a>
    </p>
  )
}

/** A plain left-click on an in-app link navigates client-side; modified clicks (new tab) keep the browser's behaviour. Inert in the admin preview. */
function navClick(e: MouseEvent<HTMLAnchorElement>, href: string | undefined, free: FreeEnrollActions | undefined, embedded: boolean) {
  if (embedded) {
    e.preventDefault()
    return
  }
  if (!href || !free || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  e.preventDefault()
  free.onNavigate(href)
}

/**
 * The Enroll button of a FREE course. A signed-in visitor gets a real <button> (disabled while the call is
 * in flight); a signed-out visitor gets a link to /signup; an enrolled one a link to the roadmap.
 * Gold, 48px, exactly like the paid button: the page keeps its one gold element.
 */
function FreeEnrollAction({ action, label, free, embedded }: { action: 'enroll' | 'signup' | 'go'; label: string; free: FreeEnrollActions | undefined; embedded: boolean }) {
  if (action === 'enroll') {
    const pending = !embedded && !!free?.pending
    return (
      <button type="button" className="cp-enroll" data-testid="enroll-free" disabled={pending} aria-busy={pending} onClick={() => !embedded && free?.onEnroll()}>
        <span className="cp-enroll-label">{pending ? 'Enrolling…' : label}</span>
      </button>
    )
  }
  const href = action === 'signup' ? (free?.signupHref ?? '/signup') : (free?.goHref ?? '/')
  return (
    <a className="cp-enroll" href={href} data-testid={action === 'signup' ? 'enroll-signup' : 'enroll-go'} onClick={(e) => navClick(e, href, free, embedded)}>
      <span className="cp-enroll-label">{label}</span>
    </a>
  )
}

/** A plain anchor, the same mechanism Privacy/Terms use. The https check is repeated at click time. */
function EnrollLink({ url, label, embedded }: { url: string; label: string; embedded: boolean }) {
  return (
    <a
      className="cp-enroll"
      href={url}
      target="_blank"
      rel="noreferrer"
      aria-label={`${label}, opens another page`}
      data-testid="enroll-now"
      onClick={(e) => {
        if (embedded || !isHttpsUrl(url)) e.preventDefault()
      }}
    >
      <span className="cp-enroll-label">{label}</span>
      <ExternalLink size={18} strokeWidth={1.75} aria-hidden="true" focusable="false" />
    </a>
  )
}
