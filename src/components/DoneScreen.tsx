import type { ReactNode } from 'react';
import { BRAND } from '../brand';
import { useI18n } from '../i18n';

interface Props {
  previewUrl: string | null;
  actions: ReactNode;
  onBack: () => void;
  onStartOver: () => void;
  countdown: ReactNode;
}

export function DoneScreen({ previewUrl, actions, onBack, onStartOver, countdown }: Props) {
  const { t } = useI18n();
  return (
    <main className="screen done">
      {countdown}
      <img className="done__leaf" src={BRAND.leaf} alt="" width={48} height={48} aria-hidden="true" />
      <h1 className="screen__title">{t.doneTitle}</h1>
      <p className="muted">{t.doneText}</p>
      {previewUrl && <img className="done__preview" src={previewUrl} alt="" width={220} height={220} />}
      {actions}
      <div className="btn-row">
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          ← {t.backToEdit}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onStartOver}>
          {t.startOver}
        </button>
      </div>
    </main>
  );
}
