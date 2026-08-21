---
title: "Membership Fees System"
---


## Overview

The membership fees system manages per-season contribution settings for club members. It supports:
- Per-season fee storage (separate settings for each season)
- Automatic migration from legacy global settings
- Fee calculation with family discounts and pro-rata adjustments
- Fee snapshots for season locking

## Season Format

Seasons are represented as `YYYY-YYYY` format (e.g., `2025-2026`).

**Season start date:** July 1

- If current month >= July: season is current year to next year (e.g., `2025-2026`)
- If current month < July: season is previous year to current year (e.g., `2024-2025`)

## Storage

### Per-Season Option Keys

Fee settings are stored in WordPress options with season-specific keys:

| Option Key | Purpose |
|------------|---------|
| `rondo_membership_fees_YYYY-YYYY` | Fee settings for specific season (e.g., `rondo_membership_fees_2025-2026`) |
| `rondo_membership_fees` | Legacy global option (deprecated, auto-migrated on first read) |

### Fee Structure

#### Legacy Format (pre-v21.0)

Each season option stored a simple array of fee types:

```php
[
  'mini'     => 130,  // Ages 4-6
  'pupil'    => 180,  // Ages 7-12
  'junior'   => 230,  // Ages 13-17
  'senior'   => 255,  // Ages 18+
  'recreant' => 65,   // Recreational members
  'donateur' => 55,   // Donors
]
```

#### v21.0+ Format: Fee Category Configuration

**As of v21.0 (Phase 155+)**, season options store slug-keyed category objects with full metadata:

```php
[
  'senior' => [
    'label'        => 'Senior',
    'amount'       => 255,
    'age_classes'  => [],  // Empty = catch-all for any age class
    'is_youth'     => false,
    'sort_order'   => 40,
  ],
  'junior' => [
    'label'        => 'Junior (Onder 18)',
    'amount'       => 230,
    'age_classes'  => ['Onder 18'],
    'is_youth'     => true,
    'sort_order'   => 30,
  ],
  'pupil' => [
    'label'        => 'Pupil (Onder 12)',
    'amount'       => 180,
    'age_classes'  => ['Onder 9', 'Onder 10', 'Onder 11', 'Onder 12'],
    'is_youth'     => true,
    'sort_order'   => 20,
  ],
  'mini' => [
    'label'        => 'Mini (Onder 8)',
    'amount'       => 130,
    'age_classes'  => ['Onder 5', 'Onder 6', 'Onder 7', 'Onder 8'],
    'is_youth'     => true,
    'sort_order'   => 10,
  ],
  'recreant' => [
    'label'        => 'Recreant',
    'amount'       => 65,
    'age_classes'  => [],  // Empty = catch-all
    'is_youth'     => false,
    'sort_order'   => 50,
  ],
  'donateur' => [
    'label'        => 'Donateur',
    'amount'       => 55,
    'age_classes'  => [],  // Empty = catch-all
    'is_youth'     => false,
    'sort_order'   => 60,
  ],
]
```

**Category Object Fields:**
- `label` (string): Display name for UI
- `amount` (int): Fee amount in euros
- `age_classes` (array): Sportlink AgeClassDescription strings (e.g., `["Onder 9", "Onder 10"]`). Empty array acts as catch-all for any age class not matched by other categories.
- `is_youth` (bool): Whether category is eligible for family discount
- `sort_order` (int): Display order in UI (lower = earlier)
- `matching_teams` (array, optional): Team post IDs (integers) that trigger this category. Empty/absent = not team-based.
- `matching_werkfuncties` (array, optional): Werkfunctie strings (e.g., `["Donateur"]`) that trigger this category. Empty/absent = not werkfunctie-based.

**Age Class Matching (Phase 156+):**

Age class matching uses exact string comparison against Sportlink's `leeftijdsgroep` field (e.g., "Onder 9", "Onder 18"):

1. System reads person's `leeftijdsgroep` ACF field (synced from Sportlink)
2. Compares against each category's `age_classes` array
3. If multiple categories match, the one with lowest `sort_order` wins
4. If no category matches, uses first category with empty `age_classes` array (catch-all)

This enables flexible age-based fee tiers that align exactly with Sportlink's age classification system.

**Team and Werkfunctie Matching (Phase 161+):**

Team and werkfunctie matching allows categories to be assigned based on organizational role rather than age:

- **Team matching (`matching_teams`)**: Array of team post IDs. Person matches if ANY of their teams appears in this array (not ALL).
- **Werkfunctie matching (`matching_werkfuncties`)**: Array of werkfunctie strings. Person matches if ANY werkfunctie matches (case-insensitive comparison).

**Priority order:**
1. Youth categories (age class-based)
2. Team matching (if person's teams match category's `matching_teams`)
3. Werkfunctie matching (if person's werkfunctie matches category's `matching_werkfuncties`)
4. Age class fallback (catch-all categories)

**Example:**
```php
'recreant' => [
  'label'        => 'Recreant',
  'amount'       => 65,
  'age_classes'  => [],  // Empty = not age-based
  'matching_teams' => [123, 456, 789],  // Team post IDs for recreational teams
  'is_youth'     => false,
  'sort_order'   => 50,
],
'donateur' => [
  'label'        => 'Donateur',
  'amount'       => 55,
  'age_classes'  => [],
  'matching_werkfuncties' => ['Donateur'],  // Werkfunctie string from ACF
  'is_youth'     => false,
  'sort_order'   => 60,
],
```

**Migration behavior:**
On first load after upgrade to v21.1:
- Existing 'recreant' categories automatically populated with recreational team IDs from database
- Existing 'donateur' categories automatically populated with `['Donateur']` werkfunctie
- Other categories get empty arrays (no team/werkfunctie matching)

## Migration Behavior

**One-time automatic migration:**

When `get_settings_for_season()` is called for the **current season** and:
1. No season-specific option exists for current season
2. Legacy global option `rondo_membership_fees` exists

The system will:
1. Copy legacy global option → current season option (`rondo_membership_fees_2025-2026`)
2. Delete the legacy global option
3. Return the migrated values

**Next season defaults:**
- If no option exists for next season, returns default values
- No migration occurs (next season starts fresh with defaults)

## API Endpoints

### GET `/rondo/v1/membership-fees/settings`

Returns category configuration for both current and next season.

**Permission:** Admin users only

**Response:**
```json
{
  "current_season": {
    "key": "2025-2026",
    "categories": {
      "senior": {
        "label": "Senior",
        "amount": 255,
        "age_classes": [],
        "is_youth": false,
        "sort_order": 40
      },
      "junior": {
        "label": "Junior (Onder 18)",
        "amount": 230,
        "age_classes": ["Onder 18"],
        "is_youth": true,
        "sort_order": 30
      },
      "pupil": {
        "label": "Pupil (Onder 12)",
        "amount": 180,
        "age_classes": ["Onder 9", "Onder 10", "Onder 11", "Onder 12"],
        "is_youth": true,
        "sort_order": 20
      },
      "mini": {
        "label": "Mini (Onder 8)",
        "amount": 130,
        "age_classes": ["Onder 5", "Onder 6", "Onder 7", "Onder 8"],
        "is_youth": true,
        "sort_order": 10
      },
      "recreant": {
        "label": "Recreant",
        "amount": 65,
        "age_classes": [],
        "is_youth": false,
        "sort_order": 50
      },
      "donateur": {
        "label": "Donateur",
        "amount": 55,
        "age_classes": [],
        "is_youth": false,
        "sort_order": 60
      }
    },
    "family_discount": {
      "second_child_percent": 25,
      "third_child_percent": 50
    }
  },
  "next_season": {
    "key": "2026-2027",
    "categories": {
      "senior": { /* ... same structure ... */ },
      "junior": { /* ... */ }
    },
    "family_discount": {
      "second_child_percent": 25,
      "third_child_percent": 50
    }
  }
}
```

**Category Object Fields:**
- `label` (string): Display name for UI
- `amount` (int): Fee amount in euros
- `age_classes` (array): Sportlink age class strings (e.g., `["Onder 9"]`). Empty array = catch-all.
- `is_youth` (bool): Whether category is eligible for family discount
- `sort_order` (int): Display order (lower = earlier)
- `matching_teams` (array, optional): Team post IDs that trigger this category
- `matching_werkfuncties` (array, optional): Werkfunctie strings that trigger this category

### POST `/rondo/v1/membership-fees/settings`

Updates category configuration for a specific season using full replacement pattern.

**Permission:** Admin users only

**Request Body:**
```json
{
  "season": "2025-2026",
  "categories": {
    "senior": {
      "label": "Senior",
      "amount": 275,
      "age_classes": [],
      "is_youth": false,
      "sort_order": 40
    },
    "junior": {
      "label": "Junior (Onder 18)",
      "amount": 245,
      "age_classes": ["Onder 18"],
      "is_youth": true,
      "sort_order": 30
    }
  },
  "family_discount": {
    "second_child_percent": 30,
    "third_child_percent": 60
  }
}
```

**Required Fields:**
- `season` (string): Must be current season or next season key

**Optional Fields:**
- `categories` (object): Complete category configuration for the season. If provided, replaces all categories for the season. If omitted or null, categories are not modified.
- `family_discount` (object): Family discount percentages. If provided, replaces discount config for the season. If omitted or null, discount config is not modified.

**Category Object Required Fields:**
- `label` (string): Non-empty display name
- `amount` (int/float): Non-negative fee amount
- `age_classes` (array): Array of age class strings (can be empty)
- `is_youth` (bool): Family discount eligibility
- `sort_order` (int): Display order

**Category Object Optional Fields:**
- `matching_teams` (array): Team post IDs (integers). Defaults to empty array.
- `matching_werkfuncties` (array): Werkfunctie strings. Defaults to empty array.

**Full Replacement Pattern:**
The `categories` parameter completely replaces the existing configuration for the season. To preserve existing categories, include them in the request. To delete a category, omit it. To reset all categories, send an empty object `{}`.

**Validation:**

Validation distinguishes between **errors** (block save) and **warnings** (informational):

**Errors (block save):**
- Season not current or next season
- `categories` is not an object (if provided)
- Duplicate category slugs within same season
- Category missing `label`, `amount`, or required fields
- Invalid `amount` (non-numeric or negative)
- Invalid slug format (contains spaces, special characters). Error message suggests normalized alternative via `sanitize_title()`.
- `family_discount` percentages not in 0-100 range (if provided)

**Warnings (allow save):**
- Duplicate age class assignments (same age class in multiple categories). Warning indicates which categories conflict. Admin may intentionally create graduated fee structures.
- `second_child_percent >= third_child_percent` (illogical but allowed for flexibility)

**Validation Response (on error):**
```json
{
  "code": "invalid_settings",
  "message": "Settings validation failed",
  "data": {
    "errors": [
      {
        "field": "categories.junior.amount",
        "message": "Amount must be a non-negative number"
      },
      {
        "field": "categories.my slug",
        "message": "Invalid slug format. Suggestion: 'my-slug'"
      },
      {
        "field": "family_discount.second_child_percent",
        "message": "Second child discount must be between 0 and 100"
      }
    ],
    "warnings": [
      {
        "field": "categories",
        "message": "Age class 'Onder 9' is assigned to multiple categories",
        "categories": ["mini", "pupil"]
      },
      {
        "field": "family_discount",
        "message": "Second child discount (30%) is greater than or equal to third child discount (25%)"
      }
    ]
  }
}
```

**Response (on success):**
```json
{
  "current_season": {
    "key": "2025-2026",
    "categories": { /* updated categories */ },
    "family_discount": { /* updated discount config */ }
  },
  "next_season": {
    "key": "2026-2027",
    "categories": { /* categories */ },
    "family_discount": { /* discount config */ }
  },
  "warnings": [
    {
      "field": "categories",
      "message": "Age class 'Onder 9' is assigned to multiple categories",
      "categories": ["mini", "pupil"]
    },
    {
      "field": "family_discount",
      "message": "Second child discount (30%) is greater than or equal to third child discount (25%)"
    }
  ]
}
```

**Note:** Warnings are included in the success response for transparency but do not block the save.

### GET `/rondo/v1/werkfuncties/available`

Returns distinct werkfunctie values from all people in the database for use in admin UI.

**Permission:** Admin users only

**Response:**
```json
[
  "Donateur",
  "Trainer",
  "Scheidsrechter",
  "Bestuurslid"
]
```

**Implementation:** Queries all people with `werkfuncties` ACF meta, unserializes the data (ACF repeater stored as serialized array), extracts unique non-empty values, and returns sorted alphabetically.

**Use case:** Provides available options for werkfunctie multi-select in fee category settings UI (Phase 161+).

### GET `/rondo/v1/fees`

Returns calculated membership fees for all members with optional category metadata.

**Query Parameters:**
- `forecast` (bool, optional): If true, returns fees for next season with 100% pro-rata
- `season` (string, optional): Season key (e.g., `2025-2026`). Defaults to current season. Ignored if `forecast=true`.

**Response:**
```json
{
  "season": "2025-2026",
  "forecast": false,
  "total": 150,
  "members": [
    {
      "id": 123,
      "first_name": "Jan",
      "last_name": "Jansen",
      "category": "junior",
      "leeftijdsgroep": "Onder 18",
      "base_fee": 230,
      "family_discount_rate": 0.25,
      "family_discount_amount": 57.50,
      "fee_after_discount": 172.50,
      "prorata_percentage": 1.0,
      "final_fee": 172.50,
      "family_key": "1234AB-10",
      "family_size": 2,
      "family_position": 2,
      "lid_sinds": "2023-08-15",
      "from_cache": true,
      "calculated_at": "2026-02-09 10:30:00",
      "nikki_total": 172.50,
      "nikki_saldo": 0.00
    }
  ],
  "categories": {
    "mini": {
      "label": "Mini (Onder 8)",
      "sort_order": 10,
      "is_youth": true
    },
    "pupil": {
      "label": "Pupil (Onder 12)",
      "sort_order": 20,
      "is_youth": true
    },
    "junior": {
      "label": "Junior (Onder 18)",
      "sort_order": 30,
      "is_youth": true
    },
    "senior": {
      "label": "Senior",
      "sort_order": 40,
      "is_youth": false
    }
  }
}
```

**Categories Metadata (Phase 157+):**
The `categories` key provides display metadata for the frontend:
- `label`: Category name for badges/headers
- `sort_order`: Column ordering (lower = leftmost)
- `is_youth`: Family discount eligibility (for grouping/filtering)

**Note:** Full category configuration (including `amount` and `age_classes`) is available via the settings endpoint. The fee list endpoint returns only display-relevant fields.

Former members appear only when valid `lid_sinds` and `lid_tot` dates show that their membership overlapped the requested season. Missing or invalid membership dates exclude them from the fee list and automatic invoicing.

Cached fees are invalidated by relevant field writes and are also checked against dated `work_history` endings when read. This second check handles the passage of midnight: a position that was valid through its end date cannot keep an old fee category alive on later days.

## PHP Service Methods

### `MembershipFees` Class

#### Season Key Helpers

```php
// Get option key for a season
public function get_option_key_for_season( string $season ): string

// Get the previous season key (e.g., "2025-2026" → "2024-2025")
public function get_previous_season_key( string $season ): ?string
```

#### Category Configuration (v21.0+)

```php
// Get all categories for a season (with copy-forward from previous season)
public function get_categories_for_season( string $season ): array

// Save categories for a season
public function save_categories_for_season( array $categories, string $season ): bool

// Get a single category by slug
public function get_category( string $slug, ?string $season = null ): ?array
```

**Copy-Forward Behavior:**

When `get_categories_for_season()` is called for a season with no existing data:
1. Fetches categories from the previous season (via `get_previous_season_key()`)
2. If previous season has data, copies the full category configuration to the new season
3. Saves the copied data to the new season option for future reads
4. Returns the copied categories
5. If no previous season data exists, returns empty array `[]`

This ensures new seasons automatically inherit the previous season's category configuration (labels, amounts, age ranges, youth flags, sort order), which administrators can then adjust as needed.

#### Legacy Fee Settings (pre-v21.0)

```php
// Get settings for a specific season (with auto-migration)
public function get_settings_for_season( string $season ): array

// Update settings for a specific season
public function update_settings_for_season( array $fees, string $season ): bool

// Get current season settings (backward compatible)
public function get_all_settings(): array

// Update current season settings (backward compatible)
public function update_settings( array $fees ): bool

// Get single fee amount by type (uses current season)
public function get_fee( string $type ): int

// Calculate fee for a person (uses current season)
public function calculate_fee( int $person_id ): ?array
```

**Note:** Phase 156 will update `get_fee()`, `calculate_fee()`, and related methods to read from the new category configuration instead of the legacy flat amount array.

## Season Transition

On **July 1 of each year**, the season automatically transitions:

**Before July 1, 2026:**
- Current season: `2025-2026`
- Next season: `2026-2027`

**On/After July 1, 2026:**
- Current season: `2026-2027` (automatically becomes current)
- Next season: `2027-2028` (new season available for configuration)

**Pre-configuration workflow:**
1. Before June 2026: Admin configures next season (`2026-2027`) fees
2. July 1, 2026: System automatically uses `2026-2027` as current season
3. All fee calculations use new season rates
4. Admin can now configure `2027-2028` as next season

## Fee Category Configuration (v21.0+)

**Introduced:** Phase 155 (v21.0)

### Data Model

Fee categories are stored per season in the `rondo_membership_fees_{season}` WordPress option. The option value is a slug-keyed PHP array where each value is a category object:

```php
get_option( 'rondo_membership_fees_2025-2026' )
// Returns:
[
  'senior' => [
    'label'        => 'Senior',
    'amount'       => 255,
    'age_classes'  => [],  // Empty = catch-all
    'is_youth'     => false,
    'sort_order'   => 40,
  ],
  'junior' => [
    'label'        => 'Junior (Onder 18)',
    'amount'       => 230,
    'age_classes'  => ['Onder 18'],
    'is_youth'     => true,
    'sort_order'   => 30,
  ],
  // ... more categories
]
```

### Copy-Forward Mechanism

When reading categories for a season that doesn't exist yet, the system automatically copies the entire category configuration from the previous season:

**Example:**
1. Current season is `2025-2026` (has categories configured)
2. Admin navigates to settings for next season `2026-2027`
3. System calls `get_categories_for_season( '2026-2027' )`
4. Option `rondo_membership_fees_2026-2027` doesn't exist
5. System calls `get_previous_season_key( '2026-2027' )` → returns `'2025-2026'`
6. Reads option `rondo_membership_fees_2025-2026` (exists)
7. Saves that data to `rondo_membership_fees_2026-2027`
8. Returns the copied categories

**Fallback:** If neither the requested season nor the previous season have data, returns empty array `[]`.

This copy-forward ensures:
- New seasons start with the same category structure as the previous season
- Administrators can adjust amounts for inflation or policy changes
- Category labels, age ranges, youth flags, and sort order carry forward consistently

### Helper Methods

#### Category Lookup (Phase 156+)

```php
$membership_fees = new \Rondo\Fees\MembershipFees();

// Get category by Sportlink age class (e.g., "Onder 9", "Onder 18")
$category_slug = $membership_fees->get_category_by_age_class( 'Onder 9', '2025-2026' );
// Returns: 'mini' (or null if no match)

// Get all valid category slugs for a season
$slugs = $membership_fees->get_valid_category_slugs( '2025-2026' );
// Returns: ['mini', 'pupil', 'junior', 'senior', 'recreant', 'donateur']

// Get youth category slugs for a season
$youth_slugs = $membership_fees->get_youth_category_slugs( '2025-2026' );
// Returns: ['mini', 'pupil', 'junior'] (categories with is_youth=true)

// Get category sort order map for a season
$sort_order = $membership_fees->get_category_sort_order( '2025-2026' );
// Returns: ['mini' => 10, 'pupil' => 20, 'junior' => 30, 'senior' => 40, ...]
```

**Season parameter:** All helper methods accept an optional `$season` parameter. If omitted, defaults to current season. Pass next season key to support forecast mode.

#### Category Management

```php
$membership_fees = new \Rondo\Fees\MembershipFees();

// Get all categories for a season (with copy-forward)
$categories = $membership_fees->get_categories_for_season( '2025-2026' );
// Returns: [ 'senior' => [...], 'junior' => [...], ... ]

// Get a single category by slug
$senior = $membership_fees->get_category( 'senior', '2025-2026' );
// Returns: [ 'label' => 'Senior', 'amount' => 255, ... ] or null

// Save categories for a season
$updated = [
  'senior' => [ 'label' => 'Senior', 'amount' => 275, ... ],
  // ... other categories
];
$membership_fees->save_categories_for_season( $updated, '2025-2026' );

// Calculate previous season key
$prev = $membership_fees->get_previous_season_key( '2025-2026' );
// Returns: '2024-2025'
```

### Migration

**No automatic migration** from the legacy flat amount format to the new category object format. This is a single-club application, and the data will be manually populated when v21.0 is deployed.

Existing code that reads fee amounts directly (e.g., `get_fee()`, `calculate_fee()`) will be updated in Phase 156 to read from the new category configuration.

## Fee Calculation

### Base Fee Determination

**Priority order (Phase 161+):**
1. **Youth categories**: Based on `leeftijdsgroep` ACF field (age class matching via `age_classes` arrays)
2. **Team matching**: If person's teams match any category's `matching_teams` array
3. **Werkfunctie matching**: If person's werkfunctie matches any category's `matching_werkfuncties` array
4. **Age class fallback**: First category with empty `age_classes` array (catch-all)

**Pre-v21.1 behavior (hardcoded):**
1. Youth categories (mini/pupil/junior): Based on `leeftijdsgroep` ACF field
2. Senior: Regular senior fee (default)
3. Recreant: Senior with only recreational teams (hardcoded team check)
4. Donateur: Only if no valid age group and no teams (hardcoded werkfunctie check)

**Deprecated methods:**
- `is_recreational_team()` — Replaced by config-driven `matching_teams`
- `is_donateur()` — Replaced by config-driven `matching_werkfuncties`

Both methods are kept for migration purposes only and marked `@deprecated`.

### Family Discounts

Applied to youth members only (categories with `is_youth: true`):
- 1st child: 100% (full fee)
- 2nd child: Configurable (default 25% discount = 75% of base)
- 3rd+ child: Configurable (default 50% discount = 50% of base)

Family grouping: Postal code + house number from addresses field

Only active youth members participate in family grouping. Former members are excluded even when they still owe a fee for the selected season, and changing a member's former-member status invalidates the stored fee and family position for the entire household.

#### Configurable Discount Percentages (v21.1+)

**Introduced:** Phase 160 (v21.1.0)

Discount percentages are stored per season in separate WordPress options to avoid conflicts with category saves:

**Option Key Format:** `rondo_family_discount_{season}` (e.g., `rondo_family_discount_2025-2026`)

**Option Structure:**
```php
[
  'second_child_percent' => 25,  // 0-100 (25 = 25% discount, user pays 75%)
  'third_child_percent'  => 50,  // 0-100 (50 = 50% discount, user pays 50%)
]
```

**Helper Methods:**

```php
$membership_fees = new \Rondo\Fees\MembershipFees();

// Get discount config for a season (with copy-forward from previous season)
$config = $membership_fees->get_family_discount_config( '2025-2026' );
// Returns: [ 'second_child_percent' => 25, 'third_child_percent' => 50 ]

// Save discount config for a season
$membership_fees->save_family_discount_config(
  [ 'second_child_percent' => 30, 'third_child_percent' => 60 ],
  '2025-2026'
);

// Calculate discount rate for a family position (existing method, now reads config)
$rate = $membership_fees->get_family_discount_rate( 2, '2025-2026' );
// Returns: 0.25 (for 2nd child with 25% discount) or 0.5 (for 3rd+ child)
```

**Copy-Forward Behavior:**

When `get_family_discount_config()` is called for a season with no existing config:
1. Fetches config from the previous season (via `get_previous_season_key()`)
2. If previous season has config, copies it to the new season and returns
3. If no previous season config exists, returns defaults: `['second_child_percent' => 25, 'third_child_percent' => 50]`

This ensures discount policy carries forward year-to-year, matching the category copy-forward pattern.

**API Integration:**

The discount configuration is included in the membership fee settings REST API endpoints:

- **GET `/rondo/v1/membership-fees/settings`**: Includes `family_discount` field for both seasons
- **POST `/rondo/v1/membership-fees/settings`**: Accepts optional `family_discount` parameter alongside `categories`

**Validation:**

- `second_child_percent` must be 0-100
- `third_child_percent` must be 0-100
- **Warning (not error):** If `second_child_percent >= third_child_percent`, API returns warning to guide typical use case but allows save for flexibility

**Default Behavior:**

If no config exists for a season and no previous season to copy from, the system falls back to hardcoded defaults (25%/50%). This ensures backward compatibility with existing installations.

### Pro-Rata Adjustment

Based on `lid-sinds` (registration date) field:
- **Before season start:** 100% (member since previous season)
- **Q1 (July-September):** 100%
- **Q2 (October-December):** 75%
- **Q3 (January-March):** 50%
- **Q4 (April-June):** 25%

### Calculation Flow

```
Base Fee → Family Discount → Pro-Rata → Final Fee
```

Example:
- Base fee (pupil): €180
- Family discount (2nd child): €180 × 75% = €135
- Pro-rata (joined October): €135 × 75% = €101.25
- Final fee: €101.25

## Fee Snapshots

Fees are cached per person per season to prevent recalculation:

```php
// Save snapshot for a season
public function save_fee_snapshot( int $person_id, array $fee_data, ?string $season = null ): bool

// Get snapshot for a season
public function get_fee_snapshot( int $person_id, ?string $season = null ): ?array

// Clear snapshot (triggers recalculation)
public function clear_fee_snapshot( int $person_id, ?string $season = null ): bool

// Clear all snapshots for a season (admin "recalculate all")
public function clear_all_snapshots_for_season( string $season ): int
```

**Snapshot meta key format:** `fee_snapshot_YYYY-YYYY`

## UI (Admin Settings)

Located at: **Settings → Admin → Contributie**

**Two-section interface:**

### Huidig seizoen: 2025-2026
- Mini: €130
- Pupil: €180
- Junior: €230
- Senior: €255
- Recreant: €65
- Donateur: €55
- [Opslaan] button

### Volgend seizoen: 2026-2027
- Mini: €130
- Pupil: €180
- Junior: €230
- Senior: €255
- Recreant: €65
- Donateur: €55
- [Opslaan] button

**Independent saves:** Each section saves independently to its season-specific option.

## Backward Compatibility

All existing code using the following methods continues to work unchanged:

```php
$membership_fees = new \Rondo\Fees\MembershipFees();

// These methods now use current season internally
$membership_fees->get_all_settings();        // Returns current season fees
$membership_fees->update_settings( $fees );  // Updates current season
$membership_fees->get_fee( 'senior' );       // Gets current season fee
$membership_fees->calculate_fee( $person_id ); // Uses current season
```

No code changes required for existing functionality.

## Removed / Deprecated

The following constants, methods, and patterns were removed in v21.0 (Phase 156):

### Constants

- **`MembershipFees::VALID_TYPES`** — Hardcoded array of valid fee category slugs
  - **Replacement:** Use `get_valid_category_slugs( $season )` to read valid slugs from category configuration
  - **Reason:** Category list is now per-season and configurable

- **`MembershipFees::DEFAULTS`** — Hardcoded default fee amounts
  - **Replacement:** Category configuration defines amounts per season
  - **Reason:** Amounts are now fully configurable per category per season

### Methods

- **`parse_age_group( $leeftijdsgroep )`** — Converted Sportlink age class to category via regex/range logic
  - **Replacement:** Use `get_category_by_age_class( $leeftijdsgroep, $season )` for exact string matching
  - **Reason:** Age class matching now uses exact string comparison against `age_classes` arrays, not regex

### Hardcoded Arrays

- **`$category_order` arrays** in REST API and Google Sheets export
  - **Replacement:** Use `get_category_sort_order( $season )` to read sort order from category configuration
  - **Reason:** Sort order is now configurable per season via `sort_order` field

- **`$youth_categories` arrays** in fee calculation code
  - **Replacement:** Use `get_youth_category_slugs( $season )` to read youth categories from configuration
  - **Reason:** Youth flag is now configurable per category via `is_youth` field

### Data Model Changes

- **`age_min` / `age_max` fields** in category configuration
  - **Replacement:** `age_classes` array storing Sportlink AgeClassDescription strings
  - **Migration:** Automatic migration converts old ranges to empty arrays (catch-all)
  - **Reason:** Age class matching must align exactly with Sportlink's classification system

## Invoice Creation from Fees (v27+)

Once membership fees are calculated, invoices can be created for individual members or in bulk.

### Single Invoice Creation

**Endpoint:** `POST /rondo/v1/fees/create-membership-invoice`

Creates a `rondo_invoice` post of type `membership` for one person:

1. Retrieves the person's fee snapshot for the season
2. Generates a sequential invoice number with `C` prefix (e.g., `C-2025-0042`) via `InvoiceNumbering`
3. Creates the invoice post with line items from the fee breakdown
4. Returns the created invoice ID

### Bulk Invoice Creation

**Endpoint:** `POST /rondo/v1/fees/bulk-create-invoices`

Creates invoices for all uninvoiced members in a season:

1. Admin triggers the job via the "Nog te factureren" (not yet invoiced) UI
2. `BulkInvoiceCreator` iterates all members with fee snapshots
3. Skips members who already have an invoice for the season
4. Calls `create_membership_invoice()` for each eligible member
5. Progress is tracked in a WordPress option (`rondo_bulk_invoice_job`)
6. Frontend polls `GET /rondo/v1/fees/bulk-invoice-job` for progress updates

### Invoice Lifecycle

```
Draft → Send Email → Sent → Payment via Mollie → Paid
                       ↓
                   (overdue after due_date)
                       ↓
                    Overdue
```

## Installment Payment Plans (v28+)

Members can pay membership invoices in installments instead of a lump sum.

### Plan Types

| Plan | Key | Installments | Description |
|------|-----|-------------|-------------|
| Full payment | `full` | 1 | Single payment (default) |
| Quarterly | `quarterly_3` | 3 | Three equal installments |
| Monthly | `monthly_8` | 8 | Eight monthly installments |

### Plan Configuration

Plans are enabled/disabled per season via WordPress options:

| Option Key | Default | Description |
|------------|---------|-------------|
| `rondo_installment_plan_3_enabled_{season}` | `true` | Enable 3-installment plan |
| `rondo_installment_plan_8_enabled_{season}` | `true` | Enable 8-installment plan |

These are managed via the `MembershipFees` class methods:
- `get_installment_plan_3_enabled( $season )`
- `set_installment_plan_3_enabled( $enabled, $season )`
- `get_installment_plan_8_enabled( $season )`
- `set_installment_plan_8_enabled( $enabled, $season )`

### Installment Admin Fee

An optional admin fee can be added to each installment when a member chooses to pay in installments:

| Option | Key | Default |
|--------|-----|---------|
| Admin fee per installment | `rondo_finance_installment_admin_fee` | `0.00` |

Configured in `FinanceConfig` and editable via the Finance Settings UI.

### Installment Email Template

A separate email template is used when sending installment payment requests:

| Option | Key |
|--------|-----|
| Installment email template | `rondo_finance_installment_email_template` |

**Available placeholders:**

| Placeholder | Description |
|-------------|-------------|
| `{voornaam}` | Person's first name |
| `{factuur_nummer}` | Invoice number |
| `{termijn_nummer}` | Current installment number |
| `{totaal_termijnen}` | Total number of installments |
| `{termijn_bedrag}` | Installment amount |
| `{vervaldatum}` | Due date |
| `{betaallink}` | Mollie payment link |
| `{organisatie_naam}` | Organization name |

Rendering notes:
- Placeholder substitution still happens inside the finance sender classes.
- The resolved HTML is then wrapped in the shared `Rondo\Notifications\EmailTemplate` layout, which adds branded spacing, footer, and a CTA button.
- This same shared wrapper is also used for direct invoice mails and invoice reminders, so finance-related emails now have a consistent visual structure.
- The `Standaard e-mail voor gewone facturen` setting now uses the same rich text editor as the other finance templates and stores HTML with `wp_kses_post()` sanitization.
- Existing plain-text regular-invoice templates remain backward compatible: if no HTML markup is detected, the sender still converts the text to paragraphs/line breaks before wrapping it.
- Naming split: invoice PDFs continue to use the legal finance organization name (`org_name`), while user-facing finance branding such as email sender/display text and public payment pages now prefers `Clubnaam` via `FinanceConfig::get_display_name()`.
- The per-invoice `E-mail body` override in the draft/create form also uses the rich text editor now, matching the global finance template editing experience.
- The shared `RichTextEditor` normalizes legacy plain-text template values into paragraph HTML on load, so existing newline-separated finance templates keep their structure when opened in the editor.

### Invoice Reminder Emails

Unpaid invoices are swept once per day by `InvoiceReminderScheduler` (cron hook `rondo_invoice_reminder_sweeper`). It queries `rondo_invoice` posts in `rondo_sent`/`rondo_overdue` status and sends, via `InvoiceReminderSender`:

- **Reminder 1** — 14+ days after `sent_date` (no `_invoice_reminder_1_sent_at` meta yet)
- **Reminder 2** — 28+ days after `sent_date` (no `_invoice_reminder_2_sent_at` meta yet), with a BCC to the treasurer

Eligible invoices are membership invoices where the member has not yet chosen a payment plan (no `_installment_plan` meta) plus discipline and manual invoices identified through Mollie payment-link metadata. Membership invoices that already selected a plan are reminded by the installment flow instead.

**The reminder wording depends on `invoice_type`.** `InvoiceReminderSender::is_membership_invoice()` splits the templates in two families so a manual or discipline invoice never receives contributie-specific text (e.g. "je contributie", plan selection, installments):

| `invoice_type` | Reminder 1 option | Reminder 2 option |
|----------------|-------------------|-------------------|
| `membership` | `rondo_finance_invoice_reminder_1_email_template` | `rondo_finance_invoice_reminder_2_email_template` |
| `manual`, `discipline` (and any other/empty) | `rondo_finance_generic_invoice_reminder_1_email_template` | `rondo_finance_generic_invoice_reminder_2_email_template` |

Each family also has its own heading option (`..._email_heading`). Both families are edited under **Instellingen → Financieel → Factuurherinneringen** ("Herinneringen voor contributiefacturen" vs. "Herinneringen voor overige facturen") and are testable via the finance test-email endpoint with `template_type` `invoice_reminder_1`/`invoice_reminder_2` (contributie) or `generic_invoice_reminder_1`/`generic_invoice_reminder_2` (overige).

**Available placeholders:** `{naam}`, `{voornaam}`, `{factuur_nummer}`, `{totaal_bedrag}`, `{betaallink}`, `{betaalknop}`, `{qr_code}`, `{factuurdatum}`, `{dagen_sinds_factuur}`, `{organisatie_naam}`.

### Sending Test Emails

The invoice detail screen now exposes a `Verstuur testmail` action for invoices in status `draft`, `sent`, or `overdue`.

Behavior:
- Accepts an explicit recipient address entered by the finance user.
- Uses the existing invoice send/resend endpoints with the `recipient` request field.
- Forces the invoice mailer to send only to that override address and suppresses BCC.
- Keeps the `[TEST]` subject prefix from `InvoiceEmailSender`.
- For `draft` invoices, the test send does **not** transition the invoice to `sent`; it remains a draft after the preview mail is sent.

### Scheduled Sending

A draft invoice can be queued to send automatically on a future date instead of immediately.

- **Storage:** `_scheduled_send_date` (Ymd) and `_scheduled_send_by_user_id` post meta on the draft. The invoice stays `rondo_draft` while queued — there is no separate status — so every existing draft/send code path is unchanged.
- **Setting it:** three entry points, all writing the same meta:
  - The `Automatisch verzenden op` date field in the create/edit form (`prepare_invoice_payload` / `persist_invoice_payload`).
  - The schedule control on the invoice detail page and the bulk "Inplannen voor…" action on the Facturen overview, both via `POST /rondo/v1/invoices/{id}/schedule` (`scheduled_send_date` param; empty clears the schedule). Bulk loops the endpoint client-side.
- **Sending:** `InvoiceScheduledSendScheduler` (`includes/class-invoice-scheduled-send-scheduler.php`) registers a daily cron (`rondo_invoice_scheduled_send_sweeper`, ~06:00) that finds `rondo_draft` invoices with `_scheduled_send_date <= today` and runs each through the normal send flow. It calls `Invoices::send_invoice()` after `wp_set_current_user()` to the scheduling user, so the send is attributed correctly. The cron self-schedules on `init` if missing, so existing installs pick it up without a theme reactivation.
- **Clearing:** `send_invoice()` deletes the schedule meta on a successful send, and a manual "Verstuur nu" also clears it. A failed scheduled send keeps the meta and is retried on the next daily run. Editing the invoice out of draft status drops any stale schedule.
- **Response field:** `scheduled_send_date` (Ymd or null) is included on both the list and detail invoice responses; the UI shows an "Ingepland · {date}" badge for scheduled drafts.

### Copying an Invoice into a New Draft

Both the Facturen overview (per-row copy icon) and the invoice detail screen ("Kopiëren naar nieuwe factuur") link to `/financien/facturen/nieuw?copyFrom={id}`, available to users with financial edit rights.

`FactuurNieuw` reads the `copyFrom` query param, fetches the source invoice, and seeds `InvoiceDraftForm` with `mapInvoiceToInitialValues(source, { copy: true })` (`src/utils/invoiceFormValues.js` — the same mapper the draft edit screen uses). Person/customer, line items, amounts, email subject/body override, custom fields, and payment account carry over. The due date is reset to a fresh payment term, and no invoice number, status, payment link, QR, or sent metadata is copied — the copy is a plain new draft that gets its own number when sent.

Because contributie invoices are generated automatically (with a payment page and installment context), copying a `membership` invoice creates it as a `manual` invoice; `manual` and `discipline` keep their type. No new backend endpoint is involved — the copy goes through the standard `POST /rondo/v1/invoices` create flow after the user reviews and saves.

### Installment Processing

The `InstallmentScheduler` runs on WP-Cron and:
1. Checks for installments with upcoming due dates
2. Triggers `InstallmentEmailSender` to send payment request emails
3. Creates individual Mollie payment links per installment
4. Updates installment status as payments are received via `MollieWebhook`

### Toggling Installments per Invoice

Individual invoices can have installments enabled/disabled via:

`POST /rondo/v1/invoices/{id}/toggle-installments` with `{ "disabled": true/false }`

This allows admins to override the plan for specific members.

## Adjusting Discounts On Sent Membership Invoices

For membership invoices that are already sent but still unpaid, finance users can update family discount and instapkorting percentages directly on the invoice detail page.

### Endpoint

- **POST** `/rondo/v1/invoices/{id}/membership-discount`
- **Body:** `{ "family_discount_percent": 0..100, "entry_discount_percent": 0..100 }` (one or both fields)
- **Permission:** `financieel`

### Guardrails

- Only works for `membership` invoices.
- Only works for invoice status `sent` or `overdue` (not `draft` or `paid`).
- Blocked when any installment is already paid (`_installment_{N}_status = betaald`).
- Blocked when installment payment links were already issued (`_installment_{N}_mollie_payment_id` exists), to avoid stale external payment links.

### What Gets Updated

- Updates or inserts the `Gezinskorting (X%)` and `Instapkorting (Y%)` line items in `line_items`.
- Recalculates and stores `total_amount`.
- Clears the stored invoice PDF (`pdf_path`) so totals in shared PDFs cannot become stale.

## Adjusting Totals On Draft Invoices

Finance users can add a manual correction line to any draft invoice to adjust the total amount before sending.

### Endpoint

- **POST** `/rondo/v1/invoices/{id}/draft-line-items`
- **Body:** `{ "description": "Correctie", "amount": -12.50 }`
- **Permission:** `financieel`

### Behavior

- Only works when invoice post status is `rondo_draft`.
- Appends a new line item with no linked discipline case.
- Accepts both positive amounts (extra costs) and negative amounts (discounts).
- Recalculates and stores `total_amount`.
- Clears `pdf_path` so a stale draft PDF cannot be reused.
- Draft invoices can also be marked directly as paid from invoice detail (without sending first), behind a required confirmation dialog.
- PDFs generated for paid invoices now include a large `BETAALD` watermark and omit payment QR codes.

## Editing Draft Invoices

Conceptfacturen kunnen volledig worden bijgewerkt zolang ze nog status `rondo_draft` hebben.

### Endpoint

- **POST** `/rondo/v1/invoices/{id}/draft-details`
- **Permission:** `financieel`

### Behavior

- Hergebruikt dezelfde validatie en invoervelden als het formulier voor `Nieuwe factuur`.
- Werkt alleen voor conceptfacturen; verstuurde of betaalde facturen geven een `invoice_not_draft` fout terug.
- Ondersteunt ook `customer_attention`, `customer_email`, `custom_fields`, vervaldatum en alle factuurregels.
- Leegt `pdf_path` na wijzigingen zodat een bestaande concept-PDF niet verouderd kan blijven.

## External Manual Invoice Recipient Fields

Manual invoices for external recipients support extra recipient metadata in addition to `customer_name` and `customer_address`.

### Create Payload

- **POST** `/rondo/v1/invoices`
- **Relevant fields for external/manual invoices:**
  - `customer_name`
  - `customer_attention`
  - `customer_email`
  - `customer_cc_email`
  - `customer_address`
  - `payment_account_id`

### Behavior

- `customer_attention` is stored on the invoice and rendered on the PDF directly below the customer name as `T.a.v. {value}` when present.
- `customer_email` is stored on the invoice, shown in invoice detail, rendered on the PDF below the attention line, and included in the recipient list when the invoice is sent.
- `customer_cc_email` is stored on the invoice, shown in invoice detail, not rendered on the PDF, and sent as a real `Cc:` header when the invoice email is delivered.
- `customer_email` is validated as an email address when provided, but remains optional so external invoices without an email can still be saved as draft.
- `customer_cc_email` is also validated as an email address when provided, and remains optional.
- `custom_fields` (max 2) are shown below `Vervaldatum` on invoice detail and now also render in the same metadata block on the PDF.
- When a field label is `Ter attentie van`, the detail view removes a leading `T.a.v.` from the stored value to avoid duplicate wording.
- `payment_account_id` stores the selected bank account snapshot on the invoice, so the chosen IBAN and account holder remain visible in invoice detail, PDFs, and provider-driven payment flows.

## Multiple Bank Accounts

Finance settings now support multiple bank accounts in the `Betaling` tab.

### Configuration

- Each account stores:
  - `internal_name`
  - `account_holder`
  - `iban`
  - `linked_provider` (`''`, `rabobank`, or `mollie`)
- At most one account can be linked to each payment provider.
- The bank account linked to the active payment provider becomes the default choice on new draft invoices.

### Invoice behavior

- Draft invoice create/edit flows expose a bank-account selector.
- The selected account is snapshotted onto the invoice as payment metadata.
- Invoice detail and PDF `Betaalgegevens` render the chosen account instead of a single global IBAN.
- Rabobank payment requests read the snapshotted invoice IBAN, so the provider uses the same account shown on the invoice.

## Contributie Exclusion Notifications (v31.11.0+)

When a user toggles the "Uitsluiten van contributie" setting on a person, the system sends an email notification to board members.

### Trigger

The notification is sent from `FeeCacheInvalidator::log_contributie_exclusion_toggle()` after the exclusion status is saved and the timeline activity comment is recorded.

### Recipients

Recipients are determined by `Rondo\Core\RoleFinder`, which searches for users whose `work_history` ACF field contains a current (no end date) entry with the specified job title keyword:

1. **Secretaris** — users with current work history entry containing "Secretaris" (case-sensitive, so "Wedstrijdsecretaris" does not match)
2. **Penningmeester** — users with current work history entry containing "Penningmeester" (case-sensitive)

Both lists are merged and deduplicated. If no Secretaris or Penningmeester is found, the system falls back to WordPress administrators.

### Email Content

- **Subject (exclusion):** `{person name} uitgesloten van contributiebetaling`
- **Subject (re-inclusion):** `{person name} opgenomen in contributiebetaling`
- **Body:** Branded HTML email rendered via `Rondo\Notifications\EmailTemplate::render()` containing:
  - Person name (linked to `/people/{id}`)
  - Actor name (the user who toggled the setting, or "Systeem" in cron context)
  - Timestamp of the action
  - CTA button linking to the person's detail page

### Error Handling

- Email sending is wrapped in a try/catch block
- Failures are logged via `error_log()` with the message: `[Rondo Contributie] Failed to send exclusion notification for person {id}: {error}`
- Email send failures do **not** block the exclusion toggle — the action completes regardless

### UI Confirmation

Before toggling the exclusion status, the frontend shows a `window.confirm()` dialog:

- **Exclude:** "Weet je zeker dat je dit lid wilt uitsluiten van contributie?"
- **Re-include:** "Weet je zeker dat je dit lid weer wilt opnemen in de contributiebetaling?"

After confirmation, the FinancesCard refreshes immediately via TanStack Query invalidation (no page reload required).

### RoleFinder Helper

The `Rondo\Core\RoleFinder` static helper class provides reusable role-based user lookup:

```php
// Find user IDs with a current "Secretaris" role in their work history
$user_ids = \Rondo\Core\RoleFinder::get_user_ids_by_role('Secretaris');

// Find user IDs with a current "Penningmeester" role
$user_ids = \Rondo\Core\RoleFinder::get_user_ids_by_role('Penningmeester');
```

Returns an array of WordPress user IDs. Falls back to administrator user IDs if no matching users are found.

Also used by `LettermintWebhook` for Secretaris notification on new member signup.

## Version History

- **v31.11.0** (2026-03-12): Added confirmation dialog, immediate FinancesCard refresh, and email notification to Secretaris/Penningmeester on contributie exclusion toggle. Extracted reusable `RoleFinder` helper class.
- **v31.6.42** (2026-03-06): Removed the duplicate `Ter attentie van` row from invoice detail; the normalized value now renders only once.
- **v31.6.41** (2026-03-06): Removed the internal bank-account label from invoice payment details; only IBAN and account holder remain visible.
- **v31.6.40** (2026-03-06): Removed the duplicate lower `Bewerk concept` action from invoice detail; the header button remains the single edit entry point.
- **v31.6.39** (2026-03-06): Moved the manual external invoice `E-mail` and `CC` fields onto the same row in the draft form.
- **v31.6.38** (2026-03-06): Added a separate CC email field for manual external invoices; it is not shown on PDFs but is included as a mail CC recipient.
- **v31.6.37** (2026-03-06): Added multi-bank-account finance settings, per-invoice account selection, and invoice/PDF payment details based on the selected account.
- **v31.6.36** (2026-03-06): Moved `Bewerk concept` to the invoice header, removed duplicate `T.a.v.` wording in invoice detail, and rendered manual invoice custom fields in the PDF metadata block.
- **v31.6.35** (2026-03-06): Added full draft-invoice editing via `POST /rondo/v1/invoices/{id}/draft-details` and a shared draft form for create/edit flows.
- **v31.6.34** (2026-03-06): Added `Ter attentie van` and external invoice email fields for manual external invoices; both now appear on PDFs and the external email can be used as send recipient.
- **v31.0.21** (2026-02-27): Credit invoice PDFs now include a `CREDIT` watermark in the same style as paid-invoice watermarks.
- **v31.0.20** (2026-02-27): Credit invoice creation now preserves user-entered positive and negative line amounts instead of forcing all credit lines negative.
- **v31.0.19** (2026-02-27): Fixed paid-PDF generation error by passing watermark color in mPDF-supported hex format.
- **v31.0.18** (2026-02-27): Paid PDFs now omit the `Betaalgegevens` section and render `BETAALD` in the primary club color.
- **v31.0.17** (2026-02-27): Paid PDF watermark rendering switched to native mPDF watermarking to enforce 45° angle and 50% opacity consistently.
- **v31.0.16** (2026-02-27): Paid invoice detail now hides legacy payment links consistently (API + UI) and paid PDF watermark is rendered at 45° with 50% opacity.
- **v31.0.15** (2026-02-27): Marking an invoice as paid now automatically clears payment links, provider payment IDs, and QR code.
- **v31.0.14** (2026-02-27): Paid invoice detail now offers `Genereer PDF` when no PDF exists yet, instead of a disabled download button.
- **v31.0.13** (2026-02-27): Paid invoice PDFs now show a `BETAALD` watermark and no longer include payment QR codes.
- **v31.0.12** (2026-02-27): Added a draft invoice detail action to mark invoices directly as paid (without sending), guarded by a confirmation dialog.
- **v31.0.11** (2026-02-27): Added manual draft-invoice correction lines via `POST /rondo/v1/invoices/{id}/draft-line-items` and invoice-detail UI action.
- **v31.0.3** (2026-02-26): Expanded sent/unpaid membership invoice adjustment to support both family discount and instapkorting percentages.
- **v31.0.2** (2026-02-26): Added sent/unpaid membership invoice family-discount adjustment endpoint and UI action with installment-link safety guards.
- **v21.1** (2026-02-09, Phase 161): Configurable team and werkfunctie matching rules with admin UI, migration helpers, and werkfuncties/available endpoint
- **v21.1** (2026-02-09, Phase 160): Configurable family discount percentages per season with copy-forward pattern and REST API integration
- **v21.0** (2026-02-09, Phase 157): REST API updates with full category CRUD, structured validation (errors vs warnings), and category metadata in fee list endpoint
- **v21.0** (2026-02-08, Phase 156): Config-driven fee calculation with `age_classes` arrays and dynamic helper methods
- **v21.0** (2026-02-08, Phase 155): Per-season fee category configuration with copy-forward
- **v18.1.0** (2026-02-05): Per-season fee storage with automatic migration
- Previous: Global fee settings (single option for all seasons)
