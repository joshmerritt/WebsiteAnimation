import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AnalyticsDashboardV2 from './analytics/AnalyticsDashboardV2.jsx';
import { initTelemetry } from './analytics/telemetry.js';
import './styles/analytics-v2.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AnalyticsDashboardV2 />
  </StrictMode>,
);

// Page views, errors and replay for this page too (it used to send nothing).
// Loaded on demand so it never delays the dashboard: see src/analytics/telemetry.js.
initTelemetry();
