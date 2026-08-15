---
title: "Narrowcasting and Rondo Player"
---

Rondo Club includes the control plane and browser display for subscription-free
club narrowcasting. A Raspberry Pi runs the separate Rondo Player agent behind
each television.

## Implemented scope

The technical pilot and matchday-parity milestones provide:

- administrator-only player pairing and management at `/narrowcasting`;
- an administrator-only browser preview at `/display?preview=1`, opened from
  the **Club TV** page without creating a player record or credential;
- a public full-screen browser shell at `/display` that authenticates with a
  device token;
- player configuration, heartbeat, status and predefined-command REST routes;
- scheduled and manual HDMI-CEC wake and standby through Rondo Player;
- locally cached display configuration and matchday content when the network is
  temporarily down;
- server-side Sportlink Club.Data fetching and normalized feeds for today's
  matches, pitches, dressing rooms, cancellations and recent results;
- automatically rotating 16:9 scenes with stale-data and 24-hour expiry states.

Sponsor playlists and announcements are subsequent milestones.

## Sportlink matchday adapter

The Sportlink client ID is stored in the WordPress Options API and is never
returned after it is saved. The administrator UI only receives a boolean and a
masked placeholder. Club TV browsers call Rondo; they never call Sportlink.

`SportlinkMatchday` requests `programma` and `afgelastingen` at most every five
minutes and `uitslagen` at most every fifteen minutes. It normalizes external
rows into a small public contract and stores only that normalized result as the
last-known-good cache. Failed requests record a credential-free error while
preserving the previous payload. Cached assignments remain playable with a
stale marker for up to 24 hours.

The cron refresh is supplemented by refresh-on-read. This keeps the feed current
even on sites where WordPress cron traffic is intermittent, while a short lock
prevents several players from refreshing Sportlink simultaneously.

## Data model

Players are stored as private `rondo_display` posts. Operational state uses the
native field registry and post meta; there are no custom tables. The post type
is not exposed through the core REST API or WordPress admin UI.

Important fields include:

| Field | Purpose |
|---|---|
| `device_id` | Stable hardware identity derived from the Pi machine ID |
| `device_secret_hash` | HMAC hash of the bearer credential; the raw token is never stored in Rondo |
| `pairing_status` | `approved`, `paired` or `revoked` |
| `last_seen_at` | Durable, rate-limited heartbeat timestamp |
| `wake_time` / `sleep_time` | Local HDMI-CEC schedule |
| `pending_command*` | One bounded, short-lived remote command |

Online state is a three-minute transient so a heartbeat does not write post
meta every minute. `last_seen_at` is persisted at most once every five minutes.

## Pairing flow

1. An unpaired player registers its stable `device_id` and receives an
   eight-character activation code that expires after 15 minutes.
2. An administrator enters that code in **Club TV**, names the display and
   chooses the schedule.
3. The same device exchanges its approved code for a 256-bit device token.
4. The token is written with mode `0600` on the Pi. Rondo stores only an HMAC
   hash made with the WordPress authentication salt.
5. Revoking a display removes its hash immediately, so all device endpoints
   reject the old token.

The activation-code registration endpoints are public by design and
rate-limited by source address. Every management route requires
`manage_options`.

## REST API

All routes use the `/wp-json/rondo/v1/narrowcasting` prefix.

| Method and route | Authentication | Purpose |
|---|---|---|
| `POST /devices/register` | Public, rate-limited | Start or resume pairing |
| `POST /devices/claim` | Activation code + matching device ID | Receive the one-time device token |
| `GET /devices/me/config` | `X-Rondo-Device-Token` | Read safe display configuration |
| `POST /devices/me/heartbeat` | Device token | Report health and player version |
| `GET /devices/me/commands` | Device token | Poll one predefined command |
| `POST /devices/me/commands/ack` | Device token | Acknowledge command outcome |
| `GET /displays` | Administrator | List displays and health |
| `GET /preview` | Administrator | Return a credential-free sample display configuration |
| `GET /settings` | Administrator | Read masked Sportlink configuration and feed health |
| `POST /settings` | Administrator | Store the server-only client ID and club relation code |
| `POST /refresh` | Administrator, rate-limited | Force a Club.Data refresh |
| `GET /feeds/matchday` | Device token or administrator | Read normalized matchday content |
| `POST /displays/claim` | Administrator | Approve an activation code |
| `POST /displays/{id}/commands` | Administrator | Queue a predefined command |
| `POST /displays/{id}/revoke` | Administrator | Invalidate a player credential |

The allowed commands are `reload`, `restart_browser`, `reboot`, `wake_tv`,
`sleep_tv` and `cec_detect`. There is intentionally no arbitrary command or
shell endpoint.

## Browser credential handoff

Rondo Player launches `/display#token=...`. The fragment is not sent in the
HTTP request. The display stores the token locally and immediately removes the
fragment from browser history before requesting its configuration. The player
passes the token again whenever Chromium is restarted.

## Testing

`tests/Wpunit/NarrowcastingTest.php` covers the complete registration, approval,
claim, configuration, heartbeat, command, acknowledgement and revocation flow,
as well as administrator and device-identity boundaries.
`tests/Wpunit/NarrowcastingSportlinkTest.php` covers normalization, credential
redaction, freshness metadata and last-known-good behavior after Club.Data
failures.
