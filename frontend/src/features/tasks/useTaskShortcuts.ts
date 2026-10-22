import { useEffect, type RefObject } from 'react';

export function useTaskShortcuts({
  enabled,
  canEdit,
  busy,
  listRef,
  searchRef,
  onCreate,
  onHelp,
  onToggle,
  onLeaveSearch,
}: {
  enabled: boolean;
  canEdit: boolean;
  busy: boolean;
  listRef: RefObject<HTMLUListElement | null>;
  searchRef: RefObject<HTMLInputElement | null>;
  onCreate: () => void;
  onHelp: () => void;
  onToggle: (id: string) => void;
  onLeaveSearch: () => void;
}) {
  useEffect(() => {
    if (!enabled) return;
    function handleKey(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.isComposing ||
        document.querySelector(
          'dialog[open], [role="dialog"][aria-modal="true"]',
        )
      )
        return;
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const buttons = [
        ...(listRef.current?.querySelectorAll<HTMLButtonElement>(
          '[data-open-task]',
        ) || []),
      ];
      // Escape leaves search without deleting the query, so navigation can resume.
      if (target === searchRef.current && event.key === 'Escape') {
        event.preventDefault();
        onLeaveSearch();
        return;
      }
      if (
        target.isContentEditable ||
        target.closest(
          'input, textarea, select, [role="textbox"], [role="combobox"]',
        )
      )
        return;
      const navigation = [
        'j',
        'k',
        'ArrowDown',
        'ArrowUp',
        'Home',
        'End',
      ].includes(event.key);
      // Holding navigation moves through rows; holding an action never repeats it.
      if (event.repeat && !navigation) return;
      if (event.key === 'a' && canEdit) {
        event.preventDefault();
        onCreate();
        return;
      }
      if (event.key === '/') {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (event.key === '?') {
        event.preventDefault();
        onHelp();
        return;
      }
      const row = target.closest('[data-task-row]');
      const index = buttons.findIndex(
        (button) => button.closest('[data-task-row]') === row,
      );
      if (navigation && buttons.length) {
        event.preventDefault();
        const backwards = ['k', 'ArrowUp', 'End'].includes(event.key);
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? buttons.length - 1
              : index < 0
                ? backwards
                  ? buttons.length - 1
                  : 0
                : Math.max(
                    0,
                    Math.min(buttons.length - 1, index + (backwards ? -1 : 1)),
                  );
        buttons[next]?.focus();
        return;
      }
      if (index < 0) return;
      if (event.key === 'l') {
        event.preventDefault();
        buttons[index]?.click();
      }
      if (event.key === 'x' && canEdit && !busy) {
        const id = buttons[index]?.dataset.openTask;
        if (id) {
          event.preventDefault();
          onToggle(id);
        }
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [
    enabled,
    canEdit,
    busy,
    listRef,
    searchRef,
    onCreate,
    onHelp,
    onToggle,
    onLeaveSearch,
  ]);
}
