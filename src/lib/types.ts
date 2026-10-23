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
  /** Optional small preview for the picker; falls back to `file`. */
  thumb?: string;
  /**
   * Present when the frame has an empty band where customers can add their
   * own curved text along the bottom. All fields are optional; see
   * DEFAULT_TEXT_AREA in config.ts.
   */
  textArea?: Partial<TextArea>;
}

/** Bottom-arc text band, in fractions of the circle radius / degrees. */
export interface TextArea {
  /** Radius of the middle of the text band. */
  radius: number;
  /** Target letter height. */
  height: number;
  /** Widest arc the text may cover, centred on the bottom. */
  maxAngle: number;
  color: string;
}

export interface FrameEntry extends FrameDef {
  url: string;
  thumbUrl: string;
}
