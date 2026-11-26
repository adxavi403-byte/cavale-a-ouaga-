import { DailyProgressState, SavedProgress } from './types';

export type DailyChallengeIconKind =
  | 'coins'
  | 'footprints'
  | 'shirt'
  | 'flag'
  | 'arrowUp'
  | 'arrowDown'
  | 'wallet'
  | 'flame';

export interface DailyChallengeDefinition {
  id: string;
  slot: 'course' | 'butin' | 'action';
  title: string;
  description: string;
  rewardCoins: number;
  target: number;
  unit: string;
  icon: DailyChallengeIconKind;
  actionHint: 'play' | 'shop';
  getValue: (daily: DailyProgressState, progress: SavedProgress) => number;
}

export interface DailyChallengeStatus {
  definition: DailyChallengeDefinition;
  currentValue: number;
  targetValue: number;
  percent: number;
  completed: boolean;
  claimed: boolean;
}

export const DAILY_CHALLENGES: DailyChallengeDefinition[] = [
  // Slot 1: Course & Distance
  {
    id: 'daily_run_500',
    slot: 'course',
    title: 'Courir 500 m',
    description: 'Parcourir 500 m au total dans les rues de Ouagadougou aujourd’hui.',
    rewardCoins: 80,
    target: 500,
    unit: 'm',
    icon: 'footprints',
    actionHint: 'play',
    getValue: (d) => d.distanceMeters,
  },
  {
    id: 'daily_run_1000',
    slot: 'course',
    title: 'Courir 1 000 m',
    description: 'Cumuler 1 000 m de course à travers les quartiers aujourd’hui.',
    rewardCoins: 140,
    target: 1000,
    unit: 'm',
    icon: 'footprints',
    actionHint: 'play',
    getValue: (d) => d.distanceMeters,
  },
  {
    id: 'daily_finish_level',
    slot: 'course',
    title: 'Terminer 1 niveau',
    description: 'Atteindre la ligne d’arrivée d’un quartier complet aujourd’hui.',
    rewardCoins: 120,
    target: 1,
    unit: 'niv.',
    icon: 'flag',
    actionHint: 'play',
    getValue: (d) => d.levelsCompleted,
  },
  {
    id: 'daily_two_runs',
    slot: 'course',
    title: 'Faire 2 courses',
    description: 'Disputer 2 courses aujourd’hui face à la police à moto.',
    rewardCoins: 75,
    target: 2,
    unit: 'courses',
    icon: 'flame',
    actionHint: 'play',
    getValue: (d) => d.runsCompleted,
  },

  // Slot 2: Pièces & Butin
  {
    id: 'daily_coins_50',
    slot: 'butin',
    title: 'Ramasser 50 pièces',
    description: 'Ramasser 50 pièces d’or sur les 3 voies aujourd’hui.',
    rewardCoins: 100,
    target: 50,
    unit: 'pièces',
    icon: 'coins',
    actionHint: 'play',
    getValue: (d) => d.coinsCollected,
  },
  {
    id: 'daily_coins_100',
    slot: 'butin',
    title: 'Ramasser 100 pièces',
    description: 'Ramasser 100 pièces d’or sur les voies de Ouaga aujourd’hui.',
    rewardCoins: 160,
    target: 100,
    unit: 'pièces',
    icon: 'coins',
    actionHint: 'play',
    getValue: (d) => d.coinsCollected,
  },
  {
    id: 'daily_loot_8000',
    slot: 'butin',
    title: 'Gagner 8 000 F CFA',
    description: 'Cumuler 8 000 F CFA de gains pendant vos courses du jour.',
    rewardCoins: 110,
    target: 8000,
    unit: 'F',
    icon: 'wallet',
    actionHint: 'play',
    getValue: (d) => d.lootCfa,
  },

  // Slot 3: Mouvements & Style
  {
    id: 'daily_jumps_12',
    slot: 'action',
    title: 'Sauter 12 fois',
    description: 'Effectuer 12 grands sauts par-dessus les obstacles aujourd’hui.',
    rewardCoins: 70,
    target: 12,
    unit: 'sauts',
    icon: 'arrowUp',
    actionHint: 'play',
    getValue: (d) => d.jumpsCount,
  },
  {
    id: 'daily_slides_8',
    slot: 'action',
    title: 'Glisser 8 fois',
    description: 'Faire 8 roulades ou glissades sous les barrières aujourd’hui.',
    rewardCoins: 70,
    target: 8,
    unit: 'glissades',
    icon: 'arrowDown',
    actionHint: 'play',
    getValue: (d) => d.slidesCount,
  },
  {
    id: 'daily_style_shop',
    slot: 'action',
    title: 'Essayer ou porter un habit',
    description: 'Ouvrir la Boutique et essayer ou équiper une tenue en 3D.',
    rewardCoins: 65,
    target: 1,
    unit: 'action',
    icon: 'shirt',
    actionHint: 'shop',
    getValue: (d) => d.shopInteractions,
  },
  {
    id: 'daily_equip_etalons',
    slot: 'action',
    title: 'Équiper la tenue de footballeur',
    description: 'Porter la Tenue Footballeur Étalons dans la Boutique Rood-Woko.',
    rewardCoins: 120,
    target: 1,
    unit: 'tenue',
    icon: 'shirt',
    actionHint: 'shop',
    getValue: (d, p) => (d.equippedEtalonsToday || p.equippedOutfit === 'etalons' ? 1 : 0),
  },
];

const CHALLENGE_MAP = new Map<string, DailyChallengeDefinition>(
  DAILY_CHALLENGES.map((c) => [c.id, c])
);

export function getTodayDateKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatTodayLabelFr(dateKey: string): string {
  const parts = dateKey.split('-').map((n) => Number(n));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return dateKey;
  const dt = new Date(parts[0], parts[1] - 1, parts[2]);
  try {
    return dt.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  } catch {
    return dateKey;
  }
}

function hashDateKey(dateKey: string): number {
  let h = 2166136261;
  for (let i = 0; i < dateKey.length; i++) {
    h ^= dateKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function selectDailyChallengeIds(dateKey: string, progress?: Partial<SavedProgress>): string[] {
  const seed = hashDateKey(dateKey);

  const coursePool = DAILY_CHALLENGES.filter((c) => c.slot === 'course');
  const butinPool = DAILY_CHALLENGES.filter((c) => c.slot === 'butin');
  const hasEtalons = Boolean(progress?.unlockedOutfits?.includes('etalons'));
  const actionPool = DAILY_CHALLENGES.filter(
    (c) => c.slot === 'action' && (c.id !== 'daily_equip_etalons' || hasEtalons)
  );

  const coursePick = coursePool[seed % coursePool.length];
  const butinPick = butinPool[Math.floor(seed / 7) % butinPool.length];
  const actionPick = actionPool[Math.floor(seed / 17) % actionPool.length];

  return [coursePick.id, butinPick.id, actionPick.id];
}

export function ensureTodayDailyState(
  existing: DailyProgressState | undefined,
  progress?: Partial<SavedProgress>,
  dateKey: string = getTodayDateKey()
): DailyProgressState {
  if (
    existing &&
    existing.dateKey === dateKey &&
    Array.isArray(existing.challengeIds) &&
    existing.challengeIds.length === 3 &&
    existing.challengeIds.every((id) => CHALLENGE_MAP.has(id))
  ) {
    return {
      dateKey,
      challengeIds: existing.challengeIds,
      distanceMeters: Math.max(0, Number(existing.distanceMeters) || 0),
      coinsCollected: Math.max(0, Number(existing.coinsCollected) || 0),
      lootCfa: Math.max(0, Number(existing.lootCfa) || 0),
      runsCompleted: Math.max(0, Number(existing.runsCompleted) || 0),
      levelsCompleted: Math.max(0, Number(existing.levelsCompleted) || 0),
      jumpsCount: Math.max(0, Number(existing.jumpsCount) || 0),
      slidesCount: Math.max(0, Number(existing.slidesCount) || 0),
      shopInteractions: Math.max(0, Number(existing.shopInteractions) || 0),
      equippedEtalonsToday: Boolean(existing.equippedEtalonsToday),
      claimedIds: Array.isArray(existing.claimedIds)
        ? existing.claimedIds.filter((id): id is string => typeof id === 'string')
        : [],
    };
  }

  return {
    dateKey,
    challengeIds: selectDailyChallengeIds(dateKey, progress),
    distanceMeters: 0,
    coinsCollected: 0,
    lootCfa: 0,
    runsCompleted: 0,
    levelsCompleted: 0,
    jumpsCount: 0,
    slidesCount: 0,
    shopInteractions: 0,
    equippedEtalonsToday: progress?.equippedOutfit === 'etalons',
    claimedIds: [],
  };
}

export function evaluateDailyChallenges(progress: SavedProgress): {
  daily: DailyProgressState;
  items: DailyChallengeStatus[];
  completedCount: number;
  claimableCount: number;
} {
  const daily = ensureTodayDailyState(progress.dailyProgress, progress);
  const claimedSet = new Set(daily.claimedIds);

  const items: DailyChallengeStatus[] = daily.challengeIds
    .map((id) => CHALLENGE_MAP.get(id))
    .filter((def): def is DailyChallengeDefinition => Boolean(def))
    .map((def) => {
      const rawValue = Math.max(0, Math.floor(def.getValue(daily, progress)));
      const completed = rawValue >= def.target;
      const currentValue = Math.min(rawValue, def.target);
      const percent = Math.min(100, Math.round((currentValue / def.target) * 100));
      const claimed = claimedSet.has(def.id);

      return {
        definition: def,
        currentValue,
        targetValue: def.target,
        percent,
        completed,
        claimed,
      };
    });

  const completedCount = items.filter((item) => item.completed).length;
  const claimableCount = items.filter((item) => item.completed && !item.claimed).length;

  return { daily, items, completedCount, claimableCount };
}

export function getDailyChallengeById(id: string): DailyChallengeDefinition | undefined {
  return CHALLENGE_MAP.get(id);
}
