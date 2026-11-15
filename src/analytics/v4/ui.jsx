/**
 * ui.jsx — Small building blocks shared by every panel of dashboard v4.
 *
 * Conventions that hold across all of them:
 *   - Text is never drawn in a data colour. Marks (bars, dots, swatches) carry
 *     colour; the words beside them use the three text tokens.
 *   - Every chart card can flip to a table of the same numbers, so nothing is
 *     reachable only by hovering or only by telling colours apart.
 */

import { useCallback, useId, useLayoutEffect, useRef, useState } from 'react';

/**
 * A chart's container: its measured width, and one tooltip positioned inside it.
 *
 * Put `ref` on the element that wraps the chart (it must be position: relative).
 *   width                    its current width in px, re-measured on resize
 *   show(event, content)     tooltip beside the pointer
 *   showAt(x, y, content)    tooltip at a point in the box (keyboard use)
 *   hide()
 *
 * `ref` is a callback ref on purpose. A card can swap its chart for a table and
 * back, which mounts a NEW element; an effect that measured once on mount would
 * go on watching the detached old one and the chart would stop resizing.
 */
export function useChartBox(initialWidth = 640) {
  const [width, setWidth] = useState(initialWidth);
  const [tip, setTip] = useState(null);
  const box = useRef(null);
  const stopWatching = useRef(null);

  const ref = useCallback((el) => {
    stopWatching.current?.();
    stopWatching.current = null;
    box.current = el;
    if (!el) return;

    const measure = () => setWidth(Math.round(el.clientWidth));
    measure();   // synchronous: the first paint already has the real width
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure);
      observer.observe(el);
      stopWatching.current = () => observer.disconnect();
    } else {
      window.addEventListener('resize', measure);
      stopWatching.current = () => window.removeEventListener('resize', measure);
    }
  }, []);

  // Catch a width change between render and commit (fonts, scrollbars).
  useLayoutEffect(() => {
    if (box.current) setWidth(Math.round(box.current.clientWidth));
  }, []);

  const show = useCallback((event, content) => {
    const rect = box.current?.getBoundingClientRect();
    clearTimeout(lingering.current);
    if (rect) setTip({ x: event.clientX - rect.left, y: event.clientY - rect.top, boxW: rect.width, content });
  }, []);
  const showAt = useCallback((x, y, content) => {
    const rect = box.current?.getBoundingClientRect();
    clearTimeout(lingering.current);
    if (rect) setTip({ x, y, boxW: rect.width, content });
  }, []);
  const lingering = useRef(null);
  const hide = useCallback(() => {
    clearTimeout(lingering.current);
    setTip(null);
  }, []);
  /**
   * For onPointerLeave. A mouse leaving hides the tooltip at once. A finger
   * lifting also fires pointerleave, immediately after the tap that opened the
   * tooltip — so for touch it stays up a few seconds instead of flashing.
   */
  const leave = useCallback((event, after) => {
    clearTimeout(lingering.current);
    const done = () => { setTip(null); after?.(); };
    if (event?.pointerType === 'touch') lingering.current = setTimeout(done, 3500);
    else done();
  }, []);
  useLayoutEffect(() => () => clearTimeout(lingering.current), []);

  return { ref, width, tip, show, showAt, hide, leave, box };
}

const TIP_W = 220;

export function Tip({ tip }) {
  if (!tip) return null;
  // Keep it inside the chart: flip to the left of the pointer near the right edge.
  const flip = tip.x + 16 + TIP_W > tip.boxW;
  const left = Math.max(0, flip ? tip.x - 16 - TIP_W : tip.x + 16);
  return (
    <div className="v4-tip" role="status" style={{ left, top: Math.max(0, tip.y - 12), width: TIP_W }}>
      {tip.content}
    </div>
  );
}

/** A row inside a tooltip: optional colour key, a label, and the value (which leads). */
export function TipRow({ color, label, value }) {
  return (
    <div className="v4-tip-row">
      {color && <span className="v4-key-line" style={{ background: color }} aria-hidden="true" />}
      <span className="v4-tip-label">{label}</span>
      <span className="v4-tip-value">{value}</span>
    </div>
  );
}

/** A set of mutually exclusive buttons (range, scope, view). */
export function Segmented({ label, options, value, onChange, size = 'md' }) {
  return (
    <div className={`v4-seg v4-seg--${size}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="v4-seg-btn"
          aria-pressed={value === o.value}
          disabled={o.disabled}
          title={o.title}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * The table twin of a chart.
 * columns: [{ label, numeric? }]   rows: array of cell arrays (strings / numbers)
 */
export function DataTable({ caption, columns, rows, empty = 'No data in this range.' }) {
  if (!rows.length) return <p className="v4-empty-note">{empty}</p>;
  return (
    <div className="v4-table-wrap">
      <table className="v4-table">
        {caption && <caption className="v4-sr">{caption}</caption>}
        <thead>
          <tr>{columns.map((c) => <th key={c.label} scope="col" className={c.numeric ? 'num' : undefined}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (j === 0
                ? <th key={j} scope="row">{cell}</th>
                : <td key={j} className={columns[j]?.numeric ? 'num' : undefined}>{cell}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A panel. Pass `table` ({ caption, columns, rows }) to give it a
 * chart ⇄ table toggle. `actions` choose WHAT is shown and stay in both views;
 * `chartActions` only change how the drawing looks, so they leave with it.
 */
export function Card({ title, subtitle, actions, chartActions, table, footnote, className = '', children }) {
  const [wantsTable, setWantsTable] = useState(false);
  // A card's table can disappear while it is showing (a range with nothing to
  // list). Fall back to the chart rather than leave the card with no controls.
  const asTable = wantsTable && !!table;
  const headingId = useId();
  return (
    <section className={`v4-card ${className}`} aria-labelledby={headingId}>
      <header className="v4-card-head">
        <div className="v4-card-titles">
          <h2 id={headingId} className="v4-card-title">{title}</h2>
          {subtitle && <p className="v4-card-sub">{subtitle}</p>}
        </div>
        {(actions || chartActions || table) && (
          <div className="v4-card-actions">
            {!asTable && chartActions}
            {actions}
            {table && (
              <button type="button" className="v4-btn v4-btn--quiet" aria-pressed={asTable} onClick={() => setWantsTable(!asTable)}>
                {asTable ? 'Show chart' : 'Show table'}
              </button>
            )}
          </div>
        )}
      </header>
      {asTable ? <DataTable {...table} /> : children}
      {footnote && <p className="v4-footnote">{footnote}</p>}
    </section>
  );
}

/** Legend entries mirror their marks: a box for bars, a dot or a cross for shots. */
export function Legend({ items }) {
  return (
    <ul className="v4-legend">
      {items.map((it) => (
        <li key={it.label}>
          {it.shape === 'cross'
            ? <svg className="v4-legend-mark" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke={it.color} strokeWidth="2" strokeLinecap="round" /></svg>
            : <span className={`v4-legend-mark v4-legend-mark--${it.shape || 'box'}`} style={{ background: it.color }} aria-hidden="true" />}
          {it.label}
        </li>
      ))}
    </ul>
  );
}

const ARROW = { up: '▲', down: '▼', flat: '■' };

/**
 * Change against the previous period. Direction is carried by the arrow and the
 * sign as well as the colour. `goodWhenUp` flips which direction reads as good.
 */
export function Delta({ value, unit = '%', versus, goodWhenUp = true }) {
  if (value == null) return <span className="v4-delta v4-delta--none">{versus || 'No earlier period to compare'}</span>;
  const dir = Math.abs(value) < 0.5 ? 'flat' : value > 0 ? 'up' : 'down';
  const tone = dir === 'flat' ? 'flat' : (dir === 'up') === goodWhenUp ? 'good' : 'bad';
  const magnitude = Math.abs(value) >= 100 ? Math.round(Math.abs(value)) : Math.abs(value).toFixed(Math.abs(value) < 10 ? 1 : 0);
  return (
    <span className={`v4-delta v4-delta--${tone}`}>
      <span aria-hidden="true">{ARROW[dir]}</span>
      <span>{dir === 'down' ? '−' : dir === 'up' ? '+' : ''}{magnitude}{unit}</span>
      {versus && <span className="v4-delta-vs">{versus}</span>}
    </span>
  );
}

const STATUS = {
  good: { icon: '●', label: 'Good' },
  warn: { icon: '▲', label: 'Needs work' },
  poor: { icon: '◆', label: 'Poor' },
};

/** Status is always icon + word, never colour alone. */
export function StatusChip({ level }) {
  const s = STATUS[level];
  if (!s) return <span className="v4-status v4-status--none">No samples yet</span>;
  return <span className={`v4-status v4-status--${level}`}><span aria-hidden="true">{s.icon}</span>{s.label}</span>;
}

export function Empty({ title, children }) {
  return (
    <div className="v4-empty">
      <p className="v4-empty-title">{title}</p>
      {children && <div className="v4-empty-body">{children}</div>}
    </div>
  );
}
