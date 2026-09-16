import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { activeMapOf } from '../store/selectors';
import { detectWallsInAnalysis, loadWallAnalysis, type WallAnalysis } from '../lib/wallDetectImage';

export default function WallsPanel() {
  const mode = useGameStore((s) => s.wallsMode);
  const setWallsMode = useGameStore((s) => s.setWallsMode);
  const updateWalls = useGameStore((s) => s.updateWalls);
  const candidates = useGameStore((s) => s.wallCandidates);
  const setWallCandidates = useGameStore((s) => s.setWallCandidates);
  const grid = useGameStore((s) => s.scene.grid);
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
    setStatus('Анализируем изображение…');
    try {
      if (!analysisRef.current) analysisRef.current = await loadWallAnalysis(mapUrl);
      const analysis = analysisRef.current;
      if (!analysis) {
        setStatus('Не удалось загрузить изображение карты');
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
      setStatus(`Найдено: стен ${solid}, дверей ${doorCount}`);
    } catch {
      setStatus('Не удалось проанализировать изображение');
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
    setStatus(`Добавлено сегментов: ${add.length}`);
  };

  return (
    <div className="fog-panel">
      <div className="fog-group">
        <button className={mode.tool === 'wall' ? 'active' : ''} onClick={() => setWallsMode({ tool: 'wall' })}>
          Стена
        </button>
        <button className={mode.tool === 'door' ? 'active' : ''} onClick={() => setWallsMode({ tool: 'door' })}>
          Дверь
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
          Найти стены
        </button>
        {candidates && <button onClick={apply}>Применить</button>}
        {candidates && <button onClick={() => setWallCandidates(null)}>Отмена</button>}
      </div>
      {auto && (
        <div className="fog-group">
          <span className="fog-label">Контраст: {contrast}</span>
          <input
            type="range"
            min={25}
            max={120}
            step={5}
            value={contrast}
            onChange={(e) => setContrast(Number(e.target.value))}
          />
          <label className="fog-label">
            <input type="checkbox" checked={furniture} onChange={(e) => setFurniture(e.target.checked)} /> Фильтр мебели
          </label>
          <label className="fog-label" title="Выключено — проёмы в стенах остаются проходами, сегменты-двери не создаются">
            <input type="checkbox" checked={doors} onChange={(e) => setDoors(e.target.checked)} /> Двери
          </label>
        </div>
      )}
      {status && <span className="fog-label">{status}</span>}
      <span className="fog-label">Клик по узлам — сегменты; клик по двери — открыть/закрыть; ПКМ — удалить.</span>
      <button
        title="Убрать все стены на карте"
        onClick={() => {
          if (map) updateWalls(map.id, []);
        }}
      >
        Очистить
      </button>
      <button onClick={() => setWallsMode({ active: false })}>Готово</button>
    </div>
  );
}
