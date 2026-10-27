import type { ReactNode } from 'react';
import { useI18n } from '../i18n';

interface Props {
  previewUrl: string | null;
  name: string;
  countdown: ReactNode;
  onEdit: () => void;
  onNextPerson: () => void;
  onDownload: () => void;
}

export function SentScreen({ previewUrl, name, countdown, onEdit, onNextPerson, onDownload }: Props) {
  const { t } = useI18n();
  return (
    <main className="screen done">
      {countdown}
      <h1 className="screen__title">✓ {t.sentTitle}</h1>
      <p className="muted">{t.sentText}</p>
      {previewUrl && <img className="done__preview" src={previewUrl} alt="" width={220} height={220} />}
      {name && <p className="done__name">{name}</p>}
      <div className="btn-row">
        <button type="button" className="btn btn--ghost" onClick={onEdit}>
          ✎ {t.editAndResend}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onNextPerson}>
          + {t.nextPerson}
        </button>
      </div>
      <button type="button" className="btn btn--link" onClick={onDownload}>
        ⬇ {t.download}
      </button>
    </main>
  );
}
