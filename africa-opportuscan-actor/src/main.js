import { Actor } from 'apify';
import { CheerioCrawler, log } from 'crawlee';

await Actor.init();

const input = (await Actor.getInput()) ?? {};
const { sources = [], maxItemsPerSource = 30 } = input;

if (!sources.length) {
    log.error('No sources provided in input. Add at least one source (see input_schema.json prefill for the format).');
    await Actor.exit();
}

let totalScraped = 0;
const seenLinks = new Set();

const normalizeLink = (url) => url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');

function parseDeadline(raw) {
    if (!raw) return { deadline: null, deadlineText: null };
    const text = raw.replace(/\s+/g, ' ').replace(/\u00a0/g, ' ').trim();

    const rel = text.match(/(\d+)\s*(?:days?|jours?|días?)\s*(?:left|restant|restantes|remaining)/i);
    if (rel) {
        const d = new Date();
        d.setDate(d.getDate() + Number(rel[1]));
        return { deadline: d.toISOString().slice(0, 10), deadlineText: text };
    }

    const iso = text.match(/\d{4}-\d{2}-\d{2}/);
    if (iso) return { deadline: iso[0], deadlineText: text };
    const dmy = text.match(/\b(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})\b/);
    if (dmy) {
        const [, dd, mm, yyyy] = dmy;
        if (Number(mm) >= 1 && Number(mm) <= 12) {
            return { deadline: `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`, deadlineText: text };
        }
    }

    const parsed = Date.parse(text.replace(/(\d{1,2})(?:st|nd|rd|th)\b/i, '$1'));
    if (!Number.isNaN(parsed) && /\d{4}/.test(text)) {
        return { deadline: new Date(parsed).toISOString().slice(0, 10), deadlineText: text };
    }
    return { deadline: null, deadlineText: text };
}

const crawler = new CheerioCrawler({
    requestHandlerTimeoutSecs: 60,
    async requestHandler({ request, $ }) {
        const { sourceName, listItemSelector, titleSelector, linkSelector, deadlineSelector } = request.userData;

        const items = $(listItemSelector);
        log.info(`[${sourceName}] found ${items.length} candidate items`);

        let countForSource = 0;

        for (const el of items.toArray()) {
            if (countForSource >= maxItemsPerSource) break;

            const $el = $(el);
            const title = $el.find(titleSelector).first().text().trim();
            if (!title) continue;

            const rawHref = linkSelector ? $el.find(linkSelector).first().attr('href') : null;
            const link = rawHref ? new URL(rawHref, request.loadedUrl).toString() : request.loadedUrl;

            const key = normalizeLink(link);
            if (seenLinks.has(key)) continue;
            seenLinks.add(key);

            const { deadline, deadlineText } = parseDeadline(
                deadlineSelector ? $el.find(deadlineSelector).first().text() : null
            );

            const opportunity = {
                source: sourceName,
                title,
                link,
                deadline,
                deadlineText,
                scrapedAt: new Date().toISOString(),
            };

            await Actor.pushData(opportunity, 'opportunity-scraped');

            countForSource++;
            totalScraped++;
        }
    },
    failedRequestHandler({ request }, error) {
        log.warning(`Request failed for ${request.url}: ${error.message}`);
    },
});

const safeSources = sources.map((source) => {
    if (!source.sourceName || !source.url || !source.listItemSelector || !source.titleSelector) {
        throw new Error('Each source requires sourceName, url, listItemSelector and titleSelector');
    }
    const url = new URL(source.url);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`Unsupported URL protocol: ${url.protocol}`);
    return { ...source, url: url.toString() };
});

const requests = safeSources.map((s) => ({
    url: s.url,
    userData: { ...s },
}));

await crawler.run(requests);

log.info(`Done. Total opportunities scraped and charged: ${totalScraped}`);

await Actor.exit();
