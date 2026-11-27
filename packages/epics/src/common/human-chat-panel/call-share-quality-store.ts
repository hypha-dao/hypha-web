'use client';

import { useSyncExternalStore } from 'react';

import type {
  CallShareQualityOption,
  PublishedShareLayer,
} from './call-share-quality-options';

/**
 * Bridges the remote share tile (which knows the layers and the tile size) and the call toolbar
 * (which shows the receive-quality picker, #2742). Module-level so the Document PiP window, which
 * renders in another document but the same JS realm, sees the same state.
 */

// ---- Viewer choice per share (publication sid) ----

const choiceBySid = new Map<string, PublishedShareLayer>();
const choiceListeners = new Set<() => void>();
let choiceVersion = 0;

export function getShareQualityChoice(
  shareKey: string | undefined,
): PublishedShareLayer | undefined {
  return shareKey ? choiceBySid.get(shareKey) : undefined;
}

export function setShareQualityChoice(
  shareKey: string,
  layer: PublishedShareLayer | undefined,
): void {
  if (layer) choiceBySid.set(shareKey, layer);
  else choiceBySid.delete(shareKey);
  choiceVersion += 1;
  for (const l of choiceListeners) l();
}

function subscribeChoice(listener: () => void) {
  choiceListeners.add(listener);
  return () => {
    choiceListeners.delete(listener);
  };
}

/** Re-renders when any share's choice changes. */
export function useShareQualityChoiceVersion(): number {
  return useSyncExternalStore(
    subscribeChoice,
    () => choiceVersion,
    () => 0,
  );
}

// ---- Picker published by the active remote share tile ----

export type ShareQualityPickerState = {
  shareKey: string;
  options: CallShareQualityOption[];
  selectedId: string;
  select: (option: CallShareQualityOption) => void;
  /** Width the tile asks for; the toolbar follows the largest tile showing a share. */
  tileWidth?: number;
};

/**
 * Every tile showing a remote share publishes its picker (full view, dock, a small tile of the same
 * share). The toolbar shows the largest one, so a small tile cannot make the menu say "enlarge"
 * while the share is open in full; ties go to the most recent.
 */
const pickersByOwner = new Map<object, ShareQualityPickerState>();
let picker: ShareQualityPickerState | null = null;
const pickerListeners = new Set<() => void>();

function pickLargest(): ShareQualityPickerState | null {
  let best: ShareQualityPickerState | null = null;
  for (const state of pickersByOwner.values()) {
    if (!best || (state.tileWidth ?? 0) >= (best.tileWidth ?? 0)) best = state;
  }
  return best;
}

export function publishShareQualityPicker(
  owner: object,
  state: ShareQualityPickerState | null,
): void {
  if (state === null) {
    if (!pickersByOwner.delete(owner)) return;
  } else {
    // Re-insert so the latest publish counts as the most recent on a tie.
    pickersByOwner.delete(owner);
    pickersByOwner.set(owner, state);
  }
  const next = pickLargest();
  if (next === picker) return;
  picker = next;
  for (const l of pickerListeners) l();
}

function subscribePicker(listener: () => void) {
  pickerListeners.add(listener);
  return () => {
    pickerListeners.delete(listener);
  };
}

export function getShareQualityPicker(): ShareQualityPickerState | null {
  return picker;
}

export function useShareQualityPicker(): ShareQualityPickerState | null {
  return useSyncExternalStore(
    subscribePicker,
    getShareQualityPicker,
    () => null,
  );
}

/** Test helper. */
export function resetShareQualityStoreForTests(): void {
  choiceBySid.clear();
  choiceVersion = 0;
  pickersByOwner.clear();
  picker = null;
}
