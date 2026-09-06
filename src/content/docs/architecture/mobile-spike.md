---
title: Capacitor mobile login experiment
---

Rondo's planned public app uses Capacitor with locally packaged React assets for iOS and Android.
The experimental implementation lives in `rondo-club/mobile/`, version **0.6.0**. It is a development
proof, not a production authentication provider or a store-ready application.

## Isolation and installation

The mobile package has its own dependencies, Vite configuration, HTML entry point, Capacitor
configuration and generated native project source. It does not load remote WordPress HTML and does
not register the web service worker. Its application identifier is `club.rondo.spike`.

The separate `mobile/spike-plugin/rondo-mobile-spike.php` plugin is never loaded by the theme.
Install it only on isolated development sites with synthetic data. It requires the explicit
`RONDO_MOBILE_SPIKE` constant set to `true` and a WordPress environment of `local` or `development`.
Production and staging environments register no spike routes. Keep outbound email captured locally.

Configure the reviewed test-club directory via `VITE_SPIKE_CLUBS` in the mobile build environment.
Entries contain `id`, `name` and an exact HTTPS origin. The default build contains no clubs.
The `mobile/README.md` file contains setup and validation commands.

## Login and access

The app opens the club's existing WordPress login in the Capacitor Browser plugin. A separate
consent action checks the user's WordPress nonce, then issues a two-minute authorization code
bound to S256 PKCE. A fixed private-use callback returns to the app; client-side state prevents
mixing login attempts. No client secret is embedded.

The opt-in plugin preserves the authorization destination through the WordPress login form POST.
Its late `login_redirect` filter accepts only the site's exact `admin-post.php` URL with the spike
action and valid client, callback, scope, state and S256 fields. Other destinations retain the
existing theme redirect. The filter is registered only when the development experiment is enabled.

The token endpoint issues a five-minute opaque bearer token. The app keeps it only in process
memory, and the server stores its payload under a hashed transient key. The payload includes the
canonical club origin and a password fingerprint. Changed passwords or removed read access
invalidate it; existing endpoint permissions determine the available data on every request.
An atomic WordPress option claim prevents concurrent authorization-code replay.

The read adapter maps only `me`, `household`, `profile`, `my-shifts`, `calendar` and `pass` to existing REST endpoints. It establishes
the token user's context for `rest_do_request()` and restores the caller afterwards. It does not
skip permission callbacks or field filters. The bearer token does not authenticate arbitrary
WordPress REST routes. Separately consented current-member signup/cancel and own-profile writes are available. Existing cookie/nonce authentication
and confidential FreeScout OIDC behavior remain unchanged.

| Endpoint under `/wp-json/rondo-mobile-spike/v1` | Method | Purpose |
|---|---|---|
| `/config` | GET | Protocol and canonical club origin |
| `/token` | POST | Code/PKCE exchange or refresh-token rotation |
| `/read?resource=me` | GET | Current user's original profile response |
| `/read?resource=household` | GET | Original permission-filtered household response |
| `/read?resource=my-shifts` | GET | Current member's original duties |
| `/read?resource=calendar&month=YYYY-MM` | GET | Exactly one month, forced `signup` view |
| `/read?resource=pass&person_id=…&role=…` | GET | Original QR issuance, additionally restricted to personal household passes |
| `/read?resource=profile` | GET | Own contact data, edit availability and pending email verification |
| `/profile` | POST | Separately consented own-profile actions through existing services |
| `/shift` | POST | Separately consented current-member signup/cancel through existing routes |
| `/revoke` | POST | Idempotent device-family revocation using access or refresh token |

The browser authorization action is `rondo_mobile_spike_authorize` on `wp-admin/admin-post.php`.
Its public client is `rondo-mobile-spike`, scope `rondo:spike:read` with optional `rondo:spike:volunteer` and `rondo:spike:profile`, and callback
`club.rondo.spike://oauth/callback`. Native HTTP follows no redirects. No browser CORS exception
or global WordPress authentication filter is installed.

## Member screens and navigation

Start links to available household passes, the next upcoming own duty and My details. Passen
uses the existing household pass summary and role options, then requests the existing QR route.
Even administrators cannot request a pass outside that personal household through the adapter.
The browser and mobile app share `src/hooks/usePassQr.js` for rendering the QR token.

Vrijwillig displays one month with counts of eligible duties per day, separate own-duty markers,
a selected day's available duties, My duties and duty detail. It uses `can_signup`, `is_signed_up`
and the original server statuses instead of rebuilding eligibility or capacity rules. Dates use
the club timezone and existing local WordPress shift timestamps. The adapter accepts only a valid
`YYYY-MM`, calculates that month's range and never forwards an arbitrary view or date range.

The passive header has a club logo beside Rondo, without a separate club-name row or dropdown.
`/config` returns the club timezone and configured logo URL. Only a logo on the selected HTTPS
club origin is accepted from API metadata. A reviewed build-directory `logoUrl` may explicitly
select an HTTPS image on the official club website; it takes precedence on login and restoration.
Missing or failed logos show the club initials with its accessible name. Logos have no border,
background, rounded frame or inner padding. AWC uses
`https://www.svawc.nl/wp-content/uploads/2024/02/awc-logo.svg`.
Club switching is exclusively under More → My clubs. Each login creates its own in-memory
React Router history and TanStack Query client; logout/unmount cancels and clears the cache.
Android Back follows the same history and minimizes the app at the initial root.

Wallet setup and remaining household/contribution actions open the fixed `/mijn-gegevens` page in the
system browser. No app token or server-provided nonce is appended to those links. Browser return
and app activation invalidate cached reads. A return is never treated as proof of a write or payment.
A Wallet action is offered only when the household summary reports a configured Wallet provider.

## Limits and release gates

Completed logins survive process restarts for up to 30 days. Pending authorization survives
process termination for at most ten minutes in the native vault. No offline
personal-data mode is implemented. Browser logout alone does not revoke an app session.

Verified HTTPS callbacks, a signed club directory, installation UUID, background snapshot privacy,
push, direct Wallet delivery, remaining native writes, guest passes, complete contribution controls and
configurable navigation remain release work. Physical-device, reinstall, locked-device and backup
checks plus an independent security review are still required.
The agreed first-release design remains in `docs/prd/mobile-app-first-release.md`; actual spike
evidence and remaining device checks are recorded in `docs/prd/mobile-app-spike-results.md`.

## Persistent device sessions (0.3.0)

`DeviceSession` serializes vault writes and coalesces refresh requests. Startup validates the saved
club against the compiled directory, rotates its refresh token and saves the replacement before
publishing access. Five-minute access tokens, personal responses and QR codes stay in memory. A network error retains the encrypted login for retry; invalid grants
require a new login. There is no offline personal-data mode.

The local `RondoSessionVault` bridge supports only read/write/clear for one bounded record. iOS
uses a nonsynchronizing Keychain item with `WhenUnlockedThisDeviceOnly` and a reinstall marker.
Android uses AES-256-GCM with a nonexportable Keystore key and an AtomicFile in `noBackupFilesDir`.
Neither implementation falls back to browser storage. Capacitor bridge logging is disabled even
in debug builds, keeping plugin arguments and results out of logs.

WordPress stores hashed refresh-token keys and an opaque device-session family in options with
autoload disabled. Atomic claims prevent replay; reusing a consumed refresh token revokes the
whole family, including later access tokens. Password changes, removed read access, club audience
mismatch and absolute expiry invalidate access. Families expire 30 days from login, without sliding
extension. Consumed hashes and claims remain until expiry for reuse detection and cron cleanup.
Production scaling, rate limits and account-facing device management still need review.

Logout invalidates in-flight reads immediately and durably removes the active login before network
revocation. Offline revocations stay encrypted for the next startup; the server family may remain
valid until that retry or its absolute expiry. Storage errors are reported as incomplete logout.
A lost refresh response requires fresh login after retry rejection; there is no replay grace period.

Simulator Keychain access requires local signing (no developer account needed):

```sh
xcodebuild -project mobile/ios/App/App.xcodeproj -scheme App \
  -destination 'generic/platform=iOS Simulator' -configuration Debug \
  -derivedDataPath /private/tmp/rondo-spike-simulator \
  CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- build
```

`Simulator.entitlements` applies only to simulator SDK builds. Physical builds need real
team-prefixed entitlements from Apple provisioning. An unsigned simulator build compiles but
cannot access Keychain (`-34018`); do not replace secure storage to bypass this error.

## Website branding

The compact header uses the website's actual `rondo-wordmark.svg`, with the club logo on its left.
Figtree 600/700/800 headings and the navy `#001B60`, teal `#00908B`, purple `#993399`, surface and
border palette match the Rondo website. The native launcher and splash images are rendered from
its unchanged `rondo-logo.svg`, centered with padding for platform masks. Fonts are bundled with
their OFL license, without remote requests.

## Existing-account email login and cold callbacks (0.4.0)

The opt-in plugin uses Magic Login's `magic_login_create_login_link` and final
`magic_login_redirect` filters to preserve only its exact validated authorization destination.
This fixes Rondo activation's explicit home redirect for an existing linked account. The provider's
token, nonce, throttling and account eligibility checks remain authoritative. SMS, other hosts,
normal web destinations and malformed authorization requests are unchanged.

`DeviceSession` stores a pending club ID/origin, verifier, state and creation time before opening
the browser. Startup validates the reviewed directory and ten-minute TTL before native callbacks
can consume that state. Resume rebuilds the original authorization URL. Cancel and valid denial
clear the pending record; an unrelated state cannot cancel it. Consumption is persisted before
exchange, and duplicate events share one exchange. A lost exchange response needs a new login.

Existing-account email links are tested with locally captured synthetic mail. New-account and
household activation journeys, real email-app handoff and physical devices remain unverified.
Verified HTTPS callbacks remain a separate release gate.

## Membership pass branding (0.4.1)

Native pass cards consume the existing QR response's `pass.background_color`, sharing
`getMembershipPassBackground` and `getMembershipPassPresentation` with the web pass. The app
no longer overrides club backgrounds with its own gradient. Sponsor variants use dark text;
businessclub passes retain their pass-specific same-origin logo. Other passes prefer the
reviewed club logo and fall back to the response's same-origin logo. Logos have no frame,
background or padding; failed images are hidden. The surrounding app retains Rondo branding.

Native simulator checks cover the synthetic ordinary member's green pass, official AWC SVG and
loaded QR on iOS and Android. Sponsor/businessclub accounts were not exercised in that native run.

## Native member shift actions (0.5.0)

The browser now offers explicit `rondo:spike:volunteer` consent alongside read access. Scope is
bound to the authorization code and server device family, retained during refresh, and returned
with token pairs. Existing families and legacy pending login records remain read-only; the user
must reconnect to grant the additional permission. There is no silent upgrade.

The fixed `POST /shift` adapter accepts only `shift_id`, `action` (`signup`/`cancel`) and boolean
`force_overlap`. It rejects person selection and routes only to the current member's original
signup/cancel endpoints. Existing eligibility, certificate/pool checks, locks/capacity, signup
windows, cancellation deadlines and confirmation scheduling remain authoritative. Caller context
is restored even when the original route rejects the action. Profile operations are described separately below.

The duty screen requires confirmation and uses server `can_signup`/`can_cancel` flags. Overlap
requires a second explicit decision; late signup explains the existing 30-minute grace period.
Writes are serialized at the client and never automatically retried. An uncertain result presents
a readback action, and confirmed writes invalidate the session's member caches. Local mail stays
captured and the whole adapter is still disabled outside local/development.

## Native own-profile editing (0.6.0)

New logins request read, volunteer and `rondo:spike:profile` permission. Browser consent explains
own contact changes and household address effects. Old read-only and volunteer device families
keep their original permissions after refresh and must reconnect to grant profile access.

`GET /read?resource=profile` returns the own person from the existing filtered household response,
`can_edit`, `readonly_reason` and token-free `pending_email` metadata. Former-member and deceased
restrictions come from `MemberProfileService::linked_person_id()` on both read and every write.

`POST /profile` accepts exactly `action` and `values`. Fixed actions delegate to existing routes:

| Action | Required values | Original route |
|---|---|---|
| `phones` | All four phone slots | POST `/user/profile-phones` |
| `address` | street_name, house_number, house_number_addition, postal_code, city, state, country, country_code | POST `/user/household-address` |
| `email_request` | slot, email | POST `/user/profile-email/request` |
| `email_cancel` | Empty object | DELETE `/user/profile-email/pending` |
| `email_remove` | Empty object | DELETE `/user/profile-email/secondary` |

All original paths are under `/rondo/v1`. The adapter rejects unknown/missing fields, non-string
values, long values and caller-selected person IDs. The logged-in linked person is authoritative,
including when the token belongs to an administrator. Phone groups must be complete because the
existing service replaces all four slots. Original validation, phone normalization, household
propagation, secondary-email promotion, audit logs and sync markers are preserved. No sync is run
locally. Email verification uses the existing public verification page; app activation or the
explicit refresh button reads the actual result. Browser return alone is never proof of verification.

The member navigates through My details → Gegevens wijzigen. Address forms explain the effect on
minor children; email forms explain verification and matching child-address propagation. Pending
requests can be cancelled, and secondary email removal requires confirmation. Form drafts remain
in component memory only. Writes share one session guard with volunteer actions; they are never
queued or retried automatically. After an uncertain response, controls require a fresh profile
read before allowing another submission. Logout rejects stale write results.

Wallet, contribution and separate child/other-parent editing remain on the club site. The adapter
still requires local/development opt-in, and all test email is captured locally.

Validation for 0.6.0: 35 mobile JavaScript tests and 21 focused WordPress/MySQL tests (208 assertions)
pass. Web/mobile/native builds, mobile lint and PHP coding standards pass. Both simulators exercised
profile consent upgrade, phone save plus cold restart, and a pending secondary-email request.
iPhone exercised address save and pending-email cancellation. Android opened the captured verification
link in Chrome and showed the confirmed address after a cold app restart. Independent WordPress
reads verified persisted phone/address values and pending/verified email states. Android interruption
before delivery exercised the readback-only error state and recovery; actual loss of a response after
storage is covered by the client unit test. No physical device, real mailbox or local Sportlink sync
was used. Shared-service household propagation and former-member rejection are covered in PHP.
