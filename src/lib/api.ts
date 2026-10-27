import type {
  AdminSessionResponse,
  PublicClassSession,
  SubmitRequest,
  SubmitResponse,
} from '../../shared/classSession';

/** Error from the API, with the server's machine-readable `code` when given. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string | undefined,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      headers: init.body ? { 'Content-Type': 'application/json', ...init.headers } : init.headers,
    });
  } catch {
    throw new ApiError(0, 'offline', 'Network error');
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; code?: string };
  if (!res.ok) throw new ApiError(res.status, data.code, data.error ?? res.statusText);
  return data;
}

// ---- students

export const getClassSession = (code: string) =>
  request<PublicClassSession>(`/api/session?code=${encodeURIComponent(code)}`);

export const submitSticker = (body: SubmitRequest) =>
  request<SubmitResponse>('/api/submit', { method: 'POST', body: JSON.stringify(body) });

// ---- admin

export const adminStatus = () => request<{ admin: boolean }>('/api/admin/login');
export const adminLogin = (password: string) =>
  request<{ admin: boolean }>('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) });
export const adminLogout = () => request<{ admin: boolean }>('/api/admin/login', { method: 'DELETE' });
export const adminGetSession = () => request<AdminSessionResponse>('/api/admin/session');
export const adminStartSession = (workshop: string) =>
  request<AdminSessionResponse>('/api/admin/session', { method: 'POST', body: JSON.stringify({ workshop }) });
export const adminEndSession = () => request<AdminSessionResponse>('/api/admin/session', { method: 'DELETE' });
export const adminDeletePhoto = (id: string) =>
  request<{ ok: true }>(`/api/admin/photo?id=${encodeURIComponent(id)}`, { method: 'DELETE' });

export async function adminFetchPhoto(id: string): Promise<Blob> {
  const res = await fetch(`/api/admin/photo?id=${encodeURIComponent(id)}`, { credentials: 'same-origin' });
  if (!res.ok) throw new ApiError(res.status, undefined, res.statusText);
  return res.blob();
}

/** Square JPEG data URL of a rendered sticker canvas (corners white; the circle is clipped when printing). */
export function canvasToJpegDataUrl(canvas: HTMLCanvasElement, quality = 0.9): string {
  const flat = document.createElement('canvas');
  flat.width = canvas.width;
  flat.height = canvas.height;
  const ctx = flat.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, flat.width, flat.height);
  ctx.drawImage(canvas, 0, 0);
  return flat.toDataURL('image/jpeg', quality);
}
