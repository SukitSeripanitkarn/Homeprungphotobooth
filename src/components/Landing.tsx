import type { ReactNode } from 'react';
import { PRINT_DIAMETER_CM } from '../config';
import { useI18n } from '../i18n';
import { PhotoInput } from './PhotoInput';

interface Props {
  onFile: (file: File) => void;
  busy: boolean;
  error: string | null;
  /** A frame image to preview the result on the landing page. */
  heroUrl: string | null;
  countdown?: ReactNode;
}

export function Landing({ onFile, busy, error, heroUrl, countdown }: Props) {
  const { t } = useI18n();
  return (
    <main className="screen landing">
      {countdown}
      <div className="landing__hero" aria-hidden="true">
        {heroUrl && <img src={heroUrl} alt="" width={200} height={200} fetchPriority="high" />}
        <span>{PRINT_DIAMETER_CM} cm</span>
      </div>
      <h1 className="landing__title">{t.appName}</h1>
      <p className="landing__tagline">{t.tagline}</p>

      <PhotoInput className="btn btn--primary btn--xl" onFile={onFile} disabled={busy}>
        {busy ? t.loadingPhoto : t.choosePhoto}
      </PhotoInput>
      <PhotoInput className="btn btn--ghost" onFile={onFile} capture disabled={busy}>
        {t.openCamera}
      </PhotoInput>

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      <p className="privacy">🔒 {t.privacyNote}</p>
    </main>
  );
}
