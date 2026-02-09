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
