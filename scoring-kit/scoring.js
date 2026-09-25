export const WEIGHTS = { field: 35, goal: 15, funding: 15, language: 15, deadline: 10, destination: 10 };
export const NEUTRAL = 0.6;
export const LEVELS = ['licence', 'master', 'doctorat', 'postdoc'];
export const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'native'];

export const ALLOWED_PROFILE_KEYS = [
  'nationality', 'residenceCountry', 'age', 'currentLevel', 'targetLevel',
  'fields', 'goal', 'languages', 'needsFullFunding', 'preferredDestinations',
];

export const AFRICA_ISO = new Set(
  ('DZ AO BJ BW BF BI CV CM CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU ' +
   'MA MZ NA NE NG RW ST SN SC SL SO ZA SS SD TZ TG TN UG ZM ZW').split(' ')
);

const FIELD_GROUPS = {
  stem: ['informatique', 'data-science', 'ia', 'mathematiques', 'physique', 'chimie', 'ingenierie', 'energie'],
  vivant: ['biologie', 'sante', 'agronomie', 'environnement'],
  social: ['economie', 'gestion', 'droit', 'sciences-politiques', 'education', 'sociologie'],
  lettres: ['lettres', 'langues', 'histoire', 'arts'],
};
const FIELD_TO_GROUP = Object.fromEntries(
  Object.entries(FIELD_GROUPS).flatMap(([g, fs]) => fs.map((f) => [f, g]))
);

const DAY = 86_400_000;
const norm = (v) => String(v).trim().toLowerCase();
const up = (v) => String(v).trim().toUpperCase();
const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;

export function sanitizeProfile(raw = {}) {
  const p = {};
  for (const k of ALLOWED_PROFILE_KEYS) if (raw[k] !== undefined && raw[k] !== null) p[k] = raw[k];
  return p;
}

export function validateProfile(p) {
  const errors = [];
  if (!p.nationality) errors.push('nationality is required for eligibility');
  if (!p.targetLevel || !LEVELS.includes(norm(p.targetLevel))) {
    errors.push(`targetLevel must be one of: ${LEVELS.join(', ')}`);
  }
  return errors;
}

function daysLeft(deadline, now) {
  if (!deadline) return null;
  const s = String(deadline);
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  const end = /^\d{4}-\d{2}-\d{2}$/.test(s) ? t + DAY : t;
  return Math.floor((end - now.getTime()) / DAY);
}

const cefrIdx = (level, fallback) => {
  const i = CEFR.findIndex((c) => c.toLowerCase() === norm(level ?? ''));
  return i >= 0 ? i : fallback;
};




function checkEligibility(p, opp, days) {
  const reasons = [];
  const flags = [];

  if (days !== null && days < 0) {
    reasons.push({ code: 'DEADLINE_PASSED', message: `Deadline passed (${opp.deadline})` });
  }

  if (opp.levels?.length) {
    if (!opp.levels.map(norm).includes(norm(p.targetLevel))) {
      reasons.push({ code: 'LEVEL', message: `Target level (${p.targetLevel}) is not covered: ${opp.levels.join(', ')}` });
    }
  } else {
    flags.push('Eligible study levels are not specified - verify');
  }

  const eligible = (opp.eligibleCountries ?? []).map(up);
  if (!eligible.length) {
    flags.push('Eligible countries are not specified - verify');
  } else {
    const nat = up(p.nationality);
    const ok = eligible.includes('ALL') || eligible.includes(nat) || (eligible.includes('AFRICA') && AFRICA_ISO.has(nat));
    if (!ok) reasons.push({ code: 'NATIONALITY', message: `Nationality ${nat} is not eligible for this opportunity` });
  }


  const rawMin = opp.minAge;
  const minKnown = rawMin !== undefined && rawMin !== null && rawMin !== '' && Number.isFinite(Number(rawMin));
  const minAge = minKnown ? Number(rawMin) : 0;
  const maxAge = Number(opp.maxAge) || null; // absent = aucune limite maximale
  if (!minKnown && p.age != null) flags.push('Minimum age is not specified - verify');
  if (minAge > 0 || maxAge !== null) {
    if (p.age == null) {
      const range = [minAge > 0 ? `minimum ${minAge} years` : null, maxAge !== null ? `maximum ${maxAge} years` : null].filter(Boolean).join(', ');
      flags.push(`Age condition (${range}) - verify`);
    } else {
      if (p.age < minAge) reasons.push({ code: 'AGE', message: `Minimum age required: ${minAge} years` });
      if (maxAge !== null && p.age > maxAge) reasons.push({ code: 'AGE', message: `Age limit: ${maxAge} years` });
    }
  }

  return { reasons, flags };
}




function fieldFit(p, opp) {
  const mine = (p.fields ?? []).map(norm);
  if (!mine.length) return { s: NEUTRAL };
  const theirs = (opp.fields ?? []).map(norm);
  if (!theirs.length) return { s: NEUTRAL, flag: 'Eligible fields are not specified - verify' };
  if (theirs.includes('all')) return { s: 0.7, reason: 'Open to all fields' };
  const hit = mine.filter((f) => theirs.includes(f));
  if (hit.length) return { s: 1, reason: `Matching field: ${hit.join(', ')}` };
  const groups = new Set(mine.map((f) => FIELD_TO_GROUP[f]).filter(Boolean));
  if (theirs.some((f) => groups.has(FIELD_TO_GROUP[f]))) return { s: 0.5, reason: 'Related field' };
  return { s: 0, gap: 'Different field' };
}

function goalFit(p, opp) {
  if (!p.goal) return { s: NEUTRAL };
  if (!opp.type) return { s: NEUTRAL, flag: 'Opportunity type is not specified' };
  return norm(p.goal) === norm(opp.type)
    ? { s: 1, reason: 'Matches your goal' }
    : { s: 0.3, gap: `Different opportunity type (${opp.type})` };
}

function fundingFit(p, opp) {
  if (!opp.funding) return { s: NEUTRAL, flag: 'Funding level is not specified - verify' };
  const need = p.needsFullFunding === true;
  const table = need ? { full: 1, partial: 0.5, none: 0.1 } : { full: 1, partial: 0.8, none: 0.4 };
  const s = table[norm(opp.funding)] ?? NEUTRAL;
  const out = { s };
  if (norm(opp.funding) === 'full') out.reason = 'Full funding';
  if (need && norm(opp.funding) === 'partial') out.gap = 'Partial funding - additional funding may be needed';
  if (need && norm(opp.funding) === 'none') out.gap = 'No funding announced';
  return out;
}


function languageFit(p, opp) {
  const req = opp.languages ?? [];
  if (!req.length) return { s: NEUTRAL, flag: 'Required languages are not specified - verify' };
  const mine = {};
  for (const l of p.languages ?? []) {
    const i = cefrIdx(l.level, -1);
    if (i >= 0) mine[norm(l.code)] = i;
  }
  if (!Object.keys(mine).length) return { s: NEUTRAL };

  let best = { s: -1 };
  for (const r of req) {
    const code = norm(r.code);
    const minIdx = cefrIdx(r.minLevel, 3);
    const have = mine[code];
    let cand;
    if (have !== undefined && have >= minIdx) {
      cand = { s: 1, reason: `Language ${code.toUpperCase()}: sufficient level` };
    } else if (have !== undefined) {
      cand = { s: 0.5, gap: `${code.toUpperCase()}: ${CEFR[minIdx]} requested (your level: ${CEFR[have]}) - language development may be needed` };
    } else {
      cand = { s: 0.25, gap: `${code.toUpperCase()} ${CEFR[minIdx]} requested - test or training may be needed` };
    }
    if (cand.s > best.s) best = cand;
  }
  return best;
}

function deadlineFit(days) {
  if (days === null) return { s: NEUTRAL, flag: 'Deadline is not specified - verify on the official website' };
  if (days >= 30) return { s: 1, reason: `${days} days to prepare the application` };
  if (days >= 14) return { s: 0.7, reason: `${days} days remaining` };
  if (days >= 7) return { s: 0.4, gap: `Deadline is approaching (${days} days)` };
  return { s: 0.2, gap: `Deadline is very close (${days} day${days > 1 ? 's' : ''})` };
}

function destinationFit(p, opp) {
  const prefs = (p.preferredDestinations ?? []).map(norm);
  if (!prefs.length) return { s: 1 };
  const host = [opp.hostCountry, opp.hostRegion].filter(Boolean).map(norm);
  if (!host.length) return { s: NEUTRAL, flag: 'Host country is not specified' };
  return host.some((h) => prefs.includes(h)) ? { s: 1, reason: 'Preferred destination' } : { s: 0.3 };
}

const label = (score) => (score >= 80 ? 'excellent' : score >= 65 ? 'bon' : score >= 50 ? 'possible' : 'faible');



export function scoreOpportunity(profile, opp, now = new Date()) {
  const days = daysLeft(opp.deadline, now);
  const elig = checkEligibility(profile, opp, days);
  if (elig.reasons.length) {
    return { eligible: false, excluded: { id: opp.id, title: opp.title, url: opp.url, reasons: elig.reasons } };
  }

  const parts = {
    field: fieldFit(profile, opp),
    goal: goalFit(profile, opp),
    funding: fundingFit(profile, opp),
    language: languageFit(profile, opp),
    deadline: deadlineFit(days),
    destination: destinationFit(profile, opp),
  };

  let total = 0;
  const breakdown = {};
  const reasons = [];
  const gaps = [];
  const flags = [...elig.flags];
  for (const [k, c] of Object.entries(parts)) {
    const pts = WEIGHTS[k] * c.s;
    total += pts;
    breakdown[k] = { weight: WEIGHTS[k], fit: r2(c.s), points: r1(pts) };
    if (c.reason) reasons.push(c.reason);
    if (c.gap) gaps.push(c.gap);
    if (c.flag) flags.push(c.flag);
  }

  const score = Math.round(total);
  return {
    eligible: true,
    item: {
      id: opp.id, title: opp.title, url: opp.url, provider: opp.provider, type: opp.type,
      deadline: opp.deadline ?? null, daysLeft: days,
      score, label: label(score), breakdown, reasons, gaps, flags,
      _sort: total,
    },
  };
}

export function rankOpportunities(rawProfile, opportunities, { now = new Date(), topK } = {}) {
  const profile = sanitizeProfile(rawProfile);
  const errors = validateProfile(profile);
  if (errors.length) throw new Error(`Invalid profile: ${errors.join('; ')}`);

  const ranked = [];
  const excluded = [];
  for (const opp of opportunities) {
    const r = scoreOpportunity(profile, opp, now);
    if (r.eligible) ranked.push(r.item);
    else excluded.push(r.excluded);
  }

  ranked.sort((a, b) =>
    b._sort - a._sort ||
    (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity) ||
    String(a.id).localeCompare(String(b.id))
  );
  ranked.forEach((x) => delete x._sort);

  const profileHints = [];
  if (!profile.fields?.length) profileHints.push('Add your fields of study to refine the ranking');
  if (!profile.goal) profileHints.push('Specify your goal (scholarship, PhD, internship, etc.)');
  if (!profile.languages?.length) profileHints.push('Add your languages to identify gaps to work on');
  if (profile.needsFullFunding === undefined) profileHints.push('Indicate whether you need full funding');

  return {
    ranked: topK ? ranked.slice(0, topK) : ranked,
    excluded,
    meta: {
      evaluated: opportunities.length,
      eligible: ranked.length,
      weights: WEIGHTS,
      neutralValue: NEUTRAL,
      profileHints,
      disclaimer:
        'Advisory score based on automatically collected information. Verify the criteria and dates on the official website before applying.',
    },
  };
}
