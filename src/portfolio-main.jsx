import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AccessiblePortfolio from './AccessiblePortfolio.jsx';
import './styles/portfolio.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AccessiblePortfolio />
  </StrictMode>,
);
