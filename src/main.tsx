// Consolidate runtime shims
if (typeof window !== 'undefined' && !(window as any).global) {
  // The primary shim is in index.html, but we keep a fallback here
  (window as any).global = window;
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
