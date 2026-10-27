import { BRAND } from '../brand';

/**
 * The Homprung logo artwork drawn through a CSS mask, so it takes its colour
 * from the theme (`--logo-color`): brand brown in light mode, cream in dark.
 * Size it with CSS height; the aspect ratio comes from the artwork.
 */
export function BrandLogo({ kind, className = '' }: { kind: 'mark' | 'wordmark' | 'logo'; className?: string }) {
  return (
    <span
      className={`brand-logo brand-logo--${kind} ${className}`}
      style={{ ['--logo-src' as string]: `url('${BRAND[kind]}')` }}
      aria-hidden="true"
    />
  );
}
