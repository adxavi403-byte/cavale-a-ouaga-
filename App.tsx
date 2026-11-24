import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  ArrowUp,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  CloudRain,
  Coins,
  CupSoda,
  Flag,
  GraduationCap,
  Magnet,
  Map as MapIcon,
  MapPin,
  Maximize2,
  Medal,
  Minimize2,
  Music,
  Pause,
  Play,
  RotateCcw,
  Shield,
  ShoppingCart,
  Siren,
  SlidersHorizontal,
  Sun,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  Wallet,
  Wifi,
  Wind,
  X,
  Zap,
} from 'lucide-react';
import { AchievementsModal } from './components/AchievementsModal';
import { DailyChallengesModal } from './components/DailyChallengesModal';
import { GameCanvas, GameCanvasHandle } from './components/GameCanvas';
import { LeaderboardModal } from './components/LeaderboardModal';
import { MapModal, OptionsModal, QuartiersModal } from './components/MenuModals';
import { MultiplayerModal } from './components/MultiplayerModal';
import { MusicSelectorModal } from './components/MusicSelectorModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PWAInstallButton } from './components/PWAInstallButton';
import { ShopModal } from './components/ShopModal';
import { TutorialActionType, TutorialOverlay } from './components/TutorialOverlay';
import { useMultiplayerClient } from './game/multiplayerClient';
import type { MultiplayerRoomSnapshot } from './game/multiplayerTypes';
import {
  ACHIEVEMENTS,
  collectNewlyUnlockedIds,
  evaluateAchievements,
  getAchievementById,
} from './game/achievements';
import { ensureTodayDailyState, evaluateDailyChallenges } from './game/dailyChallenges';
import {
  buildLegacyLeaderboardSeed,
  recordRunToLeaderboard,
  sanitizeLeaderboardEntries,
} from './game/leaderboard';
import {
  clearAllLevelSongAssignments,
  CustomSongMeta,
  deleteCustomSong,
  getLevelSongMap,
  listCustomSongs,
  resolveEffectiveSongInfo,
  saveCustomSongFile,
  setLevelSongAssignment,
} from './game/musicStorage';
import {
  CharacterId,
  getCharacterById,
  getJuiceById,
  getOutfitById,
  getProtectionById,
  JuiceId,
  OutfitId,
  ProtectionId,
  SHOP_CHARACTERS,
  SHOP_JUICES,
  SHOP_OUTFITS,
  SHOP_PROTECTIONS,
  ShopJuice,
  ShopProtection,
} from './game/shop';
import { soundEngine } from './game/sound';
import {
  GameState,
  getLevelConfig,
  getWeatherMeta,
  HudSnapshot,
  OUAGA_QUARTIERS,
  SavedProgress,
  WeatherKind,
} from './game/types';

const STORAGE_KEY = 'cavale_ouaga_progress_v2';
const LEGACY_STORAGE_KEY = 'cavale_ouaga_progress_v1';

const INITIAL_HUD: HudSnapshot = {
  score: 0,
  distanceMeters: 0,
  worldScroll: 0,
  lootCfa: 0,
  coinsCollected: 0,
  policeDanger: 28,
  combo: 1,
  hasShield: false,
  shieldCharges: 0,
  turboRemaining: 0,
  magnetRemaining: 0,
  speedKmh: 31,
  arrestReason: '',
  level: 1,
  quartierName: OUAGA_QUARTIERS[0].name,
  quartierZone: OUAGA_QUARTIERS[0].zone,
  soundTitle: OUAGA_QUARTIERS[0].soundTitle,
  weather: OUAGA_QUARTIERS[0].weather,
  weatherLabel: getWeatherMeta(OUAGA_QUARTIERS[0].weather).label,
  weatherIntensity: 0.55,
  visibilityPercent: 72,
  levelProgress: 0,
  levelMetersDone: 0,
  levelMetersTotal: getLevelConfig(1).lengthMeters,
  multiplier: 1,
  bannerText: '',
  flashText: '',
  jumpsCount: 0,
  slidesCount: 0,
};

const VALID_OUTFIT_IDS = new Set<string>(SHOP_OUTFITS.map((o) => o.id));
const VALID_CHARACTER_IDS = new Set<string>(SHOP_CHARACTERS.map((c) => c.id));
const VALID_JUICE_IDS = new Set<string>(SHOP_JUICES.map((j) => j.id));
const VALID_PROTECTION_IDS = new Set<string>(SHOP_PROTECTIONS.map((p) => p.id));

function sanitizeInventory<T extends string>(
  raw: unknown,
  validIds: Set<string>
): Partial<Record<T, number>> {
  const out: Partial<Record<T, number>> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (validIds.has(key) && typeof val === 'number' && Number.isFinite(val) && val > 0) {
      out[key as T] = Math.floor(val);
    }
  }
  return out;
}

function getTotalInventoryCount(inv?: Partial<Record<string, number>>): number {
  if (!inv) return 0;
  let total = 0;
  for (const v of Object.values(inv)) {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
      total += Math.floor(v);
    }
  }
  return total;
}

function pickPreferredConsumable<T extends { id: string }>(
  catalog: T[],
  inv: Partial<Record<string, number>> | undefined,
  preferredId?: string
): T | null {
  if (!inv) return null;
  if (preferredId) {
    const preferredCount = inv[preferredId] ?? 0;
    if (preferredCount > 0) {
      const found = catalog.find((item) => item.id === preferredId);
      if (found) return found;
    }
  }
  for (let i = catalog.length - 1; i >= 0; i--) {
    const item = catalog[i];
    if ((inv[item.id] ?? 0) > 0) return item;
  }
  return null;
}

function loadProgress(): SavedProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SavedProgress>;
      const totalLootCfa = Number(parsed.totalLootCfa) || 0;
      const unlockedOutfits: OutfitId[] = Array.isArray(parsed.unlockedOutfits)
        ? Array.from(
            new Set<OutfitId>([
              'base',
              ...parsed.unlockedOutfits.filter((id): id is OutfitId =>
                VALID_OUTFIT_IDS.has(id)
              ),
            ])
          )
        : ['base'];

      const equippedOutfit: OutfitId =
        typeof parsed.equippedOutfit === 'string' &&
        unlockedOutfits.includes(parsed.equippedOutfit as OutfitId)
          ? (parsed.equippedOutfit as OutfitId)
          : 'base';

      const unlockedCharacters: CharacterId[] = Array.isArray(parsed.unlockedCharacters)
        ? Array.from(
            new Set<CharacterId>([
              'didi',
              ...parsed.unlockedCharacters.filter((id): id is CharacterId =>
                VALID_CHARACTER_IDS.has(id)
              ),
            ])
          )
        : ['didi'];

      const equippedCharacter: CharacterId =
        typeof parsed.equippedCharacter === 'string' &&
        unlockedCharacters.includes(parsed.equippedCharacter as CharacterId)
          ? (parsed.equippedCharacter as CharacterId)
          : 'didi';

      const shopCoins =
        typeof parsed.shopCoins === 'number' && Number.isFinite(parsed.shopCoins)
          ? Math.max(0, Math.floor(parsed.shopCoins))
          : Math.floor(totalLootCfa / 2);

      const bestScore = Number(parsed.bestScore) || 0;
      const bestDistance = Number(parsed.bestDistance) || 0;
      const bestLevel = Math.max(1, Number(parsed.bestLevel) || 1);
      const localLeaderboard = Array.isArray(parsed.localLeaderboard)
        ? sanitizeLeaderboardEntries(parsed.localLeaderboard)
        : buildLegacyLeaderboardSeed({
            bestScore,
            bestDistance,
            bestLevel,
            equippedCharacter,
            equippedOutfit,
          });

      const juiceInventory = sanitizeInventory<JuiceId>(parsed.juiceInventory, VALID_JUICE_IDS);
      const protectionInventory = sanitizeInventory<ProtectionId>(
        parsed.protectionInventory,
        VALID_PROTECTION_IDS
      );
      const selectedJuice =
        typeof parsed.selectedJuice === 'string' && VALID_JUICE_IDS.has(parsed.selectedJuice)
          ? (parsed.selectedJuice as JuiceId)
          : undefined;
      const selectedProtection =
        typeof parsed.selectedProtection === 'string' &&
        VALID_PROTECTION_IDS.has(parsed.selectedProtection)
          ? (parsed.selectedProtection as ProtectionId)
          : undefined;

      const base: SavedProgress = {
        bestScore,
        bestDistance,
        totalDistanceMeters: Math.max(
          Number(parsed.totalDistanceMeters) || 0,
          bestDistance
        ),
        bestLevel,
        totalLootCfa,
        lifetimeLootCfa: Math.max(Number(parsed.lifetimeLootCfa) || 0, totalLootCfa),
        runsCount: Number(parsed.runsCount) || 0,
        unlockedAchievements: Array.isArray(parsed.unlockedAchievements)
          ? parsed.unlockedAchievements.filter((id): id is string => typeof id === 'string')
          : [],
        shopCoins,
        unlockedOutfits,
        equippedOutfit,
        unlockedCharacters,
        equippedCharacter,
        juiceInventory,
        protectionInventory,
        selectedJuice,
        selectedProtection,
        autoUseJuiceOnStart: Boolean(parsed.autoUseJuiceOnStart),
        autoUseProtectionOnStart: Boolean(parsed.autoUseProtectionOnStart),
        dailyProgress: ensureTodayDailyState(parsed.dailyProgress, {
          unlockedOutfits,
          equippedOutfit,
        }),
        localLeaderboard,
      };
      const retroactivelyUnlocked = collectNewlyUnlockedIds(base);
      if (retroactivelyUnlocked.length > 0) {
        base.unlockedAchievements = [...base.unlockedAchievements, ...retroactivelyUnlocked];
      }
      return base;
    }
  } catch {
    // ignore storage errors
  }
  return {
    bestScore: 0,
    bestDistance: 0,
    totalDistanceMeters: 0,
    bestLevel: 1,
    totalLootCfa: 0,
    lifetimeLootCfa: 0,
    runsCount: 0,
    unlockedAchievements: [],
    shopCoins: 0,
    unlockedOutfits: ['base'],
    equippedOutfit: 'base',
    unlockedCharacters: ['didi'],
    equippedCharacter: 'didi',
    juiceInventory: {},
    protectionInventory: {},
    autoUseJuiceOnStart: false,
    autoUseProtectionOnStart: false,
    dailyProgress: ensureTodayDailyState(undefined, {
      unlockedOutfits: ['base'],
      equippedOutfit: 'base',
    }),
    localLeaderboard: [],
  };
}

function saveProgress(next: SavedProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

export default function App() {
  const appRootRef = useRef<HTMLDivElement | null>(null);
  const canvasHandleRef = useRef<GameCanvasHandle | null>(null);
  const hudRef = useRef<HudSnapshot>(INITIAL_HUD);
  const bankedLootInRunRef = useRef<number>(0);
  const bankedCoinsInRunRef = useRef<number>(0);
  const bankedDistanceInRunRef = useRef<number>(0);
  const bankedJumpsInRunRef = useRef<number>(0);
  const bankedSlidesInRunRef = useRef<number>(0);
  const runLeaderboardRecordedRef = useRef<boolean>(false);
  const toastTimerRef = useRef<number | null>(null);
  const pendingStartBoostRef = useRef<{
    juice?: ShopJuice;
    protection?: ShopProtection;
  } | null>(null);

  const [progress, setProgress] = useState<SavedProgress>(() => loadProgress());
  const progressRef = useRef<SavedProgress>(progress);
  progressRef.current = progress;

  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [resumeCountdown, setResumeCountdown] = useState<number | null>(null);
  const [startLevel, setStartLevel] = useState<number>(() => progress.bestLevel);
  const [runKey, setRunKey] = useState<number>(1);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);

  const [isNewRecord, setIsNewRecord] = useState<boolean>(false);
  const [lastLeaderboardRank, setLastLeaderboardRank] = useState<number | null>(null);
  const [lastLeaderboardEntryId, setLastLeaderboardEntryId] = useState<string | null>(null);
  const [muted, setMuted] = useState<boolean>(() => soundEngine.isMuted());
  const [isNativeFullscreen, setIsNativeFullscreen] = useState<boolean>(false);

  const [isAchievementsOpen, setIsAchievementsOpen] = useState<boolean>(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState<boolean>(false);
  const [isDailyOpen, setIsDailyOpen] = useState<boolean>(false);
  const [isConverterOpen, setIsConverterOpen] = useState<boolean>(false);
  const [isMapOpen, setIsMapOpen] = useState<boolean>(false);
  const [isQuartiersOpen, setIsQuartiersOpen] = useState<boolean>(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState<boolean>(false);
  const [isShopOpen, setIsShopOpen] = useState<boolean>(false);
  const [isMusicOpen, setIsMusicOpen] = useState<boolean>(false);
  const [isMultiplayerOpen, setIsMultiplayerOpen] = useState<boolean>(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState<boolean>(false);
  const [isBoostPickerOpen, setIsBoostPickerOpen] = useState<boolean>(false);
  const [lastTutorialAction, setLastTutorialAction] = useState<{
    type: TutorialActionType;
    seq: number;
  } | null>(null);
  const [isMultiplayerMode, setIsMultiplayerMode] = useState<boolean>(false);
  const [mpLocalEliminated, setMpLocalEliminated] = useState<boolean>(false);
  const [musicModalInitialLevel, setMusicModalInitialLevel] = useState<number>(() => progress.bestLevel);

  const [customSongs, setCustomSongs] = useState<CustomSongMeta[]>(() => listCustomSongs());
  const [levelSongMap, setLevelSongMap] = useState<Record<number, string>>(() => getLevelSongMap());

  const [recentUnlockedIds, setRecentUnlockedIds] = useState<string[]>([]);
  const [toastAchievementTitles, setToastAchievementTitles] = useState<string[]>([]);
  const lastAchievementCheckRef = useRef<number>(0);
  const [viewport, setViewport] = useState<{ w: number; h: number; isTouch: boolean }>(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1280,
    h: typeof window !== 'undefined' ? window.innerHeight : 800,
    isTouch:
      typeof window !== 'undefined' ? window.matchMedia('(pointer: coarse)').matches : false,
  }));

  useEffect(() => {
    const syncViewport = () => {
      setViewport({
        w: window.innerWidth,
        h: window.innerHeight,
        isTouch: window.matchMedia('(pointer: coarse)').matches,
      });
    };
    window.addEventListener('resize', syncViewport);
    window.addEventListener('orientationchange', syncViewport);
    return () => {
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('orientationchange', syncViewport);
    };
  }, []);

  const anyModalOpen =
    isAchievementsOpen ||
    isLeaderboardOpen ||
    isDailyOpen ||
    isConverterOpen ||
    isMapOpen ||
    isQuartiersOpen ||
    isOptionsOpen ||
    isShopOpen ||
    isMusicOpen ||
    isMultiplayerOpen ||
    isTutorialOpen;
  const isCompactHeight = viewport.h <= 560;

  const notifyUnlockedAchievements = useCallback((newlyIds: string[]) => {
    if (newlyIds.length === 0) return;
    soundEngine.playAchievementUnlock();
    setRecentUnlockedIds((prev) => Array.from(new Set([...prev, ...newlyIds])));
    const titles = newlyIds
      .map((id) => getAchievementById(id)?.title)
      .filter((t): t is string => Boolean(t));
    if (titles.length > 0) {
      setToastAchievementTitles(titles);
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
      toastTimerRef.current = window.setTimeout(() => {
        setToastAchievementTitles([]);
      }, 4200);
    }
  }, []);

  // Safely bank any unbanked coins/bills and distance from the current run so progress is NEVER lost
  const bankCurrentRunEarnings = useCallback(
    (snapshot?: HudSnapshot) => {
      const current = snapshot ?? hudRef.current;
      const unbankedLoot = Math.max(0, current.lootCfa - bankedLootInRunRef.current);
      const unbankedCoins = Math.max(0, current.coinsCollected - bankedCoinsInRunRef.current);
      const unbankedMeters = Math.max(0, current.distanceMeters - bankedDistanceInRunRef.current);
      const unbankedJumps = Math.max(0, current.jumpsCount - bankedJumpsInRunRef.current);
      const unbankedSlides = Math.max(0, current.slidesCount - bankedSlidesInRunRef.current);
      if (
        unbankedLoot <= 0 &&
        unbankedCoins <= 0 &&
        unbankedMeters <= 0 &&
        unbankedJumps <= 0 &&
        unbankedSlides <= 0 &&
        current.score === 0 &&
        current.distanceMeters === 0
      ) {
        return;
      }

      bankedLootInRunRef.current += unbankedLoot;
      bankedCoinsInRunRef.current += unbankedCoins;
      bankedDistanceInRunRef.current += unbankedMeters;
      bankedJumpsInRunRef.current += unbankedJumps;
      bankedSlidesInRunRef.current += unbankedSlides;

      const prev = progressRef.current;
      const daily = ensureTodayDailyState(prev.dailyProgress, prev);
      const updatedBase: SavedProgress = {
        ...prev,
        bestScore: Math.max(prev.bestScore, current.score),
        bestDistance: Math.max(prev.bestDistance, current.distanceMeters),
        totalDistanceMeters: (prev.totalDistanceMeters || 0) + unbankedMeters,
        bestLevel: Math.max(prev.bestLevel, current.level),
        totalLootCfa: prev.totalLootCfa + unbankedLoot,
        lifetimeLootCfa:
          Math.max(prev.lifetimeLootCfa ?? prev.totalLootCfa, prev.totalLootCfa) + unbankedLoot,
        shopCoins: prev.shopCoins + unbankedCoins,
        runsCount: prev.runsCount,
        unlockedAchievements: prev.unlockedAchievements,
        dailyProgress: {
          ...daily,
          distanceMeters: daily.distanceMeters + unbankedMeters,
          coinsCollected: daily.coinsCollected + unbankedCoins,
          lootCfa: daily.lootCfa + unbankedLoot,
          jumpsCount: daily.jumpsCount + unbankedJumps,
          slidesCount: daily.slidesCount + unbankedSlides,
        },
      };
      const newlyIds = collectNewlyUnlockedIds(updatedBase);
      const updated: SavedProgress =
        newlyIds.length > 0
          ? {
              ...updatedBase,
              unlockedAchievements: [...updatedBase.unlockedAchievements, ...newlyIds],
            }
          : updatedBase;

      progressRef.current = updated;
      saveProgress(updated);
      setProgress(updated);
      if (newlyIds.length > 0) {
        notifyUnlockedAchievements(newlyIds);
      }
    },
    [notifyUnlockedAchievements]
  );

  // Persist coins/loot immediately if the player closes or backgrounds the phone app
  useEffect(() => {
    const onPageHide = () => {
      bankCurrentRunEarnings();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        bankCurrentRunEarnings();
      }
    };
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [bankCurrentRunEarnings]);

  const handleToggleFullscreen = useCallback(async () => {
    soundEngine.playClick();
    try {
      if (!document.fullscreenElement) {
        const target = appRootRef.current ?? document.documentElement;
        if (target?.requestFullscreen && document.fullscreenEnabled) {
          await target.requestFullscreen();
        }
        const orientation = screen.orientation as ScreenOrientation & {
          lock?: (o: string) => Promise<void>;
        };
        if (viewport.isTouch && orientation?.lock) {
          await orientation.lock('landscape');
        }
      } else {
        const orientation = screen.orientation as ScreenOrientation & { unlock?: () => void };
        orientation?.unlock?.();
        await document.exitFullscreen();
      }
    } catch {
      // Native fullscreen or orientation lock may be restricted by iframe/browser policy
    }
  }, [viewport.isTouch]);

  useEffect(() => {
    const onFsChange = () => {
      setIsNativeFullscreen(Boolean(document.fullscreenElement));
      if (!document.fullscreenElement) {
        try {
          const orientation = screen.orientation as ScreenOrientation & { unlock?: () => void };
          orientation?.unlock?.();
        } catch {
          // ignore
        }
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const closeAllModals = useCallback(() => {
    setIsAchievementsOpen(false);
    setIsLeaderboardOpen(false);
    setIsDailyOpen(false);
    setIsConverterOpen(false);
    setIsMapOpen(false);
    setIsQuartiersOpen(false);
    setIsOptionsOpen(false);
    setIsShopOpen(false);
    setIsMusicOpen(false);
    setIsMultiplayerOpen(false);
    setIsTutorialOpen(false);
    setIsBoostPickerOpen(false);
  }, []);

  const handleTutorialAction = useCallback((action: TutorialActionType) => {
    setLastTutorialAction((prev) => ({ type: action, seq: (prev?.seq ?? 0) + 1 }));
  }, []);

  const openMusicSelectorForLevel = useCallback((level: number) => {
    setMusicModalInitialLevel(Math.max(1, Math.floor(level)));
    setIsMusicOpen(true);
  }, []);

  useEffect(() => {
    void soundEngine.preloadAssignedSongs();
  }, [levelSongMap]);

  const handleUploadSongs = useCallback(
    async (files: FileList, targetLevel: number = 1): Promise<number[]> => {
      const uploaded: CustomSongMeta[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files.item(i);
        if (f) {
          const meta = await saveCustomSongFile(f);
          uploaded.push(meta);
        }
      }
      setCustomSongs(listCustomSongs());

      // Auto-assign newly uploaded songs starting from targetLevel on levels without custom songs
      const assignedLevels: number[] = [];
      let nextMap = getLevelSongMap();
      let cursorLevel = Math.max(1, Math.floor(targetLevel));

      for (const meta of uploaded) {
        while (nextMap[cursorLevel]?.startsWith('custom:') && cursorLevel < targetLevel + 60) {
          cursorLevel += 1;
        }
        if (!nextMap[cursorLevel]?.startsWith('custom:')) {
          nextMap = setLevelSongAssignment(cursorLevel, `custom:${meta.id}`);
          assignedLevels.push(cursorLevel);
          cursorLevel += 1;
        }
      }

      if (assignedLevels.length > 0) {
        setLevelSongMap(nextMap);
        soundEngine.refreshSongAssignments();
      }
      return assignedLevels;
    },
    []
  );

  const handleDeleteCustomSong = useCallback(async (songId: string) => {
    await deleteCustomSong(songId);
    setCustomSongs(listCustomSongs());
    setLevelSongMap(getLevelSongMap());
    soundEngine.refreshSongAssignments();
  }, []);

  const handleAssignSong = useCallback((level: number, assignment: string | null) => {
    const nextMap = setLevelSongAssignment(level, assignment);
    setLevelSongMap(nextMap);
    soundEngine.refreshSongAssignments();
  }, []);

  const handleAssignSongToAll = useCallback((assignment: string) => {
    const maxLvl = Math.max(60, progressRef.current.bestLevel + 10);
    let nextMap = getLevelSongMap();
    for (let lvl = 1; lvl <= maxLvl; lvl++) {
      nextMap = setLevelSongAssignment(lvl, assignment);
    }
    setLevelSongMap(nextMap);
    soundEngine.refreshSongAssignments();
  }, []);

  const handleClearAllAssignments = useCallback(() => {
    const emptyMap = clearAllLevelSongAssignments();
    setLevelSongMap(emptyMap);
    soundEngine.refreshSongAssignments();
  }, []);

  const startRun = useCallback(
    (levelOverride?: number, withCountdown: boolean = false) => {
      bankCurrentRunEarnings();
      bankedLootInRunRef.current = 0;
      bankedCoinsInRunRef.current = 0;
      bankedDistanceInRunRef.current = 0;
      bankedJumpsInRunRef.current = 0;
      bankedSlidesInRunRef.current = 0;
      runLeaderboardRecordedRef.current = false;
      hudRef.current = INITIAL_HUD;

      const targetLevel = typeof levelOverride === 'number' ? Math.max(1, levelOverride) : startLevel;

      // Auto-consume stocked protection / juice on run start if enabled
      const currentProgress = progressRef.current;
      let nextProgress = currentProgress;
      let progressChanged = false;
      const startBoosts: { juice?: ShopJuice; protection?: ShopProtection } = {};

      if (currentProgress.autoUseProtectionOnStart) {
        const prot = pickPreferredConsumable(
          SHOP_PROTECTIONS,
          currentProgress.protectionInventory,
          currentProgress.selectedProtection
        );
        if (prot) {
          const curCount = currentProgress.protectionInventory?.[prot.id] ?? 0;
          if (curCount > 0) {
            const nextProtInv = { ...(currentProgress.protectionInventory ?? {}) };
            if (curCount <= 1) {
              delete nextProtInv[prot.id];
            } else {
              nextProtInv[prot.id] = curCount - 1;
            }
            nextProgress = { ...nextProgress, protectionInventory: nextProtInv };
            progressChanged = true;
            startBoosts.protection = prot;
          }
        }
      }

      if (currentProgress.autoUseJuiceOnStart) {
        const juice = pickPreferredConsumable(
          SHOP_JUICES,
          currentProgress.juiceInventory,
          currentProgress.selectedJuice
        );
        if (juice) {
          const curCount = currentProgress.juiceInventory?.[juice.id] ?? 0;
          if (curCount > 0) {
            const nextJuiceInv = { ...(nextProgress.juiceInventory ?? {}) };
            if (curCount <= 1) {
              delete nextJuiceInv[juice.id];
            } else {
              nextJuiceInv[juice.id] = curCount - 1;
            }
            nextProgress = { ...nextProgress, juiceInventory: nextJuiceInv };
            progressChanged = true;
            startBoosts.juice = juice;
          }
        }
      }

      if (progressChanged) {
        progressRef.current = nextProgress;
        saveProgress(nextProgress);
        setProgress(nextProgress);
      }

      pendingStartBoostRef.current =
        startBoosts.juice || startBoosts.protection ? startBoosts : null;

      soundEngine.unlock();
      soundEngine.playClick();
      if (typeof levelOverride === 'number') {
        setStartLevel(targetLevel);
      }
      closeAllModals();
      setRecentUnlockedIds([]);
      setIsNewRecord(false);
      setLastLeaderboardRank(null);
      setLastLeaderboardEntryId(null);
      setRunKey((k) => k + 1);
      setGameState('PLAYING');
      if (withCountdown) {
        setResumeCountdown(3);
      } else {
        setResumeCountdown(null);
        soundEngine.startMusic(targetLevel);
      }
    },
    [startLevel, bankCurrentRunEarnings, closeAllModals]
  );

  const startRunRef = useRef(startRun);
  startRunRef.current = startRun;

  const isMultiplayerModeRef = useRef<boolean>(isMultiplayerMode);
  isMultiplayerModeRef.current = isMultiplayerMode;

  const handleMultiplayerRaceStart = useCallback((startedRoom: MultiplayerRoomSnapshot) => {
    setIsMultiplayerMode(true);
    setMpLocalEliminated(false);
    startRunRef.current(startedRoom.level, true);
  }, []);

  const handleMultiplayerRaceResults = useCallback((_finishedRoom: MultiplayerRoomSnapshot) => {
    soundEngine.stopMusic();
    setResumeCountdown(null);
    setIsBoostPickerOpen(false);
    setMpLocalEliminated(false);
    setGameState('TITLE_MENU');
    setIsMultiplayerOpen(true);
  }, []);

  const mp = useMultiplayerClient({
    onRaceStart: handleMultiplayerRaceStart,
    onRaceResults: handleMultiplayerRaceResults,
  });

  useEffect(() => {
    if (isMultiplayerMode && mp.room?.status === 'LOBBY' && gameState === 'PLAYING') {
      soundEngine.stopMusic();
      setResumeCountdown(null);
      setMpLocalEliminated(false);
      setGameState('TITLE_MENU');
      setIsMultiplayerOpen(true);
    }
  }, [isMultiplayerMode, mp.room?.status, gameState]);

  useEffect(() => {
    if (isMultiplayerMode && !mp.room && gameState === 'PLAYING') {
      soundEngine.stopMusic();
      setResumeCountdown(null);
      setIsMultiplayerMode(false);
      setMpLocalEliminated(false);
      setGameState('TITLE_MENU');
      setIsMultiplayerOpen(true);
    }
  }, [isMultiplayerMode, mp.room, gameState]);

  const [mpPoseTick, setMpPoseTick] = useState(0);
  useEffect(() => {
    if (!isMultiplayerMode || gameState !== 'PLAYING') return;
    const id = window.setInterval(() => {
      setMpPoseTick((t) => (t + 1) % 10000);
    }, 250);
    return () => window.clearInterval(id);
  }, [isMultiplayerMode, gameState]);

  const isCountdownActive = resumeCountdown !== null && resumeCountdown > 0;

  useEffect(() => {
    if (gameState !== 'PLAYING' || isCountdownActive || !pendingStartBoostRef.current) return;
    const pending = pendingStartBoostRef.current;
    pendingStartBoostRef.current = null;
    if (pending.protection) {
      canvasHandleRef.current?.activateProtection(
        pending.protection.name,
        pending.protection.shieldCharges,
        pending.protection.invincibleBonusSec
      );
    }
    if (pending.juice) {
      canvasHandleRef.current?.activateSpeedJuice(
        pending.juice.name,
        pending.juice.durationSec,
        pending.juice.speedBonus,
        pending.juice.policePushback
      );
    }
  }, [runKey, gameState, isCountdownActive]);

  useEffect(() => {
    if (gameState !== 'PLAYING' || resumeCountdown === null) return;
    if (resumeCountdown <= 0) {
      setResumeCountdown(null);
      soundEngine.playPowerUp();
      soundEngine.startMusic(hudRef.current.level);
      return;
    }
    soundEngine.playClick();
    const timer = window.setTimeout(() => {
      setResumeCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [gameState, resumeCountdown]);

  const returnToMenu = useCallback(() => {
    setResumeCountdown(null);
    soundEngine.playClick();
    soundEngine.stopMusic();
    if (isMultiplayerModeRef.current) {
      mp.leaveRoom();
      setIsMultiplayerMode(false);
      setMpLocalEliminated(false);
    }
    const currentSnapshot = hudRef.current;
    bankCurrentRunEarnings(currentSnapshot);
    if (!runLeaderboardRecordedRef.current && currentSnapshot.score > 0) {
      runLeaderboardRecordedRef.current = true;
      const prev = progressRef.current;
      const lbResult = recordRunToLeaderboard(
        prev.localLeaderboard,
        currentSnapshot,
        prev.equippedCharacter,
        prev.equippedOutfit,
        'QUIT'
      );
      const updated: SavedProgress = {
        ...prev,
        localLeaderboard: lbResult.entries,
      };
      progressRef.current = updated;
      saveProgress(updated);
      setProgress(updated);
      setLastLeaderboardRank(lbResult.rank);
      setLastLeaderboardEntryId(lbResult.entryId);
    }
    bankedLootInRunRef.current = 0;
    bankedCoinsInRunRef.current = 0;
    bankedDistanceInRunRef.current = 0;
    bankedJumpsInRunRef.current = 0;
    bankedSlidesInRunRef.current = 0;
    closeAllModals();
    setRunKey((k) => k + 1);
    setGameState('TITLE_MENU');
  }, [bankCurrentRunEarnings, closeAllModals, mp]);

  const togglePause = useCallback(() => {
    if (isMultiplayerModeRef.current) {
      returnToMenu();
      return;
    }
    soundEngine.playClick();
    setGameState((prev) => {
      if (prev === 'PLAYING') {
        setResumeCountdown(null);
        setIsBoostPickerOpen(false);
        soundEngine.stopMusic();
        bankCurrentRunEarnings();
        return 'PAUSED';
      }
      if (prev === 'PAUSED') {
        closeAllModals();
        setResumeCountdown(3);
        return 'PLAYING';
      }
      return prev;
    });
  }, [bankCurrentRunEarnings, closeAllModals, returnToMenu]);

  useEffect(() => {
    return () => {
      soundEngine.stopMusic();
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const handleToggleMute = useCallback(() => {
    const nowMuted = soundEngine.toggleMute();
    setMuted(nowMuted);
  }, []);

  const handleHudUpdate = useCallback(
    (snapshot: HudSnapshot) => {
      hudRef.current = snapshot;
      setHud(snapshot);

      const now = performance.now();
      if (now - lastAchievementCheckRef.current < 1000) return;
      lastAchievementCheckRef.current = now;

      if (snapshot.distanceMeters > 0 || snapshot.lootCfa > 0 || snapshot.score > 0) {
        const prev = progressRef.current;
        const unbankedLoot = Math.max(0, snapshot.lootCfa - bankedLootInRunRef.current);
        const unbankedCoins = Math.max(0, snapshot.coinsCollected - bankedCoinsInRunRef.current);
        const unbankedMeters = Math.max(0, snapshot.distanceMeters - bankedDistanceInRunRef.current);
        const projected: SavedProgress = {
          ...prev,
          bestScore: Math.max(prev.bestScore, snapshot.score),
          bestDistance: Math.max(prev.bestDistance, snapshot.distanceMeters),
          totalDistanceMeters: (prev.totalDistanceMeters || 0) + unbankedMeters,
          bestLevel: Math.max(prev.bestLevel, snapshot.level),
          totalLootCfa: prev.totalLootCfa + unbankedLoot,
          lifetimeLootCfa:
            Math.max(prev.lifetimeLootCfa ?? prev.totalLootCfa, prev.totalLootCfa) + unbankedLoot,
          shopCoins: prev.shopCoins + unbankedCoins,
          runsCount: prev.runsCount,
          unlockedAchievements: prev.unlockedAchievements,
        };
        const newlyIds = collectNewlyUnlockedIds(projected);
        if (newlyIds.length > 0) {
          const updated: SavedProgress = {
            ...prev,
            unlockedAchievements: [...prev.unlockedAchievements, ...newlyIds],
          };
          progressRef.current = updated;
          saveProgress(updated);
          setProgress(updated);
          notifyUnlockedAchievements(newlyIds);
        }
      }
    },
    [notifyUnlockedAchievements]
  );

  const handleLevelComplete = useCallback(
    (finalSnapshot: HudSnapshot) => {
      soundEngine.stopMusic();
      setIsBoostPickerOpen(false);
      hudRef.current = finalSnapshot;
      setHud(finalSnapshot);
      setGameState('LEVEL_COMPLETE');

      const unbankedLoot = Math.max(0, finalSnapshot.lootCfa - bankedLootInRunRef.current);
      const unbankedCoins = Math.max(0, finalSnapshot.coinsCollected - bankedCoinsInRunRef.current);
      const unbankedMeters = Math.max(
        0,
        finalSnapshot.distanceMeters - bankedDistanceInRunRef.current
      );
      const unbankedJumps = Math.max(0, finalSnapshot.jumpsCount - bankedJumpsInRunRef.current);
      const unbankedSlides = Math.max(0, finalSnapshot.slidesCount - bankedSlidesInRunRef.current);

      bankedLootInRunRef.current += unbankedLoot;
      bankedCoinsInRunRef.current += unbankedCoins;
      bankedDistanceInRunRef.current += unbankedMeters;
      bankedJumpsInRunRef.current += unbankedJumps;
      bankedSlidesInRunRef.current += unbankedSlides;

      const prev = progressRef.current;
      const beatBest = finalSnapshot.score > prev.bestScore;
      setIsNewRecord(beatBest && finalSnapshot.score > 0);

      const nextLevel = finalSnapshot.level + 1;
      setStartLevel(nextLevel);

      const lbResult = !runLeaderboardRecordedRef.current
        ? recordRunToLeaderboard(
            prev.localLeaderboard,
            finalSnapshot,
            prev.equippedCharacter,
            prev.equippedOutfit,
            'VICTORY'
          )
        : {
            entries: sanitizeLeaderboardEntries(prev.localLeaderboard),
            rank: null,
            entryId: null,
          };
      runLeaderboardRecordedRef.current = true;
      setLastLeaderboardRank(lbResult.rank);
      setLastLeaderboardEntryId(lbResult.entryId);

      const daily = ensureTodayDailyState(prev.dailyProgress, prev);
      const updatedBase: SavedProgress = {
        ...prev,
        bestScore: Math.max(prev.bestScore, finalSnapshot.score),
        bestDistance: Math.max(prev.bestDistance, finalSnapshot.distanceMeters),
        totalDistanceMeters: (prev.totalDistanceMeters || 0) + unbankedMeters,
        bestLevel: Math.max(prev.bestLevel, nextLevel),
        totalLootCfa: prev.totalLootCfa + unbankedLoot,
        lifetimeLootCfa:
          Math.max(prev.lifetimeLootCfa ?? prev.totalLootCfa, prev.totalLootCfa) + unbankedLoot,
        shopCoins: prev.shopCoins + unbankedCoins,
        runsCount: prev.runsCount + 1,
        unlockedAchievements: prev.unlockedAchievements,
        dailyProgress: {
          ...daily,
          distanceMeters: daily.distanceMeters + unbankedMeters,
          coinsCollected: daily.coinsCollected + unbankedCoins,
          lootCfa: daily.lootCfa + unbankedLoot,
          jumpsCount: daily.jumpsCount + unbankedJumps,
          slidesCount: daily.slidesCount + unbankedSlides,
          runsCompleted: daily.runsCompleted + 1,
          levelsCompleted: daily.levelsCompleted + 1,
        },
        localLeaderboard: lbResult.entries,
      };
      const newlyIds = collectNewlyUnlockedIds(updatedBase);
      const updated: SavedProgress =
        newlyIds.length > 0
          ? {
              ...updatedBase,
              unlockedAchievements: [...updatedBase.unlockedAchievements, ...newlyIds],
            }
          : updatedBase;

      progressRef.current = updated;
      saveProgress(updated);
      setProgress(updated);
      if (newlyIds.length > 0) {
        notifyUnlockedAchievements(newlyIds);
      }
    },
    [notifyUnlockedAchievements]
  );

  const handleGameOver = useCallback(
    (finalSnapshot: HudSnapshot) => {
      soundEngine.stopMusic();
      setIsBoostPickerOpen(false);
      hudRef.current = finalSnapshot;
      setHud(finalSnapshot);
      if (isMultiplayerModeRef.current) {
        setMpLocalEliminated(true);
        mp.sendFinished({
          distanceMeters: finalSnapshot.distanceMeters,
          worldScroll: finalSnapshot.worldScroll,
          coinsCollected: finalSnapshot.coinsCollected,
          score: finalSnapshot.score,
          arrestReason: finalSnapshot.arrestReason,
        });
      } else {
        setGameState('GAME_OVER');
      }

      const unbankedLoot = Math.max(0, finalSnapshot.lootCfa - bankedLootInRunRef.current);
      const unbankedCoins = Math.max(0, finalSnapshot.coinsCollected - bankedCoinsInRunRef.current);
      const unbankedMeters = Math.max(
        0,
        finalSnapshot.distanceMeters - bankedDistanceInRunRef.current
      );
      const unbankedJumps = Math.max(0, finalSnapshot.jumpsCount - bankedJumpsInRunRef.current);
      const unbankedSlides = Math.max(0, finalSnapshot.slidesCount - bankedSlidesInRunRef.current);

      bankedLootInRunRef.current += unbankedLoot;
      bankedCoinsInRunRef.current += unbankedCoins;
      bankedDistanceInRunRef.current += unbankedMeters;
      bankedJumpsInRunRef.current += unbankedJumps;
      bankedSlidesInRunRef.current += unbankedSlides;

      const prev = progressRef.current;
      const beatBest = finalSnapshot.score > prev.bestScore;
      setIsNewRecord(beatBest && finalSnapshot.score > 0);

      const lbResult = !runLeaderboardRecordedRef.current
        ? recordRunToLeaderboard(
            prev.localLeaderboard,
            finalSnapshot,
            prev.equippedCharacter,
            prev.equippedOutfit,
            'ARRESTED'
          )
        : {
            entries: sanitizeLeaderboardEntries(prev.localLeaderboard),
            rank: null,
            entryId: null,
          };
      runLeaderboardRecordedRef.current = true;
      setLastLeaderboardRank(lbResult.rank);
      setLastLeaderboardEntryId(lbResult.entryId);

      const daily = ensureTodayDailyState(prev.dailyProgress, prev);
      const updatedBase: SavedProgress = {
        ...prev,
        bestScore: Math.max(prev.bestScore, finalSnapshot.score),
        bestDistance: Math.max(prev.bestDistance, finalSnapshot.distanceMeters),
        totalDistanceMeters: (prev.totalDistanceMeters || 0) + unbankedMeters,
        bestLevel: Math.max(prev.bestLevel, finalSnapshot.level),
        totalLootCfa: prev.totalLootCfa + unbankedLoot,
        lifetimeLootCfa:
          Math.max(prev.lifetimeLootCfa ?? prev.totalLootCfa, prev.totalLootCfa) + unbankedLoot,
        shopCoins: prev.shopCoins + unbankedCoins,
        runsCount: prev.runsCount + 1,
        unlockedAchievements: prev.unlockedAchievements,
        dailyProgress: {
          ...daily,
          distanceMeters: daily.distanceMeters + unbankedMeters,
          coinsCollected: daily.coinsCollected + unbankedCoins,
          lootCfa: daily.lootCfa + unbankedLoot,
          jumpsCount: daily.jumpsCount + unbankedJumps,
          slidesCount: daily.slidesCount + unbankedSlides,
          runsCompleted: daily.runsCompleted + 1,
        },
        localLeaderboard: lbResult.entries,
      };
      const newlyIds = collectNewlyUnlockedIds(updatedBase);
      const updated: SavedProgress =
        newlyIds.length > 0
          ? {
              ...updatedBase,
              unlockedAchievements: [...updatedBase.unlockedAchievements, ...newlyIds],
            }
          : updatedBase;

      progressRef.current = updated;
      saveProgress(updated);
      setProgress(updated);
      if (newlyIds.length > 0) {
        notifyUnlockedAchievements(newlyIds);
      }
    },
    [mp, notifyUnlockedAchievements]
  );

  const handleResetLeaderboard = useCallback(() => {
    soundEngine.playClick();
    const prev = progressRef.current;
    const updated: SavedProgress = {
      ...prev,
      localLeaderboard: [],
    };
    progressRef.current = updated;
    saveProgress(updated);
    setProgress(updated);
    setLastLeaderboardRank(null);
    setLastLeaderboardEntryId(null);
  }, []);

  const handleBuyOutfit = useCallback((outfitId: OutfitId) => {
    const outfit = getOutfitById(outfitId);
    const prev = progressRef.current;
    if (prev.unlockedOutfits.includes(outfitId) || prev.shopCoins < outfit.price) {
      soundEngine.playStumble();
      return;
    }
    const daily = ensureTodayDailyState(prev.dailyProgress, prev);
    const updated: SavedProgress = {
      ...prev,
      shopCoins: prev.shopCoins - outfit.price,
      unlockedOutfits: [...prev.unlockedOutfits, outfitId],
      equippedOutfit: outfitId,
      dailyProgress: {
        ...daily,
        shopInteractions: daily.shopInteractions + 1,
        equippedEtalonsToday: daily.equippedEtalonsToday || outfitId === 'etalons',
      },
    };
    progressRef.current = updated;
    saveProgress(updated);
    setProgress(updated);
    soundEngine.playPowerUp();
  }, []);

  const handleEquipOutfit = useCallback((outfitId: OutfitId) => {
    const prev = progressRef.current;
    if (!prev.unlockedOutfits.includes(outfitId)) return;
    const daily = ensureTodayDailyState(prev.dailyProgress, prev);
    const updated: SavedProgress = {
      ...prev,
      equippedOutfit: outfitId,
      dailyProgress: {
        ...daily,
        shopInteractions: daily.shopInteractions + 1,
        equippedEtalonsToday: daily.equippedEtalonsToday || outfitId === 'etalons',
      },
    };
    progressRef.current = updated;
    saveProgress(updated);
    setProgress(updated);
    soundEngine.playClick();
  }, []);

  const handleBuyCharacter = useCallback((characterId: CharacterId) => {
    const char = getCharacterById(characterId);
    const prev = progressRef.current;
    if (prev.unlockedCharacters.includes(characterId) || prev.shopCoins < char.price) {
      soundEngine.playStumble();
      return;
    }
    const daily = ensureTodayDailyState(prev.dailyProgress, prev);
    const updated: SavedProgress = {
      ...prev,
      shopCoins: prev.shopCoins - char.price,
      unlockedCharacters: [...prev.unlockedCharacters, characterId],
      equippedCharacter: characterId,
      dailyProgress: {
        ...daily,
        shopInteractions: daily.shopInteractions + 1,
      },
    };
    progressRef.current = updated;
    saveProgress(updated);
    setProgress(updated);
    soundEngine.playPowerUp();
  }, []);

  const handleEquipCharacter = useCallback((characterId: CharacterId) => {
    const prev = progressRef.current;
    if (!prev.unlockedCharacters.includes(characterId)) return;
    const daily = ensureTodayDailyState(prev.dailyProgress, prev);
    const updated: SavedProgress = {
      ...prev,
      equippedCharacter: characterId,
      dailyProgress: {
        ...daily,
        shopInteractions: daily.shopInteractions + 1,
      },
    };
    progressRef.current = updated;
    saveProgress(updated);
    setProgress(updated);
    soundEngine.playClick();
  }, []);

  const handleShopTryItem = useCallback(() => {
    const prev = progressRef.current;
    const daily = ensureTodayDailyState(prev.dailyProgress, prev);
    const updated: SavedProgress = {
      ...prev,
      dailyProgress: {
        ...daily,
        shopInteractions: daily.shopInteractions + 1,
      },
    };
    progressRef.current = updated;
    saveProgress(updated);
    setProgress(updated);
  }, []);

  const handleBuyJuice = useCallback((juiceId: JuiceId) => {
    const juice = getJuiceById(juiceId);
    const prev = progressRef.current;
    if (prev.shopCoins < juice.priceCoins) {
      soundEngine.playStumble();
      return;
    }
    const daily = ensureTodayDailyState(prev.dailyProgress, prev);
    const currentCount = prev.juiceInventory?.[juiceId] ?? 0;
    const updated: SavedProgress = {
      ...prev,
      shopCoins: prev.shopCoins - juice.priceCoins,
      juiceInventory: {
        ...(prev.juiceInventory ?? {}),
        [juiceId]: currentCount + 1,
      },
      selectedJuice: juiceId,
      dailyProgress: {
        ...daily,
        shopInteractions: daily.shopInteractions + 1,
      },
    };
    progressRef.current = updated;
    saveProgress(updated);
    setProgress(updated);
    soundEngine.playPowerUp();
  }, []);

  const handleSelectJuice = useCallback((juiceId: JuiceId) => {
    const prev = progressRef.current;
    if ((prev.juiceInventory?.[juiceId] ?? 0) <= 0) return;
    const updated: SavedProgress = { ...prev, selectedJuice: juiceId };
    progressRef.current = updated;
    saveProgress(updated);
    setProgress(updated);
    soundEngine.playClick();
  }, []);

  const handleBuyProtection = useCallback((protectionId: ProtectionId) => {
    const prot = getProtectionById(protectionId);
    const prev = progressRef.current;
    if (prev.totalLootCfa < prot.priceCfa) {
      soundEngine.playStumble();
      return;
    }
    const daily = ensureTodayDailyState(prev.dailyProgress, prev);
    const currentCount = prev.protectionInventory?.[protectionId] ?? 0;
    const updated: SavedProgress = {
      ...prev,
      totalLootCfa: prev.totalLootCfa - prot.priceCfa,
      lifetimeLootCfa: Math.max(prev.lifetimeLootCfa ?? prev.totalLootCfa, prev.totalLootCfa),
      protectionInventory: {
        ...(prev.protectionInventory ?? {}),
        [protectionId]: currentCount + 1,
      },
      selectedProtection: protectionId,
      dailyProgress: {
        ...daily,
        shopInteractions: daily.shopInteractions + 1,
      },
    };
    progressRef.current = updated;
    saveProgress(updated);
    setProgress(updated);
    soundEngine.playPowerUp();
  }, []);

  const handleSelectProtection = useCallback((protectionId: ProtectionId) => {
    const prev = progressRef.current;
    if ((prev.protectionInventory?.[protectionId] ?? 0) <= 0) return;
    const updated: SavedProgress = { ...prev, selectedProtection: protectionId };
    progressRef.current = updated;
    saveProgress(updated);
    setProgress(updated);
    soundEngine.playClick();
  }, []);

  const handleToggleAutoUseJuice = useCallback(() => {
    const prev = progressRef.current;
    const updated: SavedProgress = {
      ...prev,
      autoUseJuiceOnStart: !prev.autoUseJuiceOnStart,
    };
    progressRef.current = updated;
    saveProgress(updated);
    setProgress(updated);
    soundEngine.playClick();
  }, []);

  const handleToggleAutoUseProtection = useCallback(() => {
    const prev = progressRef.current;
    const updated: SavedProgress = {
      ...prev,
      autoUseProtectionOnStart: !prev.autoUseProtectionOnStart,
    };
    progressRef.current = updated;
    saveProgress(updated);
    setProgress(updated);
    soundEngine.playClick();
  }, []);

  const handleScreenTap = useCallback(() => {
    if (gameState !== 'PLAYING' || anyModalOpen || isCountdownActive || mpLocalEliminated) return;
    soundEngine.playClick();
    setIsBoostPickerOpen((prev) => !prev);
  }, [gameState, anyModalOpen, isCountdownActive, mpLocalEliminated]);

  const handleDrinkSpecificJuice = useCallback(
    (juiceId: JuiceId) => {
      if (gameState !== 'PLAYING' || anyModalOpen || isCountdownActive || mpLocalEliminated) {
        return;
      }
      const juice = getJuiceById(juiceId);
      const currentStock = progressRef.current.juiceInventory?.[juiceId] ?? 0;

      if (currentStock > 0) {
        const applied = canvasHandleRef.current?.activateSpeedJuice(
          juice.name,
          juice.durationSec,
          juice.speedBonus,
          juice.policePushback
        );
        if (!applied) return;
        const prev = progressRef.current;
        const nextInv = { ...(prev.juiceInventory ?? {}) };
        const count = nextInv[juiceId] ?? 0;
        if (count <= 1) {
          delete nextInv[juiceId];
        } else {
          nextInv[juiceId] = count - 1;
        }
        const updated: SavedProgress = {
          ...prev,
          juiceInventory: nextInv,
          selectedJuice: juiceId,
        };
        progressRef.current = updated;
        saveProgress(updated);
        setProgress(updated);
        setIsBoostPickerOpen(false);
        return;
      }

      // Not in stock: allow buying & drinking directly using banked + current run coins
      bankCurrentRunEarnings(hudRef.current);
      const prev = progressRef.current;
      if (prev.shopCoins < juice.priceCoins) {
        soundEngine.playStumble();
        return;
      }
      const applied = canvasHandleRef.current?.activateSpeedJuice(
        juice.name,
        juice.durationSec,
        juice.speedBonus,
        juice.policePushback
      );
      if (!applied) return;
      const daily = ensureTodayDailyState(prev.dailyProgress, prev);
      const updated: SavedProgress = {
        ...prev,
        shopCoins: prev.shopCoins - juice.priceCoins,
        selectedJuice: juiceId,
        dailyProgress: {
          ...daily,
          shopInteractions: daily.shopInteractions + 1,
        },
      };
      progressRef.current = updated;
      saveProgress(updated);
      setProgress(updated);
      setIsBoostPickerOpen(false);
    },
    [gameState, anyModalOpen, isCountdownActive, mpLocalEliminated, bankCurrentRunEarnings]
  );

  const handleActivateSpecificProtection = useCallback(
    (protectionId: ProtectionId) => {
      if (gameState !== 'PLAYING' || anyModalOpen || isCountdownActive || mpLocalEliminated) {
        return;
      }
      const prot = getProtectionById(protectionId);
      const currentStock = progressRef.current.protectionInventory?.[protectionId] ?? 0;

      if (currentStock > 0) {
        const applied = canvasHandleRef.current?.activateProtection(
          prot.name,
          prot.shieldCharges,
          prot.invincibleBonusSec
        );
        if (!applied) return;
        const prev = progressRef.current;
        const nextInv = { ...(prev.protectionInventory ?? {}) };
        const count = nextInv[protectionId] ?? 0;
        if (count <= 1) {
          delete nextInv[protectionId];
        } else {
          nextInv[protectionId] = count - 1;
        }
        const updated: SavedProgress = {
          ...prev,
          protectionInventory: nextInv,
          selectedProtection: protectionId,
        };
        progressRef.current = updated;
        saveProgress(updated);
        setProgress(updated);
        setIsBoostPickerOpen(false);
        return;
      }

      // Not in stock: allow buying & activating directly using banked + current run F CFA
      bankCurrentRunEarnings(hudRef.current);
      const prev = progressRef.current;
      if (prev.totalLootCfa < prot.priceCfa) {
        soundEngine.playStumble();
        return;
      }
      const applied = canvasHandleRef.current?.activateProtection(
        prot.name,
        prot.shieldCharges,
        prot.invincibleBonusSec
      );
      if (!applied) return;
      const daily = ensureTodayDailyState(prev.dailyProgress, prev);
      const updated: SavedProgress = {
        ...prev,
        totalLootCfa: prev.totalLootCfa - prot.priceCfa,
        lifetimeLootCfa: Math.max(prev.lifetimeLootCfa ?? prev.totalLootCfa, prev.totalLootCfa),
        selectedProtection: protectionId,
        dailyProgress: {
          ...daily,
          shopInteractions: daily.shopInteractions + 1,
        },
      };
      progressRef.current = updated;
      saveProgress(updated);
      setProgress(updated);
      setIsBoostPickerOpen(false);
    },
    [gameState, anyModalOpen, isCountdownActive, mpLocalEliminated, bankCurrentRunEarnings]
  );

  const handleUseJuiceInRun = useCallback(() => {
    if (gameState !== 'PLAYING' || anyModalOpen || isCountdownActive) return;
    const prev = progressRef.current;
    const juice = pickPreferredConsumable(SHOP_JUICES, prev.juiceInventory, prev.selectedJuice);
    if (!juice) return;
    const applied = canvasHandleRef.current?.activateSpeedJuice(
      juice.name,
      juice.durationSec,
      juice.speedBonus,
      juice.policePushback
    );
    if (!applied) return;
    const nextInv = { ...(prev.juiceInventory ?? {}) };
    const curCount = nextInv[juice.id] ?? 0;
    if (curCount <= 1) {
      delete nextInv[juice.id];
    } else {
      nextInv[juice.id] = curCount - 1;
    }
    const updated: SavedProgress = { ...prev, juiceInventory: nextInv };
    progressRef.current = updated;
    saveProgress(updated);
    setProgress(updated);
  }, [gameState, anyModalOpen, isCountdownActive]);

  const handleUseProtectionInRun = useCallback(() => {
    if (gameState !== 'PLAYING' || anyModalOpen || isCountdownActive) return;
    const prev = progressRef.current;
    const prot = pickPreferredConsumable(
      SHOP_PROTECTIONS,
      prev.protectionInventory,
      prev.selectedProtection
    );
    if (!prot) return;
    const applied = canvasHandleRef.current?.activateProtection(
      prot.name,
      prot.shieldCharges,
      prot.invincibleBonusSec
    );
    if (!applied) return;
    const nextInv = { ...(prev.protectionInventory ?? {}) };
    const curCount = nextInv[prot.id] ?? 0;
    if (curCount <= 1) {
      delete nextInv[prot.id];
    } else {
      nextInv[prot.id] = curCount - 1;
    }
    const updated: SavedProgress = { ...prev, protectionInventory: nextInv };
    progressRef.current = updated;
    saveProgress(updated);
    setProgress(updated);
  }, [gameState, anyModalOpen, isCountdownActive]);

  const handleOpenDailyModal = useCallback(() => {
    soundEngine.playClick();
    const prev = progressRef.current;
    const syncedDaily = ensureTodayDailyState(prev.dailyProgress, prev);
    if (prev.dailyProgress?.dateKey !== syncedDaily.dateKey) {
      const updated: SavedProgress = { ...prev, dailyProgress: syncedDaily };
      progressRef.current = updated;
      saveProgress(updated);
      setProgress(updated);
    }
    setIsDailyOpen(true);
  }, []);

  const handleClaimDailyChallenge = useCallback((challengeId: string) => {
    const prev = progressRef.current;
    const evaluation = evaluateDailyChallenges(prev);
    const targetItem = evaluation.items.find((item) => item.definition.id === challengeId);
    if (!targetItem || !targetItem.completed || targetItem.claimed) {
      return;
    }
    const updated: SavedProgress = {
      ...prev,
      shopCoins: prev.shopCoins + targetItem.definition.rewardCoins,
      dailyProgress: {
        ...evaluation.daily,
        claimedIds: [...evaluation.daily.claimedIds, challengeId],
      },
    };
    progressRef.current = updated;
    saveProgress(updated);
    setProgress(updated);
    soundEngine.playCoin(true);
  }, []);

  const handleConvertCfaToCoins = useCallback((coinsToAdd?: number) => {
    const prev = progressRef.current;
    const maxConvertibleCoins = Math.floor(prev.totalLootCfa / 2);
    if (maxConvertibleCoins <= 0) {
      soundEngine.playStumble();
      return;
    }
    const requestedCoins =
      typeof coinsToAdd === 'number'
        ? Math.min(maxConvertibleCoins, Math.max(1, Math.floor(coinsToAdd)))
        : maxConvertibleCoins;
    if (requestedCoins <= 0) return;

    const cfaSpent = requestedCoins * 2;
    const updated: SavedProgress = {
      ...prev,
      totalLootCfa: prev.totalLootCfa - cfaSpent,
      lifetimeLootCfa: Math.max(prev.lifetimeLootCfa ?? prev.totalLootCfa, prev.totalLootCfa),
      shopCoins: prev.shopCoins + requestedCoins,
    };
    progressRef.current = updated;
    saveProgress(updated);
    setProgress(updated);
    soundEngine.playCoin(true);
  }, []);

  const handleSelectStartLevel = useCallback((lvl: number) => {
    const maxAllowed = progressRef.current.bestLevel;
    setStartLevel(Math.min(maxAllowed, Math.max(1, lvl)));
  }, []);

  const handleCloseModal = useCallback(() => {
    soundEngine.playClick();
    closeAllModals();
  }, [closeAllModals]);

  useEffect(() => {
    if (gameState !== 'PLAYING' || mpLocalEliminated || anyModalOpen) {
      setIsBoostPickerOpen(false);
    }
  }, [gameState, mpLocalEliminated, anyModalOpen]);

  useEffect(() => {
    if (!isBoostPickerOpen || gameState !== 'PLAYING') return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        soundEngine.playClick();
        setIsBoostPickerOpen(false);
      }
    };
    window.addEventListener('keydown', onEsc, { capture: true });
    return () => window.removeEventListener('keydown', onEsc, { capture: true });
  }, [isBoostPickerOpen, gameState]);

  useEffect(() => {
    if (!isConverterOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        handleCloseModal();
      }
    };
    window.addEventListener('keydown', onEsc, { capture: true });
    return () => window.removeEventListener('keydown', onEsc, { capture: true });
  }, [isConverterOpen, handleCloseModal]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.code === 'KeyM' && !isQuartiersOpen) {
        handleToggleMute();
        return;
      }
      if (gameState === 'PLAYING' && !anyModalOpen) {
        if (e.code === 'Digit1' || e.code === 'Numpad1') {
          e.preventDefault();
          handleUseJuiceInRun();
          return;
        }
        if (e.code === 'Digit2' || e.code === 'Numpad2') {
          e.preventDefault();
          handleUseProtectionInRun();
          return;
        }
      }
      if (e.code === 'Enter' && !anyModalOpen) {
        if (gameState === 'LEVEL_COMPLETE') {
          e.preventDefault();
          startRun(hudRef.current.level + 1);
        } else if (gameState === 'TITLE_MENU' || gameState === 'GAME_OVER') {
          e.preventDefault();
          if (isMultiplayerModeRef.current || mp.room) {
            mp.leaveRoom();
            setIsMultiplayerMode(false);
            setMpLocalEliminated(false);
          }
          startRun();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    gameState,
    anyModalOpen,
    isQuartiersOpen,
    mp,
    startRun,
    handleToggleMute,
    handleUseJuiceInRun,
    handleUseProtectionInRun,
  ]);

  const dangerLabel =
    hud.policeDanger >= 70 ? 'DANGER' : hud.policeDanger >= 45 ? 'ALERTE' : 'DISTANCÉE';
  const dangerBarColor =
    hud.policeDanger >= 70
      ? 'bg-red-500'
      : hud.policeDanger >= 45
        ? 'bg-amber-500'
        : 'bg-emerald-500';
  const dangerTextColor =
    hud.policeDanger >= 70
      ? 'text-red-400'
      : hud.policeDanger >= 45
        ? 'text-amber-400'
        : 'text-emerald-400';

  const unbankedLive =
    gameState === 'PLAYING' || gameState === 'PAUSED'
      ? Math.max(0, hud.lootCfa - bankedLootInRunRef.current)
      : 0;
  const unbankedCoinsLive =
    gameState === 'PLAYING' || gameState === 'PAUSED'
      ? Math.max(0, hud.coinsCollected - bankedCoinsInRunRef.current)
      : 0;
  const totalBankCfa = progress.totalLootCfa + unbankedLive;
  const totalShopCoins = progress.shopCoins + unbankedCoinsLive;

  const unlockedAchievementsCount = useMemo(
    () => evaluateAchievements(progress).filter((item) => item.unlocked).length,
    [progress]
  );

  const dailySummary = useMemo(() => evaluateDailyChallenges(progress), [progress]);

  const selectedLevelCfg = getLevelConfig(startLevel);
  const selectedLevelSongInfo = resolveEffectiveSongInfo(startLevel, levelSongMap, customSongs);
  const equippedCharacterObj = getCharacterById(progress.equippedCharacter);
  const equippedOutfitObj = getOutfitById(progress.equippedOutfit);
  const totalJuiceStock = getTotalInventoryCount(progress.juiceInventory);
  const totalProtectionStock = getTotalInventoryCount(progress.protectionInventory);
  const activeRunJuice = pickPreferredConsumable(
    SHOP_JUICES,
    progress.juiceInventory,
    progress.selectedJuice
  );
  const activeRunProtection = pickPreferredConsumable(
    SHOP_PROTECTIONS,
    progress.protectionInventory,
    progress.selectedProtection
  );

  const multiplayerCanvasConfig = useMemo(() => {
    if (!isMultiplayerMode || !mp.room || !mp.playerId) return undefined;
    return {
      active: true,
      seed: mp.room.seed,
      localPlayerId: mp.playerId,
      players: mp.room.players,
      remotePosesRef: mp.remotePosesRef,
      onSendPose: mp.sendPose,
    };
  }, [isMultiplayerMode, mp.room, mp.playerId, mp.remotePosesRef, mp.sendPose]);

  const liveMultiplayerStandings = useMemo(() => {
    void mpPoseTick;
    if (!isMultiplayerMode || !mp.room) return [];
    const poses = mp.remotePosesRef.current;
    return [...mp.room.players]
      .map((p) => {
        const isMe = p.id === mp.playerId;
        const livePose = poses.get(p.id);
        const distance = isMe
          ? hud.distanceMeters
          : Math.max(p.distanceMeters, Math.floor(livePose?.distanceMeters ?? 0));
        const isAlive = isMe ? !mpLocalEliminated : livePose ? livePose.isAlive : p.isAlive;
        return { ...p, distanceMeters: distance, isAlive, isMe };
      })
      .sort((a, b) => b.distanceMeters - a.distanceMeters);
  }, [
    mpPoseTick,
    isMultiplayerMode,
    mp.room,
    mp.playerId,
    mp.remotePosesRef,
    hud.distanceMeters,
    mpLocalEliminated,
  ]);

  return (
    <div
      ref={appRootRef}
      className="fixed inset-0 h-dvh w-screen overflow-hidden bg-[#0E0B0A] text-[#FAF5EE] flex flex-col"
    >
      {/* Full-Screen Game Stage */}
      <main className="relative flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden">
        <GameCanvas
          ref={canvasHandleRef}
          gameState={gameState}
          startLevel={startLevel}
          runKey={runKey}
          characterId={progress.equippedCharacter}
          outfitId={progress.equippedOutfit}
          pausedByModal={anyModalOpen && !isMultiplayerMode && !isTutorialOpen}
          isFrozen={isCountdownActive || (isBoostPickerOpen && !isMultiplayerMode)}
          isTutorial={isTutorialOpen}
          multiplayer={multiplayerCanvasConfig}
          onHudUpdate={handleHudUpdate}
          onLevelComplete={handleLevelComplete}
          onGameOver={handleGameOver}
          onTogglePause={togglePause}
          onScreenTap={handleScreenTap}
          onTutorialAction={handleTutorialAction}
        />

        {/* Atmospheric Visibility Tint Overlay (quantized gradient to avoid per-tick GPU repaints) */}
        {gameState === 'PLAYING' && (
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-10"
            style={{
              background:
                hud.weather === 'HARMATTAN'
                  ? `radial-gradient(circle at 50% 42%, rgba(214, 165, 117, ${(0.06 + Math.round(hud.weatherIntensity * 5) * 0.03).toFixed(2)}) 0%, rgba(180, 120, 68, ${(0.14 + Math.round(hud.weatherIntensity * 5) * 0.05).toFixed(2)}) 100%)`
                  : hud.weather === 'PLUIE'
                    ? `radial-gradient(circle at 50% 45%, rgba(51, 65, 85, ${(0.05 + Math.round(hud.weatherIntensity * 5) * 0.02).toFixed(2)}) 0%, rgba(15, 23, 42, ${(0.16 + Math.round(hud.weatherIntensity * 5) * 0.04).toFixed(2)}) 100%)`
                    : `linear-gradient(180deg, rgba(254, 240, 138, ${(0.10 + Math.round(hud.weatherIntensity * 5) * 0.04).toFixed(2)}) 0%, rgba(254, 249, 195, ${(0.04 + Math.round(hud.weatherIntensity * 5) * 0.02).toFixed(2)}) 38%, rgba(0, 0, 0, 0) 72%)`,
            }}
          />
        )}

        {/* Floating In-Game HUD (PLAYING) */}
        {gameState === 'PLAYING' && (
          <header
            aria-label="Tableau de bord de la course"
            className="pointer-events-none fixed inset-x-0 top-0 z-30 flex flex-wrap items-start justify-between gap-2 p-2.5 sm:p-4"
          >
            {/* Left: Level + Quartier + Weather + Score + Coins + Money */}
            <div className="pointer-events-auto flex flex-wrap items-center gap-x-3.5 gap-y-1.5 rounded-xl border border-white/15 bg-[#161210]/92 px-3 py-2 shadow-lg">
              <div className="min-w-[148px] sm:min-w-[184px]">
                <div className="flex items-center justify-between gap-2 text-[11px] text-[#B8ABA0]">
                  <span className="inline-flex items-center gap-1 font-semibold text-amber-400 whitespace-nowrap">
                    <MapPin className="h-3 w-3 shrink-0" />
                    Niv. {hud.level}
                  </span>
                  <span className="font-mono tabular-nums whitespace-nowrap">
                    {hud.levelMetersDone.toLocaleString('fr-FR')}/
                    {hud.levelMetersTotal.toLocaleString('fr-FR')} m
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="font-display text-xs sm:text-sm font-bold text-[#FAF5EE] truncate max-w-[130px] sm:max-w-[150px]">
                    {hud.quartierName}
                  </div>
                  <span
                    title={`${hud.weatherLabel} · Visibilité ${hud.visibilityPercent}%`}
                    className={`inline-flex items-center gap-1 font-mono text-[10px] font-semibold tabular-nums whitespace-nowrap ${
                      hud.weather === 'PLUIE'
                        ? 'text-sky-300'
                        : hud.weather === 'HARMATTAN'
                          ? 'text-orange-300'
                          : 'text-yellow-300'
                    }`}
                  >
                    {hud.weather === 'PLUIE' ? (
                      <CloudRain className="h-3 w-3 shrink-0" />
                    ) : hud.weather === 'HARMATTAN' ? (
                      <Wind className="h-3 w-3 shrink-0" />
                    ) : (
                      <Sun className="h-3 w-3 shrink-0" />
                    )}
                    <span>Vis. {hud.visibilityPercent}%</span>
                  </span>
                </div>
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-black/50">
                  <div
                    className="h-full bg-amber-400 transition-all duration-150"
                    style={{ width: `${Math.round(hud.levelProgress * 100)}%` }}
                  />
                </div>
              </div>

              <div className="h-7 w-px bg-white/10 hidden sm:block" aria-hidden="true" />

              <div className="flex items-center gap-3 sm:gap-4 font-mono tabular-nums">
                <div>
                  <div className="text-[10px] text-[#B8ABA0]">Score</div>
                  <div className="text-xs sm:text-sm font-bold text-[#FAF5EE]">
                    {hud.score.toLocaleString('fr-FR')}
                    {hud.combo > 1 && (
                      <span className="ml-1 text-[11px] text-amber-400">x{hud.combo}</span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-[#B8ABA0] inline-flex items-center gap-1">
                    <Coins className="h-2.5 w-2.5 text-amber-400" />
                    <span>Pièces</span>
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-amber-300">
                    {totalShopCoins.toLocaleString('fr-FR')}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-[#B8ABA0]">Cagnotte</div>
                  <div className="text-xs sm:text-sm font-bold text-emerald-400">
                    {totalBankCfa.toLocaleString('fr-FR')} F
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Active Powerups + Police Danger + Quick Controls */}
            <div className="pointer-events-auto flex items-center gap-2 sm:gap-3 rounded-xl border border-white/15 bg-[#161210]/92 px-2.5 py-2 shadow-lg">
              {(hud.hasShield || hud.turboRemaining > 0 || hud.magnetRemaining > 0) && (
                <div className="flex items-center gap-2 text-[11px] sm:text-xs font-mono font-semibold tabular-nums pr-1.5 border-r border-white/10">
                  {hud.hasShield && (
                    <span className="inline-flex items-center gap-1 text-sky-300">
                      <Shield className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Bouclier</span>
                      {hud.shieldCharges > 1 ? `×${hud.shieldCharges}` : ''}
                    </span>
                  )}
                  {hud.turboRemaining > 0 && (
                    <span className="inline-flex items-center gap-1 text-orange-300">
                      <Zap className="h-3.5 w-3.5" />
                      {hud.turboRemaining}s
                    </span>
                  )}
                  {hud.magnetRemaining > 0 && (
                    <span className="hidden md:inline-flex items-center gap-1 text-violet-300">
                      <Magnet className="h-3.5 w-3.5" />
                      {hud.magnetRemaining}s
                    </span>
                  )}
                </div>
              )}

              <div className="w-24 sm:w-32">
                <div className="mb-0.5 flex items-center justify-between text-[11px]">
                  <span className="inline-flex items-center gap-1 font-medium text-[#D6CBC0]">
                    <Siren className="h-3 w-3 text-red-400" />
                    <span className="hidden sm:inline">Police</span>
                  </span>
                  <span className={`font-mono font-bold tabular-nums ${dangerTextColor}`}>
                    {dangerLabel}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/50">
                  <div
                    className={`h-full transition-all duration-150 ${dangerBarColor}`}
                    style={{ width: `${Math.min(100, Math.max(8, hud.policeDanger))}%` }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggleMute}
                aria-label={muted ? 'Activer le son' : 'Couper le son'}
                title={muted ? 'Activer le son (M)' : 'Couper le son (M)'}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#261E1A] text-[#FAF5EE] hover:bg-[#342924] transition-colors"
              >
                {muted ? (
                  <VolumeX className="h-4 w-4 text-[#B8ABA0]" />
                ) : (
                  <Volume2 className="h-4 w-4 text-amber-400" />
                )}
              </button>

              <button
                type="button"
                onClick={handleToggleFullscreen}
                aria-label={isNativeFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
                title={isNativeFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#261E1A] text-[#FAF5EE] hover:bg-[#342924] transition-colors"
              >
                {isNativeFullscreen ? (
                  <Minimize2 className="h-4 w-4 text-amber-400" />
                ) : (
                  <Maximize2 className="h-4 w-4 text-[#D6CBC0]" />
                )}
              </button>

              <button
                type="button"
                onClick={togglePause}
                aria-label={isMultiplayerMode ? 'Quitter la course WiFi' : 'Pause'}
                title={isMultiplayerMode ? 'Quitter la course WiFi' : 'Pause (P)'}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 text-xs font-bold text-[#161210] hover:bg-amber-400 transition-colors whitespace-nowrap"
              >
                {isMultiplayerMode ? <X className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                <span className="hidden sm:inline">
                  {isMultiplayerMode ? 'Quitter' : 'Pause'}
                </span>
              </button>
            </div>
          </header>
        )}

        {/* Live Multiplayer Mini-Standings Strip */}
        {gameState === 'PLAYING' &&
          isMultiplayerMode &&
          !mpLocalEliminated &&
          !isCountdownActive &&
          liveMultiplayerStandings.length > 0 && (
            <div className="pointer-events-none fixed inset-x-0 top-[74px] sm:top-20 z-20 flex justify-center px-3">
              <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-[#161210]/88 px-2.5 py-1.5 text-[11px] font-mono shadow-lg">
                {liveMultiplayerStandings.map((p, idx) => (
                  <span
                    key={p.id}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 ${
                      p.isMe ? 'bg-white/12 font-extrabold text-[#FAF5EE]' : 'text-[#D6CBC0]'
                    } ${!p.isAlive ? 'opacity-50 line-through' : ''}`}
                  >
                    <span className="text-amber-300 font-bold">{idx + 1}.</span>
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: p.colorHex }}
                      aria-hidden="true"
                    />
                    <span className="max-w-[76px] truncate">{p.name}</span>
                    <span className="tabular-nums text-amber-400">{p.distanceMeters}m</span>
                  </span>
                ))}
              </div>
            </div>
          )}

        {/* Multiplayer Eliminated Spectator Waiting Overlay */}
        {gameState === 'PLAYING' && isMultiplayerMode && mpLocalEliminated && (
          <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#140F0D]/72 px-4">
            <div className="w-full max-w-md rounded-2xl border border-orange-500/45 bg-[#1C1613]/96 p-5 text-center shadow-2xl">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-orange-400">
                <Wifi className="h-3.5 w-3.5" />
                <span>Course WiFi en cours</span>
              </div>
              <h2 className="mt-1 font-display text-2xl font-extrabold text-[#FAF5EE]">
                Attrapé à {hud.distanceMeters} m !
              </h2>
              <p className="mt-1 text-xs text-[#D6CBC0]">
                Tes potes courent encore… Le classement final 1er–4e arrive dès la fin !
              </p>

              <div className="mt-4 space-y-1.5 text-left">
                {liveMultiplayerStandings.map((p, idx) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-[#14100E] px-3 py-2 text-xs font-mono"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-amber-300">{idx + 1}.</span>
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: p.colorHex }}
                      />
                      <span className="font-sans font-bold text-[#FAF5EE] truncate">{p.name}</span>
                      <span className="text-[10px] text-[#B8ABA0]">
                        {p.isAlive ? 'En course' : 'Stoppé'}
                      </span>
                    </div>
                    <span className="font-bold text-amber-400 tabular-nums">
                      {p.distanceMeters} m
                    </span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={returnToMenu}
                className="mt-4 inline-flex min-h-[42px] w-full items-center justify-center rounded-xl border border-white/15 bg-[#261E1A] px-4 text-xs font-bold text-[#D6CBC0] hover:bg-[#342924] transition-colors"
              >
                Quitter la course WiFi
              </button>
            </div>
          </div>
        )}

        {/* 3-Second Resume / Restart Countdown Overlay */}
        {gameState === 'PLAYING' && isCountdownActive && (
          <div
            role="status"
            aria-live="assertive"
            aria-label={`Reprise dans ${resumeCountdown} secondes`}
            className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center bg-black/45 px-4"
          >
            <div className="flex flex-col items-center rounded-3xl border border-amber-400/50 bg-[#18120F]/92 px-9 py-6 text-center shadow-2xl">
              <span className="text-xs font-bold uppercase tracking-widest text-amber-300">
                {isMultiplayerMode ? 'Départ WiFi synchronisé' : 'Préparez-vous'}
              </span>
              <span className="mt-1 font-display text-6xl sm:text-7xl font-black tabular-nums text-amber-400 drop-shadow">
                {resumeCountdown}
              </span>
              <span className="mt-1.5 text-xs text-[#D6CBC0]">
                {isMultiplayerMode
                  ? `Départ de la course dans ${resumeCountdown} s…`
                  : `Reprise de la course dans ${resumeCountdown} s…`}
              </span>
            </div>
          </div>
        )}

        {/* In-Game Level Banner & Collectible Flash */}
        {gameState === 'PLAYING' && !isCountdownActive && (hud.bannerText || hud.flashText) && (
          <div className="pointer-events-none fixed inset-x-0 top-28 sm:top-32 z-20 flex flex-col items-center gap-1.5 px-4">
            {hud.bannerText && (
              <div className="rounded-xl border border-amber-400/50 bg-[#161210]/92 px-4 py-1.5 text-center font-display text-sm sm:text-base font-extrabold text-amber-400 shadow-lg">
                {hud.bannerText}
              </div>
            )}
            {hud.flashText && (
              <div className="rounded-lg bg-[#161210]/88 px-3 py-1 text-center font-mono text-xs sm:text-sm font-bold text-emerald-300 shadow">
                {hud.flashText}
              </div>
            )}
          </div>
        )}

        {/* Persistent Top Bar on Menu / Pause / Game Over: Gold Coins + Cagnotte + Utilities */}
        {gameState !== 'PLAYING' && (
          <div className="fixed top-2.5 inset-x-2.5 z-30 flex items-center justify-between gap-2 sm:top-4 sm:inset-x-4 pointer-events-none">
            {/* Top-Left Wallet: Gold Shop Coins + Cagnotte F CFA + Quick Converter */}
            <div className="pointer-events-auto flex items-center gap-2.5 sm:gap-3 rounded-xl border border-orange-500/30 bg-[#17110E]/95 px-3 py-2 font-mono tabular-nums shadow-lg">
              <div className="flex items-center gap-1.5">
                <Coins className="h-4 w-4 text-amber-400 shrink-0" />
                <div className="leading-tight">
                  <div className="text-[10px] text-[#B8ABA0]">Pièces d’or</div>
                  <div className="text-xs sm:text-sm font-extrabold text-amber-400">
                    {totalShopCoins.toLocaleString('fr-FR')}
                  </div>
                </div>
              </div>

              <div className="h-6 w-px bg-white/10" aria-hidden="true" />

              <div className="flex items-center gap-1.5">
                <Wallet className="h-4 w-4 text-orange-400 shrink-0" />
                <div className="leading-tight">
                  <div className="text-[10px] text-[#B8ABA0]">Cagnotte</div>
                  <div className="text-xs sm:text-sm font-bold text-[#FAF5EE]">
                    {totalBankCfa.toLocaleString('fr-FR')} F CFA
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setIsConverterOpen(true);
                }}
                title="Transformer la cagnotte F CFA en pièces d'or"
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-amber-400/40 bg-amber-500/15 px-2 sm:px-2.5 font-sans text-[11px] font-bold text-amber-300 hover:bg-amber-500/25 transition-colors whitespace-nowrap"
              >
                <ArrowRightLeft className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">Convertir</span>
              </button>
            </div>

            {/* Top-Right Utilities */}
            <div className="pointer-events-auto flex items-center gap-2">
              <PWAInstallButton compact />
              <button
                type="button"
                onClick={handleToggleMute}
                aria-label={muted ? 'Activer le son' : 'Couper le son'}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-[#1C1613]/95 px-3 text-xs font-semibold text-[#FAF5EE] hover:bg-[#2A211D] transition-colors whitespace-nowrap"
              >
                {muted ? (
                  <VolumeX className="h-4 w-4 text-[#B8ABA0]" />
                ) : (
                  <Volume2 className="h-4 w-4 text-amber-400" />
                )}
                <span className="hidden sm:inline">{muted ? 'Muet' : 'Son'}</span>
              </button>

              <button
                type="button"
                onClick={handleToggleFullscreen}
                aria-label={isNativeFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-[#1C1613]/95 px-3 text-xs font-semibold text-[#FAF5EE] hover:bg-[#2A211D] transition-colors whitespace-nowrap"
              >
                {isNativeFullscreen ? (
                  <Minimize2 className="h-4 w-4 text-amber-400" />
                ) : (
                  <Maximize2 className="h-4 w-4 text-[#D6CBC0]" />
                )}
                <span className="hidden sm:inline">
                  {isNativeFullscreen ? 'Réduire' : 'Plein écran'}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* TITLE MENU OVERLAY (Full Screen + All Options Visible) */}
        {gameState === 'TITLE_MENU' && !isTutorialOpen && (
          <div className="fixed inset-0 z-20 flex items-center justify-center overflow-y-auto bg-[#120D0B]/74 px-4 pt-16 pb-4">
            <div className="my-auto w-full max-w-3xl text-center">
              <p className="text-xs font-medium tracking-wide text-amber-400 mb-1">
                Rood-Woko · Ouagadougou 3D · 60 quartiers · Niveaux 1 à ∞
              </p>
              <h1
                className={`font-display font-extrabold tracking-tight text-[#FAF5EE] text-balance ${
                  isCompactHeight ? 'text-2xl sm:text-4xl' : 'text-3xl sm:text-5xl'
                }`}
              >
                Cavale à Ouaga
              </h1>
              <p className="mt-1 font-display text-sm sm:text-base font-extrabold tracking-wide text-orange-400">
                Didi LAD game
              </p>
              {!isCompactHeight && (
                <p className="mx-auto mt-2 max-w-lg text-sm sm:text-base text-[#D6CBC0] leading-relaxed">
                  Fuyez la police à moto sur 3 voies depuis le grand marché de Rood-Woko : esquivez
                  trains, bus, taxis verts et barrières à travers Ouagadougou.
                </p>
              )}

              {/* Active Character & Record Strip */}
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5 text-xs text-[#E5DBD0] font-mono tabular-nums">
                <span className="text-orange-300 font-semibold">
                  {equippedCharacterObj.name} · {equippedOutfitObj.name}
                </span>
                <span aria-hidden="true">·</span>
                <span>Record : Niv. {progress.bestLevel}</span>
                <span aria-hidden="true">·</span>
                <span>Meilleur score : {progress.bestScore.toLocaleString('fr-FR')}</span>
              </div>

              {/* Starting Level & Quartier Stepper */}
              <div className="mt-3.5 inline-flex flex-col items-center">
                <div className="mb-1 text-xs font-medium text-[#B8ABA0]">
                  Quartier de départ
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-[#1B1512]/95 p-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setStartLevel((lvl) => Math.max(1, lvl - 1));
                    }}
                    disabled={startLevel <= 1}
                    aria-label="Niveau précédent"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#2A211D] text-[#FAF5EE] hover:bg-[#382D28] disabled:opacity-35 transition-colors"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>

                  <div className="min-w-[205px] sm:min-w-[265px] px-3 text-center">
                    <div className="font-display text-sm sm:text-base font-bold text-amber-400">
                      Niveau {selectedLevelCfg.level} · {selectedLevelCfg.displayName}
                    </div>
                    <div className="text-xs text-[#B8ABA0] truncate">
                      {selectedLevelCfg.quartier.arrondissement} ·{' '}
                      <span className="font-mono tabular-nums text-[#E5DBD0]">
                        {selectedLevelCfg.lengthMeters.toLocaleString('fr-FR')} m
                      </span>{' '}
                      ·{' '}
                      <span
                        className={
                          selectedLevelSongInfo.isOverridden ? 'text-emerald-300 font-semibold' : ''
                        }
                      >
                        ♪ {selectedLevelSongInfo.label}
                      </span>
                    </div>
                    <div className="mt-0.5 inline-flex items-center justify-center gap-1.5 text-[11px] font-medium">
                      {(() => {
                        const w: WeatherKind = selectedLevelCfg.quartier.weather;
                        const wMeta = getWeatherMeta(w);
                        return (
                          <span
                            className={`inline-flex items-center gap-1 ${
                              w === 'PLUIE'
                                ? 'text-sky-300'
                                : w === 'HARMATTAN'
                                  ? 'text-orange-300'
                                  : 'text-yellow-300'
                            }`}
                          >
                            {w === 'PLUIE' ? (
                              <CloudRain className="h-3 w-3 shrink-0" />
                            ) : w === 'HARMATTAN' ? (
                              <Wind className="h-3 w-3 shrink-0" />
                            ) : (
                              <Sun className="h-3 w-3 shrink-0" />
                            )}
                            <span>Météo : {wMeta.label}</span>
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setStartLevel((lvl) => Math.min(progress.bestLevel, lvl + 1));
                    }}
                    disabled={startLevel >= progress.bestLevel}
                    aria-label="Niveau suivant"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#2A211D] text-[#FAF5EE] hover:bg-[#382D28] disabled:opacity-35 transition-colors"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-[#A89B90]">
                  Niveaux débloqués : 1 à {progress.bestLevel} · Terminez le niveau{' '}
                  {progress.bestLevel} pour passer au {progress.bestLevel + 1}
                </p>
              </div>

              {/* Primary Actions: SOLO + WIFI LOCAL MULTIPLAYER + BOUTIQUE */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (isMultiplayerMode || mp.room) {
                      mp.leaveRoom();
                      setIsMultiplayerMode(false);
                      setMpLocalEliminated(false);
                    }
                    startRun();
                  }}
                  className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 sm:px-7 py-3 text-sm sm:text-base font-extrabold text-[#161210] hover:bg-amber-400 active:scale-[0.98] transition-all whitespace-nowrap shrink-0 shadow-lg shadow-amber-500/20"
                >
                  <Play className="h-5 w-5 fill-current" />
                  <span>SOLO · Niveau {startLevel}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setIsMultiplayerOpen(true);
                  }}
                  className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-xl border-2 border-emerald-400/80 bg-emerald-600 px-5 sm:px-6 py-3 text-sm sm:text-base font-extrabold text-[#FAF5EE] hover:bg-emerald-500 active:scale-[0.98] transition-all whitespace-nowrap shrink-0 shadow-lg shadow-emerald-600/25"
                >
                  <Users className="h-5 w-5 shrink-0" />
                  <span>JOUER AVEC MES POTES / WIFI LOCAL</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setIsShopOpen(true);
                  }}
                  className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-xl border-2 border-orange-400 bg-orange-600 px-6 py-3 text-sm sm:text-base font-extrabold text-[#FAF5EE] hover:bg-orange-500 active:scale-[0.98] transition-all whitespace-nowrap shrink-0 shadow-lg shadow-orange-600/25"
                >
                  <ShoppingCart className="h-5 w-5" />
                  <span>BOUTIQUE</span>
                </button>
              </div>

              {/* All Menu Options Directly Visible */}
              <nav
                aria-label="Options du menu principal"
                className="mt-4 grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:justify-center"
              >
                <button
                  type="button"
                  onClick={handleOpenDailyModal}
                  className={`inline-flex min-h-[44px] sm:min-w-[162px] items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                    dailySummary.claimableCount > 0
                      ? 'border-amber-400/70 bg-[#2C1F14]/95 text-amber-300 hover:bg-[#3A281A]'
                      : 'border-white/15 bg-[#1F1815]/95 text-[#FAF5EE] hover:bg-[#2D231E]'
                  }`}
                >
                  <CalendarCheck className="h-4 w-4 text-amber-400 shrink-0" />
                  <span className="tabular-nums">
                    Défis ({dailySummary.completedCount}/3)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setIsLeaderboardOpen(true);
                  }}
                  className="inline-flex min-h-[44px] sm:min-w-[162px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#1F1815]/95 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-[#FAF5EE] hover:bg-[#2D231E] transition-colors whitespace-nowrap"
                >
                  <Medal className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>Classement</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    openMusicSelectorForLevel(startLevel);
                  }}
                  className="inline-flex min-h-[44px] sm:min-w-[162px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#1F1815]/95 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-[#FAF5EE] hover:bg-[#2D231E] transition-colors whitespace-nowrap"
                >
                  <Music className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Chansons</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setIsMapOpen(true);
                  }}
                  className="inline-flex min-h-[44px] sm:min-w-[162px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#1F1815]/95 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-[#FAF5EE] hover:bg-[#2D231E] transition-colors whitespace-nowrap"
                >
                  <MapIcon className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>Carte de Ouaga</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setIsQuartiersOpen(true);
                  }}
                  className="inline-flex min-h-[44px] sm:min-w-[162px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#1F1815]/95 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-[#FAF5EE] hover:bg-[#2D231E] transition-colors whitespace-nowrap"
                >
                  <MapPin className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>60 Quartiers</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setIsAchievementsOpen(true);
                  }}
                  className="inline-flex min-h-[44px] sm:min-w-[162px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#1F1815]/95 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-[#FAF5EE] hover:bg-[#2D231E] transition-colors whitespace-nowrap"
                >
                  <Trophy className="h-4 w-4 text-amber-400 shrink-0" />
                  <span className="tabular-nums">
                    Succès ({unlockedAchievementsCount}/{ACHIEVEMENTS.length})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.unlock();
                    soundEngine.playClick();
                    setLastTutorialAction(null);
                    setIsTutorialOpen(true);
                  }}
                  className="inline-flex min-h-[44px] sm:min-w-[162px] items-center justify-center gap-2 rounded-xl border border-amber-400/50 bg-[#2A1D12]/95 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-amber-300 hover:bg-[#382718] transition-colors whitespace-nowrap"
                >
                  <GraduationCap className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>Tutoriel</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setIsOptionsOpen(true);
                  }}
                  className="inline-flex min-h-[44px] sm:min-w-[162px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#1F1815]/95 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-[#FAF5EE] hover:bg-[#2D231E] transition-colors whitespace-nowrap"
                >
                  <SlidersHorizontal className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>Options &amp; Aide</span>
                </button>

                <PWAInstallButton variant="menu" alwaysShowOnMenu />
              </nav>
            </div>
          </div>
        )}

        {/* PAUSED OVERLAY (With All Options Accessible) */}
        {gameState === 'PAUSED' && (
          <div className="fixed inset-0 z-20 flex items-center justify-center overflow-y-auto bg-[#140F0D]/85 px-4 pt-16 pb-4">
            <div className="my-auto w-full max-w-md rounded-2xl border border-white/15 bg-[#221B18] p-6 text-center shadow-2xl">
              <h2 className="font-display text-2xl font-bold text-[#FAF5EE]">Course en pause</h2>
              <p className="mt-1.5 text-sm text-[#B8ABA0]">
                Niveau {hud.level} · {hud.quartierName} ({hud.distanceMeters} m)
              </p>
              <p className="mt-1 font-mono text-xs text-amber-400 tabular-nums">
                Cagnotte enregistrée : {totalBankCfa.toLocaleString('fr-FR')} FCFA
              </p>

              <div className="mt-5 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={togglePause}
                  className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-[#161210] hover:bg-amber-400 transition-colors whitespace-nowrap"
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>Reprendre</span>
                </button>
                <button
                  type="button"
                  onClick={() => startRun(undefined, true)}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#2C231F] px-5 py-2.5 text-sm font-semibold text-[#FAF5EE] hover:bg-[#382D28] transition-colors whitespace-nowrap"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Recommencer</span>
                </button>
              </div>

              {/* Pause Menu Options Grid */}
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={handleToggleMute}
                  className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#181311] px-3 py-2 text-xs font-semibold text-[#FAF5EE] hover:bg-[#2C231F] transition-colors whitespace-nowrap"
                >
                  {muted ? (
                    <VolumeX className="h-4 w-4 text-[#B8ABA0]" />
                  ) : (
                    <Volume2 className="h-4 w-4 text-amber-400" />
                  )}
                  <span>{muted ? 'Son : Muet' : 'Son : Activé'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleToggleFullscreen}
                  className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#181311] px-3 py-2 text-xs font-semibold text-[#FAF5EE] hover:bg-[#2C231F] transition-colors whitespace-nowrap"
                >
                  {isNativeFullscreen ? (
                    <Minimize2 className="h-4 w-4 text-amber-400" />
                  ) : (
                    <Maximize2 className="h-4 w-4 text-amber-400" />
                  )}
                  <span>{isNativeFullscreen ? 'Quitter écran' : 'Plein écran'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setIsAchievementsOpen(true);
                  }}
                  className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#181311] px-3 py-2 text-xs font-semibold text-[#FAF5EE] hover:bg-[#2C231F] transition-colors whitespace-nowrap"
                >
                  <Trophy className="h-4 w-4 text-amber-400" />
                  <span>
                    Succès ({unlockedAchievementsCount}/{ACHIEVEMENTS.length})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setIsOptionsOpen(true);
                  }}
                  className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#181311] px-3 py-2 text-xs font-semibold text-[#FAF5EE] hover:bg-[#2C231F] transition-colors whitespace-nowrap"
                >
                  <SlidersHorizontal className="h-4 w-4 text-amber-400" />
                  <span>Options &amp; Aide</span>
                </button>
              </div>

              <button
                type="button"
                onClick={returnToMenu}
                className="mt-3 inline-flex min-h-[40px] w-full items-center justify-center rounded-xl px-5 py-2 text-xs font-medium text-[#B8ABA0] hover:text-[#FAF5EE] transition-colors whitespace-nowrap"
              >
                Retour au menu principal
              </button>
            </div>
          </div>
        )}

        {/* LEVEL COMPLETE OVERLAY */}
        {gameState === 'LEVEL_COMPLETE' && (
          <div className="fixed inset-0 z-20 flex items-center justify-center overflow-y-auto bg-[#140F0D]/88 px-4 pt-16 pb-4">
            <div className="my-auto w-full max-w-md rounded-2xl border border-amber-500/35 bg-[#221B18] p-6 sm:p-7 text-center shadow-2xl">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400">
                <Flag className="h-4 w-4" />
                <span>
                  Niveau {hud.level} · {hud.quartierName}
                </span>
              </div>

              <h2 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold text-[#FAF5EE]">
                Niveau {hud.level} terminé !
              </h2>
              <p className="mt-1.5 text-sm text-[#D6CBC0]">
                Quartier traversé ({hud.levelMetersTotal.toLocaleString('fr-FR')} m) · Prochain :{' '}
                <span className="font-semibold text-amber-400">
                  Niv. {hud.level + 1} · {getLevelConfig(hud.level + 1).displayName}
                </span>
              </p>

              {isNewRecord ? (
                <p className="mt-2.5 text-sm font-bold text-amber-400">
                  Nouveau record personnel !
                </p>
              ) : lastLeaderboardRank !== null ? (
                <p className="mt-2.5 text-xs font-bold text-amber-300">
                  Classé #{lastLeaderboardRank} au Classement Local !
                </p>
              ) : null}

              {recentUnlockedIds.length > 0 && (
                <p className="mt-2 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-400">
                  <Trophy className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Succès débloqué :{' '}
                    {recentUnlockedIds
                      .map((id) => getAchievementById(id)?.title)
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                </p>
              )}

              <div className="mt-4 grid grid-cols-2 gap-4 border-y border-white/10 py-4 sm:grid-cols-4">
                <div>
                  <div className="text-xs text-[#B8ABA0]">Score</div>
                  <div className="mt-0.5 font-mono text-lg font-bold tabular-nums text-[#FAF5EE]">
                    {hud.score.toLocaleString('fr-FR')}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#B8ABA0]">Distance</div>
                  <div className="mt-0.5 font-mono text-lg font-bold tabular-nums text-[#FAF5EE]">
                    {hud.distanceMeters} m
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#B8ABA0]">Pièces d’or</div>
                  <div className="mt-0.5 font-mono text-lg font-bold tabular-nums text-amber-300">
                    +{hud.coinsCollected.toLocaleString('fr-FR')}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#B8ABA0]">Gagné</div>
                  <div className="mt-0.5 font-mono text-lg font-bold tabular-nums text-emerald-400">
                    +{hud.lootCfa.toLocaleString('fr-FR')} F
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => startRun(hud.level)}
                  className="inline-flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#2C231F] px-5 py-2.5 text-sm font-bold text-[#FAF5EE] hover:bg-[#382D28] active:scale-[0.98] transition-all whitespace-nowrap"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Rejouer</span>
                </button>
                <button
                  type="button"
                  onClick={() => startRun(hud.level + 1)}
                  className="inline-flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-extrabold text-[#161210] hover:bg-amber-400 active:scale-[0.98] transition-all whitespace-nowrap shadow-lg shadow-amber-500/20"
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>Continuer</span>
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setIsShopOpen(true);
                  }}
                  className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-orange-500/40 bg-[#281A14] px-2.5 py-1.5 text-xs font-bold text-orange-300 hover:bg-[#352119] transition-colors whitespace-nowrap"
                >
                  <ShoppingCart className="h-3.5 w-3.5 text-orange-400" />
                  <span>Boutique</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setIsMapOpen(true);
                  }}
                  className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-[#181311] px-2.5 py-1.5 text-xs font-semibold text-[#D6CBC0] hover:bg-[#2C231F] hover:text-[#FAF5EE] transition-colors whitespace-nowrap"
                >
                  <MapIcon className="h-3.5 w-3.5 text-amber-400" />
                  <span>Carte</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setIsLeaderboardOpen(true);
                  }}
                  className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-[#181311] px-2.5 py-1.5 text-xs font-semibold text-[#D6CBC0] hover:bg-[#2C231F] hover:text-[#FAF5EE] transition-colors whitespace-nowrap"
                >
                  <Medal className="h-3.5 w-3.5 text-amber-400" />
                  <span>Classement</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setIsAchievementsOpen(true);
                  }}
                  className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-[#181311] px-2.5 py-1.5 text-xs font-semibold text-[#D6CBC0] hover:bg-[#2C231F] hover:text-[#FAF5EE] transition-colors whitespace-nowrap"
                >
                  <Trophy className="h-3.5 w-3.5 text-amber-400" />
                  <span>Succès</span>
                </button>
                <button
                  type="button"
                  onClick={returnToMenu}
                  className="col-span-2 sm:col-span-4 inline-flex min-h-[38px] items-center justify-center rounded-lg border border-white/10 bg-[#181311] px-2.5 py-1.5 text-xs font-semibold text-[#D6CBC0] hover:bg-[#2C231F] hover:text-[#FAF5EE] transition-colors whitespace-nowrap"
                >
                  <span>Retour au menu principal</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* GAME OVER OVERLAY */}
        {gameState === 'GAME_OVER' && (
          <div className="fixed inset-0 z-20 flex items-center justify-center overflow-y-auto bg-[#140F0D]/88 px-4 pt-16 pb-4">
            <div className="my-auto w-full max-w-md rounded-2xl border border-white/15 bg-[#221B18] p-6 sm:p-7 text-center shadow-2xl">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-red-400">
                <Siren className="h-4 w-4" />
                <span>
                  Niveau {hud.level} · {hud.quartierName}
                </span>
              </div>

              <h2 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold text-[#FAF5EE]">
                Attrapé par la police !
              </h2>
              <p className="mt-1.5 text-sm text-[#D6CBC0]">{hud.arrestReason}</p>

              {isNewRecord ? (
                <p className="mt-2.5 text-sm font-bold text-amber-400">
                  Nouveau record personnel !
                </p>
              ) : lastLeaderboardRank !== null ? (
                <p className="mt-2.5 text-xs font-bold text-amber-300">
                  Classé #{lastLeaderboardRank} au Classement Local !
                </p>
              ) : null}

              {recentUnlockedIds.length > 0 && (
                <p className="mt-2 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-400">
                  <Trophy className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Succès débloqué :{' '}
                    {recentUnlockedIds
                      .map((id) => getAchievementById(id)?.title)
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                </p>
              )}

              <div className="mt-4 grid grid-cols-2 gap-4 border-y border-white/10 py-4 sm:grid-cols-4">
                <div>
                  <div className="text-xs text-[#B8ABA0]">Score</div>
                  <div className="mt-0.5 font-mono text-lg font-bold tabular-nums text-[#FAF5EE]">
                    {hud.score.toLocaleString('fr-FR')}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#B8ABA0]">Distance</div>
                  <div className="mt-0.5 font-mono text-lg font-bold tabular-nums text-[#FAF5EE]">
                    {hud.distanceMeters} m
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#B8ABA0]">Pièces d’or</div>
                  <div className="mt-0.5 font-mono text-lg font-bold tabular-nums text-amber-300">
                    +{hud.coinsCollected.toLocaleString('fr-FR')}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#B8ABA0]">Gagné</div>
                  <div className="mt-0.5 font-mono text-lg font-bold tabular-nums text-emerald-400">
                    +{hud.lootCfa.toLocaleString('fr-FR')} F
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => startRun()}
                  className="inline-flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-bold text-[#161210] hover:bg-amber-400 active:scale-[0.98] transition-all whitespace-nowrap"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Rejouer</span>
                </button>
                <button
                  type="button"
                  onClick={returnToMenu}
                  className="inline-flex min-h-[46px] items-center justify-center rounded-xl border border-white/15 bg-[#2C231F] px-5 py-2.5 text-sm font-semibold text-[#FAF5EE] hover:bg-[#382D28] transition-colors whitespace-nowrap"
                >
                  Menu
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setIsShopOpen(true);
                  }}
                  className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-orange-500/40 bg-[#281A14] px-2.5 py-1.5 text-xs font-bold text-orange-300 hover:bg-[#352119] transition-colors whitespace-nowrap"
                >
                  <ShoppingCart className="h-3.5 w-3.5 text-orange-400" />
                  <span>Boutique</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setIsMapOpen(true);
                  }}
                  className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-[#181311] px-2.5 py-1.5 text-xs font-semibold text-[#D6CBC0] hover:bg-[#2C231F] hover:text-[#FAF5EE] transition-colors whitespace-nowrap"
                >
                  <MapIcon className="h-3.5 w-3.5 text-amber-400" />
                  <span>Carte</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setIsLeaderboardOpen(true);
                  }}
                  className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-[#181311] px-2.5 py-1.5 text-xs font-semibold text-[#D6CBC0] hover:bg-[#2C231F] hover:text-[#FAF5EE] transition-colors whitespace-nowrap"
                >
                  <Medal className="h-3.5 w-3.5 text-amber-400" />
                  <span>Classement</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setIsAchievementsOpen(true);
                  }}
                  className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-[#181311] px-2.5 py-1.5 text-xs font-semibold text-[#D6CBC0] hover:bg-[#2C231F] hover:text-[#FAF5EE] transition-colors whitespace-nowrap"
                >
                  <Trophy className="h-3.5 w-3.5 text-amber-400" />
                  <span>Succès</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setIsOptionsOpen(true);
                  }}
                  className="col-span-2 sm:col-span-4 inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-[#181311] px-2.5 py-1.5 text-xs font-semibold text-[#D6CBC0] hover:bg-[#2C231F] hover:text-[#FAF5EE] transition-colors whitespace-nowrap"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 text-amber-400" />
                  <span>Options</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edge-Anchored 3D Touch Controls on Touch Devices During Gameplay */}
        {viewport.isTouch && gameState === 'PLAYING' && !mpLocalEliminated && (
          <>
            <div className="fixed bottom-4 left-3 z-30 flex items-center gap-2">
              <button
                type="button"
                aria-label="Voie de gauche"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  canvasHandleRef.current?.moveLeft();
                }}
                className="inline-flex h-14 w-14 items-center justify-center rounded-xl border border-white/25 bg-[#161210]/85 text-[#FAF5EE] active:bg-amber-500 active:text-[#161210] select-none shadow-lg"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                aria-label="Voie de droite"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  canvasHandleRef.current?.moveRight();
                }}
                className="inline-flex h-14 w-14 items-center justify-center rounded-xl border border-white/25 bg-[#161210]/85 text-[#FAF5EE] active:bg-amber-500 active:text-[#161210] select-none shadow-lg"
              >
                <ArrowRight className="h-6 w-6" />
              </button>
            </div>

            <div className="fixed bottom-4 right-3 z-30 flex items-center gap-2">
              <button
                type="button"
                aria-label="Glisser et rouler"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  canvasHandleRef.current?.slide();
                }}
                className="inline-flex h-14 min-w-[92px] items-center justify-center gap-1.5 rounded-xl border border-white/25 bg-[#161210]/85 px-3 text-xs sm:text-sm font-bold text-[#FAF5EE] active:bg-amber-500 active:text-[#161210] select-none shadow-lg"
              >
                <ArrowDown className="h-5 w-5" />
                <span>Glisser</span>
              </button>
              <button
                type="button"
                aria-label="Sauter"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  canvasHandleRef.current?.jump();
                }}
                className="inline-flex h-14 min-w-[94px] items-center justify-center gap-1.5 rounded-xl bg-amber-500/95 px-3.5 text-xs sm:text-sm font-bold text-[#161210] active:bg-amber-400 select-none shadow-lg"
              >
                <ArrowUp className="h-5 w-5" />
                <span>Sauter</span>
              </button>
            </div>
          </>
        )}

        {/* In-Run Consumables Bar & Tap-to-Choose Drawer (Juices & Protections) */}
        {gameState === 'PLAYING' &&
          !anyModalOpen &&
          !isCountdownActive &&
          !mpLocalEliminated &&
          !isBoostPickerOpen && (
            <div
              className={`fixed left-3 z-30 flex flex-wrap items-center gap-2 ${
                viewport.isTouch ? 'bottom-20' : 'bottom-4'
              }`}
            >
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={handleScreenTap}
                title="Choisir un jus ou une protection (ou tapotez 2× l'écran)"
                className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-amber-400/50 bg-[#1B1410]/92 px-3 py-2 text-xs font-extrabold text-[#FAF5EE] shadow-lg hover:bg-[#2A1E17] active:scale-[0.97] transition-all whitespace-nowrap"
              >
                <CupSoda className="h-4 w-4 text-amber-400 shrink-0" />
                <Shield className="h-4 w-4 text-sky-400 -ml-1 shrink-0" />
                <span>Jus & Protections</span>
              </button>

              {activeRunJuice && totalJuiceStock > 0 && (
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={handleUseJuiceInRun}
                  title={`Boire ${activeRunJuice.name} (Touche 1)`}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-amber-400/60 bg-[#1F150E]/92 px-3 py-2 text-xs font-extrabold text-amber-300 shadow-lg hover:bg-[#2E1E12] active:scale-[0.97] transition-all whitespace-nowrap"
                >
                  <CupSoda className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>{activeRunJuice.name}</span>
                  <span className="rounded bg-amber-400 px-1.5 py-0.5 font-mono text-[11px] font-extrabold text-[#140E0C]">
                    ×{totalJuiceStock}
                  </span>
                  {!viewport.isTouch && (
                    <span className="font-mono text-[10px] text-[#B8ABA0]">[1]</span>
                  )}
                </button>
              )}

              {activeRunProtection && totalProtectionStock > 0 && (
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={handleUseProtectionInRun}
                  title={`Activer ${activeRunProtection.name} (Touche 2)`}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-sky-400/60 bg-[#0F1B22]/92 px-3 py-2 text-xs font-extrabold text-sky-300 shadow-lg hover:bg-[#162730] active:scale-[0.97] transition-all whitespace-nowrap"
                >
                  <Shield className="h-4 w-4 text-sky-400 shrink-0" />
                  <span>{activeRunProtection.name}</span>
                  <span className="rounded bg-sky-400 px-1.5 py-0.5 font-mono text-[11px] font-extrabold text-[#0B171D]">
                    ×{totalProtectionStock}
                  </span>
                  {!viewport.isTouch && (
                    <span className="font-mono text-[10px] text-[#B8ABA0]">[2]</span>
                  )}
                </button>
              )}
            </div>
          )}

        {/* Interactive Screen-Tap Drawer: User Chooses Which Juice to Drink or Protection to Activate */}
        {gameState === 'PLAYING' &&
          isBoostPickerOpen &&
          !anyModalOpen &&
          !isCountdownActive &&
          !mpLocalEliminated && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Choisir un jus ou une protection"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                soundEngine.playClick();
                setIsBoostPickerOpen(false);
              }}
              className="fixed inset-0 z-40 flex items-center justify-center bg-[#0D0A09]/76 p-3 sm:p-4"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-2xl max-h-[86dvh] flex flex-col overflow-hidden rounded-2xl border border-amber-400/40 bg-[#1A1411] shadow-2xl"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
                  <div>
                    <h2 className="font-display text-base sm:text-lg font-extrabold text-[#FAF5EE]">
                      Choisir quoi boire ou activer
                    </h2>
                    <p className="text-[11px] sm:text-xs text-[#C8BCB1]">
                      {isMultiplayerMode
                        ? 'Course WiFi en direct — choisissez vite votre jus ou protection.'
                        : 'Course en pause pendant votre choix. Consommez votre stock ou achetez en direct.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setIsBoostPickerOpen(false);
                    }}
                    aria-label="Fermer et reprendre la course"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-[#2A211C] text-[#FAF5EE] hover:bg-[#382C25] transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Live Wallet Strip */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#140F0D] px-4 py-2 text-xs font-mono tabular-nums sm:px-5">
                  <span className="inline-flex items-center gap-1.5 text-amber-300 font-bold">
                    <Coins className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <span>{totalShopCoins.toLocaleString('fr-FR')} pièces d’or</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-emerald-300 font-bold">
                    <Wallet className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span>{totalBankCfa.toLocaleString('fr-FR')} F CFA</span>
                  </span>
                </div>

                {/* Juices & Protections Columns */}
                <div className="overflow-y-auto p-3.5 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Juices Section */}
                  <section aria-label="Jus à boire" className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h3 className="flex items-center gap-1.5 font-display text-sm font-extrabold text-amber-300">
                        <CupSoda className="h-4 w-4 text-amber-400 shrink-0" />
                        <span>Jus & Turbo</span>
                      </h3>
                      <span className="text-[11px] font-mono text-[#B8ABA0]">
                        {hud.turboRemaining > 0 ? `Actif : ${hud.turboRemaining}s` : 'Pièces d’or'}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {SHOP_JUICES.map((juice) => {
                        const stock = Math.max(
                          0,
                          Math.floor(progress.juiceInventory?.[juice.id] ?? 0)
                        );
                        const canBuyNow = totalShopCoins >= juice.priceCoins;
                        const canUse = stock > 0 || canBuyNow;

                        return (
                          <button
                            key={juice.id}
                            type="button"
                            disabled={!canUse}
                            onClick={() => handleDrinkSpecificJuice(juice.id)}
                            className={`w-full flex items-center justify-between gap-2.5 rounded-xl border p-2.5 text-left transition-all ${
                              canUse
                                ? 'border-white/15 bg-[#241A14] hover:border-amber-400/70 hover:bg-[#2E2017] active:scale-[0.99]'
                                : 'border-white/8 bg-[#16110F] opacity-55 cursor-not-allowed'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15"
                                style={{ backgroundColor: `${juice.primaryColor}33` }}
                                aria-hidden="true"
                              >
                                <CupSoda
                                  className="h-4 w-4"
                                  style={{ color: juice.accentColor }}
                                />
                              </span>
                              <div className="min-w-0">
                                <div className="text-xs sm:text-sm font-extrabold text-[#FAF5EE] truncate">
                                  {juice.name}
                                </div>
                                <div className="text-[11px] text-[#C8BCB1] truncate">
                                  {juice.subtitle} · +{juice.speedBonus} vit.
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0 text-right">
                              {stock > 0 ? (
                                <span className="inline-flex items-center gap-1 rounded-lg bg-amber-400 px-2.5 py-1 text-[11px] font-extrabold text-[#140E0C]">
                                  Boire (×{stock})
                                </span>
                              ) : (
                                <span
                                  className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 font-mono text-[11px] font-bold ${
                                    canBuyNow
                                      ? 'border border-amber-400/50 bg-amber-500/20 text-amber-300'
                                      : 'border border-white/10 bg-black/30 text-[#9B8E82]'
                                  }`}
                                >
                                  {juice.priceCoins} p.
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  {/* Protections Section */}
                  <section aria-label="Protections anti-choc" className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h3 className="flex items-center gap-1.5 font-display text-sm font-extrabold text-sky-300">
                        <Shield className="h-4 w-4 text-sky-400 shrink-0" />
                        <span>Protections</span>
                      </h3>
                      <span className="text-[11px] font-mono text-[#B8ABA0]">
                        {hud.hasShield
                          ? `Boucliers : ${Math.max(1, hud.shieldCharges)}`
                          : 'Cagnotte F CFA'}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {SHOP_PROTECTIONS.map((prot) => {
                        const stock = Math.max(
                          0,
                          Math.floor(progress.protectionInventory?.[prot.id] ?? 0)
                        );
                        const canBuyNow = totalBankCfa >= prot.priceCfa;
                        const canUse = stock > 0 || canBuyNow;

                        return (
                          <button
                            key={prot.id}
                            type="button"
                            disabled={!canUse}
                            onClick={() => handleActivateSpecificProtection(prot.id)}
                            className={`w-full flex items-center justify-between gap-2.5 rounded-xl border p-2.5 text-left transition-all ${
                              canUse
                                ? 'border-white/15 bg-[#131D22] hover:border-sky-400/70 hover:bg-[#192830] active:scale-[0.99]'
                                : 'border-white/8 bg-[#121618] opacity-55 cursor-not-allowed'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15"
                                style={{ backgroundColor: `${prot.primaryColor}33` }}
                                aria-hidden="true"
                              >
                                <Shield
                                  className="h-4 w-4"
                                  style={{ color: prot.accentColor }}
                                />
                              </span>
                              <div className="min-w-0">
                                <div className="text-xs sm:text-sm font-extrabold text-[#FAF5EE] truncate">
                                  {prot.name}
                                </div>
                                <div className="text-[11px] text-[#C8BCB1] truncate">
                                  {prot.subtitle}
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0 text-right">
                              {stock > 0 ? (
                                <span className="inline-flex items-center gap-1 rounded-lg bg-sky-400 px-2.5 py-1 text-[11px] font-extrabold text-[#0B171D]">
                                  Activer (×{stock})
                                </span>
                              ) : (
                                <span
                                  className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 font-mono text-[11px] font-bold ${
                                    canBuyNow
                                      ? 'border border-sky-400/50 bg-sky-500/20 text-sky-300'
                                      : 'border border-white/10 bg-black/30 text-[#9B8E82]'
                                  }`}
                                >
                                  {prot.priceCfa.toLocaleString('fr-FR')} F
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                </div>

                {/* Footer Action */}
                <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-[#140F0D] px-4 py-2.5 sm:px-5">
                  <span className="text-[11px] text-[#B8ABA0]">
                    Astuce : balayez (haut/bas/gauche/droite) pour esquiver, tapotez pour boire.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setIsBoostPickerOpen(false);
                    }}
                    className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-4 text-xs font-extrabold text-[#161210] hover:bg-amber-400 transition-colors whitespace-nowrap"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>Reprendre</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        {/* Live Achievement Unlock Toast */}
        {toastAchievementTitles.length > 0 && (
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none fixed bottom-20 sm:bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-xl border border-amber-400/50 bg-[#1C1613]/95 px-4 py-2.5 text-center shadow-xl"
          >
            <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-400 whitespace-nowrap">
              <Trophy className="h-4 w-4 shrink-0" />
              <span>Succès débloqué : {toastAchievementTitles.join(' · ')}</span>
            </div>
          </div>
        )}
      </main>

      {/* Menu Option Modals */}
      <MapModal
        isOpen={isMapOpen}
        selectedLevel={startLevel}
        currentPlayingLevel={hud.level}
        bestLevel={progress.bestLevel}
        isPlaying={gameState === 'PLAYING'}
        onSelectLevel={handleSelectStartLevel}
        onStartAtLevel={startRun}
        onClose={handleCloseModal}
      />

      <QuartiersModal
        isOpen={isQuartiersOpen}
        startLevel={startLevel}
        activeLevel={hud.level}
        isPlaying={gameState === 'PLAYING'}
        bestLevel={progress.bestLevel}
        levelSongMap={levelSongMap}
        customSongs={customSongs}
        onStartAtLevel={startRun}
        onOpenMusicForLevel={openMusicSelectorForLevel}
        onClose={handleCloseModal}
      />

      <AchievementsModal
        isOpen={isAchievementsOpen}
        progress={progress}
        onClose={handleCloseModal}
      />

      <LeaderboardModal
        isOpen={isLeaderboardOpen}
        progress={progress}
        highlightEntryId={lastLeaderboardEntryId}
        canStartRun={
          gameState === 'TITLE_MENU' ||
          gameState === 'GAME_OVER' ||
          gameState === 'LEVEL_COMPLETE'
        }
        onPlayNow={() => startRun()}
        onResetLeaderboard={handleResetLeaderboard}
        onClose={handleCloseModal}
      />

      <DailyChallengesModal
        isOpen={isDailyOpen}
        progress={progress}
        canQuickAction={gameState === 'TITLE_MENU' || gameState === 'GAME_OVER' || gameState === 'LEVEL_COMPLETE'}
        onClaimReward={handleClaimDailyChallenge}
        onOpenShop={() => {
          soundEngine.playClick();
          setIsDailyOpen(false);
          setIsShopOpen(true);
        }}
        onPlayNow={() => startRun()}
        onClose={handleCloseModal}
      />

      <OptionsModal
        isOpen={isOptionsOpen}
        muted={muted}
        isNativeFullscreen={isNativeFullscreen}
        startLevel={startLevel}
        onToggleMute={handleToggleMute}
        onToggleFullscreen={handleToggleFullscreen}
        onOpenMusicSelector={openMusicSelectorForLevel}
        onClose={handleCloseModal}
      />

      <MusicSelectorModal
        isOpen={isMusicOpen}
        initialLevel={musicModalInitialLevel}
        bestLevel={progress.bestLevel}
        muted={muted}
        customSongs={customSongs}
        levelSongMap={levelSongMap}
        onToggleMute={handleToggleMute}
        onUploadSongs={handleUploadSongs}
        onDeleteCustomSong={handleDeleteCustomSong}
        onAssignSong={handleAssignSong}
        onAssignSongToAll={handleAssignSongToAll}
        onClearAllAssignments={handleClearAllAssignments}
        onClose={handleCloseModal}
      />

      <ShopModal
        isOpen={isShopOpen}
        progress={progress}
        onBuyOutfit={handleBuyOutfit}
        onEquipOutfit={handleEquipOutfit}
        onBuyCharacter={handleBuyCharacter}
        onEquipCharacter={handleEquipCharacter}
        onBuyJuice={handleBuyJuice}
        onSelectJuice={handleSelectJuice}
        onBuyProtection={handleBuyProtection}
        onSelectProtection={handleSelectProtection}
        onToggleAutoUseJuice={handleToggleAutoUseJuice}
        onToggleAutoUseProtection={handleToggleAutoUseProtection}
        onConvertCfaToCoins={handleConvertCfaToCoins}
        onTryItem={handleShopTryItem}
        onClose={handleCloseModal}
      />

      <MultiplayerModal
        isOpen={isMultiplayerOpen}
        connected={mp.connected}
        connecting={mp.connecting}
        transportMode={mp.transportMode}
        error={mp.error}
        playerId={mp.playerId}
        room={mp.room}
        availableRooms={mp.availableRooms}
        p2pCount={mp.p2pCount}
        directOfferCode={mp.directOfferCode}
        directAnswerCode={mp.directAnswerCode}
        directBusy={mp.directBusy}
        defaultName={equippedCharacterObj.name}
        characterId={progress.equippedCharacter}
        outfitId={progress.equippedOutfit}
        bestLevel={progress.bestLevel}
        onClearError={mp.clearError}
        onDiscoverRooms={mp.discoverRooms}
        onCreateRoom={(name, level) =>
          mp.createRoom(name, progress.equippedCharacter, progress.equippedOutfit, level)
        }
        onJoinRoom={(code, name) =>
          mp.joinRoom(code, name, progress.equippedCharacter, progress.equippedOutfit)
        }
        onUpdateName={(name) =>
          mp.updateProfile(name, progress.equippedCharacter, progress.equippedOutfit)
        }
        onSetLevel={mp.setLevel}
        onStartRace={mp.startRace}
        onPlayAgain={mp.playAgain}
        onLeaveRoom={() => {
          mp.leaveRoom();
          setIsMultiplayerMode(false);
          setMpLocalEliminated(false);
        }}
        onCreateDirectInvite={mp.createDirectInvite}
        onAcceptDirectInvite={(offerCode, name) =>
          mp.acceptDirectInvite(offerCode, name, progress.equippedCharacter, progress.equippedOutfit)
        }
        onCompleteDirectInvite={mp.completeDirectInvite}
        onResetDirectCodes={mp.resetDirectCodes}
        onClose={() => {
          setIsMultiplayerOpen(false);
          if (mp.room?.status === 'FINISHED') {
            mp.leaveRoom();
            setIsMultiplayerMode(false);
            setMpLocalEliminated(false);
          }
        }}
      />

      {/* Quick Cagnotte F CFA -> Pièces d'or Converter Modal */}
      {isConverterOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/82 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="convert-modal-title"
          onClick={handleCloseModal}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-amber-500/35 bg-[#1C1613] p-5 sm:p-6 text-[#FAF5EE] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="h-5 w-5 text-amber-400 shrink-0" />
                  <h2
                    id="convert-modal-title"
                    className="font-display text-xl font-extrabold text-[#FAF5EE]"
                  >
                    Cagnotte en Pièces d’or
                  </h2>
                </div>
                <p className="mt-1 text-xs text-[#B8ABA0]">
                  Taux de change fixe : <strong className="text-amber-300">2 F CFA = 1 pièce d’or</strong> (100 F = 50 pièces)
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                aria-label="Fermer le convertisseur"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-[#261E1A] text-[#D6CBC0] hover:bg-[#342924] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-white/10 bg-[#14100E] p-3.5 font-mono tabular-nums">
              <div>
                <div className="text-[11px] text-[#B8ABA0]">Cagnotte disponible</div>
                <div className="mt-0.5 text-base font-bold text-orange-300">
                  {progress.totalLootCfa.toLocaleString('fr-FR')} F CFA
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#B8ABA0]">Pièces d’or</div>
                <div className="mt-0.5 text-base font-extrabold text-amber-400">
                  {progress.shopCoins.toLocaleString('fr-FR')}
                </div>
              </div>
            </div>

            {(() => {
              const maxCoins = Math.floor(progress.totalLootCfa / 2);
              return (
                <div className="mt-4 space-y-2.5">
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      disabled={maxCoins < 50}
                      onClick={() => handleConvertCfaToCoins(50)}
                      className="inline-flex min-h-[44px] flex-col items-center justify-center rounded-xl border border-white/15 bg-[#261E1A] px-2 py-1.5 text-xs font-bold text-[#FAF5EE] hover:bg-[#342924] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <span className="text-amber-400">+50 pièces</span>
                      <span className="text-[10px] text-[#B8ABA0] font-mono">100 F</span>
                    </button>
                    <button
                      type="button"
                      disabled={maxCoins < 250}
                      onClick={() => handleConvertCfaToCoins(250)}
                      className="inline-flex min-h-[44px] flex-col items-center justify-center rounded-xl border border-white/15 bg-[#261E1A] px-2 py-1.5 text-xs font-bold text-[#FAF5EE] hover:bg-[#342924] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <span className="text-amber-400">+250 pièces</span>
                      <span className="text-[10px] text-[#B8ABA0] font-mono">500 F</span>
                    </button>
                    <button
                      type="button"
                      disabled={maxCoins < 500}
                      onClick={() => handleConvertCfaToCoins(500)}
                      className="inline-flex min-h-[44px] flex-col items-center justify-center rounded-xl border border-white/15 bg-[#261E1A] px-2 py-1.5 text-xs font-bold text-[#FAF5EE] hover:bg-[#342924] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <span className="text-amber-400">+500 pièces</span>
                      <span className="text-[10px] text-[#B8ABA0] font-mono">1 000 F</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={maxCoins < 1}
                    onClick={() => handleConvertCfaToCoins()}
                    className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-extrabold text-[#161210] hover:bg-amber-400 disabled:bg-[#2C2522] disabled:text-[#8E8178] disabled:cursor-not-allowed transition-colors"
                  >
                    <Coins className="h-4 w-4 shrink-0" />
                    <span>
                      {maxCoins > 0
                        ? `Tout convertir (+${maxCoins.toLocaleString('fr-FR')} ${maxCoins > 1 ? 'pièces' : 'pièce'})`
                        : 'Minimum 2 F CFA requis'}
                    </span>
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      <TutorialOverlay
        isOpen={gameState === 'TITLE_MENU' && isTutorialOpen}
        lastAction={lastTutorialAction}
        onMoveLeft={() => canvasHandleRef.current?.moveLeft()}
        onMoveRight={() => canvasHandleRef.current?.moveRight()}
        onJump={() => canvasHandleRef.current?.jump()}
        onSlide={() => canvasHandleRef.current?.slide()}
        onPlayNow={() => {
          setIsTutorialOpen(false);
          startRun();
        }}
        onClose={() => setIsTutorialOpen(false)}
      />

      <OfflineIndicator />
    </div>
  );
}
