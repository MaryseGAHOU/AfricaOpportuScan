import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));

const SCORING_URL = new URL('../scoring-kit/scoring.js', import.meta.url).href;
const { rankOpportunities, ALLOWED_PROFILE_KEYS } = await import(SCORING_URL);
const { enrichAll } = await import(new URL('./lib/enrich.js', import.meta.url).href);

const opportunities = enrichAll(
  JSON.parse(await readFile(join(HERE, 'data', 'opportunities.json'), 'utf8'))
);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const COUNTRIES = [
  ['ZA', 'Afrique du Sud'], ['DZ', 'Algérie'], ['AO', 'Angola'], ['BJ', 'Bénin'], ['BW', 'Botswana'],
  ['BF', 'Burkina Faso'], ['BI', 'Burundi'], ['CM', 'Cameroun'], ['CV', 'Cap-Vert'], ['CF', 'Centrafrique'],
  ['KM', 'Comores'], ['CG', 'Congo'], ['CD', 'RD Congo'], ['CI', 'Côte d’Ivoire'], ['DJ', 'Djibouti'],
  ['EG', 'Égypte'], ['ER', 'Érythrée'], ['SZ', 'Eswatini'], ['ET', 'Éthiopie'], ['GA', 'Gabon'],
  ['GM', 'Gambie'], ['GH', 'Ghana'], ['GN', 'Guinée'], ['GW', 'Guinée-Bissau'], ['GQ', 'Guinée équatoriale'],
  ['KE', 'Kenya'], ['LS', 'Lesotho'], ['LR', 'Liberia'], ['LY', 'Libye'], ['MG', 'Madagascar'],
  ['MW', 'Malawi'], ['ML', 'Mali'], ['MA', 'Maroc'], ['MR', 'Mauritanie'], ['MU', 'Maurice'],
  ['MZ', 'Mozambique'], ['NA', 'Namibie'], ['NE', 'Niger'], ['NG', 'Nigeria'], ['UG', 'Ouganda'],
  ['RW', 'Rwanda'], ['ST', 'São Tomé-et-Príncipe'], ['SN', 'Sénégal'], ['SC', 'Seychelles'], ['SL', 'Sierra Leone'],
  ['SO', 'Somalie'], ['SS', 'Soudan du Sud'], ['SD', 'Soudan'], ['TZ', 'Tanzanie'], ['TD', 'Tchad'],
  ['TG', 'Togo'], ['TN', 'Tunisie'], ['ZM', 'Zambie'], ['ZW', 'Zimbabwe'],
];

const FIELDS = [
  ['informatique', 'Informatique'], ['data-science', 'Data science'], ['ia', 'Intelligence artificielle'],
  ['mathematiques', 'Mathématiques'], ['physique', 'Physique'], ['chimie', 'Chimie'],
  ['ingenierie', 'Ingénierie'], ['energie', 'Énergie'], ['biologie', 'Biologie'],
  ['sante', 'Santé'], ['agronomie', 'Agronomie'], ['environnement', 'Environnement'],
  ['economie', 'Économie'], ['gestion', 'Gestion'], ['droit', 'Droit'],
  ['sciences-politiques', 'Sciences politiques'], ['education', 'Éducation'], ['sociologie', 'Sociologie'],
  ['lettres', 'Lettres'], ['langues', 'Langues'], ['histoire', 'Histoire'], ['arts', 'Arts'],
];

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/api/meta') {
    return send(res, 200, JSON.stringify({
      countries: COUNTRIES,
      fields: FIELDS,
      allowedProfileKeys: ALLOWED_PROFILE_KEYS,
      stats: { total: opportunities.length, sources: [...new Set(opportunities.map((o) => o.provider))].length },
      generatedAt: new Date().toISOString(),
    }));
  }

  if (req.method === 'POST' && url.pathname === '/api/rank') {
    let chunks = [];
    for await (const c of req) chunks.push(c);
    let profile;
    try {
      profile = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    } catch {
      return send(res, 400, JSON.stringify({ error: 'JSON invalide' }));
    }
    try {
      const result = rankOpportunities(profile, opportunities, {});
      return send(res, 200, JSON.stringify(result));
    } catch (e) {
      return send(res, 400, JSON.stringify({ error: e.message }));
    }
  }

  const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const safe = normalize(rel).replace(/^(\.\.[/\\])+/, '');
  const file = join(HERE, 'public', safe);
  if (!file.startsWith(join(HERE, 'public'))) {
    return send(res, 403, 'Forbidden', 'text/plain');
  }
  try {
    const data = await readFile(file);
    return send(res, 200, data, MIME[extname(file)] || 'application/octet-stream');
  } catch {
    return send(res, 404, 'Not found', 'text/plain');
  }
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => {
  console.log(`Africa OpportuScan — dashboard prêt sur http://localhost:${PORT} (${opportunities.length} opportunités enrichies)`);
});
