import { useState } from 'react';
import { Editor } from '../components/Editor';
import { FramePicker } from '../components/FramePicker';
import { FrameTextInput } from '../components/FrameTextInput';
import { PhotoInput } from '../components/PhotoInput';
import { EXPORT_DPI, PRINT_DIAMETER_MM } from '../config';
import { preparePhoto } from '../lib/exif';
import { renderExportCanvas } from '../lib/exportPng';
import { DEFAULT_EDIT, type EditState, type FrameEntry, type Photo } from '../lib/types';
import { NO_FRAME, useFrameState } from '../lib/useFrameState';
import type { ExtraSticker } from './adminStore';
import { useAdminText } from './adminI18n';

interface Props {
  frames: FrameEntry[] | null;
  onAdd: (sticker: Omit<ExtraSticker, 'id' | 'createdAt'>) => Promise<void>;
  onClose: () => void;
}

/** Upload an image, place it (optionally in a frame) and add N copies to the sheets. */
export function StickerEditorModal({ frames, onAdd, onClose }: Props) {
  const a = useAdminText();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [fileName, setFileName] = useState('');
  const [edit, setEdit] = useState<EditState>(DEFAULT_EDIT);
  const [frameId, setFrameId] = useState<string | null>(NO_FRAME);
  const [frameText, setFrameText] = useState('');
  const [label, setLabel] = useState('');
  const [diameter, setDiameter] = useState(PRINT_DIAMETER_MM);
  const [count, setCount] = useState(40);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { frame, frameImage, frameReady, overlay, fontEpoch } = useFrameState(frames, frameId, frameText);

  const pick = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const prepared = await preparePhoto(file);
      setPhoto(prepared.photo);
      setFileName(file.name.replace(/\.[^.]+$/, ''));
      setEdit(DEFAULT_EDIT);
    } catch {
      setError(a.imageError);
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (!photo) return;
    setBusy(true);
    try {
      // Same 600 DPI as student stickers, at this sticker's size.
      const px = Math.min(2400, Math.round((diameter / 25.4) * EXPORT_DPI));
      const canvas = renderExportCanvas(photo, edit, frameImage, overlay, px);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
      );
      await onAdd({ label: label.trim() || fileName || a.defaultLabel, blob, diameterMm: diameter, count });
      onClose();
    } catch {
      setError(a.saveError);
      setBusy(false);
    }
  };

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={a.editorTitle}>
      <div className="modal__panel">
        <div className="modal__head">
          <h2>{a.editorTitle}</h2>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
            {a.close}
          </button>
        </div>
        {!photo ? (
          <div className="modal__empty">
            <p className="muted">{a.editorHint}</p>
            <PhotoInput className="btn btn--primary btn--xl" onFile={pick} disabled={busy}>
              {busy ? a.openingImage : a.chooseImage}
            </PhotoInput>
          </div>
        ) : (
          <Editor
            photo={photo}
            edit={edit}
            onEdit={setEdit}
            frame={frameImage}
            overlay={overlay}
            fontEpoch={fontEpoch}
            onReset={() => setEdit(DEFAULT_EDIT)}
            changePhoto={
              <PhotoInput className="btn btn--ghost btn--sm" onFile={pick} disabled={busy}>
                {a.changeImage}
              </PhotoInput>
            }
            framePicker={
              <FramePicker
                frames={frames}
                error={false}
                selectedId={frame?.id ?? NO_FRAME}
                onSelect={setFrameId}
                allowNone
              />
            }
            textInput={<FrameTextInput value={frameText} onChange={setFrameText} available={!!frame?.textArea} />}
            actions={
              <section className="admin-form">
                <label>
                  {a.stickerLabel}
                  <input className="text-input" value={label} placeholder={fileName} onChange={(e) => setLabel(e.target.value)} />
                </label>
                <div className="admin-form__row">
                  <label>
                    {a.sizeMm}
                    <input
                      className="text-input"
                      type="number"
                      min={10}
                      max={250}
                      step={1}
                      value={diameter}
                      onChange={(e) => setDiameter(Math.max(10, Math.min(250, Number(e.target.value) || PRINT_DIAMETER_MM)))}
                    />
                  </label>
                  <label>
                    {a.copies}
                    <input
                      className="text-input"
                      type="number"
                      min={1}
                      max={2000}
                      step={1}
                      value={count}
                      onChange={(e) => setCount(Math.max(1, Math.min(2000, Math.round(Number(e.target.value)) || 1)))}
                    />
                  </label>
                </div>
                {error && <p className="alert">{error}</p>}
                <button type="button" className="btn btn--primary btn--xl" onClick={add} disabled={busy || !frameReady}>
                  {busy ? a.saving : a.addCount(count)}
                </button>
              </section>
            }
          />
        )}
      </div>
    </div>
  );
}
