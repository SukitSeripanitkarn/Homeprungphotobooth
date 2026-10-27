import { useI18n } from '../i18n';
import { BrandLogo } from './BrandLogo';
import { PrefsToggles } from './PrefsToggles';

export function Header({ workshop }: { workshop: string | null }) {
  const { t } = useI18n();
  return (
    <header className="header">
      <span className="header__brand" role="img" aria-label="HOMPRUNG by BAIHOR">
        <BrandLogo kind="mark" className="header__mark" />
        <BrandLogo kind="wordmark" className="header__wordmark" />
      </span>
      <div className="header__right">
        <PrefsToggles />
      </div>
      {/* Own row, so a long workshop name never crowds the logo on a phone. */}
      {workshop && (
        <span className="chip header__workshop" title={t.workshop}>
          {t.workshop}: {workshop}
        </span>
      )}
    </header>
  );
}
