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

An administrator is eligible when the account has an acceptable external email. A normal user additionally needs the `ledenadministratie` or `financieel` capability and a linked, published person record. `financieel_read` alone does not qualify, because that role may not receive access to the Contributie mailbox. The capability list can be extended through the `rondo_oidc_freescout_capabilities` filter when another managed mailbox is approved.

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

## Signed FreeScout services

The Rondo Integration module calls four public REST routes that authenticate the exact raw JSON
body with HMAC-SHA256 before parsing it or reading person data:

```text
POST /wp-json/rondo/v1/integrations/freescout/configuration
POST /wp-json/rondo/v1/integrations/freescout/access
POST /wp-json/rondo/v1/integrations/freescout/sidebar
POST /wp-json/rondo/v1/integrations/freescout/activity
```

Set the same random value of at least 32 characters in FreeScout and in Rondo server configuration
as `RONDO_FREESCOUT_SIGNING_KEY`. During rotation, Rondo may temporarily accept the old value from
`RONDO_FREESCOUT_SIGNING_KEY_PREVIOUS`. Never expose either value to browser code, an API response,
application logs, or source control.

Each request carries `X-Rondo-Timestamp`, a one-time `X-Rondo-Nonce`, and
`X-Rondo-Signature: v1=<hex HMAC-SHA256>`. Rondo signs the timestamp, nonce, and exact raw body,
separated by newlines. Requests outside the five-minute clock window and reused nonces are denied.
Production requests require HTTPS.

The configuration service advertises the generic `basis.v1` sidebar policy plus the closed
managed-access mappings `ledenadministratie` and `contributie`. It accepts only a FreeScout base
URL belonging to an enabled OIDC client. The access service resolves the exact issuer and opaque
subject, then checks the user's current capability for each managed mapping. `freescoutUserId` is `null` during the
pre-binding access check and a positive integer after a local user exists. It is used only for
audit correlation; access is always resolved from the signed issuer and subject, never from the
local ID or an email address.

FreeScout administrators select independently in which active mailboxes the sidebar appears; this
never grants mailbox access. An unmapped selected mailbox requests `basis.v1`, while active managed
mappings retain their dedicated policy. The sidebar matches normalized customer addresses exactly
against `email_1` and `email_2`, applies the effective Rondo user's normal person visibility, and
returns escaped, script-free markup. When a shared address belongs to multiple accessible profiles,
the iframe presents a profile selector and one complete profile card at a time. The selector
contains no inaccessible profiles. Malformed and synthetic addresses are ignored, and inaccessible
records look identical to no match. Membership, contact, household, action, volunteer-signup, and
visible open-task summaries exclude VOG, notes, full work history, FreeScout IDs, user IDs, digital
pass details, and wallet action URLs. Current teams and visible household relations link to their
Rondo records. Mobile numbers receive a WhatsApp action only when they normalize to a valid
8-to-15-digit international number; addresses render as street plus house number followed by postal
code and city. Open contribution invoices appear only under the Ledenadministratie and Contributie
policies and only when the exact bound user has `financieel_read` or `financieel`. Their aggregate
open amount is shown once, each invoice number links to its Rondo invoice, and invoice amount,
installment state, and due date render as separate rows.

When an incoming email's sender shares an exact domain with a primary or alias address of the
active mailbox, the module removes the sender and every primary or alias address of that mailbox
from its `To` recipients. When exactly one eligible recipient remains and that address already
belongs to a FreeScout customer, the module makes that customer the conversation customer before
FreeScout renders or records the conversation. It removes the new primary customer from CC and
keeps the actual internal sender on CC. This aligns FreeScout's native customer header and previous
conversations with the Rondo card without losing the colleague from reply routing. The module does
not create customers, does not change a conversation with zero or multiple eligible recipients,
and applies this behavior only to mailboxes where the Rondo sidebar is enabled. Subdomains do not
count as the same domain.

The sidebar and activity delivery continue to derive their match from the first published incoming
email using the same recipient filter. An existing conversation created before this behavior was
installed can be inspected and repaired individually. The first command only previews the result:

```sh
php artisan rondo:reconcile-conversation-customer 123
php artisan rondo:reconcile-conversation-customer 123 --apply
```

The repair refuses non-sidebar mailboxes, missing customers, and ambiguous recipients. Applying a
change queues the normal customer-change activity so existing Rondo pointers are reconciled too.

For a conversation whose exact subject is `Overschrijvingsverzoek`, the FreeScout module also
checks that the first published incoming email comes from
`no-reply@sportlinkservices.nl`. It parses that message locally for exactly one table row labelled
`Relatiecode`, validates the value as a KNVB ID, and sends only this minimal signed person reference
to Rondo. The message HTML and its other personal fields never leave FreeScout. Rondo gives this
reference precedence over the shared sender address, matches it exactly against the canonical
`knvb-id` person field, and applies the same uniqueness and effective-user visibility rules as the
email matcher. Missing, invalid, conflicting, or inapplicable references fall back to normal
customer-email matching.

The sidebar presents this data as a compact member card with status badges and separate tabs for
membership, contact, and actions. Open contribution remains visible as an action block above the
tabs. The action area ends with **Open in Rondo** and, when a valid KNVB ID is available, **Open in
Sportlink** for users with `ledenadministratie` or `financieel`. That external URL is restricted
to `https://club.sportlink.com/member/member-details/{KNVB-ID}/general`; the FreeScout module
rejects other external destinations. Rondo returns no JavaScript: the sandboxed FreeScout module
owns the constrained profile and tab controls and applies the administrator-configured club
accent colors.

The activity service uses the same internal-sender recipient selection in integration scope. It stores one native
`rondo_activity` comment for the conversation start and one for every published incoming or sent
reply. The configured FreeScout instance, conversation ID, event type, and immutable reply thread
ID form the idempotency key. Explicit customer changes move, hide, or restore all pointers for the
conversation together.

Reply events contain direction, subject, timestamp, and a server-generated conversation link, but
never message text, attachments, or agent email. Only the selected matching email addresses are
sent; unrelated recipients and mailbox addresses are excluded. For a sent reply, FreeScout may send
the local user ID plus the issuer and opaque subject from its existing Rondo binding. Rondo resolves
the author locally, so a FreeScout-supplied display name is never trusted or stored.

The signed configuration response publishes an installation-level audit retention period from 90
through 730 days. Rondo resolves it from `RONDO_AUDIT_RETENTION_DAYS`, then the
`freescout_audit_retention_days` WordPress option, then the 365-day default. An invalid environment
value blocks configuration; an environment value also locks the Rondo settings field.

## FreeScout recovery boundary

The Rondo Integration module keeps two independent break-glass paths: `/login?rondo_oauth=0` for one visible local-login attempt and a server-side `RONDO_FORCE_OAUTH_LOGIN` switch that can disable forced Rondo login. These controls belong to FreeScout and do not weaken Rondo's provider validation.

## Storage

The provider uses WordPress-native storage only:

- one non-autoloaded option for client configuration;
- one non-autoloaded option for encrypted RSA private-key material and public overlap keys;
- user meta for the opaque subject and email proof;
- hashed transients for pending requests, verification links, authorization codes, and access tokens;
- short-lived option locks for atomic authorization-code consumption.

No custom database tables are created.
