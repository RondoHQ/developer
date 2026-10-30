---
title: Account switching
description: Switch between people sharing a confirmed email address, with fresh permissions and safe session handling.
---

You can switch to another person's account when you share the same email address. Open **Wissel van account** at `/wissel-account`. The shared address can be in either email field. You do not need a family link.

The sidebar shows the link when `GET /rondo/v1/user/me` returns `can_switch_accounts: true`. Demo users do not see it. This flag only signals that another eligible person shares an address; it does not grant access or reveal their name.

## Proving mailbox access

Rondo shows names only after you prove access to that exact mailbox. A password login or a contact email alone does not prove this.

Without proof, choose one of your shared email addresses and **Bevestig per e-mail**. The request uses the existing activation rate limits per address and IP. Its named Magic Login button returns to `/wissel-account`. Rondo binds the login token to the address that receives it and uses that binding once, after a valid login. Sending a message alone never proves access.

Mailbox proof remains valid after logout and later password logins, while the address and person-account link stay valid. `rondo_switch_verified_mailbox` user metadata stores the exact normalized email and linked person ID. Proof from the current session can also fill this record. Each use still needs a live WordPress cookie session.

Successful activation also saves this proof. So does exchanging an activation link for an existing parent's login link, or confirming a change to your own primary email. For users without a switcher record, Rondo can reuse dated OIDC email proof stored as `activation`, `profile_email_change` or `oidc_email`. It skips old `magic_login` records: those could assume the primary address without proof of access to the mailbox that received the link.

Proof of a secondary address grants access only through that address. It does not grant access through another mailbox on the same profile. Removing the address clears saved proof and proof in all sessions, even if you restore the address later. Changing the linked person also clears proof. Other contact changes keep proof valid while that address stays linked.

## Switching accounts

The chooser lists eligible published people matching the confirmed address. For an existing account, both the person and user must link to each other. The user must also have the `read` capability. Eligibility follows [account activation](/features/account-activation/), including its former-member exceptions. The lookup includes all matches, without the former twenty-person limit.

**Wisselen** rechecks the source mailbox, target membership, account links and Magic Login rules before it changes the logged-in user. Rondo ends the current session and starts one for the target user with the same expiry. The new account has its own permissions and REST nonce. Switching again does not extend the session.

**Account activeren** opens the existing activation picker for an eligible person without an account. This action creates an activation URL. It does not create an account itself.

After a successful response, the frontend cancels and clears TanStack Query data and deletes the old `api-cache`. It then opens the returned URL. Before switching an existing account, it unregisters the old service worker. The next app startup registers the current worker. A `rondo-account-changed` storage event reloads other open tabs when local storage is available. The [REST session recovery guard](/architecture/frontend/#api-client) also handles requests from an old identity.

All `/wp-json/` responses now use Workbox `NetworkOnly`, preventing private API data from being reused across accounts. Static asset caching remains separate.

## REST API

All routes use `/rondo/v1/user/account-switcher`. They require a logged-in user; switching proof additionally requires a valid cookie session. Use the session's `X-WP-Nonce` for WordPress REST cookie authentication.

| Method | Suffix | Input | Result |
|--------|--------|-------|--------|
| `GET` | none | none | `available`, `verified`, `email`, `emails`, `accounts` |
| `POST` | `/verify` | `email` | `{ "sent": true }` |
| `POST` | `/switch` | positive integer `person_id` | `redirect_url` for the target account |
| `POST` | `/activate` | positive integer `person_id` | `redirect_url` for the activation picker |

Status responses send `Cache-Control: no-store, private`. Each account entry has `person_id`, `name`, `current` and `active`; `accounts` is empty until mailbox proof is valid. `emails` contains the current person's eligible shared addresses.

A denied action returns HTTP 403 `rondo_switch_forbidden`. Verification throttling returns HTTP 429 `rondo_switch_rate_limit`; mail failure returns HTTP 502 `rondo_switch_mail_failed`. Invalid route arguments return HTTP 400, and logged-out requests return HTTP 401.

## Code and tests

`Rondo\Users\AccountSwitcher` owns proof, eligibility and session replacement. `Rondo\REST\AccountSwitcher` registers the routes; `src/pages/AccountSwitcher.jsx` implements the chooser.

`tests/Wpunit/AccountSwitcherTest.php` covers exact primary and secondary mailboxes, persistent confirmation, revocation across sessions, unrelated people and account activation. It also checks target permissions, nonce replacement, unchanged expiry, invalid links, expired sessions, token replay, rate limits, mail failure and more than twenty matches.
