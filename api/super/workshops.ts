import { DEFAULT_WORKSHOP_TYPES, validateWorkshopTypes } from '../_lib/classSession.js';
import { error, handler, hasRole, json, readJson } from '../_lib/http.js';
import { getStore } from '../_lib/store.js';

const unauthorized = () => error(401, 'Not logged in', { code: 'unauthorized' });

/** GET /api/super/workshops — the current workshop types and the built-in defaults. */
export const GET = handler(async (req) => {
  if (!hasRole(req, 'super')) return unauthorized();
  return json({ workshopTypes: await getStore().getWorkshopTypes(), defaults: DEFAULT_WORKSHOP_TYPES });
});

/** PUT /api/super/workshops {workshopTypes} — replace the whole list (validated). */
export const PUT = handler(async (req) => {
  if (!hasRole(req, 'super')) return unauthorized();
  const body = await readJson<{ workshopTypes?: unknown }>(req, 64 * 1024);
  const result = validateWorkshopTypes(body.workshopTypes);
  if (!result.ok) return error(400, result.error, { code: 'invalid', reason: result.reason, row: result.row });
  await getStore().setWorkshopTypes(result.types);
  return json({ workshopTypes: result.types, defaults: DEFAULT_WORKSHOP_TYPES });
});
