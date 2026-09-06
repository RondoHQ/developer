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
