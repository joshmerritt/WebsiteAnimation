/**
 * DashboardV4.jsx — Site analytics, version 4.
 *
 * How it loads (and why it is built this way):
 *
 *   Nothing is drawn from placeholder data. v3 rendered a full dashboard of
 *   made-up numbers first and swapped the real ones in a second later, which
 *   read as the page loading twice. Here the header appears at once, a loading
 *   panel holds the space, and the dashboard is drawn exactly once — with real
 *   data, or, if the API can't be reached after a retry, with sample data under
 *   a banner that says so.
 *
 *   One response carries every range, so switching 7 / 30 / 90 days is instant
 *   and cannot fail. (In v3 each switch was a new request, and an empty answer
 *   crashed the page: a chart returned early ahead of one of its hooks, React
 *   saw a different number of hooks than the render before, and threw.)
 *
 *   Every outcome is reported to PostHog as `dashboard_loaded`, with how long
 *   it took and whether it fell back, and render errors go to error tracking.
 *   The next "it failed once and then worked" leaves a record.
 */

import { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadDashboard, loadLive } from './api.js';
import { readSession, watchSession } from './session.js';
import { initTelemetry, track, reportError } from '../telemetry.js';
import { Card, Segmented, Empty } from './ui.jsx';
import { TrendChart, FunnelChart, ActivityHeatmap } from './charts.jsx';
import ShotChart from './ShotChart.jsx';
import { KpiRow, Findings, buildFindings, ProjectsTable, Sources, Countries, Devices, Performance } from './sections.jsx';
import HowItWorks from './HowItWorks.jsx';
import { COLOR, FUNNEL_STEPS, WEEKDAYS, WEEK_ORDER } from './meta.js';
import { fmtAgo, fmtDayFull, fmtDay, fmtHour, fmtInt } from './format.js';

/** Long enough that the loading panel never flashes, short enough not to stall. */
const MIN_LOADING_MS = 600;
const SLOW_AFTER_MS = 4000;

const TREND_SERIES = [
  { key: 'visits', label: 'Visits', color: COLOR.visits },
  { key: 'shots',  label: 'Shots',  color: COLOR.shots },
  { key: 'opens',  label: 'Project opens', color: COLOR.opens },
];

const REASONS = {
  not_configured: 'this build has no analytics API configured',
  timeout: 'the analytics API took too long to answer',
  network: 'the analytics API could not be reached',
  server: 'the analytics API reported an error',
  http: 'the analytics API refused the request',
  shape: 'the analytics API answered in an older format',
};

// ── Loading ─────────────────────────────────────────────────────────────────

function LoadingPanel({ slow }) {
  return (
    <div className="v4-loading" role="status" aria-live="polite">
      <svg className="v4-loading-art" viewBox="0 0 120 80" aria-hidden="true">
        <circle cx="26" cy="30" r="3" className="v4-loading-post" />
        <circle cx="54" cy="30" r="3" className="v4-loading-post" />
        <path d="M26 34v34M54 34v34" className="v4-loading-net" />
        <circle r="9" className="v4-loading-ball" />
      </svg>
      <p className="v4-loading-title">Loading live data</p>
      <p className="v4-loading-sub">
        {slow ? 'Still working — a cold start can take a few seconds.' : 'Asking PostHog for the last 90 days.'}
      </p>
    </div>
  );
}

// ── Overview tab ────────────────────────────────────────────────────────────

function Overview({ data, rangeDays, session, sample }) {
  const range = data.ranges[rangeDays];
  const days = useMemo(() => data.days.slice(-rangeDays), [data.days, rangeDays]);
  const shots = useMemo(() => data.shots.filter((s) => s.d < rangeDays), [data.shots, rangeDays]);
  const findings = useMemo(() => buildFindings(range, shots, rangeDays), [range, shots, rangeDays]);

  const funnelSteps = FUNNEL_STEPS.map((s) => ({ label: s.label, count: range.funnel[s.key] }));
  const busiest = useMemo(() => {
    let best = null;
    range.activity.forEach((row, dow) => row.forEach((v, hour) => { if (v > (best?.v ?? 0)) best = { v, dow, hour }; }));
    return best;
  }, [range.activity]);

  return (
    <>
      <KpiRow range={range} days={days} rangeDays={rangeDays} />

      <div className="v4-grid">
        <div className="v4-span-12">
          <ShotChart allShots={shots} session={session} totals={range.totals} rangeDays={rangeDays} sample={sample} />
        </div>

        <div className="v4-span-5">
          <Findings items={findings} />
        </div>

        <Card
          className="v4-span-7"
          title="Activity over time"
          subtitle={`Per day, ${fmtDay(days[0].date)} – ${fmtDay(days[days.length - 1].date)}`}
          table={{
            caption: 'Daily activity',
            columns: [{ label: 'Day' }, { label: 'Visits', numeric: true }, { label: 'Shots', numeric: true }, { label: 'Scored', numeric: true }, { label: 'Opens', numeric: true }, { label: 'Clicks', numeric: true }],
            rows: days.filter((d) => d.visits || d.shots || d.opens).reverse().map((d) => [fmtDayFull(d.date), d.visits, d.shots, d.makes, d.opens, d.ctas]),
            empty: 'No activity in this range.',
          }}
        >
          <TrendChart days={days} series={TREND_SERIES} />
        </Card>

        <div className="v4-span-12">
          <ProjectsTable balls={range.balls} />
        </div>

        <Card
          className="v4-span-6"
          title="From visit to click-through"
          subtitle="Visits that reached each step; every step contains the next"
          table={{
            caption: 'Visit funnel',
            columns: [{ label: 'Step' }, { label: 'Visits', numeric: true }],
            rows: funnelSteps.map((s) => [s.label, s.count]),
          }}
        >
          <FunnelChart steps={funnelSteps} />
        </Card>

        <Card
          className="v4-span-6"
          title="When people visit"
          subtitle={busiest
            ? `Busiest: ${WEEKDAYS[busiest.dow]} around ${fmtHour(busiest.hour)}, in the visitor’s own time`
            : 'By day and hour, in the visitor’s own time'}
          table={{
            caption: 'Visits by day of week and hour',
            columns: [{ label: 'Day' }, { label: 'Hour' }, { label: 'Visits', numeric: true }],
            rows: WEEK_ORDER.flatMap((dow) => range.activity[dow].map((v, hour) => (v ? [WEEKDAYS[dow], `${fmtHour(hour)}–${fmtHour((hour + 1) % 24)}`, v] : null)).filter(Boolean)),
            empty: 'No visits in this range.',
          }}
        >
          <ActivityHeatmap grid={range.activity} />
        </Card>

        <div className="v4-span-4"><Sources rows={range.sources} /></div>
        <div className="v4-span-4"><Countries rows={range.countries} /></div>
        <div className="v4-span-4"><Devices rows={range.devices} pages={range.pages} /></div>

        <div className="v4-span-12"><Performance perf={range.perf} /></div>
      </div>
    </>
  );
}

// ── Shell ───────────────────────────────────────────────────────────────────

function Dashboard() {
  const [result, setResult] = useState(null);          // null while the first load is in flight
  const [refreshing, setRefreshing] = useState(false);
  const [slow, setSlow] = useState(false);
  const [rangeDays, setRangeDays] = useState(90);
  const [tab, setTab] = useState('overview');
  const [session, setSession] = useState(readSession);
  const [fatal, setFatal] = useState(false);            // a chunk of the page itself failed to load
  const [notice, setNotice] = useState(null);           // outcome of the last Refresh, when it needs saying
  const [, tick] = useState(0);                         // re-render so "updated 3 min ago" stays true
  const reported = useRef(false);
  const shownLive = useRef(null);                       // fetchedAt of the live data on screen, if any

  // First load. The dashboard is drawn once, when this resolves.
  useEffect(() => {
    let alive = true;
    const started = performance.now();
    const slowTimer = setTimeout(() => alive && setSlow(true), SLOW_AFTER_MS);

    loadDashboard().then((res) => {
      clearTimeout(slowTimer);
      if (!reported.current) {
        reported.current = true;
        track('dashboard_loaded', {
          dashboard_version: 'v4',
          data_mode: res.mode,
          from_cache: res.fromCache,
          attempts: res.attempts,
          load_ms: res.ms,
          error_code: res.error?.code ?? null,
        });
      }
      // A cached answer is instant: show it instantly. Otherwise hold the
      // loading panel just long enough that it never flickers.
      const wait = res.fromCache ? 0 : Math.max(0, MIN_LOADING_MS - (performance.now() - started));
      setTimeout(() => alive && setResult(res), wait);
    }).catch((err) => {
      // loadDashboard() resolves for every API failure (it falls back to sample
      // data). Reaching here means part of this page failed to download.
      clearTimeout(slowTimer);
      reportError(err, { dashboard_version: 'v4', stage: 'load' });
      if (alive) setFatal(true);
    });

    return () => { alive = false; clearTimeout(slowTimer); };
  }, []);

  useEffect(() => { initTelemetry(); }, []);
  useEffect(() => watchSession(() => setSession(readSession())), []);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Refresh asks for live data only. loadDashboard() would answer a failure
  // with sample data, and a refresh must never replace real numbers with
  // made-up ones: on failure, what is on screen stays.
  const refresh = useCallback(() => {
    setRefreshing(true);
    setNotice(null);
    loadLive({ fresh: true })
      .then((res) => {
        track('dashboard_refreshed', { dashboard_version: 'v4', outcome: 'ok', load_ms: res.ms });
        if (shownLive.current === res.data.fetchedAt) {
          setNotice('Already up to date — the numbers are recalculated every two minutes.');
        }
        setResult({ ...res, mode: 'live', error: null });
      })
      .catch((error) => {
        track('dashboard_refreshed', { dashboard_version: 'v4', outcome: 'failed', error_code: error?.code ?? null });
        setNotice(`Couldn’t refresh: ${REASONS[error?.code] || 'the analytics API could not be reached'}. What you see is unchanged.`);
      })
      .finally(() => setRefreshing(false));
  }, []);

  const data = result?.data;
  const sample = result?.mode === 'sample';
  useEffect(() => { shownLive.current = result?.mode === 'live' ? result.data.fetchedAt : null; }, [result]);
  const ranges = data ? data.windows.filter((w) => data.ranges[w]) : [7, 30, 90];
  const activeRange = ranges.includes(rangeDays) ? rangeDays : ranges[ranges.length - 1];

  return (
    <div className="v4">
      <a className="v4-skip" href="#v4-main">Skip to the dashboard</a>

      <header className="v4-header">
        <div className="v4-header-top">
          <div>
            <h1 className="v4-title">Site Analytics</h1>
            <p className="v4-subtitle">
              How visitors play with <a href="/">dadatadad.com</a>
              {data?.since && !sample ? ` · tracked since ${fmtDayFull(data.since)}` : ''}
            </p>
          </div>
          <div className="v4-header-status">
            {!result && <span className="v4-pill v4-pill--loading"><span className="v4-pill-dot" aria-hidden="true" />Loading</span>}
            {result && !sample && (
              <span className="v4-pill v4-pill--live" title={`Fetched ${new Date(data.fetchedAt).toLocaleString()}`}>
                <span className="v4-pill-dot" aria-hidden="true" />Live · updated {fmtAgo(data.fetchedAt)}
              </span>
            )}
            {sample && <span className="v4-pill v4-pill--sample"><span aria-hidden="true">▲</span>Sample data</span>}
            <button type="button" className="v4-btn" onClick={refresh} disabled={!result || refreshing}>
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
            <a className="v4-btn" href="/">← Playground</a>
          </div>
        </div>

        <div className="v4-controls">
          <div className="v4-tabs" role="tablist" aria-label="Dashboard sections">
            {[['overview', 'Overview'], ['how', 'How it works']].map(([key, label]) => (
              <button key={key} type="button" role="tab" id={`v4-tab-${key}`} aria-selected={tab === key} aria-controls="v4-panel"
                className="v4-tab" onClick={() => setTab(key)}>{label}</button>
            ))}
          </div>
          {tab === 'overview' && (
            <Segmented label="Date range" value={activeRange} onChange={setRangeDays}
              options={ranges.map((w) => ({ value: w, label: `${w} days` }))} />
          )}
        </div>
      </header>

      <main id="v4-main" tabIndex={-1} className={refreshing ? 'v4-main v4-main--busy' : 'v4-main'}>
        <div id="v4-panel" role="tabpanel" aria-labelledby={`v4-tab-${tab}`} aria-busy={(!result && !fatal) || refreshing}>
        {tab === 'how' ? <HowItWorks /> : fatal ? (
          <Empty title="The dashboard couldn’t load">
            <p>Part of this page failed to download. Check your connection and try again.</p>
            <p className="v4-empty-actions">
              <button type="button" className="v4-btn v4-btn--primary" onClick={() => window.location.reload()}>Reload</button>
            </p>
          </Empty>
        ) : !result ? <LoadingPanel slow={slow} /> : (
          <>
            {sample && (
              <div className="v4-banner v4-banner--sample" role="alert">
                <div>
                  <strong>These are not real numbers.</strong>{' '}
                  Live data isn’t available right now ({REASONS[result.error?.code] || 'the analytics API could not be reached'}),
                  so this page is showing made-up sample data to demonstrate the dashboard. “My session” on the shot chart is still real.
                </div>
                <button type="button" className="v4-btn" onClick={refresh} disabled={refreshing}>{refreshing ? 'Trying…' : 'Try again'}</button>
              </div>
            )}
            {notice && <div className="v4-banner" role="status">{notice}</div>}
            {data.truncated && !sample && (
              <div className="v4-banner" role="note">
                There is more history than one request can carry, so the oldest visits in the 90-day range are missing and its totals are low.
              </div>
            )}
            <Overview data={data} rangeDays={activeRange} session={session} sample={sample} />
          </>
        )}
        </div>
      </main>

      <footer className="v4-footer">
        <p>
          {sample ? 'Sample data. ' : data ? `${fmtInt(data.ranges[ranges[ranges.length - 1]].totals.visits)} visits in the last ${ranges[ranges.length - 1]} days, the site owner’s own included. ` : ''}
          Collected with PostHog, aggregated by a Cloudflare Worker; this page is sent counts and shot positions, never ids.
        </p>
        <p>
          Earlier versions, kept as they were built (they fill gaps with demo data):{' '}
          <a href="/analytics-dashboard.html">v1</a> · <a href="/analytics-v2.html">v2</a> · <a href="/analytics-v3.html">v3</a>
          {' '}· <a href="/portfolio.html">Accessible portfolio</a>
        </p>
      </footer>
    </div>
  );
}

// ── Error boundary ──────────────────────────────────────────────────────────

class Boundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Dashboard v4 render error:', error, info);
    reportError(error, { dashboard_version: 'v4', react_component_stack: info?.componentStack });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="v4 v4-crash" role="alert">
        <h1 className="v4-title">The dashboard hit an error</h1>
        <p>Something in this page failed while drawing. It has been reported automatically.</p>
        <p className="v4-mono">{String(this.state.error?.message || this.state.error)}</p>
        <p className="v4-empty-actions">
          <button type="button" className="v4-btn v4-btn--primary" onClick={() => window.location.reload()}>Reload</button>
          <a className="v4-btn" href="/">Back to the playground</a>
        </p>
      </div>
    );
  }
}

export default function DashboardV4() {
  return <Boundary><Dashboard /></Boundary>;
}
