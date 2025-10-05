export interface ContextMenuStep {
  title: string;
  goal: string;
  assertions: string[];
}

export interface ContextMenuScenarioPlan {
  id: string;
  description: string;
  prerequisites: string[];
  steps: ContextMenuStep[];
  cleanup: string[];
}

export const contextMenuScenarioPlan: ContextMenuScenarioPlan = {
  id: 'content-context-menu-basic-flow',
  description:
    'Covers opening the content-script context menu, executing bookmark and copy actions, and verifying teardown during navigation.',
  prerequisites: [
    'Extension built with context sidebar enabled (`showSidebar = true`).',
    'Chat conversation with at least one assistant message present.'
  ],
  steps: [
    {
      title: 'Mount sidebar and open context menu',
      goal: 'Ensure the listener attaches and renders the overlay when using Shift+F10.',
      assertions: [
        'Shadow-root contains the `context-menu` overlay container.',
        'Menu items for bookmark, prompt, copy, pin, and dashboard are visible.'
      ]
    },
    {
      title: 'Bookmark flow integration',
      goal: 'Selecting the bookmark action should open the modal within the same shadow-root.',
      assertions: [
        'Bookmark modal appears with role description and default note field.',
        'Dexie bookmark entry is created with the selected message id.'
      ]
    },
    {
      title: 'Copy action feedback',
      goal: 'Copying message text shows a success toast.',
      assertions: [
        'Navigator clipboard receives the expected message snippet.',
        'Toast container renders the success message and auto-dismisses after timeout.'
      ]
    },
    {
      title: 'Escape closes menu',
      goal: 'Keyboard escape closes the overlay and returns focus to the document.',
      assertions: [
        'Overlay is removed from the DOM after pressing Escape.',
        'No residual focus trap remains in the shadow-root.'
      ]
    },
    {
      title: 'Domain switch cleanup',
      goal: 'Unmounting the sidebar removes the context menu listener and overlay.',
      assertions: [
        'Navigating to chat.openai.com from chatgpt.com leaves no overlay elements.',
        'No `contextmenu` listener remains attached (verified via evaluation in the page context).'
      ]
    }
  ],
  cleanup: [
    'Clear created bookmarks to restore baseline state.',
    'Reset clipboard contents if automation mutated it.'
  ]
};
