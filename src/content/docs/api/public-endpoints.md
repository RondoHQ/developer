---
title: "Public REST API Endpoints"
---


This document lists REST API endpoints that do not require WordPress authentication (`permission_callback => __return_true`). Each has a documented security rationale.

## Current public endpoints

### Version check

**GET** `/rondo/v1/version`

Returns the current theme version. Used by the frontend for cache invalidation and update detection.

**Security rationale:** No sensitive data exposed. Returns only a version string.

### Mollie webhook

**POST** `/rondo/v1/mollie/webhook`

Receives payment status callbacks from Mollie. Called by Mollie's servers when a payment status changes (paid, failed, expired, etc.).

**Security rationale:** Authentication is not possible (Mollie initiates the request). The endpoint verifies the payment by fetching the payment status directly from the Mollie API using the stored API key, so a spoofed webhook cannot change payment state without a matching Mollie payment.

### Invite validation

**GET** `/rondo/v1/invites/{token}`

Validates a workspace invite token. Returns workspace name, inviter, and role. Used on the invite acceptance page before the user logs in.

**Security rationale:** Tokens are cryptographically random. The endpoint only reveals the workspace name and inviter display name, no sensitive data.

### Public payment page

Not a REST endpoint but a public rewrite rule: `/betaling/{token}`

Renders a standalone payment page where members can view their invoice and select a payment plan (full, 3 or 8 installments). No WordPress login required.

**Security rationale:** Tokens are unique per invoice and cryptographically random. The page only shows the member's own invoice details. Payment is processed via Mollie, not directly through this page.

## Security review checklist

When adding new public endpoints:
1. Document why authentication cannot be used
2. Implement alternative verification (signatures, tokens, state validation)
3. Rate limit if possible
4. Log suspicious activity
5. Add to this document
