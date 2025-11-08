# Gazette Analyzer Operations Guide

Date: November 8, 2025  
Owner: Cayman Watch Engineering

This guide documents the operational controls, maintenance routines, and
deployment workflow that keep the Gazette Analyzer reliable for client uploads.

## 1. Environment & Credentials

- **Supabase secrets**
  - `ANTHROPIC_API_KEY` – rotate quarterly and verify via test invocation.
  - `SUPABASE_SERVICE_ROLE_KEY` – store securely; do not expose in clients.
- **Frontend env**
  - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` configured in Bolt.new.
  - Re-run Bolt audit after any env change to confirm the values propagate.
- Maintain a secrets inventory with owner, rotation date, and test timestamp.

## 2. Schema & Data Management

- Keep `supabase/migrations` as the single source of truth.
- Before deploying schema changes:
  1. Run `supabase db lint`.
  2. Apply to local test project (`supabase db reset --local`).
  3. Run smoke tests (see §4).
- Storage monitoring
  - `analyzed_gazette_pdfs` grows quickly; set Supabase usage alerts.
  - Quarterly export old records or move PDF bytes to archival storage if ever reintroduced.
- Enable Supabase PITR or schedule weekly exports via `supabase db dump`.

## 3. Edge Function Deployment Workflow

1. Pull latest main branch (`git pull`).
2. Run quality checks: `npm run lint` (or relevant test command).
3. Deploy: `./node_modules/.bin/supabase functions deploy analyze-gazette-with-claude`.
4. Verify in dashboard: confirm new version timestamp.
5. Trigger smoke test (upload latest gazette).
6. Monitor logs for:
   - `COMMERCIAL section analysis`
   - `Batch ... text preview`
   - Any `Failed to save gazette analysis` errors.

## 4. Smoke Test Procedure

After each deployment or schema change:

1. Upload a known “large” gazette (>150k tokens) via the Bolt UI.
2. Confirm UI shows non-zero notices and summary stats align with manual count.
3. In Supabase:
   - `analyzed_gazette_pdfs`: check `processing_mode`, `estimated_input_tokens`, `summary_stats`.
   - `gazette_liquidation_notices`: verify row count and sample liquidation fields.
4. Export CSV to ensure downstream workflows receive expected structure.

## 5. Monitoring & Alerting

- **Edge Function logs**: configure Supabase log routing to Slack/email.
  - Alert on `Failed to save gazette analysis`.
  - Alert on `Batch processing failed`.
- **Usage metrics**: track Claude token consumption weekly using `extraction_metadata.estimated_input_tokens`.
- **Health dashboard** (optional future enhancement):
  - latest success timestamp
  - number of notices extracted per upload
  - rolling error count

## 6. Incident Response Checklist

1. Gather logs (CLI: `./node_modules/.bin/supabase functions logs analyze-gazette-with-claude`).
2. Confirm Supabase connectivity and secrets.
3. Check recent migrations; rollback if necessary.
4. Re-run smoke test with known-good gazette.
5. Communicate to stakeholders via existing Slack channel.

## 7. Change Control & Documentation

- Tag stable releases (`gazette-analyzer-YYYY-MM-DD`) after major updates.
- Update this guide whenever deployment workflow or monitoring setup changes.
- Store meeting notes / retrospective outcomes in the repo’s `SYSTEM_STATUS.md`.

## 8. Future Enhancements (Backlog)

- Automated nightly smoke test using GitHub Actions + Supabase CLI.
- Integration with S3 for PDF archival to reduce Postgres storage footprint.
- Metrics widget on frontend summarizing extraction success rate.

---

For clarifications or updates, contact the Engineering lead or open an issue in the repository.

