import { useGameStore } from '../store/useGameStore';
import { activeMapOf } from '../store/selectors';
import { CheckboxRow } from './Field';
import Modal from './Modal';

/** Настройки обзора карты (DM): туман видимости и «Темнота». */
export default function VisionSettingsModal() {
  const close = useGameStore((s) => s.setVisionModalOpen);
  const updateVision = useGameStore((s) => s.updateVision);
  const map = useGameStore(activeMapOf);

  return (
    <Modal onClose={() => close(false)} title="Обзор">
      <CheckboxRow
        checked={map?.vision.los ?? false}
        onChange={(los) => {
          if (map) updateVision(map.id, { los, darkness: map.vision.darkness });
        }}
      >
        Объединять обзор игроков
      </CheckboxRow>
      <CheckboxRow
        checked={map?.vision.darkness ?? false}
        onChange={(darkness) => {
          if (map) updateVision(map.id, { los: map.vision.los, darkness });
        }}
      >
        Темнота
      </CheckboxRow>
      <p className="field-hint">
        Обзор игроков всегда ограничен стенами и закрытыми дверями; «Темнота» добавляет ограничение
        дальности по восприятию токена (без него — 1 клетка вокруг). «Объединять обзор игроков»:
        игрок видит области всех токенов с галкой «токен игрока», иначе — только своих.
      </p>
      <div className="modal-actions">
        <button className="primary" onClick={() => close(false)}>
          Готово
        </button>
      </div>
    </Modal>
  );
}
