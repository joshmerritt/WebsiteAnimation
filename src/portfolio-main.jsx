import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AccessiblePortfolio from './AccessiblePortfolio.jsx';
import { initPostHog } from './game/posthog.js';
import './styles/portfolio.css';

// Pageviews + autocapture + session replay on the accessible portfolio page.
// (No game EventBus here, so just the base SDK init — no-ops without a key.)
initPostHog();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AccessiblePortfolio />
  </StrictMode>,
);
