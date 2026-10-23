import { BRAND } from '../brand';
import { useI18n } from '../i18n';

export function Header({ workshop }: { workshop: string | null }) {
  const { t, toggle } = useI18n();
  return (
    <header className="header">
      <img className="header__logo" src={BRAND.logo} alt={t.appName} width={180} height={48} />
      <div className="header__right">
        {workshop && (
          <span className="chip" title={t.workshop}>
            {t.workshop}: {workshop}
          </span>
        )}
        <button type="button" className="lang-toggle" onClick={toggle} aria-label="Language">
          {t.langToggle}
        </button>
      </div>
    </header>
  );
}
