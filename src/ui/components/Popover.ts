export interface PopoverShortcutConfig {
  id: string;
  key: string;
}

export interface PopoverOptions {
  shortcuts: PopoverShortcutConfig[];
  onDismiss: (event: MouseEvent) => void;
  rootClassName?: string;
  cardClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  listClassName?: string;
  itemClassName?: string;
  keyClassName?: string;
  labelClassName?: string;
  dismissButtonClassName?: string;
}

export interface PopoverInstance {
  root: HTMLDivElement;
  card: HTMLDivElement;
  title: HTMLHeadingElement;
  subtitle: HTMLParagraphElement;
  list: HTMLUListElement;
  itemLabels: Map<string, HTMLParagraphElement>;
  dismissButton: HTMLButtonElement;
}

export function createPopover({
  shortcuts,
  onDismiss,
  rootClassName,
  cardClassName,
  titleClassName,
  subtitleClassName,
  listClassName,
  itemClassName,
  keyClassName,
  labelClassName,
  dismissButtonClassName
}: PopoverOptions): PopoverInstance {
  const root = document.createElement('div');
  if (rootClassName) {
    root.className = rootClassName;
  }

  const card = document.createElement('div');
  if (cardClassName) {
    card.className = cardClassName;
  }
  root.appendChild(card);

  const title = document.createElement('h3');
  if (titleClassName) {
    title.className = titleClassName;
  }
  card.appendChild(title);

  const subtitle = document.createElement('p');
  if (subtitleClassName) {
    subtitle.className = subtitleClassName;
  }
  card.appendChild(subtitle);

  const list = document.createElement('ul');
  if (listClassName) {
    list.className = listClassName;
  }
  card.appendChild(list);

  const itemLabels = new Map<string, HTMLParagraphElement>();

  for (const shortcut of shortcuts) {
    const item = document.createElement('li');
    if (itemClassName) {
      item.className = itemClassName;
    }
    list.appendChild(item);

    const key = document.createElement('span');
    if (keyClassName) {
      key.className = keyClassName;
    }
    key.textContent = shortcut.key;
    item.appendChild(key);

    const label = document.createElement('p');
    if (labelClassName) {
      label.className = labelClassName;
    }
    item.appendChild(label);
    itemLabels.set(shortcut.id, label);
  }

  const dismissButton = document.createElement('button');
  dismissButton.type = 'button';
  if (dismissButtonClassName) {
    dismissButton.className = dismissButtonClassName;
  }
  if (typeof dismissButton.addEventListener === 'function') {
    dismissButton.addEventListener('click', onDismiss);
  } else {
    (dismissButton as unknown as { onclick?: (event: MouseEvent) => void }).onclick = onDismiss;
  }
  card.appendChild(dismissButton);

  return {
    root,
    card,
    title,
    subtitle,
    list,
    itemLabels,
    dismissButton
  };
}
