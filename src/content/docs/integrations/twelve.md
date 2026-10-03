---
title: Twelve Revenue Reports
---

Rondo Club imports Twelve's daily PDF revenue reports from an AgentMail inbox and displays them at `/financien/kassaomzet`. The integration runs inside WordPress; it does not use a Rondo Sync pipeline or the Twelve transaction API.

## Configuration and daily import

`wp rondo twelve auth` reads `AGENTMAIL_API_KEY` and `AGENTMAIL_EMAIL_ADDRESS` from the environment; `--inbox-id` can override the inbox. The credentials are encrypted in the `rondo_twelve_agentmail_credentials` option through `CredentialEncryption`. `wp rondo twelve auth --status` reports availability without printing secrets; `--clear` clears them.

`ImportScheduler` schedules the `rondo_twelve_daily_import` hook at **07:00 Europe/Amsterdam** when credentials exist. It uses single events and recalculates the next local run, preserving the time across daylight-saving changes. WordPress cron must actually execute the due event. An already scheduled event is left in place, so a deployment does not immediately move an existing 06:15 event; subsequent scheduling uses 07:00. Switching themes clears the hook.

The scheduled run scans all received-message pages, oldest first, and selects the exact sender `noreply@twelve.eu`. Earlier unimported messages remain eligible for catch-up. PDF attachments must start with `%PDF` and be at most 10 MiB; download requests never forward the AgentMail API key to the signed attachment host. Smalot extracts text and `ReportParser` parses the report before storage.

An atomic `rondo_twelve_import_lock` option prevents overlapping scheduled runs. Individual import failures do not stop the remaining messages. The `rondo_twelve_import_status` option records `ran_at`, `imported`, `skipped`, and error codes without sensitive diagnostics, and the lock is released in `finally`.

The same importer is available through WP-CLI:

```bash
wp rondo twelve import --dry-run
wp rondo twelve import --message-id=<message-id> --dry-run
wp rondo twelve import
```

Dry runs parse without storing reports. The command skips previously imported messages. These commands are operational examples; documentation maintenance does not execute imports.

## Storage and parsing

Each report is a native `rondo_twelve_report` post. Period boundaries, message identity, and parsed JSON use `_twelve_period_start`, `_twelve_period_end`, `_twelve_message_id`, and `_twelve_report_data`. Duplicate message IDs or period ends prevent duplicate reports. Reports without revenue or product rows are rejected.

The original PDF is stored in protected `_twelve_pdf_base64` post metadata, with its sanitized filename in `_twelve_pdf_filename`. It is not a public upload, and report API responses omit this internal metadata. If PDF storage fails, the newly created report is removed so the import can be retried.

The parser supports Dutch amounts, negative adjustments, and Smalot's extracted layout. It recognizes `Verbruik kantinedienst` and `Munten over/onderwaarde` as no-sale categories, and `Omzet munten` as a payment method. Card-brand detail rows with only an amount and transaction count are skipped so they do not interrupt the main payment-method table. Unknown category labels retain their data with section `unknown`; they do not become known no-sale categories automatically.

## Kassaomzet interface

Approved users need `kassaomzet` section access to read the page and API. Invoice creation additionally requires finance-management access. The route has its own Kassaomzet guard before the general finance-route group, so reading revenue does not require the broader finance capability.

The monthly overview separates actual revenue excluding no-sale, no-sale consumption, and gross totals including no-sale. Clicking a day opens payment methods and products directly below that row. Products load on demand from `/twelve/products` with `from` and `to` both set to that day's `periode`. The product table displays `product`, `aantal`, and `bruto`, including no-sale consumption and VAT. Loading, failure with retry, and empty imports have separate messages. Payment-method headings remain readable in dark mode; an empty breakdown means no payment methods were imported.

The Products and VAT tabs aggregate the selected month. VAT comes from sales excluding no-sale; product totals include no-sale. Omzetontwikkeling uses the summary endpoint for a chosen date range and daily or monthly grouping, with a chart and expandable source table. Only imported periods appear. Missing days are not zero revenue, and monthly sums may be incomplete.

## REST API

All routes below use `/wp-json/rondo/v1` and normal REST authentication.

| Method and route | Parameters | Response |
| --- | --- | --- |
| `GET /twelve/reports` | `limit` (default 30, range 1–365) | `reports` with period boundaries, club, revenue totals and product count |
| `GET /twelve/summary` | `from`, `to`, `group=day\|month` (default `day`) | `from`, `to`, `group`, `buckets` |
| `GET /twelve/categories` | `from`, `to` | `from`, `to`, `categories` |
| `GET /twelve/products` | `from`, `to` | `from`, `to`, `products` |
| `GET /twelve/vat` | `from`, `to` | `from`, `to`, `vat` |
| `GET /twelve/businessclub` | Required `month=YYYY-MM` | `month`, `days`, `total` |
| `GET /twelve/billing` | None | `total`, `available`, source `rows`, invoice history |
| `POST /twelve/billing` | `name`, `address`, valid `email` | Draft invoice `id` |

Date ranges use `YYYY-MM-DD` and select the report's start date inclusively. Defaults are today and 29 days earlier in UTC. Reversed bounds are swapped. Summary buckets expose `periode`, `omzet_excl_nosale`, `omzet_incl_nosale`, `producten`, and a `betaalmethoden` map. Product aggregates include `product`, `aantal`, `bruto`, `btw`, `netto`, and `btw_groep`, sorted by quantity descending and then product name.

## Businessclub billing

The billing overview includes available source reports from all months. Creating a draft freezes only currently available reports under an atomic option lock. Each source day contributes a net line and a separate combined VAT line. Reports claimed by a draft stay in the outstanding total but leave the available amount. A transition to `rondo_sent` marks the original reports as billed; changing that invoice later does not make them available again.

The REST creation endpoint uses all available months. `wp rondo twelve businessclub-invoice --month=YYYY-MM` limits draft creation to one month. Neither action sends the invoice automatically. Missing recipient details return HTTP 400; overlap or no available revenue returns HTTP 409.

## Source and verification

Implementation: `class-twelve-agentmail-client.php`, `class-twelve-import-scheduler.php`, `class-twelve-report-parser.php`, `class-twelve-report-repository.php`, `class-twelve-report-aggregator.php`, `class-twelve-businessclub-invoicing.php`, `class-rest-twelve-reports.php`, and `src/pages/Finance/Kassaomzet.jsx` in Rondo Club. PHP tests cover scheduling, real extracted report layouts, payment-method preservation, storage, aggregation, API permissions, and billing.
