---
title: Capacitor mobile login experiment
---

Rondo's planned public app uses Capacitor with locally packaged React assets for iOS and Android.
The experimental implementation lives in `rondo-club/mobile/`, version **0.1.0**. It is a development
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

The token endpoint issues a five-minute opaque bearer token. The app keeps it only in process
memory, and the server stores its payload under a hashed transient key. The payload includes the
canonical club origin and a password fingerprint. Changed passwords or removed read access
invalidate it; existing endpoint permissions determine the available data on every request.
An atomic WordPress option claim prevents concurrent authorization-code replay.

The read adapter maps only `me` and `household` to the existing REST endpoints. It establishes
the token user's context for `rest_do_request()` and restores the caller afterwards. It does not
skip permission callbacks or field filters. The bearer token does not authenticate arbitrary
WordPress REST routes, and the adapter cannot dispatch writes. Existing cookie/nonce authentication
and confidential FreeScout OIDC behavior remain unchanged.

| Endpoint under `/wp-json/rondo-mobile-spike/v1` | Method | Purpose |
|---|---|---|
| `/config` | GET | Protocol and canonical club origin |
| `/token` | POST | One-use code and verifier exchange |
| `/read?resource=me` | GET | Current user's original profile response |
| `/read?resource=household` | GET | Original permission-filtered household response |
| `/revoke` | POST | Idempotent bearer-session deletion |

The browser authorization action is `rondo_mobile_spike_authorize` on `wp-admin/admin-post.php`.
Its public client is `rondo-mobile-spike`, scope `rondo:spike:read`, and callback
`club.rondo.spike://oauth/callback`. Native HTTP follows no redirects. No browser CORS exception
or global WordPress authentication filter is installed.

## Limits and release gates

Closing the app loses the session and pending PKCE verifier. A cold callback asks the user to
restart login. Offline logout drops local data immediately; failed server revocation is bounded
by the five-minute expiry. Browser logout alone does not revoke the app token.

The experiment does not implement secure persistent storage, refresh tokens, verified HTTPS
callback links, a signed club directory, an installation UUID, push, Wallet handoffs or the full
member screens. Those remain required work, with device and security verification before release.
The agreed first-release design remains in `docs/prd/mobile-app-first-release.md`; actual spike
evidence and native-build blockers are recorded in `docs/prd/mobile-app-spike-results.md`.
