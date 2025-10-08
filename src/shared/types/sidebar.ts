export const SIDEBAR_SECTIONS = [
  { id: 'history.pinned', bubble: 'history' },
  { id: 'history.recent', bubble: 'history' },
  { id: 'history.bookmarks', bubble: 'history' },
  { id: 'prompts.library', bubble: 'prompts' },
  { id: 'media.overview', bubble: 'media' }
] as const;

type SectionDefinition = (typeof SIDEBAR_SECTIONS)[number];

export type SidebarSectionId = SectionDefinition['id'];

export type SidebarBubbleId = SectionDefinition['bubble'];

const SECTION_IDS = new Set<SidebarSectionId>(SIDEBAR_SECTIONS.map((section) => section.id));

export function isSidebarSectionId(value: unknown): value is SidebarSectionId {
  return typeof value === 'string' && SECTION_IDS.has(value as SidebarSectionId);
}

export function getSidebarSectionDefinitions(): SectionDefinition[] {
  return SIDEBAR_SECTIONS.map((section) => ({ ...section }));
}
