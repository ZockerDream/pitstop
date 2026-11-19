import '@fontsource-variable/inter';
import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { setTodayOverride } from '../shared/dates';
import { App } from './App';

// Nur für Tests: ?heute=JJJJ-MM-TT legt „heute“ im Client fest.
const heute = new URLSearchParams(window.location.search).get('heute');
if (heute) setTodayOverride(heute);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
