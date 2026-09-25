import { createHash } from 'node:crypto';

const FIELD_PATTERNS = [
  ['informatique', /computer science|informatics|computing|informatique|\bict\b|software|cyber[- ]?sécurité|cyber[- ]?security/],
  ['data-science', /data science|data analytics|big data|statistic|statistique/],
  ['ia', /artificial intelligence|intelligence artificielle|machine learning|\bai\b|\bia\b/],
  ['mathematiques', /mathematic|mathématique|\bmaths?\b/],
  ['physique', /physics|physique/],
  ['chimie', /chemistry|chimie/],
  ['ingenierie', /engineering|ingénier|engineer/],
  ['energie', /energy|énerg|energ|renewable|renouvelable/],
  ['biologie', /biology|biologie|biological/],
  ['sante', /health|medical|medicine|santé|sante|médecin|nursing|pharmac|public health/],
  ['agronomie', /agricultur|agronom|agro\b|agroaliment/],
  ['environnement', /environment|environnement|climate|climat/],
  ['economie', /economic|economy|économ|econom|financ/],
  ['gestion', /management|business|gestion|\bmba\b/],
  ['droit', /\blaw\b|legal|droit/],
  ['sciences-politiques', /political science|science politique|politics|governance|gouvernance/],
  ['education', /education|éducation|pedagog|enseign/],
  ['sociologie', /sociology|sociologie/],
  ['lettres', /literature|littérat|\blettres\b/],
  ['langues', /linguistic|linguistique|\blanguage\b|\blangue\b/],
  ['histoire', /history|histoire/],
  ['arts', /\barts?\b|design|architecture|humanities|sciences humaines/],
];

const LEVEL_PATTERNS = [
  ['postdoc', /post[- ]?doc/],
  ['doctorat', /\bph\.?d\b|doctorat|doctoral|d\.?phil\b|studentship/],
  ['master', /\bmasters?\b|\bmsc\b|\bmphil\b|\bmba\b|postgraduate|\bma\b\b|\bm\.?a\b|magistère/],
  ['licence', /undergraduate|bachelor|\bb\.?sc\b|\bb\.?a\b|licence|\blicenciatur/],
];

const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function enrichOpportunity(raw) {
  const t = ` ${slug(raw.title || '')} `;
  const inferred = [];
  const out = {
    id: createHash('sha1').update(String(raw.link || raw.title)).digest('hex').slice(0, 12),
    title: raw.title,
    provider: raw.source || 'source inconnue',
    url: raw.link || null,
    deadline: raw.deadline || null,
    deadlineText: raw.deadlineText || null,
    source: raw.source || null,
  };

  const levels = [];
  for (const [lv, re] of LEVEL_PATTERNS) if (re.test(t)) levels.push(lv);
  if (levels.length) {
    out.levels = levels;
    inferred.push('levels');
  }

  const fields = [];
  for (const [f, re] of FIELD_PATTERNS) if (re.test(t)) fields.push(f);
  if (fields.length) {
    out.fields = fields;
    inferred.push('fields');
  }

  let type = null;
  if (/internship|traineeship|\bstages?\b/.test(t)) type = 'stage-recherche';
  else if (/exchange|mobility|mobilit/.test(t)) type = 'mobilite';
  else if (/(course|training|formation|bootcamp|short course)/.test(t)) type = 'formation';
  else if (/phd|doctoral|doctorat/.test(t) && /(scholarship|fellowship|funding|grant|studentship)/.test(t)) type = 'financement-these';
  else if (/scholarship|bourse|fellowship|award|grant/.test(t)) type = 'bourse-etudes';
  if (type) {
    out.type = type;
    inferred.push('type');
  }

  if (/fully[- ]funded|entièrement financ/.test(t)) {
    out.funding = 'full';
    inferred.push('funding');
  } else if (/\bfunded\b|partial|partiel|bursary/.test(t)) {
    out.funding = 'partial';
    inferred.push('funding');
  }

  out.eligibleCountries = null;
  out.hostCountry = null;
  out.hostRegion = null;
  out.languages = null;

  out._inferred = inferred;
  out._flagsSource = inferred.length ? null : 'aucun critère déductible du titre';
  return out;
}

export function enrichAll(items) {
  return items.map(enrichOpportunity);
}
