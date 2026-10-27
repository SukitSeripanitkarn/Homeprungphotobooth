import { useI18n } from '../i18n';
import { minutesLeft } from '../lib/session';

export function Countdown({ expiresAt, now }: { expiresAt: number; now: number }) {
  const { t } = useI18n();
  const m = minutesLeft(expiresAt, now);
  return (
    <p className={`countdown${m <= 5 ? ' countdown--low' : ''}`} role="status">
      ⏱ {t.timeLeft(m)}
    </p>
  );
}
