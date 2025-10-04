import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

type Orientation = 'horizontal' | 'vertical';

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (value: string) => void;
  orientation: Orientation;
}

const TabsContext = createContext<TabsContextValue | null>(null);

interface TabsProps {
  defaultValue?: string;
  onChange?: (value: string) => void;
  orientation?: Orientation;
  children: ReactNode;
}

export function Tabs({ defaultValue, onChange, orientation = 'horizontal', children }: TabsProps) {
  const [activeTab, setActiveTabState] = useState(defaultValue ?? 'tab-0');

  const setActiveTab = (value: string) => {
    setActiveTabState(value);
    onChange?.(value);
  };

  const contextValue = useMemo(() => ({ activeTab, setActiveTab, orientation }), [activeTab, orientation]);

  return <TabsContext.Provider value={contextValue}>{children}</TabsContext.Provider>;
}

function useTabsContext(component: string): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error(`${component} must be used within <Tabs>`);
  }
  return context;
}

interface TabListProps {
  labelledBy?: string;
  children: ReactNode;
  className?: string;
}

export function TabList({ labelledBy, children, className }: TabListProps) {
  const { orientation } = useTabsContext('TabList');
  return (
    <div
      aria-labelledby={labelledBy}
      className={className ?? 'flex gap-2 border-b border-slate-800'}
      role="tablist"
      aria-orientation={orientation}
    >
      {children}
    </div>
  );
}

interface TabProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function Tab({ value, children, className }: TabProps) {
  const { activeTab, setActiveTab } = useTabsContext('Tab');
  const sanitized = useMemo(() => value.replace(/[^a-z0-9_-]/gi, '_'), [value]);
  const tabId = `tab-${sanitized}`;
  const panelId = `panel-${sanitized}`;
  const selected = activeTab === value;

  return (
    <button
      aria-controls={panelId}
      aria-selected={selected}
      className={
        className ??
        `rounded-t-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 ${
          selected ? 'bg-slate-800 text-emerald-200' : 'bg-transparent text-slate-400 hover:text-slate-200'
        }`
      }
      id={tabId}
      onClick={() => setActiveTab(value)}
      role="tab"
      tabIndex={selected ? 0 : -1}
      type="button"
    >
      {children}
    </button>
  );
}

interface TabPanelsProps {
  children: ReactNode;
  className?: string;
}

export function TabPanels({ children, className }: TabPanelsProps) {
  return <div className={className ?? 'rounded-b-md border border-slate-800 p-4'}>{children}</div>;
}

interface TabPanelProps {
  value: string;
  labelledBy?: string;
  children: ReactNode;
  className?: string;
}

export function TabPanel({ value, labelledBy, children, className }: TabPanelProps) {
  const { activeTab } = useTabsContext('TabPanel');
  const sanitized = useMemo(() => value.replace(/[^a-z0-9_-]/gi, '_'), [value]);
  const tabId = `tab-${sanitized}`;
  const panelId = `panel-${sanitized}`;

  if (activeTab !== value) {
    return null;
  }

  return (
    <div
      aria-labelledby={labelledBy ?? tabId}
      className={className ?? 'space-y-4'}
      id={panelId}
      role="tabpanel"
      tabIndex={0}
    >
      {children}
    </div>
  );
}
