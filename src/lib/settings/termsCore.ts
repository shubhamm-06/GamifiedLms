/**
 * Terminology helpers with no app imports (only `./schema.ts`), so pure libraries
 * that the Node check scripts load (coursePage, freeEnrollment) can use them too.
 * The live words are pushed in by the settings store (`setActiveTerminology`);
 * until then, and under Node, the defaults apply.
 */
import { DEFAULT_SETTINGS, type Settings, type TermKey } from './schema.ts'

export interface Terms {
  /** Singular, as written ("Lesson"). */
  term: (key: TermKey) => string
  /** Plural, as written ("Lessons"). */
  terms: (key: TermKey) => string
  /** "1 Lesson", "5 Lessons". */
  formatCount: (key: TermKey, n: number) => string
  /** Lowercase for mid-sentence use, except acronyms ("XP" stays "XP"). Pass `plural` for the plural. */
  lower: (key: TermKey, plural?: boolean) => string
}

/** Two or more capitals in a row means an acronym: keep its case. */
export function lowerTerm(word: string): string {
  return /[A-Z]{2,}/.test(word) ? word : word.toLowerCase()
}

export function makeTerms(t: Settings['terminology']): Terms {
  return {
    term: (k) => t[k].singular,
    terms: (k) => t[k].plural,
    formatCount: (k, n) => `${n} ${n === 1 ? t[k].singular : t[k].plural}`,
    lower: (k, plural = false) => lowerTerm(plural ? t[k].plural : t[k].singular),
  }
}

let active: Settings['terminology'] = DEFAULT_SETTINGS.terminology

export function setActiveTerminology(t: Settings['terminology']): void {
  active = t
}

/** For non-React code (copy builders, toasts in hooks): the current terminology. */
export function getTerms(): Terms {
  return makeTerms(active)
}
