"use client";

import type { SettingsState } from "@/types/medintel";

type StoredSettingsRecord = {
  version: 1;
  user: string;
  updatedAt: string;
  settings: SettingsState;
};

const STORAGE_PREFIX = "medintel:settings:";

function getSettingsStorageKey(username?: string | null) {
  const normalized = username?.trim().toLowerCase();
  return normalized ? `${STORAGE_PREFIX}${normalized}` : null;
}

function isStoredSettingsRecord(value: unknown): value is StoredSettingsRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Partial<StoredSettingsRecord>;
  return record.version === 1 && typeof record.user === "string" && typeof record.updatedAt === "string" && typeof record.settings === "object";
}

export function readStoredSettingsRecord(username?: string | null): StoredSettingsRecord | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storageKey = getSettingsStorageKey(username);
  if (!storageKey) {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as unknown;
    if (!isStoredSettingsRecord(parsed)) {
      window.localStorage.removeItem(storageKey);
      return null;
    }

    return parsed;
  } catch {
    window.localStorage.removeItem(storageKey);
    return null;
  }
}

export function writeStoredSettingsRecord(username: string | null | undefined, settings: SettingsState): StoredSettingsRecord | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storageKey = getSettingsStorageKey(username);
  const normalizedUser = username?.trim();
  if (!storageKey || !normalizedUser) {
    return null;
  }

  const nextRecord: StoredSettingsRecord = {
    version: 1,
    user: normalizedUser,
    updatedAt: new Date().toISOString(),
    settings,
  };

  window.localStorage.setItem(storageKey, JSON.stringify(nextRecord));
  return nextRecord;
}
