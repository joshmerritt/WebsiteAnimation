/*
  App.jsx — React UI Overlay
  ──────────────────────────
  Manages all HTML UI that sits on top of the p5.js canvas:
    • Project detail modal (hero image, info table, CTA link)
    • Reset button
    • Contact button

  Bridge API (called by p5.js sketch):
    window.ui.openDetail(data)  — opens the modal
    window.ui.closeDetail()     — closes modal + triggers sketch reset
*/

const { useState, useEffect, useCallback } = React;

function ctaLabel(link) {
  if (!link) return 'View Project ↗';
  if (link.includes('linkedin.com'))  return 'View LinkedIn ↗';
  if (link.includes('github.com'))    return 'View on GitHub ↗';
  if (link.includes('upwork.com'))    return 'View Upwork Profile ↗';
  if (link.includes('.html'))         return 'View Dashboard ↗';
  return 'Open App ↗';
}

function DetailModal({ detail, onClose }) {
  if (!detail) return null;

  const hasLink = detail.link && detail.link !== 'null' && detail.link.trim() !== '';

  const rows = [
    { label: 'Goal',       value: detail.goal },
    { label: 'My Role',    value: detail.role },
    { label: 'Technology', value: detail.technology },
    { label: 'Summary',    value: detail.description },
  ].filter(r => r.value);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">

        <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>

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
            <a className="modal-cta" href={detail.link} target="_blank" rel="noopener noreferrer">
              {ctaLabel(detail.link)}
            </a>
          )}
        </div>

      </div>
    </div>
  );
}

function App() {
  const [detail, setDetail] = useState(null);

  const handleClose = useCallback(() => {
    setDetail(null);
    window.detailPageOpen = false;
    window.onDetailClosed?.();
  }, []);

  useEffect(() => {
    window.ui = {
      openDetail: (data) => {
        setDetail(data);
        window.detailPageOpen = true;
      },
      closeDetail: () => {
        setDetail(null);
        window.detailPageOpen = false;
        window.onDetailClosed?.();
      },
    };
    return () => { window.ui = null; };
  }, [handleClose]);

  return (
    <>
      <DetailModal detail={detail} onClose={handleClose} />
      {!detail && (
        <>
          <a
            className="contact-btn"
            href="mailto:josh@DaDataDad.com"
            target="_blank"
            rel="noopener noreferrer"
          >✉ Contact Me</a>
          <button className="reset" onClick={() => window.onReset?.()}>↺ Reset</button>
        </>
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('react-root')).render(<App />);
