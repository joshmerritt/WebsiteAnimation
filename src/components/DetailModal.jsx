/**
 * DetailModal.jsx — Project detail modal
 *
 * Shown when a ball scores or is double-clicked. Displays project info
 * with hero image, metadata table, and CTA link.
 *
 * Layout (top → bottom):
 *   1. Hero image with subtle bottom-only gradient (10%)
 *   2. Close button (absolute positioned, upper right corner)
 *   3. Title (centered, Syne font — matches homepage)
 *   4. Info table (goal, role, tech, summary)
 *   5. CTA link button (centered)
 */

import { useCallback } from 'react';
import config from '../game/config.js';
import bus from '../game/EventBus.js';

function isSafeUrl(url) {
  try { return ['http:', 'https:', 'mailto:'].includes(new URL(url).protocol); }
  catch { return false; }
}

function ctaLabel(link) {
  if (!link) return null;
  if (link.includes('linkedin.com'))  return 'View LinkedIn ↗';
  if (link.includes('github.com'))    return 'View on GitHub ↗';
  if (link.includes('upwork.com'))    return 'View Upwork Profile ↗';
  if (link.includes('.html'))         return 'View Dashboard ↗';
  if (link.includes('.app'))          return 'Open App ↗';
  return 'View Project ↗';
}

/** Block ALL pointer/touch events from reaching the p5 canvas beneath */
function blockCanvas(e) {
  e.stopPropagation();
}

export default function DetailModal({ detail, onClose }) {
  const handleBackdrop = useCallback(
    (e) => { if (e.target === e.currentTarget) onClose(); },
    [onClose],
  );

  /** Shared handler for interactive elements — stop propagation AND handle click */
  const handleButtonClick = useCallback((e) => {
    e.stopPropagation();
  }, []);

  /** CTA click handler — emit tracking event then allow default navigation */
  const handleCtaClick = useCallback((e) => {
    e.stopPropagation();
    if (detail) {
      bus.emit('cta:click', {
        name: detail.name || 'unknown',
        link: detail.link || '',
        category: detail.category || '',
      });
    }
  }, [detail]);

  if (!detail) return null;

  const hasLink = detail.link && detail.link !== 'null' && detail.link.trim() !== '' && isSafeUrl(detail.link);

  const rows = [
    { label: 'Goal',       value: detail.goal },
    { label: 'My Role',    value: detail.role },
    { label: 'Technology', value: detail.technology },
    { label: 'Summary',    value: detail.description },
  ].filter((r) => r.value);

  const heroMode = detail.heroMode || 'banner';
  const heroClass = `modal-hero modal-hero--${heroMode}`;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={handleBackdrop}
      onPointerDown={blockCanvas}
      onTouchStart={blockCanvas}
      onTouchEnd={blockCanvas}
      onTouchMove={blockCanvas}
      onMouseDown={blockCanvas}
    >
      <div
        className={`modal-card ${heroMode === 'full' ? 'modal-card--full-hero' : ''}`}
        onClick={blockCanvas}
        onPointerDown={blockCanvas}
      >
        {/* Sleek close icon — no button chrome */}
        <button
          className="modal-close"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          onPointerDown={handleButtonClick}
          onTouchStart={handleButtonClick}
          aria-label="Close"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="4" y1="4" x2="14" y2="14" />
            <line x1="14" y1="4" x2="4" y2="14" />
          </svg>
        </button>

        {detail.imageSrc && (
          <div className={heroClass}>
            <img src={detail.imageSrc} alt={detail.name} loading="lazy" decoding="async" />
            <div className="modal-hero-gradient" />
          </div>
        )}

        <div className="modal-content">
          <h2 id="modal-title" className="modal-title modal-title--centered">{detail.name}</h2>

          <table className="modal-table">
            <tbody>
              {rows.map(({ label, value }) => (
                <tr key={label}>
                  <td className="modal-label">{label}</td>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {hasLink && (
            <a
              className="modal-cta"
              href={detail.link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleCtaClick}
              onPointerDown={handleButtonClick}
              onTouchStart={handleButtonClick}
            >
              {ctaLabel(detail.link)}
            </a>
          )}

          <span className="modal-version">v{config.version}</span>
        </div>
      </div>
    </div>
  );
}
