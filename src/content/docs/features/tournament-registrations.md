---
title: "Tournament registrations"
---

Rondo manages tournament editions and one shared registration task per selected club team. A
positive registration now creates one tournament invoice and a persistent Mollie payment link.
Payment reminders, external submission tracking, and programme distribution remain follow-up
milestones.

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
read-only. If payment-link creation fails, the registration remains valid and both assigned staff
and tournament managers can retry the idempotent payment action.

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

A tournament manager can delete both draft and published tournaments. Deletion moves the tournament
and every linked team registration to the WordPress trash, so they immediately disappear from the
manager and assignee interfaces. Rondo does not send cancellation messages; the confirmation warns
the manager that they must inform registered teams themselves.

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
