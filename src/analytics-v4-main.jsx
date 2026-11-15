import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import DashboardV4 from './analytics/v4/DashboardV4.jsx';
import './styles/analytics-v4.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DashboardV4 />
  </StrictMode>,
);
