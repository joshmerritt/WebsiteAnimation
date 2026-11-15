/**
 * sections.jsx — The data panels of dashboard v4, other than the charts
 * themselves: headline tiles, the written findings, and the tables.
 */

import { Card, DataTable, Delta, StatusChip } from './ui.jsx';
import { Sparkline, RankedBars } from './charts.jsx';
import { COLOR, PROJECTS, PAGE_LABELS, projectByName } from './meta.js';
import { HIT_LABELS } from './court.js';
import { fmtInt, fmtPct, fmtDuration, fmtMs, plural, change } from './format.js';

// ── Headline tiles ──────────────────────────────────────────────────────────

/** Days per sparkline column for each range: 7 → daily, 30 → 3-day, 90 → 10-day. */
const BIN_DAYS = { 7: 1, 30: 3, 90: 10 };

function binned(days, rangeDays, valueOf) {
  const size = BIN_DAYS[rangeDays] || Math.max(1, Math.round(rangeDays / 10));
  const out = [];
  for (let i = 0; i < days.length; i += size) out.push(valueOf(days.slice(i, i + size)));
  return out;
}
const sum = (rows, key) => rows.reduce((a, r) => a + (r[key] || 0), 0);
const rate = (part, whole) => (whole ? (part / whole) * 100 : null);

function Tile({ label, value, sub, delta, spark, color }) {
  return (
    <div className="v4-tile">
      <p className="v4-tile-label">{label}</p>
      <p className="v4-tile-value">{value}</p>
      <p className="v4-tile-sub">{sub}</p>
      <div className="v4-tile-foot">
        {delta}
        {spark && <Sparkline values={spark} color={color} />}
      </div>
    </div>
  );
}

export function KpiRow({ range, days, rangeDays }) {
  const t = range.totals;
  const p = range.prev;   // null when the previous period predates tracking
  const versus = `vs previous ${rangeDays} days`;
  const nothingBefore = `nothing in the previous ${rangeDays} days to compare`;

  /**
   * % change for a count. When there is no honest comparison — no previous
   * period, or a previous value of zero — it says so instead of showing a number.
   */
  const pct = (key) => {
    const c = p ? change(t[key], p[key]) : null;
    return <Delta value={c ? c.pct : null} versus={c ? versus : p ? nothingBefore : undefined} />;
  };
  /** Change in a rate, in percentage points. */
  const points = (now, before) => {
    const ok = p && now != null && before != null;
    return <Delta value={ok ? now - before : null} unit=" pts" versus={ok ? versus : p ? nothingBefore : undefined} />;
  };

  return (
    <div className="v4-tiles">
      <Tile
        label="Visits" value={fmtInt(t.visits)} sub={plural(t.visitors, 'unique visitor')}
        delta={pct('visits')} color={COLOR.visits}
        spark={binned(days, rangeDays, (d) => sum(d, 'visits'))}
      />
      <Tile
        label="Played the game" value={fmtPct(t.players, t.visits)}
        sub={`${fmtInt(t.players)} of ${plural(t.visits, 'visit')} launched a ball`}
        delta={points(rate(t.players, t.visits), p ? rate(p.players, p.visits) : null)} color={COLOR.shots}
        spark={binned(days, rangeDays, (d) => sum(d, 'players'))}
      />
      <Tile
        label="Shot accuracy" value={fmtPct(t.makes, t.shots)}
        sub={`${fmtInt(t.makes)} of ${plural(t.shots, 'shot')} scored`}
        delta={points(rate(t.makes, t.shots), p ? rate(p.makes, p.shots) : null)} color={COLOR.shots}
        spark={binned(days, rangeDays, (d) => sum(d, 'shots'))}
      />
      <Tile
        label="Projects opened" value={fmtInt(t.opens)} sub={`by ${plural(t.openers, 'visit')}`}
        delta={pct('opens')} color={COLOR.opens}
        spark={binned(days, rangeDays, (d) => sum(d, 'opens'))}
      />
      <Tile
        label="Click-throughs" value={fmtInt(t.ctas)}
        sub={t.opens ? `${fmtPct(t.ctas, t.opens)} of project opens` : 'no projects opened'}
        delta={pct('ctas')} color={COLOR.opens}
        spark={binned(days, rangeDays, (d) => sum(d, 'ctas'))}
      />
      <Tile
        label="Average visit" value={fmtDuration(t.avgDurationSec)} sub={`half are under ${fmtDuration(t.medianDurationSec)}`}
        delta={pct('avgDurationSec')} color={COLOR.visits}
        spark={binned(days, rangeDays, (d) => { const v = sum(d, 'visits'); return v ? d.reduce((a, r) => a + r.avgDurationSec * r.visits, 0) / v : null; })}
      />
    </div>
  );
}

// ── Findings, in sentences ──────────────────────────────────────────────────

/**
 * Plain statements computed from the range's data. Each one says what it was
 * computed from; none of them recommends anything, because at this traffic a
 * recommendation would be reading tea leaves.
 */
export function buildFindings(range, shots, rangeDays) {
  const t = range.totals;
  const out = [];
  if (!t.visits) {
    return [{ tone: 'note', lead: 'Nothing to report.', text: `No visits were recorded in the last ${rangeDays} days.` }];
  }

  if (t.visits < 30) {
    out.push({
      tone: 'note', lead: 'Small sample.',
      text: `There ${t.visits === 1 ? 'was only 1 visit' : `were only ${t.visits} visits`} in this range, so a single busy session moves every rate on this page. Read them as anecdotes, not trends.`,
    });
  }

  if (range.prev && range.prev.visits > 0) {
    const c = change(t.visits, range.prev.visits);
    if (c && !c.flat) {
      out.push({
        tone: c.up ? 'good' : 'warn', lead: c.up ? 'Traffic is up.' : 'Traffic is down.',
        text: `${plural(t.visits, 'visit')} against ${range.prev.visits} in the ${rangeDays} days before — ${c.up ? 'an increase' : 'a drop'} of ${Math.abs(c.pct).toFixed(0)}%.`,
      });
    }
  }

  out.push({
    tone: 'info', lead: 'Who plays.',
    text: t.players
      ? `${t.players} of ${plural(t.visits, 'visit')} (${fmtPct(t.players, t.visits)}) launched at least one ball, and ${t.scorers} of those scored.`
      : `None of the ${plural(t.visits, 'visit')} launched a ball.`,
  });

  if (t.suspectedBots > 0) {
    const humans = t.visits - t.suspectedBots;
    out.push({
      tone: 'info', lead: 'Probably not people.',
      text: `${plural(t.suspectedBots, 'visit')} left within seconds, before the game loaded, with the clock set to UTC — the signature of an automated browser. ` +
        (humans > 0 ? `Set those aside and ${fmtPct(t.players, humans)} of the rest played.` : 'That is every visit in this range.'),
    });
  }

  if (t.opens > t.makes && t.opens > 0) {
    const skipped = t.opens - t.makes;
    out.push({
      tone: 'info', lead: skipped * 2 > t.opens ? 'Most opens skip the goal.' : 'Some opens skip the goal.',
      text: `${skipped} of ${plural(t.opens, 'project open')} came from double-clicking a ball rather than scoring with it` +
        (t.hinted ? ` — the shortcut the game suggests after three misses in a row, which it did in ${plural(t.hinted, 'visit')}.` : '.'),
    });
  }

  const misses = shots.filter((s) => !s.made);
  if (misses.length >= 3) {
    const tally = {};
    for (const s of misses) tally[s.hit] = (tally[s.hit] || 0) + 1;
    const [hit, n] = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
    out.push({
      tone: 'info', lead: 'Where misses go.',
      text: `${n} of ${misses.length} missed shots first hit the ${(HIT_LABELS[hit] || 'something else').toLowerCase()}. The ball is nearly as wide as the goal, so most misses are decided at its mouth.`,
    });
  }

  const launched = [...range.balls].sort((a, b) => b.launches - a.launches)[0];
  const opened = [...range.balls].sort((a, b) => b.opens - a.opens)[0];
  if (launched?.launches > 0 || opened?.opens > 0) {
    const parts = [];
    if (launched?.launches > 0) parts.push(`${projectByName(launched.ball).name} was launched most (${plural(launched.launches, 'shot')})`);
    if (opened?.opens > 0) parts.push(`${projectByName(opened.ball).name} was opened most (${plural(opened.opens, 'time')})`);
    out.push({ tone: 'info', lead: 'Most popular.', text: `${parts.join('; ')}.` });
  }

  const lcp = range.perf.lcp;
  if (lcp.n >= 3 && lcp.p75 > 4000) {
    out.push({
      tone: 'warn', lead: 'Slow largest paint.',
      text: `Three in four visits painted their largest element within ${fmtMs(lcp.p75)} (${lcp.n} samples); the usual bar for “good” is 2.5 s.`,
    });
  }

  return out.slice(0, 6);
}

export function Findings({ items }) {
  return (
    <Card title="What the data says" subtitle="Computed from the numbers on this page, for the range selected above">
      <ul className="v4-findings">
        {items.map((f) => (
          <li key={f.lead} className={`v4-finding v4-finding--${f.tone}`}>
            <span className="v4-finding-mark" aria-hidden="true" />
            <p><strong>{f.lead}</strong> {f.text}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ── Projects ────────────────────────────────────────────────────────────────

export function ProjectsTable({ balls }) {
  // Every project gets a row, including ones nobody touched in this range.
  const seen = new Map(balls.map((b) => [b.ball, b]));
  const rows = [
    ...PROJECTS.map((p) => ({ ...p, ...(seen.get(p.name) || { launches: 0, scores: 0, opens: 0, ctas: 0 }) })),
    ...balls.filter((b) => !PROJECTS.some((p) => p.name === b.ball)).map((b) => ({ ...projectByName(b.ball), ...b })),
  ].sort((a, b) => b.launches - a.launches || b.opens - a.opens || a.name.localeCompare(b.name));
  const max = Math.max(...rows.map((r) => r.launches), 0);

  return (
    <Card title="Projects" subtitle="Each project is a ball: launched, scored through its goal, opened, and clicked through">
      <div className="v4-table-wrap">
        <table className="v4-table v4-table--projects">
          <thead>
            <tr>
              <th scope="col">Project</th>
              <th scope="col" className="v4-col-bar">Launched</th>
              <th scope="col" className="num">Scored</th>
              <th scope="col" className="num">Accuracy</th>
              <th scope="col" className="num">Opened</th>
              <th scope="col" className="num">Clicked through</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <th scope="row">
                  <span className="v4-project-name">{r.name}</span>
                  {r.category && <span className="v4-project-cat">{r.category}</span>}
                </th>
                <td className="v4-col-bar">
                  <div className="v4-inline-bar">
                    <span className="v4-inline-num">{fmtInt(r.launches)}</span>
                    <span className="v4-bar-track">{r.launches > 0 && <span className="v4-bar-fill" style={{ width: `${(r.launches / max) * 100}%`, background: COLOR.shots }} />}</span>
                  </div>
                </td>
                <td className="num">{fmtInt(r.scores)}</td>
                <td className="num">{fmtPct(r.scores, r.launches)}</td>
                <td className="num">{fmtInt(r.opens)}</td>
                <td className="num">{fmtInt(r.ctas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── Audience ────────────────────────────────────────────────────────────────

export function Sources({ rows }) {
  const table = {
    caption: 'Visits by source',
    columns: [{ label: 'Source' }, { label: 'Visits', numeric: true }, { label: 'Played', numeric: true }],
    rows: rows.map((r) => [r.name, r.visits, r.players]),
  };
  return (
    <Card title="Where visits come from" subtitle="The site that linked here, per visit" table={table}>
      {rows.length
        ? <RankedBars rows={rows.map((r) => ({ name: r.name, value: r.visits, note: r.players ? `${plural(r.players, 'visit')} played` : undefined }))} />
        : <p className="v4-empty-note">No visits in this range.</p>}
    </Card>
  );
}

export function Countries({ rows }) {
  const table = {
    caption: 'Visits by country',
    columns: [{ label: 'Country' }, { label: 'Visits', numeric: true }, { label: 'Visitors', numeric: true }],
    rows: rows.map((r) => [r.name, r.visits, r.visitors]),
  };
  return (
    <Card title="Countries" subtitle="From the visitor’s IP address, per visit" table={table}>
      {rows.length
        ? <RankedBars rows={rows.map((r) => ({ name: r.name, value: r.visits }))} />
        : <p className="v4-empty-note">No visits in this range.</p>}
    </Card>
  );
}

export function Devices({ rows, pages }) {
  return (
    <Card title="Devices and pages" subtitle="How the playground is used on each kind of screen">
      <DataTable
        caption="Engagement by device"
        columns={[{ label: 'Device' }, { label: 'Visits', numeric: true }, { label: 'Played', numeric: true }, { label: 'Accuracy', numeric: true }, { label: 'Avg. visit', numeric: true }]}
        rows={rows.map((d) => [d.device, fmtInt(d.visits), fmtPct(d.players, d.visits), fmtPct(d.makes, d.shots), fmtDuration(d.avgDurationSec)])}
        empty="No visits in this range."
      />
      <h3 className="v4-h3 v4-h3--spaced">Page views</h3>
      <RankedBars
        rows={pages.map((p) => ({ name: PAGE_LABELS[p.key] || p.key, value: p.views }))}
        color={COLOR.quiet} unit="view" showShare={false}
      />
      <p className="v4-footnote">Dashboard views are tracked but never counted as visits to the portfolio.</p>
    </Card>
  );
}

// ── Performance ─────────────────────────────────────────────────────────────

/** [good up to, needs-work up to]; beyond that is poor. Web Vitals use Google's published thresholds. */
const LIMITS = {
  loadMs: [2500, 4000],
  lcp: [2500, 4000],
  fcp: [1800, 3000],
  inp: [200, 500],
  cls: [0.1, 0.25],
};
const lowerIsBetter = (key, v) => (v == null ? null : v <= LIMITS[key][0] ? 'good' : v <= LIMITS[key][1] ? 'warn' : 'poor');
const fpsLevel = (v, good, ok) => (v == null ? null : v >= good ? 'good' : v >= ok ? 'warn' : 'poor');

/** `level`: 'good' | 'warn' | 'poor', null for "no samples", or undefined for a measure with no scale. */
function PerfTile({ label, value, level, note }) {
  return (
    <div className="v4-perf">
      <p className="v4-tile-label">{label}</p>
      <p className="v4-perf-value">{value}</p>
      {level !== undefined && <StatusChip level={level} />}
      <p className="v4-tile-sub">{note}</p>
    </div>
  );
}

export function Performance({ perf }) {
  const samples = (n) => (n ? plural(n, 'sample') : 'no samples in this range');
  return (
    <Card title="How it runs" subtitle="Measured in visitors’ browsers: loading, frame rate and Core Web Vitals">
      <div className="v4-perf-grid">
        <PerfTile label="Game ready" value={fmtMs(perf.loadMs.p50)} level={lowerIsBetter('loadMs', perf.loadMs.p50)}
          note={`median wait on the loading screen · ${samples(perf.loadMs.n)}`} />
        <PerfTile label="First shot" value={fmtMs(perf.firstShotMs.p50)}
          note={`median time from arriving to launching · ${samples(perf.firstShotMs.n)}`} />
        <PerfTile label="Frame rate" value={perf.fps.avg != null ? `${perf.fps.avg} fps` : '—'} level={fpsLevel(perf.fps.avg, 50, 30)}
          note={`average while playing${perf.fps.low != null ? `; typical worst dip ${perf.fps.low} fps` : ''} · ${samples(perf.fps.n)}`} />
        <PerfTile label="Largest paint (LCP)" value={fmtMs(perf.lcp.p75)} level={lowerIsBetter('lcp', perf.lcp.p75)}
          note={`75th percentile · ${samples(perf.lcp.n)}`} />
        <PerfTile label="Responsiveness (INP)" value={fmtMs(perf.inp.p75)} level={lowerIsBetter('inp', perf.inp.p75)}
          note={`75th percentile · ${samples(perf.inp.n)}`} />
        <PerfTile label="Layout shift (CLS)" value={perf.cls.p75 != null ? perf.cls.p75.toFixed(3) : '—'} level={lowerIsBetter('cls', perf.cls.p75)}
          note={`75th percentile · ${samples(perf.cls.n)}`} />
      </div>
    </Card>
  );
}
