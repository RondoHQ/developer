---
title: "Invoicing System"
---


## Overview

The invoicing system manages the full lifecycle of club invoices — from creation through PDF generation, email delivery, and payment tracking. It supports two invoice types: **discipline invoices** (for yellow/red card fines) and **membership invoices** (for seasonal contributions).

All invoice functionality requires the `financieel` capability.

## Post Type

Invoices use the `rondo_invoice` custom post type with four custom post statuses:

| Status | Slug | Description |
|--------|------|-------------|
| Draft | `rondo_draft` | Newly created, not yet sent |
| Sent | `rondo_sent` | Sent to member via email |
| Paid | `rondo_paid` | Payment confirmed (via Mollie webhook or manual) |
| Overdue | `rondo_overdue` | Past due date, not yet paid |

### ACF Fields

Each invoice stores the following fields:

- **`invoice_number`** — Unique formatted number (e.g. `F2025-042` or `C2025-001`)
- **`person`** — Relationship to the `person` post type
- **`status`** — ACF status mirror (`draft`, `sent`, `paid`, `overdue`)
- **`invoice_type`** — Either `discipline` or `membership`
- **`total_amount`** — Decimal total
- **`line_items`** — Repeater field with sub-fields:
  - `discipline_case` — Optional relationship to a discipline case
  - `description` — Text description (used for membership line items)
  - `amount` — Decimal amount (negative for discounts)
- **`payment_link`** — Mollie checkout URL or public payment page URL
- **`pdf_path`** — Relative path to generated PDF in uploads
- **`qr_code_path`** — Relative path to QR code PNG in uploads
- **`sent_date`** — Date invoice was sent (Ymd format)
- **`due_date`** — Payment due date (Ymd format)

### Post Meta

Additional metadata stored as raw post meta:

- `_mollie_payment_link_id` — Mollie payment link ID (`pl_xxx`)
- `_mollie_payment_id` — Legacy Mollie payment ID (`tr_xxx`)
- `_invoice_season` — Season key (e.g. `2025-2026`) for membership invoices
- `_payment_token` — 64-char hex token for the public payment page
- `_installment_plan` — Payment plan choice (`full`, `quarterly_3`, `monthly_8`)
- `_installment_count` — Number of installments
- `_installment_N_*` — Per-installment meta (see [Installments](/features/installments/))

## Invoice Numbering

**Class:** `Rondo\Finance\InvoiceNumbering`

Invoice numbers follow the format `{PREFIX}{YEAR}-{SEQ}` where:

- **Discipline invoices:** Prefix `F` (e.g. `F2025-001`)
- **Membership invoices:** Prefix `C` for "contributie" (e.g. `C2025-001`)

Each prefix maintains an independent sequence counter per calendar year, stored in a WordPress option. The `generate_next()` static method accepts the invoice type and returns the next sequential number.

Numbering is gap-free within each prefix — the counter is incremented atomically.

## Invoice Types

### Discipline Invoices

Created manually via the REST API when a member receives fines from discipline cases (yellow/red cards). Features:

- Line items link to specific `discipline_case` posts
- Each line item shows match date, match description, card type, and amount
- PDF generation includes a detailed table of discipline cases
- Payment via Mollie payment link (persistent, no expiry)
- QR code generated for the payment link

### Membership Invoices

Created in bulk for an entire season via the bulk invoice creator. Features:

- Line items include the base contribution amount, optional family discount (negative amount), and optional pro-rata discount
- Linked to a season via `_invoice_season` meta
- Payment via the public payment page (`/betaling/{token}`) with plan selection
- No PDF attachment — email contains payment link directly
- Supports installment payment plans (see [Installments](/features/installments/))

## PDF Generation

**Class:** `Rondo\Finance\InvoicePdfGenerator`

Generates PDF documents using the **mPDF** library. The PDF includes:

- Club branding (logo, name, accent color from `FinanceConfig`)
- Member details (name, address from `person` post)
- Invoice metadata (number, date, due date)
- Line items table (discipline cases with match details, or membership fee breakdown)
- Payment instructions with payment link
- QR code image (if available)

PDFs are saved to `wp-content/uploads/invoices/{invoice_number}.pdf`. The relative path is stored in the `pdf_path` ACF field.

The `due_date` is calculated automatically if not set: invoice sent date + configurable payment term days from `FinanceConfig`.

## Email Sending

**Class:** `Rondo\Finance\InvoiceEmailSender`

Sends HTML emails via `wp_mail()` with:

- **PDF attachment** — The generated invoice PDF
- **Inline QR code** — Embedded as an `<img>` tag pointing to the uploads URL (not CID — most email clients block CID images)
- **Configurable template** — HTML template from `FinanceConfig` with placeholder variables

### Template Variables

| Variable | Description |
|----------|-------------|
| `{naam}` | Full person name |
| `{voornaam}` | First name |
| `{factuur_nummer}` | Invoice number |
| `{tuchtzaken_lijst}` | HTML table of discipline cases |
| `{totaal_bedrag}` | Formatted total (e.g. `€ 42,50`) |
| `{betaallink}` | Payment link as HTML anchor |
| `{qr_code}` | QR code `<img>` tag |
| `{organisatie_naam}` | Organization name from config |

### Email Headers

- **From:** Organization name + contact email from `FinanceConfig`
- **BCC:** Optional BCC email from config (omitted in test mode)
- **Content-Type:** `text/html; charset=UTF-8`

### Test Mode

When `override_email` is passed in options, the email is sent to that address instead of the member's email. Both `override_email` and `skip_bcc` trigger a `[TEST]` prefix on the subject line.

## Bulk Invoice Creation

**Class:** `Rondo\Finance\BulkInvoiceCreator`

Creates membership invoices for all members in a season via async WP-Cron batch processing.

### Flow

1. **Start job** — `start_job($season)` queries all published `person` posts, saves job state to a WordPress option, and schedules the first cron batch
2. **Batch processing** — Each batch processes 50 persons via `run_batch()`, then schedules the next batch 2 seconds later
3. **Per-person logic** — `create_membership_invoice()` for each person:
   - Gets fee via `MembershipFees::get_fee_for_person_cached()`
   - Skips if: no fee data, zero fee, former member not eligible, or invoice already exists (idempotent)
   - Creates `rondo_invoice` post with `rondo_draft` status
   - Generates invoice number with `C` prefix
   - Builds line items: base fee, optional family discount, optional pro-rata ("instapkorting") discount
   - Generates payment token via `PublicPaymentPage::generate_token()`
4. **Completion** — Job status transitions to `done` when all persons are processed

### Job State

Stored in the `rondo_bulk_invoice_job` WordPress option:

```json
{
  "season": "2025-2026",
  "status": "running",
  "total": 450,
  "offset": 100,
  "created": 85,
  "skipped": 15,
  "errors": 0,
  "started_at": "2025-09-01 12:00:00",
  "finished_at": null
}
```

Only one bulk job can run at a time. Starting a new job while one is running returns a `409` error.

### Idempotency

Before creating an invoice, the system checks for an existing `rondo_invoice` with the same `person` + `_invoice_season` + `invoice_type=membership`. If found, the person is skipped.

## REST API

All endpoints are under `rondo/v1/invoices` and require the `financieel` capability.

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/invoices` | List invoices (filterable by status, type, person) |
| POST | `/invoices` | Create a new discipline invoice |
| GET | `/invoices/{id}` | Get invoice details |
| DELETE | `/invoices/{id}` | Delete a draft invoice |
| POST | `/invoices/{id}/send` | Send invoice (generates PDF, creates payment link, sends email, transitions to `rondo_sent`) |
| POST | `/invoices/{id}/mark-paid` | Manually mark as paid |
| POST | `/invoices/{id}/preview-email` | Send test email to override address |
| POST | `/invoices/bulk` | Start bulk membership invoice creation |
| GET | `/invoices/bulk/status` | Get bulk job progress |

### Send Flow

The `send` endpoint orchestrates the full sending pipeline:

1. Validate invoice is in `rondo_draft` status
2. Generate PDF via `InvoicePdfGenerator`
3. Create payment link via `MolliePayment` (or `RabobankPayment` depending on provider config)
4. Generate QR code via `QrCodeGenerator`
5. Send email via `InvoiceEmailSender`
6. Transition post status to `rondo_sent`
7. Set `sent_date` and calculate `due_date`

## Related Documentation

- [Payments](/features/payments/) — Mollie and Rabobank payment integration
- [Installments](/features/installments/) — Installment payment plans for membership invoices
- [Membership Fees](/features/membership-fees/) — Fee calculation and season configuration
