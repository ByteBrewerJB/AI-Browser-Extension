import type { ReactNode } from 'react';

interface SurfaceProps {
  as?: keyof HTMLElementTagNameMap;
  className?: string;
  children: ReactNode;
  role?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingClasses: Record<NonNullable<SurfaceProps['padding']>, string> = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6'
};

export function Surface({ as = 'section', className, children, role, padding = 'md' }: SurfaceProps) {
  const Element = as as keyof HTMLElementTagNameMap;
  const paddingClass = paddingClasses[padding] ?? paddingClasses.md;
  return (
    <Element className={className ?? `rounded-xl border border-slate-800 bg-slate-900/50 ${paddingClass}`} role={role}>
      {children}
    </Element>
  );
}
