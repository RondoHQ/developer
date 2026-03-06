---
title: "Public REST API Endpoints"
---


This document lists public-facing endpoints and pages that do not require WordPress authentication. Each has a documented security rationale.

## Public Payment Landing Page

**URL:** `/betaling/{token}`

**Class:** `Rondo\Finance\PublicPaymentPage` (`includes/class-public-payment-page.php`)

**Method:** GET (render) and POST (plan selection + Mollie redirect)

This is not a REST API endpoint — it is a WordPress rewrite rule handled via `template_redirect` at priority 0 (before the SPA catch-all at priority 1). It renders a standalone PHP-generated HTML page.

### Security Model

Authentication is replaced by a 64-character cryptographically-random hex token:

- Token is generated with `random_bytes(32)` and stored on the invoice as `_payment_token` post meta
- The URL regex enforces exactly 64 lowercase hex characters
- POST requests include the token as a CSRF protection field (submitted token must match URL token)
- Invalid or expired tokens receive a 404 with a Dutch error page

### Token Generation

```php
PublicPaymentPage::generate_token( int $invoice_id ): string
```

Called during bulk invoice creation (Phase 196). Sets:
- `_payment_token` post meta for URL lookup
- `payment_link` ACF field so `InvoiceEmailSender` can include the URL in emails via `{betaallink}`

### GET Response

Standalone HTML page with inline CSS (no external dependencies, no WordPress template, no React SPA). Shows:
- Invoice details: member name, invoice number, season, total amount
- Payment plan forms: full payment, 3 installments (when 3+ payment dates remain), and a dynamic monthly option (`monthly_8`) that adapts to available dates.
- Late-season fallback: when only two payment dates remain (typically March/April), the dynamic monthly option is shown as 2 installments.
- Per-installment admin fee if configured

Visiting `/betaling/{token}?betaald=1` shows a Dutch success message (redirected from Mollie checkout).

### POST Handler

1. Validates CSRF token
2. Validates plan (`full`, `quarterly_3`, `monthly_8`)
3. Idempotency check: returns existing Mollie checkout URL if payment already created
4. Writes flat numbered installment meta (`_installment_N_amount`, `_installment_N_admin_fee`, `_installment_N_status`)
5. Creates Mollie payment via MollieClient
6. Stores payment ID, checkout URL, and reverse-lookup meta (`_mollie_pid_{payment_id}`)
7. Redirects to Mollie checkout

### Installment Meta Schema

Written to the `rondo_invoice` post on plan selection:

| Meta Key | Type | Description |
|----------|------|-------------|
| `_installment_plan` | string | `full`, `quarterly_3`, or `monthly_8` |
| `_installment_count` | int | Total installments |
| `_installment_N_amount` | float | Base amount (excl. admin fee) |
| `_installment_N_admin_fee` | float | Per-installment admin fee |
| `_installment_N_status` | string | `pending`, `sent`, `paid`, or `overdue` |
| `_installment_N_mollie_payment_id` | string | Mollie payment ID |
| `_installment_N_payment_link` | string | Mollie checkout URL |
| `_mollie_pid_{payment_id}` | int | Reverse-lookup: payment ID → installment number |

## Public REST API Endpoints

### Version check

**GET** `/rondo/v1/version`

Returns the current theme version. Used by the frontend for cache invalidation and update detection.

**Security rationale:** No sensitive data exposed. Returns only a version string.

### Mollie webhook

**POST** `/rondo/v1/mollie/webhook`

Handled by `Rondo\Finance\MollieWebhook`. Receives payment status callbacks from Mollie. Called by Mollie's servers when a payment status changes (paid, failed, expired, etc.).

**Security rationale:** Authentication is not possible (Mollie initiates the request). The endpoint verifies the payment by fetching the payment status directly from the Mollie API using the stored API key, so a spoofed webhook cannot change payment state without a matching Mollie payment.

### Lettermint webhook

**POST** `/rondo/v1/lettermint/webhook`

Handled by `Rondo\Notifications\LettermintWebhook`. No WordPress authentication required.

**Security model:**
- Signature verification via Lettermint SDK (`X-Lettermint-Signature` and `X-Lettermint-Delivery` headers)
- Configurable signing secret and tolerance via `LettermintConfig`
- Only actionable events are processed:
  - `message.hard_bounced`
  - `message.soft_bounced`
  - `message.spam_complaint`

**Processing behavior:**
- Updates `rondo_lettermint_suppressed_emails` option for recipient tracking
- Creates idempotent `rondo_todo` follow-up tasks for Secretaris users
- Falls back to administrators when no active Secretaris is found

### Invite validation

**GET** `/rondo/v1/invites/{token}`

Validates a workspace invite token. Returns workspace name, inviter, and role. Used on the invite acceptance page before the user logs in.

**Security rationale:** Tokens are cryptographically random. The endpoint only reveals the workspace name and inviter display name, no sensitive data.

### Public payment page

Not a REST endpoint but a public rewrite rule: `/betaling/{token}`

Renders a standalone payment page where members can view their invoice and select a payment plan (full, 3 or 8 installments). No WordPress login required.

**Security rationale:** Tokens are unique per invoice and cryptographically random. The page only shows the member's own invoice details. Payment is processed via Mollie, not directly through this page.

## Security review checklist

When adding new public endpoints or pages:
1. Document why authentication cannot be used
2. Implement alternative verification (signatures, tokens, state validation)
3. Rate limit if possible
4. Log suspicious activity
5. Add to this document
