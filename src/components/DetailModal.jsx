/**
 * DetailModal.jsx — Project detail modal
 *
 * Shown when a ball scores or is double-clicked. Displays project info
 * with hero image, metadata table, and CTA link.
 */

import { useCallback } from 'react';

function ctaLabel(link) {
  if (!link) return 'View Project \u2197';
  if (link.includes('linkedin.com'))  return 'View LinkedIn \u2197';
  if (link.includes('github.com'))    return 'View on GitHub \u2197';
  if (link.includes('upwork.com'))    return 'View Upwork Profile \u2197';
  if (link.includes('.html'))         return 'View Dashboard \u2197';
  return 'Open App \u2197';
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

  return (
    <div className="modal-overlay" onClick={handleBackdrop}>
      <div className="modal-card">
        <button className="modal-close" onClick={onClose} aria-label="Close">
          \u2715
        </button>

        {detail.imageSrc && (
          <div className="modal-hero">
            <img src={detail.imageSrc} alt={detail.name} />
            <div className="modal-hero-gradient" />
            <h2 className="modal-hero-title">{detail.name}</h2>
          </div>
        )}

        <div className="modal-content">
          {!detail.imageSrc && <h2 className="modal-title">{detail.name}</h2>}

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
