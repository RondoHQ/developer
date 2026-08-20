---
title: "Abilities API"
---

Rondo Club registers a small read-only surface with the WordPress Abilities API. These abilities provide typed, discoverable operations for REST clients, MCP adapters, AI agents, WP-CLI, and server-side PHP without granting broader access than the signed-in user has in Rondo.

WordPress 7.1 or newer is required. Rondo abilities use the 7.1 `public` exposure flag and client-compatible schemas.

## Available abilities

| Ability | Purpose |
|---|---|
| `rondo/search-records` | Search accessible people, teams, and committees by name, email, KNVB ID, or another identifying value |
| `rondo/get-record` | Read one accessible person, team, or committee with canonical fields |
| `rondo/get-field-schema` | Inspect the client-safe canonical field contract for a record type |

All three abilities are annotated as read-only, non-destructive, and idempotent. They are exposed to both WordPress REST clients and the Novamira MCP adapter, but both transports require an authenticated WordPress user and every execution still runs the ability's Rondo permission callback. Mutating operations intentionally remain on Rondo's existing domain APIs until their write policies can be shared without bypassing business rules.

## Discovery

Authenticated users can discover the Rondo namespace through WordPress Core:

```http
GET /wp-json/wp-abilities/v1/abilities?namespace=rondo
```

The response includes the ability label, description, category, input and output JSON Schemas, annotations, and execution link.

Setting `public: true` enables WordPress REST exposure, while `mcp.public: true` enables MCP adapter exposure. Neither setting makes the ability anonymous: REST discovery requires the WordPress `read` capability and every REST or MCP execution still runs its permission callback.

## Search records

```http
GET /wp-json/wp-abilities/v1/abilities/rondo/search-records/run?input[query]=Ajax&input[contexts]=person&input[limit]=10
```

Inputs:

| Field | Type | Required | Description |
|---|---|---|---|
| `query` | string | Yes | Search text, between 2 and 100 characters |
| `contexts` | array | No | Any of `person`, `team`, and `commissie`; defaults to all three |
| `limit` | integer | No | Maximum 1–50 results; defaults to 10 |

Search results contain only compact record summaries. They never include native field values. WordPress query filters apply Rondo's person visibility rules before results are returned.

## Get a record

```http
GET /wp-json/wp-abilities/v1/abilities/rondo/get-record/run?input[id]=123&input[fields]=first_name,last_name
```

`id` is required. `fields` is an optional array of canonical field names; omitting it returns every field visible to the current user.

Person access uses the same three-tier policy as the REST API: management users can read the whole club, coordinators are restricted to configured age groups, and plain members can read only their household. Canonical output also passes through the normal sensitive-field filters for finance, support, and sponsor data.

Requesting an unknown field or a field hidden from the current user returns `rondo_ability_field_unavailable`.

## Get the field schema

```http
GET /wp-json/wp-abilities/v1/abilities/rondo/get-field-schema/run?input[context]=person
```

The response contains the registry version and client-safe definitions with:

- canonical name;
- label and description;
- Rondo field type;
- required, read-only, and multiple-value flags;
- nested repeater fields.

Storage keys and server-only implementation details are never exposed. Person schema discovery follows the same household and sensitive-field visibility rules as record reads.

## PHP usage

```php
$ability = wp_get_ability( 'rondo/get-record' );
$result  = $ability->execute(
    array(
        'id'     => 123,
        'fields' => array( 'first_name', 'last_name' ),
    )
);
```

Always handle `WP_Error`. Direct PHP execution still performs normalization, schema validation, and permission checks.

## Implementation

Abilities and the `rondo-records` category are registered by `Rondo\Abilities\Registrar` on `wp_abilities_api_categories_init` and `wp_abilities_api_init`. The registrar is loaded on every request so the same abilities exist for REST, WP-CLI, MCP, cron, and direct PHP consumers.

Use the global `wp_ability_invoked` action for auditing or invocation accounting. Its input is raw and may contain personal data, so do not log ability inputs indiscriminately.
