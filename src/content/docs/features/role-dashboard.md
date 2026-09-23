---
title: "Role-based dashboard"
---

The dashboard at `/` combines the user's board, coordinator and match-secretary responsibilities. It does not grant additional access to people, team records or finances. Birthdays are a dashboard block; there is no separate birthday navigation item.

## Blocks and permissions

| Responsibility | Dashboard content |
| --- | --- |
| Board | Birthdays, membership anniversaries, season membership changes, volunteer shortages in the next 30 days, VOG attention counts and personal tasks |
| Year-group coordinator | Own open tasks, upcoming birthdays within existing person visibility, assigned teams and current player counts, today's training, assigned teams' matches and cancellations |
| Match secretary | Own open tasks and the club programme: home/away fixtures, cancellations, time, pitch, dressing rooms and freshness |
| Multiple roles | A single combined dashboard, with home/away/own-team filters and deduplicated fixtures |

`RoleDashboard::context()` resolves responsibilities on every request. Coordinator access uses `AccessControl::has_coordinator_team_scope()`; match-secretary access uses the separate `wedstrijdzaken` section capability. Role migration 16 grants that capability to administrators and the existing `rondo_wedstrijdzaken` role. Other custom roles can receive it through the capability matrix. It grants no `teams`, `financieel` or person-access capability.

The `/user/me` response includes `can_access_dashboard`, `dashboard_context` and `can_access_club_dashboard`. Existing broader operational roles retain their previous dashboard. Users eligible for both surfaces can open the previous tools through **Overige overzichten** (`/?overzicht=club`). The legacy and role-dashboard preferences are separate.

### Board scope

The exact `rondo_bestuur` role enables board context; management capabilities alone do not imply that role. Role migration 17 grants the existing `jubilarissen` section capability to the board role. It adds no financial or person-record permissions. A second coordinator role remains recognized even when board permissions bypass age-group filtering.

The default block order is birthdays, anniversaries, personal tasks, membership, volunteers and VOG. Match and team blocks are added only for the corresponding additional roles. Birthdays and tasks are never duplicated. Existing saved layouts are retained; new available blocks are appended. The board heading is **Bestuursdashboard**.

- Birthdays reuse the seven-day source and person visibility. Six are shown initially; **Toon alle verjaardagen** reveals the rest.
- Anniversaries require `jubilarissen` and include membership milestones from today through day 89. Native compact and ISO membership dates are both supported. The six earliest are shown, with a link to the existing anniversary page. Volunteer milestones are not mixed into this block.
- Membership requires `ledenadministratie`. All three figures count only playing association members: `type_lid` is `Bondslid` (or `Oud bondslid` for historical season events) and `spelactiviteit` is neither empty nor `-`. The block labels this scope as **Alleen spelende bondsleden**. The current total requires `Bondslid` and excludes former members, future membership starts and ended membership dates. Instroom and uitstroom use `lid_sinds` and `lid_tot` from 1 July through today inclusive, including former playing association members for departures. Classification uses the available person fields; it does not reconstruct missing historical playing activity. Season departures of association members with empty or `-` activity are reported in `membership.left_unknown`; they do not inflate the confirmed outflow, and the UI labels that total incomplete with the excluded count. Future departures are not counted yet. These are date-based current records, not a historical snapshot or a net-growth calculation.
- Volunteer shortages require `vrijwilligers`. Only future published, open/full-status shifts with unfilled capacity within 30 days count. Cancelled, completed, past, full and invalid assignments are excluded; duplicate assignments count once. Totals are calculated before the displayed list is limited. No volunteer names are returned. The lightweight `VolunteerStatistics::upcoming_shortages()` reuses the existing shortage rules without calculating the full season statistics.
- VOG requires `vog`. Counts cover visible current volunteers only, excluding former members, and distinguish missing/expired not yet requested, missing/expired requested at Justis, and expiring within 30 days. Native dates pass through the field formatter before comparison. The legacy dashboard reuses the same counting service.

Revoking a section capability removes its data and saved layout IDs on the next request. The dashboard grants no access through a preference or hidden block.

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

Workspace and layout routes require an authenticated board member, coordinator or the `wedstrijdzaken` capability; match routes retain their separate role checks. All routes return `Cache-Control: no-store, private`.

| Route | Contract |
| --- | --- |
| `GET /rondo/v1/dashboard/workspace` | `context`, `teams`, `birthdays`, `training`, `has_training_schedule`, `pitches`, `today`, `day`, `end_date`, `tasks`, `layout`, plus permission-gated board fields `anniversaries`, `membership`, `volunteers`, `vog` |
| `GET /rondo/v1/dashboard/matches` | Club programme; additionally requires `wedstrijdzaken` |
| `GET /rondo/v1/dashboard/matches?team_id=123` | Seven-day programme for an explicitly assigned coordinator team; rejects out-of-scope IDs with 403 and invalid IDs with 400 |
| `POST /rondo/v1/dashboard/layout` | JSON object with `order` and `hidden`, arrays of unique available block IDs; invalid preferences receive 400 |

Block IDs are `attention`, `birthdays`, `anniversaries`, `membership`, `volunteers`, `vog`, `matches` and `teams`; availability follows the role and section checks above. The layout response includes `defaults` for the role-specific reset order; writes still accept only `order` and `hidden`. Preferences live in the user meta `rondo_role_dashboard_layout`. Reads intersect stored IDs with current available blocks and append newly available blocks. Hiding every block is supported. Role revocation removes unavailable data and layout IDs on the next request. Preferences never authorize data access.

## Verification

`BoardDashboardTest` covers board role combinations, capability revocation, membership and anniversary date boundaries, VOG dates and shortage totals. `RoleDashboardTest` covers role combinations and revocation, record boundaries, birthday visibility, current player counts, shared training, private task relations, match-window boundaries, cancellation freshness and role migration. JavaScript tests cover fixture deduplication, room labels and reordering. `tests/fixtures/dashboard-preview.html` renders the real dashboard with clearly labelled synthetic data for narrow-screen, dark-mode, saved-layout and error-state checks.
