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

// Лаборатория иконок оружия (20 вариантов great axe) — маршрут `?axe-lab`.
const axeLabLoaders = import.meta.glob('./lab/AxeLab.tsx');
const axeLabLoader = axeLabLoaders['./lab/AxeLab.tsx'];
const AxeLab = axeLabLoader ? lazy(axeLabLoader as () => Promise<{ default: React.ComponentType }>) : null;

// Лаборатория природных атак (Bite/Rend/Claw/Slam/Sting) — маршрут `?attack-lab`.
const attackLabLoaders = import.meta.glob('./lab/AttackLab.tsx');
const attackLabLoader = attackLabLoaders['./lab/AttackLab.tsx'];
const AttackLab = attackLabLoader ? lazy(attackLabLoader as () => Promise<{ default: React.ComponentType }>) : null;

// Раунд 2: абстрактная пасть (Bite) и изогнутое жало (Sting) — маршрут `?attack-lab2`.
const attackLab2Loaders = import.meta.glob('./lab/AttackLab2.tsx');
const attackLab2Loader = attackLab2Loaders['./lab/AttackLab2.tsx'];
const AttackLab2 = attackLab2Loader ? lazy(attackLab2Loader as () => Promise<{ default: React.ComponentType }>) : null;

// Раунд 3: открытая пасть с ровными зубами (Bite) — маршрут `?attack-lab3`.
const attackLab3Loaders = import.meta.glob('./lab/AttackLab3.tsx');
const attackLab3Loader = attackLab3Loaders['./lab/AttackLab3.tsx'];
const AttackLab3 = attackLab3Loader ? lazy(attackLab3Loader as () => Promise<{ default: React.ComponentType }>) : null;

// Клинковое оружие и безоружная атака — маршрут `?blade-lab`.
const bladeLabLoaders = import.meta.glob('./lab/BladeLab.tsx');
const bladeLabLoader = bladeLabLoaders['./lab/BladeLab.tsx'];
const BladeLab = bladeLabLoader ? lazy(bladeLabLoader as () => Promise<{ default: React.ComponentType }>) : null;

// Длинный меч: 10 разных силуэтов — маршрут `?sword-lab`.
const swordLabLoaders = import.meta.glob('./lab/LongswordLab.tsx');
const swordLabLoader = swordLabLoaders['./lab/LongswordLab.tsx'];
const SwordLab = swordLabLoader ? lazy(swordLabLoader as () => Promise<{ default: React.ComponentType }>) : null;

// Длинный меч (вариант 02): палитры — маршрут `?sword-colors`.
const swordColorsLoaders = import.meta.glob('./lab/LongswordColors.tsx');
const swordColorsLoader = swordColorsLoaders['./lab/LongswordColors.tsx'];
const SwordColors = swordColorsLoader ? lazy(swordColorsLoader as () => Promise<{ default: React.ComponentType }>) : null;

// Кинжал: 10 разных силуэтов — маршрут `?dagger-lab`.
const daggerLabLoaders = import.meta.glob('./lab/DaggerLab.tsx');
const daggerLabLoader = daggerLabLoaders['./lab/DaggerLab.tsx'];
const DaggerLab = daggerLabLoader ? lazy(daggerLabLoader as () => Promise<{ default: React.ComponentType }>) : null;

// Короткий меч: 10 разных силуэтов — маршрут `?shortsword-lab`.
const shortSwordLoaders = import.meta.glob('./lab/ShortswordLab.tsx');
const shortSwordLoader = shortSwordLoaders['./lab/ShortswordLab.tsx'];
const ShortSwordLab = shortSwordLoader ? lazy(shortSwordLoader as () => Promise<{ default: React.ComponentType }>) : null;

// Пачка клинкового: рапира, ятаган, двуручный — маршруты `?rapier-lab`, `?scimitar-lab`, `?greatsword-lab`.
const bladeBatchLoaders = import.meta.glob(['./lab/RapierLab.tsx', './lab/ScimitarLab.tsx', './lab/GreatswordLab.tsx']);
const lazyLab = (path: string) =>
  bladeBatchLoaders[path] ? lazy(bladeBatchLoaders[path] as () => Promise<{ default: React.ComponentType }>) : null;
const RapierLab = lazyLab('./lab/RapierLab.tsx');
const ScimitarLab = lazyLab('./lab/ScimitarLab.tsx');
const GreatswordLab = lazyLab('./lab/GreatswordLab.tsx');

// Клинок тени (Shadow Blade): 10 теневых силуэтов — маршрут `?shadow-lab`.
const shadowLabLoaders = import.meta.glob('./lab/ShadowBladeLab.tsx');
const shadowLabLoader = shadowLabLoaders['./lab/ShadowBladeLab.tsx'];
const ShadowBladeLab = shadowLabLoader ? lazy(shadowLabLoader as () => Promise<{ default: React.ComponentType }>) : null;

applyBranding();

const params = new URLSearchParams(window.location.search);
const isDiceLab = params.has('dice-lab');
const isFxLab = params.has('fx-lab');
const isAxeLab = params.has('axe-lab');
const isAttackLab = params.has('attack-lab');
const isAttackLab2 = params.has('attack-lab2');
const isAttackLab3 = params.has('attack-lab3');
const isBladeLab = params.has('blade-lab');
const isSwordLab = params.has('sword-lab');
const isSwordColors = params.has('sword-colors');
const isDaggerLab = params.has('dagger-lab');
const isShortSwordLab = params.has('shortsword-lab');
const isRapierLab = params.has('rapier-lab');
const isScimitarLab = params.has('scimitar-lab');
const isGreatswordLab = params.has('greatsword-lab');
const isShadowLab = params.has('shadow-lab');

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
        ) : isAxeLab && AxeLab ? (
          <Suspense fallback={null}>
            <AxeLab />
          </Suspense>
        ) : isAttackLab && AttackLab ? (
          <Suspense fallback={null}>
            <AttackLab />
          </Suspense>
        ) : isAttackLab2 && AttackLab2 ? (
          <Suspense fallback={null}>
            <AttackLab2 />
          </Suspense>
        ) : isAttackLab3 && AttackLab3 ? (
          <Suspense fallback={null}>
            <AttackLab3 />
          </Suspense>
        ) : isBladeLab && BladeLab ? (
          <Suspense fallback={null}>
            <BladeLab />
          </Suspense>
        ) : isSwordLab && SwordLab ? (
          <Suspense fallback={null}>
            <SwordLab />
          </Suspense>
        ) : isSwordColors && SwordColors ? (
          <Suspense fallback={null}>
            <SwordColors />
          </Suspense>
        ) : isDaggerLab && DaggerLab ? (
          <Suspense fallback={null}>
            <DaggerLab />
          </Suspense>
        ) : isShortSwordLab && ShortSwordLab ? (
          <Suspense fallback={null}>
            <ShortSwordLab />
          </Suspense>
        ) : isRapierLab && RapierLab ? (
          <Suspense fallback={null}>
            <RapierLab />
          </Suspense>
        ) : isScimitarLab && ScimitarLab ? (
          <Suspense fallback={null}>
            <ScimitarLab />
          </Suspense>
        ) : isGreatswordLab && GreatswordLab ? (
          <Suspense fallback={null}>
            <GreatswordLab />
          </Suspense>
        ) : isShadowLab && ShadowBladeLab ? (
          <Suspense fallback={null}>
            <ShadowBladeLab />
          </Suspense>
        ) : (
          <App />
        )}
      </ErrorBoundary>
    </React.StrictMode>
  );
});
