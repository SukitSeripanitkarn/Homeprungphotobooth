# Homprung Photobooth (หอมปรุง Photobooth)

A photobooth for Baihor / Homprung workshops. Students scan the class QR code, pick or take a photo, and place it in a round brand frame on their phone. Then they **send it to the admin**. The admin collects the whole class, adds any batch stickers, and prints everything on **A3 or A4 sticker sheets** packed as tightly as possible. Default sticker size: **35 mm**.

- **Students** need no account. The QR link carries the class code.
- **The admin page** (`/admin`) is protected by a password.
- **A class lasts 1 hour** from when the admin starts it. After that, every photo is deleted from the server automatically.
- **Hosting:** Vite + React + TypeScript on Vercel, with a few Vercel Functions in `api/` and Upstash Redis for the photos of the running class.

Target URL: `https://homeprungphotobooth.vercel.app` (students) and `https://homeprungphotobooth.vercel.app/admin` (admin).

---

## Set up (one time, in Vercel)

1. **Storage:** in the Vercel project, open **Storage → Create Database → Upstash for Redis** (free plan), and connect it to this project. This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically.
2. **Admin password:** open **Settings → Environment Variables**, add `ADMIN_PASSWORD` with a long password, and tick Production and Preview.
3. **Redeploy** (Deployments → ⋯ → Redeploy) so the functions pick up the new settings.

Without these, the admin page shows which setting is missing.

## Quick start (local)

```bash
npm install
ADMIN_PASSWORD=test npm run dev   # http://localhost:5173 and /admin
npm run build                     # typecheck + production build into dist/
```

`npm run dev` also serves the `api/` functions. Without Upstash variables it keeps classes in memory, which is fine for testing. To test on a phone on the same Wi-Fi, run `npm run dev -- --host` and open the LAN URL it prints.

## How a class works

| Who | Step |
| --- | --- |
| Admin | Log in at `/admin` and press **เริ่มรอบใหม่ (1 ชั่วโมง)**, optionally with a workshop name. A QR code appears; **แสดง QR เต็มจอ** shows it full-screen for a projector. |
| Student | Scan the QR (`/?s=CODE`), choose a photo, adjust it, pick a frame, add optional frame text and their name, then tap **ส่งให้เจ้าหน้าที่พิมพ์**. |
| Student | **แก้ไขแล้วส่งใหม่** replaces their photo (no duplicates). **ส่งอีกรูป (คนถัดไป)** sends a new photo from the same phone, for families sharing a phone. |
| Admin | Photos appear within ~4 s with names. Set copies per person (default 1) or per photo, and remove mistakes with ✕. |
| Admin | Add batch stickers (**+ เพิ่มสติกเกอร์**): upload any image, position it with or without a Homprung frame, and choose its size and copies (e.g. 40). These are stored only in the admin's browser and are kept between classes. |
| Admin | Pick **A3 or A4**, check the sheet preview, then print or download the cutter files (below). |
| Everyone | When the hour is up (or the admin presses **จบรอบและลบรูป**), the server deletes the class and its photos. Students' phones wipe their local copy and show "หมดเวลา". |

Only one class runs at a time; starting a new one ends the previous one.

### Sheet packing (`src/lib/pack.ts`)
- **How each sheet is filled:** stickers go in rows, and each one drops to the highest spot where it doesn't touch anything. Rows can be staggered, so equal circles nest in a honeycomb.
- **Four layouts per sheet:** honeycomb or straight rows, running across or down the page. The fullest layout wins.
- **Mixed sizes:** bigger stickers go first, and smaller ones search the whole sheet for gaps.
- **Extra sheets** are added until every sticker is placed. Stickers bigger than the paper are reported, not dropped silently.
- **Settings:** margin, gap and bleed are adjustable on the admin page.

| Paper, 35 mm stickers, 5 mm margin, 2 mm gap | Simple grid | This packing |
| --- | --- | --- |
| A4 | 35 | **42** |
| A3 | 77 | **84** |

### Printing and cutting (Epson L18050 + MicroCut 30Q)
Defaults: **A3**, 12 mm margin (room for the cutter's registration marks), 3 mm gap, and 1 mm bleed (each image prints 1 mm larger than its cut line, so a slightly off cut shows no white edge).

- **PDF ทุกแผ่น / PDF:** one PDF per sheet.
  - **Print layer:** the sheet as a 360 DPI image (the Epson's native resolution).
  - **Cut layer:** each cut circle as a vector path in the **`CutContour`** spot colour (0.25 pt, 100% magenta). It's on a PDF layer marked "don't print", so an ordinary print won't show it.
  - **To use it:** open the PDF in the MicroCut software, add registration marks, print from there, then cut along `CutContour`.
- **DXF:** cut circles only, at exactly the same positions in mm, for cutter software that prefers DXF.
- **พิมพ์ทุกแผ่น:** prints straight from the browser at true size, one sheet per page. Set Scale to 100%. **พิมพ์เส้นตัดสีเทา** adds thin grey guides for cutting by hand.

### Photo handling
- EXIF orientation is applied when the photo is decoded (`src/lib/exif.ts`). Photos longer than 4000 px are downscaled first.
- The phone renders the finished sticker (827 × 827 px, 600 DPI at 35 mm) and sends it as a JPEG (~150–300 KB). The admin side clips it to the circle.
- The phone keeps its work in IndexedDB until the class ends, so a refresh doesn't lose it.
- **บันทึกรูปลงเครื่อง** still saves a PNG with 600 DPI metadata to the student's own phone.

### Privacy and security
- Photos are stored only in Upstash Redis, under keys that **expire automatically at the class end time**. Nothing is kept longer than the class.
- **Sending** requires the class code from the QR link. The server checks the image type and size (≤ 1.5 MB) and caps a class at 200 photos.
- **Viewing photos** requires the admin login:
  - The login is an HttpOnly, SameSite=Strict cookie, valid for 12 h and signed with a key derived from `ADMIN_PASSWORD` (changing the password logs everyone out).
  - After 10 wrong passwords, logins from that address are locked for 15 minutes.
- **Replacing a photo** uses a signed token that only the phone that sent it holds.
- Batch stickers never leave the admin's browser.

## API (`api/`, Vercel Functions)

| Endpoint | Who | Purpose |
| --- | --- | --- |
| `GET /api/session?code=` | students | Is this class open? (workshop name, end time) |
| `POST /api/submit` | students | Send or replace a sticker |
| `GET/POST/DELETE /api/admin/login` | admin | Status, log in, log out |
| `GET/POST/DELETE /api/admin/session` | admin | Current class and photo list, start a class, end it and delete everything |
| `GET/DELETE /api/admin/photo?id=` | admin | One photo, remove one photo |

Shared types and limits live in `shared/classSession.ts` (`CLASS_SESSION_MINUTES = 60`).

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

For example: `"textArea": { "radius": 0.7, "color": "#5A0A2E" }`. The text uses Niramit SemiBold (600).

The original artwork is 4500 × 4500 px, about 1.2 MB per file, which is too heavy for phones. The shipped files were made with the optional helper below. It resizes to 1024 px, more than the 827 px export, applies a 256-colour palette (about 80 KB per frame) and writes the thumbnail:

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
| `--font-heading` | `Niramit` (500/600), Noto Sans Thai | Google Fonts; headings, buttons |
| `--font-body` | `Niramit` (400), Noto Sans Thai | Google Fonts; body text |

### Brand assets
The asset paths are in `src/brand.ts`, and the files are in `public/brand/`:

- `logo-baihor.webp`: the ตราใบห่อ / Tra Baihor logo (seal + wordmark) supplied by the client, shown in the header.
- `favicon-32.png`, `favicon-64.png`, `apple-touch-icon.png`: cut from the round "Since 1974" seal in that logo. The touch icon has a white background because iOS turns transparent corners black.
- `leaf.svg`: a simple leaf used as background decoration. This is still a stand-in for the site's leaf motif (`https://baihor.com/wp-content/uploads/2026/06/01Leaf.webp`). To use the real one, save it to `public/brand/` and update `BRAND.leaf` and the two `url('/brand/leaf.svg')` references in `src/styles/app.css`.

## Assumptions (please confirm or correct)

1. **The colours come from the client's logo and frames, not from the baihor.com stylesheets.** The build environment couldn't reach the site. The font is Niramit (นิรมิต), chosen by the client. To change colours or fonts, update `src/styles/brand.css`, `FRAME_TEXT_FONT` in `src/config.ts`, and the Google Fonts link in `index.html`.
2. The leaf decoration is a stand-in for the site's leaf motif (see "Brand assets").
3. The frame names in `frames.json` are descriptive Thai colour names I chose ("· ยาดม" marks the "Your Own Herbal Inhaler" versions). Rename them freely.
4. "1 hour" means 60 minutes from when the admin starts the class (`CLASS_SESSION_MINUTES` in `shared/classSession.ts`). The class closes and its photos are deleted then, so print or download the PDFs before it ends. An admin page already open keeps the downloaded photos in memory until it is closed.
5. Frame files are square transparent PNGs designed for a circular crop.
6. Students' stickers are rendered at 35 mm / 600 DPI (827 px; `PRINT_DIAMETER_MM` and `EXPORT_DPI` in `src/config.ts`). The admin can print them at another size (the "ขนาดสติกเกอร์ผู้เรียน" setting). Sheet defaults (A3, 12 mm margin, 3 mm gap, 1 mm bleed) are `SHEET_DEFAULTS` in the same file.
9. The admin page is in Thai only (staff-facing). The student app has Thai and English.
10. The MicroCut software's exact import options weren't available to test. The PDF uses the common `CutContour` print-and-cut convention, with a DXF as a fallback. If the cutter needs more room for its marks, increase "ขอบกระดาษ".
7. The UI spells the brand **Homprung / หอมปรุง**, while the Vercel project name stays `homeprungphotobooth`.
8. The "เปิดกล้องถ่ายรูป" shortcut opens the front (selfie) camera. For the rear camera, change `capture` in `src/components/PhotoInput.tsx` to `environment`.

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, go to **Add New… → Project** and import the repo.
3. Set the project name to **`homeprungphotobooth`**, the framework preset to **Vite**, the build command to `npm run build`, and the output directory to `dist` (also set in `vercel.json`).
4. Deploy. The app will be at `https://homeprungphotobooth.vercel.app`.
5. If the name is taken, use **`homprung-photobooth`** (`https://homprung-photobooth.vercel.app`) and update the QR code.

## QR code

The admin page generates the class QR code itself (`/?s=CODE`) and can show it full-screen. A new class gets a new code, so print or project the QR shown for the current class.

## Acceptance checklist

Checked automatically in headless Chromium (local dev server, in-memory storage):
- [x] Admin login rejects a wrong password; a class starts with a code and QR.
- [x] 3 students send photos with names; one edits and resends, which replaces the photo instead of adding one. A refresh keeps the "sent" screen.
- [x] No class code shows "สแกน QR โค้ด…"; a wrong or ended class shows "รอบนี้ปิดรับรูปแล้ว".
- [x] The admin sees the photos, sets copies, and adds 40 × 50 mm batch stickers. Packing gives 45 stickers on 2 A3 sheets, or 3 A4.
- [x] The sheet PDF is A3 with a 360 DPI image and 40 `CutContour` circles on a non-printing layer. The DXF has the matching circles.
- [x] Ending the class deletes everything; a later send from a student's phone is refused.
- [x] Packing never overlaps or crosses the margin (unit test over A3/A4 and 25–50 mm).

Still to do after deploying:
- [ ] Set up Upstash + `ADMIN_PASSWORD` on Vercel (see "Set up").
- [ ] Run a test class with real phones (iPhone Safari, Android Chrome).
- [ ] Import a sheet PDF into the MicroCut software, print on the L18050, cut, and check the cut lines line up.

## Project structure

```
api/                 Vercel Functions (session, submit, admin/login, admin/session, admin/photo)
  _lib/              storage (Upstash Redis / in-memory), auth + HTTP helpers
shared/              types and limits used by both api/ and src/
public/
  frames/            PNG frames + thumbs/ + frames.json
  brand/             Baihor logo, favicons, leaf decoration
scripts/
  prepare-frames.py  optional: resize/optimise new frames + thumbnails
src/
  admin/             admin page: class, photos, batch stickers, sheets, PDF/DXF export
  components/        student screens: Landing, Editor, FramePicker, SendPanel, SentScreen, …
  lib/               pack.ts (sheet packing), compose.ts, exportPng.ts, session.ts, api.ts, …
  styles/            brand.css (CI variables), app.css
  config.ts          sticker size, DPI, sheet defaults, …
  i18n.ts            Thai / English strings (student app)
vercel.json
```
