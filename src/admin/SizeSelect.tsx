import { WORKSHOP_TYPES } from '../../api/_lib/classSession';
import { formatCm } from '../config';
import { useAdminText } from './adminI18n';

/**
 * Batch sticker size: one of the three workshop sizes. A size saved before
 * sizes were fixed is still listed so it isn't silently changed.
 */
export function SizeSelect({ valueMm, onChange }: { valueMm: number; onChange: (mm: number) => void }) {
  const a = useAdminText();
  const sizes = WORKSHOP_TYPES.map((t) => ({ mm: t.diameterMm as number, label: `${formatCm(t.diameterMm)} ${a.cm} · ${t[a.lang]}` }));
  if (!sizes.some((s) => s.mm === valueMm)) sizes.push({ mm: valueMm, label: `${formatCm(valueMm)} ${a.cm}` });
  return (
    <select className="text-input text-input--select" value={valueMm} onChange={(e) => onChange(Number(e.target.value))}>
      {sizes.map((s) => (
        <option key={s.mm} value={s.mm}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
