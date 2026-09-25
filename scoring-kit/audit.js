import { readFileSync } from 'node:fs';
import { rankOpportunities, AFRICA_ISO, WEIGHTS } from './scoring.js';

const NOW = new Date('2026-09-24T12:00:00Z');
const load = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const opportunities = load('./data/sample_opportunities.json');
const cases = load('./data/test_profiles.json');

let failures = 0;
let warnings = 0;
const pass = (name, detail = '') => console.log(`PASS  ${name}${detail ? ` - ${detail}` : ''}`);
const fail = (name, detail = '') => { failures++; console.log(`FAIL  ${name}${detail ? ` - ${detail}` : ''}`); };
const warn = (name, detail = '') => { warnings++; console.log(`WARN  ${name}${detail ? ` - ${detail}` : ''}`); };
const check = (name, condition, detail) => (condition ? pass(name, detail) : fail(name, detail));

console.log('\n=== Africa OpportuScan ethical audit ===\n');

check('Score weights equal 100', Object.values(WEIGHTS).reduce((sum, weight) => sum + weight, 0) === 100);
check('AFRICA_ISO contains 54 countries', AFRICA_ISO.size === 54, `${AFRICA_ISO.size} codes`);

const pollutedProfile = {
  gender: 'F', ethnicity: 'x', religion: 'y', institution: 'Example University',
  universityRanking: 1, phone: '+229000000',
};
let invariant = true;
for (const testCase of cases) {
  const original = JSON.stringify(rankOpportunities(testCase.profile, opportunities, { now: NOW }));
  const polluted = JSON.stringify(rankOpportunities({ ...testCase.profile, ...pollutedProfile }, opportunities, { now: NOW }));
  if (original !== polluted) invariant = false;
}
check('T1 Sensitive and prestige attributes are ignored', invariant);

let transparent = true;
let detail = '';
for (const testCase of cases) {
  const result = rankOpportunities(testCase.profile, opportunities, { now: NOW });
  if (result.ranked.length + result.excluded.length !== opportunities.length) {
    transparent = false;
    detail = 'opportunity missing';
  }
  for (const excluded of result.excluded) {
    if (!excluded.reasons?.length || !excluded.reasons.every((reason) => reason.code && reason.message)) {
      transparent = false;
      detail = `exclusion without a reason (${excluded.id})`;
    }
  }
  for (const item of result.ranked) {
    const sum = Object.values(item.breakdown).reduce((total, criterion) => total + criterion.points, 0);
    if (Math.abs(sum - item.score) > 1 || item.score < 0 || item.score > 100) {
      transparent = false;
      detail = `inconsistent score (${item.id})`;
    }
  }
}
check('T2 No opportunity is hidden and every exclusion has a reason', transparent, detail);

const languageExclusion = cases.some((testCase) => rankOpportunities(testCase.profile, opportunities, { now: NOW })
  .excluded.some((item) => item.reasons.some((reason) => /LANG/.test(reason.code))));
check('T3 Language never causes an exclusion', !languageExclusion);

const minimumProfile = cases.find((testCase) => testCase.group === 'MIN');
const minimumResult = rankOpportunities(minimumProfile.profile, opportunities, { now: NOW });
check(
  'T4 Minimal profile returns results and suggestions',
  minimumResult.ranked.length > 0 && minimumResult.meta.profileHints.length > 0,
  `${minimumResult.ranked.length} opportunities, ${minimumResult.meta.profileHints.length} suggestions`,
);
const incomplete = minimumResult.ranked.find((item) => item.id === 'EX-009');
check(
  'T4b Incomplete opportunity remains visible with verification flags',
  !!incomplete && incomplete.flags.length >= 3,
  incomplete ? `${incomplete.flags.length} flags` : 'not found',
);

const baseProfile = { nationality: 'BJ', targetLevel: 'master', fields: ['informatique'], goal: 'bourse-etudes' };
const runAge = (age) => rankOpportunities(age === undefined ? baseProfile : { ...baseProfile, age }, opportunities, { now: NOW });
const eligibleAt18 = runAge(18).ranked.find((item) => item.id === 'EX-012');
const excludedAt17 = runAge(17).excluded.find((item) => item.id === 'EX-012');
const excludedAt31 = runAge(31).excluded.find((item) => item.id === 'EX-012');
const missingAge = runAge(undefined);
const missingAgeItem = missingAge.ranked.find((item) => item.id === 'EX-012');
const incompleteAt18 = runAge(18).ranked.find((item) => item.id === 'EX-009');

check('T6a Age 17 below minimum age is excluded', !!excludedAt17 && excludedAt17.reasons.some((reason) => reason.code === 'AGE' && /minimum/i.test(reason.message)));
check('T6b Age 18 at minimum age is eligible', !!eligibleAt18);
check('T6c Age 31 above maximum age is excluded', !!excludedAt31 && excludedAt31.reasons.some((reason) => reason.code === 'AGE'));
check('T6d Missing age keeps the opportunity with a verification flag', !!missingAgeItem && missingAgeItem.flags.some((flag) => /age/i.test(flag)));
check('T6e minAge 0 does not create an age exclusion or warning', ['EX-001', 'EX-010'].every((id) => runAge(17).ranked.some((item) => item.id === id && !item.flags.some((flag) => /age/i.test(flag)))));
check('T6g Missing minimum age with a provided age keeps and flags the opportunity', !!incompleteAt18 && incompleteAt18.flags.some((flag) => /minimum age/i.test(flag)));
check('T6h Missing minimum age without a provided age creates no warning', !!missingAge.ranked.find((item) => item.id === 'EX-009') && !missingAge.ranked.find((item) => item.id === 'EX-009').flags.some((flag) => /minimum age/i.test(flag)));
check('T6f Age does not affect the score', eligibleAt18.score === runAge(25).ranked.find((item) => item.id === 'EX-012').score);

console.log('\n--- T5 Exposure fairness for equivalent academic profiles ---');
const groups = {};
for (const testCase of cases) {
  const result = rankOpportunities(testCase.profile, opportunities, { now: NOW });
  const top = result.ranked.slice(0, 5);
  const average = top.length ? top.reduce((sum, item) => sum + item.score, 0) / top.length : 0;
  const causes = {};
  result.excluded.forEach((item) => item.reasons.forEach((reason) => { causes[reason.code] = (causes[reason.code] || 0) + 1; }));
  (groups[testCase.group] ??= []).push({ label: testCase.label, eligible: result.ranked.length, average: Math.round(average * 10) / 10, causes });
}
for (const [group, rows] of Object.entries(groups)) {
  if (rows.length < 2) continue;
  console.log(`\nGroup ${group}`);
  for (const row of rows) console.log(`  - ${row.label}: ${row.eligible} eligible, top-5 average ${row.average}, exclusions ${JSON.stringify(row.causes)}`);
  const eligibility = rows.map((row) => row.eligible);
  const scores = rows.map((row) => row.average);
  const eligibilityRatio = Math.min(...eligibility) / Math.max(...eligibility);
  const scoreGap = Math.max(...scores) - Math.min(...scores);
  if (eligibilityRatio < 0.75 || scoreGap > 5) {
    warn(`Group ${group}: exposure difference`, `eligibility ratio ${eligibilityRatio.toFixed(2)}, top-5 score gap ${scoreGap.toFixed(1)} points. Review source coverage.`);
  } else {
    pass(`Group ${group}: comparable exposure`);
  }
}

console.log(`\nSummary: ${failures} failure(s), ${warnings} warning(s).`);
console.log('T5 warnings describe source coverage or eligibility differences, not a scoring failure.\n');
process.exit(failures ? 1 : 0);
