---
title: "Membership Passes"
---

Membership passes provide a unique public landing page per eligible member where they can add their digital membership card to Apple Wallet or Google Wallet.

## URL model

Each eligible person gets:

- `_membership_pass_token` (64-char hex token)
- `_membership_pass_url` (public URL)

Public route:

- `/lidpas/{token}`

## Eligibility

A person is eligible based on ACF field `type-lid`:

- `Bondslid` (`Bondslid` tier)
- `Verenigingslid` (`Verenigingslid` tier)
- `person_type = sponsor` (`Sponsor` tier), onafhankelijk van `type-lid`

If neither `type-lid` nor `person_type` matches an eligible tier, pass token and URL meta are removed.

## Lifecycle

`Rondo\Passes\PublicMembershipPassPage` keeps URLs in sync:

- On person save (`save_post_person`)
- On ACF save (`acf/save_post`)
- One-time v2 backfill for existing eligible members (`rondo_membership_pass_backfill_v2_done` option)

## Landing page behavior

`GET /lidpas/{token}` renders a standalone public page (no React SPA) with:

- Member details (name, KNVB ID, current season)
- `Add to Apple Wallet`
- `Add to Google Wallet`

Wallet actions:

- Apple: `/lidpas/{token}?wallet=apple`
- Google: `/lidpas/{token}?wallet=google`
- If a person has multiple active work roles, the public page requires selecting exactly one role before wallet actions are enabled (no "all roles" wallet payload).
- Public page uses local Dutch badge assets for both CTAs:
  - Apple: `public/icons/NL_Add_to_Apple_Wallet_RGB_101921.svg`
  - Google: `public/icons/nl_add_to_google_wallet_add-wallet-badge.svg`

## Settings location

Wallet configuration lives in **Settings → Koppelingen → Wallets**.

Uploads are stored as WordPress media attachments (no manual server paths):

- Apple certificate `.p12` upload
- Google service-account `.json` upload

Required uploads/extensions are enabled for financieel/admin users via `upload_mimes`.

## Apple Wallet generator

Class: `Rondo\Passes\MembershipPassApple`

- Requires `pkpass/pkpass`
- Generates `.pkpass` with QR payload from signed membership JWT
- Uses uploaded certificate attachment + stored certificate password
- Uses configured pass identifiers and club branding
- Uses tier-based primary label (`BONDSLID`, `VERENIGINGSLID`, or `SPONSOR`)
- Shows KNVB ID field only for `Bondslid` tier
- Sponsor passes use a white background with dark foreground and label text, show `Businessclub {organization name}` at the top, and replace team/function fields with `BEDRIJF` and the person's `company_name`

Config keys (stored via Finance settings):

- `rondo_membership_pass_apple_cert_attachment_id`
- `rondo_membership_pass_apple_cert_password`
- `rondo_membership_pass_apple_pass_type_identifier`
- `rondo_membership_pass_apple_team_identifier`
- `rondo_membership_pass_apple_organization_name`

Backward-compatible constants are still supported as fallback.

## Google Wallet generator

Class: `Rondo\Passes\MembershipPassGoogle`

- Uses `google/apiclient`
- Creates/updates GenericClass + GenericObject
- Redirects member to Google Save-to-Wallet URL
- Uses uploaded service-account JSON attachment
- Tier routing depends on `type-lid`, not KNVB ID presence
- Uses the club logo as wallet `logo` (not `heroImage`) and sets `cardTitle` to issuer/club name to keep a standard Google Generic Pass layout; Sponsor passes use `Businessclub {issuer name}`
- Generates a cached padded PNG variant of the club logo for Google Wallet to avoid crest clipping in the compact wallet card
- Uses full object `update` to replace legacy object styling when a pass object already exists
- Sets `subheader` to member type label (`Bondslid`/`Verenigingslid`/`Sponsor`) above the member name
- Uses text modules for pass data (`FUNCTIE`, `TEAM`, optional `KNVB ID`, `SEIZOEN`); Sponsor passes instead show only `BEDRIJF` and `SEIZOEN`
- Sets `hexBackgroundColor` from finance accent color (with fallback), except for Sponsor passes which always use `#ffffff`, and includes localized `logo.contentDescription`

Config keys (stored via Finance settings):

- `rondo_membership_pass_google_service_account_attachment_id`
- `rondo_membership_pass_google_issuer_id`
- `rondo_membership_pass_google_class_suffix`

Backward-compatible constants are still supported as fallback.

## REST exposure

Person REST responses include:

- `membership_pass_url`

Endpoints:

- `GET /rondo/v1/membership-passes/people/{person_id}/landing-url`
- `GET /rondo/v1/membership-passes/people/{person_id}/qr-token`
- `POST /rondo/v1/membership-passes/verify`

## Scanner compatibility

The in-app scanner (`/lidpas-scanner`) uses a layered detection strategy:

- `BarcodeDetector` when available
- `jsQR` frame-decoding fallback when `BarcodeDetector` is not supported
- Sponsor scans show `Bedrijf: {company_name}` instead of a KNVB ID

This keeps camera scanning functional on browsers like iOS Chrome that do not expose `BarcodeDetector`.
