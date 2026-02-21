---
title: "Payment System"
---


## Overview

The payment system handles online payment collection for invoices. It supports two payment providers — **Mollie** (primary) and **Rabobank** (betaalverzoeken) — and includes a public-facing payment page where members can view their invoice and select a payment plan without logging in.

## Mollie Integration

### MollieClient

**Class:** `Rondo\Finance\MollieClient`

Thin wrapper around the official Mollie PHP SDK (`MollieApiClient`). Reads the API key from `FinanceConfig` and initializes a configured client. Not a singleton — each instantiation reads a fresh key.

```php
$client = new MollieClient();
$mollie = $client->get(); // Returns configured MollieApiClient
```

### MolliePayment

**Class:** `Rondo\Finance\MolliePayment`

Creates **payment links** (not regular payments) via `POST /v2/payment-links`. Payment links are persistent and don't expire, unlike regular Mollie payments which expire in ~15 minutes. This is important because links are emailed to members.

**Flow:**

1. Validate invoice exists
2. **Idempotency check** — If `_mollie_payment_link_id` and `payment_link` are already stored, return existing URL
3. Build payload with amount, description (`Factuur {number}`), and redirect URL
4. Conditionally add `webhookUrl` — omitted on `localhost` and `.local` environments
5. Call Mollie Payment Links API
6. Store checkout URL in `payment_link` ACF field and payment link ID in `_mollie_payment_link_id` meta

### MollieWebhook

**Class:** `Rondo\Finance\MollieWebhook`

Receives webhook POST events at `POST /wp-json/rondo/v1/mollie/webhook` (public endpoint, no auth required).

**Always returns HTTP 200** to prevent Mollie retry storms, regardless of processing outcome.

#### Lookup Paths

The webhook handler supports four lookup paths based on the incoming ID:

| Path | ID Prefix | Lookup Method | Use Case |
|------|-----------|---------------|----------|
| 0a | `pl_xxx` | `_mollie_pid_{pl_xxx}` meta | Installment payment links |
| 0b | `pl_xxx` | `_mollie_payment_link_id` meta | Discipline / full payment links |
| 1 | `tr_xxx` | `_mollie_pid_{tr_xxx}` meta | Legacy installment payments |
| 2 | `tr_xxx` | `_mollie_payment_id` meta | Legacy full payments |

**Security:** For `tr_xxx` IDs, the webhook re-fetches the payment from the Mollie API to verify `isPaid()` status — never trusts the POST body alone. For `pl_xxx` IDs, the payment link is re-fetched and verified similarly.

#### Payment Confirmation Flow

For full payments (Path 0b / Path 2):
1. Find invoice by payment link ID or payment ID
2. Idempotency check — skip if already `rondo_paid`
3. Transition post status to `rondo_paid`
4. Update ACF `status` field to `paid`

For installment payments (Path 0a / Path 1):
1. Find invoice by reverse-lookup meta
2. Mark specific installment as `betaald`
3. Check if all installments are now paid → transition to `rondo_paid` if so
4. If more installments remain → automatically create next installment's Mollie payment link

## Rabobank Integration

### RabobankOAuth

**Class:** `Rondo\Finance\RabobankOAuth`

Manages the OAuth 2.0 Premium authorization flow for the Rabobank Payment Request API.

**Features:**
- Environment-aware URLs (sandbox vs production)
- Authorization URL generation with CSRF state token (stored in transient, 10-minute TTL)
- Code-to-token exchange with Basic Auth client credentials
- Automatic token refresh (5-minute buffer before expiry)
- Encrypted token storage via `CredentialEncryption`

**REST Endpoints:**

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/rabobank/authorize` | `manage_options` | Get OAuth authorize URL |
| GET | `/rabobank/callback` | Public (state nonce) | Handle OAuth callback, redirect to settings |
| GET | `/rabobank/status` | `manage_options` | Check connection status + environment |
| POST | `/rabobank/disconnect` | `manage_options` | Clear stored tokens |

### RabobankPayment

**Class:** `Rondo\Finance\RabobankPayment`

Creates payment requests (betaalverzoeken) via the Rabobank API with full message signing.

**Features:**
- mTLS client certificate injection via `http_api_curl` filter
- Self-signed certificate generation for sandbox environment
- HTTP message signing per Rabobank spec (date, digest, x-request-id)
- QR code download from Rabobank API after payment request creation
- Sandbox test IBAN (`NL19RABO0123456790`) used automatically in sandbox mode

**Payment Request Flow:**

1. Get valid access token (auto-refreshes if needed)
2. Build payload: IBAN, amount in cents, description (35-char SWIFT limit)
3. Compute SHA-256 digest of request body
4. Sign headers with RSA-SHA256 using mTLS private key
5. POST to Rabobank Payment Request API with mTLS enabled
6. Store `paymentPageUrl` in `payment_link` ACF field
7. Download and store QR code PNG from Rabobank QR code endpoint

## Public Payment Page

**Class:** `Rondo\Finance\PublicPaymentPage`

A standalone, public-facing landing page at `/betaling/{token}` where members can view their invoice and choose a payment plan — no WordPress login required.

### Token System

Each membership invoice gets a unique 64-character hex token (32 bytes via `random_bytes`), stored in `_payment_token` post meta. The full URL is stored in the `payment_link` ACF field for inclusion in emails via `{betaallink}`.

Tokens are generated by `PublicPaymentPage::generate_token()`, called during bulk invoice creation.

### URL Routing

A WordPress rewrite rule matches `^betaling/([a-f0-9]{64})$` and maps to the `rondo_payment_token` query var. The `template_redirect` handler fires at priority 0 (before the React SPA catch-all at priority 1).

### GET — Plan Selection Page

Renders a standalone mobile-first HTML page (no WordPress theme, no external dependencies) showing:

- Club branding (logo, name, accent color from `FinanceConfig`)
- Invoice summary (member name, invoice number, season, total amount)
- Payment plan options:
  - **Volledig betalen** — Full payment, no extra costs
  - **3 termijnen** — Quarterly installments (if enabled for season and ≥3 payment dates remain)
  - **N termijnen** — Monthly installments, up to 8 (if enabled and >3 dates remain)

Installment amounts include a configurable admin fee per installment. Plan visibility adapts based on available payment dates (23rd of each month through April of the season's end year).

Per-invoice override: installment plans can be disabled for specific invoices via `_disable_installments` meta.

### POST — Plan Selection Handler

1. CSRF validation (submitted token must match URL token)
2. Validate plan is allowed and enabled for the season
3. Guard against already-paid invoices or duplicate submissions
4. Clear any previous installment data (supports plan changes on return visits)
5. Write installment meta (amounts, admin fees, due dates, statuses)
6. Create Mollie payment for installment 1 via `InstallmentPaymentService`
7. Redirect to Mollie checkout

### Success Page

After Mollie redirects back with `?betaald=1`, a success page renders with a confirmation message and invoice summary.

## QR Code Generation

**Class:** `Rondo\Finance\QrCodeGenerator`

Generates branded QR codes using the `chillerlan/php-qrcode` library with GD image output.

**Features:**
- Club accent color applied to all dark QR modules
- Club logo overlay in the center (sized to 20% of QR area, with white background padding)
- ECC Level H (30% error correction) to support logo overlay
- 10px per module scale (~330×330px output)
- Saved to `wp-content/uploads/invoices/qr-{invoice_number}.png`
- Path stored in `qr_code_path` ACF field

The generator is provider-agnostic — it encodes any URL. For Mollie invoices, it encodes the checkout URL. For Rabobank, QR codes are downloaded directly from the Rabobank API instead.

## Related Documentation

- [Invoicing](/features/invoicing/) — Invoice lifecycle and email sending
- [Installments](/features/installments/) — Installment payment plans
- [Membership Fees](/features/membership-fees/) — Fee calculation
