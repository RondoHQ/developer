---
title: My Team contact rosters
---

The personal **Mijn team** menu opens `/mijn-team`. Trainers, coaches, and team managers see their current players and the email addresses and telephone numbers of those players and their linked parents/guardians. People with multiple current teams can select a team. Contact links open the mail or phone app; the roster has no edit or general person-profile links.

## Access

`Rondo\Teams\MyTeam::teams_for_user()` resolves the logged-in user's `rondo_linked_person_id` and current `work_history`. The linked person and team must be published, and the person must not be a former member. Eligible roles (case-insensitive, trimmed) are Trainer, Coach, Trainer/coach, Hoofdtrainer, Assistent-trainer, Assistent-coach, Assistent-trainer/coach, Leider, Teamleider, and Teammanager. Other staff and player roles do not grant contact access.

Dates override stale `is_current` flags: future starts, expired ends, and malformed dates are excluded. Start and end dates are inclusive in the WordPress timezone. Undated team assignments count as current. Duplicate assignments do not repeat teams or players.

The current-user response includes `has_my_teams`, used by both the menu and route guard. Administrator status alone does not produce a personal roster. This feature grants no new roles or general person access; existing access to other screens remains independently governed by their own permissions.

## Endpoint and data boundary

`GET /wp-json/rondo/v1/my-teams` requires authentication and a current coaching assignment. It returns HTTP 401 for anonymous requests and HTTP 403 for users without an eligible team. The endpoint accepts no user or team selector: scope always comes from the authenticated user. It provides no write methods.

The response is an array of `{ id, name, players }` teams. Every player contains only `{ id, name, emails, phones, parents }`; every parent contains only `{ id, name, emails, phones }`. Emails and phone numbers come from the six canonical contact fields. Empty fields are omitted from the arrays, duplicate addresses/numbers are collapsed, and missing contacts are explained in the UI.

Published, non-former players are matched using the configured player roles from `VolunteerStatus::get_player_roles()` and the same date checks as coaching assignments. Parent relationships reuse the existing `VolunteerEligibilityService::find_parents()` resolver. Only published person records qualify as parents; a parent's former-member status does not erase their relationship to an active child. Other relationships are not exposed.

The internal WordPress roster query is independent of household visibility so a plain member who coaches can see their team's contacts. Team assignment and player-role checks precede the explicit contact allowlist. General person serialization, account lookups, volunteer obligations, signup history, finance fields, and other profile fields are never included.

## Freshness and verification

The endpoint sends `Cache-Control: private, no-store`. A specific NetworkOnly service-worker route precedes generic API caching, so rosters have no offline fallback. The page uses an account-specific query key, discards its cache on unmount, and rechecks on mount, window focus, and network reconnect. A failed recheck hides the previous roster.

`MyTeamTest` covers the exact contact response, parent filtering, duplicate assignments and contacts, multiple teams, unlinked/anonymous users, excluded staff roles, expired and future assignments, immediate revocation, unpublished records, former members, read-only routing, and attempts to expand scope using request parameters. It also confirms that general person access remains unchanged.

Feedback #11647 is intentionally implemented only as a contact overview. Rondo registration status and volunteer-task registrations are outside this feature.
