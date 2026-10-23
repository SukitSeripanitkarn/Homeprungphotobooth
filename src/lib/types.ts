/** A decoded, orientation-corrected photo ready to draw on a canvas. */
export interface Photo {
  source: CanvasImageSource;
  width: number;
  height: number;
}

/**
 * Edit state, resolution independent. `x`/`y` are the offset of the photo's
 * centre from the circle's centre, in units of the circle diameter. `zoom` is
 * relative to "cover" (1 = the photo's short side exactly spans the circle).
 * `rotation` is in quarter turns clockwise.
 */
export interface EditState {
  x: number;
  y: number;
  zoom: number;
  rotation: 0 | 1 | 2 | 3;
}

export const DEFAULT_EDIT: EditState = { x: 0, y: 0, zoom: 1, rotation: 0 };

export interface FrameDef {
  id: string;
  name: string;
  file: string;
}

export interface LoadedFrame extends FrameDef {
  url: string;
  image: HTMLImageElement;
}
