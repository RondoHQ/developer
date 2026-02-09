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

## Version History

- **v21.1** (2026-02-09, Phase 161): Configurable team and werkfunctie matching rules with admin UI, migration helpers, and werkfuncties/available endpoint
- **v21.1** (2026-02-09, Phase 160): Configurable family discount percentages per season with copy-forward pattern and REST API integration
- **v21.0** (2026-02-09, Phase 157): REST API updates with full category CRUD, structured validation (errors vs warnings), and category metadata in fee list endpoint
- **v21.0** (2026-02-08, Phase 156): Config-driven fee calculation with `age_classes` arrays and dynamic helper methods
- **v21.0** (2026-02-08, Phase 155): Per-season fee category configuration with copy-forward
- **v18.1.0** (2026-02-05): Per-season fee storage with automatic migration
- Previous: Global fee settings (single option for all seasons)
