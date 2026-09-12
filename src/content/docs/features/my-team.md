---
title: My Team rosters and contact access
---

The personal **Mijn team** menu opens `/mijn-team`. Current players, trainers, coaches, and team managers see a compact roster with each current player's name and photo. In teams where the logged-in person is only a player, rows show names and photos without contact details, parent information, or an expand control. In teams where that person has a current coaching or team-management role, contact details for players and their linked parents/guardians are collapsed by default; selecting a player row expands them. Multiple rows can remain open. Phone and email links open the corresponding app; the roster has no edit or general person-profile links.

People with multiple current teams switch between tabs built with the shared `TabButton` component used on person profiles. Tabs support arrow keys, Home, and End. A single team shows its name without tabs. Switching teams closes the previous team's contact rows. Photos use a 64-pixel square crop with rounded corners; absent or failed photos show initials, and contact columns stack on mobile.

## Access

`Rondo\Teams\MyTeam::teams_for_user()` resolves the logged-in user's `rondo_linked_person_id` and current `work_history`. The linked person and team must be published, and the person must not be a former member. Roles from `VolunteerStatus::get_player_roles()` grant access to names and photos. Contact access is granted only by Trainer, Coach, Trainer/coach, Hoofdtrainer, Assistent-trainer, Assistent-coach, Assistent-trainer/coach, Leider, Teamleider, and Teammanager (case-insensitive, trimmed). Other staff roles do not grant access.

Permissions are resolved separately for each team as `can_view_contacts`. A person who coaches team A but plays in team B receives contacts only for A, even when a teammate plays in both teams. With both player and coaching assignments in one team, any current eligible coaching assignment grants contact access regardless of assignment order. Expiring that coaching role while retaining a current player role immediately reduces the next response to names and photos. Parent/guardian relationships alone do not add a child's teams to this overview.

Dates override stale `is_current` flags: future starts, expired ends, and malformed dates are excluded. Start and end dates are inclusive in the WordPress timezone. Undated assignments explicitly marked inactive are excluded. Duplicate assignments do not repeat teams or players.

The current-user response includes `has_my_teams`, used by both the menu and route guard. Administrator status alone does not produce a personal roster. This feature grants no new roles or general person access; existing access to other screens remains independently governed by their own permissions.

## Endpoint and data boundary

`GET /wp-json/rondo/v1/my-teams` requires authentication and a current player or coaching assignment. It returns HTTP 401 for anonymous requests and HTTP 403 for users without an eligible team. The endpoint accepts no user, team, or contact-permission selector: scope always comes from the authenticated user. It provides no write methods.

The response is an array of `{ id, name, can_view_contacts, players }` teams. When `can_view_contacts` is false, each player contains exactly `{ id, name, thumbnail }`: email, phone, and parent fields are omitted from the response entirely and are not read for that team's basic roster. When true, each player contains `{ id, name, emails, phones, thumbnail, parents }`, and every parent contains only `{ id, name, emails, phones }`. The frontend also requires `can_view_contacts === true` to render contact controls.

`thumbnail` is the existing WordPress featured image URL at thumbnail size, or `null` when no image is available. It is resolved only after the current-team and player-role checks; parent photos and general media responses are not included. Emails and phone numbers come from the six canonical contact fields. Empty fields are omitted from the arrays, duplicate addresses/numbers are collapsed, and missing contacts are explained in the UI.

Published, non-former players are matched using the configured player roles from `VolunteerStatus::get_player_roles()` and the same date checks as coaching assignments. Parent relationships reuse the existing `VolunteerEligibilityService::find_parents()` resolver. Only published person records qualify as parents; a parent's former-member status does not erase their relationship to an active child. Other relationships are not exposed.

The internal WordPress roster query is independent of household visibility so a plain member can see their team's player identities and, when coaching, contacts. Team assignment and player-role checks precede the appropriate explicit field allowlist. Basic identities and contact-enriched records are kept separate when assembling multiple teams. General person serialization, account lookups, volunteer obligations, signup history, finance fields, and other profile fields are never included.

## Freshness and verification

The endpoint sends `Cache-Control: private, no-store`. A specific NetworkOnly service-worker route precedes generic API caching, so rosters have no offline fallback. The page uses an account-specific query key, discards its cache on unmount, and rechecks on mount, window focus, and network reconnect. A failed recheck hides the previous roster.

`MyTeamTest` covers the exact basic and contact responses, player thumbnails and missing photos, exclusion of parent photos, parent filtering, duplicate assignments and contacts, mixed player/coaching roles, players shared between teams, assignment order, role downgrade, multiple teams, unlinked/anonymous users, excluded staff roles, expired and future assignments, immediate revocation, unpublished records, former members, read-only routing, and attempts to expand scope using request parameters. It also confirms that general person access remains unchanged.

Feedback #11647 is intentionally implemented only as a contact overview. Rondo registration status and volunteer-task registrations are outside this feature.
