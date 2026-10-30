import { useRef, useState } from 'react';

/** "3.5" for 35 mm; "1.2" for 12 mm; "0.05" for 0.5 mm. */
export const formatCm = (mm: number) => String(Math.round(mm * 100) / 1000);

/**
 * Number input that shows and accepts centimetres while the app works in
 * millimetres. Keeps the typed text while editing (so "3." doesn't jump to
 * "3") and only reports values that are valid and in range.
 */
export function CmInput(props: {
  valueMm: number;
  minMm: number;
  maxMm: number;
  /** Arrow-key step, in cm. */
  stepCm?: number;
  onChangeMm: (mm: number) => void;
  className?: string;
  'aria-label'?: string;
}) {
  const { valueMm, minMm, maxMm, stepCm = 0.1, onChangeMm, className = 'text-input' } = props;
  const [text, setText] = useState(formatCm(valueMm));
  const last = useRef(valueMm);
  if (valueMm !== last.current) {
    last.current = valueMm;
    setText(formatCm(valueMm));
  }
  return (
    <input
      className={className}
      type="number"
      inputMode="decimal"
      min={minMm / 10}
      max={maxMm / 10}
      step={stepCm}
      value={text}
      aria-label={props['aria-label']}
      onChange={(e) => {
        setText(e.target.value);
        // Round to 0.01 mm to avoid floating-point noise (3.5 cm → 35 mm, not 35.000000001).
        const mm = Math.round(Number(e.target.value) * 1000) / 100;
        if (e.target.value !== '' && Number.isFinite(mm) && mm >= minMm && mm <= maxMm) {
          last.current = mm;
          onChangeMm(mm);
        }
      }}
    />
  );
}
