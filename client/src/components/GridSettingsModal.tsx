import { useEffect, useState } from 'react';
import type { GridSettings } from 'shared';
import { useGameStore } from '../store/useGameStore';
import { t } from '../i18n';
import { activeGridOf, activeMapOf } from '../store/selectors';
import { GRID_AUTO_CONFIDENCE } from '../lib/gridDetect';
import { detectGridFromUrl } from '../lib/gridDetectImage';
import { CheckboxRow, Field } from './Field';
import Modal from './Modal';

export default function GridSettingsModal() {
  const grid = useGameStore(activeGridOf);
  const updateGrid = useGameStore((s) => s.updateGrid);
  const close = useGameStore((s) => s.setGridModalOpen);
  const map = useGameStore(activeMapOf);
  const [draft, setDraft] = useState<GridSettings | null>(null);
  const [autoStatus, setAutoStatus] = useState<string | null>(null);

  useEffect(() => {
    setDraft({ ...grid });
  }, [grid]);

  const value = draft ?? grid;
  const setValue = (patch: Partial<GridSettings>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  };

  const round1 = (v: number) => Math.round(v * 10) / 10;

  const alignToImage = async () => {
    if (!map) return;
    setAutoStatus(t('ui.grid.searching'));
    try {
      const found = await detectGridFromUrl(map.url);
      if (!found) {
        setAutoStatus(t('ui.grid.notFound'));
        return;
      }
      setValue({ size: round1(found.size), offsetX: round1(found.offsetX), offsetY: round1(found.offsetY) });
      const low = found.confidence < GRID_AUTO_CONFIDENCE ? t('ui.grid.lowConfidence') : '';
      setAutoStatus(
        t('ui.grid.found', {
          size: Math.round(found.size),
          x: Math.round(found.offsetX),
          y: Math.round(found.offsetY),
          low,
        })
      );
    } catch {
      setAutoStatus(t('ui.grid.analyzeError'));
    }
  };

  return (
    <Modal onClose={() => close(false)} title={t('ui.grid.title')}>
      <Field label={t('ui.grid.cellSize')}>
        <input
          type="number"
          min={10}
          max={300}
          value={value.size}
          onChange={(e) => setValue({ size: Number(e.target.value) || 50 })}
        />
      </Field>
      <CheckboxRow checked={value.visible} onChange={(visible) => setValue({ visible })}>
        {t('ui.grid.visible')}
      </CheckboxRow>
      <CheckboxRow checked={value.snap} onChange={(snap) => setValue({ snap })}>
        {t('ui.grid.snap')}
      </CheckboxRow>
      <Field label={t('ui.grid.color')}>
        <input type="color" value={value.color} onChange={(e) => setValue({ color: e.target.value })} />
      </Field>
      <Field label={t('ui.grid.opacity', { n: Math.round(value.opacity * 100) })}>
        <input
          type="range"
          min={0.05}
          max={1}
          step={0.05}
          value={value.opacity}
          onChange={(e) => setValue({ opacity: Number(e.target.value) })}
        />
      </Field>
      <div className="field-row">
        <Field label={t('ui.grid.offsetX')}>
          <input type="number" value={value.offsetX} onChange={(e) => setValue({ offsetX: Number(e.target.value) || 0 })} />
        </Field>
        <Field label={t('ui.grid.offsetY')}>
          <input type="number" value={value.offsetY} onChange={(e) => setValue({ offsetY: Number(e.target.value) || 0 })} />
        </Field>
      </div>
      <div className="field-row">
        <button type="button" onClick={alignToImage} disabled={!map}>
          {t('ui.grid.align')}
        </button>
        {autoStatus && <span className="grid-auto-status">{autoStatus}</span>}
      </div>
      <div className="modal-actions">
        <button
          className="primary"
          onClick={() => {
            if (draft) updateGrid(draft);
            close(false);
          }}
        >
          {t('ui.common.done')}
        </button>
      </div>
    </Modal>
  );
}
