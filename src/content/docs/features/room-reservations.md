---
title: "Room reservations and presentation access"
---

Rondo Club stores rooms and reservations as private WordPress posts with native field-registry post
meta. Members can inspect availability, but can reserve only for a commissie or year group for which
their linked person currently has a qualifying volunteer position. Player positions do not qualify.

## Feature toggle

Ruimtes uses the site-wide three-state feature toggle and defaults to `off`. `admin_only` lets
administrators configure rooms while the navigation, pages, and REST routes remain unavailable to
other users. Existing rooms and bookings remain stored in every state. See [Feature toggles](./feature-toggles/).

## Roles and permissions

Every signed-in user can read safe availability. The booking-context endpoint derives eligible
commissies from current `work_history` positions and year groups from the canonical
`leeftijdsgroep` values of current players in the volunteer's team. Submitted context IDs are
validated against that server-derived result on every create or context change.

The `accommodatiebeheer` capability and built-in `rondo_accommodatiebeheerder` role grant the
operational day/week overview and management actions. A manager may book for another user only when
that holder qualifies for the selected context. A holderless `management_block` is the explicit
exception. Administrators additionally configure and archive rooms.

## Data model

`rondo_room` stores member-facing room details, facilities, weekly opening windows, duration and
advance limits, conflict buffer, extension increment, and an optional `rondo_display` relation.
`rondo_room_booking` stores the canonical interval, holder, context snapshot, authorized presenters,
status, attribution, cancellation details, and live extension. Neither post type is exposed through
the core WordPress REST API or admin UI.

Booking creation and interval changes use a short room-specific Options API lock. Conflict checks
use half-open intervals and include the room's changeover buffer. Cancelled bookings remain stored.
Immutable activity entries use a dedicated WordPress comment type and contain actor, action, changed
fields, timestamp, and an optional cancellation reason.

## Presentation entitlement

When a room links to a display and enables reservation-controlled presentation, the display receives
only safe room state and creates a code during the active access window. The join route requires both
the visible code and a signed-in holder, explicitly authorized presenter, accommodation manager, or
administrator. Session tokens expire no later than the effective booking end.

Every signaling request rechecks the current booking. Cancellation, a manager stop action, or the
effective end removes the session and returns the receiver to Club TV. A successful extension moves
the session boundary after the same locked room-conflict check.

## REST API

All booking routes use `/wp-json/rondo/v1/rooms`.

| Route | Permission | Purpose |
|---|---|---|
| `GET /rooms` | Signed-in user | List safe room configuration |
| `GET /rooms/availability` | Signed-in user | List occupied intervals without holder or purpose |
| `GET /rooms/booking-contexts` | Signed-in user | List the current user's eligible contexts |
| `GET /rooms/bookings/mine` | Signed-in user | List the current user's full history |
| `POST /rooms/bookings` | Signed-in user | Create an eligible own reservation |
| `GET`, `POST /rooms/bookings/{id}` | Holder, presenter, or manager as appropriate | Read or edit a booking |
| `POST /rooms/bookings/{id}/cancel` | Holder or manager | Retain and cancel a booking |
| `POST /rooms/bookings/{id}/extend` | Holder or manager | Extend an active free slot |
| `GET /rooms/bookings/{id}/calendar` | Holder, presenter, or manager | Download an iCalendar event |
| `GET`, `POST /rooms/manage/bookings` | Accommodation manager | Read or create operational bookings |
| `GET /rooms/manage/booking-contexts` | Accommodation manager | Derive contexts for a selected holder |
| `POST /rooms/manage/bookings/{id}/presentation` | Accommodation manager | Start, stop, or reset presentation access |
| `GET /rooms/bookings/{id}/activity` | Accommodation manager | Read immutable activity history |
| `GET /rooms/manage/config` | Administrator | List assignable displays |
| `POST /rooms/manage/rooms` | Administrator | Create a room |
| `POST /rooms/manage/rooms/{id}` | Administrator | Update or archive a room |

The existing narrowcasting presentation routes retain their paths, but controlled displays now bind
codes, sender tokens, and signaling to the active booking.

## Notifications and testing

Creation, edits, cancellation, and extensions send the holder a branded email. Newly added
presenters receive the room and time. A missing contact email does not block the write and is returned
as a UI warning.

`tests/Wpunit/RoomBookingsTest.php` covers commission eligibility, player exclusion, roster-derived
year groups, privacy, conflicts, management blocks, audit entries, and controlled-display access.
`tests/js/roomUtils.test.mjs` covers context serialization and local calendar grouping.
