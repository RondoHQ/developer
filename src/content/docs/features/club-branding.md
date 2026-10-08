---
title: Club branding
---

Club branding — name, logo, and accent colours — is configured in the finance settings and
consumed by every logged-out surface. The single source of truth is
`PublicPageChrome::branding()` (`includes/class-public-page-chrome.php`), which returns:

| Key | Source | Fallback |
|---|---|---|
| `name` | Clubnaam (`ClubConfig::get_club_name()`), then legal organization name | Site name |
| `logo_url` | Club logo attachment (`FinanceConfig::get_club_logo_id()`) | Empty string |
| `accent_color` | `FinanceConfig::get_accent_color()` | `#0891b2` (Rondo cyan) |
| `accent_background_color` | `FinanceConfig::get_accent_background_color()` | `#f8fafc` |

## Consumers

- **Public payment page** (`/betaling/{token}`) and **activation page** (`/activeren`) — via the
  shared `PublicPageChrome` HTML shell.
- **Transactional email** — `EmailTemplate` and `ActivationService` use the brand name and accent
  colour for headers and CTA buttons.
- **Invoice PDFs** — `InvoicePdfGenerator` embeds the club logo.
- **Login page** (`wp-login.php`) — `rondo_login_styles()` in `functions.php` renders the club
  logo and derives a full palette (dark and light shades, borders, backgrounds, shadows) from the
  accent colour. When no branding is configured it falls back to the Rondo logo and cyan palette.
  The heading below the logo deliberately shows the **site title** (the application name, e.g.
  "AWC Rondo"), not the club name from `branding()`.

The password reset form's **Wachtwoord genereren** button uses a full-width secondary style
with the club's derived border/text colours, rounded corners, and a visible keyboard focus outline.
Its `.login .button.wp-generate-pw` selector overrides the WordPress blue button defaults without
changing the password visibility toggle or primary save button.

## Colour derivation on the login page

The login page needs more than one colour, so `rondo_login_mix_color()` mixes the accent colour
with white or black to produce tints and shades (for example, the page background is the accent
mixed 88% toward white). `rondo_login_hex_to_rgb()` validates hex input and falls back to the
Rondo cyan on invalid values, so a malformed option can never break the login page.

## Sponsor and membership-pass labels

`ClubConfig::get_sponsor_role_labels()` and frontend `getSponsorRoleLabels()` derive `Sponsor {club name}` and `Businessclub {club name}` from the configured Clubnaam. Sponsor forms/lists, person relations, native field-schema choices, admission statistics and Apple/Google sponsor card titles use these labels. Empty club names produce `Sponsor` and `Businessclub`.

Stored keys remain `awc_sponsor` and `businessclub`; integrations must use these keys rather than a translated label. Sponsor Wallet card titles use Clubnaam even when a separate issuer/organization name is configured. Household member-pass titles use `{club name} Ledenpas`, while the ordinary member choice alongside sponsor passes uses `{club name} ledenpas — {team} — {role}`. Household Club TV logo guidance also uses the configured club name.
