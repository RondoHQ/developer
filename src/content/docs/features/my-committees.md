---
title: My Committees rosters and chairperson contact access
---

The personal **Mijn commissies** menu opens `/mijn-commissies`. It shows each of the signed-in person's current committees, with member counts, names, photos and unique current roles. Committees and members are sorted by name. Only a current chairperson of that particular committee can expand member contact details. Phone and email links open the corresponding app; mobile numbers have WhatsApp links. Committee rows contain no parent/guardian contacts, edit controls or general person-profile links.

## Membership and contact permissions

`Rondo\Commissies\MyCommittees::committees_for_user()` resolves only the user's own `rondo_linked_person_id`. The linked person must be published and not a former member. A qualifying `work_history` row needs a nonempty, trimmed `job_title` and a published `commissie` in its `team` relation. Child or other household memberships do not qualify, and an administrator role alone grants no personal roster.

The Sportlink container named **Verenigingsbreed** is excluded after decoding the title, trimming whitespace and comparing case-insensitively. Club-wide roles, including Voorzitter in that container, grant neither a personal committee nor contacts in another committee.

`RosterPerson::is_current_position()` supplies the same date rules as [Mijn team](/features/my-team/): future starts, expired ends and malformed dates are excluded; start and end dates are inclusive in the WordPress timezone. An explicitly inactive assignment with no end date is excluded. Explicit dates take precedence over stale status flags.

Contact access requires the exact role **Voorzitter**, case-insensitive and trimmed, in that committee. Vicevoorzitter and chairmanship in a team do not qualify. Multiple assignments combine contact permission within the same committee. Ending the chairperson role while retaining a current member role removes contacts from the next response; ending all qualifying memberships removes access entirely. The current-user flag `has_my_committees` controls both sidebar visibility and the `CapabilityRoute` guard.

This personal roster is independent of the `commissies` capability for the full committee directory. It grants no new WordPress roles, general person access or access to other committee records.

## Endpoint and data boundary

`GET /wp-json/rondo/v1/my-committees` is read-only. It returns HTTP 401 for anonymous requests and HTTP 403 without a qualifying own committee membership. Scope comes from the authenticated user; `user_id`, `person_id` and `committee_id` query parameters cannot expand it.

Each response entry contains `{ id, name, can_view_contacts, members }`. Basic members contain exactly `{ id, name, thumbnail, roles }`. For a committee whose `can_view_contacts` is true, members also contain `emails`, `phones` and `mobile_phones`. Basic rosters omit contact keys entirely and do not read those fields. Permissions are evaluated per committee, including when the same person appears in several committees.

`RosterPerson` builds names from `first_name`, `infix` and `last_name`, falling back to the decoded post title. Its contact allowlist reads only `email_1`, `email_2`, `mobile_1`, `mobile_2`, `telephone_1` and `telephone_2`. Empty values are skipped, duplicate addresses and normalized numbers are collapsed, and `mobile_phones` identifies numbers from the mobile fields. `thumbnail` is the featured image's thumbnail URL or `null`.

Only published, non-former people with a current nonempty role in one of the authorized committees are returned. Duplicate memberships produce one member with unique roles. The internal roster query runs after resolving the caller's memberships and uses these explicit projections rather than general person serialization. Account, finance, household and other profile fields are excluded.

## Shared presentation and freshness

`src/components/RosterMemberCard.jsx` serves both Mijn team and Mijn commissies. Committee cards pass `contactLabel="Commissielid"` and `showParents={false}`. Contact rows start collapsed; multiple rows may remain open. Missing or failed photos use initials, and contact columns stack on mobile.

The endpoint sends `Cache-Control: private, no-store`; its service-worker route is NetworkOnly and precedes generic API caching. The account-specific query `['my-committees', user.id]` has zero stale and garbage-collection time, rechecks on mount, window focus and reconnect, and polls every 60 seconds. It uses `networkMode: 'always'` and disables automatic retries. A failed request hides the previous roster and offers **Opnieuw proberen**; a 403 explains that current committee access has ended. There is no offline roster fallback.

## Source verification

`tests/Wpunit/MyCommitteesTest.php` covers exact response keys, contact and role deduplication, per-committee permission isolation, date/status exclusions, inclusive end dates, chairperson downgrade and membership revocation, former/unpublished people, anonymous and unlinked users, request-parameter scope, read-only routing, unchanged general person access, exact chairperson roles, administrator/team-role non-grants, and the Verenigingsbreed exclusion.
