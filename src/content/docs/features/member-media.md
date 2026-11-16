---
title: Private member photos
---

Profile and Sportlink photo uploads use the
[person photo endpoint](/api/people/#upload-profile-photo). WordPress creates
the attachment and derivatives in a private directory outside its document root
(`rondo-private/member-media`, alongside the WordPress installation). New photos
get random filenames. The attachment remains linked to the person as their
featured image.

## Serving photos

Use the returned image URLs for display in the signed-in app. Private images use
`/?rondo_member_media={attachment_id}&size={size}` with the WordPress login
cookie. `GET` serves the image and `HEAD` returns its headers. The response is
private and non-cacheable. The route returns HTTP 403 if access fails and HTTP
404 if an authorized request cannot resolve the requested image size.

Person references include the attachment parent, profile thumbnail and photo
gallery. Non-admin viewers must be able to view every associated published
person. Unlinked private photos remain private. WordPress attachment reads,
collection counts, media selection and attachment pages apply this access check.
Private responses omit physical file paths. Listing lookups batch profile and
gallery references, and a single-image read resolves references for that image.

Use the dedicated upload route for member photos. Generic media uploads to a
person and attempts to attach a public image as their profile or gallery photo
are rejected. Club TV also rejects member photos as public display assets.

## Migrating existing attachments

`wp rondo member-media inventory` identifies existing person attachments and
images referenced as profile or gallery photos. Add `--ids=ID1,ID2` to inventory
only selected attachments. The operator runs `migrate` with explicit `--ids` or
`--all`. Migration locks each attachment, copies the original and derivatives,
checks their SHA-256 hashes, updates WordPress attachment paths and confirms the
private reference before removing the matching public files. It preserves
attachment IDs and person relationships. The manifest allows an interrupted
cleanup to resume. Changed or ambiguous source files are retained for review.

Run `wp rondo member-media verify` with the same scope to check private copies,
derivatives and removal of the old files from the origin. Inventory and
verification report counts and attachment IDs for errors without names or image
URLs. Include private storage in backups. When a CDN cached former public
copies, check those URLs through the CDN separately from origin verification.
