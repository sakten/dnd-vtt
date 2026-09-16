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
          if (map) updateVision(map.id, { los, darkness: los ? map.vision.darkness : false });
        }}
      >
        Туман видимости (обзор от токенов игроков)
      </CheckboxRow>
      {map?.vision.los && (
        <CheckboxRow
          checked={map.vision.darkness}
          onChange={(darkness) => {
            if (map) updateVision(map.id, { los: true, darkness });
          }}
        >
          Темнота на карте (дальность — по восприятию токенов)
        </CheckboxRow>
      )}
      <p className="field-hint">
        Клик по токену не требуется: игроки видят объединение обзора всех токенов с галкой «токен игрока».
        Стены и закрытые двери блокируют обзор.
      </p>
      <div className="modal-actions">
        <button className="primary" onClick={() => close(false)}>
          Готово
        </button>
      </div>
    </Modal>
  );
}
