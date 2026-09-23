import type { AttackSource } from 'shared';
import { t } from '../i18n';
import { attackSourceLabel } from '../lib/attackSourceText';

export interface AttackPreviewData {
  /** Экранные координаты (левый верх) области предпросмотра. */
  x: number;
  y: number;
  mode: 'a' | 'd' | null;
  advantage: AttackSource[];
  disadvantage: AttackSource[];
}

/** Тултип предпросмотра атаки: колонки «+»/«−» с источниками и итогом взаимогашения. */
export default function AttackPreview({ data }: { data: AttackPreviewData | null }) {
  if (!data) return null;
  const mode = data.mode === 'a' ? t('ui.attackSources.advantage')
    : data.mode === 'd' ? t('ui.attackSources.disadvantage')
    : t('ui.attackSources.mutual');
  return (
    <div className="atk-preview" style={{ left: data.x, top: data.y }} data-testid="attack-preview">
      <div className={`atk-preview-cols${data.advantage.length && data.disadvantage.length ? ' both' : ''}`}>
        <div className="atk-preview-col adv">
          <div className="atk-preview-head">+</div>
          {data.advantage.map((s, i) => (
            <div key={`a${i}`} className="atk-preview-item">
              {attackSourceLabel(s)}
            </div>
          ))}
        </div>
        <div className="atk-preview-col dis">
          <div className="atk-preview-head">−</div>
          {data.disadvantage.map((s, i) => (
            <div key={`d${i}`} className="atk-preview-item">
              {attackSourceLabel(s)}
            </div>
          ))}
        </div>
      </div>
      <div className={`atk-preview-mode ${data.mode ?? 'none'}`}>{mode}</div>
    </div>
  );
}
