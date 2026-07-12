---
title: Account activation
description: The public self-service flow at /activeren, and the security model that makes email-only activation safe.
---

Members create their own account at **`/activeren`**. No admin action, no mass mailing.
The form tells members to use the same address that receives club newsletters and is used for the
Voetbal.nl app. Client-side email validation messages are explicitly Dutch rather than relying on
the browser locale.

| Route | Does |
|---|---|
| `GET /activeren` | Ask for an email address |
| `POST /activeren` | Mail an activation link, if the address is known |
| `GET /activeren/{token}` | "Who are you?" — the people on that address |
| `POST /activeren/{token}` | Create the account, redirect to set a password |

Logic lives in `Rondo\Users\ActivationService`; `ActivationPage` only routes and renders.

## Why email-only is safe

Parents are not Sportlink members. They have no KNVB-ID and no birthdate on record, so an email
address is the only thing they can be asked for. That would normally be a weak identifier — except:

**Activation never grants access directly. It only ever mails a link to the address already on file.**

Someone who guesses an address learns nothing, because the page answers identically either way, and
receives nothing, because the mail goes to the member. Possession of the mailbox is the credential.

A household mailbox can activate any member on that mailbox. That is intended — it is the family's
own inbox, and it is how a parent activates on behalf of themselves.

:::danger[Never report whether an address was found]
`POST /activeren` renders the same confirmation whether or not anyone matched. Adding a helpful
"no member found with that address" turns the page into a membership oracle for anyone holding a
list of email addresses.
:::

## Tokens

- 32 random bytes, hex-encoded to 64 characters, from `random_bytes()`.
- **Only the SHA-256 is stored** (a transient keyed on the hash), so a database read cannot be
  replayed as a working link.
- Valid for two hours.
- **Burned on use.** One link creates one account. A family activating a second member requests a
  new link — a deliberate trade of convenience for a smaller blast radius if a link is forwarded.

`activate()` re-validates everything at the moment of use rather than trusting the picker page: the
token must still be live, and the person must still match its address, still be active, and still
lack an account. A token for one address cannot activate a person on another.

## Rate limiting

Transient counters, per hour:

| Limiter | Allowance |
|---|---|
| Per email address | 3 requests |
| Per IP | 10 requests |

The IP limiter is what stops enumeration across many addresses from one host. A rate-limited request
renders the normal confirmation — it does not announce that it was throttled.

### Timing

Identical HTML is not enough. Sending the mail costs an API round-trip, so a known address would
answer measurably slower than an unknown one. `ActivationPage` therefore renders the confirmation
and **flushes the response** (`fastcgi_finish_request()` under PHP-FPM) *before* dispatching the
mail. Keep it that way: moving the `wp_mail()` call back above the render silently reopens the
oracle.

## What activation does not do

It does **not** send the welcome email. `provision( $person_id, $send_welcome = false )` skips it:
the member already came from their inbox and is redirected straight to `wp-login.php?action=rp` to
set a password. Only one mail is ever sent.

The second member of a household gets a synthetic `user_email` as usual — see
[user provisioning](/features/user-provisioning/) for how that works and why `ContactEmailRouter`
must exist.

## Who can activate

Any published `person` who is not a `former_member` and does not already have an account. There is
deliberately no requirement to owe a volunteer obligation: a sponsor or a grandparent who wants to
help is not turned away. See [vrijwilligersplicht](/features/vrijwilligersplicht/) for the
distinction between owing a duty and being allowed to volunteer.

A person who already has an account is shown "je hebt al een account" with a link to password reset,
rather than being silently hidden.
