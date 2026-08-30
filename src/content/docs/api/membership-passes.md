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
| `ttl_days` | int | No | Optional token lifetime in days (1-730). Omit or use `0` for a permanent token. |

The default token has no `exp` claim. It contains `pass_version`, which is
compared with the current private version on every online scan. Existing tokens
without this claim are treated as version `1` for backward compatibility.

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
    "sponsor_role": "businessclub",
    "club_tv_opt_out": false,
    "can_edit_logo": true,
    "can_manage_presence": true
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
access. `sponsor_role` determines whether the personal Businessclub opt-out is
available; `club_tv_opt_out` reflects the stored preference.

## Replace own sponsor organization logo

**POST** `/rondo/v1/sponsors/{sponsor_id}/logo/upload`

Send a multipart upload with field `logo`. JPEG, PNG, GIF, WebP and SVG are
accepted up to 5 MB.

Sponsor managers may use the endpoint for every sponsor record. A regular
sponsor account may use it only for the active organization that supplies the
pass of its own linked person. This narrow permission does not grant access to
`GET` or `PATCH /rondo/v1/sponsors/{id}` or expose the sponsor contact list.

## Update own narrowcasting preference

**PATCH** `/rondo/v1/sponsors/{sponsor_id}/narrowcasting-preference`

```json
{ "opt_out": true }
```

Only a Businessclub organization can store this preference. A regular sponsor
account may update only the active organization that supplies its own sponsor
pass. An opt-out excludes the organization from rotating Club TV logos and
dedicated sponsor slides without changing its administrator-defined display
frequency.

## Verify Scanned QR Token

**POST** `/rondo/v1/membership-passes/verify`

Validates a scanned token and resolves member status for scanner UIs.

### Permission

Administrators and users with the `toegangscontrole` capability.

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
  "pass_type": "businessclub",
  "token": {
    "issued_at": "2026-02-22T14:30:00+00:00",
    "expires_at": null,
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

`pass_type` is the exact wallet-pass variant encoded when the pass was issued:
`bondslid`, `verenigingslid`, `businessclub`, or `awc_sponsor`. This keeps
dual-role members in the correct access statistic.

`valid` is calculated from the signature, the current membership status, the
current pass right and the current `pass_version`. An intact but revoked pass
returns HTTP 200 with `valid: false` and `reason` set to `revoked`, `former`,
`expired`, or `no_pass_right`. This lets the scanner identify the person while
clearly rejecting the pass. A network error has no offline fallback.

## Match-bound access endpoints

All access endpoints require an administrator or a user with the
`toegangscontrole` capability.

### List scanner matches

**GET** `/rondo/v1/access-events/matches`

Returns upcoming Sportlink home fixtures with `is_active`, `is_selectable`,
`window_from`, and `window_until`. The scanner polls this endpoint every minute.

### Select a match

**POST** `/rondo/v1/access-events/select`

```json
{ "source_id": "sportlink-match-id" }
```

The server rechecks the current Sportlink feed and accepts only a selectable
home fixture. The response contains the private event snapshot and its current
anonymous statistics.

### Scan and count a pass

**POST** `/rondo/v1/access-events/{event_id}/scan`

```json
{ "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
```

The response extends the regular verification response with `admission` and
`stats`. `admission.counted` is true only for the first accepted scan of that
person at this event. A repeat returns `duplicate: true` without increasing the
total.

### Read live statistics

**GET** `/rondo/v1/access-events/{event_id}/stats`

Returns `total`, a `counts` object keyed by the four pass types, and a labeled
`breakdown` array. No attendee records or identifiers are exposed.

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
- QR tokens are permanent by default and must always be verified online.
- Signing key is generated automatically on first use and stored in option `rondo_membership_pass_jwt_secret`.
- Apple pass generation requires `pkpass/pkpass` to be installed and certificate config set.
- Google pass generation uses `google/apiclient` with service-account credentials.
