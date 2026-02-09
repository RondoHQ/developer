---
title: Former Members
---

Former members are individuals who were previously active members of the club but are no longer active. The system tracks former member status and provides visibility controls to make them discoverable when needed.

## Data Model

### ACF Field

Former member status is stored in the `former_member` ACF field:

- **Field name:** `former_member`
- **Field type:** True/False
- **Managed by:** rondo-sync (read-only in the UI)
- **Values:**
  - `true` (stored as `'1'` string): Person is a former member
  - `false` or `NULL`: Person is a current member

This field is automatically synced from Sportlink Club via rondo-sync and should not be manually edited in the WordPress admin.

## Default Filtering Behavior

Former members are excluded from default views to reduce clutter. This filtering is applied at the database query level for performance.

### Excluded From

1. **People List** (`/rondo/v1/people/filtered`)
   - Default behavior: Former members excluded
   - SQL exclusion pattern: `(fm.meta_value IS NULL OR fm.meta_value = '' OR fm.meta_value = '0')`

2. **Dashboard Recent People** (`/rondo/v1/dashboard`)
   - Recently modified people exclude former members

3. **Team Rosters**
   - Team member lists exclude former members

### Included In (Always)

1. **Global Search** (`/rondo/v1/search`)
   - Former members always appear in search results
   - Results include `former_member` flag for visual indication

2. **Person Detail Page**
   - Direct access via URL always works regardless of former member status

3. **Dashboard Recent Contacts**
   - Activity tracking includes former members (to preserve historical context)

## Visibility Controls

### Backend: `include_former` Parameter

The filtered people endpoint accepts an optional `include_former` parameter:

```
GET /wp-json/rondo/v1/people/filtered?include_former=1
```

**Parameter:**
- `include_former`: String
- Values: `'1'` (include former members) or empty string (exclude, default)
- Validation: Must be either `''` or `'1'`

**Implementation:**

```php
// In includes/class-rest-people.php
if ( $include_former !== '1' ) {
    // Default: exclude former members
    $where_clauses[] = "(fm.meta_value IS NULL OR fm.meta_value = '' OR fm.meta_value = '0')";
}
```

The LEFT JOIN on the `former_member` meta field is always present (for both included and excluded cases) because the query needs to return the `former_member` value in the response.

### Frontend: "Toon oud-leden" Toggle

The People List page (`/people`) includes a toggle control in the filter dropdown:

**URL Parameter:**
- `?oudLeden=1`: Show former members
- No parameter: Hide former members (default)

**UI Location:**
- Filter dropdown (top of filter list)
- Styled as a toggle switch with "Toon oud-leden" label

**Behavior:**
- Toggle state persisted in URL params
- Cleared by "Alle filters wissen" button
- Counted in active filters badge
- Triggers selection reset on change

### Visual Indicators

#### People List Rows

Former members shown in the list have two visual distinctions:

1. **"Oud-lid" badge:** Gray badge next to person's name
2. **Reduced opacity:** `opacity-60` on entire row

```jsx
<tr className={`... ${person.former_member ? 'opacity-60' : ''}`}>
  <td>
    <span>{person.name}</span>
    {person.former_member && (
      <span className="... bg-gray-200 text-gray-600">Oud-lid</span>
    )}
  </td>
</tr>
```

#### Global Search Results

Search results show "Oud-lid" badge next to former member names:

```jsx
<span>{person.name}</span>
{person.former_member && (
  <span className="... bg-gray-200 text-gray-600">Oud-lid</span>
)}
```

## API Response Format

### `format_person_summary()`

The `format_person_summary()` method in `includes/class-rest-base.php` includes the `former_member` field in all person summary responses:

```php
protected function format_person_summary( $post ) {
    return [
        'id'             => $post->ID,
        'name'           => $this->sanitize_text( $post->post_title ),
        'first_name'     => $this->sanitize_text( get_field( 'first_name', $post->ID ) ),
        'last_name'      => $this->sanitize_text( get_field( 'last_name', $post->ID ) ),
        'thumbnail'      => $this->sanitize_url( get_the_post_thumbnail_url( $post->ID, 'thumbnail' ) ),
        'labels'         => wp_get_post_terms( $post->ID, 'person_label', [ 'fields' => 'names' ] ),
        'former_member'  => ( get_field( 'former_member', $post->ID ) == true ),
    ];
}
```

**Note:** Uses loose comparison (`== true`) because ACF true_false fields return `'1'` (string) when true.

This method is used by:
- Global search (`/rondo/v1/search`)
- Dashboard recent people/contacts (`/rondo/v1/dashboard`)
- Any other endpoints that return person summaries

### Filtered People Response

The filtered people endpoint returns `former_member` as a boolean in each person object:

```json
{
  "people": [
    {
      "id": 123,
      "first_name": "Jan",
      "last_name": "Jansen",
      "former_member": true,
      ...
    }
  ],
  "total": 150,
  "page": 1,
  "total_pages": 2
}
```

**Implementation:**

```php
// In get_filtered_people() response formatting
$person = [
    'id'            => (int) $row->ID,
    'first_name'    => $this->sanitize_text( $row->first_name ?: '' ),
    'last_name'     => $this->sanitize_text( $row->last_name ?: '' ),
    'former_member' => ( $row->is_former_member === '1' ),
    ...
];
```

## Export Behavior

When exporting to Google Sheets, the `include_former` filter is preserved:

```javascript
const filters = {
  ...otherFilters,
  include_former: includeFormer || undefined,
};
```

If "Toon oud-leden" is enabled when exporting, former members will be included in the export.

## Contributie Logic

Former members are handled specially in the membership fee (contributie) system. The key principle: **former members only appear in the fee list if they were active during the season** (lid-sinds before season end).

### Season Eligibility

The `is_former_member_in_season()` method determines if a former member should be included in a season's fee list:

```php
public function is_former_member_in_season( int $person_id, ?string $season = null ): bool {
    $is_former = ( get_field( 'former_member', $person_id ) == true );
    if ( ! $is_former ) {
        return false;
    }

    $lid_sinds = get_field( 'lid-sinds', $person_id );
    if ( empty( $lid_sinds ) ) {
        return false; // Cannot determine without membership date
    }

    // Season ends on July 1 of the end year (e.g., 2026-07-01 for 2025-2026)
    $season_end_year = (int) substr( $season, 5, 4 );
    $season_end_date = strtotime( $season_end_year . '-07-01' );
    $lid_sinds_ts = strtotime( $lid_sinds );

    return ( $lid_sinds_ts < $season_end_date );
}
```

**Eligibility criteria:**
- **Included:** Former members whose `lid-sinds` is BEFORE the season end date (July 1)
- **Excluded:** Former members whose `lid-sinds` is AFTER the season end date, or who have no `lid-sinds`

**Examples (for season 2025-2026):**
- Member joined 2025-09-01, left 2026-01-15 → **Included** (joined before 2026-07-01)
- Member joined 2026-08-01, left 2026-12-15 → **Excluded** (joined after 2026-07-01)

### Pro-Rata Calculation

Former members use the **same pro-rata calculation as active members**. Their fee is based on when they **joined** (lid-sinds), not when they left:

- Member who joined before season start (e.g., 2024-05-01) → 100% of base fee
- Member who joined mid-season (e.g., 2025-12-01) → Pro-rata from December onward

**Leaving the club does NOT create a second pro-rata calculation.** If a member joined in September and left in January, they still pay the September-onward fee.

### Forecast Exclusion

Former members are **always excluded** from fee forecasts (next season calculations):

```php
// In get_fee_list() and fetch_fee_data()
if ( $forecast && $is_former ) {
    continue; // Former members won't be members next season
}
```

This prevents former members from appearing in budget projections for future seasons.

### Family Discount Handling

The family discount calculation (`build_family_groups()`) excludes ineligible former members:

```php
// In build_family_groups()
$is_former = ( get_field( 'former_member', $person_id ) == true );
if ( $is_former && ! $this->is_former_member_in_season( $person_id, $season ) ) {
    continue; // Skip former members not in this season
}
```

This ensures that:
- Former members who left before the season don't incorrectly reduce family discounts
- Only eligible former members (lid-sinds before season end) participate in family grouping

### Cache Invalidation

The fee cache is automatically cleared when the `former_member` field changes:

```php
// In includes/class-fee-cache-invalidator.php
add_filter( 'acf/update_value/name=former_member', [ $this, 'invalidate_person_cache' ], 10, 3 );
```

This ensures that when rondo-sync marks a member as former, their fee is immediately recalculated with the new eligibility logic.

### API Response Fields

Fee API endpoints include the `is_former_member` flag in responses:

**Fee list endpoint** (`/rondo/v1/fees`):
```json
{
  "season": "2025-2026",
  "members": [
    {
      "id": 123,
      "first_name": "Jan",
      "last_name": "Jansen",
      "is_former_member": true,
      "category": "senior",
      "final_fee": 180.00,
      ...
    }
  ]
}
```

**Single person fee endpoint** (`/rondo/v1/fees/person/{id}`):
```json
{
  "person_id": 123,
  "season": "2025-2026",
  "calculable": false,
  "is_former_member": true,
  "message": "Oud-lid valt niet binnen dit seizoen."
}
```

**Calculation status** (`get_calculation_status()`):
```php
[
    'is_former_member' => true,
    'former_member_in_season' => false,
    'calculable' => false,
    'reason' => 'former_member_not_in_season',
    ...
]
```

### Google Sheets Export

The Google Sheets export (`/rondo/v1/google-sheets/sync`) applies the same former member rules:

- Eligible former members (lid-sinds before season end) are included
- Ineligible former members are excluded
- Forecast exports exclude all former members

## NULL-Safe Filtering Pattern

The exclusion query uses a NULL-safe pattern to handle cases where the `former_member` meta field doesn't exist:

```php
$where_clauses[] = "(fm.meta_value IS NULL OR fm.meta_value = '' OR fm.meta_value = '0')";
```

This ensures that people without a `former_member` field are treated as current members (fail-safe behavior).

## Related

- [Access Control](/features/access-control/) - How former member filtering integrates with user permissions
- [REST API](/api/people/) - People endpoints and filtering parameters
- [Dashboard](/api/dashboard/) - Dashboard endpoint behavior with former members
