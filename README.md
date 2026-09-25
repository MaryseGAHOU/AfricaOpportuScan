# Africa OpportuScan

Africa OpportuScan helps African students discover scholarships, grants, and academic opportunities, then compare them with an explainable score.

## Team 3M

- Maryse
- Mélène
- Mevic

## What the project does

The Apify Actor is the product entry point. It receives public source URLs and CSS selectors, scrapes opportunity listings, and writes public opportunity records to an Apify Dataset. The dashboard consumes the exported data, enriches incomplete fields, and shows the ranking reasons and verification notes.

The ranking is deterministic and explainable. It does not predict admission chances, rank students against each other, or replace verification on the official source.

## Architecture

1. **Apify Actor** collects public pages from configurable sources.
2. **Actor Dataset** stores public opportunity records.
3. **Dashboard** enriches the records, accepts a local profile, and explains the ranking.
4. **Pay-per-event** uses `apify-default-dataset-item` for each item written to the Dataset. Actor start is charged automatically by Apify.

## Run locally

Requires Node.js 18 or newer.

```bash
cd africa-opportuscan-actor
npm install
$env:APIFY_LOCAL_STORAGE_DIR="./storage"
npm start
```

Run the dashboard from the project root:

```bash
node dashboard/server.js
```

Open `http://localhost:3000`.

## Data and safety

- The Actor validates source fields and accepts only HTTP and HTTPS URLs.
- The output contract is documented in `africa-opportuscan-actor/.actor/output_schema.json`.
- Missing metadata remains null and is shown as requiring verification.
- Student profiles are not written to the Actor Dataset.
- The dashboard sanitizes profile fields and does not log the profile.
- The public dashboard must use HTTPS.

## Tests

From the project root:

```bash
node --check dashboard/public/app.js
node --check dashboard/server.js
```

From `scoring-kit/`:

```bash
node audit.js
```

The sample opportunities used by the audit are explicitly fictional and are not part of the dashboard data.

## Submission links

- **Public Apify Store URL**: https://apify.com/maryse_gahou/africa-opportuscan
- **Public GitHub URL**: https://github.com/MaryseGAHOU/AfricaOpportuScan
- **Live dashboard URL**: https://africaopportuscan.onrender.com/

Submit the public Apify Store link for the hackathon.
