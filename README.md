# Homprung Photobooth (หอมปรุง Photobooth)

A photobooth for Baihor / Homprung workshops. Students scan the class QR code, pick or take a photo, and place it in a round brand frame on their phone. Then they **send it to the admin**. The admin collects the whole class, adds any batch stickers, and prints everything on **A3 or A4 sticker sheets** packed as tightly as possible. Default sticker size: **35 mm**.

- **Students** need no account. The QR link carries the class code.
- **The admin page** (`/admin`) is protected by a password.
- **A class lasts 1 hour** from when the admin starts it. After that, every photo is deleted from the server automatically.
- **Hosting:** Vite + React + TypeScript on Vercel, with a few Vercel Functions in `api/` and Upstash Redis for the photos of the running class.

Target URL: `https://homprungphotobooth.vercel.app` (students) and `https://homprungphotobooth.vercel.app/admin` (admin).

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

Shared types and limits live in `api/_lib/classSession.ts` (`CLASS_SESSION_MINUTES = 60`).

## Frames

The app ships the client's 24 "HOMPRUNG BY BAIHOR" frames from `sticker.ai` (8 colourways × 3 designs). The picker lists them in this order:

| Group | Artboards | Design | Custom text |
| --- | --- | --- | --- |
| `classic-*` | 9–16 | "HOMPRUNG BY BAIHOR" on top, empty bottom band | ✅ |
| `thai-*` (· ไทย) | 17–24 | "หอมปรุง บาย ใบห่อ" on top, empty bottom band | ✅ |
| `inhaler-*` (· ยาดม) | 1–8 | "Your Own Herbal Inhaler" printed at the bottom | – |

The colourways, in artboard order, are: white-teal (ขาวลายเขียว), red-green (แดงเขียว), orange-red (ส้มแดง), orange-green (ส้มเขียว), yellow-purple (เหลืองม่วง), teal (เขียวหยก), red (แดงทับทิม) and purple-red (ม่วงแดง).

The frames live in `public/frames/` and are listed in **`public/frames/frames.json`**:

```json
[
  { "id": "classic-white-teal", "name": "ขาวลายเขียว", "file": "classic-white-teal.png", "thumb": "thumbs/classic-white-teal.png", "textArea": {} }
]
```

The picker loads only the small thumbnails. The full frame loads when a customer chooses it.

**To add a frame:**
1. Put a transparent square PNG into `public/frames/`.
2. Add one line to `frames.json`. `thumb` is optional; without it the picker shows the full file.

No code changes are needed. The first entry is the default frame and is also shown on the landing page.

### Custom text on the frame

Customers can type their own words, such as a name, into the empty bottom band of a frame. The text is drawn in the frame's green, curved along the bottom arc, and saved into the PNG and the prints. Thai vowel and tone marks stay attached to their letters, and long text shrinks to fit. The limit is 40 characters, where Thai vowel and tone marks each count as one.

Only frames with `"textArea"` in `frames.json` offer it: the 16 classic and Thai frames. The picker marks them with an **Aa** badge. On the inhaler frames the band already holds "Your Own Herbal Inhaler", so the text box is disabled there.

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

**How the shipped files were made:**
1. Each `sticker.ai` artboard (40 × 40 mm, transparent centre and corners) was rendered at 1024 px with poppler: `pdftocairo -png -transp -scale-to 1024 -singlefile -f N -l N sticker.ai fN`.
2. They were then reduced with the optional helper below. It resizes, applies a 256-colour palette (about 70 KB per frame) and writes the thumbnail.

```bash
pip install pillow
python3 scripts/prepare-frames.py ~/Downloads/new-frame.png my-frame-id
# → public/frames/my-frame-id.png + public/frames/thumbs/my-frame-id.png
```

- Non-square frames are center-cropped to a square, and a warning is logged in the dev console.
- If a frame's corners aren't transparent, it probably wasn't designed for a circle. The app logs a warning and clips the corners anyway.

## Brand tokens

The tokens are CSS variables in `src/styles/brand.css`, taken from the brand guidebook (`HP_Guidebook.pdf`, "Classic contemporary + art deco", "minimal Thai luxury").

| Token | Value | Guidebook / use |
| --- | --- | --- |
| `--brand-primary` | `#593015` | brown (50%): primary buttons, headings, logo |
| `--brand-primary-dark` | `#42230F` | hover / pressed |
| `--brand-secondary`, `--brand-accent` | `#605F3D` | olive (30%): second button style |
| `--bg-soft` | `#EDE8D4` | cream (15%): panels, chips, home-screen icon |
| `--border` | `#D4C8B7` | beige (5%): borders, dividers |
| `--brand-highlight` | `#C2A36B` | light gold: selected frame, art-deco arch decoration |
| `--brand-green` | `#4A8A2E` | the lettering green printed on the frames (custom frame text matches it) |
| `--bg` / `--text` / `--text-muted` | `#FBF9F4` / `#2B1A10` / `#6E5E50` | page, ink, secondary text |
| `--radius` / `--radius-pill` | `18px` / `999px` | cards / rounded buttons |

### Fonts

The guidebook's fonts are commercial. Each font stack lists them first, so they're used on any device that has them, and falls back to the closest free Google Fonts:

| Role (guidebook) | Guidebook font | Google Fonts stand-in | CSS variable |
| --- | --- | --- | --- |
| Display / title, English | Lovelace | Playfair Display | `--font-display` |
| Display / title, Thai | Kulachat Serif | Chonburi | `--font-display` |
| Section / body, English | Garet | Urbanist | `--font-heading`, `--font-body` |
| Section / body, Thai | Anantason | Anuphan | `--font-heading`, `--font-body` |

**To use the real fonts on every device** (needs a web-font licence), put the `.woff2` files in `public/fonts/` and add `@font-face` rules to `src/styles/brand.css` using the same family names, e.g.

```css
@font-face { font-family: 'Lovelace'; src: url('/fonts/Lovelace-Regular.woff2') format('woff2'); font-weight: 400 600; font-display: swap; }
```

The custom text on the frames still uses Niramit SemiBold, as requested earlier (`FRAME_TEXT_FONT` in `src/config.ts`).

### Brand assets
The asset paths are in `src/brand.ts`, and the files are in `public/brand/`. They come from the client's logo file `001_Ai` (vector, recoloured to brand brown `#593015`):

- `homprung-logo.svg`: the primary logo (arch mark over "HOMPRUNG / BY BAIHOR").
- `homprung-mark.svg`: the mark only. It's shown in the header and on info screens, and is also the SVG favicon.
- `homprung-wordmark.svg`: the secondary logo ("HOMPRUNG / BY BAIHOR"). It's shown in the header next to the mark.
- `favicon-32.png`, `favicon-64.png`: the mark on a transparent background.
- `apple-touch-icon.png`, `icon-512.png`: the mark on cream. iOS turns transparent icon corners black, so these need a solid background.
- `deco-arches.svg`: thin gold nested arches (the art-deco motif from the moodboard), used as corner decoration.

## Assumptions (please confirm or correct)

1. Colours, logo and fonts follow the Homprung brand guidebook (see "Brand tokens"). To change them, update `src/styles/brand.css`, `src/brand.ts`, `FRAME_TEXT_FONT` in `src/config.ts`, and the Google Fonts link in `index.html`.
2. The guidebook fonts are replaced by free stand-ins until web-font files are provided (see "Fonts").
3. The frame names in `frames.json` are descriptive Thai colour names I chose ("· ยาดม" marks the "Your Own Herbal Inhaler" versions). Rename them freely.
4. "1 hour" means 60 minutes from when the admin starts the class (`CLASS_SESSION_MINUTES` in `api/_lib/classSession.ts`). The class closes and its photos are deleted then, so print or download the PDFs before it ends. An admin page already open keeps the downloaded photos in memory until it is closed.
5. Frame files are square transparent PNGs designed for a circular crop.
6. Students' stickers are rendered at 35 mm / 600 DPI (827 px; `PRINT_DIAMETER_MM` and `EXPORT_DPI` in `src/config.ts`). The admin can print them at another size (the "ขนาดสติกเกอร์ผู้เรียน" setting). Sheet defaults (A3, 12 mm margin, 3 mm gap, 1 mm bleed) are `SHEET_DEFAULTS` in the same file.
7. The new frame artwork (`sticker.ai`) is drawn at **40 mm**, while the app prints students' stickers at **35 mm** by default. Everything scales cleanly. If the stickers should be 40 mm, change "ขนาดสติกเกอร์ผู้เรียน" on the admin page (and `PRINT_DIAMETER_MM` for the export resolution).
8. The admin page is in Thai only (staff-facing). The student app has Thai and English.
9. The MicroCut software's exact import options weren't available to test. The PDF uses the common `CutContour` print-and-cut convention, with a DXF as a fallback. If the cutter needs more room for its marks, increase "ขอบกระดาษ".
10. The UI spells the brand **Homprung / หอมปรุง**, and the Vercel project and domain are `homprungphotobooth` (the GitHub repository is still named `Homeprungphotobooth`, which doesn't affect the site).
11. The "เปิดกล้องถ่ายรูป" shortcut opens the front (selfie) camera. For the rear camera, change `capture` in `src/components/PhotoInput.tsx` to `environment`.

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, go to **Add New… → Project** and import the repo.
3. Set the project name to **`homprungphotobooth`** and the framework preset to **Vite** (build `npm run build`, output `dist`, also set in `vercel.json`).
4. Do the one-time set-up above (Upstash + `ADMIN_PASSWORD`), then deploy. The app will be at `https://homprungphotobooth.vercel.app`.

### Moving from the old name (`homeprungphotobooth`)
Renaming a Vercel project doesn't change the domain it already has, so:
1. **Settings → General → Project Name** → `homprungphotobooth` → Save.
2. **Settings → Domains → Add** `homprungphotobooth.vercel.app`.
3. Edit the old `homeprungphotobooth.vercel.app` domain → **Redirect to** `homprungphotobooth.vercel.app` (308), so old links and QR codes keep working.
4. Open the admin page on the new address and start a new class so its QR code uses the new domain.

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
  _lib/              storage (Upstash Redis / in-memory), auth + HTTP helpers, and
                     classSession.ts: types/limits shared with src/ (must stay under api/:
                     Vercel only compiles TypeScript there)
public/
  frames/            PNG frames + thumbs/ + frames.json
  brand/             Homprung logo/mark/wordmark (SVG), icons, art-deco decoration
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
