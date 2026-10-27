import { MAX_NAME_LENGTH } from '../../api/_lib/classSession';
import { useI18n } from '../i18n';

interface Props {
  name: string;
  onName: (name: string) => void;
  onSend: () => void;
  onDownload: () => void;
  /** True once this phone has sent a photo in this class (sending again replaces it). */
  sent: boolean;
  sending: boolean;
  error: string | null;
  disabled?: boolean;
}

export function SendPanel({ name, onName, onSend, onDownload, sent, sending, error, disabled }: Props) {
  const { t } = useI18n();
  return (
    <section className="send-panel">
      <label className="section-title" htmlFor="your-name">
        {t.yourName}
      </label>
      <input
        id="your-name"
        className="text-input"
        type="text"
        value={name}
        maxLength={MAX_NAME_LENGTH}
        placeholder={t.yourNamePlaceholder}
        autoComplete="given-name"
        enterKeyHint="done"
        onChange={(e) => onName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      <p className="field-hint">{t.yourNameHint}</p>
      <button type="button" className="btn btn--primary btn--xl" onClick={onSend} disabled={disabled || sending}>
        {sending ? t.sending : sent ? t.resend : t.send}
      </button>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      <button type="button" className="btn btn--link" onClick={onDownload} disabled={disabled}>
        ⬇ {t.download}
      </button>
    </section>
  );
}
