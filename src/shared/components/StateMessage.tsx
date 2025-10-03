import type { ReactNode } from 'react';

export type StateMessageTone = 'neutral' | 'error';
export type StateMessageAlignment = 'start' | 'center';

export interface StateMessageProps {
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: StateMessageTone;
  align?: StateMessageAlignment;
  className?: string;
  icon?: ReactNode;
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

const toneStyles: Record<StateMessageTone, string> = {
  neutral: 'border-slate-800 bg-slate-900/60 text-slate-300',
  error: 'border-rose-700/60 bg-rose-900/40 text-rose-100'
};

const alignmentStyles: Record<StateMessageAlignment, string> = {
  start: 'items-start text-left',
  center: 'items-center text-center'
};

export function StateMessage({
  title,
  description,
  action,
  tone = 'neutral',
  align = 'center',
  className,
  icon
}: StateMessageProps) {
  return (
    <div
      className={classNames(
        'flex w-full flex-col gap-2 rounded-xl border px-6 py-10 shadow-inner shadow-slate-950/40',
        toneStyles[tone],
        alignmentStyles[align],
        className
      )}
      role={tone === 'error' ? 'alert' : undefined}
    >
      {icon ? <div className="text-2xl">{icon}</div> : null}
      <h3 className="text-sm font-medium text-inherit">{title}</h3>
      {description ? <p className="text-sm text-inherit/80">{description}</p> : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

export interface EmptyStateProps extends Omit<StateMessageProps, 'tone'> {}

export function EmptyState(props: EmptyStateProps) {
  return <StateMessage {...props} tone="neutral" />;
}

export interface ErrorStateProps extends Omit<StateMessageProps, 'tone'> {}

export function ErrorState(props: ErrorStateProps) {
  return <StateMessage {...props} tone="error" />;
}
