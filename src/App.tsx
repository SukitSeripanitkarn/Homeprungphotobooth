import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SESSION_CHECK_INTERVAL_MS, SHEET_MAX } from './config';
import { STRINGS, I18nContext, type Lang } from './i18n';
import { Countdown } from './components/Countdown';
import { DoneScreen } from './components/DoneScreen';
import { Editor } from './components/Editor';
import { ExpiredScreen } from './components/ExpiredScreen';
import { FramePicker } from './components/FramePicker';
import { FrameTextInput } from './components/FrameTextInput';
import { Header } from './components/Header';
import { Landing } from './components/Landing';
import { PhotoInput } from './components/PhotoInput';
import { PrintActions } from './components/PrintActions';
import { PrintView, printNow, type PrintMode } from './components/PrintView';
import { loadFrameTextFont, type FrameOverlay } from './lib/arcText';
import { loadStoredPhoto, preparePhoto } from './lib/exif';
import { downloadBlob, exportPng } from './lib/exportPng';
import { loadFrameImage, loadFrameManifest } from './lib/frames';
import { clearSession, isExpired, loadSession, savePhoto, saveState } from './lib/session';
import { DEFAULT_EDIT, type EditState, type FrameEntry, type Photo } from './lib/types';

type Screen = 'boot' | 'landing' | 'editor' | 'done' | 'expired';

const LANG_KEY = 'homprung-photobooth:lang';

function readWorkshop(): string | null {
  const w = new URLSearchParams(window.location.search).get('workshop')?.trim();
  return w ? w.slice(0, 40) : null;
}

function readLang(): Lang {
  try {
    return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'th';
  } catch {
    return 'th';
  }
}

export default function App() {
  const [lang, setLang] = useState<Lang>(readLang);
  const t = STRINGS[lang];
  const i18n = useMemo(
    () => ({
      t,
      lang,
      toggle: () =>
        setLang((l) => {
          const next = l === 'th' ? 'en' : 'th';
          try {
            localStorage.setItem(LANG_KEY, next);
          } catch {
            /* ignore */
          }
          return next;
        }),
    }),
    [t, lang],
  );
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const workshop = useMemo(readWorkshop, []);

  const [screen, setScreen] = useState<Screen>('boot');
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [createdAt, setCreatedAt] = useState<number | null>(null);
  const [edit, setEdit] = useState<EditState>(DEFAULT_EDIT);
  const [frameId, setFrameId] = useState<string | null>(null);
  const [frameText, setFrameText] = useState('');
  const [fontEpoch, setFontEpoch] = useState(0);
  const [frames, setFrames] = useState<FrameEntry[] | null>(null);
  const [loadedFrame, setLoadedFrame] = useState<{ id: string; image: HTMLImageElement } | null>(null);
  const [framesError, setFramesError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [sheetCount, setSheetCount] = useState(SHEET_MAX);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const exportBlobRef = useRef<Blob | null>(null);
  const exportDirty = useRef(true);

  const frame = frames?.find((f) => f.id === frameId) ?? frames?.[0] ?? null;

  // Load the selected frame's full image on demand (thumbnails are used in the picker).
  useEffect(() => {
    if (!frame) return;
    let current = true;
    loadFrameImage(frame)
      .then((image) => current && setLoadedFrame({ id: frame.id, image }))
      .catch(() => current && setFramesError(true));
    return () => {
      current = false;
    };
  }, [frame]);
  const frameImage = loadedFrame?.image ?? null;
  // Until the chosen frame has decoded, exports would still show the previous one.
  const frameReady = !frame || loadedFrame?.id === frame.id;

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

  // ---- boot: frames + restore a saved session ----
  useEffect(() => {
    loadFrameManifest()
      .then(setFrames)
      .catch((err) => {
        console.error('[frames]', err);
        setFrames([]);
        setFramesError(true);
      });

    (async () => {
      const res = await loadSession();
      if (res.kind === 'expired') return setScreen('expired');
      if (res.kind === 'none') return setScreen('landing');
      try {
        setPhoto(await loadStoredPhoto(res.photo.blob));
        setCreatedAt(res.photo.createdAt);
        if (res.state) {
          setEdit(res.state.edit);
          setFrameId(res.state.frameId);
          setFrameText(res.state.frameText ?? '');
        }
        setScreen(res.state?.screen ?? 'editor');
      } catch {
        await clearSession();
        setScreen('landing');
      }
    })();
  }, []);

  // ---- wipe everything ----
  const reset = useCallback(async (next: Screen) => {
    await clearSession();
    setPhoto(null);
    setCreatedAt(null);
    setEdit(DEFAULT_EDIT);
    setFrameText('');
    setError(null);
    exportBlobRef.current = null;
    setExportUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    setScreen(next);
  }, []);

  // ---- 1-hour rule: check now, every 30 s, and when the tab becomes visible ----
  useEffect(() => {
    if (createdAt == null) return;
    const check = () => {
      const n = Date.now();
      setNow(n);
      if (isExpired(createdAt, n)) reset('expired');
    };
    check();
    const id = window.setInterval(check, SESSION_CHECK_INTERVAL_MS);
    const onVis = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [createdAt, reset]);

  // ---- persist edit state (debounced) so a refresh restores work ----
  useEffect(() => {
    if (!photo || (screen !== 'editor' && screen !== 'done')) return;
    const id = window.setTimeout(() => saveState({ edit, frameId: frame?.id ?? null, frameText, screen }), 300);
    return () => clearTimeout(id);
  }, [photo, edit, frame, frameText, screen]);

  // ---- keep an up-to-date export for print + done preview ----
  const refreshExport = useCallback(async () => {
    if (!photo) return null;
    const blob = await exportPng(photo, edit, frameImage, overlay);
    exportBlobRef.current = blob;
    exportDirty.current = false;
    setExportUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(blob);
    });
    return blob;
  }, [photo, edit, frameImage, overlay, fontEpoch]);

  useEffect(() => {
    exportDirty.current = true;
    if (!photo) return;
    const id = window.setTimeout(() => refreshExport().catch(console.error), 250);
    return () => clearTimeout(id);
  }, [photo, refreshExport]);

  // ---- actions ----
  const handleFile = useCallback(
    async (file: File) => {
      setBusy(true);
      setError(null);
      try {
        const prepared = await preparePhoto(file);
        // Changing the photo keeps the original 1-hour window.
        const started = createdAt ?? Date.now();
        await savePhoto({ createdAt: started, blob: prepared.blob });
        setPhoto(prepared.photo);
        setCreatedAt(started);
        setEdit(DEFAULT_EDIT);
        setScreen('editor');
      } catch (err) {
        console.error(err);
        setError(t.loadPhotoError);
      } finally {
        setBusy(false);
      }
    },
    [createdAt, t],
  );

  const handleDownload = async () => {
    try {
      const blob = !exportDirty.current && exportBlobRef.current ? exportBlobRef.current : await refreshExport();
      if (blob) downloadBlob(blob);
      setScreen('done');
    } catch (err) {
      console.error(err);
      alert(t.exportError);
    }
  };

  const handlePrint = async (mode: PrintMode) => {
    try {
      if (exportDirty.current || !exportUrl) {
        await refreshExport();
        // Let React commit the new <img> src before printing.
        await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 50)));
      }
      printNow(mode);
      setScreen('done');
    } catch (err) {
      console.error(err);
      alert(t.exportError);
    }
  };

  const startOver = () => {
    if (window.confirm(t.confirmStartOver)) reset('landing');
  };

  const countdown = createdAt != null ? <Countdown createdAt={createdAt} now={now} /> : null;
  const actions = (
    <PrintActions
      onDownload={handleDownload}
      onPrint={() => handlePrint('single')}
      onPrintSheet={() => handlePrint('sheet')}
      sheetCount={sheetCount}
      onSheetCount={setSheetCount}
      disabled={!photo || !frameReady}
    />
  );

  return (
    <I18nContext.Provider value={i18n}>
      <div className="app">
        <Header workshop={workshop} />
        {screen === 'boot' && <div className="screen" aria-busy="true" />}
        {screen === 'landing' && <Landing onFile={handleFile} busy={busy} error={error} heroUrl={frames?.[0]?.url ?? null} />}
        {screen === 'expired' && <ExpiredScreen onStartOver={() => reset('landing')} />}
        {screen === 'editor' && photo && (
          <Editor
            photo={photo}
            edit={edit}
            onEdit={setEdit}
            frame={frameImage}
            overlay={overlay}
            fontEpoch={fontEpoch}
            onReset={() => setEdit(DEFAULT_EDIT)}
            countdown={countdown}
            changePhoto={
              <PhotoInput className="btn btn--ghost btn--sm" onFile={handleFile} disabled={busy}>
                🖼 {busy ? t.loadingPhoto : t.changePhoto}
              </PhotoInput>
            }
            framePicker={
              <FramePicker frames={frames} error={framesError} selectedId={frame?.id ?? null} onSelect={setFrameId} />
            }
            textInput={<FrameTextInput value={frameText} onChange={setFrameText} available={!!frame?.textArea} />}
            actions={actions}
            onDone={() => setScreen('done')}
          />
        )}
        {screen === 'done' && photo && (
          <DoneScreen
            previewUrl={exportUrl}
            actions={actions}
            onBack={() => setScreen('editor')}
            onStartOver={startOver}
            countdown={countdown}
          />
        )}
        {error && screen === 'editor' && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
      </div>
      {exportUrl && <PrintView url={exportUrl} count={sheetCount} />}
    </I18nContext.Provider>
  );
}
