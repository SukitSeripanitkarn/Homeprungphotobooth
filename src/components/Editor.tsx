import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ZOOM_MAX, ZOOM_MIN } from '../config';
import { useI18n } from '../i18n';
import type { FrameOverlay } from '../lib/arcText';
import { clampEdit, compose, zoomAbout } from '../lib/compose';
import type { EditState, Photo } from '../lib/types';

interface Props {
  photo: Photo;
  edit: EditState;
  onEdit: (edit: EditState) => void;
  frame: HTMLImageElement | null;
  overlay: FrameOverlay | null;
  /** Changes when the text font finishes loading, to trigger a redraw. */
  fontEpoch: number;
  onReset: () => void;
  changePhoto: ReactNode;
  countdown: ReactNode;
  framePicker: ReactNode;
  textInput: ReactNode;
  actions: ReactNode;
  onDone: () => void;
}

export function Editor({
  photo,
  edit,
  onEdit,
  frame,
  overlay,
  fontEpoch,
  onReset,
  changePhoto,
  countdown,
  framePicker,
  textInput,
  actions,
  onDone,
}: Props) {
  const { t } = useI18n();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cssSize, setCssSize] = useState(0);

  // Latest values for gesture handlers without re-binding listeners.
  const editRef = useRef(edit);
  editRef.current = edit;
  const photoRef = useRef(photo);
  photoRef.current = photo;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setCssSize(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !cssSize) return;
    const px = Math.round(cssSize * Math.min(window.devicePixelRatio || 1, 3));
    if (canvas.width !== px) {
      canvas.width = px;
      canvas.height = px;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const raf = requestAnimationFrame(() => compose(ctx, px, photo, edit, frame, overlay));
    return () => cancelAnimationFrame(raf);
  }, [cssSize, photo, edit, frame, overlay, fontEpoch]);

  /** Converts a client point to diameter units relative to the circle centre. */
  const toUnits = useCallback((clientX: number, clientY: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: (clientX - r.left - r.width / 2) / r.width, y: (clientY - r.top - r.height / 2) / r.height };
  }, []);

  // --- pointer gestures: 1 finger = drag, 2 fingers = pinch-zoom + pan ---
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const map = pointers.current;
    const prev = map.get(e.pointerId);
    if (!prev) return;
    const width = canvasRef.current!.getBoundingClientRect().width || 1;
    const cur = editRef.current;
    const p = photoRef.current;

    if (map.size === 1) {
      onEdit(clampEdit({ ...cur, x: cur.x + (e.clientX - prev.x) / width, y: cur.y + (e.clientY - prev.y) / width }, p));
    } else if (map.size === 2) {
      const [a, b] = [...map.entries()];
      const other = a[0] === e.pointerId ? b[1] : a[1];
      const oldDist = Math.hypot(prev.x - other.x, prev.y - other.y) || 1;
      const newDist = Math.hypot(e.clientX - other.x, e.clientY - other.y) || 1;
      const oldMid = toUnits((prev.x + other.x) / 2, (prev.y + other.y) / 2);
      const newMid = toUnits((e.clientX + other.x) / 2, (e.clientY + other.y) / 2);
      const zoomed = zoomAbout(cur, newDist / oldDist, oldMid.x, oldMid.y, p);
      onEdit(clampEdit({ ...zoomed, x: zoomed.x + newMid.x - oldMid.x, y: zoomed.y + newMid.y - oldMid.y }, p));
    }
    map.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
  };

  // Wheel / trackpad zoom (needs a non-passive listener to prevent page scroll).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const pt = toUnits(e.clientX, e.clientY);
      onEdit(zoomAbout(editRef.current, Math.exp(-e.deltaY * 0.0015), pt.x, pt.y, photoRef.current));
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [onEdit, toUnits]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = 0.02;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key];
      onEdit(clampEdit({ ...edit, x: edit.x + dx, y: edit.y + dy }, photo));
    } else if (e.key === '+' || e.key === '=') {
      onEdit(zoomAbout(edit, 1.1, 0, 0, photo));
    } else if (e.key === '-') {
      onEdit(zoomAbout(edit, 1 / 1.1, 0, 0, photo));
    }
  };

  const rotate = () =>
    onEdit(clampEdit({ ...edit, rotation: ((edit.rotation + 1) % 4) as EditState['rotation'], x: 0, y: 0 }, photo));

  return (
    <main className="screen editor">
      {countdown}
      <div className="stage" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          className="stage__canvas"
          tabIndex={0}
          aria-label={t.dragHint}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
        />
      </div>
      <p className="hint">{t.dragHint}</p>

      <div className="controls">
        <label className="zoom">
          <span>{t.zoom}</span>
          <input
            type="range"
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step={0.01}
            value={edit.zoom}
            onChange={(e) => onEdit(zoomAbout(edit, Number(e.target.value) / edit.zoom, 0, 0, photo))}
          />
        </label>
        <div className="btn-row btn-row--small">
          <button type="button" className="btn btn--ghost btn--sm" onClick={rotate}>
            ⟳ {t.rotate}
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onReset}>
            ↺ {t.reset}
          </button>
          {changePhoto}
        </div>
      </div>

      {framePicker}
      {textInput}
      {actions}

      <button type="button" className="btn btn--link" onClick={onDone}>
        {t.done} →
      </button>
    </main>
  );
}
