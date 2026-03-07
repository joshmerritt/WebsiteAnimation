import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AnalyticsDashboardV3 from './dashboard-v3.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AnalyticsDashboardV3 />
  </StrictMode>,
);
