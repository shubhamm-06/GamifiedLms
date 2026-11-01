export const AGE_GROUP_FILTER_OPTIONS = [
  { value: '5-8', label: '5 to 8 years' },
  { value: '7-10', label: '7 to 10 years' },
  { value: '9-15', label: '9 to 15 years' },
  { value: '11-13', label: '11 to 13 years' },
  { value: '14+', label: '14+ years' },
  { value: 'custom', label: 'Custom' },
  { value: '__not_provided__', label: 'Not provided' },
] as const

export function formatAgeGroup(group: string | null | undefined, age: number | null | undefined): string | null {
  if (!group) return null
  if (group === 'custom') return age == null ? 'Custom' : `Age ${age}`
  if (['5-8', '7-10', '9-15', '11-13'].includes(group)) return `${group.replace('-', ' to ')} years`
  if (group === '14+') return '14+ years'
  return group
}

export function normalizeUserSearch(search: string): string {
  return /^[0-9 + -]+$/.test(search) ? search.replace(/[ -]/g, '') : search
}
