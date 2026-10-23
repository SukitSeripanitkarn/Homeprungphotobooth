import { SHEET_MAX } from '../config';
import { useI18n } from '../i18n';

interface Props {
  onDownload: () => void;
  onPrint: () => void;
  onPrintSheet: () => void;
  sheetCount: number;
  onSheetCount: (n: number) => void;
  disabled?: boolean;
}

export function PrintActions({ onDownload, onPrint, onPrintSheet, sheetCount, onSheetCount, disabled }: Props) {
  const { t } = useI18n();
  return (
    <section className="print-actions">
      <div className="btn-row">
        <button type="button" className="btn btn--primary" onClick={onDownload} disabled={disabled}>
          ⬇ {t.download}
        </button>
        <button type="button" className="btn btn--accent" onClick={onPrint} disabled={disabled}>
          🖨 {t.print}
        </button>
      </div>
      <div className="sheet-row">
        <button type="button" className="btn btn--ghost" onClick={onPrintSheet} disabled={disabled}>
          {t.stickerSheet}
        </button>
        <label className="sheet-row__count">
          <span>{t.stickerCount}</span>
          <select value={sheetCount} onChange={(e) => onSheetCount(Number(e.target.value))}>
            {Array.from({ length: SHEET_MAX }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="print-tip">
        <strong>{t.printTip}</strong>
        <br />
        <small>{t.printTipLong}</small>
      </p>
    </section>
  );
}
