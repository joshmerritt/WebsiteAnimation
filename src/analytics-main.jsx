import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AnalyticsDashboard from './analytics/AnalyticsDashboard.jsx';
import { initTelemetry } from './analytics/telemetry.js';
import './styles/analytics.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AnalyticsDashboard />
  </StrictMode>,
);

// Page views, errors and replay for this page too (it used to send nothing).
// Loaded on demand so it never delays the dashboard: see src/analytics/telemetry.js.
initTelemetry();
