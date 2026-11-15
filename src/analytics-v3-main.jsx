import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AnalyticsDashboardV3 from './analytics/AnalyticsDashboardV3.jsx';
import { initTelemetry } from './analytics/telemetry.js';

// V3 uses inline styles — no CSS import needed.
// Import base resets only (shared across all dashboard versions).
import './styles/analytics-v2.css';
import './styles/ShotChart.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AnalyticsDashboardV3 />
  </StrictMode>,
);

// Page views, errors and replay for this page too (it used to send nothing).
// Loaded on demand so it never delays the dashboard: see src/analytics/telemetry.js.
initTelemetry();
