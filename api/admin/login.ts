import { loginEndpoints } from '../_lib/login.js';

/** /api/admin/login — GET status, POST {password} to log in, DELETE to log out. */
export const { GET, POST, DELETE } = loginEndpoints('admin');
