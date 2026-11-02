import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/brand.css';
import './styles/app.css';

// The admin page is a separate chunk so students never download it.
const AdminApp = lazy(() => import('./admin/AdminApp'));
const SuperAdminApp = lazy(() => import('./admin/SuperAdminApp'));
const path = window.location.pathname.replace(/\/+$/, '');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {path === '/admin' || path === '/superadmin' ? (
      <Suspense fallback={null}>{path === '/admin' ? <AdminApp /> : <SuperAdminApp />}</Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
