/**
 * Single formatting point for every monetary amount in the UI.
 *
 * **Amounts are whole rupees**, not paise: `payments.amount = 1499` renders
 * as ₹1,499. Both `payments.amount` and `courses.price_amount` are plain
 * `integer` columns with no documented unit, so this is a decision rather
 * than a discovered fact — a future payment-webhook integration must write
 * whole units to match, or every amount on screen is wrong by 100x.
 *
 * Nothing should format currency inline. If the unit or presentation ever
 * changes, this file is the only thing that changes.
 */

/**
 * Indian digit grouping (1,49,900) differs from Western grouping (149,900);
 * `Intl` handles it correctly under this locale, so it isn't hand-rolled.
 * A non-INR currency would still group the Indian way — revisit here if the
 * product ever genuinely sells in another currency.
 */
const LOCALE = 'en-IN'

export const DEFAULT_CURRENCY = 'INR'

export function formatAmount(amount: number, currency: string = DEFAULT_CURRENCY): string {
  try {
    return new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency,
      // Whole units — no ".00" tail on values that are never fractional.
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    // `currency` ultimately originates from an external payment gateway, so a
    // malformed code is a real possibility. Intl throws on one; degrade to a
    // readable value rather than blanking whatever card is rendering this.
    return `${amount.toLocaleString(LOCALE)} ${currency}`
  }
}
