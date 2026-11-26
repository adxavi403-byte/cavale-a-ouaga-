import { CharacterId, JuiceId, OutfitId, ProtectionId } from './shop';

export type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'LEVEL_COMPLETE' | 'GAME_OVER';

export type QuartierTheme = 'MARKET' | 'TRADITIONAL' | 'MODERN' | 'UNIVERSITY' | 'HIGHWAY';

export type MapSector = 'CENTRE' | 'NORD' | 'SUD' | 'EST' | 'OUEST';

export type WeatherKind = 'SOLEIL_INTENSE' | 'HARMATTAN' | 'PLUIE';

export interface WeatherMeta {
  kind: WeatherKind;
  label: string;
  shortLabel: string;
  visibilityImpact: string;
}

export const WEATHER_META: Record<WeatherKind, WeatherMeta> = {
  SOLEIL_INTENSE: {
    kind: 'SOLEIL_INTENSE',
    label: 'Soleil intense',
    shortLabel: 'Soleil',
    visibilityImpact: 'Éblouissement & brume chaude à l’horizon',
  },
  HARMATTAN: {
    kind: 'HARMATTAN',
    label: 'Poussière d’Harmattan',
    shortLabel: 'Harmattan',
    visibilityImpact: 'Rafales de sable réduisant la portée visuelle',
  },
  PLUIE: {
    kind: 'PLUIE',
    label: 'Pluie d’hivernage',
    shortLabel: 'Pluie',
    visibilityImpact: 'Averses et brume réduisant la visibilité',
  },
};

export function getWeatherMeta(kind: WeatherKind): WeatherMeta {
  return WEATHER_META[kind];
}

export interface OuagaQuartier {
  index: number;
  name: string;
  zone: string;
  arrondissement: string;
  sector: MapSector;
  theme: QuartierTheme;
  weather: WeatherKind;
  /** Geographic coordinates on 1000x620 Ouagadougou map */
  mapX: number;
  mapY: number;
  /** Unique musical profile label for this level */
  soundTitle: string;
}

export const OUAGA_QUARTIERS: OuagaQuartier[] = [
  // CENTRE (Arr. 1 & 2 - Cœur historique)
  { index: 1, name: 'Rood-Woko', zone: 'Grand Marché · Cœur historique', arrondissement: 'Arr. 1', sector: 'CENTRE', theme: 'MARKET', weather: 'SOLEIL_INTENSE', mapX: 495, mapY: 315, soundTitle: 'Balafon du Marché' },
  { index: 2, name: 'Koulouba', zone: 'Avenue Kwamé Nkrumah', arrondissement: 'Arr. 1', sector: 'CENTRE', theme: 'MODERN', weather: 'HARMATTAN', mapX: 530, mapY: 332, soundTitle: 'Basse Urbaine' },
  { index: 3, name: 'Bilbalogo', zone: 'Rues commerçantes centrales', arrondissement: 'Arr. 1', sector: 'CENTRE', theme: 'MARKET', weather: 'PLUIE', mapX: 472, mapY: 336, soundTitle: 'Djembé Syncopé' },
  { index: 4, name: 'Zangouettin', zone: 'Vieux Ouaga · Maquis & cours', arrondissement: 'Arr. 1', sector: 'CENTRE', theme: 'TRADITIONAL', weather: 'SOLEIL_INTENSE', mapX: 508, mapY: 292, soundTitle: 'Kora Nocturne' },
  { index: 5, name: 'Tiendpalogo', zone: 'Vieille ville · Passages étroits', arrondissement: 'Arr. 1', sector: 'CENTRE', theme: 'TRADITIONAL', weather: 'HARMATTAN', mapX: 484, mapY: 282, soundTitle: 'Tama Cadencé' },
  { index: 6, name: 'Kamsonghin', zone: 'Centre-Sud · Rond-point', arrondissement: 'Arr. 1', sector: 'CENTRE', theme: 'TRADITIONAL', weather: 'PLUIE', mapX: 465, mapY: 364, soundTitle: 'Rythme Kamsonghin' },
  { index: 7, name: 'Samandin', zone: 'Sud du centre · Voies ferrées', arrondissement: 'Arr. 1', sector: 'CENTRE', theme: 'TRADITIONAL', weather: 'SOLEIL_INTENSE', mapX: 446, mapY: 382, soundTitle: 'Rail & Djembé' },
  { index: 8, name: 'Paspanga', zone: 'Rive Sud des barrages', arrondissement: 'Arr. 1', sector: 'CENTRE', theme: 'TRADITIONAL', weather: 'PLUIE', mapX: 525, mapY: 256, soundTitle: 'Écho du Barrage' },
  { index: 9, name: 'Dapoya', zone: 'Quartier animé · Grands carrefours', arrondissement: 'Arr. 2', sector: 'CENTRE', theme: 'MARKET', weather: 'SOLEIL_INTENSE', mapX: 458, mapY: 268, soundTitle: 'Afro-Groove Dapoya' },
  { index: 10, name: 'Nemnin', zone: 'Centre-Nord · Rues animées', arrondissement: 'Arr. 2', sector: 'CENTRE', theme: 'TRADITIONAL', weather: 'HARMATTAN', mapX: 438, mapY: 296, soundTitle: 'Balafon Rapide' },
  { index: 11, name: 'Sankaryaré', zone: 'Grand Marché du Nord', arrondissement: 'Arr. 2', sector: 'CENTRE', theme: 'MARKET', weather: 'HARMATTAN', mapX: 422, mapY: 258, soundTitle: 'Sankaryaré Brass' },
  { index: 12, name: 'Larlé', zone: 'Cour du Larlé Naaba', arrondissement: 'Arr. 2', sector: 'CENTRE', theme: 'TRADITIONAL', weather: 'SOLEIL_INTENSE', mapX: 404, mapY: 288, soundTitle: 'Bendré Royal' },
  { index: 13, name: 'Ouidi', zone: 'Quartier populaire · Centre-Ouest', arrondissement: 'Arr. 2', sector: 'CENTRE', theme: 'TRADITIONAL', weather: 'PLUIE', mapX: 382, mapY: 306, soundTitle: 'Percussion Ouidi' },
  { index: 14, name: 'Hamdalaye', zone: 'Carrefours denses · Ouest', arrondissement: 'Arr. 2', sector: 'OUEST', theme: 'MARKET', weather: 'HARMATTAN', mapX: 356, mapY: 325, soundTitle: 'Mélodie Hamdalaye' },
  { index: 15, name: 'Baoghin', zone: 'Bord du marigot · Ouest', arrondissement: 'Arr. 2', sector: 'OUEST', theme: 'TRADITIONAL', weather: 'PLUIE', mapX: 344, mapY: 292, soundTitle: 'Flûte Peule & Basse' },
  { index: 16, name: 'Kologh-Naba', zone: 'Centre-Nord · Boulevard circulaire', arrondissement: 'Arr. 3', sector: 'CENTRE', theme: 'TRADITIONAL', weather: 'SOLEIL_INTENSE', mapX: 432, mapY: 224, soundTitle: 'Tam-Tam Kologh-Naba' },

  // OUEST (Arr. 3, 6, 7, 8)
  { index: 17, name: 'Gounghin', zone: 'Stade du 4-Août · Grands axes', arrondissement: 'Arr. 6', sector: 'OUEST', theme: 'HIGHWAY', weather: 'PLUIE', mapX: 322, mapY: 348, soundTitle: 'Stade Turbo' },
  { index: 18, name: 'Nonsin', zone: 'Nord-Ouest · Voies pavées', arrondissement: 'Arr. 3', sector: 'OUEST', theme: 'TRADITIONAL', weather: 'HARMATTAN', mapX: 318, mapY: 266, soundTitle: 'Kora Nonsin' },
  { index: 19, name: 'Rimkiéta', zone: 'Ouest · Rues marchandes', arrondissement: 'Arr. 3', sector: 'OUEST', theme: 'MARKET', weather: 'SOLEIL_INTENSE', mapX: 274, mapY: 256, soundTitle: 'Groove Rimkiéta' },
  { index: 20, name: 'Tampouy', zone: 'Nord-Ouest · Grands marchés', arrondissement: 'Arr. 3', sector: 'NORD', theme: 'MARKET', weather: 'HARMATTAN', mapX: 342, mapY: 205, soundTitle: 'Tampouy Beat' },
  { index: 21, name: 'Kilwin', zone: 'Route de Ouahigouya', arrondissement: 'Arr. 3', sector: 'NORD', theme: 'HIGHWAY', weather: 'HARMATTAN', mapX: 282, mapY: 184, soundTitle: 'Autoroute du Nord' },
  { index: 22, name: 'Signoghin', zone: 'Extension Nord-Ouest', arrondissement: 'Arr. 8', sector: 'OUEST', theme: 'TRADITIONAL', weather: 'HARMATTAN', mapX: 232, mapY: 212, soundTitle: 'Élan Signoghin' },
  { index: 23, name: 'Bassinko', zone: 'Cité nouvelle · Nord-Ouest', arrondissement: 'Arr. 8', sector: 'NORD', theme: 'MODERN', weather: 'SOLEIL_INTENSE', mapX: 205, mapY: 145, soundTitle: 'Synth Bassinko' },
  { index: 24, name: 'Pissy', zone: 'Sortie Ouest · Route de Bobo', arrondissement: 'Arr. 6', sector: 'OUEST', theme: 'HIGHWAY', weather: 'PLUIE', mapX: 268, mapY: 368, soundTitle: 'Sprint Pissy' },
  { index: 25, name: 'Cissin', zone: 'Sud-Ouest · Boulevards larges', arrondissement: 'Arr. 6', sector: 'OUEST', theme: 'TRADITIONAL', weather: 'SOLEIL_INTENSE', mapX: 342, mapY: 405, soundTitle: 'Cissin Soukouss' },
  { index: 26, name: 'Kouritenga', zone: 'Sud-Ouest · Pistes latérite', arrondissement: 'Arr. 6', sector: 'OUEST', theme: 'TRADITIONAL', weather: 'HARMATTAN', mapX: 298, mapY: 416, soundTitle: 'Tambour Kouritenga' },
  { index: 27, name: 'Sandogo', zone: 'Ouest · Boulevards périphériques', arrondissement: 'Arr. 7', sector: 'OUEST', theme: 'HIGHWAY', weather: 'SOLEIL_INTENSE', mapX: 212, mapY: 392, soundTitle: 'Tempo Sandogo' },
  { index: 28, name: 'Sondogo', zone: 'Extension Ouest · Croisement', arrondissement: 'Arr. 7', sector: 'OUEST', theme: 'TRADITIONAL', weather: 'HARMATTAN', mapX: 185, mapY: 340, soundTitle: 'Sondogo Balafon' },
  { index: 29, name: 'Zagtouli', zone: 'Route nationale N°1 · Ouest', arrondissement: 'Arr. 7', sector: 'OUEST', theme: 'HIGHWAY', weather: 'HARMATTAN', mapX: 148, mapY: 418, soundTitle: 'Grand Axe Zagtouli' },
  { index: 30, name: 'Boassa', zone: 'Périphérie Sud-Ouest', arrondissement: 'Arr. 7', sector: 'SUD', theme: 'TRADITIONAL', weather: 'PLUIE', mapX: 234, mapY: 465, soundTitle: 'Écho de Boassa' },
  { index: 31, name: 'Bonheur-Ville', zone: 'Sud-Ouest · Rues neuves', arrondissement: 'Arr. 7', sector: 'SUD', theme: 'MODERN', weather: 'SOLEIL_INTENSE', mapX: 288, mapY: 482, soundTitle: 'Guitare Bonheur-Ville' },
  { index: 32, name: 'Belle-Ville', zone: 'Sud · Quartier résidentiel', arrondissement: 'Arr. 7', sector: 'SUD', theme: 'MODERN', weather: 'PLUIE', mapX: 336, mapY: 468, soundTitle: 'Ligne Belle-Ville' },

  // SUD (Arr. 11 & 12 - Ouaga 2000 & Patte d'Oie)
  { index: 33, name: 'Patte d’Oie', zone: 'Échangeur du Sud · Trafic dense', arrondissement: 'Arr. 12', sector: 'SUD', theme: 'HIGHWAY', weather: 'PLUIE', mapX: 455, mapY: 432, soundTitle: 'Sirène & Échangeur' },
  { index: 34, name: 'Nagrin', zone: 'Sud · Voie de contournement', arrondissement: 'Arr. 7', sector: 'SUD', theme: 'HIGHWAY', weather: 'SOLEIL_INTENSE', mapX: 374, mapY: 515, soundTitle: 'Turbo Nagrin' },
  { index: 35, name: 'Tengandogo', zone: 'Sud · CHU & nouvelles avenues', arrondissement: 'Arr. 12', sector: 'SUD', theme: 'MODERN', weather: 'PLUIE', mapX: 436, mapY: 536, soundTitle: 'Pulse Tengandogo' },
  { index: 36, name: 'Ouaga 2000', zone: 'Grands boulevards · Monument', arrondissement: 'Arr. 12', sector: 'SUD', theme: 'MODERN', weather: 'SOLEIL_INTENSE', mapX: 525, mapY: 512, soundTitle: 'Ouaga 2000 Synth' },
  { index: 37, name: 'Garghin', zone: 'Sud-Est · Extension Ouaga 2000', arrondissement: 'Arr. 11', sector: 'SUD', theme: 'MODERN', weather: 'SOLEIL_INTENSE', mapX: 598, mapY: 522, soundTitle: 'Nuit de Garghin' },
  { index: 38, name: 'Balkuy', zone: 'Sud-Est · Voies rapides', arrondissement: 'Arr. 11', sector: 'SUD', theme: 'HIGHWAY', weather: 'PLUIE', mapX: 642, mapY: 484, soundTitle: 'Balkuy Express' },
  { index: 39, name: 'Yamtenga', zone: 'Sud-Est · Périphérie active', arrondissement: 'Arr. 11', sector: 'SUD', theme: 'TRADITIONAL', weather: 'HARMATTAN', mapX: 696, mapY: 456, soundTitle: 'Djembé Yamtenga' },

  // EST (Arr. 5, 10, Saaba)
  { index: 40, name: 'Zogona', zone: 'Campus Université Joseph Ki-Zerbo', arrondissement: 'Arr. 5', sector: 'EST', theme: 'UNIVERSITY', weather: 'SOLEIL_INTENSE', mapX: 585, mapY: 325, soundTitle: 'Campus Afro-Funk' },
  { index: 41, name: '1200 Logements', zone: 'Résidentiel · Kiosques & cafés', arrondissement: 'Arr. 5', sector: 'EST', theme: 'MODERN', weather: 'SOLEIL_INTENSE', mapX: 615, mapY: 288, soundTitle: 'Cité 1200 Groove' },
  { index: 42, name: 'Wemtenga', zone: 'Zone estudiantine & maquis', arrondissement: 'Arr. 5', sector: 'EST', theme: 'UNIVERSITY', weather: 'PLUIE', mapX: 648, mapY: 322, soundTitle: 'Ambiance Wemtenga' },
  { index: 43, name: 'Dagnoën', zone: 'Est · Entre Zogona et Wemtenga', arrondissement: 'Arr. 5', sector: 'EST', theme: 'TRADITIONAL', weather: 'SOLEIL_INTENSE', mapX: 618, mapY: 356, soundTitle: 'Balafon Dagnoën' },
  { index: 44, name: 'Zone du Bois', zone: 'Centre-Est · Avenues arborées', arrondissement: 'Arr. 5', sector: 'EST', theme: 'MODERN', weather: 'PLUIE', mapX: 590, mapY: 376, soundTitle: 'Jazz Zone du Bois' },
  { index: 45, name: 'Bogodogo', zone: 'Est · Hôpital & grands axes', arrondissement: 'Arr. 5', sector: 'EST', theme: 'MODERN', weather: 'PLUIE', mapX: 658, mapY: 382, soundTitle: 'Basse Bogodogo' },
  { index: 46, name: 'Karpala', zone: 'Sud-Est · Grands boulevards', arrondissement: 'Arr. 11', sector: 'EST', theme: 'HIGHWAY', weather: 'SOLEIL_INTENSE', mapX: 645, mapY: 430, soundTitle: 'Sprint Karpala' },
  { index: 47, name: 'Dassasgho', zone: 'Est · Carrefour de Fada', arrondissement: 'Arr. 10', sector: 'EST', theme: 'MARKET', weather: 'SOLEIL_INTENSE', mapX: 706, mapY: 324, soundTitle: 'Marché Dassasgho' },
  { index: 48, name: 'Wayalghin', zone: 'Est · Avenue de la Liberté', arrondissement: 'Arr. 10', sector: 'EST', theme: 'HIGHWAY', weather: 'HARMATTAN', mapX: 735, mapY: 282, soundTitle: 'Wayalghin Drive' },
  { index: 49, name: 'Bendogo', zone: 'Est · Route de Fada N’Gourma', arrondissement: 'Arr. 10', sector: 'EST', theme: 'HIGHWAY', weather: 'HARMATTAN', mapX: 792, mapY: 306, soundTitle: 'Cadence Bendogo' },
  { index: 50, name: 'Tabtenga', zone: 'Est · Quartier en plein essor', arrondissement: 'Arr. 10', sector: 'EST', theme: 'TRADITIONAL', weather: 'PLUIE', mapX: 778, mapY: 368, soundTitle: 'Rythme Tabtenga' },
  { index: 51, name: 'Nioko 1', zone: 'Est · Grands marchés de quartier', arrondissement: 'Arr. 10', sector: 'EST', theme: 'MARKET', weather: 'SOLEIL_INTENSE', mapX: 836, mapY: 285, soundTitle: 'Nioko Balafon' },
  { index: 52, name: 'Nioko 2', zone: 'Est · Piste rapide vers Saaba', arrondissement: 'Arr. 4', sector: 'EST', theme: 'TRADITIONAL', weather: 'HARMATTAN', mapX: 848, mapY: 242, soundTitle: 'Nioko II Percu' },
  { index: 53, name: 'Saaba', zone: 'Sortie Est · Ligne droite', arrondissement: 'Grand Ouaga', sector: 'EST', theme: 'HIGHWAY', weather: 'SOLEIL_INTENSE', mapX: 912, mapY: 318, soundTitle: 'Vitesse Saaba' },

  // NORD (Arr. 4, 8, 9 - Tanghin, Somgandé, Kossodo, Yagma)
  { index: 54, name: 'Tanghin', zone: 'Rive Nord · Barrage n°3', arrondissement: 'Arr. 4', sector: 'NORD', theme: 'TRADITIONAL', weather: 'PLUIE', mapX: 486, mapY: 196, soundTitle: 'Eau & Djembé' },
  { index: 55, name: 'Somgandé', zone: 'Nord-Est · Route de Kaya', arrondissement: 'Arr. 4', sector: 'NORD', theme: 'HIGHWAY', weather: 'HARMATTAN', mapX: 564, mapY: 192, soundTitle: 'Route de Kaya' },
  { index: 56, name: 'Toéghin', zone: 'Nord-Est · Zone résidentielle', arrondissement: 'Arr. 4', sector: 'NORD', theme: 'TRADITIONAL', weather: 'PLUIE', mapX: 658, mapY: 222, soundTitle: 'Kora Toéghin' },
  { index: 57, name: 'Kossodo', zone: 'Zone industrielle · Poids lourds', arrondissement: 'Arr. 4', sector: 'NORD', theme: 'HIGHWAY', weather: 'HARMATTAN', mapX: 734, mapY: 178, soundTitle: 'Métal & Basse Kossodo' },
  { index: 58, name: 'Polesgo', zone: 'Nord · Route de Kongoussi', arrondissement: 'Arr. 9', sector: 'NORD', theme: 'HIGHWAY', weather: 'HARMATTAN', mapX: 518, mapY: 122, soundTitle: 'Vent du Nord' },
  { index: 59, name: 'Marcoussis', zone: 'Nord · Périphérie Nord-Ouest', arrondissement: 'Arr. 9', sector: 'NORD', theme: 'TRADITIONAL', weather: 'PLUIE', mapX: 405, mapY: 128, soundTitle: 'Marcoussis Groove' },
  { index: 60, name: 'Yagma', zone: 'Horizon Nord-Ouest · Sahélien', arrondissement: 'Arr. 8', sector: 'NORD', theme: 'TRADITIONAL', weather: 'HARMATTAN', mapX: 296, mapY: 112, soundTitle: 'Final Sahélien Yagma' },
];

export interface LevelConfig {
  level: number;
  quartier: OuagaQuartier;
  displayName: string;
  lengthMeters: number;
  baseSpeed: number;
  maxSpeed: number;
  multiplier: number;
}

function toRoman(num: number): string {
  if (num >= 400) return `${num}`;
  const map: [number, string][] = [
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let n = num;
  let out = '';
  for (const [val, sym] of map) {
    while (n >= val) {
      out += sym;
      n -= val;
    }
  }
  return out;
}

export function getLevelConfig(level: number): LevelConfig {
  const safeLevel = Math.max(1, Math.floor(level));
  const totalQuartiers = OUAGA_QUARTIERS.length;
  const quartierIdx = (safeLevel - 1) % totalQuartiers;
  const cycle = Math.floor((safeLevel - 1) / totalQuartiers) + 1;
  const quartier = OUAGA_QUARTIERS[quartierIdx];

  const displayName = cycle > 1 ? `${quartier.name} ${toRoman(cycle)}` : quartier.name;
  const lengthMeters = 1000 + (safeLevel - 1) * 100;
  const progression = 1 - Math.exp(-(safeLevel - 1) * 0.085);
  const baseSpeed = Math.round(540 + progression * 620);
  const maxSpeed = Math.round(baseSpeed + 180 + Math.min(240, safeLevel * 7));
  const multiplier = +(1 + (safeLevel - 1) * 0.25).toFixed(2);

  return {
    level: safeLevel,
    quartier,
    displayName,
    lengthMeters,
    baseSpeed,
    maxSpeed,
    multiplier,
  };
}

export type LaneIndex = -1 | 0 | 1;

export type ObstacleKind =
  | 'BUS'
  | 'TRAIN_ROUGE'
  | 'TRAIN_BLEU'
  | 'TAXI_VERT'
  | 'MOTO'
  | 'MARCHANDE'
  | 'BARRIERE_BASSE'
  | 'BARRIERE_HAUTE';

export interface Obstacle {
  id: number;
  kind: ObstacleKind;
  lane: LaneIndex;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  length: number;
  speedOffset: number;
  isOverhead: boolean;
  isJumpable: boolean;
  passed: boolean;
  hit: boolean;
  variant: number;
}

export type CollectibleKind = 'PIECE' | 'BILLET' | 'GINGEMBRE' | 'GRIGRI' | 'AIMANT';

export interface Collectible {
  id: number;
  kind: CollectibleKind;
  lane: LaneIndex;
  x: number;
  y: number;
  z: number;
  radius: number;
  collected: boolean;
  bobOffset: number;
}

export interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface PlayerState {
  lane: LaneIndex;
  x: number;
  y: number;
  z: number;
  vy: number;
  height: number;
  isGrounded: boolean;
  isSliding: boolean;
  slideTimer: number;
  rollProgress: number;
  laneTilt: number;
  runCycle: number;
  squashY: number;
  invincibleTimer: number;
  stumbleTimer: number;
  turboTimer: number;
  turboSpeedBonus: number;
  magnetTimer: number;
  hasShield: boolean;
  shieldCharges: number;
  shieldInvincibleSec: number;
}

export interface PoliceState {
  danger: number;
  chaseZ: number;
  laneX: number;
  sirenPhase: number;
  motoWheelPhase: number;
}

export interface HudSnapshot {
  score: number;
  distanceMeters: number;
  worldScroll: number;
  lootCfa: number;
  coinsCollected: number;
  policeDanger: number;
  combo: number;
  hasShield: boolean;
  shieldCharges: number;
  turboRemaining: number;
  magnetRemaining: number;
  speedKmh: number;
  arrestReason: string;
  level: number;
  quartierName: string;
  quartierZone: string;
  soundTitle: string;
  weather: WeatherKind;
  weatherLabel: string;
  weatherIntensity: number;
  visibilityPercent: number;
  levelProgress: number;
  levelMetersDone: number;
  levelMetersTotal: number;
  multiplier: number;
  bannerText: string;
  flashText: string;
  jumpsCount: number;
  slidesCount: number;
}

export interface DailyProgressState {
  dateKey: string;
  challengeIds: string[];
  distanceMeters: number;
  coinsCollected: number;
  lootCfa: number;
  runsCompleted: number;
  levelsCompleted: number;
  jumpsCount: number;
  slidesCount: number;
  shopInteractions: number;
  equippedEtalonsToday: boolean;
  claimedIds: string[];
}

export interface LeaderboardEntry {
  id: string;
  score: number;
  distanceMeters: number;
  level: number;
  quartierName: string;
  coinsCollected: number;
  lootCfa: number;
  characterId: CharacterId;
  outfitId: OutfitId;
  outcome: 'VICTORY' | 'ARRESTED' | 'QUIT';
  achievedAt: string;
}

export interface SavedProgress {
  bestScore: number;
  bestDistance: number;
  totalDistanceMeters: number;
  bestLevel: number;
  totalLootCfa: number;
  lifetimeLootCfa?: number;
  runsCount: number;
  unlockedAchievements: string[];
  shopCoins: number;
  unlockedOutfits: OutfitId[];
  equippedOutfit: OutfitId;
  unlockedCharacters: CharacterId[];
  equippedCharacter: CharacterId;
  juiceInventory?: Partial<Record<JuiceId, number>>;
  protectionInventory?: Partial<Record<ProtectionId, number>>;
  selectedJuice?: JuiceId;
  selectedProtection?: ProtectionId;
  autoUseJuiceOnStart?: boolean;
  autoUseProtectionOnStart?: boolean;
  dailyProgress?: DailyProgressState;
  localLeaderboard?: LeaderboardEntry[];
}

