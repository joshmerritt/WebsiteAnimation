import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AnalyticsDashboardV2 from './analytics/AnalyticsDashboardV2.jsx';
import './styles/analytics-v2.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AnalyticsDashboardV2 />
  </StrictMode>,
);
