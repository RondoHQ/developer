---
title: Twelve browser-import pipeline
---

`pipelines/sync-twelve.js` imports validated Twelve browser reports into the existing Rondo Club report posts. It uses normal Twelve login and export controls through Playwright, without a custom Twelve API. Run it only on the production sync host as the `rondo` service account; documentation maintenance never executes it.

## Configuration and schedule

Configure `TWELVE_USERNAME`, `TWELVE_PASSWORD` and numeric `TWELVE_CLIENT_ID`, alongside the existing Rondo API credentials. Install Playwright Chromium and provide Python 3 for the bounded ZIP reader. Never commit credentials, exports or browser session URLs.

The cron installer adds `0 * * * *` for `scripts/sync.sh twelve --scheduled`. The hourly check first reads `/rondo/v1/twelve/schedule`, caches it privately in `data/twelve-schedule.json` and opens Twelve only when due. Windows use Europe/Amsterdam, a two-hour interval starting at each window's opening hour, and always include the closing hour. End `24` means midnight following that weekday. Default windows are Tuesday–Friday 20:00–24:00 and Saturday/Sunday 10:00–24:00; Monday is disabled. Administrators change these in **Kassaomzet → Synchronisatie**. An empty schedule disables source logins; invalid settings stop the run.

Manual runs bypass those windows:

```bash
scripts/sync.sh twelve
scripts/sync.sh twelve --from YYYY-MM-DD --to YYYY-MM-DD
scripts/sync.sh twelve --snapshot /private/snapshot-directory
scripts/sync.sh twelve --dry-run
```

Supply both historical dates or neither; do not combine dates with `--snapshot`. Scheduled mode rejects date/snapshot/dry-run overrides. Ranges use Amsterdam business days from 06:00 to 06:00, with an exclusive `--to`. The default overlaps seven prior business days and the current unfinished day using one fixed minute cutoff. Before 06:00, that open day belongs to yesterday. The successful-run checkpoint `data/twelve-last-success.json` extends the start after outages and advances only after all imports succeed; dry runs, snapshot replays and explicit ranges do not advance it.

## Download, reconciliation and writes

1. `steps/download-twelve.js` splits ranges into at most 31-day chunks and downloads transactions, product sales and combined raw data. It verifies retained date/time filters, exact CSV schemas and the screen's raw row count.
2. Immutable snapshot directories use mode 0700 and files 0600. `manifest.json` records client, range/cutoff, hashes and row counts. Failures leave `status: incomplete`; comparison/replay does not accept incomplete manifests or bad checksums.
3. `lib/twelve-export.js` joins transaction/product/raw identities and reconciles amounts before writes. Tab settlement lines repeat earlier sales and do not count as new turnover. Cancellation signs are normalized once; shared payments count funded children, and discounts already included in Paid are not deducted twice. Deposit-inclusive amounts are allocated over product value. Rational cents are rounded at day boundaries; deterministic largest-remainder rounding preserves product allocations to the cent.
4. Daily Revenue and No Sale browser tables supply original VAT totals. Revenue totals and no-sale amounts/counts must agree with the exports. Unknown nonzero categories, incomplete joins or financial differences stop the run. Up to four browser readers prepare daily reports in parallel; Rondo imports remain sequential in date order. A later read failure may follow earlier successful writes, so retry from the retained snapshot/checkpoint rather than assuming all-or-nothing rollback.
5. Each daily report includes reconciled products, no-sale transactions and `product_revenue` with method `proportional_v1`. Partial no-sales identify the amount/category but do not invent consumed products. The pipeline POSTs `{ report_json: "…" }` to `/rondo/v1/twelve/import` and verifies integer `id`, exact JSON hash and `created`, `updated` or `unchanged` status.

Days absent from source exports are skipped, not fabricated as zero. The current day is provisional until a complete 06:00 boundary is covered. Existing PDF archives and invoice claims are protected by the [Club import contract](/integrations/twelve/). Snapshots are retained for audit; monitor disk usage under `data/twelve`.

## Hourly basket export

Reports also include optional `activity` version 1 for [Drukte & bezetting](/features/kantine-activity/). The export carries original basket IDs, local minute timestamps, `sale`/`correction` kind and allocated product cash/Businessclub cents. Shared payment children merge into one basket. Zero-value sales are retained; top-ups, other no-sales and tab settlements do not become purchases. Food/drink classification remains in Club.

After daily product rounding, a second deterministic largest-remainder allocation distributes each product's exact cent target across its baskets, with stable transaction-ID tie breaks. Reordering export rows does not change the result. Product totals must reconcile before the activity can be imported. The contract contains no customer or operator data. Existing immutable snapshots can be replayed through the pipeline to add activity, subject to the normal import freshness and billing protections.

## Monitoring and read-only comparison

`RunTracker('twelve')` reports created, updated, skipped and failed counts. The pipeline is registered in the dashboard, alert renderer, `sync.sh` and self-heal mappings. Monitoring derives previous/next due times from the cached club windows and allows scheduled runs time to start before declaring them stale. Outside-window checks return a successful skip before starting a tracked import.

Since Rondo Sync 0.16.1, authenticated dashboard users can open
`/pipeline/twelve` for run history and manually launch Twelve through
`POST /api/pipeline/twelve/start`. The launch runs `scripts/sync.sh twelve`
without `--scheduled`, bypassing the configured weekday windows. An already
running pipeline returns 409. The overview and these routes share the same
pipeline registry; verify completion in the tracked run after launch. See
[dashboard pipeline routes](/sync/web-api/#dashboard-pipeline-routes).

`steps/download-twelve.js` can also create read-only snapshots; `tools/compare-twelve.js` checks selected totals against supplied PDF-derived reference data. Its `fullPdfParity: false` explicitly means that matching those totals alone does not prove VAT/cashflow parity or billing eligibility. It does not import or schedule anything.

Tests in `twelve-export.test.js`, `twelve-report.test.js`, `twelve-schedule.test.js` and `twelve-read-queue.test.js` cover synthetic reconciliation, DST/06:00/year boundaries, filters, private snapshots, sanitized login failures, VAT contracts, allocation rounding, schedule validation and ordered writes.
