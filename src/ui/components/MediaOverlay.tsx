import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

interface MediaOverlayProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
}

export function MediaOverlay({ open, onClose, children, labelledBy }: MediaOverlayProps) {
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof document.createElement !== 'function') {
    if (!open) {
      return null;
    }
    return (
      <div
        aria-labelledby={labelledBy}
        className="fixed inset-0 z-[2147483645] flex items-center justify-center bg-slate-950/80 p-6"
        role="presentation"
      >
        <div className="relative w-full max-w-2xl overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
          {children}
        </div>
      </div>
    );
  }

  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      aria-labelledby={labelledBy}
      className="fixed inset-0 z-[2147483645] flex items-center justify-center bg-slate-950/80 p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        ref={containerRef}
      >
        {children}
      </div>
    </div>
  );
}
