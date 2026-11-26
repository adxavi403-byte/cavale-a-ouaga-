import { SavedProgress } from './types';

export type AchievementCategory = 'distance' | 'butin' | 'quartiers' | 'exploits';

export type AchievementIconKind =
  | 'footprints'
  | 'timer'
  | 'trophy'
  | 'coins'
  | 'wallet'
  | 'crown'
  | 'mappin'
  | 'compass'
  | 'flame'
  | 'star';

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  icon: AchievementIconKind;
  target: number;
  unit: string;
  getValue: (progress: SavedProgress) => number;
}

export interface AchievementStatus {
  definition: AchievementDefinition;
  currentValue: number;
  targetValue: number;
  ratio: number;
  percent: number;
  unlocked: boolean;
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'premier_sprint',
    title: 'Échauffement à Rood-Woko',
    description: 'Parcourir 500 m en une seule course sans vous faire arrêter.',
    category: 'distance',
    icon: 'footprints',
    target: 500,
    unit: 'm',
    getValue: (p) => p.bestDistance,
  },
  {
    id: 'foulee_sahelienne',
    title: 'Foulée Sahélienne',
    description: 'Atteindre 2 500 m en une seule course dans les rues de Ouaga.',
    category: 'distance',
    icon: 'timer',
    target: 2500,
    unit: 'm',
    getValue: (p) => p.bestDistance,
  },
  {
    id: 'marathonien',
    title: 'Marathonien',
    description: 'Cumuler 10 km (10 000 m) parcourus sur l’ensemble de vos courses.',
    category: 'distance',
    icon: 'footprints',
    target: 10000,
    unit: 'm',
    getValue: (p) => Math.max(p.totalDistanceMeters, p.bestDistance),
  },
  {
    id: 'tour_du_faso',
    title: 'Tour du Faso à Pied',
    description: 'Cumuler 42,195 km parcourus à travers la capitale.',
    category: 'distance',
    icon: 'trophy',
    target: 42195,
    unit: 'm',
    getValue: (p) => Math.max(p.totalDistanceMeters, p.bestDistance),
  },
  {
    id: 'argent_de_poche',
    title: 'Argent de Poche',
    description: 'Cumuler 5 000 FCFA dans votre cagnotte.',
    category: 'butin',
    icon: 'coins',
    target: 5000,
    unit: 'FCFA',
    getValue: (p) => Math.max(p.totalLootCfa, p.lifetimeLootCfa ?? 0),
  },
  {
    id: 'patron_marche',
    title: 'Patron du Grand Marché',
    description: 'Cumuler 50 000 FCFA dans votre cagnotte.',
    category: 'butin',
    icon: 'wallet',
    target: 50000,
    unit: 'FCFA',
    getValue: (p) => Math.max(p.totalLootCfa, p.lifetimeLootCfa ?? 0),
  },
  {
    id: 'quartier_chic',
    title: 'Roi de Koulouba',
    description: 'Cumuler 250 000 FCFA dans votre cagnotte.',
    category: 'butin',
    icon: 'coins',
    target: 250000,
    unit: 'FCFA',
    getValue: (p) => Math.max(p.totalLootCfa, p.lifetimeLootCfa ?? 0),
  },
  {
    id: 'cresus',
    title: 'Crésus',
    description: 'Cumuler 1 000 000 FCFA dans votre cagnotte.',
    category: 'butin',
    icon: 'crown',
    target: 1000000,
    unit: 'FCFA',
    getValue: (p) => Math.max(p.totalLootCfa, p.lifetimeLootCfa ?? 0),
  },
  {
    id: 'roi_centre',
    title: 'Maître du Centre-Ville',
    description: 'Atteindre le niveau 10 (Nemnin) dans les arrondissements centraux.',
    category: 'quartiers',
    icon: 'mappin',
    target: 10,
    unit: 'niv.',
    getValue: (p) => p.bestLevel,
  },
  {
    id: 'cap_ouaga_2000',
    title: 'Cap sur Ouaga 2000',
    description: 'Atteindre le niveau 36 devant les grands boulevards de Ouaga 2000.',
    category: 'quartiers',
    icon: 'compass',
    target: 36,
    unit: 'niv.',
    getValue: (p) => p.bestLevel,
  },
  {
    id: 'maitre_60_quartiers',
    title: 'Légende des 60 Quartiers',
    description: 'Atteindre le niveau 60 (Yagma) et boucler toute la carte de Ouagadougou.',
    category: 'quartiers',
    icon: 'crown',
    target: 60,
    unit: 'niv.',
    getValue: (p) => p.bestLevel,
  },
  {
    id: 'habitue_cavale',
    title: 'Habitué de la Cavale',
    description: 'Terminer 10 courses face à la police de Ouagadougou.',
    category: 'exploits',
    icon: 'flame',
    target: 10,
    unit: 'courses',
    getValue: (p) => p.runsCount,
  },
  {
    id: 'insaisissable',
    title: 'Insaisissable',
    description: 'Atteindre un meilleur score de 25 000 points en une course.',
    category: 'exploits',
    icon: 'star',
    target: 25000,
    unit: 'pts',
    getValue: (p) => p.bestScore,
  },
  {
    id: 'fantome_du_faso',
    title: 'Fantôme du Faso',
    description: 'Atteindre un meilleur score de 100 000 points en une course.',
    category: 'exploits',
    icon: 'trophy',
    target: 100000,
    unit: 'pts',
    getValue: (p) => p.bestScore,
  },
];

export function evaluateAchievements(progress: SavedProgress): AchievementStatus[] {
  const unlockedSet = new Set(progress.unlockedAchievements);

  return ACHIEVEMENTS.map((def) => {
    const rawValue = Math.max(0, Math.floor(def.getValue(progress)));
    const unlocked = unlockedSet.has(def.id) || rawValue >= def.target;
    const currentValue = unlocked ? Math.max(rawValue, def.target) : rawValue;
    const ratio = Math.min(1, currentValue / def.target);
    const percent = Math.round(ratio * 100);

    return {
      definition: def,
      currentValue,
      targetValue: def.target,
      ratio,
      percent,
      unlocked,
    };
  });
}

export function collectNewlyUnlockedIds(progress: SavedProgress): string[] {
  const unlockedSet = new Set(progress.unlockedAchievements);
  const newlyUnlocked: string[] = [];

  for (const def of ACHIEVEMENTS) {
    if (!unlockedSet.has(def.id) && def.getValue(progress) >= def.target) {
      newlyUnlocked.push(def.id);
    }
  }

  return newlyUnlocked;
}

export function getAchievementById(id: string): AchievementDefinition | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
