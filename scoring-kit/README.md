# Scoring Kit

This module contains the explainable opportunity ranking engine, profile schema, audit script, and ethical safeguards for Africa OpportuScan.

## Contents

| File | Purpose |
|---|---|
| `student_profile.schema.json` | Student profile contract |
| `scoring.js` | Eligibility filters, weighted ranking, and explanations |
| `audit.js` + `data/` | Automated audit and test fixtures |
| `ETHICAL_GUARDRAILS.md` | Ethical safeguards, checklist, and jury answers |

Run the audit from this directory:

```bash
node audit.js
```

Node.js 18 or newer is required. There are no runtime dependencies.

## Ranking model

### Step 1: Eligibility

An opportunity is excluded only when its deadline has passed, its eligible levels do not cover the target level, its eligible countries exclude the applicant, or its age limits exclude the applicant. Excluded items are returned with a reason.

### Step 2: Score from 0 to 100

| Criterion | Weight | Logic |
|---|---:|---|
| Field of study | 35 | Exact match = 1, related group = 0.5, all fields = 0.7, different = 0 |
| Goal | 15 | Same type = 1, otherwise 0.3 |
| Funding | 15 | Full = 1, partial = 0.5 when full funding is required or 0.8 otherwise |
| Language | 15 | Sufficient = 1, lower level = 0.5, missing language = 0.25; never an exclusion |
| Deadline | 10 | 30+ days = 1, 14-29 = 0.7, 7-13 = 0.4, under 7 = 0.2 |
| Destination | 10 | No preference = 1, match = 1, otherwise 0.3 |

Missing data receives a neutral value of 0.6 and a verification note. Labels are `excellent` at 80+, `good` at 65+, `possible` at 50+, and `low` below 50. Ties are ordered by the nearest deadline.

The engine is deterministic and explainable. It does not predict admission chances and does not rank students against each other.

## Data contract

The dashboard enriches the Actor output before ranking. The ranking contract supports these fields:

```json
{
  "id": "unique string",
  "title": "Opportunity title",
  "provider": "Source name",
  "url": "https://example.org/opportunity",
  "type": "bourse-etudes | financement-these | stage-recherche | mobilite | formation",
  "levels": ["licence", "master", "doctorat", "postdoc"],
  "fields": ["informatique", "agronomie"],
  "eligibleCountries": ["ALL"],
  "hostCountry": "FR",
  "hostRegion": "europe",
  "funding": "full | partial | none",
  "languages": [{ "code": "fr", "minLevel": "B2" }],
  "deadline": "2026-11-25",
  "minAge": 0,
  "maxAge": 30
}
```

Fields that cannot be verified remain `null` or absent. The enrichment layer only derives values from published titles and deadline text, and records inferred fields for transparency.

## Using the engine

```js
import { rankOpportunities } from './scoring.js';

const result = rankOpportunities(profile, opportunities, { now: new Date() });
```

The result contains `ranked`, `excluded`, and `meta`. It does not contain the submitted profile.

## Ethics

- The profile is sanitized against a strict allowlist.
- Gender, ethnicity, religion, institution, and university ranking are never read.
- Nationality and age are used for eligibility only.
- Language never causes an exclusion.
- Missing data is neutral, not a penalty.
- Every exclusion includes a reason.
- The score is advisory. Applicants must verify the official source.

The Actor stores public opportunity records, not student profiles. The dashboard should be deployed with HTTPS for a public release.
