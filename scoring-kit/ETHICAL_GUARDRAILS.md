# Ethical Guardrails

This document defines the safeguards used by Africa OpportuScan and the answers to give during the jury presentation.

## Safeguards

| # | Safeguard | Implementation | Verification |
|---|---|---|---|
| 1 | Minimal data | Only the 10 fields in `ALLOWED_PROFILE_KEYS` are read. | `sanitizeProfile` / T1 |
| 2 | No sensitive attributes | Gender, ethnicity, religion, institution, and university ranking are never read. | T1 |
| 3 | Eligibility-only attributes | Nationality and age can determine eligibility but never affect the score. | T6 |
| 4 | Language is never an exclusion | A language gap becomes a recommendation, not a rejection. | T3 |
| 5 | Missing data is neutral | Missing fields receive 0.6 and a verification note. | T4 / T4b |
| 6 | Full transparency | Every opportunity exposes its criteria, reasons, gaps, and flags. | T2 |
| 7 | No preference penalty | No destination preference receives full destination points. | `destinationFit` |
| 8 | Advisory score | The interface always asks users to verify the official source. | `meta.disclaimer` |

## What the system does not do

- It does not predict admission chances.
- It does not judge a person's merit.
- It does not rank students against each other.
- It does not exclude opportunities silently.

## Personal data and Apify

- The Actor Dataset contains public opportunity records, not student profiles.
- The dashboard sanitizes the profile and never logs it.
- The MVP does not request names, email addresses, phone numbers, or identity documents.
- Age is optional and is only used when an opportunity has an official age limit.
- The public dashboard should be deployed over HTTPS.

## Fairness and source coverage

The audit compares equivalent academic profiles. A T5 warning means that source coverage or language requirements may expose profiles differently. It does not prove that the scoring formula is biased. The team should disclose warnings rather than hide them.

## Submission checklist

- [ ] The Actor is published publicly.
- [ ] Pay-per-event pricing is active.
- [ ] The public Store URL is recorded.
- [ ] The audit has been run on the production dataset.
- [ ] Any fairness warning is explained.
- [ ] The dashboard shows the official-source warning.
- [ ] Excluded opportunities remain visible with their reasons.
- [ ] The three team members and demo responsibilities are confirmed.

## Jury answers

**Is your AI biased?**  
We do not claim that bias is impossible. We limit it through data minimization, measure it with an automated audit, and expose uncertainty in the interface.

**Why not use an LLM for ranking?**  
An explainable weighted score tells the applicant why an opportunity was selected and what action to take. An LLM can later help extract fields from source pages without replacing the transparent ranking API.

**Who makes the final decision?**  
The applicant. Africa OpportuScan explains the match; the application is submitted on the official website.
