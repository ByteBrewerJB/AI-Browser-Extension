import { FormEvent, useEffect, useId, useMemo, useState } from 'react';
import type { ReactElement } from 'react';

import { Modal, ModalBody, ModalFooter, ModalHeader } from './Modal';

const ROOT_OPTION_ID = '__root__';

export interface MoveDialogOption {
  id: string;
  label: string;
  depth: number;
  favorite?: boolean;
}

export interface MoveDialogProps {
  open: boolean;
  title: string;
  description?: string;
  currentFolderId?: string;
  rootOptionLabel: string;
  confirmLabel: string;
  cancelLabel: string;
  folders: MoveDialogOption[];
  pending?: boolean;
  onMove: (folderId: string | undefined) => Promise<void> | void;
  onClose: () => void;
}

export function MoveDialog({
  open,
  title,
  description,
  currentFolderId,
  rootOptionLabel,
  confirmLabel,
  cancelLabel,
  folders,
  pending = false,
  onMove,
  onClose
}: MoveDialogProps): ReactElement | null {
  const headingId = useId();
  const descriptionId = description ? `${headingId}-description` : undefined;

  const options = useMemo<MoveDialogOption[]>(
    () => [
      { id: ROOT_OPTION_ID, label: rootOptionLabel, depth: 0 },
      ...folders
    ],
    [folders, rootOptionLabel]
  );

  const [selectedId, setSelectedId] = useState<string>(ROOT_OPTION_ID);

  useEffect(() => {
    if (!open) {
      return;
    }
    const fallbackId = options.find((option) => option.id === currentFolderId)?.id ?? ROOT_OPTION_ID;
    setSelectedId(currentFolderId ?? fallbackId);
  }, [open, currentFolderId, options]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const targetId = selectedId === ROOT_OPTION_ID ? undefined : selectedId;
    await onMove(targetId);
  };

  return (
    <Modal open={open} onClose={onClose} labelledBy={headingId} describedBy={descriptionId}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <ModalHeader className="space-y-2">
          <h3 id={headingId} className="text-lg font-semibold text-slate-100">
            {title}
          </h3>
          {description ? (
            <p id={descriptionId} className="text-sm text-slate-300">
              {description}
            </p>
          ) : null}
        </ModalHeader>
        <ModalBody className="space-y-3">
          <div className="space-y-2" role="radiogroup" aria-labelledby={headingId}>
            {options.map((option) => {
              const isSelected = option.id === selectedId;
              const padding = option.depth > 0 ? option.depth * 12 : 0;
              return (
                <button
                  type="button"
                  key={option.id}
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                    isSelected
                      ? 'border-emerald-400 bg-emerald-500/10 text-emerald-100'
                      : 'border-slate-700 bg-slate-900/60 text-slate-200 hover:border-emerald-400 hover:text-emerald-100'
                  }`}
                  aria-pressed={isSelected}
                  disabled={pending}
                  onClick={() => setSelectedId(option.id)}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2" style={{ paddingLeft: `${padding}px` }}>
                      <span className="truncate">{option.label}</span>
                      {option.favorite ? (
                        <span className="text-xs font-semibold uppercase tracking-wide text-amber-300">
                          Fav
                        </span>
                      ) : null}
                    </span>
                    {isSelected ? (
                      <span className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                        {pending ? '...' : 'Selected'}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </ModalBody>
        <ModalFooter className="flex justify-end gap-3">
          <button
            type="button"
            className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-emerald-400 hover:text-emerald-100"
            onClick={onClose}
            disabled={pending}
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 shadow-sm transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            disabled={pending}
          >
            {confirmLabel}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

