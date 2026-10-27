import { useI18n } from '../i18n';
import type { FrameEntry } from '../lib/types';
import { NO_FRAME } from '../lib/useFrameState';

interface Props {
  frames: FrameEntry[] | null;
  error: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Offer a "no frame" choice first (admin batch stickers). */
  allowNone?: boolean;
}

export function FramePicker({ frames, error, selectedId, onSelect, allowNone }: Props) {
  const { t } = useI18n();
  return (
    <section className="frames" aria-label={t.chooseFrame}>
      <h2 className="section-title">{t.chooseFrame}</h2>
      {error && <p className="alert">{t.framesError}</p>}
      <div className="frames__list" role="radiogroup" aria-label={t.chooseFrame}>
        {allowNone && (
          <button
            type="button"
            role="radio"
            aria-checked={selectedId === NO_FRAME}
            className={`frames__item${selectedId === NO_FRAME ? ' is-selected' : ''}`}
            onClick={() => onSelect(NO_FRAME)}
          >
            <span className="frames__none" aria-hidden="true" />
            <span>{t.noFrame}</span>
          </button>
        )}
        {frames?.map((f) => (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={f.id === selectedId}
            className={`frames__item${f.id === selectedId ? ' is-selected' : ''}`}
            onClick={() => onSelect(f.id)}
          >
            <img src={f.thumbUrl} alt="" width={64} height={64} loading="lazy" decoding="async" />
            {f.textArea && (
              <span className="frames__badge" title={t.frameTextBadge} aria-label={t.frameTextBadge}>
                Aa
              </span>
            )}
            <span>{f.name}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
