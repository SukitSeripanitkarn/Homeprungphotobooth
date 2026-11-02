import { loginEndpoints } from '../_lib/login.js';

/** /api/super/login — super admin: GET status, POST {password} to log in, DELETE to log out. */
export const { GET, POST, DELETE } = loginEndpoints('super');
