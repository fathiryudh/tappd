# Progress

## What We Accomplished

### UI Refresh (`ui-landing-refresh` branch — current session)
- Rebuilt the auth layout (`client/src/pages/auth/AuthLayout.jsx`):
  - Replaced the old verbose left panel (notes cards, eyebrow labels, sideLabel, formLabel) with a clean HeroHighlight panel.
  - Created `client/src/components/ui/HeroHighlight.jsx` — dot-pattern background with mouse-tracked indigo highlight reveal and animated `Highlight` text span.
  - Left panel shows "Yappd" with a bounce-in animation and a 2-line tagline with the highlighted portion using `box-decoration-break: clone` so it wraps cleanly.
  - Layout is fully responsive: hero panel is a `42vh` banner on mobile/tablet, full-height side column on desktop (`xl`).
  - Removed all the old SVG hand-drawing animation code.
- Cleaned up `Login.jsx` and `Register.jsx` — removed `NOTES` arrays and all the now-unused props passed to `AuthLayout`.
- Fixed `Dashboard.jsx` for desktop: outer container is now `h-[100dvh] overflow-hidden`, content area (`OfficerList`, `RosterView`) scrolls internally — the page shell no longer scrolls.

## Current State
- Branch: `ui-landing-refresh`.

## Next Steps
- Commit and push the UI refresh changes on `ui-landing-refresh`.
- Merge `ui-landing-refresh` → `main` when ready for production.
