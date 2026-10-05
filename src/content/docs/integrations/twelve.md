---
title: Twelve Revenue Reports
---

Rondo Club displays Twelve revenue at `/financien/kassaomzet`. The [Rondo Sync browser pipeline](/sync/pipeline-twelve/) now supplies validated daily reports through normal Twelve login and exports. The former AgentMail/PDF importer, its parser and its CLI auth/import commands are retired; `BrowserImport::retire_pdf_import()` clears already queued `rondo_twelve_daily_import` events. Existing PDF archives remain private and available for audit.

## Validated import and storage

`POST /rondo/v1/twelve/import` requires an approved administrator and a JSON-string `report_json`, at most 5,000,000 bytes. Business days run 06:00–06:00 in Europe/Amsterdam. The payload includes `club`, `period_start`, `period_end`, revenue/VAT rows, products and their totals, no-sale transactions and source evidence: `type: twelve_browser`, numeric-string `client_id`, UTC `observed_at`, local `coverage_end`, boolean `complete`, three export SHA-256 hashes and `finance_sha256`. Future observation times beyond five minutes, invalid coverage, financial inconsistencies and malformed product/no-sale rows return HTTP 400.

`product_revenue`, when present, must use `method: proportional_v1` and known unique product names with integer `cashCents` and `businessclubCents`; allocations must reconcile to the independent daily totals. Partial no-sale rows retain an amount/category and an empty product list rather than guessed consumption. Full baskets retain original gross prices and can expose separate `accountedCents` for deposit-adjusted consumption.

Each day stays a native `rondo_twelve_report` post, selected by `_twelve_period_start`. Updating a legacy day preserves its post ID, original `_twelve_pdf_base64`/filename and invoice claims; `_twelve_original_report_data` saves the previous data before replacement. JSON uses `wp_slash()` before metadata storage, preserving Unicode, quotes and backslashes. New posts remain draft until all financial metadata is read back successfully, and an interrupted import can resume that draft.

The response is `{ id, status, hash }`, with `created`, `updated` or `unchanged` and the SHA-256 of the exact report JSON. Exact retries do not duplicate reports. A site client ID is established on first accepted import; another client, duplicate/trashed days, older observation/coverage or a conflicting invoice reservation returns HTTP 409. Imports and Businessclub invoice creation share `rondo_twelve_invoice_lock`. Claimed/billed days cannot change their Businessclub financial values or become provisional. `_twelve_source_hash` records successful storage; `rondo_twelve_browser_last_success` tracks the latest accepted source observation, not completion of the entire Sync run.

Open days are provisional until coverage reaches the following 06:00 boundary. `rondo_twelve_billing_start` preserves the original billing boundary; newly imported earlier history is flagged `_twelve_historical` and does not become automatically billable. Neither provisional nor historical days are available for new Businessclub invoices.

## Kassaomzet, product groups and trends

Approved users need `kassaomzet` section access to read the page/API; billing also needs finance-management access. Revenue reading does not require broader finance access. The monthly overview separates **Kassaomzet**, **Businessclub**, their **Totale omzet**, **Overig verbruik** and **Totaal producten**. Product values include VAT and no-sale consumption; they are not interchangeable with revenue. Clicking a day loads payment methods, products and no-sale transaction details. Missing days remain absent, not zero; the current day is labelled **Voorlopig** and the last accepted import time is displayed.

Administrators use **Productindeling** to classify product-name hashes in `rondo_twelve_product_groups`: `entree` (Entree), `food` (Eten), `non_food` (Drank), `merchandise`, `other` (Overig) and `unassigned` (Nog indelen). Saving updates derived historical views without modifying source reports. Merchandise and Overig are excluded from revenue summaries using the reconciled proportional product allocations, including discounted/shared baskets. Product-value totals, no-sale details and Businessclub billing remain unchanged. A report containing an excluded product without `product_revenue` blocks summary with HTTP 503 `twelve_product_revenue_missing` rather than subtracting its gross basket price. Product-mix shares still include all product groups and are null when the overall value is zero or negative.

**Omzetontwikkeling** starts with the current month through today, and supports day/month grouping, revenue lines, product-group areas/lines and individual products by gross value or quantity. Group line charts can show all revenue groups or a selected group. Product trends include VAT/no-sale; group views omit Merchandise/Overig, while individual product selection includes the full catalog. Negative product values remain visible below zero. A product absent from an imported day is zero for that day; a missing report breaks the graph.

Comparison supports the same period last year or arbitrary dates. Series align by calendar offsets, not report-row indexes, so gaps do not shift later dates. Leap-day comparisons clamp to the last valid day. Unequal durations are flagged and totals are not normalized; missing periods have no total, and a zero comparison total has no percentage. Charts support click/touch and keyboard point selection with visible source-date/value labels, and identify provisional data.

Administrators edit weekday opening windows under **Synchronisatie**. The schedule has fixed `timezone: Europe/Amsterdam`, `interval_hours: 2` and `days: [{ day, start, end }]`; day 0 is Sunday, start is 0–23 and end is later through 24. At most one window per weekday is allowed, and `[]` disables scheduled source logins. Validation occurs before replacing `rondo_twelve_schedule`. See the [pipeline](/sync/pipeline-twelve/#configuration-and-schedule) for default windows and hourly checks.

## REST API

Routes below are relative to `/wp-json/rondo/v1`; ordinary reads require approved authentication and `kassaomzet`.

| Method and route | Parameters / response |
| --- | --- |
| `GET /twelve/reports` | `limit` (30 by default, 1–365); latest period boundaries, club, revenue breakdown and product count |
| `GET /twelve/summary` | `from`, `to`, `group=day\|month`, optional `include_product_trend`; `buckets`, `last_sync`, `product_mix` |
| `GET /twelve/categories` | `from`, `to`; category totals |
| `GET /twelve/products` | `from`, `to`; product gross/net/VAT values and quantities |
| `GET /twelve/vat` | `from`, `to`; source sales VAT totals |
| `GET /twelve/no-sales` | `from`, `to`; `{ transactions }` including category, amount, time and available product details |
| `GET /twelve/product-groups` | Full historical catalog with SHA-256 `id`, current `group`, quantities/values, plus allowed `groups` |
| `POST /twelve/product-groups` | Admin plus kassa access; existing product `id` and allowed `group`; `unassigned` removes the override |
| `GET /twelve/schedule` | Current fixed timezone/interval and weekday windows |
| `POST /twelve/schedule` | Admin; complete `days` replacement |
| `POST /twelve/import` | Admin; validated `report_json`; `{ id, status, hash }` |
| `GET /twelve/businessclub` | Required `month=YYYY-MM`; `days` and `total` |
| `GET /twelve/billing` | All-month outstanding/available totals, source rows and invoice history |
| `POST /twelve/billing` | Finance manager plus kassa access; `name`, `address`, valid `email`; draft invoice `id` |

Date ranges use inclusive report-start dates `YYYY-MM-DD`; defaults are today and 29 days earlier in UTC. Reversed bounds are swapped. Summary buckets retain `periode`, `omzet_excl_nosale`, `omzet_incl_nosale`, `producten` and `betaalmethoden`, and add `kassaomzet`, `businessclub`, `omzet_totaal`, `overig_verbruik`, `uitgesloten_omzet` and `provisional`. `omzet_excl_nosale` follows the filtered kassa amount in summary buckets. Optional `product_trend` contains group amounts/shares and product IDs, names, groups, quantities and gross values per imported bucket.

## Businessclub billing

Creating a draft freezes currently available closed, nonhistorical reports under the shared import/invoice lock. Each source day contributes a net line and a combined VAT line. Reports claimed by a draft remain outstanding but leave the available amount; sending marks them billed. Product classification does not change these billable source amounts.

Sending rechecks report claims and the invoice total/line sum against the frozen amount; changed allocations or amounts block sending. A separate per-invoice lock rejects overlapping send requests. A restored old draft cannot reclaim days allocated elsewhere. The REST creation endpoint uses all available months; `wp rondo twelve businessclub-invoice --month=YYYY-MM` limits creation to one month. Neither sends automatically. Missing recipient data returns HTTP 400; overlap or no available revenue returns HTTP 409.

## Source and verification

Club implementation: `class-twelve-browser-import.php`, repository, aggregator, product classification, Businessclub invoicing, REST controller, `Kassaomzet.jsx`, `TwelveSchedule.jsx`, `ProductTrend.jsx` and comparison utilities. Sync implementation and operational limits are documented in [Twelve browser-import pipeline](/sync/pipeline-twelve/). Tests cover import validation/recovery, retained PDF IDs, billing conflicts, provisional/history boundaries, product classification, exclusion allocations, API permissions and chart gaps/comparisons. Retired parser tests are no longer the verification source.
