---
title: FreeScout OpenID Connect
---

Rondo Club includes a narrowly scoped OpenID Connect provider for the first-party Rondo Integration FreeScout module. It supports only authorization code flow with PKCE S256 and confidential client authentication.

## Provider endpoints

The issuer is the Rondo Club site URL plus `/oauth`, without a trailing slash. Keeping discovery
below that path avoids collisions with a top-level `.well-known` directory reserved by the host
for certificate validation. Clients should discover the remaining endpoints from:

```text
GET /oauth/.well-known/openid-configuration
```

The advertised endpoints are:

```text
GET  /oauth/authorize
POST /oauth/token
GET  /oauth/userinfo
GET  /oauth/jwks
```

Only `openid`, `email`, and `profile` are supported. `openid` and `email` are required. Authorization requests must include a cryptographically random `state`, an OpenID Connect `nonce`, and a 43-character S256 `code_challenge`. The token endpoint accepts client credentials only through HTTP Basic authentication.

Authorization codes expire after two minutes and are single-use. Access tokens expire after five minutes. Rondo does not issue refresh tokens. ID tokens are signed with RS256; public keys remain in JWKS for a 24-hour overlap after rotation.

## Register a FreeScout client

Client administration is available only to Rondo administrators through the WordPress REST API:

```text
GET  /wp-json/rondo/v1/oidc/clients
POST /wp-json/rondo/v1/oidc/clients
POST /wp-json/rondo/v1/oidc/clients/{client_id}
POST /wp-json/rondo/v1/oidc/clients/{client_id}/rotate-secret
POST /wp-json/rondo/v1/oidc/signing-keys/rotate
```

Create a client with a label, one to five exact callback URLs, and the environment-specific FreeScout base URL:

```json
{
  "label": "FreeScout",
  "redirect_uris": [
    "https://support.example.nl/rondo-login/callback"
  ],
  "freescout_base_url": "https://support.example.nl"
}
```

Both callback and base URLs may include a deployment path prefix. Production URLs must use HTTPS and may not contain credentials, a query, or a fragment.

The create and rotate-secret responses show the raw client secret exactly once. Store it directly in FreeScout's secret configuration. Later list responses expose only `has_client_secret`; Rondo stores a password hash, never the raw secret.

Updating a client can change `label`, `redirect_uris`, `freescout_base_url`, and `enabled`. Disabling a client immediately stops new authorizations, code exchanges, and UserInfo access.

## Eligible identities

An administrator is eligible when the account has an acceptable external email. A normal user additionally needs the `ledenadministratie` capability and a linked, published person record. The capability list can be extended through the `rondo_oidc_freescout_capabilities` filter when another managed mailbox is approved.

Rondo resolves `rondo_contact_email` first and otherwise uses the WordPress account email. Synthetic `@members.rondo.invalid` addresses, addresses inconsistent with the linked person, and addresses shared by another FreeScout-eligible user are rejected.

The stable opaque `sub` is stored once in user meta. It is unrelated to the WordPress user ID, person ID, email, KNVB ID, roles, or capabilities.

## Exact-email verification

Rondo emits `email_verified: true` only when the current resolved address exactly matches these durable user-meta values:

```text
rondo_oidc_verified_email
rondo_oidc_verified_email_at
rondo_oidc_verified_email_method
```

Only a consumed emailed link may create that proof: account activation, Magic Login, a verified primary profile-email change, or the dedicated OIDC verification flow. Password login, account creation, and administrator edits do not qualify. Existing users without proof verify once during their first FreeScout authorization.

The dedicated flow stores only token hashes. Its email contains no OAuth parameters, and consumption rechecks the user, address, uniqueness, client, and exact callback before consent resumes.

## FreeScout recovery boundary

The future Rondo Integration module must keep two independent break-glass paths: `/login?rondo_oauth=0` for one visible local-login attempt and a server-side `RONDO_FORCE_OAUTH_LOGIN` switch that can disable forced Rondo login. These controls belong to FreeScout and do not weaken Rondo's provider validation.

## Storage

The provider uses WordPress-native storage only:

- one non-autoloaded option for client configuration;
- one non-autoloaded option for encrypted RSA private-key material and public overlap keys;
- user meta for the opaque subject and email proof;
- hashed transients for pending requests, verification links, authorization codes, and access tokens;
- short-lived option locks for atomic authorization-code consumption.

No custom database tables are created.
