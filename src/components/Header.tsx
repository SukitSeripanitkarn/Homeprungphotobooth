import { BRAND } from '../brand';
import { useI18n } from '../i18n';

export function Header({ workshop }: { workshop: string | null }) {
  const { t, toggle } = useI18n();
  return (
    <header className="header">
      <span className="header__brand" role="img" aria-label="HOMPRUNG by BAIHOR">
        <img className="header__mark" src={BRAND.mark} alt="" width={444} height={785} />
        <img className="header__wordmark" src={BRAND.wordmark} alt="" width={480} height={106} />
      </span>
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
