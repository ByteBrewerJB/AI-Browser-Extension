interface MutationObserverOptions {
  childList?: boolean;
  subtree?: boolean;
}

type MutationRecordLike = {
  type: 'childList';
  addedNodes: FakeElement[];
  removedNodes: FakeElement[];
};

class ObserverEntry {
  constructor(
    public readonly observer: FakeMutationObserver,
    public readonly target: FakeElement,
    public readonly options: MutationObserverOptions
  ) {}
}

const observerRegistry = new Set<ObserverEntry>();

export class FakeElement {
  readonly style: Record<string, string> = {};
  readonly children: FakeElement[] = [];
  parentNode: FakeElement | null = null;
  private attributes = new Map<string, string>();
  private text = '';
  private boundingRectWidth: number | null = null;

  constructor(public readonly ownerDocument: FakeDocument, public readonly tagName: string) {}

  appendChild(child: FakeElement) {
    if (child.parentNode) {
      child.parentNode.removeChild(child);
    }
    child.parentNode = this;
    this.children.push(child);
    this.ownerDocument.notifyMutation(this, {
      type: 'childList',
      addedNodes: [child],
      removedNodes: []
    });
    return child;
  }

  removeChild(child: FakeElement) {
    const index = this.children.indexOf(child);
    if (index === -1) {
      return child;
    }
    this.children.splice(index, 1);
    child.parentNode = null;
    this.ownerDocument.notifyMutation(this, {
      type: 'childList',
      addedNodes: [],
      removedNodes: [child]
    });
    return child;
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
    this.ownerDocument.unregisterElementId(this);
  }

  setAttribute(name: string, value: string) {
    if (name === 'id') {
      const previous = this.attributes.get(name);
      if (previous) {
        this.ownerDocument.unregisterId(previous);
      }
      this.ownerDocument.registerId(value, this);
    }
    this.attributes.set(name, value);
  }

  getAttribute(name: string) {
    return this.attributes.has(name) ? this.attributes.get(name)! : null;
  }

  hasAttribute(name: string) {
    return this.attributes.has(name);
  }

  removeAttribute(name: string) {
    if (name === 'id') {
      const previous = this.attributes.get(name);
      if (previous) {
        this.ownerDocument.unregisterId(previous);
      }
    }
    this.attributes.delete(name);
  }

  get id() {
    return this.attributes.get('id') ?? '';
  }

  set id(value: string) {
    this.setAttribute('id', value);
  }

  set textContent(value: string) {
    this.text = value;
    this.ownerDocument.notifyMutation(this, {
      type: 'childList',
      addedNodes: [],
      removedNodes: []
    });
  }

  get textContent(): string {
    if (this.children.length === 0) {
      return this.text;
    }
    return this.children.map((child) => child.textContent).join('');
  }

  get parentElement(): FakeElement | null {
    return this.parentNode;
  }

  setBoundingRectWidth(width: number) {
    this.boundingRectWidth = width;
  }

  getBoundingClientRect(): DOMRect {
    const width = this.boundingRectWidth ?? 0;
    return {
      width,
      height: 0,
      top: 0,
      left: 0,
      right: width,
      bottom: 0,
      x: 0,
      y: 0,
      toJSON() {
        return { width };
      }
    } as DOMRect;
  }

  matches(selector: string): boolean {
    if (selector.startsWith('#')) {
      return this.id === selector.slice(1);
    }
    if (selector.startsWith('[')) {
      const attributeMatch = selector.match(/^\[(.+?)(="(.+)")?\]$/);
      if (!attributeMatch) {
        return false;
      }
      const attributeName = attributeMatch[1];
      const attributeValue = attributeMatch[3];
      if (!this.hasAttribute(attributeName)) {
        return false;
      }
      if (attributeValue !== undefined) {
        return this.getAttribute(attributeName) === attributeValue;
      }
      return true;
    }
    return this.tagName.toLowerCase() === selector.toLowerCase();
  }

  querySelector(selector: string) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector: string) {
    const results: FakeElement[] = [];
    const traverse = (element: FakeElement) => {
      if (element.matches(selector)) {
        results.push(element);
      }
      for (const child of element.children) {
        traverse(child);
      }
    };

    for (const child of this.children) {
      traverse(child);
    }

    return results;
  }

  isDescendantOf(ancestor: FakeElement) {
    let current: FakeElement | null = this;
    while (current) {
      if (current === ancestor) {
        return true;
      }
      current = current.parentNode;
    }
    return false;
  }
}

export class FakeDocument {
  readonly body: FakeElement;
  readonly head: FakeElement;
  readonly documentElement: FakeElement;
  readyState: DocumentReadyState = 'complete';
  title = 'Test Document';
  defaultView: FakeWindow | null = null;

  private listeners = new Map<string, Set<(event: unknown) => void>>();
  private idMap = new Map<string, FakeElement>();

  constructor() {
    this.documentElement = new FakeElement(this, 'html');
    this.head = new FakeElement(this, 'head');
    this.body = new FakeElement(this, 'body');
    this.documentElement.appendChild(this.head);
    this.documentElement.appendChild(this.body);
  }

  createElement(tagName: string) {
    return new FakeElement(this, tagName);
  }

  querySelector(selector: string) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector: string) {
    const results: FakeElement[] = [];
    const traverse = (element: FakeElement) => {
      if (element.matches(selector)) {
        results.push(element);
      }
      for (const child of element.children) {
        traverse(child);
      }
    };
    traverse(this.documentElement);
    return results;
  }

  getElementById(id: string) {
    return this.idMap.get(id) ?? null;
  }

  registerId(id: string, element: FakeElement) {
    this.idMap.set(id, element);
  }

  unregisterId(id: string) {
    this.idMap.delete(id);
  }

  unregisterElementId(element: FakeElement) {
    if (element.id) {
      this.idMap.delete(element.id);
    }
  }

  addEventListener(type: string, listener: (event: unknown) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: (event: unknown) => void) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(type: string, event: unknown) {
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }

  notifyMutation(target: FakeElement, record: MutationRecordLike) {
    const records = [record] as unknown as MutationRecord[];
    for (const entry of observerRegistry) {
      if (entry.target === target || (entry.options.subtree && target.isDescendantOf(entry.target))) {
        entry.observer.callback(records, entry.observer);
      }
    }
  }
}

export class FakeMutationObserver {
  constructor(public readonly callback: MutationCallback) {}

  observe(target: Node, options: MutationObserverOptions = {}) {
    const fakeTarget = target as unknown as FakeElement;
    observerRegistry.add(new ObserverEntry(this, fakeTarget, options));
  }

  disconnect() {
    for (const entry of [...observerRegistry]) {
      if (entry.observer === this) {
        observerRegistry.delete(entry);
      }
    }
  }

  takeRecords(): MutationRecord[] {
    return [];
  }
}

export class FakeHistory {
  constructor(private readonly window: FakeWindow) {}

  private updatePath(url: string | URL | null | undefined) {
    if (!url) {
      return;
    }
    const resolved = typeof url === 'string' ? new URL(url, 'https://example.com') : url;
    this.window.location.pathname = resolved.pathname;
  }

  pushState(_state: unknown, _title: string, url?: string | URL | null) {
    this.updatePath(url ?? undefined);
  }

  replaceState(_state: unknown, _title: string, url?: string | URL | null) {
    this.updatePath(url ?? undefined);
  }
}

export class FakeLocation {
  href = 'https://example.com/';
  pathname = '/';
}

export class FakeWindow {
  readonly location = new FakeLocation();
  readonly history = new FakeHistory(this);

  constructor(public readonly document: FakeDocument) {}

  setTimeout(handler: (...args: any[]) => void, timeout?: number, ...args: any[]) {
    return setTimeout(handler, timeout, ...args);
  }

  clearTimeout(handle?: number | NodeJS.Timeout) {
    clearTimeout(handle);
  }

  setInterval(handler: (...args: any[]) => void, timeout?: number, ...args: any[]) {
    return setInterval(handler, timeout, ...args);
  }

  clearInterval(handle?: number | NodeJS.Timeout) {
    clearInterval(handle);
  }

  addEventListener() {
    // no-op for tests
  }
}

export function setupDomEnvironment() {
  const document = new FakeDocument();
  const window = new FakeWindow(document);
  document.defaultView = window;

  (globalThis as any).window = window;
  (globalThis as any).document = document;
  (globalThis as any).MutationObserver = FakeMutationObserver;

  return {
    window,
    document,
    cleanup() {
      delete (globalThis as any).window;
      delete (globalThis as any).document;
      delete (globalThis as any).MutationObserver;
      observerRegistry.clear();
    }
  };
}
