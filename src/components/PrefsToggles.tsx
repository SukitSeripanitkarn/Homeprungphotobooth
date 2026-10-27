import { useI18n } from '../i18n';

/** Light/dark and TH/EN switches, shown in the student and admin headers. */
export function PrefsToggles() {
  const { t, toggle, theme, toggleTheme } = useI18n();
  return (
    <>
      <button
        type="button"
        className="lang-toggle"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? t.toLight : t.toDark}
        title={theme === 'dark' ? t.toLight : t.toDark}
      >
        {theme === 'dark' ? '☀' : '☾'}
      </button>
      <button type="button" className="lang-toggle" onClick={toggle} aria-label={t.langToggleLabel} title={t.langToggleLabel}>
        {t.langToggle}
      </button>
    </>
  );
}
