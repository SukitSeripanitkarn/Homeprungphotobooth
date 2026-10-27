import { useEffect, useMemo, useState } from 'react';
import { loadFrameTextFont, type FrameOverlay } from './arcText';
import { loadFrameImage } from './frames';
import type { FrameEntry } from './types';

/** Value of `frameId` meaning "no frame" (admin batch stickers only). */
export const NO_FRAME = '';

/**
 * Resolves the chosen frame, loads its full image and prepares the custom
 * text overlay. Shared by the student app and the admin sticker editor.
 */
export function useFrameState(frames: FrameEntry[] | null, frameId: string | null, frameText: string) {
  const [loaded, setLoaded] = useState<{ id: string; image: HTMLImageElement } | null>(null);
  const [error, setError] = useState(false);
  const [fontEpoch, setFontEpoch] = useState(0);

  const frame = frameId === NO_FRAME ? null : (frames?.find((f) => f.id === frameId) ?? frames?.[0] ?? null);

  useEffect(() => {
    if (!frame) return;
    let current = true;
    loadFrameImage(frame)
      .then((image) => current && setLoaded({ id: frame.id, image }))
      .catch(() => current && setError(true));
    return () => {
      current = false;
    };
  }, [frame]);

  // Custom curved text, only on frames that have an empty band for it.
  const overlay = useMemo<FrameOverlay | null>(
    () => (frame?.textArea && frameText.trim() ? { text: frameText, area: frame.textArea } : null),
    [frame, frameText],
  );
  useEffect(() => {
    let current = true;
    loadFrameTextFont(frameText).then(() => current && setFontEpoch((n) => n + 1));
    return () => {
      current = false;
    };
  }, [frameText]);

  return {
    frame,
    // Keep showing the previous frame while the next one loads (no flicker).
    frameImage: frame ? (loaded?.image ?? null) : null,
    // Until the chosen frame has decoded, exports would show the wrong frame.
    frameReady: !frame || loaded?.id === frame.id,
    frameError: error,
    overlay,
    fontEpoch,
  };
}
