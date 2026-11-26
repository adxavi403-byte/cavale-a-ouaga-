import { getLevelConfig } from './types';

export interface CustomSongMeta {
  id: string;
  name: string;
  sizeBytes: number;
  addedAt: number;
}

export interface EffectiveSongInfo {
  label: string;
  isCustom: boolean;
  isOverridden: boolean;
  assignment: string | null;
}

const META_STORAGE_KEY = 'cavale_ouaga_custom_songs_meta_v1';
const LEVEL_MAP_STORAGE_KEY = 'cavale_ouaga_level_songs_v1';
const DB_NAME = 'cavale_ouaga_music_db';
const DB_VERSION = 1;
const STORE_NAME = 'songs';

const memoryBlobs = new Map<string, Blob>();
const objectUrlCache = new Map<string, string>();

const MIME_BY_EXT: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/opus',
  flac: 'audio/flac',
  webm: 'audio/webm',
  '3gp': 'audio/3gpp',
};

function inferAudioMimeType(file: File): string {
  if (file.type && file.type.startsWith('audio/')) {
    return file.type;
  }
  const extMatch = /\.([a-z0-9]+)$/i.exec(file.name);
  const ext = extMatch ? extMatch[1].toLowerCase() : '';
  return MIME_BY_EXT[ext] || file.type || 'audio/mpeg';
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '').trim() || filename;
}

function openMusicDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export function listCustomSongs(): CustomSongMeta[] {
  try {
    const raw = localStorage.getItem(META_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is CustomSongMeta =>
        item && typeof item.id === 'string' && typeof item.name === 'string'
    );
  } catch {
    return [];
  }
}

function saveCustomSongsMeta(items: CustomSongMeta[]): void {
  try {
    localStorage.setItem(META_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore storage errors
  }
}

export async function saveCustomSongFile(file: File): Promise<CustomSongMeta> {
  const id = `song_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const mimeType = inferAudioMimeType(file);
  const buffer = await file.arrayBuffer();
  const ownedBlob = new Blob([buffer], { type: mimeType });

  const meta: CustomSongMeta = {
    id,
    name: stripExtension(file.name),
    sizeBytes: ownedBlob.size || file.size,
    addedAt: Date.now(),
  };

  memoryBlobs.set(id, ownedBlob);
  const url = URL.createObjectURL(ownedBlob);
  objectUrlCache.set(id, url);

  const db = await openMusicDb();
  if (db) {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put({ id, buffer, mimeType });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  const nextList = [meta, ...listCustomSongs()];
  saveCustomSongsMeta(nextList);
  return meta;
}

export function getCachedCustomSongUrl(songId: string): string | null {
  const cachedUrl = objectUrlCache.get(songId);
  if (cachedUrl) return cachedUrl;

  const memBlob = memoryBlobs.get(songId);
  if (memBlob) {
    const url = URL.createObjectURL(memBlob);
    objectUrlCache.set(songId, url);
    return url;
  }
  return null;
}

export async function getCustomSongUrl(songId: string): Promise<string | null> {
  const syncUrl = getCachedCustomSongUrl(songId);
  if (syncUrl) return syncUrl;

  const db = await openMusicDb();
  if (!db) return null;

  const blob = await new Promise<Blob | null>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(songId);
      req.onsuccess = () => {
        const record = req.result as
          | { id: string; buffer?: ArrayBuffer; mimeType?: string; blob?: Blob }
          | undefined;
        if (!record) {
          resolve(null);
          return;
        }
        if (record.buffer instanceof ArrayBuffer) {
          resolve(new Blob([record.buffer], { type: record.mimeType || 'audio/mpeg' }));
          return;
        }
        if (record.blob) {
          const typed =
            record.blob.type && record.blob.type.startsWith('audio/')
              ? record.blob
              : new Blob([record.blob], { type: record.mimeType || 'audio/mpeg' });
          resolve(typed);
          return;
        }
        resolve(null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  if (!blob) return null;
  memoryBlobs.set(songId, blob);
  const url = URL.createObjectURL(blob);
  objectUrlCache.set(songId, url);
  return url;
}

export async function preloadCustomSongs(songIds: string[]): Promise<void> {
  const uniqueIds = Array.from(new Set(songIds.filter(Boolean)));
  for (const id of uniqueIds) {
    if (!getCachedCustomSongUrl(id)) {
      await getCustomSongUrl(id);
    }
  }
}

export async function deleteCustomSong(songId: string): Promise<void> {
  const cachedUrl = objectUrlCache.get(songId);
  if (cachedUrl) {
    URL.revokeObjectURL(cachedUrl);
    objectUrlCache.delete(songId);
  }
  memoryBlobs.delete(songId);

  const nextList = listCustomSongs().filter((s) => s.id !== songId);
  saveCustomSongsMeta(nextList);

  const map = getLevelSongMap();
  const targetVal = `custom:${songId}`;
  let changed = false;
  for (const key of Object.keys(map)) {
    const lvl = Number(key);
    if (map[lvl] === targetVal) {
      delete map[lvl];
      changed = true;
    }
  }
  if (changed) {
    saveLevelSongMap(map);
  }

  const db = await openMusicDb();
  if (db) {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(songId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
}

export function getLevelSongMap(): Record<number, string> {
  try {
    const raw = localStorage.getItem(LEVEL_MAP_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const clean: Record<number, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const lvl = Math.floor(Number(k));
      if (lvl >= 1 && typeof v === 'string' && v.length > 0) {
        clean[lvl] = v;
      }
    }
    return clean;
  } catch {
    return {};
  }
}

function saveLevelSongMap(map: Record<number, string>): void {
  try {
    localStorage.setItem(LEVEL_MAP_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

export function setLevelSongAssignment(
  level: number,
  assignment: string | null
): Record<number, string> {
  const safeLevel = Math.max(1, Math.floor(level));
  const map = getLevelSongMap();
  if (!assignment) {
    delete map[safeLevel];
  } else {
    map[safeLevel] = assignment;
  }
  saveLevelSongMap(map);
  return map;
}

export function clearAllLevelSongAssignments(): Record<number, string> {
  const empty: Record<number, string> = {};
  saveLevelSongMap(empty);
  return empty;
}

export function resolveEffectiveSongInfo(
  level: number,
  map: Record<number, string> = getLevelSongMap(),
  customSongs: CustomSongMeta[] = listCustomSongs()
): EffectiveSongInfo {
  const safeLevel = Math.max(1, Math.floor(level));
  const assignment = map[safeLevel] ?? null;
  const defaultTitle = getLevelConfig(safeLevel).quartier.soundTitle;

  if (!assignment) {
    return {
      label: defaultTitle,
      isCustom: false,
      isOverridden: false,
      assignment: null,
    };
  }

  if (assignment.startsWith('custom:')) {
    const songId = assignment.slice('custom:'.length);
    const found = customSongs.find((s) => s.id === songId);
    if (found) {
      return {
        label: found.name,
        isCustom: true,
        isOverridden: true,
        assignment,
      };
    }
  }

  if (assignment.startsWith('builtin:')) {
    const trackLvl = Math.max(1, Math.floor(Number(assignment.slice('builtin:'.length)) || 1));
    const trackCfg = getLevelConfig(trackLvl);
    return {
      label: trackCfg.quartier.soundTitle,
      isCustom: false,
      isOverridden: trackLvl !== safeLevel,
      assignment,
    };
  }

  return {
    label: defaultTitle,
    isCustom: false,
    isOverridden: false,
    assignment: null,
  };
}
