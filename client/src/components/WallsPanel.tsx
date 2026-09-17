import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { t } from '../i18n';
import { activeGridOf, activeMapOf } from '../store/selectors';
import { detectWallsInAnalysis, loadWallAnalysis, type WallAnalysis } from '../lib/wallDetectImage';

export default function WallsPanel() {
  const mode = useGameStore((s) => s.wallsMode);
  const setWallsMode = useGameStore((s) => s.setWallsMode);
  const updateWalls = useGameStore((s) => s.updateWalls);
  const candidates = useGameStore((s) => s.wallCandidates);
  const setWallCandidates = useGameStore((s) => s.setWallCandidates);
  const grid = useGameStore(activeGridOf);
  const map = useGameStore(activeMapOf);

  const [contrast, setContrast] = useState(55);
  const [furniture, setFurniture] = useState(true);
  const [doors, setDoors] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [auto, setAuto] = useState(false);
  const analysisRef = useRef<WallAnalysis | null>(null);

  // Смена карты — сбрасываем кэш анализа и превью.
  useEffect(() => {
    analysisRef.current = null;
    setAuto(false);
    setStatus(null);
    setWallCandidates(null);
  }, [map?.id, setWallCandidates]);

  const runDetect = useCallback(async () => {
    const mapId = map?.id;
    const mapUrl = map?.url;
    if (!mapId || !mapUrl) return;
    setBusy(true);
    setStatus(t('ui.walls.analyzing'));
    try {
      if (!analysisRef.current) analysisRef.current = await loadWallAnalysis(mapUrl);
      const analysis = analysisRef.current;
      if (!analysis) {
        setStatus(t('ui.walls.loadError'));
        return;
      }
      const walls = detectWallsInAnalysis(analysis, {
        size: grid.size,
        offsetX: grid.offsetX,
        offsetY: grid.offsetY,
        contrast,
        furnitureFilter: furniture,
        doors,
      });
      setWallCandidates(walls);
      const solid = walls.filter((w) => w.kind === 'wall').length;
      const doorCount = walls.filter((w) => w.kind === 'door').length;
      setStatus(t('ui.walls.found', { walls: solid, doors: doorCount }));
    } catch {
      setStatus(t('ui.walls.analyzeError'));
    } finally {
      setBusy(false);
    }
  }, [map?.id, map?.url, grid.size, grid.offsetX, grid.offsetY, contrast, furniture, doors, setWallCandidates]);

  // После первого запуска пересчитываем при изменении настроек (с задержкой).
  useEffect(() => {
    if (!auto) return;
    const timer = window.setTimeout(() => void runDetect(), 200);
    return () => window.clearTimeout(timer);
  }, [auto, contrast, furniture, doors, runDetect]);

  const apply = () => {
    if (!map || !candidates) return;
    const key = (w: (typeof candidates)[number]) =>
      `${w.kind}:${Math.round(w.x1)},${Math.round(w.y1)},${Math.round(w.x2)},${Math.round(w.y2)}`;
    const exists = new Set(map.walls.map(key));
    const add = candidates.filter((w) => !exists.has(key(w)));
    if (add.length) updateWalls(map.id, [...map.walls, ...add].slice(0, 2000));
    setWallCandidates(null);
    setStatus(t('ui.walls.added', { n: add.length }));
  };

  return (
    <div className="fog-panel" data-testid="walls-panel">
      <div className="fog-group">
        <button className={mode.tool === 'wall' ? 'active' : ''} onClick={() => setWallsMode({ tool: 'wall' })}>
          {t('ui.walls.wall')}
        </button>
        <button className={mode.tool === 'door' ? 'active' : ''} onClick={() => setWallsMode({ tool: 'door' })}>
          {t('ui.walls.door')}
        </button>
      </div>
      <div className="fog-group">
        <button
          disabled={busy || !map}
          onClick={() => {
            setAuto(true);
            void runDetect();
          }}
        >
          {t('ui.walls.detect')}
        </button>
        {candidates && <button onClick={apply}>{t('ui.common.apply')}</button>}
        {candidates && <button onClick={() => setWallCandidates(null)}>{t('ui.common.cancel')}</button>}
      </div>
      {auto && (
        <div className="fog-group">
          <span className="fog-label">{t('ui.walls.contrast', { n: contrast })}</span>
          <input
            type="range"
            min={25}
            max={120}
            step={5}
            value={contrast}
            onChange={(e) => setContrast(Number(e.target.value))}
          />
          <label className="fog-label">
            <input type="checkbox" checked={furniture} onChange={(e) => setFurniture(e.target.checked)} />{' '}
            {t('ui.walls.furniture')}
          </label>
          <label className="fog-label" title={t('ui.walls.doorsTitle')}>
            <input type="checkbox" checked={doors} onChange={(e) => setDoors(e.target.checked)} />{' '}
            {t('ui.walls.doors')}
          </label>
        </div>
      )}
      {status && <span className="fog-label">{status}</span>}
      <span className="fog-label">{t('ui.walls.hint')}</span>
      <button
        title={t('ui.walls.clearTitle')}
        onClick={() => {
          if (map) updateWalls(map.id, []);
        }}
      >
        {t('ui.common.clear')}
      </button>
      <button onClick={() => setWallsMode({ active: false })}>{t('ui.common.done')}</button>
    </div>
  );
}
