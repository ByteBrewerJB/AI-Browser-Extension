import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  labelledBy?: string;
  describedBy?: string;
  children: ReactNode;
  className?: string;
  container?: Element | null;
}

function ensureModalRoot(): HTMLElement {
  const existing = document.getElementById('ai-companion-modal-root');
  if (existing) {
    return existing;
  }
  const container = document.createElement('div');
  container.id = 'ai-companion-modal-root';
  container.setAttribute('data-ai-companion', 'modal-root');
  document.body.appendChild(container);
  return container;
}

export function Modal({ open, onClose, labelledBy, describedBy, children, className, container }: ModalProps) {
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof document.createElement !== 'function') {
    if (!open) {
      return null;
    }
    return (
      <div
        aria-hidden={!open}
        className="fixed inset-0 z-[2147483646] flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur"
        role="presentation"
      >
        <div
          aria-describedby={describedBy}
          aria-labelledby={labelledBy}
          aria-modal="true"
          className={
            className ??
            'w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900/95 p-6 text-slate-100 shadow-xl focus:outline-none'
          }
          role="dialog"
          tabIndex={-1}
        >
          {children}
        </div>
      </div>
    );
  }

  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    const timeout = window.setTimeout(() => {
      const focusable = contentRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusable?.focus();
    }, 10);

    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  const portalTarget = useMemo(() => {
    if (!open) {
      return null;
    }

    if (container) {
      return container;
    }

    return ensureModalRoot();
  }, [open, container]);

  if (!open || !portalTarget) {
    return null;
  }

  return createPortal(
    <div
      aria-hidden={!open}
      className="fixed inset-0 z-[2147483646] flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur"
      role="presentation"
      onClick={onClose}
    >
      <div
        aria-describedby={describedBy}
        aria-labelledby={labelledBy}
        aria-modal="true"
        className={
          className ??
          'w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900/95 p-6 text-slate-100 shadow-xl focus:outline-none'
        }
        onClick={(event) => event.stopPropagation()}
        ref={contentRef}
        role="dialog"
        tabIndex={-1}
      >
        {children}
      </div>
    </div>,
    portalTarget
  );
}

interface ModalSectionProps {
  children: ReactNode;
  className?: string;
}

export function ModalHeader({ children, className }: ModalSectionProps) {
  return (
    <header className={className ?? 'mb-4 space-y-1'}>
      {children}
    </header>
  );
}

export function ModalBody({ children, className }: ModalSectionProps) {
  return <div className={className ?? 'space-y-3'}>{children}</div>;
}

export function ModalFooter({ children, className }: ModalSectionProps) {
  return <footer className={className ?? 'mt-6 flex justify-end gap-3'}>{children}</footer>;
}
