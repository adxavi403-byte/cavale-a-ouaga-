import { CharacterId, OutfitId, SHOP_CHARACTERS, SHOP_OUTFITS } from './shop';
import { getLevelConfig, HudSnapshot, LeaderboardEntry } from './types';

export const MAX_LOCAL_LEADERBOARD_ENTRIES = 5;

const VALID_CHAR_IDS = new Set<string>(SHOP_CHARACTERS.map((c) => c.id));
const VALID_OUTFIT_IDS = new Set<string>(SHOP_OUTFITS.map((o) => o.id));

function sortAndTrim(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.distanceMeters !== a.distanceMeters) return b.distanceMeters - a.distanceMeters;
      return b.achievedAt.localeCompare(a.achievedAt);
    })
    .slice(0, MAX_LOCAL_LEADERBOARD_ENTRIES);
}

export function sanitizeLeaderboardEntries(raw: unknown): LeaderboardEntry[] {
  if (!Array.isArray(raw)) return [];
  const valid: LeaderboardEntry[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== 'object') continue;
    const obj = item as Partial<LeaderboardEntry>;
    const score = Math.max(0, Math.floor(Number(obj.score) || 0));
    if (score <= 0) continue;

    const characterId: CharacterId =
      typeof obj.characterId === 'string' && VALID_CHAR_IDS.has(obj.characterId)
        ? (obj.characterId as CharacterId)
        : 'didi';
    const outfitId: OutfitId =
      typeof obj.outfitId === 'string' && VALID_OUTFIT_IDS.has(obj.outfitId)
        ? (obj.outfitId as OutfitId)
        : 'base';
    const outcome: LeaderboardEntry['outcome'] =
      obj.outcome === 'VICTORY' || obj.outcome === 'ARRESTED' || obj.outcome === 'QUIT'
        ? obj.outcome
        : 'ARRESTED';
    const level = Math.max(1, Math.floor(Number(obj.level) || 1));

    valid.push({
      id: typeof obj.id === 'string' && obj.id ? obj.id : `lb_${i}_${score}`,
      score,
      distanceMeters: Math.max(0, Math.floor(Number(obj.distanceMeters) || 0)),
      level,
      quartierName:
        typeof obj.quartierName === 'string' && obj.quartierName
          ? obj.quartierName
          : getLevelConfig(level).displayName,
      coinsCollected: Math.max(0, Math.floor(Number(obj.coinsCollected) || 0)),
      lootCfa: Math.max(0, Math.floor(Number(obj.lootCfa) || 0)),
      characterId,
      outfitId,
      outcome,
      achievedAt:
        typeof obj.achievedAt === 'string' && obj.achievedAt
          ? obj.achievedAt
          : new Date().toISOString(),
    });
  }
  return sortAndTrim(valid);
}

export function buildLegacyLeaderboardSeed(params: {
  bestScore: number;
  bestDistance: number;
  bestLevel: number;
  equippedCharacter: CharacterId;
  equippedOutfit: OutfitId;
}): LeaderboardEntry[] {
  if (params.bestScore <= 0) return [];
  const lvl = Math.max(1, Math.floor(params.bestLevel));
  return [
    {
      id: `legacy_${Math.floor(params.bestScore)}`,
      score: Math.floor(params.bestScore),
      distanceMeters: Math.max(0, Math.floor(params.bestDistance)),
      level: lvl,
      quartierName: getLevelConfig(lvl).displayName,
      coinsCollected: 0,
      lootCfa: 0,
      characterId: params.equippedCharacter,
      outfitId: params.equippedOutfit,
      outcome: 'ARRESTED',
      achievedAt: new Date().toISOString(),
    },
  ];
}

export function recordRunToLeaderboard(
  existing: LeaderboardEntry[] | undefined,
  snapshot: HudSnapshot,
  characterId: CharacterId,
  outfitId: OutfitId,
  outcome: LeaderboardEntry['outcome']
): { entries: LeaderboardEntry[]; rank: number | null; entryId: string | null } {
  const cleanExisting = sanitizeLeaderboardEntries(existing);
  const finalScore = Math.max(0, Math.floor(snapshot.score));
  if (finalScore <= 0) {
    return { entries: cleanExisting, rank: null, entryId: null };
  }

  const entryId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const newEntry: LeaderboardEntry = {
    id: entryId,
    score: finalScore,
    distanceMeters: Math.max(0, Math.floor(snapshot.distanceMeters)),
    level: Math.max(1, Math.floor(snapshot.level)),
    quartierName: snapshot.quartierName || getLevelConfig(snapshot.level).displayName,
    coinsCollected: Math.max(0, Math.floor(snapshot.coinsCollected)),
    lootCfa: Math.max(0, Math.floor(snapshot.lootCfa)),
    characterId,
    outfitId,
    outcome,
    achievedAt: new Date().toISOString(),
  };

  const nextEntries = sortAndTrim([...cleanExisting, newEntry]);
  const index = nextEntries.findIndex((item) => item.id === entryId);
  return {
    entries: nextEntries,
    rank: index >= 0 ? index + 1 : null,
    entryId: index >= 0 ? entryId : null,
  };
}

export function formatLeaderboardDateFr(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Récent';

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const timeStr = date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (sameDay) {
    return `Aujourd’hui · ${timeStr}`;
  }

  const dateStr = date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
  return `${dateStr} · ${timeStr}`;
}
