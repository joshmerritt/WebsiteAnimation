/**
 * charts.jsx — The general-purpose charts of dashboard v4.
 *
 * Drawn as plain SVG / HTML at their measured pixel size (no viewBox scaling),
 * so text is always its real size and never blurry or tiny on a phone.
 *
 * Nothing here animates with requestAnimationFrame. Values render final on the
 * first frame, so a tab opened in the background shows numbers, not zeros.
 */

import { useMemo, useState } from 'react';
import { useChartBox, Tip, TipRow } from './ui.jsx';
import { fmtInt, fmtDay, fmtDayLong, fmtHour, fmtPct, plural } from './format.js';
import { COLOR, RAMP, FUNNEL_RAMP, rampColor, WEEKDAYS, WEEK_ORDER } from './meta.js';

// ── Sparkline (stat tiles) ──────────────────────────────────────────────────

/**
 * A row of small columns: history in the quiet colour, the newest period in
 * the measure's own colour. `values` may contain null (no data for that bin).
 */
export function Sparkline({ values, color, height = 28 }) {
  const n = values.length;
  if (!n) return null;
  const max = Math.max(...values.map((v) => v || 0), 0);
  const gap = 2;
  const w = 100 / n;
  return (
    <svg className="v4-spark" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden="true">
      {values.map((v, i) => {
        if (!v || !max) return <rect key={i} x={i * w + gap / 2} y={height - 1} width={w - gap} height={1} fill="var(--axis)" />;
        const h = Math.max(2, (v / max) * (height - 2));
        return <rect key={i} x={i * w + gap / 2} y={height - h} width={w - gap} height={h} rx="1" fill={i === n - 1 ? color : COLOR.quiet} />;
      })}
    </svg>
  );
}

// ── Activity over time (small multiples) ────────────────────────────────────

/** A top rounded to `r`, square at the baseline: columns grow from the axis. */
function columnPath(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

/** Smallest "nice" axis maximum at or above `v` (never less than 1). */
function niceMax(v) {
  if (v <= 5) return Math.max(1, Math.ceil(v));
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= v) return m * pow;
  return 10 * pow;
}

const ROW_H = 76;      // plot height of one small chart
const ROW_HEAD = 30;   // its title line
const AXIS_H = 26;     // shared date axis under the last chart
const PAD_L = 34;
const PAD_R = 10;

/**
 * One small column chart per measure, stacked on a shared date axis.
 *
 * Three measures on different scales would otherwise mean a dual axis (which
 * invents correlations) or one scale that flattens the small series.
 *
 * series: [{ key, label, color, unit }]
 */
export function TrendChart({ days, series }) {
  const { ref, width, tip, showAt, hide, leave, box } = useChartBox(720);
  const [active, setActive] = useState(null);

  const n = days.length;
  const plotW = Math.max(60, width - PAD_L - PAD_R);
  const band = plotW / n;
  const barW = Math.max(1, Math.min(24, band - (band >= 6 ? 2 : band >= 3 ? 1 : 0)));
  const height = series.length * (ROW_HEAD + ROW_H) + AXIS_H;

  const rows = useMemo(() => series.map((s, i) => {
    const values = days.map((d) => d[s.key] || 0);
    const peak = Math.max(...values, 0);
    return {
      ...s,
      values,
      peak,
      peakAt: values.indexOf(peak),
      total: values.reduce((a, b) => a + b, 0),
      max: niceMax(peak),
      top: i * (ROW_HEAD + ROW_H) + ROW_HEAD,
    };
  }), [days, series]);

  // ~6 date labels, always including both ends.
  const ticks = useMemo(() => {
    const count = Math.min(n, width < 480 ? 3 : 6);
    return count < 2 ? [0] : Array.from({ length: count }, (_, i) => Math.round((i * (n - 1)) / (count - 1)));
  }, [n, width]);

  const xOf = (i) => PAD_L + i * band;

  const focus = (i) => {
    if (i == null || i < 0 || i >= n) { setActive(null); hide(); return; }
    if (i === active) return;   // pointer moved within the same day
    setActive(i);
    showAt(xOf(i) + band / 2, 6, (
      <>
        <div className="v4-tip-title">{fmtDayLong(days[i].date)}</div>
        {rows.map((r) => <TipRow key={r.key} color={r.color} label={r.label} value={fmtInt(r.values[i])} />)}
      </>
    ));
  };
  const indexAt = (clientX) => {
    const rect = box.current?.getBoundingClientRect();
    return rect ? Math.min(n - 1, Math.max(0, Math.floor((clientX - rect.left - PAD_L) / band))) : null;
  };
  const onKey = (e) => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (e.key === 'Escape') { focus(null); return; }
    if (e.key === 'Home') { e.preventDefault(); focus(0); return; }
    if (e.key === 'End') { e.preventDefault(); focus(n - 1); return; }
    if (!step) return;
    e.preventDefault();
    focus(Math.min(n - 1, Math.max(0, (active ?? (step > 0 ? -1 : n)) + step)));
  };

  return (
    <div ref={ref} className="v4-chart-box">
      <svg
        width={width} height={height} className="v4-trend" role="img" tabIndex={0}
        aria-label={`Daily ${series.map((s) => s.label.toLowerCase()).join(', ')} over ${n} days. The table view lists every day.`}
        onPointerMove={(e) => focus(indexAt(e.clientX))}
        onPointerDown={(e) => focus(indexAt(e.clientX))}
        onPointerLeave={(e) => leave(e, () => setActive(null))}
        onKeyDown={onKey}
        onBlur={() => focus(null)}
      >
        {active != null && (
          <rect x={xOf(active)} y={ROW_HEAD - 6} width={Math.max(band, 2)} height={height - AXIS_H - ROW_HEAD + 6} fill="var(--hover)" />
        )}

        {rows.map((r) => {
          const base = r.top + ROW_H;
          return (
            <g key={r.key}>
              <text x={PAD_L} y={r.top - 12} className="v4-svg-label">
                <tspan className="v4-svg-strong">{r.label}</tspan>
                <tspan dx="8">{fmtInt(r.total)} in this range</tspan>
              </text>
              <line x1={PAD_L} x2={width - PAD_R} y1={r.top} y2={r.top} stroke="var(--grid)" />
              <line x1={PAD_L} x2={width - PAD_R} y1={base} y2={base} stroke="var(--axis)" />
              <text x={PAD_L - 8} y={r.top + 4} textAnchor="end" className="v4-svg-tick">{fmtInt(r.max)}</text>
              <text x={PAD_L - 8} y={base + 4} textAnchor="end" className="v4-svg-tick">0</text>

              {r.values.map((v, i) => {
                if (!v) return null;
                const h = Math.max(2, (v / r.max) * ROW_H);
                return <path key={i} d={columnPath(xOf(i) + (band - barW) / 2, base - h, barW, h, barW >= 6 ? 4 : 1.5)} fill={r.color} />;
              })}

              {/* Label only the peak; the axis, tooltip and table carry the rest. */}
              {r.peak > 0 && r.peak < r.max && (
                <text
                  x={Math.min(width - PAD_R - 8, Math.max(PAD_L + 8, xOf(r.peakAt) + band / 2))}
                  y={base - (r.peak / r.max) * ROW_H - 6}
                  textAnchor="middle" className="v4-svg-value"
                >
                  {fmtInt(r.peak)}
                </text>
              )}
            </g>
          );
        })}

        {ticks.map((i, k) => (
          <text
            key={i}
            x={k === 0 ? PAD_L : k === ticks.length - 1 ? width - PAD_R : xOf(i) + band / 2}
            y={height - 8}
            textAnchor={k === 0 ? 'start' : k === ticks.length - 1 ? 'end' : 'middle'}
            className="v4-svg-tick"
          >
            {fmtDay(days[i].date)}
          </text>
        ))}
      </svg>
      <Tip tip={tip} />
    </div>
  );
}

// ── Funnel ──────────────────────────────────────────────────────────────────

/**
 * steps: [{ label, count }] in order. Bars share one baseline so stages compare
 * by length; the ramp runs light → dark with the stage order.
 */
export function FunnelChart({ steps }) {
  const top = steps[0]?.count || 0;
  return (
    <ol className="v4-funnel">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].count : null;
        return (
          <li key={s.label} className="v4-funnel-step">
            <div className="v4-funnel-head">
              <span className="v4-funnel-label">{s.label}</span>
              <span className="v4-funnel-count">{fmtInt(s.count)}</span>
              <span className="v4-funnel-share">{fmtPct(s.count, top)}</span>
            </div>
            <div className="v4-bar-track">
              {s.count > 0 && <div className="v4-bar-fill" style={{ width: `${(s.count / top) * 100}%`, background: FUNNEL_RAMP[Math.min(i, FUNNEL_RAMP.length - 1)] }} />}
            </div>
            {prev != null && (
              <p className="v4-funnel-note">
                {prev > 0 ? `${fmtPct(s.count, prev)} of the step above continued` : 'Nobody reached the step above'}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ── Ranked bars (sources, countries, first contact) ─────────────────────────

/**
 * rows: [{ name, value, note? }], already ranked. One colour for every bar:
 * these are names, not an order, so the bar's length is the only encoding.
 */
export function RankedBars({ rows, color = COLOR.visits, unit = 'visit', showShare = true }) {
  const max = Math.max(...rows.map((r) => r.value), 0);
  const total = rows.reduce((a, r) => a + r.value, 0);
  return (
    <ul className="v4-ranked">
      {rows.map((r) => (
        <li key={r.name} className="v4-ranked-row">
          <div className="v4-ranked-head">
            <span className="v4-ranked-name" title={r.name}>{r.name}</span>
            <span className="v4-ranked-value">
              {fmtInt(r.value)}
              <span className="v4-sr"> {r.value === 1 ? unit : `${unit}s`}</span>
            </span>
            {showShare && <span className="v4-ranked-share">{fmtPct(r.value, total)}</span>}
          </div>
          <div className="v4-bar-track">
            {r.value > 0 && <div className="v4-bar-fill" style={{ width: `${(r.value / max) * 100}%`, background: color }} />}
          </div>
          {r.note && <p className="v4-ranked-note">{r.note}</p>}
        </li>
      ))}
    </ul>
  );
}

// ── Day × hour heat map ─────────────────────────────────────────────────────

const HOUR_TICKS = [0, 6, 12, 18];

/** grid: 7 × 24 visit counts, [day of week, 0 = Sunday][hour], visitor-local time. */
export function ActivityHeatmap({ grid }) {
  const { ref, width, tip, show, leave } = useChartBox(520);
  const [active, setActive] = useState(null);

  const labelW = 38;
  // On the narrowest phones 24 columns only fit with a 1px gap and small cells.
  const gap = width < 340 ? 1 : 2;
  const cell = Math.max(4, Math.min(26, Math.floor((width - labelW - 23 * gap) / 24)));
  const step = cell + gap;
  const gridW = 24 * step - gap;
  const height = 7 * step - gap + 22;
  const max = Math.max(...grid.flat(), 0);

  return (
    <div ref={ref} className="v4-chart-box">
      <svg width={Math.min(width, labelW + gridW)} height={height} role="img"
        aria-label="Visits by day of week and hour of day, in each visitor's local time. Switch to the table for the numbers."
        onPointerLeave={(e) => leave(e, () => setActive(null))}>
        {WEEK_ORDER.map((dow, row) => (
          <g key={dow}>
            <text x={labelW - 8} y={row * step + cell / 2 + 4} textAnchor="end" className="v4-svg-tick">{WEEKDAYS[dow]}</text>
            {grid[dow].map((v, hour) => {
              const key = `${dow}-${hour}`;
              return (
                <rect
                  key={hour}
                  x={labelW + hour * step} y={row * step} width={cell} height={cell} rx="2"
                  fill={v ? rampColor(RAMP.visits, max > 1 ? 0.25 + 0.75 * ((v - 1) / (max - 1)) : 0.7) : 'var(--raised)'}
                  stroke={active === key ? 'var(--text)' : 'none'} strokeWidth="1.5"
                  onPointerEnter={(e) => {
                    setActive(key);
                    show(e, (
                      <>
                        <div className="v4-tip-title">{WEEKDAYS[dow]}, {fmtHour(hour)}–{fmtHour((hour + 1) % 24)}</div>
                        <TipRow label="Visits" value={fmtInt(v)} />
                      </>
                    ));
                  }}
                />
              );
            })}
          </g>
        ))}
        {HOUR_TICKS.map((h) => (
          <text key={h} x={labelW + h * step} y={height - 5} className="v4-svg-tick">{fmtHour(h)}</text>
        ))}
      </svg>
      <ScaleLegend ramp={RAMP.visits} low={max ? '1 visit' : 'No visits'} high={max > 1 ? plural(max, 'visit') : ''} />
      <Tip tip={tip} />
    </div>
  );
}

/** The colour scale for a sequential chart. */
export function ScaleLegend({ ramp, low, high }) {
  return (
    <div className="v4-scale">
      <span>{low}</span>
      <span className="v4-scale-bar" style={{ background: `linear-gradient(90deg, ${ramp.slice(1).join(', ')})` }} aria-hidden="true" />
      <span>{high}</span>
    </div>
  );
}
