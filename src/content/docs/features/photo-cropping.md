---
title: Profile photo cropping
---

Rondo Club 35.61.0 opens a square crop editor when an authorized user selects a profile photo on a person's detail page. Existing photo-edit permissions, including former-member restrictions, still apply.

Users can drag with one finger, pinch with two fingers, zoom with the slider from 1–4×, or position the photo with arrow keys. Lifting one finger during a pinch allows panning to continue without a jump. Reset restores the centered crop; cancel leaves the current profile photo unchanged. The editor stays scrollable on small screens so its save and cancel buttons remain reachable.

Saving exports only the selected square as a JPEG up to 800 × 800 pixels, without enlarging a smaller crop. The canvas export removes source metadata and makes animated images still. The existing 5 MB input limit applies; unsupported image formats show an error in the editor. Upload failures keep the crop open for retry. The existing person photo endpoint saves the result, and the person cache refreshes afterwards.

`src/components/PhotoCropModal.jsx` is loaded on demand by `PersonDetail.jsx`. Preview and export share `src/utils/photoCrop.js`; gesture calculations are covered by `tests/js/photoCrop.test.mjs`. The standalone fixture in `tests/fixtures/photo-crop-preview.html` uses the actual component and performs no API upload.

The user confirmed the standalone practical test in Chrome on an iPhone on 12 September 2026, including the provided pinch, pan, reset and save checklist. Cropping was released in 35.61.0; [automatic Sportlink photo sync](/sync/photo-sync/) follows in 35.62.0.
