import { create } from 'zustand'

interface SplitSlotState {
  /** Live DOM node each mounted split-pane panel currently occupies, by pane id. */
  slots: Record<string, HTMLDivElement>
  registerSlot: (paneId: string, el: HTMLDivElement | null) => void
}

/**
 * Where each terminal split pane is currently rendered on screen. The actual
 * <TerminalView> for a split pane lives in PersistentSplitTerminals and is
 * portaled into whichever slot is registered here (see SplitTerminalPanel),
 * so a pane's terminal survives its panel unmounting when its project isn't
 * the one on screen — the same "hidden, not unmounted" guarantee the main
 * Shells stack already has. The Termini panel reuses the store under its own
 * fixed key (see PersistentSidebarTerminals).
 */
export const useSplitSlots = create<SplitSlotState>((set) => ({
  slots: {},
  registerSlot: (paneId, el) =>
    set((s) => {
      if (el) return { slots: { ...s.slots, [paneId]: el } }
      if (!(paneId in s.slots)) return s
      const slots = { ...s.slots }
      delete slots[paneId]
      return { slots }
    })
}))
