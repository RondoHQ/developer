---
title: "Role-based dashboard"
---

The dashboard at `/` combines the user's coordinator and match-secretary responsibilities. It does not grant additional access to people, team records or finances. Birthdays are a dashboard block; there is no separate birthday navigation item.

## Blocks and permissions

| Responsibility | Dashboard content |
| --- | --- |
| Year-group coordinator | Own open tasks, upcoming birthdays within existing person visibility, assigned teams and current player counts, today's training, assigned teams' matches and cancellations |
| Match secretary | Own open tasks and the club programme: home/away fixtures, cancellations, time, pitch, dressing rooms and freshness |
| Both | A single combined dashboard, with home/away/own-team filters and deduplicated fixtures |

`RoleDashboard::context()` resolves responsibilities on every request. Coordinator access uses `AccessControl::has_coordinator_team_scope()`; match-secretary access uses the separate `wedstrijdzaken` section capability. Role migration 16 grants that capability to administrators and the existing `rondo_wedstrijdzaken` role. Other custom roles can receive it through the capability matrix. It grants no `teams`, `financieel` or person-access capability.

The `/user/me` response includes `can_access_dashboard`, `dashboard_context` and `can_access_club_dashboard`. Existing broader operational roles retain their previous dashboard. Users eligible for both surfaces can open the previous tools through **Overige overzichten** (`/?overzicht=club`). The legacy and role-dashboard preferences are separate.

### Coordinator scope

Birthdays include today and the following six club-local dates. Each person passes `AccessControl::can_view_person()`, and former members are excluded by the existing reminders source. Person visibility retains the union of allowed age groups and current players in explicitly assigned teams. Birthday links use existing person pages.

Team summaries, training and team-match requests use only `AccessControl::get_permitted_team_ids()`. Household teams are not silently added. An age-group assignment alone does not create team permissions: an administrator must explicitly assign the relevant teams in the existing role configuration.

Player counts exclude former members, historical roles and non-player roles. A person is counted once per team. Shared training blocks return only the permitted team IDs and allowlisted scheduling fields; free-form labels and other teams' names are omitted.

### Tasks

The dashboard returns up to ten open tasks authored by or assigned to the current user, sorted by due date before limiting. Related-person summaries are separately permission checked. Completing or editing a task invalidates both dashboard caches. Activity creation is offered only when the task contains an accessible related person.

## Match data

The window is today through today + 6 days in the WordPress timezone. The club programme reads the existing independently refreshed Sportlink Club.Data cache; team programmes reuse `TeamMatches` and its on-demand cache.

Club fixtures merge programme and cancellation records by match ID, including cancellation-only records. Overlapping team feeds are deduplicated by match ID in the client. Switching match tabs never hides club cancellation alerts from a secretary.

The club feed reports the oldest fetch time and freshness of the programme and cancellation feeds. Old results-feed data does not make this programme stale. Missing or failed sources produce a visible warning rather than a confident empty programme. An empty dressing-room value is **Nog niet ingevuld**; an explicit source value such as **0 - geen kleedkamer** is preserved.

## REST API

All three routes require an authenticated coordinator or the `wedstrijdzaken` capability and return `Cache-Control: no-store, private`.

| Route | Contract |
| --- | --- |
| `GET /rondo/v1/dashboard/workspace` | `context`, `teams`, `birthdays`, `training`, `has_training_schedule`, `pitches`, `today`, `day`, `end_date`, `tasks`, `layout` |
| `GET /rondo/v1/dashboard/matches` | Club programme; additionally requires `wedstrijdzaken` |
| `GET /rondo/v1/dashboard/matches?team_id=123` | Seven-day programme for an explicitly assigned coordinator team; rejects out-of-scope IDs with 403 and invalid IDs with 400 |
| `POST /rondo/v1/dashboard/layout` | JSON object with `order` and `hidden`, arrays of unique available block IDs; invalid preferences receive 400 |

Block IDs are `attention`, `birthdays`, `matches` and `teams`; birthday and team blocks require coordinator context. Preferences live in the user meta `rondo_role_dashboard_layout`. Reads intersect stored IDs with current available blocks and append newly available blocks. Hiding every block is supported. Role revocation removes unavailable data and layout IDs on the next request. Preferences never authorize data access.

## Verification

`RoleDashboardTest` covers role combinations and revocation, record boundaries, birthday visibility, current player counts, shared training, private task relations, match-window boundaries, cancellation freshness and role migration. JavaScript tests cover fixture deduplication, room labels and reordering. `tests/fixtures/dashboard-preview.html` renders the real dashboard with clearly labelled synthetic data for narrow-screen, dark-mode, saved-layout and error-state checks.
