import { useI18n } from '../i18n';
import type { LoadedFrame } from '../lib/types';

interface Props {
  frames: LoadedFrame[] | null;
  error: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function FramePicker({ frames, error, selectedId, onSelect }: Props) {
  const { t } = useI18n();
  return (
    <section className="frames" aria-label={t.chooseFrame}>
      <h2 className="section-title">{t.chooseFrame}</h2>
      {error && <p className="alert">{t.framesError}</p>}
      <div className="frames__list" role="radiogroup" aria-label={t.chooseFrame}>
        {frames?.map((f) => (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={f.id === selectedId}
            className={`frames__item${f.id === selectedId ? ' is-selected' : ''}`}
            onClick={() => onSelect(f.id)}
          >
            <img src={f.url} alt="" width={64} height={64} loading="lazy" />
            <span>{f.name}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
