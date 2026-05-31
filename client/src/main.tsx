import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerSW } from './service-worker-registration';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');

ReactDOM.createRoot(rootEl).render(
    <App />
  );

registerSW().catch((err) => {
  console.error('[SW] Registration failed:', err);
});
