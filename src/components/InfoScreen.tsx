import type { ReactNode } from 'react';
import { BRAND } from '../brand';

/** Full-screen message: no class link, class closed, time's up, offline. */
export function InfoScreen({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <main className="screen info">
      <img src={BRAND.leaf} alt="" width={64} height={64} aria-hidden="true" />
      <h1 className="screen__title">{title}</h1>
      <p className="muted">{text}</p>
      {children}
    </main>
  );
}
