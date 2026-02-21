---
title: "Data Model"
---


This document describes the custom post types, taxonomies, and ACF field groups that make up the Rondo Club data model.

## Custom Post Types

The system uses nine custom post types, registered in `includes/class-post-types.php`. Six are the primary data types documented below; there are also three internal types (`calendar_event`, `rondo_feedback`, `rondo_todo`) covered briefly at the end.

### Person (`person`)

Represents individual contacts in the CRM.

| Property | Value |
|----------|-------|
| REST Base | `/wp/v2/people` |
| Menu Icon | `dashicons-groups` |
| Supports | title, thumbnail, comments, author |
| Public | No (private, accessed via REST API) |

**ACF Fields** (from `acf-json/group_person_fields.json`):

| Field | Key | Type | Description |
|-------|-----|------|-------------|
| First Name | `first_name` | text | Required. Person's first name |
| Infix | `infix` | text | Tussenvoegsel (e.g., van, de, van der). Read-only, synced from Sportlink |
| Last Name | `last_name` | text | Person's last name |
| Nickname | `nickname` | text | Informal name or alias |
| Gender | `gender` | select | Options: male, female, non_binary, other, prefer_not_to_say |
| Photo Gallery | `photo_gallery` | gallery | Up to 50 photos, first is profile photo |
| Favorite | `is_favorite` | true_false | Mark as favorite contact |
| Contact Info | `contact_info` | repeater | Contact methods (see below) |
| Addresses | `addresses` | repeater | Physical addresses (see below) |
| Work History | `work_history` | repeater | Employment history (see below) |
| Relationships | `relationships` | repeater | Connections to other people (see below) |

**Sportlink-Synced Fields** (from `acf-json/group_person_fields.json`, Sportlink tab):

| Field | Key | Type | Description |
|-------|-----|------|-------------|
| KNVB ID | `knvb-id` | text | Sportlink member number |
| isParent | `isparent` | true_false | Whether person is registered as parent in Sportlink |
| Type lid | `type-lid` | text | Membership type (e.g., "Junior", "Senior", "Donateur") |
| Leeftijdsgroep | `leeftijdsgroep` | text | Sportlink age class (e.g., "Onder 9", "Onder 18", "Senioren") |
| Lid sinds | `lid-sinds` | date_picker | Membership registration date |
| Datum foto | `datum-foto` | date_picker | Date of last photo in Sportlink |
| Datum VOG | `datum-vog` | date_picker | Date of last VOG certificate |
| Huidig Vrijwilliger | `huidig-vrijwilliger` | true_false | Current volunteer status (auto-calculated, see below) |
| Financiële blokkade | `financiele-blokkade` | true_false | Financial block flag from Sportlink |
| FreeScout ID | `freescout-id` | number | Linked FreeScout customer ID |

**Membership Status Fields** (from `acf-json/group_person_fields.json`, Basic Information tab):

| Field | Key | Type | Description |
|-------|-----|------|-------------|
| Oud-lid | `former_member` | true_false | Whether person is a former member |
| Lid tot | `lid-tot` | date_picker | Date membership ended |
| Datum overlijden | `datum-overlijden` | date_picker | Date of death |

**Werkfuncties** (synced from Sportlink via Rondo Sync, stored as serialized array in post meta):

The `werkfuncties` field contains an array of Sportlink function strings (e.g., `["Donateur"]`, `["Trainer", "Bestuurslid"]`). Used by the fee calculation system for werkfunctie-based category matching.

**NIKKI Contributie Fields** (from `acf-json/group_person_fields.json`, Contributie tab):

Per-year contribution tracking synced from NIKKI. Fields follow the pattern `_nikki_{YEAR}_{field}`:

| Field Pattern | Type | Description |
|---------------|------|-------------|
| `_nikki_{YEAR}_total` | number | Total contribution amount for that year |
| `_nikki_{YEAR}_saldo` | number | Outstanding balance for that year |
| `_nikki_{YEAR}_status` | text | Payment status for that year |

Years currently tracked: 2022, 2023, 2024, 2025.

**VOG Tracking Meta** (registered in `class-post-types.php` via `register_post_meta`):

| Field | Type | Description |
|-------|------|-------------|
| `vog_email_sent_date` | string | Date VOG request email was sent |
| `vog_justis_submitted_date` | string | Date VOG was submitted to Justis |
| `vog_reminder_sent_date` | string | Date VOG reminder email was sent |

**Contributie Exclusion Meta** (registered in `class-post-types.php` via `register_post_meta`):

| Field | Type | Description |
|-------|------|-------------|
| `_exclude_from_contributie` | boolean | Exclude person from fee calculations (requires `financieel` capability to write) |

**Computed Fields (read-only, auto-calculated):**

| Field | Key | Type | Description |
|-------|-----|------|-------------|
| Huidig Vrijwilliger | `huidig-vrijwilliger` | true_false | Current volunteer status. Auto-calculated from work history: `1` if the person has an active staff/commissie position, `0` otherwise. See `class-volunteer-status.php`. |
| is_deceased | — | boolean | Computed in REST response from `datum-overlijden` field. `true` if death date is set. See `class-rest-people.php`. |
| birth_year | — | integer | Computed in REST response by extracting year from `birthdate` field. See `class-rest-people.php`. |

**Contact Info Sub-fields:**

| Field | Key | Type | Options |
|-------|-----|------|---------|
| Type | `contact_type` | select | email, phone, mobile, website, calendar, linkedin, twitter, instagram, facebook, other |
| Label | `contact_label` | text | e.g., "Work", "Personal" |
| Value | `contact_value` | text | The actual contact value |

**Addresses Sub-fields:**

| Field | Key | Type | Description |
|-------|-----|------|-------------|
| Label | `address_label` | text | e.g., "Home", "Work" |
| Street | `street` | text | Street address |
| Postal Code | `postal_code` | text | ZIP or postal code |
| City | `city` | text | City name |
| State/Province | `state` | text | State or province |
| Country | `country` | text | Country name |

**Work History Sub-fields:**

| Field | Key | Type | Description |
|-------|-----|------|-------------|
| Team | `team` | post_object | Link to Team post |
| Job Title | `job_title` | text | Position title |
| Description | `description` | textarea | Role description |
| Start Date | `start_date` | date_picker | Employment start (Y-m-d) |
| End Date | `end_date` | date_picker | Employment end (Y-m-d) |
| Current | `is_current` | true_false | Currently employed here |

**Relationships Sub-fields:**

| Field | Key | Type | Description |
|-------|-----|------|-------------|
| Person | `related_person` | post_object | Link to related Person |
| Type | `relationship_type` | taxonomy | From relationship_type taxonomy |
| Custom Label | `relationship_label` | text | Override label (e.g., "Brother-in-law") |

---

### Team (`team`)

Represents teams where contacts work. Note: The post type slug remains `team` for backward compatibility, but the user-facing label is "Team".

| Property | Value |
|----------|-------|
| REST Base | `/wp/v2/teams` |
| Menu Icon | `dashicons-building` |
| Supports | title, editor, thumbnail, author |
| Public | No (private, accessed via REST API) |

**ACF Fields** (from `acf-json/group_team_fields.json`):

| Field | Key | Type | Description |
|-------|-----|------|-------------|
| Website | `website` | url | Team website URL |
| Industry | `industry` | text | Industry or sector |
| Contact Info | `contact_info` | repeater | Team contact methods |
| Investors | `investors` | relationship | People or teams that have invested in this team |

**Contact Info Sub-fields:**

| Field | Key | Type | Options |
|-------|-----|------|---------|
| Type | `contact_type` | select | phone, email, address, other |
| Label | `contact_label` | text | e.g., "HQ", "Support" |
| Value | `contact_value` | text | The actual contact value |

---

### Commissie (`commissie`)

Represents committees, synced from Sportlink. Supports hierarchical parent-child relationships.

| Property | Value |
|----------|-------|
| REST Base | `/wp/v2/commissies` |
| Menu Icon | `dashicons-businessperson` |
| Supports | title, editor, thumbnail, author, page-attributes |
| Public | No (private, accessed via REST API) |
| Hierarchical | Yes |

**ACF Fields** (from `acf-json/group_commissie_fields.json`):

| Field | Key | Type | Description |
|-------|-----|------|-------------|
| Website | `website` | url | Committee website URL |
| Contact Info | `contact_info` | repeater | Committee contact methods (same sub-fields as Team) |

---

### Discipline Case (`discipline_case`)

Tracks sports disciplinary actions, synced from Sportlink. Each case is linked to a person and includes match details, charges, and sanctions.

| Property | Value |
|----------|-------|
| REST Base | `/wp/v2/discipline-cases` |
| Menu Icon | `dashicons-warning` |
| Supports | title, author |
| Public | No (private, accessed via REST API) |
| Taxonomies | `seizoen` |

**ACF Fields** (from `acf-json/group_discipline_case_fields.json`):

| Field | Key | Type | Description |
|-------|-----|------|-------------|
| Dossier ID | `dossier_id` | text | Sportlink dossier identifier |
| Persoon | `person` | post_object | Link to Person post |
| Wedstrijddatum | `match_date` | date_picker | Date of the match |
| Verwerkingsdatum | `processing_date` | date_picker | Date case was processed |
| Wedstrijdomschrijving | `match_description` | text | Description of the match |
| Teamnaam | `team_name` | text | Team name (text, not linked) |
| Thuisteam | `home_team` | post_object | Link to home Team post |
| Uitteam | `away_team` | post_object | Link to away Team post |
| Artikelnummer | `charge_codes` | text | Charge article codes |
| Artikelomschrijving | `charge_description` | textarea | Charge description |
| Strafbeschrijving | `sanction_description` | textarea | Sanction description |
| Administratiekosten | `administrative_fee` | number | Administrative fee amount |
| Doorbelast | `is_charged` | select | Whether costs are charged to the member |

---

### Invoice (`rondo_invoice`)

Tracks financial invoices for membership fees or discipline case charges. Introduced in v27.

| Property | Value |
|----------|-------|
| REST Base | `/wp/v2/invoices` |
| Menu Icon | `dashicons-media-text` |
| Supports | title, author |
| Public | No (private, accessed via REST API) |

**Custom Post Statuses:**

| Status | Label | Description |
|--------|-------|-------------|
| `rondo_draft` | Concept | Invoice created but not yet sent |
| `rondo_sent` | Verstuurd | Invoice sent to member |
| `rondo_paid` | Betaald | Invoice fully paid |
| `rondo_overdue` | Verlopen | Invoice past due date |

**ACF Fields** (from `acf-json/group_invoice_fields.json`):

| Field | Key | Type | Description |
|-------|-----|------|-------------|
| Factuurtype | `invoice_type` | select | Type: `membership` or `discipline` |
| Factuurnummer | `invoice_number` | text | Generated invoice number (C prefix for contributie) |
| Persoon | `person` | post_object | Link to Person post |
| Status | `status` | select | Invoice status |
| Regelitems | `line_items` | repeater | Invoice line items (see below) |
| Totaalbedrag | `total_amount` | number | Total invoice amount |
| Betaallink | `payment_link` | url | Mollie payment URL |
| PDF pad | `pdf_path` | text | Server path to generated PDF |
| QR code pad | `qr_code_path` | text | Server path to generated QR code |
| Verzenddatum | `sent_date` | date_picker | Date invoice was sent |
| Vervaldatum | `due_date` | date_picker | Payment due date |

**Line Items Sub-fields:**

| Field | Key | Type | Description |
|-------|-----|------|-------------|
| Tuchtzaak | `discipline_case` | post_object | Link to Discipline Case (for discipline invoices) |
| Omschrijving | `description` | text | Line item description |
| Bedrag | `amount` | number | Line item amount |

**Installment Meta** (stored as post meta via `FinanceConfig`, not ACF):

Invoices with installment plans store per-installment data using numbered meta keys:

| Meta Key Pattern | Type | Description |
|-----------------|------|-------------|
| `_installment_count` | int | Total number of installments |
| `_installment_plan` | string | Plan type: `full`, `quarterly_3`, or `monthly_8` |
| `_installment_N_amount` | float | Amount for installment N |
| `_installment_N_admin_fee` | float | Admin fee portion for installment N |
| `_installment_N_status` | string | Status: `pending`, `sent`, `paid`, `overdue` |
| `_installment_N_due_date` | string | Due date (Y-m-d) |
| `_installment_N_sent_at` | string | DateTime email was sent |
| `_installment_N_paid_at` | string | DateTime payment received |
| `_installment_N_mollie_payment_id` | string | Mollie payment identifier |
| `_installment_N_payment_link` | string | Mollie checkout URL |

---

### Internal Post Types

These post types are used internally and have limited or no direct REST API exposure:

#### Todo (`rondo_todo`)

Task tracking linked to people. Uses custom post statuses for state management.

| Property | Value |
|----------|-------|
| REST Base | `/wp/v2/todos` |
| Supports | title, editor, author |

**Custom Post Statuses:** `rondo_open`, `rondo_awaiting`, `rondo_completed`

**ACF Fields** (from `acf-json/group_todo_fields.json`):

| Field | Key | Type | Description |
|-------|-----|------|-------------|
| Related People | `related_persons` | post_object | Linked Person posts |
| Notes | `notes` | wysiwyg | Additional notes |
| Awaiting Since | `awaiting_since` | date_time_picker | When status changed to awaiting |
| Due Date | `due_date` | date_picker | Task due date |

#### Calendar Event (`calendar_event`)

Cached events synced from external calendars (Google, CalDAV). Not exposed via standard REST API — uses custom endpoints only. No admin UI.

#### Feedback (`rondo_feedback`)

User feedback (bug reports, feature requests). Global per installation, not workspace-scoped.

| Property | Value |
|----------|-------|
| REST Base | `/wp/v2/feedback` |
| Supports | title, editor, author |

---

## Taxonomies

The CRM uses two custom taxonomies, registered in `includes/class-taxonomies.php`.

### Relationship Type (`relationship_type`)

Defines the types of relationships between people.

| Property | Value |
|----------|-------|
| Hierarchical | Yes |
| Attached To | person |
| REST Enabled | Yes |

**ACF Fields** (from `acf-json/group_relationship_type_fields.json`):

| Field | Key | Type | Description |
|-------|-----|------|-------------|
| Inverse Type | `inverse_relationship_type` | taxonomy | The reciprocal relationship type |
| Gender Dependent | `is_gender_dependent` | true_false | Varies by gender (e.g., aunt/uncle) |
| Gender Group | `gender_dependent_group` | text | Group name for gender variants |

**Default Relationship Types:**

The system creates these relationship types on activation:

| Category | Types |
|----------|-------|
| Basic | partner, spouse, friend, colleague, acquaintance, ex |
| Immediate Family | parent, child, sibling |
| Extended Family | grandparent, grandchild, uncle, aunt, nephew, niece, cousin |
| Step/In-law | stepparent, stepchild, stepsibling, inlaw |
| Other Family | godparent, godchild |
| Professional | boss, subordinate, mentor, mentee |

**Inverse Mappings:**

- **Symmetric:** spouse↔spouse, friend↔friend, colleague↔colleague, sibling↔sibling, cousin↔cousin, partner↔partner
- **Asymmetric:** parent↔child, grandparent↔grandchild, stepparent↔stepchild, godparent↔godchild, boss↔subordinate, mentor↔mentee
- **Gender-dependent:** aunt/uncle↔niece/nephew (resolves based on related person's gender)

For more details, see [Relationship Types](./relationship-types.md) and [Relationships](./relationships.md).

---

### Seizoen (`seizoen`)

Season classification for discipline cases.

| Property | Value |
|----------|-------|
| Hierarchical | No (tag-like) |
| Attached To | discipline_case |
| REST Enabled | Yes |

**Example values:** 2024-2025, 2025-2026

---

## Visibility Settings

Both main post types (Person, Team) include visibility settings.

**ACF Fields** (from `acf-json/group_visibility_settings.json`):

| Field | Key | Type | Description |
|-------|-----|------|-------------|
| Visibility | `_visibility` | select | Control who can see this record |

**Visibility Options:**

| Value | Description |
|-------|-------------|
| `private` | Only the post author can see (default) |
| `workspace` | Visible to workspace members |
| `shared` | Shared with specific users |

**Shared With Post Meta:**

For `shared` visibility, the `_shared_with` post meta stores sharing details:

```json
[
  {
    "user_id": 5,
    "permission": "edit",
    "shared_by": 1,
    "shared_at": "2026-01-15T10:30:00Z"
  },
  {
    "user_id": 8,
    "permission": "view",
    "shared_by": 1,
    "shared_at": "2026-01-16T14:00:00Z"
  }
]
```

**Helper Class:** `Rondo\Core\Visibility` provides static methods for managing visibility:

| Method | Description |
|--------|-------------|
| `get_visibility($post_id)` | Get visibility value (returns 'private' if not set) |
| `set_visibility($post_id, $visibility)` | Set visibility value |
| `get_shares($post_id)` | Get array of share objects |
| `add_share($post_id, $user_id, $permission, $shared_by)` | Add or update a share |
| `remove_share($post_id, $user_id)` | Remove a user's share |
| `user_has_share($post_id, $user_id)` | Check if user has share access |
| `get_share_permission($post_id, $user_id)` | Get permission level ('view', 'edit', or false) |

---

## ACF JSON Sync

ACF field groups are version-controlled in `acf-json/`:

| File | Purpose |
|------|---------|
| `group_person_fields.json` | Person post type fields |
| `group_team_fields.json` | Team post type fields |
| `group_relationship_type_fields.json` | Relationship type taxonomy fields |
| `group_visibility_settings.json` | Visibility settings for all main post types |

**How it works:**

1. When `WP_DEBUG` is `true`, field changes in WordPress admin auto-save to these JSON files
2. Production loads field definitions from JSON (faster than database)
3. Changes sync via Git, keeping all environments consistent

---

## Data Access

All data is subject to row-level access control:

- Users can only see posts they created themselves
- Administrators are restricted on the frontend but have full access in WordPress admin area
- Access filtering is applied at both `WP_Query` level and REST API responses

For details, see [Access Control](./access-control.md).

---

## Related Documentation

- [Access Control](./access-control.md) - How row-level security works
- [REST API](./rest-api.md) - API endpoints for accessing data
- [Relationships](./relationships.md) - Bidirectional relationship system
- [Relationship Types](./relationship-types.md) - Configuring relationship types

