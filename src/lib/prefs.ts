import { useCallback, useEffect, useState } from 'react';
import type { Lang } from '../i18n';

/**
 * Per-viewer display preferences (language and light/dark theme), shared by
 * the student app and the admin page. Stored in localStorage; the theme is
 * applied to <html data-theme> before first paint by a script in index.html.
 */

export type Theme = 'light' | 'dark';

const LANG_KEY = 'homprung-photobooth:lang';
export const THEME_KEY = 'homprung-photobooth:theme';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore (private mode) */
  }
}

export function usePrefs() {
  const [lang, setLang] = useState<Lang>(() => (read(LANG_KEY) === 'en' ? 'en' : 'th'));
  // Light by default on every device; dark only when the viewer picks it.
  const [theme, setTheme] = useState<Theme>(() => (read(THEME_KEY) === 'dark' ? 'dark' : 'light'));

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#1d140e' : '#593015');
  }, [theme]);

  const toggleLang = useCallback(() => {
    setLang((l) => {
      const next = l === 'th' ? 'en' : 'th';
      write(LANG_KEY, next);
      return next;
    });
  }, []);

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    write(THEME_KEY, next);
    setTheme(next);
  }, [theme]);

  return { lang, toggleLang, theme, toggleTheme };
}
