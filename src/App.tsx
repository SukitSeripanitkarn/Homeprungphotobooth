import { useCallback, useEffect, useMemo, useState } from 'react';
import { SESSION_CHECK_INTERVAL_MS } from './config';
import { STRINGS, I18nContext, type Lang } from './i18n';
import { Countdown } from './components/Countdown';
import { Editor } from './components/Editor';
import { FramePicker } from './components/FramePicker';
import { FrameTextInput } from './components/FrameTextInput';
import { Header } from './components/Header';
import { InfoScreen } from './components/InfoScreen';
import { Landing } from './components/Landing';
import { PhotoInput } from './components/PhotoInput';
import { SendPanel } from './components/SendPanel';
import { SentScreen } from './components/SentScreen';
import { ApiError, canvasToJpegDataUrl, getClassSession, submitSticker } from './lib/api';
import { loadStoredPhoto, preparePhoto } from './lib/exif';
import { downloadBlob, exportPng, renderExportCanvas } from './lib/exportPng';
import { loadFrameManifest } from './lib/frames';
import { clearSession, isExpired, loadSession, savePhoto, saveState, type StateRecord } from './lib/session';
import { DEFAULT_EDIT, type EditState, type FrameEntry, type Photo } from './lib/types';
import { useFrameState } from './lib/useFrameState';

type Screen = 'boot' | 'noClass' | 'closed' | 'offline' | 'landing' | 'editor' | 'sent' | 'expired';

interface ClassInfo {
  code: string;
  workshop: string;
  expiresAt: number;
  /** serverNow - Date.now(), so a phone with a wrong clock still counts down correctly. */
  clockOffset: number;
}

const LANG_KEY = 'homprung-photobooth:lang';

/** Class code from the QR link: /?s=ABC123 */
function readClassCode(): string | null {
  const s = new URLSearchParams(window.location.search).get('s')?.trim().toUpperCase();
  return s && /^[A-Z0-9]{4,12}$/.test(s) ? s : null;
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

  const code = useMemo(readClassCode, []);
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);

  const [screen, setScreen] = useState<Screen>('boot');
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [edit, setEdit] = useState<EditState>(DEFAULT_EDIT);
  const [frameId, setFrameId] = useState<string | null>(null);
  const [frameText, setFrameText] = useState('');
  const [name, setName] = useState('');
  const [submission, setSubmission] = useState<StateRecord['submission']>(undefined);
  const [frames, setFrames] = useState<FrameEntry[] | null>(null);
  const [framesError, setFramesError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { frame, frameImage, frameReady, frameError, overlay, fontEpoch } = useFrameState(frames, frameId, frameText);
  const serverNow = useCallback(() => Date.now() + (classInfo?.clockOffset ?? 0), [classInfo]);

  // ---- boot: frames, the class from the QR link, then any saved work ----
  const boot = useCallback(async () => {
    if (!code) return setScreen('noClass');
    setScreen('boot');
    let info: ClassInfo;
    try {
      const s = await getClassSession(code);
      info = { code, workshop: s.workshop, expiresAt: s.expiresAt, clockOffset: s.now - Date.now() };
    } catch (err) {
      const ended = err instanceof ApiError && err.code === 'no_session';
      if (ended) await clearSession();
      return setScreen(ended ? 'closed' : 'offline');
    }
    setClassInfo(info);

    const res = await loadSession(code, Date.now() + info.clockOffset);
    if (res.kind !== 'active') return setScreen(res.kind === 'expired' ? 'expired' : 'landing');
    try {
      setPhoto(await loadStoredPhoto(res.photo.blob));
      if (res.state) {
        setEdit(res.state.edit);
        setFrameId(res.state.frameId);
        setFrameText(res.state.frameText ?? '');
        setName(res.state.name ?? '');
        setSubmission(res.state.submission);
      }
      setScreen(res.state?.screen === 'done' && res.state.submission ? 'sent' : 'editor');
    } catch {
      await clearSession();
      setScreen('landing');
    }
  }, [code]);

  useEffect(() => {
    loadFrameManifest()
      .then(setFrames)
      .catch((err) => {
        console.error('[frames]', err);
        setFrames([]);
        setFramesError(true);
      });
    boot();
  }, [boot]);

  // ---- wipe local work ----
  const reset = useCallback(async (next: Screen, keepName = false) => {
    await clearSession();
    setPhoto(null);
    setEdit(DEFAULT_EDIT);
    setFrameText('');
    if (!keepName) setName('');
    setSubmission(undefined);
    setError(null);
    setSendError(null);
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    setScreen(next);
  }, []);

  // ---- class end: check now, every 30 s, and when the tab becomes visible ----
  useEffect(() => {
    if (!classInfo) return;
    const check = () => {
      const n = serverNow();
      setNow(n);
      if (isExpired(classInfo.expiresAt, n)) reset('expired');
    };
    check();
    const id = window.setInterval(check, SESSION_CHECK_INTERVAL_MS);
    const onVis = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [classInfo, serverNow, reset]);

  // ---- persist edit state (debounced) so a refresh restores work ----
  useEffect(() => {
    if (!photo || (screen !== 'editor' && screen !== 'sent')) return;
    const state: StateRecord = {
      edit,
      frameId: frame?.id ?? null,
      frameText,
      name,
      submission,
      screen: screen === 'sent' ? 'done' : 'editor',
    };
    const id = window.setTimeout(() => saveState(state), 300);
    return () => clearTimeout(id);
  }, [photo, edit, frame, frameText, name, submission, screen]);

  // ---- actions ----
  const handleFile = useCallback(
    async (file: File) => {
      if (!classInfo) return;
      setBusy(true);
      setError(null);
      try {
        const prepared = await preparePhoto(file);
        await savePhoto({ code: classInfo.code, expiresAt: classInfo.expiresAt, blob: prepared.blob });
        setPhoto(prepared.photo);
        setEdit(DEFAULT_EDIT);
        setScreen('editor');
      } catch (err) {
        console.error(err);
        setError(t.loadPhotoError);
      } finally {
        setBusy(false);
      }
    },
    [classInfo, t],
  );

  const exportCanvas = () => (photo ? renderExportCanvas(photo, edit, frameImage, overlay) : null);

  const showPreview = (canvas: HTMLCanvasElement) =>
    canvas.toBlob((b) =>
      setPreviewUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return b ? URL.createObjectURL(b) : null;
      }),
    );

  // After a refresh on the "sent" screen, rebuild its preview once the frame is ready.
  useEffect(() => {
    if (screen !== 'sent' || !photo || !frameReady || previewUrl) return;
    showPreview(renderExportCanvas(photo, edit, frameImage, overlay));
  }, [screen, photo, frameReady, previewUrl, edit, frameImage, overlay, fontEpoch]);

  const handleSend = async () => {
    const canvas = exportCanvas();
    if (!canvas || !classInfo) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await submitSticker({
        code: classInfo.code,
        name: name.trim(),
        image: canvasToJpegDataUrl(canvas),
        ...(submission ?? {}),
      });
      const sent = { id: res.id, token: res.token };
      setSubmission(sent);
      // Save right away (not debounced) so a refresh can't lose the replace token.
      await saveState({ edit, frameId: frame?.id ?? null, frameText, name, submission: sent, screen: 'done' });
      showPreview(canvas);
      setScreen('sent');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'no_session') {
        await reset('closed');
      } else {
        setSendError(err instanceof ApiError && err.code === 'full' ? t.sendFull : t.sendError);
      }
    } finally {
      setSending(false);
    }
  };

  const handleDownload = async () => {
    if (!photo) return;
    try {
      downloadBlob(await exportPng(photo, edit, frameImage, overlay));
    } catch (err) {
      console.error(err);
      alert(t.exportError);
    }
  };

  const nextPerson = () => {
    if (window.confirm(t.confirmNextPerson)) reset('landing');
  };

  const countdown = classInfo ? <Countdown expiresAt={classInfo.expiresAt} now={now} /> : null;

  return (
    <I18nContext.Provider value={i18n}>
      <div className="app">
        <Header workshop={classInfo?.workshop || null} />
        {screen === 'boot' && <div className="screen" aria-busy="true" />}
        {screen === 'noClass' && <InfoScreen title={t.noClassTitle} text={t.noClassText} />}
        {screen === 'closed' && <InfoScreen title={t.closedTitle} text={t.closedText} />}
        {screen === 'expired' && <InfoScreen title={t.expiredTitle} text={t.expiredText} />}
        {screen === 'offline' && (
          <InfoScreen title={t.offlineTitle} text={t.offlineText}>
            <button type="button" className="btn btn--primary" onClick={boot}>
              {t.retry}
            </button>
          </InfoScreen>
        )}
        {screen === 'landing' && (
          <Landing onFile={handleFile} busy={busy} error={error} heroUrl={frames?.[0]?.url ?? null} countdown={countdown} />
        )}
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
              <FramePicker
                frames={frames}
                error={framesError || frameError}
                selectedId={frame?.id ?? null}
                onSelect={setFrameId}
              />
            }
            textInput={<FrameTextInput value={frameText} onChange={setFrameText} available={!!frame?.textArea} />}
            actions={
              <SendPanel
                name={name}
                onName={setName}
                onSend={handleSend}
                onDownload={handleDownload}
                sent={!!submission}
                sending={sending}
                error={sendError}
                disabled={!frameReady}
              />
            }
          />
        )}
        {screen === 'sent' && photo && (
          <SentScreen
            previewUrl={previewUrl}
            name={name}
            countdown={countdown}
            onEdit={() => setScreen('editor')}
            onNextPerson={nextPerson}
            onDownload={handleDownload}
          />
        )}
        {error && screen === 'editor' && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
      </div>
    </I18nContext.Provider>
  );
}
