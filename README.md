# Homprung Photobooth (หอมปรุง Photobooth)

A mobile-first photobooth for Baihor / Homprung workshops that runs entirely in the browser. Customers scan a QR code, pick or take a photo, and place it inside a round brand frame. Then they **download or print it themselves** as a **30 mm circle**.

- **No backend, no database, no cloud storage, no accounts, no analytics.** Photos never leave the device.
- Work is saved in the customer's own browser (IndexedDB) and **wiped automatically after 60 minutes**.
- The app is a static Vite + React + TypeScript build that deploys to Vercel as-is.

Target URL: `https://homeprungphotobooth.vercel.app`

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build into dist/
npm run preview    # serve dist/ locally
```

To test on a phone on the same Wi-Fi, run `npm run dev -- --host` and open the LAN URL it prints.

## How it works

| Step | Screen | Notes |
| --- | --- | --- |
| 1 | **Landing** | Logo, one line of copy, and a big **เลือกรูป / ถ่ายรูป** button (`<input type="file" accept="image/*">`, where the OS offers camera and library). There is also a **เปิดกล้องถ่ายรูป** shortcut (`capture`). |
| 2 | **Editor** | Circular canvas preview with the frame on top. Drag to move. Pinch, mouse wheel or the slider zooms around the fingers or cursor. Also: rotate 90°, reset, change photo, a horizontal frame picker and a "เหลือเวลา N นาที" countdown. |
| 3 | **Done** | Thank-you message, preview of the final circle, download or print again, back to editor, start over. |
| – | **Expired** | "หมดเวลา 1 ชั่วโมง กรุณาเริ่มใหม่" with a Start over button. |

Adding `?workshop=NAME` to the URL shows a small label in the header. It is display only and never stored.
Thai is the default language, and the header has an **EN** toggle. All strings live in `src/i18n.ts`.

### Photo handling
- EXIF orientation is applied when the photo is decoded (`src/lib/exif.ts`):
  - Chromium and Firefox use `createImageBitmap(..., { imageOrientation: 'from-image' })`.
  - Safari decodes through `<img>`, which applies EXIF natively.
- Photos longer than **4000 px** are downscaled (`MAX_PHOTO_PX`). They are then saved as a JPEG without EXIF data, so a refresh restores them exactly.
- The iOS picker converts HEIC photos to JPEG. Android Chrome cannot decode HEIC, so the user sees a friendly error and can pick another photo.

### Print output (`src/lib/exportPng.ts`, `src/components/PrintView.tsx`)
- **PNG:** 709 × 709 px (≈600 DPI at 30 mm). The photo is drawn first, the frame on top, then everything is clipped to a circle with **transparent corners**. A `pHYs` chunk (23622 px/m ≈ 600 DPI) tells image viewers and print dialogs the physical size.
- **พิมพ์ (Print):** prints one circle with `@page { size: auto; margin: 0 }` and the image at exactly `width: 30mm; height: 30mm`.
- **พิมพ์แผ่นสติกเกอร์ A4:** a centered A4 page with 6 columns × 8 rows and 2 mm gutters. A selector sets how many circles to print (1–48). To get a PDF, use the browser's "Save as PDF".
- The UI shows this tip under the buttons: **"พิมพ์ที่ขนาดจริง 100% (ไม่ย่อ/ขยาย)"**.

The print markup always stays in the page (hidden on screen) with the latest export. That way `window.print()` can run directly inside the tap, which iOS Safari requires.

### The 1-hour rule (`src/lib/session.ts`)
- The single constant is `SESSION_TTL_MINUTES = 60` in `src/config.ts`.
- `createdAt` is saved when the first photo is picked. Changing the photo keeps the original window; *Start over* resets it.
- The app checks the time **on load, every 30 s, and whenever the tab becomes visible again**. If `now - createdAt > 60 min`, it wipes everything (IndexedDB and sessionStorage) and shows the Expired screen.
- Refreshing within the hour restores the photo, position, zoom, rotation, frame and screen.
- If a customer closes the tab and never comes back, the data stays only in their own browser. It is wiped the next time they open the site.

### Privacy note
Nothing is uploaded. The only network requests are for the static app files, the frame PNGs and Google Fonts, and there are no analytics. To check, open DevTools → Network: image data only ever shows up as local `blob:` URLs.

## Frames

The app ships the client's 12 "HOMPRUNG BY BAIHOR" frames: 4 classic and 4 + 4 with the "Your Own Herbal Inhaler" (ยาดม) tagline. They live in `public/frames/` and are listed in **`public/frames/frames.json`**:

```json
[
  { "id": "classic-yellow-purple", "name": "เหลืองม่วง", "file": "classic-yellow-purple.png", "thumb": "thumbs/classic-yellow-purple.png" }
]
```

The picker loads only the small thumbnails. The full frame loads when a customer chooses it.

**To add a frame:**
1. Put a transparent square PNG into `public/frames/`.
2. Add one line to `frames.json`. `thumb` is optional; without it the picker shows the full file.

No code changes are needed. The first entry is the default frame and is also shown on the landing page.

### Custom text on the frame

Customers can type their own words, such as a name, into the empty bottom band of a frame. The text is drawn in the frame's green, curved along the bottom arc, and saved into the PNG and the prints. Thai vowel and tone marks stay attached to their letters, and long text shrinks to fit. The limit is 40 characters, where Thai vowel and tone marks each count as one.

Only frames with `"textArea"` in `frames.json` offer it: the 4 classic frames. The picker marks them with an **Aa** badge. On the inhaler frames the band already holds "Your Own Herbal Inhaler", so the text box is disabled there.

```json
{ "id": "classic-teal", "name": "เขียวหยก", "file": "classic-teal.png", "textArea": {} }
```

`{}` uses the defaults measured from these frames (`DEFAULT_TEXT_AREA` in `src/config.ts`). A new frame with a different layout can override any of them, as fractions of the circle radius and degrees:

| Field | Default | Meaning |
| --- | --- | --- |
| `radius` | `0.726` | middle of the text band |
| `height` | `0.1` | letter height |
| `maxAngle` | `150` | widest arc the text may cover, centred on the bottom |
| `color` | `"#4A8A2E"` | text colour |

For example: `"textArea": { "radius": 0.7, "color": "#5A0A2E" }`. The text uses Prompt SemiBold.

The original artwork is 4500 × 4500 px, about 1.2 MB per file, which is too heavy for phones. The shipped files were made with the optional helper below. It resizes to 1024 px, more than the 709 px export, applies a 256-colour palette (about 80 KB per frame) and writes the thumbnail:

```bash
pip install pillow
python3 scripts/prepare-frames.py ~/Downloads/new-frame.png my-frame-id
# → public/frames/my-frame-id.png + public/frames/thumbs/my-frame-id.png
```

- Non-square frames are center-cropped to a square, and a warning is logged in the dev console.
- If a frame's corners aren't transparent, it probably wasn't designed for a circle. The app logs a warning and clips the corners anyway.

## Brand tokens

The tokens are CSS variables in `src/styles/brand.css`. The colours were sampled from the client's own artwork: the Homprung frames and the ตราใบห่อ logo.

| Token | Value | Source / use |
| --- | --- | --- |
| `--brand-green` | `#4A8A2E` | exact frame text/ring green |
| `--brand-primary` | `#3E7A25` | the frame green, slightly deeper so white button text passes WCAG AA; primary buttons, headings |
| `--brand-primary-dark` | `#2F5F1B` | hover / pressed |
| `--brand-secondary` | `#1A7A6E` | teal from the frame patterns |
| `--brand-accent` | `#5A0A2E` | maroon flower ornament; Print button |
| `--brand-highlight` | `#EADE00` | yellow inner ring; selected-frame highlight |
| `--bg` / `--bg-soft` | `#FFFFFF` / `#F3F8EE` | page / soft sections |
| `--text` / `--text-muted` | `#241F21` / `#5D5A55` | logo wordmark ink / secondary text |
| `--radius` / `--radius-pill` | `16px` / `999px` | cards / rounded buttons |
| `--font-heading` | `Prompt`, Sarabun, Noto Sans Thai | Google Fonts |
| `--font-body` | `Sarabun`, Prompt, Noto Sans Thai | Google Fonts |

### Brand assets
The asset paths are in `src/brand.ts`, and the files are in `public/brand/`:

- `logo-baihor.webp`: the ตราใบห่อ / Tra Baihor logo (seal + wordmark) supplied by the client, shown in the header.
- `favicon-32.png`, `favicon-64.png`, `apple-touch-icon.png`: cut from the round "Since 1974" seal in that logo. The touch icon has a white background because iOS turns transparent corners black.
- `leaf.svg`: a simple leaf used as background decoration. This is still a stand-in for the site's leaf motif (`https://baihor.com/wp-content/uploads/2026/06/01Leaf.webp`). To use the real one, save it to `public/brand/` and update `BRAND.leaf` and the two `url('/brand/leaf.svg')` references in `src/styles/app.css`.

## Assumptions (please confirm or correct)

1. **The colours come from the client's logo and frames, not from the baihor.com stylesheets.** The build environment couldn't reach the site. The fonts (Prompt for headings, Sarabun for body text) are also my choice. If the site uses different fonts or exact colour values, update `src/styles/brand.css` and the Google Fonts link in `index.html`.
2. The leaf decoration is a stand-in for the site's leaf motif (see "Brand assets").
3. The frame names in `frames.json` are descriptive Thai colour names I chose ("· ยาดม" marks the "Your Own Herbal Inhaler" versions). Rename them freely.
4. "Edited images last 1 hour" means the customer's own browser clears them after 60 minutes. Nothing is stored on a server.
5. Frame files are square transparent PNGs designed for a circular crop.
6. 600 DPI (709 px) works for the sticker printer. If the print shop needs another resolution, change `EXPORT_PX` in `src/config.ts`; the DPI metadata updates automatically.
7. The UI spells the brand **Homprung / หอมปรุง**, while the Vercel project name stays `homeprungphotobooth`.
8. The "เปิดกล้องถ่ายรูป" shortcut opens the front (selfie) camera. For the rear camera, change `capture` in `src/components/PhotoInput.tsx` to `environment`.

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, go to **Add New… → Project** and import the repo.
3. Set the project name to **`homeprungphotobooth`**, the framework preset to **Vite**, the build command to `npm run build`, and the output directory to `dist` (also set in `vercel.json`).
4. Deploy. The app will be at `https://homeprungphotobooth.vercel.app`.
5. If the name is taken, use **`homprung-photobooth`** (`https://homprung-photobooth.vercel.app`) and update the QR code.

## QR code

Point the QR code at the production URL. You can add a workshop label:

```
https://homeprungphotobooth.vercel.app/
https://homeprungphotobooth.vercel.app/?workshop=Bangkok%20Oct%202026
```

Any QR tool works. To generate one locally (nothing is uploaded):

```bash
npx qrcode -o qr.png -w 1024 "https://homeprungphotobooth.vercel.app/?workshop=Bangkok%20Oct%202026"
```

Use error-correction level M or higher, and print the QR at least 3 cm wide.

## Acceptance checklist

Checked automatically in headless Chromium (Pixel 7 emulation):
- [x] The exported PNG is 709×709 RGBA with transparent corners and pHYs = 600 DPI.
- [x] A photo with EXIF orientation 6 comes out rotated correctly.
- [x] The print view image measures 30 mm, and 48 circles fit on one A4 page.
- [x] A refresh restores work. A record older than 60 min is wiped on load and the Expired screen appears.
- [x] No network request carries image data (only `blob:` URLs).
- [x] A photo larger than 4000 px is downscaled and loads.

Still to do on real devices or with the client:
- [ ] iPhone Safari and Android Chrome with real camera-roll photos (including HEIC).
- [ ] Print and measure 30 mm with a ruler (single circle and A4 sheet).
- [ ] Confirm fonts and colours against baihor.com, and swap in the real leaf motif.
- [ ] Lighthouse mobile ≥ 90 on the deployed URL.

## Project structure

```
public/
  frames/            PNG frames + thumbs/ + frames.json
  brand/             Baihor logo, favicons, leaf decoration
scripts/
  prepare-frames.py  optional: resize/optimise new frames + thumbnails
src/
  components/        Landing, Editor, FramePicker, PrintActions, PrintView, DoneScreen, ExpiredScreen, …
  lib/               compose.ts, exportPng.ts (pHYs), session.ts (TTL), exif.ts, frames.ts
  styles/            brand.css (CI variables), app.css
  config.ts          SESSION_TTL_MINUTES, EXPORT_PX, sheet layout, …
  i18n.ts            Thai / English strings
vercel.json
```
