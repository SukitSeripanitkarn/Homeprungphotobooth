import { FRAME_TEXT_MAX_LENGTH } from '../config';
import { useI18n } from '../i18n';

interface Props {
  value: string;
  onChange: (text: string) => void;
  /** False when the selected frame already has printed text in its band. */
  available: boolean;
}

export function FrameTextInput({ value, onChange, available }: Props) {
  const { t } = useI18n();
  return (
    <section className="frame-text">
      <label className="section-title" htmlFor="frame-text">
        {t.frameText}
      </label>
      <div className="frame-text__field">
        <input
          id="frame-text"
          type="text"
          value={value}
          maxLength={FRAME_TEXT_MAX_LENGTH}
          placeholder={t.frameTextPlaceholder}
          disabled={!available}
          enterKeyHint="done"
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        {available && value && (
          <button type="button" className="frame-text__clear" onClick={() => onChange('')} aria-label={t.frameTextClear}>
            ×
          </button>
        )}
      </div>
      <p className="frame-text__hint">{available ? t.frameTextHint : t.frameTextUnavailable}</p>
    </section>
  );
}
