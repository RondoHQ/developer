---
title: Financial season history
---

The **Financieel** card on `/people/{id}` includes a season selector and the stored invoices and credit notes for that season. It remains available for former members, excluded members and people whose current contribution cannot be calculated. Selecting a season stores `financeSeason=YYYY-YYYY` in the URL; invoice-to-person links retain the invoice's season.

Historical views show recorded contribution amounts and payments, with a stored fee snapshot as a fallback when no contribution source exists. They do not infer payment from a fee snapshot. Unknown payment amounts display **Onbekend**. Invoice rows show the number, description, amount, status and reminder count, with links to invoice details and the original invoice for linked credits.

## Read API

`GET /rondo/v1/fees/person/{id}/history?season=2025-2026` requires `financieel_read` or finance-management access and normal person visibility. Omitting `season` selects the current season. Seasons must contain consecutive years in `YYYY-YYYY` format; invalid seasons return HTTP 400, and missing or inaccessible people return HTTP 404.

`Rondo\Finance\PersonFinanceHistory` reads stored data without recalculating fees or writing snapshots. The response contains:

| Field | Meaning |
| --- | --- |
| `person_id`, `person_name` | Accessible person identity |
| `season`, `current_season`, `seasons` | Selected season, current season and available seasons, newest first |
| `invoices` | Invoice and credit summaries assigned to the selected season |
| `unassigned_invoices` | Invoices and linked credits without a known season |
| `nikki` | Stored `total` and nullable `balance`, or `null` |
| `source` | `rondo`, `nikki`, or `null` |
| `contribution_total`, `contribution_paid` | Recorded contribution principal and paid principal, or `null` when unknown |
| `snapshot` | Existing fee snapshot for the selected season, or `null` |

Available seasons come from the current season, Nikki year keys, stored fee snapshots and assigned invoices. Summaries include `id`, `invoice_number`, `invoice_type`, `invoice_kind`, nullable `season`, `status`, `total_amount`, the first line's `description`, `source_invoice_id`, `credit_reason`, and `reminder_count`. Draft, sent, paid, overdue and cancelled invoices are listed.

## Contribution source and season assignment

Issued normal membership invoices take precedence over Nikki. Drafts, cancelled invoices and credit notes do not enter contribution totals, although they remain visible in the list. Fully paid invoices count their recorded principal; otherwise only installments marked `betaald` count, using their base amounts without administration fees and capped at the invoice total. Credit notes are shown separately and do not reduce these totals.

When no qualifying membership invoice exists, `_nikki_{start_year}_total` supplies the contribution total. A numeric `_nikki_{start_year}_saldo` supplies the paid amount as total minus balance, bounded between zero and total. A missing balance remains unknown. Historical reads do not create an original Rondo invoice for Nikki data.

Valid `_invoice_season` metadata takes precedence. A membership invoice without it remains unassigned; its creation date is not evidence of its billing season. A linked credit preserves its source's unknown season. Other invoices without a stored season use the July–June season containing their creation date. Unassigned invoices appear under **Facturen zonder vastgelegd seizoen**.

## Related implementation

`FinancesCard.jsx` renders the season history. `PersonFinanceHistoryTest` covers source precedence, former/excluded members, missing Nikki balances, unknown seasons, read permissions and absence of writes during history reads. Finance managers can open the [injury credit workflow](/features/credit-notes/) from this card; server validation determines eligibility.
