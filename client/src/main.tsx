import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { useGameStore } from './store/useGameStore';
import { applyBranding } from './lib/branding';
import './styles.css';

applyBranding();

// В dev при полной перезагрузке модулей снимаем сокет и его слушатели (HMR-утечка).
if (import.meta.hot) import.meta.hot.dispose(() => useGameStore.getState().disposeSocket());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
