---
title: "Membership Passes"
---

Membership passes let authenticated members add their own card, or a minor
child's card, to Apple Wallet or Google Wallet from **Mijn gegevens**.

## Eligibility

A person is eligible based on native field `type_lid` (stored as `type-lid`):

- `Bondslid` (`Bondslid` tier)
- `Verenigingslid` (`Verenigingslid` tier)
- an active sponsor-company relationship with `receives_pass=true`; the company
  `sponsor_role` selects `businessclub` or `awc_sponsor` (`Sponsor` tier),
  independently of `person_type` and `type-lid`

Every eligible person must also be active: `former_member` must be false and
`lid_tot` must be empty or today/future. The same centralized eligibility check
is used by the household response, wallet generators and QR verification.

The active sponsor relation remains the primary tier. When that person also has
a `Bondslid` or `Verenigingslid` tier and at least one current work-history
role, **Mijn gegevens** offers both the selected Sponsor pass and an AWC member
pass for every current role. If several sponsor relationships grant a pass, one
must be marked as the primary pass relation. Archiving or removing the final
eligible relationship falls back to `type-lid`. Legacy `is_sponsor` and
`sponsor_pass_variant` person fields remain a temporary migration fallback.

## Member access in Rondo

Every user linked to a person can open **Mijn gegevens**, including users who
also have a staff or management role. Each visible household card shows direct
Apple Wallet and Google Wallet actions for its eligible pass. This includes
passes for children under 18. Ineligible people receive no pass action.

Sponsor accounts without a staff or parent role use **Mijn gegevens** as their
default landing page. Sponsors who are also a current parent keep **Mijn
inschrijftaken** as their default. If the linked person owns a pass from an active sponsor
organization, their own card also shows that organization's current logo and an
upload action to add or replace it. The personal card is labeled
**Contactpersoon**, or **Contactpersoon en ouder** when the sponsor contact also
has a current child relationship. The organization block is labeled **Sponsor**,
so the roles are visually distinct. The action does not expose or unlock the general
sponsor-management screens.

The household API returns the pass type, display label, wallet availability,
session-bound signed action URLs and client-safe role labels. For the organization
behind a sponsor pass it additionally returns only the organization ID, display
name, logo URL and an explicit `can_edit_logo` flag. Contacts, addresses and
other sponsor-management data remain private.

## Authenticated wallet actions

`Rondo\Passes\MembershipPassService` registers an authenticated `admin-post.php`
action for Apple downloads and Google redirects. Every action checks:

- the logged-in WordPress session;
- a signed token scoped to the user, login session, person and wallet type;
- row-level access to the selected person;
- current pass eligibility;
- a valid pass or role key when a choice is required.

The app's wp-admin redirect guard exempts `admin-post.php`, because this endpoint
serves authenticated frontend actions for regular members as well as administrators.

With zero or one available pass choice the wallet badge acts directly. With
several choices, **Mijn gegevens** opens a popover and appends the selected key
to the action URL. For a dual-role sponsor this includes the Businessclub or
Sponsor pass plus one AWC pass per current work role. The backend maps the
opaque key back to the validated sponsor or regular member tier before
generating the pass. The session-bound token remains valid for the life of that
login session, including when a mobile browser or installed app keeps the page
open. The UI uses the local Dutch badge assets:

- Apple: `public/icons/NL_Add_to_Apple_Wallet_RGB_101921.svg`
- Google: `public/icons/nl_add_to_google_wallet_add-wallet-badge.svg`

There is no public membership-pass page or stable public pass URL. The one-time
`rondo_membership_pass_private_actions_v1_done` cleanup removes legacy
`_membership_pass_token` and `_membership_pass_url` person meta and flushes the
old rewrite rule.

## Settings location

Wallet configuration lives in **Settings → Koppelingen → Wallets**.

Uploads are stored as WordPress media attachments (no manual server paths):

- Apple certificate `.p12` upload
- Google service-account `.json` upload

The Wallets tab reads the Apple certificate and shows its expiry date. It warns
from 45 days before expiry and reports missing, expired or unreadable files
without exposing the certificate path or password.

Required uploads/extensions are enabled for financieel/admin users via `upload_mimes`.

## Apple Wallet generator

Class: `Rondo\Passes\MembershipPassApple`

- Requires `pkpass/pkpass`
- Generates `.pkpass` with QR payload from signed membership JWT
- Uses uploaded certificate attachment + stored certificate password
- Uses configured pass identifiers and club branding
- Uses `{club name} lidmaatschapspas` as the Apple Wallet description for member passes
- Uses tier-based primary label (`BONDSLID`, `VERENIGINGSLID`, or `SPONSOR`)
- Has no season field; validity follows current pass rights instead of a season boundary
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
- Uses text modules for pass data (`FUNCTIE`, `TEAM`, optional `KNVB ID`); Sponsor passes instead show only `BEDRIJF`
- Sets `hexBackgroundColor` from finance accent color (with fallback), except for Sponsor passes which always use `#ffffff`, and includes localized `logo.contentDescription`

Config keys (stored via Finance settings):

- `rondo_membership_pass_google_service_account_attachment_id`
- `rondo_membership_pass_google_issuer_id`
- `rondo_membership_pass_google_class_suffix`

Backward-compatible constants are still supported as fallback.

## REST exposure

The household response exposes the client-safe wallet summary. Scanner
endpoints remain:

- `GET /rondo/v1/membership-passes/people/{person_id}/qr-token`
- `POST /rondo/v1/membership-passes/verify`

## Scanner compatibility

The in-app scanner (`/lidpas-scanner`) uses a layered detection strategy:

- `BarcodeDetector` when available
- `jsQR` frame-decoding fallback when `BarcodeDetector` is not supported
- Sponsor scans show `Bedrijf: {company_name}` instead of a KNVB ID

Only administrators and users with the `toegangscontrole` capability can call
the verification endpoint. Every scan is checked online against the current
membership, sponsor relation and pass version. A pass has no default expiry,
but any relevant eligibility change increments the person's private pass
version, permanently revoking all older QR codes. If the connection fails, the
scanner does not make an offline validity claim.

This keeps camera scanning functional on browsers like iOS Chrome that do not expose `BarcodeDetector`.
