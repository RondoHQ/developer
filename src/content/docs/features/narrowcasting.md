---
title: "Narrowcasting and Rondo Player"
---

Rondo Club includes the control plane and browser display for subscription-free
club narrowcasting. A Raspberry Pi runs the separate Rondo Player agent behind
each television.

## Pilot scope

The first milestone provides:

- administrator-only player pairing and management at `/narrowcasting`;
- a public full-screen browser shell at `/display` that authenticates with a
  device token;
- player configuration, heartbeat, status and predefined-command REST routes;
- scheduled and manual HDMI-CEC wake and standby through Rondo Player;
- locally cached display configuration when the network is temporarily down.

Match data, dressing-room assignments, sponsor playlists and announcements are
subsequent milestones.

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
