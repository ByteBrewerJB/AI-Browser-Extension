import { useTranslation } from '@/shared/i18n/useTranslation';

import { MediaOverlay } from '@/ui/components/MediaOverlay';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/ui/components/Modal';

import { useMediaStore } from './mediaStore';

export function MediaSection() {
  const { t } = useTranslation();
  const {
    autoDownloadEnabled,
    advancedVoiceMode,
    selectedVoice,
    syncDraftsEnabled,
    previewOpen,
    modalOpen,
    setAutoDownloadEnabled,
    setAdvancedVoiceMode,
    setSelectedVoice,
    setSyncDraftsEnabled,
    setPreviewOpen,
    setModalOpen
  } = useMediaStore();

  return (
    <section className="space-y-6" aria-labelledby="media-heading">
      <header>
        <h2 id="media-heading" className="text-lg font-semibold text-emerald-300">
          {t('options.mediaHeading') ?? 'Audio & sync workspace'}
        </h2>
        <p className="text-sm text-slate-300">
          {t('options.mediaDescription') ?? 'Configure voice playback and cross-device capture defaults.'}
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <h3 className="text-base font-semibold text-emerald-200">{t('options.mediaVoiceHeading') ?? 'Voice controls'}</h3>
          <p className="text-xs text-slate-400">
            {t('options.mediaVoiceDescription') ??
              'Select a default narration voice and configure advanced capture behaviors.'}
          </p>
          <div className="mt-4 space-y-4">
            <label className="flex items-start gap-3">
              <input
                checked={autoDownloadEnabled}
                className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-400"
                onChange={(event) => setAutoDownloadEnabled(event.target.checked)}
                type="checkbox"
              />
              <span className="text-sm text-slate-200">
                {t('options.mediaAutoDownloadLabel') ?? 'Automatically download response audio when available'}
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input
                checked={advancedVoiceMode}
                className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-400"
                onChange={(event) => setAdvancedVoiceMode(event.target.checked)}
                type="checkbox"
              />
              <span className="text-sm text-slate-200">
                {t('options.mediaAdvancedVoiceLabel') ?? 'Enable advanced voice mode with layered prompts'}
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input
                checked={syncDraftsEnabled}
                className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-400"
                onChange={(event) => setSyncDraftsEnabled(event.target.checked)}
                type="checkbox"
              />
              <span className="text-sm text-slate-200">
                {t('options.mediaSyncLabel') ?? 'Synchronize voice presets across signed-in browsers'}
              </span>
            </label>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="voice-select">
                {t('options.mediaVoiceSelectLabel') ?? 'Default voice'}
              </label>
              <select
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
                id="voice-select"
                value={selectedVoice}
                onChange={(event) => setSelectedVoice(event.target.value)}
              >
                <option value="alloy">Alloy</option>
                <option value="verse">Verse</option>
                <option value="lumen">Lumen</option>
                <option value="sol">Sol</option>
              </select>
            </div>
            <button
              className="rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-950 shadow-sm"
              onClick={() => setPreviewOpen(true)}
              type="button"
            >
              {t('options.mediaPreviewButton') ?? 'Preview voice overlay'}
            </button>
            <button
              className="rounded-md border border-slate-700 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200"
              onClick={() => setModalOpen(true)}
              type="button"
            >
              {t('options.mediaModalTrigger') ?? 'Learn about modals'}
            </button>
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <h3 className="text-base font-semibold text-emerald-200">{t('options.mediaGuidanceHeading') ?? 'Accessibility & sync'}</h3>
          <ul className="mt-4 space-y-3 text-sm text-slate-200">
            <li>{t('options.mediaGuidanceKeyboard') ?? 'All controls remain keyboard accessible with focus outlines.'}</li>
            <li>{t('options.mediaGuidanceScreenReader') ?? 'Announcements mirror playback state for screen-readers.'}</li>
            <li>{t('options.mediaGuidanceRtl') ?? 'RTL layouts flip toolbar affordances automatically.'}</li>
            <li>{t('options.mediaGuidanceSync') ?? 'Voice preferences sync when signed into Chrome with storage permissions.'}</li>
          </ul>
        </div>
      </div>

      <MediaOverlay labelledBy="media-preview-heading" onClose={() => setPreviewOpen(false)} open={previewOpen}>
        <div className="flex flex-col gap-4 p-6 text-slate-100">
          <h3 id="media-preview-heading" className="text-lg font-semibold">
            {t('options.mediaPreviewTitle') ?? 'Voice preview'}
          </h3>
          <p className="text-sm text-slate-300">
            {t('options.mediaPreviewDescription') ?? 'Simulated playback overlay using the component library.'}
          </p>
          <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-4">
            <p className="text-xs uppercase tracking-wide text-emerald-300">{t('options.mediaPreviewActive') ?? 'Now playing'}</p>
            <p className="text-base font-semibold">{selectedVoice.toUpperCase()}</p>
            <p className="mt-2 text-sm text-slate-300">
              {t('options.mediaPreviewBody') ??
                '“Great news! Your AI workflow sync will complete shortly. Keep this tab open to finish the upload.”'}
            </p>
          </div>
          <div className="flex items-center justify-end gap-3">
            <button
              className="rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200"
              onClick={() => setPreviewOpen(false)}
              type="button"
            >
              {t('options.closeButton') ?? 'Close'}
            </button>
            <button
              className="rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-950 shadow-sm"
              onClick={() => setPreviewOpen(false)}
              type="button"
            >
              {t('options.mediaPreviewConfirm') ?? 'Sounds good'}
            </button>
          </div>
        </div>
      </MediaOverlay>

      <Modal labelledBy="media-modal-heading" onClose={() => setModalOpen(false)} open={modalOpen}>
        <ModalHeader className="space-y-1">
          <h3 id="media-modal-heading" className="text-lg font-semibold text-slate-100">
            {t('options.mediaModalHeading') ?? 'Preview voice overlay'}
          </h3>
          <p className="text-sm text-slate-300">
            {t('options.mediaModalDescription') ?? 'The overlay renders inside a shared shadow root to avoid style collisions.'}
          </p>
        </ModalHeader>
        <ModalBody>
          <p className="text-sm text-slate-200">
            {t('options.mediaModalBody') ??
              'This modal demonstrates how the shared component library keeps focus management and escape handling consistent.'}
          </p>
        </ModalBody>
        <ModalFooter>
          <button
            className="rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200"
            onClick={() => setModalOpen(false)}
            type="button"
          >
            {t('options.closeButton') ?? 'Close'}
          </button>
        </ModalFooter>
      </Modal>
    </section>
  );
}
