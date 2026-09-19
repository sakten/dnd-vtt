import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { loadNames } from 'shared';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { getLocale } from './i18n';
import { useGameStore } from './store/useGameStore';
import { applyBranding } from './lib/branding';
import './styles.css';

// Лаборатория бросков — локальный инструмент, в git не попадает (client/src/lab в .gitignore).
// glob не падает, если папки нет: в чистом клоне `?dice-lab` просто открывает обычный экран.
const labLoaders = import.meta.glob('./lab/DiceLab.tsx');
const labLoader = labLoaders['./lab/DiceLab.tsx'];
const DiceLab = labLoader ? lazy(labLoader as () => Promise<{ default: React.ComponentType }>) : null;

// Лаборатория эффектов (Burning Hands) — тот же принцип, маршрут `?fx-lab`.
const fxLabLoaders = import.meta.glob('./lab/FxLab.tsx');
const fxLabLoader = fxLabLoaders['./lab/FxLab.tsx'];
const FxLab = fxLabLoader ? lazy(fxLabLoader as () => Promise<{ default: React.ComponentType }>) : null;

applyBranding();

const params = new URLSearchParams(window.location.search);
const isDiceLab = params.has('dice-lab');
const isFxLab = params.has('fx-lab');

// В dev при полной перезагрузке модулей снимаем сокет и его слушатели (HMR-утечка).
if (import.meta.hot) import.meta.hot.dispose(() => useGameStore.getState().disposeSocket());

// Имена текущего языка — до первого рендера; отсутствующий оверлей не блокирует старт.
void loadNames(getLocale()).finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        {isDiceLab && DiceLab ? (
          <Suspense fallback={null}>
            <DiceLab />
          </Suspense>
        ) : isFxLab && FxLab ? (
          <Suspense fallback={null}>
            <FxLab />
          </Suspense>
        ) : (
          <App />
        )}
      </ErrorBoundary>
    </React.StrictMode>
  );
});
