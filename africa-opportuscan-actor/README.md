# Africa OpportuScan Actor

Apify Actor that collects scholarships, grants, and academic opportunities from configurable public sources. The Actor writes opportunity records to a Dataset that the Africa OpportuScan dashboard can consume.

## Team 3M

Maryse, Mélène, and Mevic.

## How it works

The `sources` input describes the pages to visit and their CSS selectors. For each matching card, the Actor extracts the title, link, deadline when available, and collection timestamp. Source URLs must use HTTP or HTTPS.

## Important files

- `.actor/actor.json`: Actor metadata.
- `.actor/input_schema.json`: input contract and default values.
- `.actor/output_schema.json`: Dataset output link definition.
- `.actor/pay_per_event.json`: Pay-per-event configuration.
- `src/main.js`: CheerioCrawler scraping logic.

## Example input

```json
{
  "sources": [
    {
      "sourceName": "Example source",
      "url": "https://example.org/scholarships",
      "listItemSelector": "article",
      "titleSelector": "h2 a",
      "linkSelector": "h2 a",
      "deadlineSelector": ".deadline"
    }
  ],
  "maxItemsPerSource": 30
}
```

## Example output

```json
{
  "source": "Example source",
  "title": "Example scholarship",
  "link": "https://example.org/scholarships/example",
  "deadline": "2026-12-15",
  "deadlineText": "15 December 2026",
  "scrapedAt": "2026-09-25T03:00:00.000Z"
}
```

## Run locally

```bash
npm install
APIFY_LOCAL_STORAGE_DIR=./storage npm start
```

Results are written to `storage/datasets/default/`.

## Publication and monetization

1. Log in with `apify login`.
2. Push the Actor with `apify push`.
3. Verify the schemas in the Apify Console.
4. Enable the **Pay per event** pricing model.
5. Use `apify-default-dataset-item` as the primary event for default Dataset items.
6. Publish the Actor on the Apify Store.
7. Submit the public Store URL for the hackathon.

**Public Store URL:** https://apify.com/maryse_gahou/africa-opportuscan

The Pay-per-event file is a configuration reference. The pricing must also be enabled in the Apify Console.

## Transparency and limitations

The Actor collects public pages and must not be used to bypass authentication, paywalls, robots.txt restrictions, or a site's terms of use. Extracted data never replaces the official page. Fields that cannot be determined remain null and must be verified manually.
