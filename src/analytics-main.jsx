import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AnalyticsDashboard from './analytics/AnalyticsDashboard.jsx';
import './styles/analytics.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AnalyticsDashboard />
  </StrictMode>,
);
