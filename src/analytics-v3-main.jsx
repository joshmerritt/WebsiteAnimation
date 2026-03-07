import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AnalyticsDashboardV3 from './analytics/AnalyticsDashboardV3.jsx';

// V3 uses inline styles — no CSS import needed.
// Import base resets only (shared across all dashboard versions).
import './styles/analytics-v2.css';
import './styles/ShotChart.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AnalyticsDashboardV3 />
  </StrictMode>,
);
