---
title: AWC native pilot API
---

This opt-in API is provided by a separately installed pilot plugin. It is not enabled by a theme
release. Its first scope is viewing a tester's own household and eligible passes, including Wallet
export. Production activation and physical-device tests remain separate from build preparation.

| Endpoint | Contract |
| --- | --- |
| `GET /wp-json/rondo-mobile-pilot/v1/config` | Protocol `rondo-mobile-pilot-v1`, canonical AWC origin, timezone and logo. |
| `GET/POST /wp-admin/admin-post.php?action=rondo_mobile_pilot_authorize` | Existing web login and explicit consent; fixed public client `rondo-awc-pilot`, scope `rondo:pilot:read`, S256 PKCE and exact HTTPS callback. POST requires the authenticated user's nonce. |
| `POST /wp-json/rondo-mobile-pilot/v1/token` | Code/verifier exchange or rotating refresh; no client secret. |
| `GET /wp-json/rondo-mobile-pilot/v1/read` | Named resources `me`, `household`, `profile`, `my-shifts`, `calendar`, `pass`; fixed internal routes and existing permissions. |
| `POST /wp-json/rondo-mobile-pilot/v1/wallet` | JSON `person_id`, `role`, `provider` (`apple` or `google`); validated own-household pass choice; signed Apple base64 or an allowlisted Google save URL. |
| `POST /wp-json/rondo-mobile-pilot/v1/revoke` | Idempotent family revocation using access or refresh token. |
| `POST /wp-json/rondo-mobile-pilot/v1/profile` and `/shift` | Always denied with `read_only_pilot`, including valid pilot sessions. |

The callback is `https://rondo.svawc.nl/rondo-app/callback`. The generated native projects use
Associated Domains/App Links; iOS 17.4+ uses ASWebAuthenticationSession with the exact HTTPS callback
and webcredentials association. No unverified custom-scheme fallback is accepted.

`RONDO_MOBILE_PILOT === true` and a valid `rondo_mobile_pilot` WordPress option are required:
`enabled` (boolean), `ends_at` (future integer Unix timestamp), `epoch` (at least 32 characters),
and `testers` (1–20 exact integer `user_id`/`person_id` pairs). The linked person must still be
published, and the account must retain read permission. Every request rechecks this policy.
Keep actual tester identities outside source control. Rotate the epoch for permanent blanket
revocation, including when re-enabling a previously disabled pilot.

Access tokens last at most 300 seconds; refresh families have a seven-day absolute maximum and
cannot outlive usable pilot access. Reuse revokes the family. Tokens are isolated from the spike
protocol and never authenticate other WordPress APIs. Responses, including errors, use `no-store`.
Token and Wallet requests share an atomic 60/minute per-source-IP quota; errors use HTTP 429.
Wallet credentials remain on the server. Existing eligibility, sponsor roles and scan validation
are unchanged.

## Synthetic demo club (0.9.0 / build 13)

The pilot directory includes AWC and Rondo Demo. The demo uses the same read-only protocol with a separately pinned `https://demo.rondo.club/rondo-app/callback`. Client callback validation uses the club from the pending login; a callback from the other club is rejected even if its state matches. Both domains are included in native association declarations and the iOS authentication-session allowlist. The existing AWC client identifier is retained for protocol compatibility; token audiences remain site-specific.

The generated `rondo-demo-pilot` plugin extends the pilot's shared policy implementation. It requires the exact demo origin, demo mode, `RONDO_MOBILE_DEMO === true`, and the separate `rondo_mobile_demo` option with the same explicit tester-pair, expiry and epoch schema. Only an allowlisted subscriber marked as a synthetic review user and linked to the marked fixture parent may authorize. Removing these attributes invalidates current access and refresh requests. The AWC plugin still accepts only AWC and its original opt-in configuration.

The demo presents synthetic household, calendar and QR-pass data. Its Wallet issuers are not configured. The app labels this club as demo data and explains that member edits and duty bookings remain unavailable. The public shared demo login is not automatically granted native access.

The build preparation command emits both isolated plugin packages plus the native project. Install and explicitly enable only the package for the selected site. Publish the generated Apple association file on that site's own `.well-known/apple-app-site-association` path with JSON content type and no redirects. Review credentials belong only in private operator storage and Apple's review fields after native login verification; never put them in the app bundle or repository.
