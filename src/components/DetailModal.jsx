/**
 * DetailModal.jsx — Project detail modal
 *
 * Shown when a ball scores or is double-clicked. Displays project info
 * with hero image, metadata table, and CTA link.
 */

import { useCallback } from 'react';

function ctaLabel(link) {
  if (!link) return null;
  if (link.includes('linkedin.com'))  return 'View LinkedIn ↗';
  if (link.includes('github.com'))    return 'View on GitHub ↗';
  if (link.includes('upwork.com'))    return 'View Upwork Profile ↗';
  if (link.includes('.html'))         return 'View Dashboard ↗';
  if (link.includes('.app'))          return 'Open App ↗';
  return 'View Project ↗';
}

/** Stop all touch/mouse events from leaking through to the p5 canvas */
function stopPropagation(e) {
  e.stopPropagation();
}

export default function DetailModal({ detail, onClose }) {
  const handleBackdrop = useCallback(
    (e) => { if (e.target === e.currentTarget) onClose(); },
    [onClose],
  );

  if (!detail) return null;

  const hasLink = detail.link && detail.link !== 'null' && detail.link.trim() !== '';

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
      onClick={handleBackdrop}
      onTouchStart={stopPropagation}
      onTouchEnd={stopPropagation}
      onTouchMove={stopPropagation}
      onMouseDown={stopPropagation}
    >
      <div className={`modal-card ${heroMode === 'full' ? 'modal-card--full-hero' : ''}`}>
        {/* Close button above the hero image */}
        <div className="modal-close-bar">
          <button className="modal-close" onClick={onClose} aria-label="Close">
            {'✕'}
          </button>
        </div>

        {detail.imageSrc && (
          <div className={heroClass}>
            <img src={detail.imageSrc} alt={detail.name} />
            <div className="modal-hero-gradient" />
          </div>
        )}

        <div className="modal-content">
          <h2 className="modal-title modal-title--centered">{detail.name}</h2>

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
            >
              {ctaLabel(detail.link)}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
