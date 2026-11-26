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
};

let picker: ShareQualityPickerState | null = null;
let pickerOwner: object | null = null;
const pickerListeners = new Set<() => void>();

export function publishShareQualityPicker(
  owner: object,
  state: ShareQualityPickerState | null,
): void {
  if (state === null) {
    if (pickerOwner !== owner) return;
    picker = null;
    pickerOwner = null;
  } else {
    picker = state;
    pickerOwner = owner;
  }
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
  picker = null;
  pickerOwner = null;
}
