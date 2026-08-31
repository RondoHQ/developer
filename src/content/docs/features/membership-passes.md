---
title: "Membership Passes"
---

Membership passes let authenticated members add their own card, or a minor
child's card, to Apple Wallet or Google Wallet from **Mijn gegevens**.

## Reusable guest passes for a configured team

An administrator selects one team under **Settings → Club → Team with guest
passes**. An authenticated person with a current player role for that exact team
record receives two fixed guest slots on **Mijn gegevens**. Player eligibility
is resolved server-side from current `work_history`, the selected team ID and the
configured player role list. Staff roles, former members and players of a
different team record do not receive the controls. Leaving the setting empty
disables guest passes.

Each slot is created only when the player requests its share link. The public
`/gastpas/{token}` page lets the guest enter their own name once, then provides
Apple Wallet, Google Wallet and a digital QR fallback. The pass remains usable
for later home matches of the configured team; the player does not activate it for every match.
The card and scanner show the guest name and **Gast van {player}**.

Replacing a guest keeps the same numbered slot, rotates the public link and
increments the pass version. Old Wallet passes, screenshots and share links
therefore fail online verification immediately. Keeping the stable slot is
also the quota boundary: the scanner accepts slot 1 and slot 2 at most once
each per event, even if a player replaces a guest during that event.

Guest-pass state is stored in the private `rondo_guest_pass` post type. Domain
fields include the host person, slot number, guest name, status, claim time and
pass version. The 64-character bearer token is stored as private infrastructure
metadata and is never included in scanner responses or admission records.

Authenticated player endpoints are:

- `GET /rondo/v1/guest-passes/me`
- `POST /rondo/v1/guest-passes/slots/{1|2}`
- `POST /rondo/v1/guest-passes/slots/{1|2}/replace`

Guest QR payloads use the signed `rondo-guest-pass` audience. At scan time the
server rechecks the pass version, claimed status, current role for the configured
team and the selected event's home-team name before recording admission.

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
Apple Wallet and Google Wallet actions plus an authenticated digital pass with
the same QR payload. This includes passes for children under 18. Ineligible
people receive no pass action.

Sponsor accounts without a staff or parent role use **Mijn gegevens** as their
default landing page. Sponsors who are also a current parent keep **Mijn
inschrijftaken** as their default. If the linked person owns a pass from an active sponsor
organization, their own card also shows that organization's current logo and an
upload action to add or replace it. Sponsor details appear in a separate card
below the personal contact card. That sponsor card explains that the logo is
used on Club TV and previews the logo in the same white frame as the TV layout.
For Businessclub organizations it also offers a personal narrowcasting opt-out.
The personal card is labeled
**Contactpersoon**, or **Contactpersoon en ouder** when the sponsor contact also
has a current child relationship. The organization block is labeled **Sponsor**,
so the roles are visually distinct. The action does not expose or unlock the general
sponsor-management screens.

The household API returns the pass type, display label, wallet availability,
session-bound signed action URLs and client-safe role labels. For the organization
behind a sponsor pass it additionally returns only the organization ID, display
name, logo URL, sponsor role, Club TV opt-out and explicit self-service flags.
Contacts, addresses and other sponsor-management data remain private.

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

## Digital pass without a wallet

The **Geen wallet? Toon je pas met QR-code** link opens
`/mijn-gegevens/pas/{person_id}` inside the authenticated app. The page renders
the club or Businessclub pass branding, the member name, relevant pass detail,
and a large high-contrast QR code. It is available independently of device type
and Apple or Google Wallet configuration.

The digital pass uses the same configured wallet background color as Apple
Wallet and Google Wallet. Regular member passes therefore follow the club's
configured accent color, while Sponsor and Businessclub passes use the same
white background as their wallet versions.

The page requests a fresh token from the existing QR-token endpoint. When a
person has several pass choices, **Mijn gegevens** uses the same choice popover
as the wallet actions and sends its opaque `role` key to the endpoint. The
server resolves that key to the current validated Sponsor or regular member
tier before issuing the token. A missing or unknown choice is rejected.

The route itself is not a public pass URL: the app and endpoint both require an
authenticated session, and person access remains server-side scoped. The QR
payload can still be retained as a screenshot, just like the QR code inside a
wallet pass. Every scan checks current eligibility and `pass_version`, so an
old screenshot stops working after revocation or a relevant entitlement
change.

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

The household response exposes the client-safe wallet and digital-pass summary.
Scanner endpoints remain:

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

## Match selection and anonymous access statistics

The scanner loads home fixtures from the existing server-side Sportlink
matchday cache. It marks a match active from two hours before until four hours
after kickoff. One active match is selected automatically. When several are
active, the operator selects once and the browser remembers that choice for the
same local date. A manual fallback shows selectable home fixtures for today.

The camera remains available without a selected fixture. In that mode the
scanner still verifies current membership, pass entitlement, and pass version,
but it does not create an admission or change match statistics. Match totals
are shown below scan results at the end of the page.

Selecting a fixture creates or updates a private `rondo_access_event` snapshot.
Every accepted QR scan creates at most one private `rondo_admission` for that
event. The aggregate breakdown has five fixed types: `bondslid`,
`verenigingslid`, `businessclub`, `awc_sponsor`, and `guest`.

Admission posts store only the event reference, exact pass type, and scan time.
They never store the person ID, name, email address, KNVB ID, or raw token. A
per-event HMAC option prevents the same person being counted twice across
scanner devices. Its secret stays server-side and the duplicate-detection
option is deleted after 30 days; aggregate admission posts remain.

Guest admissions are the scoped exception to the anonymous member flow. For 30
days they additionally store the guest-pass reference, host person, stable slot
and guest-name snapshot so the club can identify whose guest was admitted.
The daily cleanup removes those four identifying fields together with the
duplicate-detection lock. The event, `guest` pass type and aggregate count
remain; regular member admissions continue to contain no attendee identity.

Ticket sales and payment flows are not part of this implementation.
