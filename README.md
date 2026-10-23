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

Frames live in `public/frames/` and are listed in **`public/frames/frames.json`**:

```json
[
  { "id": "herbal-green", "name": "เขียวสมุนไพร", "file": "placeholder-herbal-green.png" }
]
```

**To add a frame:**
1. Put a transparent square PNG into `public/frames/` (1024 × 1024 or larger is recommended).
2. Add one line to `frames.json`.

No code changes are needed. The first entry is the default frame.

- Non-square frames are center-cropped to a square, and a warning is logged in the dev console.
- If a frame's corners aren't transparent, it probably wasn't designed for a circle. The app logs a warning and clips the corners anyway.

> ⚠️ **The real frames still need to be added.** The build environment could not list the client's Google Drive folder "PNG" (`https://drive.google.com/drive/folders/1AHAjflck7uMxLRXchyRVRe5-3yFRfrBU`). The repo ships 3 **placeholder** ring frames, generated by `npm run frames:placeholder`. To swap in the real ones:
> 1. Download the PNGs from Drive into `public/frames/`.
> 2. Replace the entries in `frames.json`.
> 3. Delete the `placeholder-*.png` files.

## Brand tokens

The tokens are CSS variables in `src/styles/brand.css`:

| Token | Value | Use |
| --- | --- | --- |
| `--brand-primary` | `#2E6B3A` | herbal green: primary buttons, headings |
| `--brand-primary-dark` | `#1F4D29` | hover / pressed |
| `--brand-secondary` | `#7BA05B` | leaf green: decoration |
| `--brand-accent` | `#C9A24A` | warm gold: Print button, highlights |
| `--bg` / `--bg-soft` | `#FFFFFF` / `#F4F8F1` | page / soft sections |
| `--text` / `--text-muted` | `#1E2A20` / `#5B6B5E` | body text |
| `--radius` / `--radius-pill` | `16px` / `999px` | cards / rounded buttons |
| `--font-heading` | `Prompt`, Sarabun, Noto Sans Thai | Google Fonts |
| `--font-body` | `Sarabun`, Prompt, Noto Sans Thai | Google Fonts |

### Brand assets
The asset paths are in `src/brand.ts`, and the files are in `public/brand/`. They are currently **placeholder SVGs**: a leaf logo with a "หอมปรุง" wordmark, a leaf motif and a favicon. Replace them with the client's files:

- Main logo: `https://baihor.com/wp-content/uploads/2026/06/logo-baihor-3.webp`
- Alt/new logo: `https://baihor.com/wp-content/uploads/2026/03/new-logo.png`
- Leaf motif: `https://baihor.com/wp-content/uploads/2026/06/01Leaf.webp`
- Favicon source: `https://baihor.com/wp-content/uploads/2026/06/cropped-logo-baihor-2-270x270.webp`
- Homprung logo: the `homprung-logo` image in the baihor.com footer

To swap them in:
1. Save the files to `public/brand/`.
2. Update the paths in `src/brand.ts`.
3. Update the favicon link in `index.html`.

## Assumptions (please confirm or correct)

1. **The CI tokens have not been taken from baihor.com yet.** The build environment's network policy blocked both the site and Google Drive. The colors and fonts above are a herbal-green and gold palette with Prompt and Sarabun. Replace the values in `src/styles/brand.css` with the real ones from the site's styles (Elementor `--e-global-color-*` variables, the theme `style.css`, and the Google Fonts link).
2. The logos, leaf motif and frames are placeholders (see above).
3. "Edited images last 1 hour" means the customer's own browser clears them after 60 minutes. Nothing is stored on a server.
4. Frame files are square transparent PNGs designed for a circular crop.
5. 600 DPI (709 px) works for the sticker printer. If the print shop needs another resolution, change `EXPORT_PX` in `src/config.ts`; the DPI metadata updates automatically.
6. The UI spells the brand **Homprung / หอมปรุง**, while the Vercel project name stays `homeprungphotobooth`.
7. The "เปิดกล้องถ่ายรูป" shortcut opens the front (selfie) camera. For the rear camera, change `capture` in `src/components/PhotoInput.tsx` to `environment`.

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
- [ ] Replace the placeholder CI tokens, logos and frames with the real ones.
- [ ] Lighthouse mobile ≥ 90 on the deployed URL.

## Project structure

```
public/
  frames/            PNG frames + frames.json
  brand/             logo, leaf motif, favicon (placeholders)
scripts/
  make-placeholder-frames.mjs
src/
  components/        Landing, Editor, FramePicker, PrintActions, PrintView, DoneScreen, ExpiredScreen, …
  lib/               compose.ts, exportPng.ts (pHYs), session.ts (TTL), exif.ts, frames.ts
  styles/            brand.css (CI variables), app.css
  config.ts          SESSION_TTL_MINUTES, EXPORT_PX, sheet layout, …
  i18n.ts            Thai / English strings
vercel.json
```
