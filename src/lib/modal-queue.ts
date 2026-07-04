/**
 * modal-queue — lightweight global nag-modal coordinator.
 *
 * Ensures only one nag/informational modal is open at a time.
 * Modals call `acquireSlot()` before opening; if another modal
 * already holds the slot, they back off and retry after a
 * configurable interval.
 *
 * Usage:
 *   const { acquireSlot, releaseSlot } = useModalQueue();
 *   // In your effect:
 *   if (acquireSlot(myId)) setOpen(true);
 *   // On close:
 *   releaseSlot(myId); setOpen(false);
 */

// Module-level singleton — shared across all components in the same page.
let _activeId: string | null = null;

export function acquireSlot(id: string): boolean {
  if (_activeId === null) {
    _activeId = id;
    return true;
  }
  // Already occupied by someone else (or by us — idempotent)
  return _activeId === id;
}

export function releaseSlot(id: string): void {
  if (_activeId === id) _activeId = null;
}

export function isSlotFree(): boolean {
  return _activeId === null;
}
