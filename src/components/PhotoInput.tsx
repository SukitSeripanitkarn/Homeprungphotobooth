import { useRef, type ReactNode } from 'react';

interface Props {
  onFile: (file: File) => void;
  className?: string;
  children: ReactNode;
  /** Ask mobile browsers to open the camera directly. */
  capture?: boolean;
  disabled?: boolean;
}

/** A button that opens the OS photo picker (camera roll or camera on mobile). */
export function PhotoInput({ onFile, className, children, capture, disabled }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className={className} onClick={() => ref.current?.click()} disabled={disabled}>
        {children}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        {...(capture ? { capture: 'user' as const } : {})}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ''; // allow picking the same file again
          if (file) onFile(file);
        }}
      />
    </>
  );
}
