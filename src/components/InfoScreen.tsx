import type { ReactNode } from 'react';
import { BrandLogo } from './BrandLogo';

/** Full-screen message: no class link, class closed, time's up, offline. */
export function InfoScreen({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <main className="screen info">
      <BrandLogo kind="mark" className="info__mark" />
      <h1 className="screen__title">{title}</h1>
      <p className="muted">{text}</p>
      {children}
    </main>
  );
}
