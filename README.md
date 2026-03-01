# Da Data Dad — Portfolio v2

Interactive physics-based portfolio by Josh Merritt. Rebuilt with Vite, React 18, p5.js (instance mode), and matter.js.

## Quick Start

```bash
npm install
npm run dev
```

## Project Structure

```
├── index.html                 # Vite entry — main portfolio
├── analytics-dashboard.html   # Vite entry — analytics dashboard
├── package.json
├── vite.config.js
├── public/
│   └── assets/
│       └── images/            # ← Place your project images here
│           ├── aboutMe.jpg
│           ├── arduinoCoopDoor.jpg
│           ├── googleDataStudioServiceTechs.jpg
│           ├── powerBIMetrics.jpg
│           ├── thisWebsite.jpg
│           ├── SiteAnalytics.jpg
│           ├── thewineyoudrink.jpg
│           ├── dartleague.jpg
│           └── favicon.png
└── src/
    ├── main.jsx               # React entry (portfolio)
    ├── analytics-main.jsx     # React entry (dashboard)
    ├── App.jsx                # Root component (canvas + overlay)
    ├── analytics/             # Analytics dashboard page
    │   ├── AnalyticsDashboard.jsx
    │   ├── AreaChart.jsx
    │   ├── BallEngagement.jsx
    │   ├── DonutChart.jsx
    │   ├── Sparkline.jsx
    │   ├── StatCard.jsx
    │   ├── data.js
    │   └── hooks.js
    ├── components/
    │   ├── GameCanvas.jsx     # p5 instance mode wrapper
    │   ├── DetailModal.jsx    # Project detail modal
    │   └── HUD.jsx            # Contact + Reset buttons
    ├── data/
    │   └── projects.js        # All project data (replaces .txt files)
    ├── game/
    │   ├── Game.js            # Main orchestrator (replaces sketch.js)
    │   ├── Ball.js            # Physics ball (replaces imageBall.js)
    │   ├── Goal.js            # Goal posts
    │   ├── Boundary.js        # Left/right walls
    │   ├── Net.js             # Invisible barriers
    │   ├── Menu.js            # Category menu items
    │   ├── EventBus.js        # Pub/sub for game ↔ React
    │   └── config.js          # All tunable constants
    └── styles/
        ├── index.css          # Portfolio styles
        └── analytics.css      # Dashboard styles
```

## Architecture Changes from v1

| v1 (Old)                              | v2 (New)                                  |
|---------------------------------------|-------------------------------------------|
| 7 script tags, global scope           | ES modules with imports/exports           |
| `window.ui` / `window.onReset` bridge | EventBus pub/sub                          |
| p5 global mode                        | p5 instance mode inside React             |
| Babel CDN runtime JSX transform       | Vite + @vitejs/plugin-react               |
| .txt files loaded at runtime          | `projects.js` static data module          |
| 30+ naked global variables            | `Game` class owns all state               |
| `Matter.World` (deprecated)           | `Matter.Composite` throughout             |
| `img.mask()` (destructive in p5 v1)   | Canvas clipping (`drawingContext.clip()`) |

## Adding a New Project

1. Add your image to `public/assets/images/{id}.jpg`
2. Add an entry to `src/data/projects.js`
3. That's it — the game picks it up automatically

## Deploying

```bash
npm run build
```

Upload the `dist/` folder to your hosting provider. For cPanel + GitHub auto-deploy, point the deploy path to `dist/`.

## Tech Stack

- **Vite** — fast dev server + optimized builds
- **React 18** — UI overlay (modal, buttons)
- **p5.js** — canvas rendering (instance mode)
- **matter.js** — 2D physics engine
- **Syne + DM Sans + JetBrains Mono** — typography
