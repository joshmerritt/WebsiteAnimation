# Google Analytics 4 Setup Guide — DaDataDad.com

Complete setup for tracking the physics-based portfolio, including custom events for ball interactions, detail page opens, and the engagement funnel unique to your site.

---

## Step 1: GA4 Property (Already Done)

Your GA4 property is already created with measurement ID `G-JXCE49FJ7J`. The gtag snippet is already in both `index.html` and `analytics-dashboard.html`:

```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-JXCE49FJ7J"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  gtag('js', new Date());
  gtag('config', 'G-JXCE49FJ7J');
</script>
```

This automatically tracks `page_view`, `session_start`, `first_visit`, and `user_engagement` out of the box. No changes needed here.

---

## Step 2: Deploy the Custom Event Tracking Module

Two new/updated files handle all custom event tracking:

### `src/game/ga4.js` (NEW)
This module listens to your existing EventBus and forwards events to GA4. It tracks:

| Event Name | Trigger | Parameters |
|---|---|---|
| `ball_launch` | User releases a ball with enough drag power | `shot_number`, `total_makes`, `accuracy` |
| `ball_score` | Ball collides with matching goal category | `shot_number`, `make_number`, `accuracy` |
| `detail_open` | Project detail modal is displayed | `project_name`, `project_link` |
| `detail_close` | Modal dismissed | — |
| `game_reset` | User resets the playground | — |
| `portfolio_loaded` | All images loaded, canvas ready | `load_time_ms` |

### `src/App.jsx` (UPDATED)
Added one import and one `useEffect` to wire up the tracking on mount:

```javascript
import { initGA4Tracking } from './game/ga4.js';

// Inside the component:
useEffect(() => {
  const cleanup = initGA4Tracking();
  return cleanup;
}, []);
```

**Deploy these two files, rebuild, and push.** Events will start flowing immediately.

---

## Step 3: Register Custom Definitions in GA4 Console

GA4 needs to know about your custom parameters so they appear in reports.

1. Go to **Google Analytics** → your property → **Admin** (gear icon, bottom left)
2. Click **Data display** → **Custom definitions**
3. Click **Create custom dimension** for each:

| Dimension Name | Scope | Event Parameter |
|---|---|---|
| Project Name | Event | `project_name` |
| Project Link | Event | `project_link` |

4. Click **Create custom metric** for each:

| Metric Name | Scope | Event Parameter | Unit |
|---|---|---|---|
| Shot Number | Event | `shot_number` | Standard |
| Make Number | Event | `make_number` | Standard |
| Accuracy | Event | `accuracy` | Standard |
| Load Time (ms) | Event | `load_time_ms` | Milliseconds |

These take up to 24 hours to populate with data, but events are collected immediately.

---

## Step 4: Mark Key Events (Conversions)

Some events are more valuable than pageviews. Mark them as key events:

1. **Admin** → **Data display** → **Events**
2. Wait for events to appear (within a few hours of first traffic)
3. Toggle the **Mark as key event** switch for:
   - `detail_open` — a visitor actually explored a project (this is your primary conversion)
   - `ball_score` — a visitor successfully aimed and scored
   - `portfolio_loaded` — confirms the site rendered (useful for performance monitoring)

---

## Step 5: Set Up Explorations (Custom Reports)

### Ball Engagement Funnel

This is the signature metric for your portfolio — it shows how visitors flow through the physics interaction:

1. Go to **Explore** → **Create new exploration**
2. Choose **Funnel exploration**
3. Add steps:
   - **Step 1**: `page_view` (event = `page_view`, page_location contains `/`)
   - **Step 2**: `ball_launch` (event = `ball_launch`)
   - **Step 3**: `ball_score` (event = `ball_score`)
   - **Step 4**: `detail_open` (event = `detail_open`)
4. Name it "Ball Engagement Funnel"
5. Set date range to Last 30 days

### Project Popularity Report

1. **Explore** → **Free form**
2. Rows: `project_name` (custom dimension)
3. Values: Event count for `detail_open`
4. Filter: Event name = `detail_open`

This tells you which project balls get opened most, letting you decide what to feature more prominently.

### Accuracy Over Time

1. **Explore** → **Free form**
2. Rows: Date
3. Values: Average of `accuracy` metric
4. Filter: Event name = `ball_launch`

This shows whether returning visitors get better at the physics game — a fun engagement signal.

---

## Step 6: Enhanced Measurement Settings

Make sure these are enabled in **Admin** → **Data streams** → click your web stream → **Enhanced measurement**:

- **Page views** → ON (tracks SPA navigation if you add hash changes)
- **Scrolls** → ON (90% scroll depth on the analytics dashboard)
- **Outbound clicks** → ON (tracks clicks to LinkedIn, GitHub, Upwork, etc.)
- **Site search** → OFF (not applicable)
- **Form interactions** → OFF (contact is mailto:)

---

## Step 7: Connect the Dashboard to Real Data (Future)

The analytics dashboard currently shows deterministic mock data (seeded random so it renders consistently). To connect it to live GA4 data:

### Option A: GA4 Data API (Server-Side)

The cleanest approach — set up a lightweight backend or serverless function:

1. **Create a service account** in Google Cloud Console
2. **Add the service account** as a Viewer to your GA4 property
3. **Create an API endpoint** (Cloudflare Worker, Vercel Edge Function, etc.) that:
   - Authenticates with the service account credentials
   - Calls the GA4 Data API `runReport` endpoint
   - Returns JSON your dashboard can fetch

```javascript
// Example API call structure
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const client = new BetaAnalyticsDataClient();

const [response] = await client.runReport({
  property: 'properties/YOUR_PROPERTY_ID',
  dateRanges: [{ startDate: '90daysAgo', endDate: 'today' }],
  dimensions: [{ name: 'date' }],
  metrics: [
    { name: 'activeUsers' },
    { name: 'screenPageViews' },
    { name: 'averageSessionDuration' },
    { name: 'bounceRate' },
  ],
});
```

4. Update `src/analytics/data.js` to fetch from your endpoint instead of generating mock data

### Option B: GA4 Embed API (Client-Side)

Simpler but requires the viewer to authenticate with Google:

1. Use the `@google-analytics/data` embed components
2. Good for an admin-only view, not for public portfolio display

### Recommendation

**Start with mock data** (current setup). It demonstrates your analytical thinking and dashboard skills without requiring API infrastructure. When you have enough real traffic to make the numbers interesting, switch to Option A with a Cloudflare Worker — your Namecheap hosting can proxy to it.

---

## Step 8: Verify Everything Is Working

### Real-Time Check

1. Open `dadatadad.com` in a browser
2. In GA4, go to **Reports** → **Realtime**
3. You should see your visit appear within seconds
4. Drag and launch a ball — `ball_launch` should appear in the event stream
5. Score a goal — `ball_score` and `detail_open` should appear

### DebugView

For detailed event inspection:

1. Install the **Google Analytics Debugger** Chrome extension
2. Enable it, then visit your site
3. In GA4, go to **Admin** → **Data display** → **DebugView**
4. You'll see every event with all its parameters in real time

### Common Issues

| Problem | Fix |
|---|---|
| No events showing | Check that `G-JXCE49FJ7J` matches your property; check for ad blockers |
| Events show but no custom params | Register the custom definitions (Step 3); wait 24h |
| `ball_launch` not firing | Verify the drag distance exceeds `config.minLaunchPower` (currently 2) |
| Double-counting events | The ga4.js module uses delta detection (`lastShots`/`lastMakes`) to prevent this |

---

## File Summary

| File | Status | Purpose |
|---|---|---|
| `src/game/ga4.js` | **NEW** | EventBus → GA4 bridge, all custom event tracking |
| `src/App.jsx` | **UPDATED** | Imports and initializes ga4.js on mount |
| `src/analytics/data.js` | **UPDATED** | Reflects actual 8 balls, 4 categories, seeded mock data |
| `src/analytics/AnalyticsDashboard.jsx` | **UPDATED** | 5th KPI (ball interaction rate), 3-metric chart toggle |
| `src/analytics/BallEngagement.jsx` | **UPDATED** | 4-step funnel (click→launch→score→open), category chips |
| `src/styles/analytics.css` | **UPDATED** | 7-column grid, category chips, improved footer |
| `index.html` | **NO CHANGE** | gtag snippet already present |
| `analytics-dashboard.html` | **NO CHANGE** | gtag snippet already present |
