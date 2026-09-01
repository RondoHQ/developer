---
title: "Tournament registrations"
---

Rondo manages tournament editions and one shared registration task per selected club team. A
positive registration creates one tournament invoice and a persistent Mollie payment link. The
manager overview also covers external processing, exports and programme distribution.

## Roles and assignment

Administrators and users whose linked person has a current work-history role named exactly
`Coördinator toernooien` can manage tournaments at `/toernooien`. The manager selects club teams
and active team staff who have a Rondo account. Publishing creates one `rondo_tourn_entry` post per
club team, assigns every selected staff account to that shared entry, and sends the initial email.

Assigned staff use `/mijn-toernooien`. Multiple assignees edit the same draft with optimistic
locking, so an outdated browser cannot overwrite a newer version. There is deliberately no decline
or no-participation state: an entry can only remain open or become a positive registration.

## Registration model

One club team can register one or more tournament teams. Every tournament team has its own player
count. One contact name, email address, and mobile number apply to all tournament teams in that
registration. On confirmation, Rondo snapshots the entered teams, player total, applicable price,
and total amount.

Tournament dates and deadlines are entered as calendar dates without a time. The internal deadline
remains open through the end of the selected day. A tournament manager can extend it, but it must
remain in the future and before the organiser's external deadline. Confirmed registrations are
read-only for assigned staff. A manager can reopen an unpaid registration: Rondo archives the old
payment link and invoice, restores the saved team draft, and creates a new invoice after the next
confirmation. Paid registrations cannot be reopened. If payment-link creation fails, the
registration remains valid and both assigned staff and tournament managers can retry the
idempotent payment action.

## Payment

Every submitted entry with a positive total gets one `rondo_invoice` with
`invoice_type=tournament` and an `O` invoice-number prefix. The invoice snapshots the team count,
player count, price, contact, linked person, and the Mollie account selected under
**Finance settings → Mollie → Standard for tournaments**. Changing that global default never moves
an existing invoice to another account.

Assigned staff see **Pay now** while payment is open. The existing verified Mollie webhook marks
the invoice paid; entry responses derive `payment_state` and `paid_at` from that invoice, so the
tournament manager sees the same status without financial permissions. Free registrations expose
`payment_state=not_applicable` and do not create an invoice.

Publishing is blocked until a usable dedicated tournament Mollie account is configured. A
tournament has its own payment deadline and configurable reminder days, defaulting to seven and two
days before that deadline. Confirmation sends the payment link once to every assigned staff member.
The daily scheduler sends each configured reminder moment at most once and skips entries that are
not submitted, have no open link, or are already paid. Managers can also send a manual payment
reminder from the tournament overview.

A tournament manager can delete both draft and published tournaments. Deletion moves the tournament
and every linked team registration to the WordPress trash, so they immediately disappear from the
manager and assignee interfaces. Rondo does not send cancellation messages; the confirmation warns
the manager that they must inform registered teams themselves.

## Manager operations

The published tournament detail has three tabs:

- **Overview** shows authoritative totals for the complete tournament and each age group, the
  internal, payment and organiser deadlines, lifecycle status, external processing status and the
  activity history.
- **Teams and payments** keeps selected teams visible even when they did not submit. Managers can
  filter the table, inspect contacts, payment status and last payment email, recover an open payment,
  send a manual reminder, reopen an unpaid entry and maintain a private planner note.
- **Communication** stores a programme PDF or URL and message. Preview resolves current assigned
  staff and the shared contact of submitted registrations, deduplicates addresses case-insensitively
  and reports invalid addresses. Sending stores the exact subject, message, file or URL, timestamp
  and per-recipient result for later inspection.

External processing is tracked once per tournament as `not_processed`, `submitted` or `confirmed`.
The lifecycle can move from `open` to `closed` or `archived`; archived tournaments are read-only.
The CSV and landscape PDF exports use the same server-side dataset and include tournament metadata,
deadlines, totals, selected teams, submitted counts, contacts, payment state and planner notes.

Operational changes, submissions, payment events, reminders and programme delivery are written as
private tournament activity comments. These comments are available only through the manager API.

## Storage and privacy

Tournament editions use the private `rondo_tournament` post type and team registrations use the
private `rondo_tourn_entry` post type. Both have `show_in_rest: false`; all reads and writes go
through the domain REST controller. Fields use the native Rondo field registry and numbered post
meta for repeaters. The generic WordPress REST API cannot expose either post type.

Entry reads are limited to the assigned accounts and tournament managers. Entry writes are limited
to assigned accounts; retrying payment-link creation is available to assignees and tournament
managers. The assignment stores a snapshot of names, roles, and email addresses plus private
per-user lookup markers for efficient personal task lists.

See [REST API](/api/rest-api/#tournament-registrations) for the endpoints.
