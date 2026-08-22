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
- an active sponsor-company relationship with `receives_pass=true`; the company
  `sponsor_role` selects `businessclub` or `awc_sponsor` (`Sponsor` tier),
  independently of `person_type` and `type-lid`

The active sponsor relation takes precedence over a member tier, so a
member+sponsor receives the selected Sponsor pass. If several relationships
grant a pass, one must be marked as the primary pass relation. Archiving or
removing the final eligible relationship falls back to `type-lid`. Legacy
`is_sponsor` and `sponsor_pass_variant` person fields remain a temporary
migration fallback.

## Member access in Rondo

Every user linked to a person can open **Mijn gegevens**, including users who
also have a staff or management role. Each visible household card shows its
eligible pass and links to the existing public `/lidpas/{token}` landing page.
This includes passes for children under 18. Ineligible people receive no pass
action.

Sponsor accounts without a staff or parent role use **Mijn gegevens** as their
default landing page. Sponsors who are also a current parent keep **Mijn
inschrijftaken** as their default. If the linked person owns a pass from an active sponsor
organization, their own card also shows that organization's current logo and an
upload action to add or replace it. The personal card is labeled
**Contactpersoon**, or **Contactpersoon en ouder** when the sponsor contact also
has a current child relationship. The organization block is labeled **Sponsor**,
so the roles are visually distinct. The action does not expose or unlock the general
sponsor-management screens.

The household API returns the public URL, pass type and display label. For the
organization behind a sponsor pass it additionally returns only the organization
ID, display name, logo URL and an explicit `can_edit_logo` flag. Contacts,
addresses and other sponsor-management data remain private.

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
- Sponsor passes use a white background with dark foreground and label text and replace team/function fields with `BEDRIJF` and the selected sponsor company's title
- `businessclub` shows `Businessclub {organization name}` with the separately configurable Businessclub logo; without an uploaded logo it falls back to the bundled Businessclub AWC asset
- `awc_sponsor` shows `{organization name} Sponsor` with the standard club logo

Administrators upload both the standard club logo and the optional Businessclub logo under **Instellingen → Club → Huisstijl**. The Businessclub attachment ID is stored in the WordPress option `rondo_finance_businessclub_logo_id`.

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
- Uses the club logo as wallet `logo` (not `heroImage`) and sets `cardTitle` to issuer/club name to keep a standard Google Generic Pass layout
- Sponsor `businessclub` passes use the separately configurable Businessclub logo and `Businessclub {issuer name}`; without an uploaded logo they fall back to the bundled Businessclub AWC asset
- Sponsor `awc_sponsor` passes use the standard club logo and `{issuer name} Sponsor`
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
