---
title: Account activation
description: The public self-service flow at /activeren, and the security model that makes email-only activation safe.
---

Members create their own account at **`/activeren`**. No admin action, no mass mailing.
The form tells members to use the same address that receives club newsletters and is used for the
Voetbal.nl app. Client-side email validation messages are explicitly Dutch rather than relying on
the browser locale.

Activation mail uses an explicit `From` header for `ledenadministratie@svawc.nl`. Keep this scoped
to `ActivationService::send_activation_email()` so other transactional mail retains its configured
sender. The confirmation page tells members to search their spam folder for that address.

The public page publishes a 1200×630 Open Graph image from
`public/images/og-account-activation.png`. `ActivationPage` passes that image to the shared
`PublicPageChrome` header, which emits the Open Graph and Twitter Card image metadata.

| Route | Does |
|---|---|
| `GET /activeren` | Ask for an email address |
| `POST /activeren` | Mail an activation or Magic Login link, if the address is known |
| `GET /activeren/{token}` | "Who are you?" — the people on that address |
| `POST /activeren/{token}` | Create the account, redirect to set a password |

Logic lives in `Rondo\Users\ActivationService`; `ActivationPage` only routes and renders.

Former members are normally excluded from activation. There are two role-based exceptions:

- a former member with a published, non-former child relationship;
- a former member who is an active sponsor contact.

Their membership record remains read-only, but their current parent, guardian, or sponsor role still
needs an account. `ActivationService::is_person_activatable()` is the shared eligibility check for
public activation and the administrator's provisionable-person picker.

## Parents activating through a child

For every JO16- person in the identity picker, the activation page also offers **“Ik ben
ouder/verzorger van …”**. The parent enters their own full name. Rondo uses the address proven by
the activation token and resolves the identity in this order:

1. A parent already linked to the child with that e-mail address is used immediately. If multiple
   linked parents share the address, the entered name disambiguates them.
2. An existing person on the address whose name matches is linked as the parent, provided the child
   still has a Sportlink parent slot.
3. If no person matches and a slot is free, Rondo creates the parent person with the entered name and
   proven e-mail address, links it to the child, and marks the Sportlink parent sync as pending.

The WordPress account is provisioned directly against the resolved or newly created parent. If that
parent already has a WordPress account, the activation link is exchanged for a one-time Magic Login
URL instead. The child never receives the account in these successful automatic paths.

When automatic parent linking is not safe or possible — for example because both parent slots are
already occupied — Rondo preserves the previous fallback: it creates the account against the child
and stores a temporary guardian claim. This lets the parent continue while membership administration
resolves the identity manually.

The claim is visible under **Settings → Beheer → Gebruikers**. It does not send a notification
email. An existing child-linked account can start the same flow from `/vrijwillig`; this covers
parents who activated before the guardian picker existed.

For a fallback claim, the account stays linked to the child until an administrator selects
**Accountkoppeling wijzigen**. That action moves the user link to the synced parent, refreshes the
user's name, KNVB ID and capabilities, and clears the temporary guardian claim. A target person that
already has an account cannot be selected.

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
- A second transient retains only the token hash, matched email, eligible person IDs, and consumed
  state for seven days. This lets administrators diagnose a genuine expired or reused link without
  storing the raw token. Random or guessed token URLs have no context and are never logged.

`activate()` re-validates everything at the moment of use rather than trusting the picker page: the
token must still be live, and the person must still match its address, still be active or have a
current parent or sponsor role, and still lack an account. A token for one address cannot activate a
person on another.

## Activation error log

Administrators see the 50 most recent attributable failures under **Settings → Beheer → Gebruikers →
Mislukte accountactivaties**. Entries contain the time, matched people, proven email address, stable
error code, and operator-facing message. The underlying private `rondo_activation_log` posts are
retained for 12 months.

Failures include expired or reused genuine activation links, provisioning errors, invalid choices,
and activation-email delivery failures. Repeated refreshes of the same token and error are deduplicated
for one hour. Unknown token URLs are excluded to prevent bot traffic from filling the log.

## Rate limiting

Transient counters, per hour:

| Limiter | Allowance |
|---|---|
| Per email address | 3 requests |
| Per IP | 10 requests |

The IP limiter is what stops enumeration across many addresses from one host. A rate-limited request
renders the normal confirmation — it does not announce that it was throttled.

## Existing accounts and Magic Login

`MagicLoginActivation` turns the Magic Login email form into the normal entry point for both login
and first-time activation. It intercepts the plugin only after its CAPTCHA, honeypot, and per-user
send safeguards have passed, and then applies the activation service's stricter per-address and
per-IP rate limits.

The email address determines the next step:

| Matching records | Result |
|---|---|
| One non-youth person without an account | Provision the linked WordPress account and send a Magic Login link |
| One youth person without an account | Send the activation link so the recipient can choose member or guardian |
| Multiple people without accounts | Send the activation link and identity picker |
| Existing accounts only | Send one branded email with a named Magic Login button per account |
| Existing and unactivated people | Send one combined email with named login buttons and an activation button |
| Unknown address, or former member without a current parent or sponsor role | Send nothing |

The plugin remains responsible for Magic Login token creation, validity, and authentication. Rondo
never uses the plugin's generic registration feature because that would bypass person linking,
household identities, guardian handling, and role provisioning.

Every valid email submission receives the same neutral confirmation, including unknown and
rate-limited addresses. This removes the old “account does not exist” membership oracle.

### Timing

Identical HTML is not enough. Sending the mail costs an API round-trip, so a known address would
answer measurably slower than an unknown one. `ActivationPage` renders its confirmation and flushes
the response before dispatching mail. `MagicLoginActivation` similarly queues the submitted address
until WordPress shutdown, calls `fastcgi_finish_request()` under PHP-FPM, and only then performs the
person lookup, provisioning, and mail work. Keep mail and conditional lookup after that response
boundary: moving either above it silently reopens the oracle.

## What activation does not do

It does **not** send the welcome email. `provision( $person_id, $send_welcome = false )` skips it:
the member already came from their inbox and is redirected straight to `wp-login.php?action=rp` to
set a password. Only one mail is ever sent.

The second member of a household gets a synthetic `user_email` as usual — see
[user provisioning](/features/user-provisioning/) for how that works and why `ContactEmailRouter`
must exist.

## Who can activate

Any contactable published `person` who does not already have an account and is active, a current
parent, or an active sponsor contact. Former-member profiles remain read-only after account creation.
There is deliberately no requirement to owe a volunteer obligation: a sponsor or a grandparent who
wants to help is not turned away. See [vrijwilligersplicht](/features/vrijwilligersplicht/) for the
distinction between owing a duty and being allowed to volunteer.

A person who already has an account is shown "je hebt al een account" with a link to password reset,
rather than being silently hidden.
