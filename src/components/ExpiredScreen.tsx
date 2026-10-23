import { BRAND } from '../brand';
import { useI18n } from '../i18n';

export function ExpiredScreen({ onStartOver }: { onStartOver: () => void }) {
  const { t } = useI18n();
  return (
    <main className="screen expired">
      <img src={BRAND.leaf} alt="" width={64} height={64} aria-hidden="true" />
      <h1 className="screen__title">{t.expiredTitle}</h1>
      <p className="muted">{t.expiredText}</p>
      <button type="button" className="btn btn--primary btn--xl" onClick={onStartOver}>
        {t.startOver}
      </button>
    </main>
  );
}
