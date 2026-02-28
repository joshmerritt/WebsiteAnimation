/*
  App.jsx — React UI Overlay
  ──────────────────────────
  Manages all HTML-based UI elements that sit on top of the p5.js canvas:
    • Project detail panel (opened when a ball scores a goal)
    • Reset button
    • Contact link

  Communication with p5.js sketch via the window.ui bridge object:
    window.ui.openDetail(data)  — called by imageBall when a goal is scored or double-clicked
    window.ui.closeDetail()     — called programmatically if needed
*/

const { useState, useEffect, useCallback, useRef } = React;

function DetailPage({ detail, onClose }) {
  const panelRef = useRef(null);

  // Animate in
  useEffect(() => {
    if (panelRef.current) {
      panelRef.current.style.opacity = '0';
      panelRef.current.style.transform = 'translateX(30px)';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (panelRef.current) {
            panelRef.current.style.opacity = '1';
            panelRef.current.style.transform = 'translateX(0)';
          }
        });
      });
    }
  }, [detail]);

  if (!detail) return null;

  return (
    <div className="DetailPage" ref={panelRef}>
      <button className="ExitButton" onClick={onClose} aria-label="Close">✕</button>
      <h1>{detail.name}</h1>

      {detail.imageSrc && (
        <div className="DetailImage">
          <img src={detail.imageSrc} alt={detail.name} />
        </div>
      )}

      <table>
        <tbody>
          {detail.goal && (
            <tr>
              <td>Goal</td>
              <td>{detail.goal}</td>
            </tr>
          )}
          {detail.role && (
            <tr>
              <td>My Role</td>
              <td>{detail.role}</td>
            </tr>
          )}
          {detail.technology && (
            <tr>
              <td>Technology</td>
              <td>{detail.technology}</td>
            </tr>
          )}
          {detail.description && (
            <tr>
              <td>Summary</td>
              <td>{detail.description}</td>
            </tr>
          )}
        </tbody>
      </table>

      {detail.link && detail.link !== 'null' && detail.link !== '' && (
        <a href={detail.link} target="_blank" rel="noopener noreferrer">
          Learn more ↗
        </a>
      )}
    </div>
  );
}

function App() {
  const [detail, setDetail] = useState(null);

  // Wire up the bridge that p5.js sketch calls into
  useEffect(() => {
    window.ui = {
      openDetail: (data) => {
        setDetail(data);
        // Let sketch know detail is open (it reads window.detailPageOpen)
        window.detailPageOpen = true;
      },
      closeDetail: () => {
        setDetail(null);
        window.detailPageOpen = false;
      },
    };

    // Clean up on unmount
    return () => { window.ui = null; };
  }, []);

  const handleClose = useCallback(() => {
    setDetail(null);
    window.detailPageOpen = false;
    // Tell sketch to reset balls and show reset button again
    window.onDetailClosed?.();
  }, []);

  const handleReset = useCallback(() => {
    window.onReset?.();
  }, []);

  return (
    <>
      <DetailPage detail={detail} onClose={handleClose} />

      {/* Reset button — hidden while detail page is open */}
      {!detail && (
        <button className="reset" onClick={handleReset}>
          ↺ Reset
        </button>
      )}
    </>
  );
}

// Mount React app
const root = ReactDOM.createRoot(document.getElementById('react-root'));
root.render(<App />);
