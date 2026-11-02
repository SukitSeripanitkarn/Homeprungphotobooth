import type { WorkshopType } from '../../api/_lib/classSession';
import { formatCm } from '../config';
import { useAdminText } from './adminI18n';

/**
 * Batch sticker size: one of the workshop types' sizes. A size saved before
 * sizes were fixed is still listed so it isn't silently changed.
 */
export function SizeSelect({
  valueMm,
  types,
  onChange,
}: {
  valueMm: number;
  types: readonly WorkshopType[];
  onChange: (mm: number) => void;
}) {
  const a = useAdminText();
  const sizes = types.map((t) => ({ mm: t.diameterMm, label: `${formatCm(t.diameterMm)} ${a.cm} · ${t[a.lang]}` }));
  // Two types can share a size; list it once.
  const unique = sizes.filter((s, i) => sizes.findIndex((o) => o.mm === s.mm) === i);
  if (!unique.some((s) => s.mm === valueMm)) unique.push({ mm: valueMm, label: `${formatCm(valueMm)} ${a.cm}` });
  return (
    <select className="text-input text-input--select" value={valueMm} onChange={(e) => onChange(Number(e.target.value))}>
      {unique.map((s) => (
        <option key={s.mm} value={s.mm}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
