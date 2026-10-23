import { BRAND } from '../brand';
import { useI18n } from '../i18n';
import { PhotoInput } from './PhotoInput';

interface Props {
  onFile: (file: File) => void;
  busy: boolean;
  error: string | null;
}

export function Landing({ onFile, busy, error }: Props) {
  const { t } = useI18n();
  return (
    <main className="screen landing">
      <div className="landing__badge" aria-hidden="true">
        <img src={BRAND.leaf} alt="" width={72} height={72} />
        <span>3 cm</span>
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
