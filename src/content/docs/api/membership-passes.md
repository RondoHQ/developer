---
title: "Membership Passes API"
---

Membership pass endpoints provide signed QR token issuance, scanner-side verification, and authenticated household wallet actions.

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
    "type": "businessclub",
    "label": "Lidpassen",
    "wallets": {
      "apple": {
        "available": true,
        "url": "https://example.com/wp-admin/admin-post.php?action=rondo_membership_pass_wallet&person_id=123&wallet=apple&_wallet_token=..."
      },
      "google": {
        "available": true,
        "url": "https://example.com/wp-admin/admin-post.php?action=rondo_membership_pass_wallet&person_id=123&wallet=google&_wallet_token=..."
      }
    },
    "role_options": [
      { "key": "sponsor_pass", "label": "Businessclubpas" },
      { "key": "a1b2c3d4e5f6g7h8", "label": "AWC-pas — AWC 1 — Trainer" }
    ],
    "requires_role": true
  },
  "sponsor_organization": {
    "id": 456,
    "name": "Voorbeeld BV",
    "logo_url": "https://example.com/uploads/sponsor-logo.png",
    "can_edit_logo": true
  }
}
```

`membership_pass` is `null` when the person is not eligible. `type` is one of
`bondslid`, `verenigingslid`, `businessclub`, or `awc_sponsor`. The endpoint
remains limited to the linked person and their children under 18, including for
users who also have management privileges.

`wallets.*.available` reflects the current server configuration. The action URLs
are signed for the current user and login session; they are not stable public links. When
`requires_role` is true, append one returned option key as the `role` query
parameter before navigating to the chosen wallet action. A person with an
active Sponsor pass, a regular member tier and current work roles receives the
Sponsor pass as the first option and one AWC member pass per current role.

`sponsor_organization` is present only when an active organization supplies the
person's sponsor pass **and** the caller may edit that logo. For a regular
account this means the record is its own linked person; a parent's response does
not expose a child's sponsor organization. Sponsor managers retain their broad
access.

## Replace own sponsor organization logo

**POST** `/rondo/v1/sponsors/{sponsor_id}/logo/upload`

Send a multipart upload with field `logo`. JPEG, PNG, GIF, WebP and SVG are
accepted up to 5 MB.

Sponsor managers may use the endpoint for every sponsor record. A regular
sponsor account may use it only for the active organization that supplies the
pass of its own linked person. This narrow permission does not grant access to
`GET` or `PATCH /rondo/v1/sponsors/{id}` or expose the sponsor contact list.

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

## Authenticated Wallet Actions

The household response supplies direct `admin-post.php` action URLs rather than
a public landing URL. Apple actions return the `.pkpass` payload; Google actions
redirect to the generated Google Save-to-Wallet URL. Both recheck the session-bound token,
logged-in user, person access and pass eligibility. A request for a person with
several current roles must include one valid `role` key.

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
