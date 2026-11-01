// Run with node --experimental-strip-types scripts/check-age-group.mjs
import assert from 'node:assert/strict'
import { formatAgeGroup, normalizeUserSearch } from '../src/lib/ageGroup.ts'

for (const [group, age, expected] of [
  ['5-8', null, '5 to 8 years'], ['7-10', null, '7 to 10 years'],
  ['9-15', null, '9 to 15 years'], ['11-13', null, '11 to 13 years'],
  ['14+', null, '14+ years'], ['custom', 8, 'Age 8'],
  ['custom', null, 'Custom'], [null, null, null], ['', null, null],
  ['other', null, 'other'], ['3-4', null, '3-4'],
]) assert.equal(formatAgeGroup(group, age), expected)
assert.equal(normalizeUserSearch('98765 43210'), '9876543210')
assert.equal(normalizeUserSearch('name 1'), 'name 1')
console.log('Age group and phone search checks passed')
