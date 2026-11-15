/**
 * ShotChart.jsx — Where shots first made contact, drawn on the real court.
 *
 * The court is the playground's actual geometry (court.js mirrors the game's
 * layout maths), and every mark is a recorded first contact: the viewer's own
 * shots from their browser, or every visitor's from PostHog. Nothing here is
 * scattered for effect.
 *
 * It opens on the viewer's own session when they have one, and falls back to
 * all visitors when they have not played. Two views of the same court are
 * shown: the whole screen, and a close-up of the goal, where almost every miss
 * is decided.
 */

import { useMemo, useState } from 'react';
import { Card, Segmented, Legend, Empty, useChartBox, Tip, TipRow } from './ui.jsx';
import { RankedBars, ScaleLegend } from './charts.jsx';
import { computeLayout, placeShot, shotViewport, courtKind, COURTS, HIT_LABELS } from './court.js';
import { COLOR, RAMP, rampColor, PROJECTS, PROJECT_COUNT, CATEGORIES, projectByName } from './meta.js';
import { fmtInt, fmtPct, fmtDaysAgo, plural } from './format.js';

/** Walls run two screen-heights above the top; draw this much of that. */
const HEADROOM = 0.25;
const MAX_COURT_H = 480;
const FIELD = '#0c1116';   // the court surface: a step darker than the card

const layoutFor = (w, h) => computeLayout(w, h, PROJECT_COUNT, CATEGORIES.length);

/** Gaussian density of shots over a view rectangle, as drawable cells. */
function heatCells(shots, vb, sigma, cols) {
  const cell = vb.w / cols;
  const rows = Math.ceil(vb.h / cell);
  const inv = 1 / (2 * sigma * sigma);
  const reach = (3 * sigma) ** 2;
  const cells = [];
  let max = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = vb.x + (c + 0.5) * cell;
      const y = vb.y + (r + 0.5) * cell;
      let v = 0;
      for (const s of shots) {
        const d2 = (s.cx - x) ** 2 + (s.vy - y) ** 2;
        if (d2 < reach) v += Math.exp(-d2 * inv);
      }
      if (v > 0.03) {
        cells.push({ x: vb.x + c * cell, y: vb.y + r * cell, v });
        if (v > max) max = v;
      }
    }
  }
  return { cells, cell, max };
}

/**
 * One drawing of the court. `vb` is the part of it to show, in court pixels;
 * `width`/`height` are its size on screen.
 */
function CourtView({ L, vb, width, height, shots, view, hovered, onHover, title }) {
  const scale = width / vb.w;          // screen px per court px
  const u = (px) => px / scale;        // a screen-px length, in court px

  const visible = useMemo(
    () => shots.filter((s) => s.cx >= vb.x && s.cx <= vb.x + vb.w && s.vy >= vb.y && s.vy <= vb.y + vb.h),
    [shots, vb],
  );
  const heat = useMemo(
    () => (view === 'heat' ? heatCells(visible, vb, L.iconSize * 0.42, 46) : null),
    [view, visible, vb, L.iconSize],
  );

  const nearest = (e) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = vb.x + (e.clientX - box.left) / scale;
    const y = vb.y + (e.clientY - box.top) / scale;
    let best = null;
    let bestD = u(18) ** 2;          // must be within 18 screen px: a 36px target per mark
    for (const s of visible) {
      const d = (s.cx - x) ** 2 + (s.vy - y) ** 2;
      if (d < bestD) { bestD = d; best = s; }
    }
    onHover(best, e);
  };

  const showBarLabels = L.menuHeight * scale >= 12;
  const showBallLabels = L.iconSize * scale >= 44;
  const cross = u(4.5);

  return (
    <svg
      className="v4-court" width={width} height={height}
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} role="img" aria-label={title}
      onPointerMove={view === 'dots' ? nearest : undefined}
      onPointerDown={view === 'dots' ? nearest : undefined}
      onPointerLeave={(e) => onHover(null, e)}
    >
      {/* The screen, and the strip above it that balls can fly up into. */}
      <rect x={0} y={-L.height * HEADROOM} width={L.width} height={L.height * HEADROOM} fill="var(--card)" />
      <rect x={0} y={0} width={L.width} height={L.height} fill={FIELD} />
      <line x1={0} x2={L.width} y1={0} y2={0} stroke="var(--axis)" vectorEffect="non-scaling-stroke" />
      {vb.y < 0 && L.width * scale >= 300 && (
        <text x={L.width - u(10)} y={-u(9)} textAnchor="end" fontSize={u(12)} fill="var(--text-3)">above the top of the screen</text>
      )}

      {heat && heat.cells.map((c, i) => (
        <rect key={i} x={c.x} y={c.y} width={heat.cell + u(0.5)} height={heat.cell + u(0.5)}
          fill={rampColor(RAMP.shots, c.v / heat.max)} fillOpacity={0.3 + 0.7 * (c.v / heat.max)} />
      ))}

      {/* Where each project's ball starts. */}
      {L.balls.map((b, i) => (
        <g key={i}>
          <circle cx={b.x} cy={b.y} r={L.ballRadius} fill="var(--raised)" fillOpacity={heat ? 0.35 : 0.7}
            stroke="var(--border-strong)" vectorEffect="non-scaling-stroke" />
          {showBallLabels && (
            <text x={b.x} y={b.y + u(4)} textAnchor="middle" fontSize={u(11)} fill="var(--text-3)">{PROJECTS[i]?.short}</text>
          )}
        </g>
      ))}

      {/* Side walls: they continue above the screen, the floor does not exist. */}
      {[0, L.width].map((x) => (
        <line key={x} x1={x} x2={x} y1={-L.height * HEADROOM} y2={L.height} stroke="var(--text-3)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      ))}

      {/* The goal: two posts, a net barrier under each, a bar per category. */}
      {[L.leftDotX, L.rightDotX].map((x) => (
        <g key={x}>
          <rect x={x - L.netWidth / 2} y={L.dotY} width={L.netWidth} height={L.netBottomY - L.dotY} rx={L.netWidth / 4} fill="var(--text-3)" fillOpacity="0.28" />
          <circle cx={x} cy={L.dotY} r={L.dotRadius} fill={FIELD} stroke="var(--text)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </g>
      ))}
      {L.menuYs.map((y, i) => (
        <g key={i}>
          {/* Drawn at the physics body's real size, so a contact on a bar's end is on its end. */}
          <rect x={L.dotCenterX - L.menuWidth / 2} y={y - L.menuHeight / 2} width={L.menuWidth} height={L.menuHeight}
            rx={L.menuHeight / 4} fill="var(--raised)" stroke="var(--border-strong)" vectorEffect="non-scaling-stroke" />
          {showBarLabels && (
            <text x={L.dotCenterX} y={y + u(4)} textAnchor="middle" fontSize={u(Math.min(12, L.menuHeight * scale * 0.72))} fill="var(--text-2)">{CATEGORIES[i]}</text>
          )}
        </g>
      ))}

      {view === 'dots' && visible.map((s) => (s.made
        ? <circle key={s.i} cx={s.cx} cy={s.vy} r={u(5.5)} fill={COLOR.made} stroke={FIELD} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        : (
          <g key={s.i}>
            {/* A wider stroke in the court colour underneath keeps crossing marks apart. */}
            <path d={`M${s.cx - cross},${s.vy - cross}L${s.cx + cross},${s.vy + cross}M${s.cx + cross},${s.vy - cross}L${s.cx - cross},${s.vy + cross}`}
              stroke={FIELD} strokeWidth="5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <path d={`M${s.cx - cross},${s.vy - cross}L${s.cx + cross},${s.vy + cross}M${s.cx + cross},${s.vy - cross}L${s.cx - cross},${s.vy + cross}`}
              stroke={COLOR.missed} strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </g>
        )))}

      {view === 'dots' && hovered && visible.some((s) => s.i === hovered.i) && (
        <circle cx={hovered.cx} cy={hovered.vy} r={u(11)} fill="none" stroke="var(--text)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
}

export default function ShotChart({ allShots, session, totals, rangeDays, sample }) {
  const chart = useChartBox(900);
  const { width } = chart;
  const [picked, setPicked] = useState(null);       // scope the viewer chose, if any
  const [view, setView] = useState('dots');
  const [pickedKind, setPickedKind] = useState(null);
  const [hovered, setHovered] = useState(null);

  // Default to the viewer's own session; with none, there is nothing of theirs
  // to show, so start on everyone. An explicit choice always wins.
  const hasSession = !!session && session.counts.shots > 0;
  const scope = picked ?? (hasSession ? 'session' : 'all');

  const source = scope === 'session' ? (session?.plotted ?? []) : allShots;

  // The game has three layouts; shots from one can't share a court with another.
  const kinds = useMemo(() => {
    const tally = {};
    for (const s of source) { const k = courtKind(...shotViewport(s)); tally[k] = (tally[k] || 0) + 1; }
    return Object.entries(tally).sort((a, b) => b[1] - a[1]);
  }, [source]);
  const kind = kinds.some(([k]) => k === pickedKind) ? pickedKind : (kinds[0]?.[0] ?? 'desktop');

  const { L, placed } = useMemo(() => {
    const mine = source.filter((s) => courtKind(...shotViewport(s)) === kind);
    // The viewer's own shots are drawn on their own screen's court, so each one
    // sits exactly where it happened. Everyone's are drawn on a typical screen.
    let size = COURTS[kind].ref;
    if (scope === 'session' && mine.length) {
      const tally = new Map();
      for (const s of mine) { const key = `${s.vw}x${s.vh}`; tally.set(key, (tally.get(key) || 0) + 1); }
      size = [...tally].sort((a, b) => b[1] - a[1])[0][0].split('x').map(Number);
    }
    const layout = layoutFor(size[0], size[1]);
    const top = -layout.height * HEADROOM;
    return {
      L: layout,
      placed: mine.map((s, i) => {
        const p = placeShot(s, layout, PROJECT_COUNT, CATEGORIES.length);
        // Contacts above the drawn strip are pinned to its top edge.
        return { ...s, i, cx: p.cx, cy: p.cy, vy: Math.max(p.cy, top + layout.height * 0.012), above: p.cy < top };
      }),
    };
  }, [source, kind, scope]);

  // ── The two views of the court ──
  const margin = L.width * 0.01;
  const fullVb = useMemo(() => ({
    x: -margin, y: -L.height * HEADROOM, w: L.width + margin * 2, h: L.height * (1 + HEADROOM),
  }), [L, margin]);
  const goalVb = useMemo(() => {
    const x = -L.iconSize * 0.12;
    const y = L.dotY - L.iconSize * 1.75;
    return { x, y, w: Math.min(L.width, L.rightDotX + L.iconSize * 1.6) - x, h: L.netBottomY + L.iconSize * 0.8 - y };
  }, [L]);

  const gap = 16;
  const fullAsp = fullVb.w / fullVb.h;
  const goalAsp = goalVb.w / goalVb.h;
  const sideBySide = width >= 620;
  let fullSize, goalSize;
  if (sideBySide) {
    const h = Math.min(MAX_COURT_H, (width - gap) / (fullAsp + goalAsp));
    fullSize = [h * fullAsp, h];
    goalSize = [h * goalAsp, h];
  } else {
    const fw = Math.min(width, MAX_COURT_H * fullAsp);
    const gw = Math.min(width, 380 * goalAsp);
    fullSize = [fw, fw / fullAsp];
    goalSize = [gw, gw / goalAsp];
  }

  // ── Numbers beside the court ──
  const shotCount = scope === 'session' ? (session?.counts.shots ?? 0) : totals.shots;
  const makeCount = scope === 'session' ? (session?.counts.makes ?? 0) : totals.makes;
  const contacts = useMemo(() => {
    const by = new Map();
    for (const s of placed) {
      const row = by.get(s.hit) || { name: HIT_LABELS[s.hit] || HIT_LABELS.unknown, value: 0, made: 0 };
      row.value++;
      if (s.made) row.made++;
      by.set(s.hit, row);
    }
    return [...by.values()].sort((a, b) => b.value - a.value)
      .map((r) => ({ ...r, note: r.made ? `${plural(r.made, 'shot')} went on to score` : undefined }));
  }, [placed]);

  const onHover = (shot, event) => {
    // Leaving the court (shot === null with an event) on a touch screen happens
    // the moment the finger lifts; chart.leave() keeps the tooltip up briefly.
    if (!shot) {
      if (event) chart.leave(event, () => setHovered(null));
      else { setHovered(null); chart.hide(); }
      return;
    }
    setHovered(shot);
    chart.show(event, (
      <>
        <div className="v4-tip-title">{shot.ball || 'Unknown project'}</div>
        <TipRow label="Outcome" value={shot.made ? 'Scored' : 'Missed'} />
        <TipRow label="First touched" value={HIT_LABELS[shot.hit] || HIT_LABELS.unknown} />
        {shot.above && <TipRow label="Height" value="Far above the screen" />}
        {scope === 'session'
          ? shot.n != null && <TipRow label="Your shot" value={`#${shot.n}`} />
          : <TipRow label="When" value={fmtDaysAgo(shot.d)} />}
      </>
    ));
  };

  const table = {
    caption: 'Shots plotted on the court',
    columns: [{ label: 'Project' }, { label: 'First touched' }, { label: 'Outcome' }, { label: scope === 'session' ? 'Shot' : 'When' }],
    rows: placed.map((s) => [
      s.ball || 'Unknown', HIT_LABELS[s.hit] || HIT_LABELS.unknown, s.made ? 'Scored' : 'Missed',
      scope === 'session' ? (s.n != null ? `#${s.n}` : '—') : fmtDaysAgo(s.d),
    ]),
    empty: 'No shots to list.',
  };

  const scopeName = scope === 'session' ? 'your session' : `all visitors, last ${rangeDays} days`;
  const courtName = scope === 'session'
    ? `your ${L.width}×${L.height} screen`
    : `a typical ${COURTS[kind].label.toLowerCase()} screen`;

  return (
    <Card
      className="v4-shot-card"
      title="Shot chart"
      subtitle={`Where each shot first touched something — ${scopeName}${sample && scope === 'all' ? ' (sample data)' : ''}`}
      table={placed.length ? table : undefined}
      chartActions={(
        <Segmented label="View" size="sm" value={view} onChange={setView}
          options={[{ value: 'dots', label: 'Shots' }, { value: 'heat', label: 'Heat map' }]} />
      )}
      // Layout and whose-shots decide which rows the table lists, so they stay
      // when the court is swapped for the table.
      actions={(
        <>
          {kinds.length > 1 && (
            <Segmented label="Screen layout" size="sm" value={kind} onChange={setPickedKind}
              options={kinds.map(([k, n]) => ({ value: k, label: `${COURTS[k].label} (${fmtInt(n)})` }))} />
          )}
          <Segmented label="Whose shots" size="sm" value={scope} onChange={setPicked}
            options={[{ value: 'session', label: 'My session' }, { value: 'all', label: 'All visitors' }]} />
        </>
      )}
    >
      <div ref={chart.ref} className="v4-chart-box">
        {placed.length === 0 ? (
          <Empty title={
            scope === 'session'
              ? (hasSession ? `None of your ${plural(shotCount, 'shot')} touched anything yet` : 'You haven’t taken a shot yet')
              : `No shots recorded in the last ${rangeDays} days`
          }>
            {scope === 'session' ? (
              <>
                <p>
                  {hasSession
                    ? 'A shot appears here once the ball hits a wall, the net, the goal or another ball.'
                    : 'Launch a few balls on the playground and they will appear here as you play — this chart reads them straight from your browser.'}
                </p>
                <p className="v4-empty-actions">
                  <a className="v4-btn v4-btn--primary" href="/">Open the playground</a>
                  <button type="button" className="v4-btn" onClick={() => setPicked('all')}>See all visitors instead</button>
                </p>
              </>
            ) : <p>Try a longer range.</p>}
          </Empty>
        ) : (
          <>
            <div className={`v4-courts ${sideBySide ? '' : 'v4-courts--stacked'}`} style={{ gap }}>
              <figure className="v4-court-fig" style={{ width: fullSize[0] }}>
                <CourtView L={L} vb={fullVb} width={fullSize[0]} height={fullSize[1]} shots={placed} view={view}
                  hovered={hovered} onHover={onHover}
                  title={`${plural(placed.length, 'shot')} on the whole court, ${scopeName}. Switch to the table for a list.`} />
                <figcaption>Whole screen, drawn as {courtName}. The side walls carry on above it; there is no floor.</figcaption>
              </figure>
              <figure className="v4-court-fig" style={{ width: goalSize[0] }}>
                <CourtView L={L} vb={goalVb} width={goalSize[0]} height={goalSize[1]} shots={placed} view={view}
                  hovered={hovered} onHover={onHover}
                  title={`Close-up of the goal, ${scopeName}.`} />
                <figcaption>Close-up of the goal</figcaption>
              </figure>
            </div>

            <div className="v4-shot-foot">
              <div className="v4-shot-stats">
                <div className="v4-shot-stat"><span className="v4-shot-num">{fmtInt(shotCount)}</span><span className="v4-shot-lbl">{shotCount === 1 ? 'shot' : 'shots'}</span></div>
                <div className="v4-shot-stat"><span className="v4-shot-num">{fmtInt(makeCount)}</span><span className="v4-shot-lbl">scored</span></div>
                <div className="v4-shot-stat"><span className="v4-shot-num">{fmtPct(makeCount, shotCount)}</span><span className="v4-shot-lbl">accuracy</span></div>
                {scope === 'session' && totals.shots > 0 && (
                  <div className="v4-shot-stat"><span className="v4-shot-num">{fmtPct(totals.makes, totals.shots)}</span><span className="v4-shot-lbl">all visitors, {rangeDays} days{sample ? ' (sample)' : ''}</span></div>
                )}
              </div>

              <div className="v4-shot-contacts">
                <h3 className="v4-h3">What the ball touched first</h3>
                <RankedBars rows={contacts} color={COLOR.shots} unit="shot" />
              </div>

              <div className="v4-shot-key">
                {view === 'dots'
                  ? <Legend items={[{ label: 'Scored', color: COLOR.made, shape: 'dot' }, { label: 'Missed', color: COLOR.missed, shape: 'cross' }]} />
                  : <ScaleLegend ramp={RAMP.shots} low="Fewer first contacts" high="More" />}
                <p className="v4-footnote">
                  {plural(placed.length, 'shot')} plotted
                  {shotCount > placed.length && kinds.length <= 1 ? `; ${plural(shotCount - placed.length, 'shot')} left the screen without touching anything` : ''}.
                  {scope === 'session' ? ' Updates live while you play in another tab.' : ''}
                </p>
              </div>
            </div>
          </>
        )}
        <Tip tip={chart.tip} />
      </div>
    </Card>
  );
}
