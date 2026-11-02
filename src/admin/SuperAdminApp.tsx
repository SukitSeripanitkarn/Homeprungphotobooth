import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { WORKSHOP_LIMITS, type WorkshopType } from '../../api/_lib/classSession';
import { BrandLogo } from '../components/BrandLogo';
import { PrefsToggles } from '../components/PrefsToggles';
import { STRINGS, I18nContext, useI18n } from '../i18n';
import { ApiError, superGetWorkshops, superLogin, superLogout, superSaveWorkshops, superStatus } from '../lib/api';
import { PAPERS, packStickers } from '../lib/pack';
import { usePrefs } from '../lib/prefs';
import { CmInput } from './CmInput';
import { useSuperText } from './superI18n';
import './admin.css';

/**
 * /superadmin — edit the workshop types (names, sticker size, margin, gap)
 * that admins choose from when starting a class. Separate password
 * (SUPERADMIN_PASSWORD) from the admin page.
 */
export default function SuperAdminApp() {
  const { lang, toggleLang, theme, toggleTheme } = usePrefs();
  const i18n = useMemo(
    () => ({ t: STRINGS[lang], lang, toggle: toggleLang, theme, toggleTheme }),
    [lang, toggleLang, theme, toggleTheme],
  );
  const [auth, setAuth] = useState<'checking' | 'out' | 'in'>('checking');
  useEffect(() => {
    superStatus()
      .then((r) => setAuth(r.super ? 'in' : 'out'))
      .catch(() => setAuth('out'));
  }, []);
  return (
    <I18nContext.Provider value={i18n}>
      <Shell auth={auth} setAuth={setAuth} />
    </I18nContext.Provider>
  );
}

function Shell({ auth, setAuth }: { auth: 'checking' | 'out' | 'in'; setAuth: (a: 'out' | 'in') => void }) {
  const s = useSuperText();
  useEffect(() => {
    document.title = s.title;
  }, [s]);
  return (
    <div className="admin">
      <header className="admin__header">
        <BrandLogo kind="mark" className="admin__mark" />
        <h1>{s.title}</h1>
        <PrefsToggles />
        {auth === 'in' && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => superLogout().finally(() => setAuth('out'))}>
            {s.logout}
          </button>
        )}
      </header>
      {auth === 'out' && <Login onDone={() => setAuth('in')} />}
      {auth === 'in' && <WorkshopEditor onLoggedOut={() => setAuth('out')} />}
    </div>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const s = useSuperText();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await superLogin(password);
      onDone();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      setError(
        code === 'wrong_password'
          ? s.wrongPassword
          : code === 'locked'
            ? s.locked
            : code === 'not_configured'
              ? (err as ApiError).message
              : s.cannotConnect,
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="card login" onSubmit={submit}>
      <h2>{s.loginTitle}</h2>
      <label>
        {s.password}
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
        {busy ? s.checking : s.login}
      </button>
    </form>
  );
}

/** How many stickers of one type fit on one sheet of each paper. */
function perSheet(t: WorkshopType) {
  const count = (paper: keyof typeof PAPERS) =>
    packStickers([{ key: 't', diameterMm: t.diameterMm, count: 500 }], { paper: PAPERS[paper], marginMm: t.marginMm, gapMm: t.gapMm })
      .sheets[0]?.length ?? 0;
  return { a3: count('A3'), a4: count('A4') };
}

function WorkshopEditor({ onLoggedOut }: { onLoggedOut: () => void }) {
  const s = useSuperText();
  const { lang } = useI18n();
  const [types, setTypes] = useState<WorkshopType[] | null>(null);
  const [saved, setSaved] = useState<string>('');
  const [defaults, setDefaults] = useState<WorkshopType[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    superGetWorkshops()
      .then((r) => {
        setTypes(r.workshopTypes);
        setSaved(JSON.stringify(r.workshopTypes));
        setDefaults(r.defaults);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) onLoggedOut();
        else setMessage({ ok: false, text: err instanceof ApiError ? err.message : s.cannotConnect });
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!types) return message ? <p className="alert">{message.text}</p> : <p className="muted">{s.loading}</p>;

  const dirty = JSON.stringify(types) !== saved;
  const update = (i: number, patch: Partial<WorkshopType>) => {
    setMessage(null);
    setTypes(types.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  };
  const move = (i: number, by: number) => {
    const next = [...types];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    setTypes(next);
  };
  const remove = (i: number) => {
    if (!window.confirm(s.confirmRemove(types[i][lang] || types[i].th))) return;
    setTypes(types.filter((_, j) => j !== i));
  };
  const add = () => {
    const last = types[types.length - 1];
    setTypes([
      ...types,
      { id: '', th: s.newName, en: 'New workshop', diameterMm: 35, marginMm: last?.marginMm ?? 12, gapMm: last?.gapMm ?? 3 },
    ]);
  };
  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const r = await superSaveWorkshops(types);
      setTypes(r.workshopTypes);
      setSaved(JSON.stringify(r.workshopTypes));
      setMessage({ ok: true, text: s.saved });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return onLoggedOut();
      let reason = s.cannotConnect;
      if (err instanceof ApiError) {
        const { reason: code, row } = err.details as { reason?: string; row?: number };
        const text = (code && s.invalid[code]) || err.message;
        reason = row ? `${s.rowLabel(row)}: ${text}` : text;
      }
      setMessage({ ok: false, text: `${s.saveError}: ${reason}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card super">
      <div className="card__head">
        <h2>{s.workshopsTitle}</h2>
        <a className="btn btn--ghost btn--sm" href="/admin">
          {s.goAdmin}
        </a>
      </div>
      <p className="field-hint">{s.intro}</p>

      <ol className="workshop-list">
        {types.map((t, i) => {
          const fit = perSheet(t);
          return (
            <li key={t.id || `new-${i}`} className="workshop-row">
              <div className="workshop-row__fields">
                <label>
                  {s.nameTh}
                  <input
                    className="text-input"
                    value={t.th}
                    maxLength={WORKSHOP_LIMITS.maxNameLength}
                    onChange={(e) => update(i, { th: e.target.value })}
                  />
                </label>
                <label>
                  {s.nameEn}
                  <input
                    className="text-input"
                    value={t.en}
                    maxLength={WORKSHOP_LIMITS.maxNameLength}
                    onChange={(e) => update(i, { en: e.target.value })}
                  />
                </label>
                <label>
                  {s.size}
                  <CmInput
                    valueMm={t.diameterMm}
                    minMm={WORKSHOP_LIMITS.diameterMm[0]}
                    maxMm={WORKSHOP_LIMITS.diameterMm[1]}
                    onChangeMm={(mm) => update(i, { diameterMm: mm })}
                    aria-label={s.size}
                  />
                </label>
                <label>
                  {s.margin}
                  <CmInput
                    valueMm={t.marginMm}
                    minMm={WORKSHOP_LIMITS.marginMm[0]}
                    maxMm={WORKSHOP_LIMITS.marginMm[1]}
                    onChangeMm={(mm) => update(i, { marginMm: mm })}
                    aria-label={s.margin}
                  />
                </label>
                <label>
                  {s.gap}
                  <CmInput
                    valueMm={t.gapMm}
                    minMm={WORKSHOP_LIMITS.gapMm[0]}
                    maxMm={WORKSHOP_LIMITS.gapMm[1]}
                    stepCm={0.05}
                    onChangeMm={(mm) => update(i, { gapMm: mm })}
                    aria-label={s.gap}
                  />
                </label>
              </div>
              <div className="workshop-row__foot">
                <span className="workshop-row__fit">
                  {s.perSheet(fit.a3, fit.a4)}
                  {fit.a4 === 0 && <span className="workshop-row__warn"> · {s.doesNotFitA4}</span>}
                </span>
                <span className="workshop-row__actions">
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={s.moveUp}>
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => move(i, 1)}
                    disabled={i === types.length - 1}
                    aria-label={s.moveDown}
                  >
                    ↓
                  </button>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => remove(i)} disabled={types.length === 1}>
                    ✕ {s.remove}
                  </button>
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="btn-row btn-row--left">
        <button type="button" className="btn btn--ghost" onClick={add} disabled={types.length >= WORKSHOP_LIMITS.maxTypes}>
          {s.add}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => window.confirm(s.confirmReset) && setTypes(defaults.map((d) => ({ ...d })))}
        >
          {s.resetDefaults}
        </button>
      </div>
      <div className="super__save">
        <button type="button" className="btn btn--primary" onClick={save} disabled={busy || !dirty}>
          {busy ? s.saving : s.save}
        </button>
        {dirty && !busy && <span className="field-hint">{s.unsaved}</span>}
        {message && <p className={message.ok ? 'super__ok' : 'alert'}>{message.text}</p>}
      </div>
    </section>
  );
}

