---
title: Capacitor mobile login experiment
---

Rondo's planned public app uses Capacitor with locally packaged React assets for iOS and Android.
The experimental implementation lives in `rondo-club/mobile/`, version **0.3.0**. It is a development
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

The read adapter maps only `me`, `household`, `my-shifts`, `calendar` and `pass` to existing REST endpoints. It establishes
the token user's context for `rest_do_request()` and restores the caller afterwards. It does not
skip permission callbacks or field filters. The bearer token does not authenticate arbitrary
WordPress REST routes, and the adapter cannot dispatch writes. Existing cookie/nonce authentication
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
| `/revoke` | POST | Idempotent device-family revocation using access or refresh token |

The browser authorization action is `rondo_mobile_spike_authorize` on `wp-admin/admin-post.php`.
Its public client is `rondo-mobile-spike`, scope `rondo:spike:read`, and callback
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
club origin is rendered; missing or failed logos show the club initials with its accessible name.
Club switching is exclusively under More → My clubs. Each login creates its own in-memory
React Router history and TanStack Query client; logout/unmount cancels and clears the cache.
Android Back follows the same history and minimizes the app at the initial root.

Write actions and Wallet setup still open fixed `/vrijwillig` or `/mijn-gegevens` pages in the
system browser. No app token or server-provided nonce is appended to those links. Browser return
and app activation invalidate cached reads. A return is never treated as proof of a write or payment.
A Wallet action is offered only when the household summary reports a configured Wallet provider.

## Limits and release gates

Completed logins survive process restarts for up to 30 days. The pending PKCE verifier remains
memory-only, so killing the app during browser authorization requires restarting login. No offline
personal-data mode is implemented. Browser logout alone does not revoke an app session.

Verified HTTPS callbacks, a signed club directory, installation UUID, background snapshot privacy,
push, direct Wallet delivery, native writes, guest passes, complete contribution controls and
configurable navigation remain release work. Physical-device, reinstall, locked-device and backup
checks plus an independent security review are still required.
The agreed first-release design remains in `docs/prd/mobile-app-first-release.md`; actual spike
evidence and remaining device checks are recorded in `docs/prd/mobile-app-spike-results.md`.

## Persistent device sessions (0.3.0)

`DeviceSession` serializes vault writes and coalesces refresh requests. Startup validates the saved
club against the compiled directory, rotates its refresh token and saves the replacement before
publishing access. Five-minute access tokens, personal responses, QR codes and pending PKCE
verifiers stay in memory. A network error retains the encrypted login for retry; invalid grants
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
