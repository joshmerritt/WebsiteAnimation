# Changelog

## [Unreleased]

---

## [2026-02-28] — React Migration & Polish

### Fixed
- **Double-click to open**: Three separate bugs resolved:
  - `ball.pageOpen` was never reset when the React close button dismissed the modal, causing `showDetail()` to return early forever on that ball
  - Doubled tap detection window from 300 ms → 450 ms for mobile reliability
  - Added minimum power threshold (`> 2`) to prevent touch jitter from triggering an accidental launch on the first tap, which broke second-tap detection
- **ESC key close**: `removeDetailPage()` now routes through `window.ui.closeDetail()` so ESC and the React X button follow the same close path and both properly reset ball state
- **Orientation change**: `categories[]` now resets before `createBalls()` in `windowResized()`, preventing stale state accumulation across orientation changes
- **Mobile ball launch**: Added explicit `touchStarted`, `touchMoved`, `touchEnded` handlers — `mouseReleased` is not reliably triggered by `touchend` on all mobile browsers

### Changed
- **Detail panel redesigned** as a proper centered modal:
  - Full-screen backdrop with `backdrop-filter: blur`
  - Card animates in with CSS keyframes (scale + translateY)
  - Hero image at top of card with gradient overlay and title
  - Clean info table with labeled rows and "View Project ↗" CTA
  - Clicking backdrop closes modal
  - Responsive: portrait/mobile gets tighter layout and shorter hero

### Added
- **Site Analytics ball** (`SiteAnalytics`) — links to standalone `analytics-dashboard.html`
- **analytics-dashboard.html** — self-contained React analytics dashboard page (CDN Babel, no build step)
- **The Wine You Drink ball** (`thewineyoudrink`) — links to thewineyoudrink.web.app
- **Black Sheep Dart League ball** (`dartleague`) — links to theblacksheepdartleague.web.app
- **`cpanel.yml`** — cPanel GitHub auto-deploy configuration

### Migrated — React UI Overlay
Replaced all p5.js DOM calls with a React component overlay. Key changes across all files:

- **`App.jsx`** *(new)*: React component managing detail modal and reset button via `window.ui` bridge
- **`index.html`**: CDN links for p5.js, matter.js, React 18, and Babel standalone; added `#react-root`
- **`sketch.js`**: Removed p5.js DOM calls; added `window.onReset` / `window.onDetailClosed` bridge callbacks
- **`imageBall.js`**:
  - Canvas clipping (`drawingContext.save/clip/restore`) replaces destructive `img.mask()` which corrupted images progressively in p5.js v1.x
  - Detail panel delegated to React via `window.ui.openDetail()`
- **All physics classes** (`boundary.js`, `goal.js`, `menu.js`, `net.js`, `contactUs.js`): `Matter.Composite` replaces deprecated `Matter.World` (required for matter.js v0.19+)
- **`sketch.js` collision fix**: `event.pairs` replaces `event.source.pairs.collisionActive`
- **`main.css`**: CSS custom properties, proper overlay/pointer-events layout, improved modal styling

### Content
- `arduinoCoopDoor` category changed: `Farm` → `Technology`

---

## [2022] — Previous Updates

- Image updates and link cleanup
- Responsive sizing improvements
- Demo mode on initial load
- Touch support for mobile
- Category filtering via menu click
- Double-click to open detail page
- Various gameplay sensitivity and power tuning
