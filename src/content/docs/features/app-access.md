---
title: Shared app access
---

The **App access** page at `/app-toegang` lets board members add the shared
Laposta account to their authenticator app. It does not change Rondo login.

## Access

Only users with the exact `rondo_bestuur` role and administrators with
`manage_options` can open the page or reveal its QR code. Other staff roles do
not gain access through overlapping capabilities. Every API request checks
the current user's access. The current-user response exposes the non-secret
`can_access_app_access` flag for the route and sidebar.

Only administrators can save, replace or remove the configuration. The
administrator form lives on the same page and never pre-fills the saved secret.
Board members see an actionable empty state until an administrator configures it.

## Configure Laposta

1. Open **App access** as an administrator.
2. Paste the complete `otpauth://totp/` provisioning URI from the Laposta
   one-time-password field in 1Password into **Authenticator-URL**.
3. Save, then select **QR-code tonen** and scan with an authenticator app.

Use the provisioning URI, not an `op://` secret reference or a rotating login
code. The URI must identify Laposta in both the label prefix and issuer, contain
a Base32 secret, and use supported TOTP parameters. Unknown or duplicate
parameters, HOTP URIs, fragments and malformed input are rejected without
echoing the submitted secret. Optional SHA1/SHA256/SHA512, 6/8 digits and periods
of 1–300 seconds are preserved. The format follows the
[Google Authenticator key URI specification](https://github.com/google/google-authenticator/wiki/Key-Uri-Format).

**Removing Rondo access does not revoke an authenticator already enrolled.**
Replace the shared authenticator secret in Laposta and update Rondo when that
access must end. Removing the configuration from Rondo only stops further
enrollment through this page.

## Storage and display

`Rondo\Security\AppAccess` stores the URI using the existing
`CredentialEncryption` service in the non-autoloaded WordPress option
`rondo_laposta_authenticator_encrypted`. Unencrypted or unreadable values fail
closed. Keep the existing deployment encryption key stable.

The status endpoint returns only whether configuration is valid and the account
label. Only an explicit reveal request returns provisioning material. The
browser generates the QR locally with the existing `qrcode` dependency, without
a third-party QR service or public image upload. The secret is not put in the
TanStack Query cache or browser storage. The QR is removed after two minutes,
when the tab is hidden, or when the page is unmounted. Pending reveal requests
are cancelled on hide/unmount.

All API responses, including errors, use `Cache-Control: private, no-store,
max-age=0`. The service worker excludes this API family from offline caching;
the reveal operation also uses POST so older GET-only caches cannot store it.

## API

| Method and route | Access | Response |
| --- | --- | --- |
| `GET /rondo/v1/app-access/laposta` | Bestuur or administrator | `configured` and `account` |
| `PUT /rondo/v1/app-access/laposta` | Administrator | Save JSON body `{ "uri": "…" }`; return status only |
| `DELETE /rondo/v1/app-access/laposta` | Administrator | Remove the saved configuration; return status |
| `POST /rondo/v1/app-access/laposta/reveal` | Bestuur or administrator | `{ "uri": "…" }`, or 404 when unavailable |

Use normal authenticated REST requests with the WordPress REST nonce. Never
place provisioning material in request URLs, logs, documentation or tickets.

## Verification

`tests/Wpunit/AppAccessTest.php` verifies encrypted/non-autoloaded storage,
non-secret status/save responses, the role and administrator permission matrix,
immediate denial after board-role removal, no-store headers, invalid URI
rejection, preserved optional parameters, and missing/removed/corrupt storage.
