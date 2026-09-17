import { useGameStore } from '../store/useGameStore';
import { t } from '../i18n';
import { activeMapOf } from '../store/selectors';
import { CheckboxRow } from './Field';
import Modal from './Modal';

/** Настройки обзора карты (DM): туман видимости и «Темнота». */
export default function VisionSettingsModal() {
  const close = useGameStore((s) => s.setVisionModalOpen);
  const updateVision = useGameStore((s) => s.updateVision);
  const map = useGameStore(activeMapOf);

  return (
    <Modal onClose={() => close(false)} title={t('ui.vision.title')}>
      <CheckboxRow
        checked={map?.vision.los ?? false}
        onChange={(los) => {
          if (map) updateVision(map.id, { los, darkness: map.vision.darkness });
        }}
      >
        {t('ui.vision.share')}
      </CheckboxRow>
      <CheckboxRow
        checked={map?.vision.darkness ?? false}
        onChange={(darkness) => {
          if (map) updateVision(map.id, { los: map.vision.los, darkness });
        }}
      >
        {t('ui.vision.darkness')}
      </CheckboxRow>
      <p className="field-hint">{t('ui.vision.hint')}</p>
      <div className="modal-actions">
        <button className="primary" onClick={() => close(false)}>
          {t('ui.common.done')}
        </button>
      </div>
    </Modal>
  );
}
