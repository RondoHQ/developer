---
title: "Twelve revenue reports"
---

## Overview

Every morning Twelve (`noreply@twelve.eu`) emails a PDF with the previous day's
till revenue. Rondo imports that PDF into `rondo_twelve_report` posts so the
figures are queryable: day/month summaries, per-category and per-product
turnover, VAT overviews, and the monthly businessclub draft invoice.

The whole pipeline runs on the club's own EU VPS; no US cloud services are
involved. The source mailbox stays at Gmail.

## Data model

One `rondo_twelve_report` post per imported day. The parsed figures are stored
as JSON in `_twelve_report_data`, with scalar meta for querying:

| Meta key | Purpose |
| --- | --- |
| `_twelve_period_start` / `_twelve_period_end` | Report period (used for range queries) |
| `_twelve_gmail_message_id` | Gmail message id (idempotency) |
| `_twelve_total_gross` | Total incl. no-sale |
| `_twelve_total_net` | Total excl. no-sale |
| `_twelve_pdf` | Attachment id of the original PDF |

The JSON holds the header (club, period), the turnover table (VAT type,
category, payment method and subtotal rows), no-sale lines, account mutations,
payment methods, terminals, products with VAT groups, receipts, and cashflow.

## Import

### One-time setup

1. Create a Google OAuth client (Desktop app) in Google Cloud Console and
   enable the Gmail API.
2. Add the scope `https://www.googleapis.com/auth/gmail.readonly` on the
   OAuth consent screen.
3. Obtain a refresh token for the mailbox receiving the Twelve mails by
   completing the OAuth flow once as that account.
4. Store the credentials on the server (encrypted in the
   `rondo_twelve_gmail_credentials` option; never in the repo):

```bash
wp rondo twelve auth \
  --client-id=JE_CLIENT_ID \
  --client-secret=JE_CLIENT_SECRET \
  --refresh-token=JE_REFRESH_TOKEN
```

Verify with `wp rondo twelve auth --status`, remove with
`wp rondo twelve auth --clear`.

### Daily import

```bash
wp rondo twelve import            # import the newest Twelve mail
wp rondo twelve import --dry-run  # parse without storing
wp rondo twelve import --message-id=ID  # import one specific message
```

Schedule it daily (systemd timer or cron) shortly after the mail arrives,
e.g. 07:05. The import is idempotent: an already-imported Gmail message or
period is skipped. The original PDF is kept as an attachment so reports can
be re-parsed if Twelve changes the layout.

## Businessclub invoicing

```bash
wp rondo twelve businessclub-invoice --month=2026-09
```

Creates a **draft** `rondo_invoice` (type `manual`) for one month of
businessclub turnover: one net line per day plus a 9% VAT line. Set the
recipient in Rondo and send through the normal invoice flow. A second run
for the same month is refused.

## REST API

All endpoints require `financieel_read`. See the
[REST API reference](/api/rest-api/#twelve-revenue-reports) for the endpoint
table.
