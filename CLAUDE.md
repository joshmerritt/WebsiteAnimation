# DaDataDad.com — working notes

Interactive portfolio at **https://dadatadad.com**. A p5.js physics canvas where each project is a
ball you drag and launch through goal posts to open its detail panel, with a React overlay on top.

This file is the orientation for a new session. `CHANGELOG.md` is the running log of what changed
and why — **add an entry there when you finish a piece of work.**

---

## Orientation

| | |
|---|---|
| Build | Vite + React 18, ES modules. `npm run dev` / `npm run build` / `npm run preview` (:4173) |
| Tests | `npm test` — Node's built-in runner, no dependencies. Covers the analytics worker, the shot chart's court geometry, the reader for the viewer's own session and the v1–v3 data adapter. CI runs it before every deploy. |
| Entries | 6 pages in `vite.config.js`: `index.html`, `portfolio.html` (accessible fallback), `analytics-v4.html` (**the** dashboard), and `analytics-{dashboard,v2,v3}.html` (earlier versions, kept as built) |
| Game | `src/game/` — `Game.js` (sketch, physics, input), `Ball.js`, `config.js`. p5 1.11, matter-js 0.20 |
| Bridge | `src/game/EventBus.js` — pub/sub between p5 and React. **Event catalog is at the bottom of that file; keep it accurate.** |
| Analytics | `src/game/posthog.js` (the only analytics tool — GA4 was removed 2026-09-12). Dashboard pages load it through `src/analytics/telemetry.js` |
| Dashboard | `src/analytics/v4/` + `src/styles/analytics-v4.css`. One request to `analytics-worker/` (Cloudflare Worker → PostHog HogQL) returns every range. v1–v3 read the same document through `src/analytics/data.js` |
| Data | `src/data/projects.js` — the ball definitions |

## Deploying

**Push to `master`.** `.github/workflows/deploy.yml` builds and FTPS-uploads `dist/` to `public_html`.
`dist/` is gitignored — CI is the only deploy path.

Two traps, both of which have burned real time here:

1. **Don't grab the run id immediately after pushing.** `gh run list --limit 1` will return the
   *previous* run and you'll watch an already-finished job and declare success. Match on the SHA.
2. **Always verify on the live domain, not localhost.** The CSP only exists on the live site, so a
   blocked third party works fine locally and silently fails in production. This cost a full debug
   cycle once. Check the console for CSP errors and confirm the asset/request actually happened.

3. **Check the certificate before anything else.** On 2026-11-14 the live site was serving the
   host's default certificate (`*.web-hosting.com`) instead of its own, so every browser showed a
   full-page security error — while CI was green and every local check passed. One command:
   `echo | openssl s_client -connect dadatadad.com:443 -servername dadatadad.com 2>/dev/null | openssl x509 -noout -subject -enddate`
   — the subject must name `dadatadad.com`. See the open item below; the cause is not confirmed.
   While it is wrong, a deploy can still be checked without switching TLS verification off (never
   `curl -k`). The certificate being served is valid for the hosting server's *own* name — look up
   the site's IP address in reverse to get it — so ask that name for the site:
   `curl -H "Host: dadatadad.com" https://<server-name>/analytics-v4.html`. That reads the files
   and headers on the server. It is not a browser on the real origin, so it says nothing about
   whether the CSP lets a page run or whether PostHog loads.

## Gotchas that are not obvious from the code

- **`.htaccess` section 0 must stay first — and it is not enough on its own.** It lets certificate
  validation (`/.well-known/…` and cPanel's DCV files) through before this file's force-HTTPS
  redirect and SPA fallback can touch it. CI uploads the file whole, so anything cPanel adds on the
  server is overwritten — the exclusions have to live in the source. But measured on 2026-11-16
  with it deployed: those paths answer 404 over HTTPS (correct) and are *still* 301-redirected over
  plain HTTP. **The server redirects port 80 for this domain before `.htaccess` is read**, so the
  redirect that stops an HTTP validation is a hosting setting, not this file. The first write-up
  blamed `.htaccess`: an inference from the rule being in the file, never a measurement.
- **`.htaccess` CSP**: any new third-party domain must be added to the right directive or the browser
  silently blocks it in production only.
- **The analytics worker's URL lives in three places that must agree**: `name` in
  `analytics-worker/wrangler.toml` (which decides the URL), `VITE_ANALYTICS_API_URL` in
  `.env.production`, and `connect-src` in `public/.htaccess`. Miss the CSP and the dashboard works
  locally and falls back to sample data in production.
- **PostHog allows 3 API queries running at once per project.** The worker runs exactly three, in
  parallel. A fourth has to replace one or run after them — the previous, never-deployed worker
  fired seven and would have been rejected on every request. `/query` is also not an export path:
  pull rolled-up rows (per session, per day × project), never raw events.
- **Don't give the worker a shared in-flight promise.** It looks like free de-duplication, but on
  Workers a promise belongs to the request that created it. If that request is cancelled — the
  visitor closes the tab while it loads — the promise never settles, and every other request
  awaiting it hangs until Cloudflare kills it with an error page that has no CORS headers. Each
  request runs its own batch; only the finished answer is kept (in memory, 2 minutes). The Cache
  API is not used either: it does nothing on `*.workers.dev`. And a query that timed out is never
  retried — the first copy may still be running, and a second counts against the limit of three.
- **CI runs the tests on Node 20; this machine runs Node 24, and they treat a pending test
  differently.** Node 24's runner waits for it. Node 20 ends the process as soon as nothing is left
  on the event loop, and cancels that test *and every test after it in the file* — CI then reports
  "30 passed, 20 cancelled, 0 failed", with no assertion to read. `AbortSignal.timeout()` does not
  hold the loop open (its timer is unref'd), so a stubbed `fetch` that never answers has to hold a
  timer itself, the way a real request holds a socket. This failed the first 3.3.0 deploy. Run a
  new test on Node 20 before pushing; Node 20 does not expand the globs in `npm test` itself, so
  on Windows pass the files from a shell that does.
- **The funnel's steps are not nested, so every rate needs its denominator checked.** A double-click
  opens a project with no launch, so opens outnumber makes (10 to 3 on the real 90-day rows) and a
  project can have opens and click-throughs with zero launches. A click-through from the intro
  demo's About Me panel is a `cta_click` with no `detail_open` at all. v3 divided by launches and
  printed "converts at Infinity%". Build a funnel per session, the way `funnelOf` in
  `aggregate.js` does, not from event totals.
- **`src/analytics/v4/court.js` is a hand copy of the game's layout maths** (`Game._computeLayout`,
  `_createGoals`, `_createMenus`), because the Game class can't be imported without p5 and matter.
  Change the game's layout and the goal on the shot chart drifts away from where shots landed.
  `court.test.mjs` pins the copy to contacts recorded in real sessions.
- **Nothing on the dashboard may depend on `requestAnimationFrame` to show a value.** rAF does not
  fire in a background tab (or in Claude's hidden browser pane): v1–v3 count their KPIs up from zero
  and sit at 0 there. v4 renders final values on the first frame.
- **Every hook above every early return.** v3 crashed with React error #300 ("rendered fewer hooks
  than expected") whenever live data had fewer than two daily rows: its chart returned early ahead
  of a `useMemo`, so the hook count changed between the mock-data render and the live one. That was
  the "fails once, works on reload" bug. The daily series is now zero-filled so no chart is handed
  an empty one, but the rule is what actually prevents it.
- **A missing `/assets/` file now 404s honestly.** Everything else still falls through to
  `index.html` with a **200**, so `curl` returning 200 does not prove a file exists — check the
  content-type. This nearly produced a false "source maps are exposed!" alarm.
- **Preload credentials mode**: p5's `loadImage` fetches with `mode:'cors'` (credentials mode
  *same-origin*). A `<link rel=preload>` without `crossorigin` uses *include*, and the browser
  silently discards the mismatch — the only signal is a console **warning**, not an error. The image
  preloads in `index.html` and `Ball.nativeImage` are deliberately aligned; keep them that way.
- **The intro demo is not the visitor's shot.** `_runDemo()` tags its auto-launch with
  `ball._demoShot`. It still plays and still opens the About Me panel, but adds nothing to
  `launchCount`, makes, opens or `impact:first`, and its `detail:open` carries `demo: true`, which
  every analytics listener must skip. Any **new** listener that counts `detail:open` must skip it too.
- **One collision event can hold several pairs for the same ball.** Count a make only when
  `_openBallDetail()` returns true (the panel actually opened), or one make counts several times.
- **A miss is counted when a shot fails**, not at launch: the ball leaves the screen (there is no
  floor, so every miss ends that way — see `_onBallExit`) or is relaunched before scoring.
- **Canvas pixel density is capped at `min(devicePixelRatio, 2)`.** p5 defaults to
  `Math.ceil(devicePixelRatio)`, which rendered a 1.09 desktop at 2× — an 11M-pixel canvas measured
  at 16 fps. Don't remove `_targetPixelDensity()`.
- **Session replay canvas capture is OFF on purpose** (turned off 2026-09-13). Snapshotting a
  full-screen, continuously animating canvas reads it back on the main thread; it caused a measured
  194 ms stall. Replays still record DOM, clicks, console and network; where shots land is captured
  by the shot chart's `ball_impact` coordinates instead. Re-enabling it trades smoothness for replays.
- **Matter.js resolves a contact at `max(bodyA.restitution, bodyB.restitution)`.** So a body can
  never be *less* bouncy than the ball hitting it: with the ball at 0.66, the goal's and walls'
  configured values silently did nothing for years. Goal contacts (posts, nets, category bars) are
  now forced to the goal body's own value in `_dampGoalContacts`. **Walls still resolve at the
  ball's value** — their config is dead on purpose, to keep the familiar wall bounce.
- **Override a pair's restitution in `collisionStart`, never `collisionActive`.** `collisionStart`
  fires before the velocity solve; `collisionActive` (where scoring lives) fires *after* it, so an
  override there does nothing. Matter 0.20 discards a pair when its bodies separate, so every fresh
  impact arrives as a new `collisionStart`.
- **The ball is 79–88% as wide as the goal chute** (e.g. 115px ball, 131px opening at 1280×800), so
  most failed goal attempts are rim clips, not bounce-outs. A ball that gets fully inside scores
  ~99–100% of the time. If goals need to be easier, the opening's geometry is the bigger lever.
- **matter-js**: use `Matter.Composite`, not the deprecated `Matter.World`. Collisions come from
  `event.pairs`.
- **p5 image masking**: use canvas clipping (`drawingContext.save/clip/restore`), not `img.mask()`,
  which is destructive in p5 1.x.
- **Touch**: `touchStarted/Moved/Ended` are defined explicitly because `mouseReleased` is unreliable
  on mobile. Double-click window is 500ms (`config.doubleTapWindow`) with a power threshold of >2
  (`config.minLaunchPower`) to stop touch jitter launching.

## Assets

Images live in `public/assets/images/` and are **WebP**, generated by a script — don't hand-edit them.

```bash
npm run images   # re-encode to WebP, long edge capped at 900px, never upscales
npm run og       # rebuild the 1200x630 social card from logos/DaDataDad_combined_logo.png
```

`og-preview.jpg` must stay a `.jpg` at that exact path — it is the URL the `og:image` meta tags
advertise, and scrapers do not follow an extension change. `scripts/optimize-images.mjs` skips it
for that reason.

### Adding a ball

1. Drop the image in `public/assets/images/<id>.<jpg|png>` and run `npm run images`
2. Add the entry to `src/data/projects.js`
3. Optionally give it a short label for the shot chart in `SHORT` (`src/analytics/v4/meta.js`);
   without one the court shows the full name

(The old `assets/<id>.txt` info files are gone — `projects.js` replaced them.)

⚠ `thisWebsite` is hardcoded at index 4 in `captureWebsite()` — keep its position.

## Analytics

PostHog project **Website**, id `605146`, org DaDataDad. Ingestion is first-party through
`https://e.dadatadad.com` (a managed reverse proxy), so ad blockers don't drop it.

- **Only `dadatadad.com` sends data.** `shouldTrack()` in `posthog.js` gates on hostname; override
  locally with `localStorage.setItem('ph_force','1')`. Treat anything ingested before
  2026-09-11 16:28 PT as test data.
- `src/game/sessionBridge.js` is **not** analytics — it keeps the viewer's own session in
  localStorage (`__dadatadad_impacts`, `__dadatadad_bridge`), read directly by the dashboards
  (`src/analytics/v4/session.js`, and `AnalyticsDashboardV3`) for the shot chart's "My session".
  Don't delete it as "unused"; grep for the storage **keys**, not for window globals. A reader has
  to apply the 24-hour expiry itself (the game only prunes when its own page loads, so a dashboard
  opened days later would show last week as "my session"), and only `isGoal` means a make:
  `hitType: 'menu'` is also what a miss that touched a category bar first looks like.
- Debug on the live site: `https://dadatadad.com/?__posthog_debug=true`.

### The dashboard's data — `analytics-worker/`

- Deployed as **`site-analytics`** → `https://site-analytics.dadatadad-analytics.workers.dev`.
  It replaced `ga4-analytics-api`, which read Google Analytics; that is a separate worker.
- Returns one JSON document (`v: 2`) covering 7, 30 and 90 days. The browser switches ranges without
  another request. `analytics-worker.js` is the Worker (fetch handler, caching, PostHog calls) and
  states the design constraints; `aggregate.js` holds the SQL and all the aggregation, is pure, and
  describes the document's shape. Keep helpers out of the entry file — it must export only the
  handler (a test enforces it).
- **Data starts 2026-09-13 16:15 UTC** (`DATA_EPOCH_UTC` in `wrangler.toml`): after release 3.2.1
  stopped the intro demo logging fake scores, and after the test traffic of 09-11. "vs previous
  period" is only shown when the whole previous period falls after that — until March 2027 the
  90-day range has nothing honest to compare against, and says so.
- **Visits ≠ sessions.** Dashboard-only sessions are excluded (the owner checking his numbers is not
  a visitor), and so are sessions with nothing but a stray performance sample. Play without a page
  view still counts: PostHog rotates the session id after 30 idle minutes.
- The worker never sends person ids, session ids or timestamps to the browser — only totals, plus
  shot positions. Referrers are reduced to a short list of known sources (`SOURCE_NAMES` in
  `aggregate.js`; anything else is "Other sites"), and a shot carries its screen as a shape —
  aspect ratio plus the long side rounded up to 100px — never exact pixels. An exact viewport next
  to a private referrer is close to a fingerprint. `court.test.mjs` holds the rounding to under 3%
  of a ball's width; on the real shots it moves a mark by less than half a pixel.
- **A shot's outcome is paired by launch order, not by time.** With two balls in the air the next
  score does not belong to the last launch. The shots query numbers each ball's launches within a
  session and ties every impact and score to the launch before it (a window function, so it is
  still one query).
- **Performance numbers are the playground's only.** `$web_vitals` from `/analytics*` pages are
  left out (`SITE_VITALS` in `aggregate.js`), or the dashboard would be measuring itself.
- **When the API can't be reached, v4 shows made-up sample data under a banner that says so**
  (`src/analytics/v4/sample.js`, which runs through the worker's own `buildPayload` so the shape
  can't drift). v1–v3 fall back to their older mock data under a "Demo" badge. *Refresh* is the
  exception: it never trades live numbers for sample ones — on failure it keeps what is on screen
  and says the refresh failed.
- Every v4 load reports a `dashboard_loaded` event (`data_mode`, `load_ms`, `attempts`,
  `error_code`) and render errors go to error tracking. Before this the dashboards sent nothing, so
  a failed load left no trace. Dashboard events are tracked but never counted as portfolio visits.

### Josh's PostHog orgs — verified 2026-09-12

Each app has its own organization with exactly one project, and each project receives **only its own
app's traffic** (checked by `$host` over 180 days; the only strays are a handful of old localhost dev
hits). There is no cross-contamination between apps.

| Organization | Slug | Project | Project id | Sends data |
|---|---|---|---|---|
| DaDataDad | `dadatadad-flpp` | Website | 605146 | `dadatadad.com` |
| The Wine You Drink | `dadatadad` ⚠ | TWYD - v1 | 457220 | `thewineyoudrink.web.app` |
| Black Sheep Darts | `black-sheep-darts` | Default project | 458340 | `theblacksheepdartleague.web.app` |

⚠ **The Wine You Drink's org slug is `dadatadad`** — the real DaDataDad org is `dadatadad-flpp`. Slugs
don't change on rename, so a URL like `us.posthog.com/organization/dadatadad` opens the *Wine* org.
This, plus the MCP bug below, has already produced one confident and completely false report that this
site was "sending events into the wine project".

### If you have the PostHog MCP

⚠ **It starts in the wrong organization** — the first write 404s, and a query will silently return
*The Wine You Drink*'s data instead of this site's. The claude.ai PostHog connector does the same
(2026-10-06: it opened in *TWYD - v1*). Always run first:

```
call switch-organization {"orgId": "01a09230-59d0-0000-6f85-ee3d742250f5"}
call switch-project      {"projectId": 605146}
```

Two things changed by 2026-11-14:

- **The first switch is refused** with *"Switch not applied. Retry with the returned
  `conversation_id`"*. Do exactly that: pass the `conversation_id` it returns on the retry and on
  every call after it, or each call starts over in the wrong project.
- **There can be more than one PostHog server connected**, and one may belong to an unrelated
  organization. If `switch-organization` 404s, run `organizations-get`: if DaDataDad is not listed,
  that server can't see this site at all — use the other one, and don't query the wrong one.

⚠ **`switch-organization` prints a stale project name next to the new org** — e.g. *"project Website
within organization The Wine You Drink"*, a pairing that does not exist. Only `switch-project`
re-resolves both. Never infer org/project membership from that line; use `projects-get`, which lists
the projects that actually belong to the current org.

Also: `test_account_filters` is a **keep** predicate, not a drop predicate (`$host = dadatadad.com`
means *include only* that host). And alerts cannot evaluate an insight that has a breakdown.

### Self-driving — turned on 2026-10-06

PostHog's agent loop: scouts and signal sources file reports in the
[inbox](https://us.posthog.com/project/605146/inbox), and an actionable report becomes a **pull request
against this repo**. Review those like any other PR — merging to `master` deploys. The wizard's record
of what it enabled, and why each scout is on or off, is `posthog-self-driving-report.md`.

- **GitHub**: the PostHog GitHub App on `joshmerritt`, with access to `WebsiteAnimation` only.
- **Signal sources**: error tracking (new, reopened, spiking), health checks, GitHub issues, and
  support tickets (dormant — no support channel is connected).
- **Scouts on (7 of 30)**: general, product analytics, web analytics, web vitals, anomaly detection,
  and two written for this site — `signals-scout-portfolio-interaction-journey` (one stage of
  load → launch → open → click-out collapsing while the stage before it holds) and
  `signals-scout-canvas-playability` (frame rate and scoring struggle). Budget is 100 runs/day.
  To quiet a noisy scout without stopping it, set `emit: false` on its config.
- **Traffic is tiny** — roughly one visit every few days since launch. Expect few reports, and
  distrust any rate or "drop" built on a handful of sessions.

## Open items

- **🔴 The site's TLS certificate (found 2026-11-14, still broken 2026-11-16).** `dadatadad.com`
  and `www` serve the host's default `*.web-hosting.com` certificate, so every visitor gets a
  full-page security error. DNS is correct, and the site's own files are served underneath it. The
  last recorded visit was 2026-11-09, so it broke between then and the 14th. **The cause is not
  confirmed.** Established on 2026-11-16, with 3.3.0 deployed:
  - Every plain-HTTP request for the domain is redirected to HTTPS **by the server, before
    `.htaccess` is read** — including the exact file names cPanel's own redirect is built to
    exempt. So it is a hosting setting (most likely cPanel → *Domains* → *Force HTTPS Redirect*, or
    the host's own SSL tool — not seen, cPanel can't be reached from here), not this repo, and
    `.htaccess` section 0 cannot lift it. While it is on, a validation request over HTTP is sent
    to HTTPS, which is the broken thing.
  - The domain's DNS is on the host's own name servers, so validation by DNS record is possible.

  Not established: whether AutoSSL is failing, is off or is not offered on this plan, or whether
  the old certificate was a fixed-term one that ran out. To do in cPanel: *SSL/TLS Status* →
  select the domains → **Run AutoSSL**, and read the reason it gives. If it reports a redirect
  (301) on the validation file, turn the HTTPS redirect off for the domain, run it again, then turn
  it back on. Then re-run the check in Deploying, trap 3.
- **Deploy `analytics-worker/` — the dashboard has no live data until this is done.** It shows
  sample data under a banner meanwhile. From `analytics-worker/`: `npx wrangler login` (this machine
  was logged out on 2026-11-14), then `npx wrangler secret put POSTHOG_API_KEY` (a PostHog *personal*
  key with scope **`query:read`** on project 605146 — different from the CI key), then
  `npx wrangler deploy`. Check `https://site-analytics.dadatadad-analytics.workers.dev` returns
  JSON with `"v":2`. The exact SQL was run against the project on 2026-11-14 and the worker's tests
  pass, but **the worker itself has never run on Cloudflare** — treat the first deploy as unverified
  until that URL answers.
- **Then remove what is left of Google Analytics**, none of which is in this repo any more:
  `npx wrangler delete --name ga4-analytics-api` (the old worker — still deployed and still
  answering on 2026-11-14, with whatever Google credentials it was given), then the GA4 property
  and its service account in Google's consoles.
- **`.cpanel.yml` is a trap.** It still says `rm -rf public_html/assets` then copy `dist/` — and
  `dist/` is no longer in the repo. If cPanel's own Git deploy ever runs (or someone presses
  "Deploy HEAD Commit"), it would delete the live assets and then have nothing to copy. Delete the
  file, or the cPanel repository hook, once it is confirmed nothing depends on it.
- **v1–v3 still pad with demo data.** They now get honest live numbers through the adapter, which
  makes their fall-backs more visible: v3 shows mock per-project figures under a "Live" badge when a
  range has no shots, and its device, session-flow and "% vs last period" figures were always
  invented. Their funnels also assume every open follows a make, so on live data the "Open" step
  can read above 100% (see Gotchas). v4 has none of that. They are linked from v4's footer as
  earlier versions; decide whether to keep, fix or retire them.
- **The owner's own visits are counted.** At one real visit every few days, Josh testing the site is
  a visible share of every number. Nothing excludes them yet (an opt-out flag in `shouldTrack()`
  would do it).
- **3.3.0 is deployed (2026-11-16) but has not been seen in a browser on the live domain** — it
  cannot be, with the certificate broken. Checked on the server itself (Deploying, trap 3): the new
  pages and scripts are there with the right content types, the old scripts are gone, no source
  map is exposed, no script mentions Google Analytics, and the CSP header names the new worker.
  Not checked, because each needs a real page load on `dadatadad.com`: that the CSP lets the
  dashboard run, that PostHog loads on the dashboard pages, and anything about the worker. After
  the certificate and the worker are both fixed: load `/analytics-v4.html`, confirm the pill says
  *Live* and the console has no CSP errors, and confirm a `dashboard_loaded` event with
  `$host = dadatadad.com` arrives in PostHog.
- **Self-driving gaps** (see above):
  - *Nothing reviews replays.* The wizard skipped the session-replay signal source in favour of two
    Replay Vision scanners (breakage, rage-click frustration), then couldn't create them. The PostHog
    connector does have `vision-scanners-create`. Cost is negligible here (5 credits per observation
    against 2,500 free a month), but scanners send visitor recordings, inputs masked, to Google
    Gemini — decide that deliberately rather than by default.
  - *The CSP-violations scout is off* because the CSP in `public/.htaccess` has no `report-uri`, so
    no `$csp_violation` events exist. Adding reporting would let it catch the production-only CSP
    blocks described in Gotchas.

- **Data before 2026-09-13 is inflated by the intro demo.** Until commit `52dc3b8`, every page load
  logged a fake `ball_score` + `detail_open` for "Josh Merritt" (fixed — see Gotchas). The site's
  own dashboard ignores everything before then (`DATA_EPOCH_UTC`); inside PostHog, still treat older
  "Top projects opened" rankings and the Engaged cohort as unreliable.
- **Confirm the jank fix with real play.** Pixel density is capped and canvas replay capture is off,
  but FPS could not be measured here (rAF never fires in the hidden pane). `game_perf` reports
  avg/min FPS ~30s into a session — play on the desktop that was janky and compare to the 16 fps
  average / 6 fps minimum measured before. The `canvas-playability` scout is meant to watch for this
  too, but at current traffic it has little to go on.
- **Dependencies** (`npm audit`, 2026-09-12): 1 moderate in shipped code — `fflate@0.4.8` via
  posthog-js (GHSA-px8p-9vwx-vf98, infinite loop in `unzipSync` on malformed ZIP64). Not reachable
  here: posthog-js only *compresses*, never unzips untrusted input. 3 high + 2 others are build-only
  (`browserslist`, `nanoid`, `postcss`) and never ship. All have fixes available.
- **`load_time_ms` is unproven.** The §7 byte cuts are measured; their user-facing effect is not.
  The dashboard's "How it runs" panel now shows it (median 2.2 s over 12 samples on 2026-11-14),
  but that is too few samples, on too few machines, to call it.
- **Largest contentful paint looks poor**: 9.6 s at the 75th percentile — over 6 samples, two of
  them 11–13 s from the same large desktop. Worth a look once there is more than a handful.
- **`game:reset` has no emitter** — no reset control exists in the UI, so `game_reset` can never
  fire. Either wire a reset button to `bus.emit('game:reset')` or drop the listener.
- **Unused font weights**: DM Sans 300 and italic 400 are requested by `index.html` and the v1–v3
  pages but no CSS uses them. (`analytics-v4.html` requests only what it uses.)
- `POSTHOG_HANDOFF.md` is the detailed record of the September 2026 work (its later sections are a
  pre-work audit, kept for reasoning). `V2-INTEGRATION-GUIDE.md` and `README.md` describe the site
  as it was in March 2026.

## Conventions

- Commit and push when asked — no need to confirm each time.
- Match the surrounding code's comment density and idiom. Comments here explain *why*, especially
  where behaviour is non-obvious or was the result of a real bug.
- Say plainly when something is unverified. Several notes above exist because a previous claim was
  stated more confidently than the evidence supported.
