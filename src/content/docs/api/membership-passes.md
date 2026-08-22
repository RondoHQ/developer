---
title: "Membership Passes API"
---

Membership pass endpoints provide signed QR token issuance, scanner-side verification, and landing URL retrieval per person.

## Authentication

These endpoints require an authenticated and approved WordPress user (`X-WP-Nonce`).

## Issue QR Token

**GET** `/rondo/v1/membership-passes/people/{person_id}/qr-token`

Issues a signed JWT token for one person. The token is used as QR payload in wallet passes and scanner flows.

### Permission

User must be allowed to access the target person.

### Query Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `season` | string | No | Season key (`YYYY-YYYY`). Defaults to current season. |
| `ttl_days` | int | No | Token lifetime in days. Defaults to `365` (clamped 1-730). |

## Get Landing URL

**GET** `/rondo/v1/membership-passes/people/{person_id}/landing-url`

Ensures token + URL post meta exist for an eligible member or Sponsor and returns the landing URL.

### Permission

User must be allowed to access the target person.

### Response

```json
{
  "person_id": 123,
  "membership_pass_url": "https://example.com/lidpas/abcd..."
}
```

If a person is not an eligible member or Sponsor, `membership_pass_url` is `null`.

## Household pass summary

**GET** `/rondo/v1/people/household`

The personal household response includes a client-safe pass summary for every
visible person. It does not expose sponsor-company relationships or other
management fields.

```json
{
  "id": 123,
  "fields": {},
  "membership_pass": {
    "url": "https://example.com/lidpas/abcd...",
    "type": "businessclub",
    "label": "Businessclubpas"
  }
}
```

`membership_pass` is `null` when the person is not eligible. `type` is one of
`bondslid`, `verenigingslid`, `businessclub`, or `awc_sponsor`. The endpoint
remains limited to the linked person and their children under 18, including for
users who also have management privileges.

## Verify Scanned QR Token

**POST** `/rondo/v1/membership-passes/verify`

Validates a scanned token and resolves member status for scanner UIs.

### Permission

Logged-in approved users.

### Request Body

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Response (example)

```json
{
  "valid": true,
  "token": {
    "issued_at": "2026-02-22T14:30:00+00:00",
    "expires_at": "2027-02-22T14:30:00+00:00",
    "season": "2025-2026"
  },
  "person": {
    "id": 123,
    "name": "Voornaam Achternaam",
    "person_type": "member",
    "is_sponsor": true,
    "company_name": "Sponsor BV",
    "thumbnail": "https://..."
  },
  "membership": {
    "status": "active",
    "lid_tot": null
  }
}
```

Scanner UIs use `is_sponsor` to show `company_name` as **Bedrijf** for Sponsor passes. Other pass types continue to show the KNVB ID.

## Public Landing Page

For each eligible member or Sponsor, Rondo stores:

- `_membership_pass_token` (person post meta)
- `_membership_pass_url` (person post meta)

Public landing page route:

- `GET /lidpas/{token}`

Wallet actions from the landing page:

- Apple: `GET /lidpas/{token}?wallet=apple`
- Google: `GET /lidpas/{token}?wallet=google`

## Status values

`membership.status` can be:

- `active`
- `expired`
- `former`

## Notes

- QR tokens are signed with HS256.
- Signing key is generated automatically on first use and stored in option `rondo_membership_pass_jwt_secret`.
- Apple pass generation requires `pkpass/pkpass` to be installed and certificate config set.
- Google pass generation uses `google/apiclient` with service-account credentials.
