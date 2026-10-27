import QRCode from 'qrcode';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import type { AdminSessionResponse, SubmissionMeta } from '../../api/_lib/classSession';
import { BRAND } from '../brand';
import { STRINGS, I18nContext } from '../i18n';
import {
  ApiError,
  adminDeletePhoto,
  adminEndSession,
  adminFetchPhoto,
  adminGetSession,
  adminLogin,
  adminLogout,
  adminStartSession,
  adminStatus,
} from '../lib/api';
import { downloadBlob } from '../lib/exportPng';
import { loadFrameManifest } from '../lib/frames';
import { PAPERS, packStickers, type PackKind, type PaperId } from '../lib/pack';
import { minutesLeft } from '../lib/session';
import type { FrameEntry } from '../lib/types';
import {
  deleteExtra,
  listExtras,
  loadCopies,
  loadSettings,
  putExtra,
  saveCopies,
  saveSettings,
  type ExtraSticker,
  type SheetSettings,
} from './adminStore';
import { SheetSvg, renderSheetJpeg, sheetDxf, sheetPdf } from './sheets';
import { StickerEditorModal } from './StickerEditorModal';
import './admin.css';

const POLL_MS = 4000;
const i18n = { t: STRINGS.th, lang: 'th' as const, toggle: () => {} };

export default function AdminApp() {
  const [auth, setAuth] = useState<'checking' | 'out' | 'in'>('checking');
  useEffect(() => {
    document.title = 'แอดมิน · หอมปรุง Photobooth';
    adminStatus()
      .then((r) => setAuth(r.admin ? 'in' : 'out'))
      .catch(() => setAuth('out'));
  }, []);

  return (
    <I18nContext.Provider value={i18n}>
      <div className="admin">
        <header className="admin__header">
          <img src={BRAND.logo} alt="ตราใบห่อ" height={56} width={58} />
          <h1>แอดมิน · หอมปรุง Photobooth</h1>
          {auth === 'in' && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => adminLogout().finally(() => setAuth('out'))}>
              ออกจากระบบ
            </button>
          )}
        </header>
        {auth === 'out' && <Login onDone={() => setAuth('in')} />}
        {auth === 'in' && <Dashboard onLoggedOut={() => setAuth('out')} />}
      </div>
    </I18nContext.Provider>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminLogin(password);
      onDone();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      setError(
        code === 'wrong_password'
          ? 'รหัสผ่านไม่ถูกต้อง'
          : code === 'locked'
            ? 'ลองผิดหลายครั้งเกินไป กรุณารอ 15 นาที'
            : code === 'not_configured'
              ? (err as ApiError).message
              : 'เชื่อมต่อไม่ได้ ลองอีกครั้ง',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card login" onSubmit={submit}>
      <h2>เข้าสู่ระบบแอดมิน</h2>
      <label>
        รหัสผ่าน
        <input
          className="text-input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          required
        />
      </label>
      {error && <p className="alert">{error}</p>}
      <button className="btn btn--primary" disabled={busy || !password}>
        {busy ? 'กำลังตรวจสอบ…' : 'เข้าสู่ระบบ'}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------- dashboard

interface PhotoCache {
  [id: string]: { updatedAt: number; blob: Blob; url: string };
}

function Dashboard({ onLoggedOut }: { onLoggedOut: () => void }) {
  const [data, setData] = useState<AdminSessionResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [workshop, setWorkshop] = useState('');
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<PhotoCache>({});
  const [copies, setCopies] = useState<Record<string, number>>({});
  const [settings, setSettings] = useState<SheetSettings>(loadSettings);
  const [extras, setExtras] = useState<(ExtraSticker & { url: string })[]>([]);
  const [frames, setFrames] = useState<FrameEntry[] | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const session = data?.session ?? null;
  const studentUrl = session ? `${window.location.origin}/?s=${session.code}` : '';

  // ---- load + poll the class
  const refresh = useCallback(async () => {
    try {
      const res = await adminGetSession();
      setData(res);
      setLoadError(null);
      setClockOffset(res.now - Date.now());
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return onLoggedOut();
      // Show what went wrong instead of loading forever (polling keeps retrying).
      const e = err as ApiError;
      setLoadError(e.status ? `${e.message} (HTTP ${e.status})` : 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    }
  }, [onLoggedOut]);

  useEffect(() => {
    refresh();
    const id = window.setInterval(() => {
      setNow(Date.now());
      if (document.visibilityState === 'visible') refresh();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    loadFrameManifest().then(setFrames).catch(() => setFrames([]));
    listExtras()
      .then((xs) => setExtras(xs.map((x) => ({ ...x, url: URL.createObjectURL(x.blob) }))))
      .catch(console.error);
  }, []);

  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => {
    if (session) setCopies(loadCopies(session.id));
  }, [session?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- QR code for the class link
  useEffect(() => {
    if (!studentUrl) return setQr(null);
    QRCode.toDataURL(studentUrl, { width: 640, margin: 1, color: { dark: '#241f21', light: '#ffffff' } })
      .then(setQr)
      .catch(console.error);
  }, [studentUrl]);

  // ---- download each new/changed photo once; drop ones that are gone
  const submissions = data?.submissions ?? [];
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: PhotoCache = {};
      for (const s of submissions) {
        const cached = photos[s.id];
        if (cached && cached.updatedAt === s.updatedAt) {
          next[s.id] = cached;
          continue;
        }
        try {
          const blob = await adminFetchPhoto(s.id);
          next[s.id] = { updatedAt: s.updatedAt, blob, url: URL.createObjectURL(blob) };
        } catch {
          if (cached) next[s.id] = cached;
        }
      }
      if (cancelled) return;
      for (const [id, p] of Object.entries(photos)) if (next[id] !== p) URL.revokeObjectURL(p.url);
      setPhotos(next);
    })();
    return () => {
      cancelled = true;
    };
    // Only when the list of photos (ids/versions) changes.
  }, [submissions.map((s) => `${s.id}:${s.updatedAt}`).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- actions
  const start = async () => {
    if (session && !window.confirm('เริ่มรอบใหม่? รูปทั้งหมดของรอบปัจจุบันจะถูกลบ')) return;
    setBusy(true);
    try {
      const res = await adminStartSession(workshop);
      setData(res);
      setClockOffset(res.now - Date.now());
    } finally {
      setBusy(false);
    }
  };
  const end = async () => {
    if (!window.confirm('จบรอบนี้ตอนนี้? รูปทั้งหมดของรอบนี้จะถูกลบจากเซิร์ฟเวอร์ทันที')) return;
    setBusy(true);
    try {
      setData(await adminEndSession());
    } finally {
      setBusy(false);
    }
  };
  const removePhoto = async (s: SubmissionMeta) => {
    if (!window.confirm(`ลบรูปของ "${s.name || 'ไม่ระบุชื่อ'}"?`)) return;
    await adminDeletePhoto(s.id);
    refresh();
  };
  const setCopiesFor = (id: string, n: number) => {
    const next = { ...copies, [id]: n };
    setCopies(next);
    if (session) saveCopies(session.id, next);
  };
  const addExtra = async (x: Omit<ExtraSticker, 'id' | 'createdAt'>) => {
    const item: ExtraSticker = { ...x, id: crypto.randomUUID(), createdAt: Date.now() };
    await putExtra(item);
    setExtras((xs) => [...xs, { ...item, url: URL.createObjectURL(item.blob) }]);
  };
  const updateExtra = async (id: string, patch: Partial<Pick<ExtraSticker, 'count' | 'diameterMm'>>) => {
    const x = extras.find((e) => e.id === id);
    if (!x) return;
    const updated = { ...x, ...patch };
    setExtras((xs) => xs.map((e) => (e.id === id ? updated : e)));
    const { url: _url, ...stored } = updated;
    await putExtra(stored);
  };
  const removeExtra = async (id: string) => {
    if (!window.confirm('ลบสติกเกอร์นี้?')) return;
    await deleteExtra(id);
    setExtras((xs) => xs.filter((x) => x.id !== id));
  };

  // ---- sheets
  const copiesOf = (id: string) => copies[id] ?? settings.copiesPerPerson;
  const kinds: PackKind[] = useMemo(
    () => [
      ...submissions.map((s) => ({ key: `s:${s.id}`, diameterMm: settings.classDiameterMm, count: copiesOf(s.id) })),
      ...extras.map((x) => ({ key: `x:${x.id}`, diameterMm: x.diameterMm, count: x.count })),
    ],
    [submissions, extras, copies, settings], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const paper = PAPERS[settings.paper];
  const packed = useMemo(
    () => packStickers(kinds, { paper, marginMm: settings.marginMm, gapMm: settings.gapMm }),
    [kinds, paper, settings.marginMm, settings.gapMm],
  );
  const images = useMemo(() => {
    const m: Record<string, string> = {};
    for (const [id, p] of Object.entries(photos)) m[`s:${id}`] = p.url;
    for (const x of extras) m[`x:${x.id}`] = x.url;
    return m;
  }, [photos, extras]);
  const sources = (): Record<string, Blob> => {
    const m: Record<string, Blob> = {};
    for (const [id, p] of Object.entries(photos)) m[`s:${id}`] = p.blob;
    for (const x of extras) m[`x:${x.id}`] = x.blob;
    return m;
  };
  const totalStickers = packed.sheets.reduce((n, s) => n + s.length, 0);
  const missingImages = kinds.some((k) => k.count > 0 && !images[k.key]);

  const printAll = () => {
    let style = document.getElementById('print-page-style') as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = 'print-page-style';
      document.head.appendChild(style);
    }
    style.textContent = `@page { size: ${paper.widthMm}mm ${paper.heightMm}mm; margin: 0; }`;
    window.print();
  };

  const download = async (index: number, kind: 'pdf' | 'dxf') => {
    const sheet = packed.sheets[index];
    const base = `homprung-${settings.paper}-sheet-${index + 1}-of-${packed.sheets.length}`;
    if (kind === 'dxf') return downloadBlob(new Blob([sheetDxf(sheet, paper)], { type: 'application/dxf' }), `${base}-cut.dxf`);
    setExporting(`${index}`);
    try {
      const jpeg = await renderSheetJpeg(sheet, paper, sources(), settings.bleedMm);
      downloadBlob(sheetPdf(sheet, paper, jpeg), `${base}.pdf`);
    } finally {
      setExporting(null);
    }
  };
  const downloadAll = async () => {
    for (let i = 0; i < packed.sheets.length; i++) await download(i, 'pdf');
  };

  const serverNow = now + clockOffset;
  const left = session ? minutesLeft(session.expiresAt, serverNow) : 0;
  const set = <K extends keyof SheetSettings>(k: K, v: SheetSettings[K]) => setSettings((s) => ({ ...s, [k]: v }));
  const bleedWarning = settings.gapMm < settings.bleedMm * 2;

  if (!data) {
    return loadError ? (
      <div className="card login">
        <h2>โหลดข้อมูลรอบไม่สำเร็จ</h2>
        <p className="alert">{loadError}</p>
        <p className="field-hint">ระบบจะลองใหม่ทุก 4 วินาที ถ้ายังไม่ได้ ส่งข้อความนี้ให้ผู้ดูแลระบบ</p>
        <button type="button" className="btn btn--primary" onClick={refresh}>
          ลองอีกครั้ง
        </button>
      </div>
    ) : (
      <p className="muted">กำลังโหลด…</p>
    );
  }

  return (
    <div className="admin__grid">
      <div className="admin__col">
        {/* ---------------- class */}
        <section className="card">
          <h2>รอบเวิร์กช็อป</h2>
          {session ? (
            <div className="class-live">
              {qr && (
                <button type="button" className="class-live__qr" onClick={() => setShowQr(true)} title="แสดง QR เต็มจอ">
                  <img src={qr} alt={`QR ${studentUrl}`} width={200} height={200} />
                </button>
              )}
              <div className="class-live__info">
                {session.workshop && <p className="class-live__name">{session.workshop}</p>}
                <p className={`countdown${left <= 10 ? ' countdown--low' : ''}`}>⏱ เหลือเวลา {left} นาที</p>
                <p>
                  รหัสรอบ <strong className="class-live__code">{session.code}</strong>
                </p>
                <p className="field-hint">
                  ลิงก์สำหรับผู้เรียน: <a href={studentUrl} target="_blank" rel="noreferrer">{studentUrl}</a>
                </p>
                {left <= 10 && <p className="alert">ใกล้หมดเวลา: ดาวน์โหลดไฟล์หรือพิมพ์ให้เสร็จก่อน รูปจะถูกลบอัตโนมัติ</p>}
                <div className="btn-row btn-row--left">
                  <button type="button" className="btn btn--primary btn--sm" onClick={() => setShowQr(true)}>
                    แสดง QR เต็มจอ
                  </button>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={end} disabled={busy}>
                    จบรอบและลบรูป
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="admin-form">
              <p className="muted">
                กดเริ่มรอบเพื่อเปิดรับรูปจากผู้เรียน รอบหนึ่งมีเวลา 1 ชั่วโมง หลังจากนั้นรูปทั้งหมดจะถูกลบอัตโนมัติ
              </p>
              <label>
                ชื่อเวิร์กช็อป (ไม่บังคับ)
                <input className="text-input" value={workshop} maxLength={60} onChange={(e) => setWorkshop(e.target.value)} />
              </label>
              <button type="button" className="btn btn--primary" onClick={start} disabled={busy}>
                เริ่มรอบใหม่ (1 ชั่วโมง)
              </button>
            </div>
          )}
        </section>

        {/* ---------------- photos */}
        {session && (
          <section className="card">
            <div className="card__head">
              <h2>รูปจากผู้เรียน ({submissions.length})</h2>
              <label className="inline-field">
                จำนวนดวงต่อคน
                <input
                  className="text-input text-input--num"
                  type="number"
                  min={0}
                  max={50}
                  value={settings.copiesPerPerson}
                  onChange={(e) => set('copiesPerPerson', Math.max(0, Math.min(50, Math.round(Number(e.target.value)) || 0)))}
                />
              </label>
            </div>
            {submissions.length === 0 ? (
              <p className="muted">ยังไม่มีรูป ให้ผู้เรียนสแกน QR โค้ดด้านบน หน้านี้อัปเดตเองทุก 4 วินาที</p>
            ) : (
              <ul className="photo-grid">
                {submissions.map((s, i) => (
                  <li key={s.id} className="photo-grid__item">
                    {photos[s.id] ? <img src={photos[s.id].url} alt="" /> : <span className="photo-grid__placeholder" />}
                    <span className="photo-grid__name">
                      {i + 1}. {s.name || 'ไม่ระบุชื่อ'}
                    </span>
                    <label className="inline-field">
                      ×
                      <input
                        className="text-input text-input--num"
                        type="number"
                        min={0}
                        max={50}
                        value={copiesOf(s.id)}
                        onChange={(e) => setCopiesFor(s.id, Math.max(0, Math.min(50, Math.round(Number(e.target.value)) || 0)))}
                        aria-label="จำนวนดวง"
                      />
                    </label>
                    <button type="button" className="photo-grid__remove" onClick={() => removePhoto(s)} aria-label="ลบรูป">
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* ---------------- extras */}
        <section className="card">
          <div className="card__head">
            <h2>สติกเกอร์เพิ่มเติม (พิมพ์จำนวนมาก)</h2>
            <button type="button" className="btn btn--primary btn--sm" onClick={() => setShowEditor(true)}>
              + เพิ่มสติกเกอร์
            </button>
          </div>
          <p className="field-hint">เก็บไว้ในเบราว์เซอร์นี้เท่านั้น ไม่ถูกลบเมื่อจบรอบ ลบเองได้เมื่อไม่ใช้แล้ว</p>
          {extras.length > 0 && (
            <ul className="extra-list">
              {extras.map((x) => (
                <li key={x.id}>
                  <img src={x.url} alt="" width={56} height={56} />
                  <span className="extra-list__label">{x.label}</span>
                  <label className="inline-field">
                    ขนาด
                    <input
                      className="text-input text-input--num"
                      type="number"
                      min={10}
                      max={250}
                      value={x.diameterMm}
                      onChange={(e) => updateExtra(x.id, { diameterMm: Math.max(10, Math.min(250, Number(e.target.value) || 35)) })}
                    />
                    มม.
                  </label>
                  <label className="inline-field">
                    ×
                    <input
                      className="text-input text-input--num"
                      type="number"
                      min={0}
                      max={2000}
                      value={x.count}
                      onChange={(e) => updateExtra(x.id, { count: Math.max(0, Math.min(2000, Math.round(Number(e.target.value)) || 0)) })}
                    />
                    ดวง
                  </label>
                  <button type="button" className="photo-grid__remove" onClick={() => removeExtra(x.id)} aria-label="ลบ">
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ---------------- sheets */}
      <div className="admin__col">
        <section className="card">
          <h2>แผ่นสติกเกอร์</h2>
          <div className="settings-grid">
            <label>
              กระดาษ
              <select className="text-input" value={settings.paper} onChange={(e) => set('paper', e.target.value as PaperId)}>
                <option value="A3">A3 (297 × 420 มม.)</option>
                <option value="A4">A4 (210 × 297 มม.)</option>
              </select>
            </label>
            <NumberField label="ขนาดสติกเกอร์ผู้เรียน (มม.)" value={settings.classDiameterMm} min={10} max={250} onChange={(v) => set('classDiameterMm', v)} />
            <NumberField label="ขอบกระดาษ (มม.)" value={settings.marginMm} min={0} max={40} step={0.5} onChange={(v) => set('marginMm', v)} />
            <NumberField label="ระยะห่างระหว่างดวง (มม.)" value={settings.gapMm} min={0} max={20} step={0.5} onChange={(v) => set('gapMm', v)} />
            <NumberField label="เผื่อตัด / bleed (มม.)" value={settings.bleedMm} min={0} max={3} step={0.5} onChange={(v) => set('bleedMm', v)} />
            <label className="checkbox">
              <input type="checkbox" checked={settings.cutGuide} onChange={(e) => set('cutGuide', e.target.checked)} />
              พิมพ์เส้นตัดสีเทา (สำหรับตัดด้วยกรรไกร)
            </label>
          </div>
          {bleedWarning && <p className="alert">ระยะห่างควรมากกว่า 2 × bleed ไม่เช่นนั้นภาพของดวงข้างเคียงจะซ้อนกัน</p>}
          {packed.tooBig.length > 0 && <p className="alert">มีสติกเกอร์ที่ใหญ่เกินกระดาษ จึงไม่ได้ใส่ในแผ่น</p>}

          <p className="sheet-summary">
            {totalStickers} ดวง · {packed.sheets.length} แผ่น {settings.paper}
          </p>
          <div className="btn-row btn-row--left">
            <button type="button" className="btn btn--accent" onClick={printAll} disabled={!totalStickers || missingImages}>
              🖨 พิมพ์ทุกแผ่น
            </button>
            <button type="button" className="btn btn--ghost" onClick={downloadAll} disabled={!totalStickers || missingImages || !!exporting}>
              ⬇ PDF ทุกแผ่น (สำหรับเครื่องตัด)
            </button>
          </div>
          <details className="howto">
            <summary>วิธีพิมพ์และตัดด้วย Epson L18050 + MicroCut 30Q</summary>
            <ol>
              <li>กด "PDF ทุกแผ่น" ไฟล์ PDF มีภาพสติกเกอร์ และเส้นตัดวงกลมสีชมพูชื่อ <code>CutContour</code></li>
              <li>เปิด PDF ในโปรแกรมของเครื่องตัด MicroCut ให้โปรแกรมเพิ่มจุดมาร์ก (registration marks) แล้วสั่งพิมพ์ลงสติกเกอร์ A3 จากโปรแกรมนั้น</li>
              <li>ใส่แผ่นที่พิมพ์แล้วเข้าเครื่องตัด ให้เครื่องอ่านจุดมาร์ก แล้วตัดตามเส้น CutContour</li>
              <li>ถ้าโปรแกรมเปิด PDF ไม่ได้ ใช้ไฟล์ DXF (เส้นตัดอย่างเดียว ตำแหน่งตรงกับ PDF) วางทับภาพ</li>
              <li>ถ้าพิมพ์จากหน้านี้โดยตรง (ปุ่ม "พิมพ์ทุกแผ่น") ให้ตั้ง Scale 100% และขนาดกระดาษให้ตรง เหมาะกับการตัดด้วยมือ</li>
            </ol>
            <p className="field-hint">ขอบกระดาษ 12 มม. เผื่อที่ให้จุดมาร์กของเครื่องตัด ถ้าโปรแกรมต้องการพื้นที่มากกว่านี้ ให้เพิ่มค่า "ขอบกระดาษ"</p>
          </details>

          <div className="sheet-previews">
            {packed.sheets.map((sheet, i) => (
              <figure key={i} className="sheet-preview">
                <SheetSvg sheet={sheet} paper={paper} images={images} bleedMm={settings.bleedMm} cutGuide className="sheet-preview__svg" />
                <figcaption>
                  แผ่น {i + 1} · {sheet.length} ดวง
                  <span className="sheet-preview__links">
                    <button type="button" className="btn btn--link btn--sm" onClick={() => download(i, 'pdf')} disabled={!!exporting || missingImages}>
                      {exporting === `${i}` ? 'กำลังสร้าง…' : 'PDF'}
                    </button>
                    <button type="button" className="btn btn--link btn--sm" onClick={() => download(i, 'dxf')}>
                      DXF
                    </button>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      </div>

      {showEditor && <StickerEditorModal frames={frames} onAdd={addExtra} onClose={() => setShowEditor(false)} />}
      {showQr && qr && session && (
        <div className="qr-full" role="dialog" aria-modal="true" onClick={() => setShowQr(false)}>
          <img src={qr} alt="" />
          <p>สแกนเพื่อส่งรูปทำสติกเกอร์</p>
          {session.workshop && <p className="qr-full__sub">{session.workshop}</p>}
          <p className="qr-full__sub">แตะเพื่อปิด</p>
        </div>
      )}
      <PrintSheets sheets={packed.sheets} paper={paper} images={images} bleedMm={settings.bleedMm} cutGuide={settings.cutGuide} />
    </div>
  );
}

function NumberField(props: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(props.value));
  const last = useRef(props.value);
  if (props.value !== last.current) {
    last.current = props.value;
    setText(String(props.value));
  }
  return (
    <label>
      {props.label}
      <input
        className="text-input"
        type="number"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const v = Number(e.target.value);
          if (e.target.value !== '' && Number.isFinite(v) && v >= props.min && v <= props.max) props.onChange(v);
        }}
      />
    </label>
  );
}

/** Print-only copy of every sheet (one per page), rendered into #print-root. */
function PrintSheets(props: Omit<Parameters<typeof SheetSvg>[0], 'sheet' | 'className'> & { sheets: Parameters<typeof SheetSvg>[0]['sheet'][] }) {
  const root = document.getElementById('print-root');
  if (!root) return null;
  const { sheets, ...rest } = props;
  return createPortal(
    sheets.map((sheet, i) => (
      <div key={i} className="print-page">
        <SheetSvg sheet={sheet} {...rest} />
      </div>
    )),
    root,
  );
}
